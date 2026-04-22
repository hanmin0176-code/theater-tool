import React, { ChangeEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileJson,
  ImagePlus,
  Italic,
  Palette,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Upload
} from "lucide-react";
import defaultTemplate from "./defaultTemplate.json";

type ModuleType = "title" | "subtitle" | "narration";
type SceneBlockType = "sceneHeader" | "character" | "narration" | "afterword" | "tikitaka";

type TextStyle = {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
};

type CharacterPreset = {
  id: string;
  name: string;
  imageData: string;
  ring: string;
};

type ModuleBlock = {
  id: string;
  kind: "module";
  moduleType: ModuleType;
  content: string;
  textStyle?: TextStyle;
};

type SceneHeaderBlock = {
  id: string;
  type: "sceneHeader";
  sceneNumber: string;
  title: string;
  desc: string;
  imageLabel: string;
  imageData?: string;
  titleStyle?: TextStyle;
  descStyle?: TextStyle;
};

type CharacterBlock = {
  id: string;
  type: "character";
  characterId: string;
  role: string;
  text: string;
  textStyle?: TextStyle;
};

type NarrationBlock = {
  id: string;
  type: "narration";
  title: string;
  text: string;
  textStyle?: TextStyle;
};

type AfterwordBlock = {
  id: string;
  type: "afterword";
  title: string;
  text: string;
  textStyle?: TextStyle;
};

type TikitakaLine = {
  id: string;
  speaker: string;
  text: string;
};

type TikitakaBlock = {
  id: string;
  type: "tikitaka";
  title: string;
  lines: TikitakaLine[];
  textStyle?: TextStyle;
};

type SceneBlock = SceneHeaderBlock | CharacterBlock | NarrationBlock | AfterwordBlock | TikitakaBlock;

type SceneCardData = {
  id: string;
  kind: "scene";
  name: string;
  blocks: SceneBlock[];
};

type PageBlock = ModuleBlock | SceneCardData;

type TheaterData = {
  blocks: PageBlock[];
};

type ThemeMode = "dark" | "light";

type SavedTemplate = {
  id: string;
  name: string;
  createdAt: string;
  data: TheaterData;
  presets: CharacterPreset[];
};

const makeId = () => Math.random().toString(36).slice(2, 10);

const MODULE_LABELS: Record<ModuleType, string> = {
  title: "제목",
  subtitle: "부제",
  narration: "나레이션"
};

const SCENE_BLOCK_LABELS: Record<SceneBlockType, string> = {
  sceneHeader: "장면 헤더",
  character: "캐릭터",
  narration: "나레이션",
  afterword: "후기",
  tikitaka: "티키타카"
};

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 14,
  bold: false,
  italic: false,
  color: "#e8e0d0"
};

const CHARACTER_PRESETS: CharacterPreset[] = [
  { id: "emma", name: "에마", imageData: "/characters/emma.png", ring: "#e7a8ba" },
  { id: "nero", name: "히로", imageData: "/characters/hiro.png", ring: "#b51f47" },
  { id: "dian", name: "안안", imageData: "/characters/anan.png", ring: "#6f81c8" },
  { id: "noa", name: "노아", imageData: "/characters/noa.png", ring: "#9bb7d4" },
  { id: "leia", name: "레이아", imageData: "/characters/leia.png", ring: "#d4b27c" },
  { id: "miriam", name: "미리아", imageData: "/characters/miria.png", ring: "#d7bf8b" },
  { id: "margo", name: "마고", imageData: "/characters/mago.png", ring: "#9a63d8" },
  { id: "pinocchio", name: "나노카", imageData: "/characters/nanoka.png", ring: "#8f939d" },
  { id: "aria", name: "아리사", imageData: "/characters/arisa.png", ring: "#b91c1c" },
  { id: "yuri", name: "셰리", imageData: "/characters/sherry.png", ring: "#7c9ef0" },
  { id: "sena", name: "한나", imageData: "/characters/hanna.png", ring: "#a8c65a" },
  { id: "coco", name: "코코", imageData: "/characters/coco.png", ring: "#ef7d36" },
  { id: "meruru", name: "메루루", imageData: "/characters/meruru.png", ring: "#b6b6be" },
  { id: "unknown", name: "교도소장", imageData: "/characters/warden.png", ring: "#666666" },
  { id: "guard", name: "간수", imageData: "/characters/guard.png", ring: "#444444" },
  { id: "yuki", name: "유키", imageData: "", ring: "#6b7280" },
  { id: "etc", name: "기타", imageData: "", ring: "#bbbbbb" }
];

