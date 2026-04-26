from __future__ import annotations

import re
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path(r"C:\Users\HM\Desktop\MANOSABA\Background")
FULL_DIR = ROOT / "public" / "scene-backgrounds" / "full"
THUMB_DIR = ROOT / "public" / "scene-backgrounds" / "thumb"
MANIFEST_PATH = ROOT / "src" / "sceneBackgroundSamples.ts"

FULL_MAX_DIMENSION = 1200
THUMB_MAX_DIMENSION = 640
FULL_QUALITY = 80
THUMB_QUALITY = 64
VALID_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


def slugify(value: str) -> str:
    normalized = value.strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    return normalized.strip("-")


def format_name(stem: str) -> str:
    match = re.match(r"background_(\d+)_(\d+)$", stem, flags=re.IGNORECASE)
    if match:
        return f"Background {match.group(1)}-{match.group(2)}"
    return stem.replace("_", " ")


def resize_and_save(source_path: Path, target_path: Path, max_dimension: int, quality: int) -> tuple[int, int]:
    with Image.open(source_path) as image:
        converted = image.convert("RGB")
        converted.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        converted.save(target_path, format="WEBP", quality=quality, method=6)
        return converted.width, converted.height


def reset_output_dirs() -> None:
    for directory in (FULL_DIR, THUMB_DIR):
        if directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True, exist_ok=True)


def build_manifest(entries: list[dict[str, object]]) -> str:
    lines = [
        "export type SceneBackgroundSample = {",
        "  id: string;",
        "  name: string;",
        "  fullSrc: string;",
        "  thumbnailSrc: string;",
        "  width: number;",
        "  height: number;",
        "};",
        "",
        "export const SCENE_BACKGROUND_SAMPLES: SceneBackgroundSample[] = ["
    ]
    for entry in entries:
        lines.extend(
            [
                "  {",
                f'    id: "{entry["id"]}",',
                f'    name: "{entry["name"]}",',
                f'    fullSrc: "{entry["fullSrc"]}",',
                f'    thumbnailSrc: "{entry["thumbnailSrc"]}",',
                f'    width: {entry["width"]},',
                f'    height: {entry["height"]}',
                "  },"
            ]
        )
    lines.extend(["];", ""])
    return "\n".join(lines)


def main() -> None:
    if not SOURCE_DIR.exists():
        raise SystemExit(f"Source directory not found: {SOURCE_DIR}")

    reset_output_dirs()

    entries: list[dict[str, object]] = []
    for source_path in sorted(path for path in SOURCE_DIR.iterdir() if path.is_file() and path.suffix.lower() in VALID_SUFFIXES):
        slug = slugify(source_path.stem)
        full_name = f"{slug}.webp"
        thumb_name = f"{slug}.webp"
        full_path = FULL_DIR / full_name
        thumb_path = THUMB_DIR / thumb_name
        width, height = resize_and_save(source_path, full_path, FULL_MAX_DIMENSION, FULL_QUALITY)
        resize_and_save(source_path, thumb_path, THUMB_MAX_DIMENSION, THUMB_QUALITY)
        entries.append(
            {
                "id": slug,
                "name": format_name(source_path.stem),
                "fullSrc": f"/scene-backgrounds/full/{full_name}",
                "thumbnailSrc": f"/scene-backgrounds/thumb/{thumb_name}",
                "width": width,
                "height": height
            }
        )

    MANIFEST_PATH.write_text(build_manifest(entries), encoding="utf-8", newline="\n")
    print(f"Generated {len(entries)} scene background samples.")


if __name__ == "__main__":
    main()