const sampleData: TheaterData = {
  blocks: [
    {
      id: makeId(),
      kind: "module",
      moduleType: "title",
      content: "2회차 소녀들의 상영회 - 2부 1화",
      textStyle: { fontSize: 24, bold: true, italic: false, color: "#e8e0d0" }
    },
    {
      id: makeId(),
      kind: "module",
      moduleType: "subtitle",
      content: "웨딩 3개월 후 · 히로 시점 · 동기층위 편",
      textStyle: { fontSize: 13, bold: false, italic: false, color: "#9a9080" }
    },
    {
      id: makeId(),
      kind: "module",
      moduleType: "narration",
      content:
        "상영회는 모든 것이 끝난 뒤, 황혼 무렵의 방에서 시작된다.\n\n유키가 사라진 지 몇 달이 지났다. 앞에서는 대마녀의 흔적을 추적하기 위해 감옥에서 일어났던 일의 과정을 다시 검토해보자고 했다.\n\n히로가 **트라우마**라고 말했던 것. 모두는 [color=#c8a96e]다시 볼 준비가 되었는지[/color] 서로의 얼굴을 확인한다.",
      textStyle: { fontSize: 14, bold: false, italic: false, color: "#9a9080" }
    },
    {
      id: makeId(),
      kind: "scene",
      name: "에마를 보내고 복구를 거절 / 첫 카드",
      blocks: [
        {
          id: makeId(),
          type: "sceneHeader",
          sceneNumber: "SCENE 01",
          title: "에마를 보내고 복구를 거절",
          imageLabel: "인게임 스크린샷",
          desc: '루프 직후. 히로가 에마를 마주한다. 에마가 //“다시 친구가 될 수 있을까”//라고 묻자, 히로는 **“나는 너를 용서할 수 없고, 그 사실은 변하지 않아”**라고 답한다.',
          titleStyle: { fontSize: 13, bold: true, italic: false, color: "#e8e0d0" },
          descStyle: { fontSize: 13, bold: false, italic: false, color: "#9a9080" }
        },
        {
          id: makeId(),
          type: "character",
          characterId: "nero",
          role: "행동/결정",
          text: '//"나는 너를 용서할 수 없고, 그 사실은 변하지 않아."// 에마가 손을 뻗었지만 뿌리쳤다. 복도를 향해 혼자 걸어나갔다.',
          textStyle: { fontSize: 14, bold: false, italic: false, color: "#e8e0d0" }
        },
        {
          id: makeId(),
          type: "character",
          characterId: "margo",
          role: "질문",
          text: "루프 기억이 있는 상태에서 제일 먼저 한 게 이거야. 모두가 어떻게 죽는지 다 알고 있는데, 첫 번째 생각이 [color=#d08080]에마를 밀어내는 것[/color]이었다고?",
          textStyle: { fontSize: 14, bold: false, italic: false, color: "#e8e0d0" }
        },
        {
          id: makeId(),
          type: "character",
          characterId: "pinocchio",
          role: "직접 트리거",
          text: "룸메이트로 재회한 것 자체. 그리고 에마의 얼굴을 보는 순간 유키 자살 기억이 즉각 재점화된 것.",
          textStyle: { fontSize: 14, bold: false, italic: false, color: "#b0a080" }
        },
        {
          id: makeId(),
          type: "narration",
          title: "서술 카드",
          text: "히로는 스스로를 차갑다고 여기지만, 후회 직후부터 이미 감정적으로 무너지고 있다. 여기서 중요한 건 판단보다 [color=#e8c080]감정의 재점화[/color]다.",
          textStyle: { fontSize: 14, bold: false, italic: false, color: "#e8e0d0" }
        },
        {
          id: makeId(),
          type: "afterword",
          title: "서술 의도",
          text: "에마가 사라지는 장면보다 히로의 침묵을 강조해, 결정의 무게가 먼저 오도록 둔다.",
          textStyle: { fontSize: 12, bold: false, italic: false, color: "#9a9080" }
        },
        {
          id: makeId(),
          type: "tikitaka",
          title: "티키타카",
          textStyle: { fontSize: 13, bold: false, italic: false, color: "#9a9080" },
          lines: [
            { id: makeId(), speaker: "에마", text: "정말로 여기서 끝낼 거야?" },
            { id: makeId(), speaker: "한나", text: "그 말, 네가 제일 아프게 듣고 있잖아." },
            { id: makeId(), speaker: "히로", text: "...그래도 해야 해." }
          ]
        }
      ]
    }
  ]
};

const baseCss = `
:root {
  --bg: #0f0e0d;
  --surface: #1a1814;
  --surface-2: #151311;
  --border: #2e2a24;
  --accent: #c8a96e;
  --text: #e8e0d0;
  --text-dim: #9a9080;
  --text-faint: #5a5448;
  --scroll-track: #1b1916;
  --scroll-thumb: rgb(200, 169, 110);
}
body.theme-light {
  --bg: #f6f2ea;
  --surface: #fffaf2;
  --surface-2: #ede5d8;
  --border: #d9cbb8;
  --accent: #8f6f32;
  --text: #24211d;
  --text-dim: #675d50;
  --text-faint: #968775;
  --scroll-track: #e8dece;
  --scroll-thumb: rgb(200, 169, 110);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html {
  scrollbar-color: var(--scroll-thumb) var(--scroll-track);
  scrollbar-width: thin;
}
::-webkit-scrollbar { width: 12px; height: 12px; }
::-webkit-scrollbar-track { background: var(--scroll-track); }
::-webkit-scrollbar-thumb { background: var(--scroll-thumb); border: 3px solid var(--scroll-track); border-radius: 999px; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Pretendard','Noto Sans KR',sans-serif;
  font-size: 15px;
  line-height: 1.8;
  max-width: 780px;
  margin: 0 auto;
  padding: 40px 20px 80px;
}
.post-header { border-bottom: 1px solid var(--border); padding-bottom: 28px; margin-bottom: 40px; }
.post-tag { font-size: 11px; letter-spacing: 2px; color: var(--accent); text-transform: uppercase; margin-bottom: 10px; }
.module-title { margin: 0 0 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.post-title { font-family: 'Noto Serif KR', serif; font-size: 22px; font-weight: 700; line-height: 1.4; margin-bottom: 6px; }
.module-subtitle { margin: 0 0 20px; }
.post-subtitle { font-size: 13px; color: var(--text-dim); }
.narrative { color: var(--text-dim); font-size: 14px; line-height: 1.9; margin: 24px 0; padding-left: 16px; border-left: 2px solid var(--border); white-space: pre-wrap; }
.scene { margin: 40px 0; border: 1px solid var(--border); background: var(--surface); }
.scene-header { background: var(--surface-2); padding: 10px 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); }
.scene-num { font-size: 11px; letter-spacing: 1px; color: var(--accent); text-transform: uppercase; }
.scene-title { font-size: 13px; font-weight: 500; color: var(--text); }
.scene-img-placeholder { width: 100%; min-height: 180px; background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 6px; color: var(--text-faint); font-size: 12px; letter-spacing: 1px; padding: 20px; text-align: center; overflow: hidden; }
.scene-img-placeholder img { max-width: 100%; max-height: 280px; object-fit: contain; display: block; }
.scene-desc { padding: 12px 16px; font-size: 13px; color: var(--text-dim); border-bottom: 1px solid var(--border); line-height: 1.7; white-space: pre-wrap; }
.dialogue-block { padding: 8px 16px; display: flex; flex-direction: column; gap: 2px; }
.dialogue-row, .narration-row { display: flex; gap: 12px; align-items: flex-start; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.char-portrait { flex-shrink: 0; width: 58px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.avatar, .avatar-img { width: 46px; height: 46px; border-radius: 9999px; border: 3px solid var(--ring, var(--border)); background: #26231e; object-fit: cover; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; text-align: center; padding: 4px; }
.char-name { font-size: 9px; color: var(--text-faint); text-align: center; line-height: 1.3; }
.dialogue-content, .narration-content { flex: 1; padding-top: 4px; }
.dialogue-label, .narration-label { font-size: 10px; letter-spacing: 1px; color: var(--text-faint); text-transform: uppercase; margin-bottom: 3px; }
.dialogue-text, .narration-text { font-size: 14px; color: var(--text); line-height: 1.7; white-space: pre-wrap; }
.afterword { margin: 12px 16px; padding: 10px 14px; background: rgba(200,169,110,0.05); border-left: 3px solid var(--accent); font-size: 12px; color: var(--text-dim); line-height: 1.7; white-space: pre-wrap; }
.afterword-title, .tikitaka-title { font-size: 10px; color: var(--accent); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
.tikitaka { margin: 16px; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); font-size: 13px; color: var(--text-dim); line-height: 1.8; white-space: pre-wrap; }
em { color: var(--accent2); font-style: italic; }
strong { color: var(--text); font-weight: 700; }
`;

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function isSceneCard(block: PageBlock): block is SceneCardData {
  return block.kind === "scene";
}

function moveArrayItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function styleToCss(style?: TextStyle) {
  if (!style) return "";
  const parts: string[] = [];
  if (style.fontSize) parts.push(`font-size:${style.fontSize}px`);
  if (style.bold !== undefined) parts.push(`font-weight:${style.bold ? 700 : 400}`);
  if (style.italic !== undefined) parts.push(`font-style:${style.italic ? "italic" : "normal"}`);
  if (style.color) parts.push(`color:${style.color}`);
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

function renderRichText(str = "") {
  let html = escapeHtml(str);
  html = html.replace(/\[size=([0-9]{1,2})\]([\s\S]*?)\[\/size\]/g, (_match, size, text) => {
    const safeSize = Math.min(48, Math.max(9, Number(size)));
    return `<span style="font-size:${safeSize}px">${text}</span>`;
  });
  html = html.replace(/\[color=(#[0-9a-fA-F]{3,8})\]([\s\S]*?)\[\/color\]/g, '<span style="color:$1">$2</span>');
  html = html.replace(/\*\*([\s\S]*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\/\/([\s\S]*?)\/\//g, "<em>$1</em>");
  return html.replace(/\n/g, "<br />");
}

function normalizeStyle(style?: TextStyle): Required<TextStyle> {
  return { ...DEFAULT_TEXT_STYLE, ...style } as Required<TextStyle>;
}

function renderModuleBlock(block: ModuleBlock) {
  const style = styleToCss(block.textStyle);
  if (block.moduleType === "title") return `<div class="module-title"><h1 class="post-title"${style}>${renderRichText(block.content)}</h1></div>`;
  if (block.moduleType === "subtitle") return `<div class="module-subtitle"><p class="post-subtitle"${style}>${renderRichText(block.content)}</p></div>`;
  return `<p class="narrative"${style}>${renderRichText(block.content)}</p>`;
}

function renderSceneBlock(block: SceneBlock, presets: CharacterPreset[]) {
  if (block.type === "sceneHeader") {
    const image = block.imageData
      ? `<img src="${block.imageData}" alt="${escapeHtml(block.imageLabel || block.title)}" />`
      : `<span>${escapeHtml(block.imageLabel || "이미지 없음")}</span>`;
    return `<div class="scene-header"><span class="scene-num">${escapeHtml(block.sceneNumber)}</span><span class="scene-title"${styleToCss(
      block.titleStyle
    )}>${renderRichText(block.title)}</span></div><div class="scene-img-placeholder">${image}</div><div class="scene-desc"${styleToCss(
      block.descStyle
    )}>${renderRichText(block.desc)}</div>`;
  }
  if (block.type === "character") {
    const character = presets.find((preset) => preset.id === block.characterId) ?? presets[0];
    const avatar = character.imageData
      ? `<img class="avatar-img" style="--ring:${character.ring}" src="${character.imageData}" alt="${escapeHtml(character.name)}" />`
      : `<div class="avatar" style="--ring:${character.ring}">${escapeHtml(character.name.slice(0, 2))}</div>`;
    return `<div class="dialogue-block"><div class="dialogue-row"><div class="char-portrait">${avatar}<div class="char-name">${escapeHtml(
      character.name
    )}</div></div><div class="dialogue-content"><div class="dialogue-label">${escapeHtml(block.role)}</div><div class="dialogue-text"${styleToCss(
      block.textStyle
    )}>${renderRichText(block.text)}</div></div></div></div>`;
  }
  if (block.type === "narration") {
    return `<div class="narration-row"><div class="narration-content"><div class="narration-label">${escapeHtml(
      block.title
    )}</div><div class="narration-text"${styleToCss(block.textStyle)}>${renderRichText(block.text)}</div></div></div>`;
  }
  if (block.type === "afterword") {
    return `<div class="afterword"${styleToCss(block.textStyle)}><div class="afterword-title">${escapeHtml(block.title)}</div>${renderRichText(block.text)}</div>`;
  }
  return `<div class="tikitaka"${styleToCss(block.textStyle)}><div class="tikitaka-title">${escapeHtml(block.title)}</div>${block.lines
    .map((line) => `<strong>${escapeHtml(line.speaker)}</strong>: ${renderRichText(line.text)}`)
    .join("<br />")}</div>`;
}

function renderHtml(data: TheaterData, presets: CharacterPreset[], theme: ThemeMode = "dark") {
  const blocks = [...data.blocks];
  let header = "";
  if (blocks[0]?.kind === "module" && blocks[0].moduleType === "title" && blocks[1]?.kind === "module" && blocks[1].moduleType === "subtitle") {
    const title = blocks.shift() as ModuleBlock;
    const subtitle = blocks.shift() as ModuleBlock;
    header = `<div class="post-header"><div class="post-title"${styleToCss(
      title.textStyle
    )}>${renderRichText(title.content)}</div><div class="post-subtitle"${styleToCss(subtitle.textStyle)}>${renderRichText(subtitle.content)}</div></div>`;
  }

  const body = blocks
    .map((block) => {
      if (!isSceneCard(block)) return renderModuleBlock(block);
      return `<section class="scene">${block.blocks.map((sceneBlock) => renderSceneBlock(sceneBlock, presets)).join("")}</section>`;
    })
    .join("\n");
  return `<!doctype html><html lang="ko"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Theater Export</title><style>${baseCss}</style></head><body class="theme-${theme}">${header}${body}</body></html>`;
}

function createModuleBlock(moduleType: ModuleType): ModuleBlock {
  return {
    id: makeId(),
    kind: "module",
    moduleType,
    content: moduleType === "title" ? "새 제목" : moduleType === "subtitle" ? "새 부제" : "새 나레이션",
    textStyle: moduleType === "title" ? { ...DEFAULT_TEXT_STYLE, fontSize: 22, bold: true } : { ...DEFAULT_TEXT_STYLE }
  };
}

function createSceneCard(): SceneCardData {
  return {
    id: makeId(),
    kind: "scene",
    name: "새 장면",
    blocks: [
      {
        id: makeId(),
        type: "sceneHeader",
        sceneNumber: "SCENE",
        title: "새 장면",
        desc: "",
        imageLabel: "이미지",
        titleStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 13, bold: true },
        descStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 13, color: "#9a9080" }
      }
    ]
  };
}

function createSceneBlock(type: SceneBlockType, defaultCharacterId: string): SceneBlock {
  if (type === "sceneHeader") {
    return {
      id: makeId(),
      type,
      sceneNumber: "SCENE",
      title: "장면 제목",
      desc: "",
      imageLabel: "이미지",
      titleStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 13, bold: true },
      descStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 13, color: "#9a9080" }
    };
  }
  if (type === "character") return { id: makeId(), type, characterId: defaultCharacterId, role: "대사", text: "", textStyle: { ...DEFAULT_TEXT_STYLE } };
  if (type === "narration") return { id: makeId(), type, title: "나레이션", text: "", textStyle: { ...DEFAULT_TEXT_STYLE } };
  if (type === "afterword") return { id: makeId(), type, title: "후기", text: "", textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 12, color: "#9a9080" } };
  return { id: makeId(), type, title: "티키타카", textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 13, color: "#9a9080" }, lines: [{ id: makeId(), speaker: "화자", text: "" }] };
}

function readImageFile(file: File, callback: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result || ""));
  reader.readAsDataURL(file);
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const assetDataUrlCache = new Map<string, string>();

async function assetToDataUrl(src: string) {
  if (!src || src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) return src;
  if (!src.startsWith("/")) return src;
  const cached = assetDataUrlCache.get(src);
  if (cached) return cached;

  const response = await fetch(src);
  if (!response.ok) return src;
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || src));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  assetDataUrlCache.set(src, dataUrl);
  return dataUrl;
}

async function renderDownloadHtml(data: TheaterData, presets: CharacterPreset[], theme: ThemeMode) {
  const exportPresets = await Promise.all(
    presets.map(async (preset) => ({
      ...preset,
      imageData: await assetToDataUrl(preset.imageData)
    }))
  );

  const exportData: TheaterData = {
    blocks: await Promise.all(
      data.blocks.map(async (block) => {
        if (!isSceneCard(block)) return block;
        return {
          ...block,
          blocks: await Promise.all(
            block.blocks.map(async (sceneBlock) => {
              if (sceneBlock.type !== "sceneHeader" || !sceneBlock.imageData) return sceneBlock;
              return { ...sceneBlock, imageData: await assetToDataUrl(sceneBlock.imageData) };
            })
          )
        };
      })
    )
  };

  return renderHtml(exportData, exportPresets, theme);
}

const TEMPLATE_STORAGE_KEY = "theater-tool-templates";

function loadSavedTemplates(): SavedTemplate[] {
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: SavedTemplate[]) {
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function getDefaultTemplateName(data: TheaterData) {
  const titleBlock = data.blocks.find((block): block is ModuleBlock => block.kind === "module" && block.moduleType === "title");
  return titleBlock?.content.replace(/\[[^\]]+\]|\[\/[^\]]+\]|\*\*|\/\//g, "").trim() || "새 템플릿";
}

function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (value: string) => void; rows?: number }) {
  return <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />;
}

function RichTextArea({ value, onChange, rows = 3 }: { value: string; onChange: (value: string) => void; rows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [color, setColor] = useState("#c8a96e");
  const [fontSize, setFontSize] = useState(14);
  const changeFontSize = (delta: number) => {
    setFontSize((current) => Math.min(48, Math.max(9, current + delta)));
  };

  const wrapSelection = (before: string, after: string, fallback: string) => {
    const textarea = ref.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  return (
    <div className="richTextBox">
      <div className="inlineToolbar">
        <button type="button" onClick={() => wrapSelection("**", "**", "굵은 텍스트")} title="선택 글자 굵게">
          <Bold size={15} />
          굵게
        </button>
        <button type="button" onClick={() => wrapSelection("//", "//", "기울인 텍스트")} title="선택 글자 기울임">
          <Italic size={15} />
          기울임
        </button>
        <label className="inlineColor">
          <Palette size={15} />
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </label>
        <button type="button" onClick={() => wrapSelection(`[color=${color}]`, "[/color]", "색상 텍스트")} title="선택 글자 색상 적용">
          색상
        </button>
        <label className="inlineSize">
          크기
          <span className="sizeStepper">
            <input
              type="number"
              min={9}
              max={48}
              value={fontSize}
              onChange={(event) => setFontSize(Math.min(48, Math.max(9, Number(event.target.value) || 9)))}
            />
            <span className="stepperButtons">
              <button type="button" onClick={() => changeFontSize(1)} aria-label="글자 크기 증가">
                <ChevronUp size={11} />
              </button>
              <button type="button" onClick={() => changeFontSize(-1)} aria-label="글자 크기 감소">
                <ChevronDown size={11} />
              </button>
            </span>
          </span>
        </label>
        <button type="button" onClick={() => wrapSelection(`[size=${fontSize}]`, "[/size]", "크기 텍스트")} title="선택 글자 크기 적용">
          적용
        </button>
      </div>
      <textarea ref={ref} value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function CharacterImageManager({
  presets,
  setPresets
}: {
  presets: CharacterPreset[];
  setPresets: React.Dispatch<React.SetStateAction<CharacterPreset[]>>;
}) {
  return (
    <section className="panel">
      <div className="panelTitle">
        <ImagePlus size={18} />
        캐릭터
      </div>
      <div className="characterGrid">
        {presets.map((preset) => (
          <label className="characterChip" key={preset.id}>
            <span className="miniAvatar" style={{ borderColor: preset.ring }}>
              {preset.imageData ? <img src={preset.imageData} alt="" /> : preset.name.slice(0, 2)}
            </span>
            <span>{preset.name}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                readImageFile(file, (imageData) => {
                  setPresets((current) => current.map((item) => (item.id === preset.id ? { ...item, imageData } : item)));
                });
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function SceneBlockEditor({
  block,
  presets,
  onChange
}: {
  block: SceneBlock;
  presets: CharacterPreset[];
  onChange: (block: SceneBlock) => void;
}) {
  if (block.type === "sceneHeader") {
    return (
      <div className="fieldGrid">
        <input value={block.sceneNumber} onChange={(event) => onChange({ ...block, sceneNumber: event.target.value })} placeholder="SCENE 01" />
        <RichTextArea value={block.title} rows={2} onChange={(title) => onChange({ ...block, title })} />
        <input value={block.imageLabel} onChange={(event) => onChange({ ...block, imageLabel: event.target.value })} placeholder="이미지 라벨" />
        <label className="fileButton">
          <Upload size={15} />
          장면 이미지
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              readImageFile(file, (imageData) => onChange({ ...block, imageData }));
            }}
          />
        </label>
        <RichTextArea value={block.desc} rows={4} onChange={(desc) => onChange({ ...block, desc })} />
      </div>
    );
  }

  if (block.type === "character") {
    return (
      <div className="fieldGrid">
        <select value={block.characterId} onChange={(event) => onChange({ ...block, characterId: event.target.value })}>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
        <input value={block.role} onChange={(event) => onChange({ ...block, role: event.target.value })} placeholder="역할/라벨" />
        <RichTextArea value={block.text} rows={4} onChange={(text) => onChange({ ...block, text })} />
      </div>
    );
  }

  if (block.type === "tikitaka") {
    return (
      <div className="fieldGrid">
        <input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} placeholder="제목" />
        {block.lines.map((line, index) => (
          <div className="lineEditorRich" key={line.id}>
            <div className="lineMeta">
              <input
                value={line.speaker}
                onChange={(event) =>
                  onChange({ ...block, lines: block.lines.map((item) => (item.id === line.id ? { ...item, speaker: event.target.value } : item)) })
                }
                placeholder="화자"
              />
              <button
                type="button"
                className="iconButton"
                onClick={() => onChange({ ...block, lines: block.lines.filter((_, lineIndex) => lineIndex !== index) })}
                aria-label="줄 삭제"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <RichTextArea
              value={line.text}
              rows={2}
              onChange={(text) =>
                onChange({ ...block, lines: block.lines.map((item) => (item.id === line.id ? { ...item, text } : item)) })
              }
            />
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...block, lines: [...block.lines, { id: makeId(), speaker: "화자", text: "" }] })}>
          <Plus size={15} />줄 추가
        </button>
      </div>
    );
  }

  return (
    <div className="fieldGrid">
      <input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} placeholder="제목" />
      <RichTextArea value={block.text} rows={4} onChange={(text) => onChange({ ...block, text })} />
    </div>
  );
}

function SceneEditor({
  scene,
  presets,
  onChange
}: {
  scene: SceneCardData;
  presets: CharacterPreset[];
  onChange: (scene: SceneCardData) => void;
}) {
  const defaultCharacterId = presets[0]?.id ?? "unknown";

  return (
    <section className="sceneEditor">
      <input className="sceneName" value={scene.name} onChange={(event) => onChange({ ...scene, name: event.target.value })} />
      <div className="addRow">
        {(["sceneHeader", "character", "narration", "afterword", "tikitaka"] as SceneBlockType[]).map((type) => (
          <button key={type} type="button" onClick={() => onChange({ ...scene, blocks: [...scene.blocks, createSceneBlock(type, defaultCharacterId)] })}>
            <Plus size={14} />
            {SCENE_BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
      {scene.blocks.map((block, index) => (
        <div className="blockEditor" key={block.id}>
          <div className="blockHeader">
            <strong>{SCENE_BLOCK_LABELS[block.type]}</strong>
            <div>
              <button type="button" className="iconButton" onClick={() => onChange({ ...scene, blocks: moveArrayItem(scene.blocks, index, -1) })}>
                <ArrowUp size={15} />
              </button>
              <button type="button" className="iconButton" onClick={() => onChange({ ...scene, blocks: moveArrayItem(scene.blocks, index, 1) })}>
                <ArrowDown size={15} />
              </button>
              <button type="button" className="iconButton danger" onClick={() => onChange({ ...scene, blocks: scene.blocks.filter((item) => item.id !== block.id) })}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          <SceneBlockEditor
            block={block}
            presets={presets}
            onChange={(nextBlock) => onChange({ ...scene, blocks: scene.blocks.map((item) => (item.id === block.id ? nextBlock : item)) })}
          />
        </div>
      ))}
    </section>
  );
}

export default function TheaterToolBuilder() {
  const [data, setData] = useState<TheaterData>(defaultTemplate as TheaterData);
  const [history, setHistory] = useState<TheaterData[]>([]);
  const [future, setFuture] = useState<TheaterData[]>([]);
  const [presets, setPresets] = useState<CharacterPreset[]>(CHARACTER_PRESETS);
  const [templates, setTemplates] = useState<SavedTemplate[]>(() => loadSavedTemplates());
  const [editorPercent, setEditorPercent] = useState(52);
  const [isResizing, setIsResizing] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const importRef = useRef<HTMLInputElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const previewScrollRef = useRef({ x: 0, y: 0 });
  const html = useMemo(() => renderHtml(data, presets, theme), [data, presets, theme]);

  const commitData = (next: TheaterData | ((current: TheaterData) => TheaterData)) => {
    setData((current) => {
      const resolved = typeof next === "function" ? (next as (current: TheaterData) => TheaterData)(current) : next;
      if (resolved === current || JSON.stringify(resolved) === JSON.stringify(current)) return current;
      setHistory((items) => [...items.slice(-79), current]);
      setFuture([]);
      return resolved;
    });
  };

  const undo = () => {
    setHistory((items) => {
      if (items.length === 0) return items;
      const previous = items[items.length - 1];
      setFuture((futureItems) => [data, ...futureItems.slice(0, 79)]);
      setData(previous);
      return items.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((items) => {
      if (items.length === 0) return items;
      const next = items[0];
      setHistory((historyItems) => [...historyItems.slice(-79), data]);
      setData(next);
      return items.slice(1);
    });
  };

  useLayoutEffect(() => {
    const frame = previewRef.current;
    if (!frame) return;

    const rememberScroll = () => {
      const win = frame.contentWindow;
      if (!win) return;
      previewScrollRef.current = { x: win.scrollX, y: win.scrollY };
    };

    const restoreScroll = () => {
      const win = frame.contentWindow;
      if (!win) return;
      win.scrollTo(previewScrollRef.current.x, previewScrollRef.current.y);
    };

    frame.contentWindow?.addEventListener("scroll", rememberScroll, { passive: true });
    frame.addEventListener("load", restoreScroll);
    window.requestAnimationFrame(restoreScroll);

    return () => {
      rememberScroll();
      frame.contentWindow?.removeEventListener("scroll", rememberScroll);
      frame.removeEventListener("load", restoreScroll);
    };
  }, [html]);

  useLayoutEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [data, history, future]);

  const updateBlock = (id: string, nextBlock: PageBlock) => {
    commitData((current) => ({ blocks: current.blocks.map((block) => (block.id === id ? nextBlock : block)) }));
  };

  const persistTemplates = (nextTemplates: SavedTemplate[]) => {
    setTemplates(nextTemplates);
    saveTemplates(nextTemplates);
  };

  const saveCurrentTemplate = () => {
    const name = window.prompt("저장할 템플릿 이름을 입력하세요.", getDefaultTemplateName(data));
    if (!name?.trim()) return;
    const nextTemplate: SavedTemplate = {
      id: makeId(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      data,
      presets
    };
    persistTemplates([nextTemplate, ...templates]);
  };

  const loadTemplate = (template: SavedTemplate) => {
    commitData(template.data);
    setPresets(template.presets);
  };

  const deleteTemplate = (templateId: string) => {
    if (!window.confirm("이 템플릿을 삭제할까요?")) return;
    persistTemplates(templates.filter((template) => template.id !== templateId));
  };

  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = JSON.parse(String(reader.result || "{}")) as { data?: TheaterData; presets?: CharacterPreset[] };
      if (parsed.data?.blocks) commitData(parsed.data);
      if (parsed.presets) setPresets(parsed.presets);
    };
    reader.readAsText(file);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsResizing(true);

    const updateSize = (clientX: number) => {
      const rect = splitRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = ((clientX - rect.left) / rect.width) * 100;
      setEditorPercent(Math.min(72, Math.max(34, next)));
    };

    const handleMove = (moveEvent: PointerEvent) => updateSize(moveEvent.clientX);
    const handleUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    updateSize(event.clientX);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <main className={`appShell theme-${theme}`}>
      <style>{appCss}</style>
      <header className="toolbar">
        <div>
          <h1>극장 도구 제작기</h1>
          <p>왼쪽에서 편집하고 오른쪽에서 결과를 바로 확인합니다.</p>
        </div>
        <div className="toolbarActions">
          <button type="button" onClick={undo} disabled={history.length === 0} title="Ctrl+Z">
            <Undo2 size={16} />
            실행 취소
          </button>
          <button type="button" onClick={redo} disabled={future.length === 0} title="Ctrl+Y / Ctrl+Shift+Z">
            <Redo2 size={16} />
            다시 실행
          </button>
          <button type="button" onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}>
            <Palette size={16} />
            {theme === "dark" ? "화이트 모드" : "다크 모드"}
          </button>
          <button type="button" onClick={() => importRef.current?.click()}>
            <Upload size={16} />
            JSON 가져오기
          </button>
          <input ref={importRef} className="hiddenInput" type="file" accept="application/json" onChange={importJson} />
          <button type="button" onClick={() => downloadFile("theater-data.json", JSON.stringify({ data, presets }, null, 2), "application/json")}>
            <FileJson size={16} />
            JSON 저장
          </button>
          <button
            type="button"
            onClick={async () => {
              const exportHtml = await renderDownloadHtml(data, presets, theme);
              downloadFile("theater-export.html", exportHtml, "text/html");
            }}
          >
            <Download size={16} />
            HTML 저장
          </button>
        </div>
      </header>

      <div ref={splitRef} className={`splitWorkspace${isResizing ? " resizing" : ""}`} style={{ "--editor-percent": `${editorPercent}%` } as React.CSSProperties}>
        <section className="editorPane">
          <div className="editorTools">
            <CharacterImageManager presets={presets} setPresets={setPresets} />
            <section className="panel">
              <div className="panelTitle">
                <FileJson size={18} />
                템플릿
              </div>
              <button type="button" onClick={saveCurrentTemplate}>
                <Plus size={15} />
                현재 회차 저장
              </button>
              {templates.length === 0 ? (
                <div className="emptyTemplates">저장된 템플릿 없음</div>
              ) : (
                <div className="templateList">
                  {templates.map((template) => (
                    <div className="templateItem" key={template.id}>
                      <button type="button" className="templateLoad" onClick={() => loadTemplate(template)} title="템플릿 불러오기">
                        <span>{template.name}</span>
                        <small>{new Date(template.createdAt).toLocaleString()}</small>
                      </button>
                      <button type="button" className="iconButton danger" onClick={() => deleteTemplate(template.id)} aria-label="템플릿 삭제">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panelTitle">
                <Plus size={18} />
                블록 추가
              </div>
              <button type="button" onClick={() => commitData((current) => ({ blocks: [...current.blocks, createModuleBlock("title")] }))}>
                제목
              </button>
              <button type="button" onClick={() => commitData((current) => ({ blocks: [...current.blocks, createModuleBlock("subtitle")] }))}>
                부제
              </button>
              <button type="button" onClick={() => commitData((current) => ({ blocks: [...current.blocks, createModuleBlock("narration")] }))}>
                나레이션
              </button>
              <button type="button" onClick={() => commitData((current) => ({ blocks: [...current.blocks, createSceneCard()] }))}>
                장면
              </button>
            </section>
          </div>

          <section className="editorList">
            {data.blocks.map((block, index) => (
              <article className="editorCard" key={block.id}>
                <div className="blockHeader">
                  <strong>{isSceneCard(block) ? "장면" : MODULE_LABELS[block.moduleType]}</strong>
                  <div>
                    <button type="button" className="iconButton" onClick={() => commitData({ blocks: moveArrayItem(data.blocks, index, -1) })}>
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" className="iconButton" onClick={() => commitData({ blocks: moveArrayItem(data.blocks, index, 1) })}>
                      <ArrowDown size={15} />
                    </button>
                    <button type="button" className="iconButton danger" onClick={() => commitData({ blocks: data.blocks.filter((item) => item.id !== block.id) })}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {isSceneCard(block) ? (
                  <SceneEditor scene={block} presets={presets} onChange={(scene) => updateBlock(block.id, scene)} />
                ) : (
                  <div className="fieldGrid">
                    <RichTextArea value={block.content} rows={block.moduleType === "narration" ? 5 : 2} onChange={(content) => updateBlock(block.id, { ...block, content })} />
                  </div>
                )}
              </article>
            ))}
          </section>
        </section>

        <button type="button" className="resizeHandle" onPointerDown={startResize} aria-label="편집기와 미리보기 너비 조절" title="좌우 폭 조절" />

        <section className="previewPane">
          <div className="previewHeader">
            <Eye size={17} />
            미리보기
          </div>
          <iframe ref={previewRef} className="previewFrame" title="미리보기" srcDoc={html} />
          {isResizing ? <div className="dragShield" /> : null}
        </section>
      </div>
    </main>
  );
}

const appCss = `
.appShell {
  --app-bg: #12110f;
  --app-surface: #191713;
  --app-surface-2: #151410;
  --app-surface-3: #11100e;
  --app-control: #201d18;
  --app-control-2: #141310;
  --app-border: #2e2a24;
  --app-border-2: #3b352d;
  --app-text: #efe8dc;
  --app-dim: #a69b8c;
  --app-faint: #756c5f;
  --app-accent: rgb(200, 169, 110);
  --app-accent-soft: #f7d58f;
  --scroll-track: #1b1916;
  --scroll-thumb: rgb(200, 169, 110);
}
.appShell.theme-light {
  --app-bg: #f3eee6;
  --app-surface: #fffaf2;
  --app-surface-2: #f6efe4;
  --app-surface-3: #eee4d6;
  --app-control: #fff7ed;
  --app-control-2: #fffaf4;
  --app-border: #d8c9b7;
  --app-border-2: #c7b49e;
  --app-text: #28231e;
  --app-dim: #685f54;
  --app-faint: #938371;
  --app-accent: rgb(200, 169, 110);
  --app-accent-soft: #8f6f32;
  --scroll-track: #e6dccd;
  --scroll-thumb: rgb(200, 169, 110);
}
html { scrollbar-color: rgb(200, 169, 110) #1b1916; scrollbar-width: thin; }
body { margin: 0; background: #12110f; color: #efe8dc; font-family: Pretendard, 'Noto Sans KR', system-ui, sans-serif; }
body:has(.appShell.theme-light) { background: #f3eee6; color: #28231e; }
* { scrollbar-color: var(--scroll-thumb, rgb(200, 169, 110)) var(--scroll-track, #1b1916); scrollbar-width: thin; }
::-webkit-scrollbar { width: 12px; height: 12px; }
::-webkit-scrollbar-track { background: var(--scroll-track, #1b1916); }
::-webkit-scrollbar-thumb { background: var(--scroll-thumb, rgb(200, 169, 110)); border: 3px solid var(--scroll-track, #1b1916); border-radius: 999px; }
button, input, textarea, select { font: inherit; }
button { min-height: 36px; border: 1px solid var(--app-border-2); background: var(--app-control); color: var(--app-text); padding: 7px 10px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; }
button:hover, button.active { border-color: var(--app-accent); color: var(--app-accent-soft); }
button:disabled { opacity: 0.42; cursor: not-allowed; }
input, textarea, select { width: 100%; border: 1px solid var(--app-border-2); background: var(--app-control-2); color: var(--app-text); border-radius: 8px; padding: 9px 10px; }
textarea { resize: vertical; line-height: 1.6; }
.appShell { min-height: 100vh; background: var(--app-bg); color: var(--app-text); }
.toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 24px; border-bottom: 1px solid var(--app-border); background: color-mix(in srgb, var(--app-bg) 96%, transparent); backdrop-filter: blur(12px); }
.toolbar h1 { margin: 0; font-size: 22px; }
.toolbar p { margin: 2px 0 0; color: var(--app-dim); font-size: 13px; }
.toolbarActions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.splitWorkspace { --editor-percent: 52%; display: grid; grid-template-columns: minmax(420px, var(--editor-percent)) 12px minmax(360px, 1fr); gap: 12px; padding: 18px 24px 32px; align-items: start; }
.splitWorkspace.resizing { cursor: col-resize; user-select: none; }
.editorPane { min-width: 0; display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 14px; align-items: start; }
.editorTools { position: sticky; top: 92px; display: flex; flex-direction: column; gap: 14px; max-height: calc(100vh - 112px); overflow: auto; padding-right: 2px; }
.resizeHandle { position: sticky; top: 92px; width: 12px; height: calc(100vh - 112px); min-height: 180px; padding: 0; border: 0; border-radius: 999px; background: transparent; cursor: col-resize; align-self: start; }
.resizeHandle::before { content: ""; display: block; width: 4px; height: 100%; margin: 0 auto; border-radius: 999px; background: var(--app-border); transition: background 120ms ease, width 120ms ease; }
.resizeHandle:hover::before, .resizeHandle:focus-visible::before, .splitWorkspace.resizing .resizeHandle::before { width: 6px; background: var(--app-accent); }
.previewPane { position: sticky; top: 92px; min-width: 0; height: calc(100vh - 112px); border: 1px solid var(--app-border); background: var(--app-surface); border-radius: 8px; overflow: hidden; }
.previewHeader { height: 42px; display: flex; align-items: center; gap: 8px; padding: 0 13px; border-bottom: 1px solid var(--app-border); color: var(--app-accent-soft); font-weight: 700; }
.panel, .editorCard, .blockEditor { border: 1px solid var(--app-border); background: var(--app-surface); border-radius: 8px; padding: 14px; }
.panel { display: grid; gap: 8px; align-content: start; }
.panelTitle, .blockHeader { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; color: var(--app-accent-soft); font-weight: 700; }
.panelTitle { justify-content: flex-start; }
.emptyTemplates { padding: 10px; border: 1px dashed var(--app-border-2); border-radius: 8px; color: var(--app-faint); font-size: 12px; text-align: center; }
.templateList { display: grid; gap: 7px; }
.templateItem { display: grid; grid-template-columns: minmax(0, 1fr) 34px; gap: 7px; align-items: stretch; }
.templateLoad { min-width: 0; justify-content: flex-start; align-items: flex-start; flex-direction: column; gap: 1px; text-align: left; }
.templateLoad span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.templateLoad small { color: var(--app-faint); font-size: 11px; font-weight: 400; }
.characterGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.characterChip { min-height: 46px; border: 1px solid var(--app-border); background: var(--app-control-2); border-radius: 8px; padding: 7px; display: flex; align-items: center; gap: 7px; cursor: pointer; font-size: 12px; }
.characterChip input, .hiddenInput { display: none; }
.miniAvatar { width: 30px; height: 30px; border: 2px solid; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; flex: 0 0 auto; font-size: 10px; }
.miniAvatar img { width: 100%; height: 100%; object-fit: cover; }
.editorList { display: grid; gap: 14px; }
.sceneEditor { display: grid; gap: 12px; }
.sceneName { font-weight: 700; }
.addRow { display: flex; flex-wrap: wrap; gap: 8px; }
.blockEditor { background: var(--app-surface-2); }
.blockHeader > div { display: flex; gap: 6px; }
.iconButton { width: 34px; min-height: 34px; padding: 0; }
.danger:hover { border-color: #e37a7a; color: #ffb4b4; }
.fieldGrid { display: grid; gap: 9px; }
.lineEditor { display: grid; grid-template-columns: 110px minmax(0, 1fr) 34px; gap: 7px; }
.lineEditorRich { display: grid; gap: 7px; padding: 8px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-3); }
.lineMeta { display: grid; grid-template-columns: minmax(0, 1fr) 34px; gap: 7px; }
.fileButton { min-height: 36px; border: 1px dashed var(--app-border-2); background: var(--app-surface-2); border-radius: 8px; padding: 8px 10px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; color: var(--app-dim); }
.fileButton input { display: none; }
.richTextBox { display: grid; gap: 6px; }
.inlineToolbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.inlineToolbar button { min-height: 30px; padding: 5px 8px; font-size: 12px; }
.inlineColor { min-height: 30px; border: 1px solid var(--app-border-2); background: var(--app-control); color: var(--app-text); padding: 4px 7px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; }
.inlineColor input { width: 28px; height: 22px; padding: 0; border: 0; background: transparent; }
.inlineSize { min-height: 30px; border: 1px solid var(--app-border-2); background: var(--app-control); color: var(--app-text); padding: 4px 7px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.sizeStepper { width: 64px; height: 24px; display: grid; grid-template-columns: minmax(0, 1fr) 18px; overflow: hidden; border: 1px solid var(--app-border); border-radius: 6px; background: var(--app-control-2); }
.sizeStepper input { width: 100%; height: 100%; min-width: 0; padding: 0 4px; border: 0; border-radius: 0; background: transparent; color: var(--app-text); text-align: center; font-size: 12px; -moz-appearance: textfield; }
.sizeStepper input::-webkit-outer-spin-button,
.sizeStepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.stepperButtons { display: grid; grid-template-rows: 1fr 1fr; border-left: 1px solid var(--app-border); background: color-mix(in srgb, var(--app-control) 78%, var(--app-accent) 22%); }
.stepperButtons button { width: 18px; min-height: 0; height: 11px; padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--app-accent); display: flex; align-items: center; justify-content: center; }
.stepperButtons button:first-child { border-bottom: 1px solid var(--app-border); }
.stepperButtons button:hover { background: var(--app-accent); color: var(--app-bg); }
.previewFrame { width: 100%; height: calc(100% - 42px); border: 0; background: var(--app-bg); display: block; }
.dragShield { position: absolute; inset: 42px 0 0; cursor: col-resize; background: transparent; }
@media (max-width: 1180px) {
  .splitWorkspace { grid-template-columns: 1fr; }
  .resizeHandle { display: none; }
  .previewPane { position: static; height: 70vh; }
  .editorPane { grid-template-columns: 260px minmax(0, 1fr); }
  .editorTools { position: static; max-height: none; overflow: visible; padding-right: 0; }
}
@media (max-width: 760px) {
  .toolbar { position: static; align-items: flex-start; flex-direction: column; }
  .toolbarActions { justify-content: flex-start; }
  .splitWorkspace { padding: 14px; }
  .editorPane { grid-template-columns: 1fr; }
  .characterGrid { grid-template-columns: 1fr; }
}
`;
