import React, { ChangeEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileJson,
  ImagePlus,
  Italic,
  Languages,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  Upload
} from "lucide-react";
import { toPng } from "html-to-image";
import defaultTemplate from "./defaultTemplate.json";

type ModuleType = "title" | "subtitle" | "narration";
type SceneBlockType = "sceneHeader" | "character" | "narration" | "afterword" | "tikitaka" | "reference";

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
  role?: string;
  dataTag?: string;
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

type ReferenceItem = {
  source: string;
  detail?: string;
};

type ReferenceBlock = {
  id: string;
  type: "reference";
  title?: string;
  text: string;
  items?: ReferenceItem[];
};

type SceneBlock = SceneHeaderBlock | CharacterBlock | NarrationBlock | AfterwordBlock | TikitakaBlock | ReferenceBlock;

type SceneCardData = {
  id: string;
  kind: "scene";
  name: string;
  blocks: SceneBlock[];
};

type PageBlock = ModuleBlock | SceneCardData;

type TheaterData = {
  blocks: PageBlock[];
  labelFontOffset?: number;
};

type ThemeMode = "dark" | "light";

type SavedTemplate = {
  id: string;
  name: string;
  createdAt: string;
  data: TheaterData;
  presets: CharacterPreset[];
};

type TemplatesApiResponse = {
  templates?: SavedTemplate[];
  error?: string;
};

type TheaterSaveFile = {
  schemaVersion?: number;
  data?: TheaterData;
  presets?: CharacterPreset[];
};

const SCHEMA_VERSION = 1;

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
  tikitaka: "티키타카",
  reference: "참고 데이터"
};

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 16,
  bold: false,
  italic: false
};

const MIN_FONT_SIZE = 9;
const MAX_FONT_SIZE = 48;

const MODULE_DEFAULT_FONT_SIZES: Record<ModuleType, number> = {
  title: 23,
  subtitle: DEFAULT_TEXT_STYLE.fontSize ?? 16,
  narration: DEFAULT_TEXT_STYLE.fontSize ?? 16
};

const SCENE_DEFAULT_FONT_SIZES = {
  sceneTitle: 15,
  sceneDesc: 15,
  character: DEFAULT_TEXT_STYLE.fontSize ?? 16,
  narration: DEFAULT_TEXT_STYLE.fontSize ?? 16,
  afterword: 14,
  tikitaka: 15
};

const LABEL_FONT_SIZES = {
  postTag: 13,
  sceneNumber: 13,
  sceneImageLabel: 14,
  avatarFallback: 15,
  characterName: 12,
  blockLabel: 12,
  sideTitle: 12
};

const MIN_LABEL_FONT_OFFSET = MIN_FONT_SIZE - Math.min(...Object.values(LABEL_FONT_SIZES));
const MAX_LABEL_FONT_OFFSET = MAX_FONT_SIZE - Math.max(...Object.values(LABEL_FONT_SIZES));

type FontSizeAction = { mode: "reset" } | { mode: "shift"; delta: number };

function clampFontSize(value: number, fallback = DEFAULT_TEXT_STYLE.fontSize ?? 16) {
  const numeric = Number.isFinite(value) ? value : fallback;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(numeric)));
}

function clampLabelFontOffset(value: number) {
  const numeric = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(MAX_LABEL_FONT_OFFSET, Math.max(MIN_LABEL_FONT_OFFSET, numeric));
}

const CHARACTER_PRESETS: CharacterPreset[] = [
  { id: "emma", name: "에마", imageData: "/characters/emma.png", ring: "#e7a8ba" },
  { id: "hiro", name: "히로", imageData: "/characters/hiro.png", ring: "#b51f47" },
  { id: "anan", name: "안안", imageData: "/characters/anan.png", ring: "#6f81c8" },
  { id: "noa", name: "노아", imageData: "/characters/noa.png", ring: "#9bb7d4" },
  { id: "leia", name: "레이아", imageData: "/characters/leia.png", ring: "#d4b27c" },
  { id: "miria", name: "미리아", imageData: "/characters/miria.png", ring: "#d7bf8b" },
  { id: "mago", name: "마고", imageData: "/characters/mago.png", ring: "#9a63d8" },
  { id: "nanoka", name: "나노카", imageData: "/characters/nanoka.png", ring: "#8f939d" },
  { id: "arisa", name: "아리사", imageData: "/characters/arisa.png", ring: "#b91c1c" },
  { id: "sherry", name: "셰리", imageData: "/characters/sherry.png", ring: "#7c9ef0" },
  { id: "hanna", name: "한나", imageData: "/characters/hanna.png", ring: "#a8c65a" },
  { id: "coco", name: "코코", imageData: "/characters/coco.png", ring: "#ef7d36" },
  { id: "meruru", name: "메루루", imageData: "/characters/meruru.png", ring: "#b6b6be" },
  { id: "warden", name: "교도소장", imageData: "/characters/warden.png", ring: "#666666" },
  { id: "guard", name: "간수", imageData: "/characters/guard.png", ring: "#444444" },
  { id: "yuki", name: "유키", imageData: "", ring: "#6b7280" },
  { id: "etc", name: "기타", imageData: "", ring: "#bbbbbb" }
];

const CHARACTER_ID_ALIASES: Record<string, string> = {
  nero: "hiro",
  dian: "anan",
  miriam: "miria",
  margo: "mago",
  pinocchio: "nanoka",
  aria: "arisa",
  yuri: "sherry",
  sena: "hanna",
  unknown: "warden"
};

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
          characterId: "hiro",
          role: "행동/결정",
          text: '//"나는 너를 용서할 수 없고, 그 사실은 변하지 않아."// 에마가 손을 뻗었지만 뿌리쳤다. 복도를 향해 혼자 걸어나갔다.',
          textStyle: { fontSize: 14, bold: false, italic: false, color: "#e8e0d0" }
        },
        {
          id: makeId(),
          type: "character",
          characterId: "mago",
          role: "질문",
          text: "루프 기억이 있는 상태에서 제일 먼저 한 게 이거야. 모두가 어떻게 죽는지 다 알고 있는데, 첫 번째 생각이 [color=#d08080]에마를 밀어내는 것[/color]이었다고?",
          textStyle: { fontSize: 14, bold: false, italic: false, color: "#e8e0d0" }
        },
        {
          id: makeId(),
          type: "character",
          characterId: "nanoka",
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
  --text: #d8c8aa;
  --text-dim: #b4a891;
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
  --text: #2f2a24;
  --text-dim: #655b4d;
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
  font-size: 17px;
  line-height: 1.8;
  max-width: 780px;
  margin: 0 auto;
  padding: 40px 20px 80px;
}
.post-header { border-bottom: 1px solid var(--border); padding-bottom: 28px; margin-bottom: 40px; }
.post-tag { font-size: var(--font-post-tag); letter-spacing: 2px; color: var(--accent); text-transform: uppercase; margin-bottom: 10px; }
.module-title { margin: 0 0 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.post-title { font-family: 'Noto Serif KR', serif; font-size: 24px; font-weight: 700; line-height: 1.4; margin-bottom: 6px; }
.module-subtitle { margin: 0 0 20px; }
.post-subtitle { font-size: 15px; color: var(--text-dim); }
.narrative { color: var(--text-dim); font-size: 16px; line-height: 1.9; margin: 24px 0; padding-left: 16px; border-left: 2px solid var(--border); white-space: pre-wrap; }
.scene { margin: 40px 0; border: 1px solid var(--border); background: var(--surface); }
.scene-header { background: var(--surface-2); padding: 10px 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); }
.scene-num { font-size: var(--font-scene-number); letter-spacing: 1px; color: var(--accent); text-transform: uppercase; }
.scene-title { font-size: 15px; font-weight: 500; color: var(--text); }
.scene-img-placeholder { width: 100%; min-height: 180px; background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 6px; color: var(--text-faint); font-size: var(--font-scene-image-label); letter-spacing: 1px; padding: 20px; text-align: center; overflow: hidden; }
.scene-img-placeholder img { max-width: 100%; max-height: 280px; object-fit: contain; display: block; }
.scene-desc { padding: 12px 16px; font-size: 15px; color: var(--text-dim); border-bottom: 1px solid var(--border); line-height: 1.7; white-space: pre-wrap; }
.dialogue-block { padding: 8px 16px; display: flex; flex-direction: column; gap: 2px; }
.dialogue-row, .narration-row { display: flex; gap: 15px; align-items: flex-start; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.char-portrait { flex-shrink: 0; width: 86px; display: flex; flex-direction: column; align-items: center; gap: 5px; }
.avatar, .avatar-img { width: 74px; height: 74px; border-radius: 9999px; border: 3px solid var(--ring, var(--border)); background: #26231e; object-fit: cover; display: flex; align-items: center; justify-content: center; font-size: var(--font-avatar-fallback); font-weight: 700; text-align: center; padding: 4px; }
.char-name { font-size: var(--font-character-name); color: var(--text-faint); text-align: center; line-height: 1.3; }
.dialogue-content, .narration-content { flex: 1; padding-top: 4px; }
.dialogue-label, .narration-label { font-size: var(--font-block-label); letter-spacing: 1px; color: var(--text-faint); text-transform: uppercase; margin-bottom: 3px; }
.dialogue-text, .narration-text { font-size: 16px; color: var(--text); line-height: 1.7; white-space: pre-wrap; }
.dialogue-text:empty::before, .narration-text:empty::before { content: "\\00a0"; }
.afterword { margin: 12px 16px; padding: 10px 14px; background: rgba(200,169,110,0.05); border-left: 3px solid var(--accent); font-size: 14px; color: var(--text-dim); line-height: 1.7; white-space: pre-wrap; }
.afterword-title, .tikitaka-title { font-size: var(--font-side-title); color: var(--accent); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
.tikitaka { margin: 16px; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); font-size: 15px; color: var(--text-dim); line-height: 1.8; white-space: pre-wrap; }
em { color: var(--accent2); font-style: italic; }
strong { color: var(--text); font-weight: 700; }
ruby { ruby-align: center; ruby-position: over; }
rt { color: var(--accent); font-size: 0.58em; line-height: 1; font-weight: 600; letter-spacing: 0; }
rp { color: var(--text-faint); font-size: 0.72em; }
`;

function offsetFontSize(baseSize: number, offset: number) {
  return `${clampFontSize(baseSize + clampLabelFontOffset(offset))}px`;
}

function renderLabelFontCss(data: TheaterData) {
  const offset = clampLabelFontOffset(data.labelFontOffset ?? 0);
  return `:root {
  --font-post-tag: ${offsetFontSize(LABEL_FONT_SIZES.postTag, offset)};
  --font-scene-number: ${offsetFontSize(LABEL_FONT_SIZES.sceneNumber, offset)};
  --font-scene-image-label: ${offsetFontSize(LABEL_FONT_SIZES.sceneImageLabel, offset)};
  --font-avatar-fallback: ${offsetFontSize(LABEL_FONT_SIZES.avatarFallback, offset)};
  --font-character-name: ${offsetFontSize(LABEL_FONT_SIZES.characterName, offset)};
  --font-block-label: ${offsetFontSize(LABEL_FONT_SIZES.blockLabel, offset)};
  --font-side-title: ${offsetFontSize(LABEL_FONT_SIZES.sideTitle, offset)};
}`;
}

function renderCss(data: TheaterData) {
  return `${baseCss}\n${renderLabelFontCss(data)}`;
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function isSceneCard(block: PageBlock): block is SceneCardData {
  return block.kind === "scene";
}

function normalizeCharacterId(id: string) {
  return CHARACTER_ID_ALIASES[id] ?? id;
}

function normalizeCharacterPresets(presets: CharacterPreset[]) {
  const seen = new Set<string>();
  return presets
    .map((preset) => ({ ...preset, id: normalizeCharacterId(preset.id) }))
    .filter((preset) => {
      if (seen.has(preset.id)) return false;
      seen.add(preset.id);
      return true;
    });
}

function normalizeTheaterData(data: TheaterData): TheaterData {
  return {
    ...data,
    labelFontOffset: clampLabelFontOffset(data.labelFontOffset ?? 0),
    blocks: data.blocks.map((block) => {
      if (!isSceneCard(block)) return block;
      return {
        ...block,
        blocks: block.blocks.map((sceneBlock) =>
          sceneBlock.type === "character" ? { ...sceneBlock, characterId: normalizeCharacterId(sceneBlock.characterId) } : sceneBlock
        )
      };
    })
  };
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
  if (style.color && !["#e8e0d0", "#d8c8aa"].includes(style.color.toLowerCase())) parts.push(`color:${style.color}`);
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

function renderRichText(str = "") {
  let html = escapeHtml(str);
  html = html.replace(/\[size=([0-9]{1,2})\]([\s\S]*?)\[\/size\]/g, (_match, size, text) => {
    const safeSize = clampFontSize(Number(size));
    return `<span style="font-size:${safeSize}px">${text}</span>`;
  });
  html = html.replace(/\[color=(#[0-9a-fA-F]{3,8})\]([\s\S]*?)\[\/color\]/g, '<span style="color:$1">$2</span>');
  html = html.replace(/\*\*([\s\S]*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\/\/([\s\S]*?)\/\//g, "<em>$1</em>");
  html = html.replace(/\[ruby=([^\]]{1,40})\]([\s\S]*?)\[\/ruby\]/g, "<ruby>$2<rp>(</rp><rt>$1</rt><rp>)</rp></ruby>");
  return html.replace(/\n/g, "<br />");
}

function normalizeStyle(style?: TextStyle): Required<TextStyle> {
  return { ...DEFAULT_TEXT_STYLE, ...style } as Required<TextStyle>;
}

function getNextFontSize(currentSize: number, action: FontSizeAction, defaultSize: number) {
  return action.mode === "reset" ? defaultSize : currentSize + action.delta;
}

function updateTextSizeTags(text: string, action: FontSizeAction, defaultSize: number) {
  return text.replace(/\[size=([0-9]{1,2})\]/g, (_match, size) => {
    const currentSize = clampFontSize(Number(size));
    const nextSize = getNextFontSize(currentSize, action, defaultSize);
    return `[size=${clampFontSize(nextSize)}]`;
  });
}

function updateStyleFontSize(style: TextStyle | undefined, action: FontSizeAction, defaultSize: number): TextStyle {
  const currentSize = style?.fontSize ?? defaultSize;
  const nextSize = getNextFontSize(currentSize, action, defaultSize);
  return { ...style, fontSize: clampFontSize(nextSize) };
}

function updateSceneBlockFontSizes(block: SceneBlock, action: FontSizeAction): SceneBlock {
  if (block.type === "reference") return block;
  if (block.type === "sceneHeader") {
    return {
      ...block,
      title: updateTextSizeTags(block.title, action, SCENE_DEFAULT_FONT_SIZES.sceneTitle),
      desc: updateTextSizeTags(block.desc, action, SCENE_DEFAULT_FONT_SIZES.sceneDesc),
      titleStyle: updateStyleFontSize(block.titleStyle, action, SCENE_DEFAULT_FONT_SIZES.sceneTitle),
      descStyle: updateStyleFontSize(block.descStyle, action, SCENE_DEFAULT_FONT_SIZES.sceneDesc)
    };
  }
  if (block.type === "character") {
    return {
      ...block,
      text: updateTextSizeTags(block.text, action, SCENE_DEFAULT_FONT_SIZES.character),
      textStyle: updateStyleFontSize(block.textStyle, action, SCENE_DEFAULT_FONT_SIZES.character)
    };
  }
  if (block.type === "narration") {
    return {
      ...block,
      text: updateTextSizeTags(block.text, action, SCENE_DEFAULT_FONT_SIZES.narration),
      textStyle: updateStyleFontSize(block.textStyle, action, SCENE_DEFAULT_FONT_SIZES.narration)
    };
  }
  if (block.type === "afterword") {
    return {
      ...block,
      text: updateTextSizeTags(block.text, action, SCENE_DEFAULT_FONT_SIZES.afterword),
      textStyle: updateStyleFontSize(block.textStyle, action, SCENE_DEFAULT_FONT_SIZES.afterword)
    };
  }
  return {
    ...block,
    textStyle: updateStyleFontSize(block.textStyle, action, SCENE_DEFAULT_FONT_SIZES.tikitaka),
    lines: block.lines.map((line) => ({ ...line, text: updateTextSizeTags(line.text, action, SCENE_DEFAULT_FONT_SIZES.tikitaka) }))
  };
}

function updatePageBlockFontSizes(block: PageBlock, action: FontSizeAction): PageBlock {
  if (!isSceneCard(block)) {
    const defaultSize = MODULE_DEFAULT_FONT_SIZES[block.moduleType];
    return {
      ...block,
      content: updateTextSizeTags(block.content, action, defaultSize),
      textStyle: updateStyleFontSize(block.textStyle, action, defaultSize)
    };
  }
  return { ...block, blocks: block.blocks.map((sceneBlock) => updateSceneBlockFontSizes(sceneBlock, action)) };
}

function renderModuleBlock(block: ModuleBlock) {
  const style = styleToCss(block.textStyle);
  if (block.moduleType === "title") return `<div class="module-title"><h1 class="post-title"${style}>${renderRichText(block.content)}</h1></div>`;
  if (block.moduleType === "subtitle") return `<div class="module-subtitle"><p class="post-subtitle"${style}>${renderRichText(block.content)}</p></div>`;
  return `<p class="narrative"${style}>${renderRichText(block.content)}</p>`;
}

function renderSceneBlock(block: SceneBlock, presets: CharacterPreset[]) {
  if (block.type === "reference") return "";
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
    const characterId = normalizeCharacterId(block.characterId);
    const character = presets.find((preset) => preset.id === characterId) ?? presets[0];
    const role = block.role ?? "";
    const avatar = character.imageData
      ? `<img class="avatar-img" style="--ring:${character.ring}" src="${character.imageData}" alt="${escapeHtml(character.name)}" />`
      : `<div class="avatar" style="--ring:${character.ring}">${escapeHtml(character.name.slice(0, 2))}</div>`;
    return `<div class="dialogue-block"><div class="dialogue-row"><div class="char-portrait">${avatar}<div class="char-name">${escapeHtml(
      character.name
    )}</div></div><div class="dialogue-content"><div class="dialogue-label">${escapeHtml(role)}</div><div class="dialogue-text"${styleToCss(
      block.textStyle
    )}>${renderRichText(block.text)}</div></div></div></div>`;
  }
  if (block.type === "narration") {
    const label = block.title.trim() ? `<div class="narration-label">${escapeHtml(block.title)}</div>` : "";
    return `<div class="narration-row"><div class="narration-content">${label}<div class="narration-text"${styleToCss(
      block.textStyle
    )}>${renderRichText(block.text)}</div></div></div>`;
  }
  if (block.type === "afterword") {
    return `<div class="afterword"${styleToCss(block.textStyle)}><div class="afterword-title">${escapeHtml(block.title)}</div>${renderRichText(block.text)}</div>`;
  }
  return `<div class="tikitaka"${styleToCss(block.textStyle)}><div class="tikitaka-title">${escapeHtml(block.title)}</div>${block.lines
    .map((line) => `<strong>${escapeHtml(line.speaker)}</strong>: ${renderRichText(line.text)}`)
    .join("<br />")}</div>`;
}

function renderPreviewBody(data: TheaterData, presets: CharacterPreset[]) {
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
  return `${header}${body}`;
}

function renderPreviewShell(css: string, theme: ThemeMode = "dark") {
  return `<!doctype html><html lang="ko"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Theater Export</title><style id="preview-css">${css}</style></head><body class="theme-${theme}"></body></html>`;
}

function renderHtml(data: TheaterData, presets: CharacterPreset[], theme: ThemeMode = "dark") {
  return `<!doctype html><html lang="ko"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Theater Export</title><style>${renderCss(
    data
  )}</style></head><body class="theme-${theme}">${renderPreviewBody(
    data,
    presets
  )}</body></html>`;
}

function createModuleBlock(moduleType: ModuleType): ModuleBlock {
  return {
    id: makeId(),
    kind: "module",
    moduleType,
    content: moduleType === "title" ? "새 제목" : moduleType === "subtitle" ? "새 부제" : "새 나레이션",
    textStyle: moduleType === "title" ? { ...DEFAULT_TEXT_STYLE, fontSize: 23, bold: true } : { ...DEFAULT_TEXT_STYLE }
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
        titleStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 15, bold: true },
        descStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 15, color: "#9a9080" }
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
      titleStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 15, bold: true },
      descStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 15, color: "#9a9080" }
    };
  }
  if (type === "character") return { id: makeId(), type, characterId: defaultCharacterId, role: "대사", text: "", textStyle: { ...DEFAULT_TEXT_STYLE } };
  if (type === "narration") return { id: makeId(), type, title: "나레이션", text: "", textStyle: { ...DEFAULT_TEXT_STYLE } };
  if (type === "afterword") return { id: makeId(), type, title: "후기", text: "", textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 14, color: "#9a9080" } };
  if (type === "reference") return { id: makeId(), type, title: "참고 데이터", text: "" };
  return { id: makeId(), type, title: "티키타카", textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 15, color: "#9a9080" }, lines: [{ id: makeId(), speaker: "화자", text: "" }] };
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

function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

async function waitForImages(root: ParentNode) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) return;
      if (typeof image.decode === "function") {
        try {
          await image.decode();
          return;
        } catch {
          // Fall back to load/error listeners below.
        }
      }
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    })
  );
}

const CAPTURE_WIDTH = 780;

async function createCaptureFrame(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.position = "fixed";
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.width = `${CAPTURE_WIDTH}px`;
  frame.style.height = "1px";
  frame.style.border = "0";
  frame.style.pointerEvents = "none";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error("캡처용 HTML 문서를 만들 수 없습니다.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const captureStyle = doc.createElement("style");
  captureStyle.textContent = `
    html {
      width: ${CAPTURE_WIDTH}px !important;
      min-width: ${CAPTURE_WIDTH}px !important;
      max-width: ${CAPTURE_WIDTH}px !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    body {
      width: ${CAPTURE_WIDTH}px !important;
      min-width: ${CAPTURE_WIDTH}px !important;
      max-width: ${CAPTURE_WIDTH}px !important;
      margin: 0 !important;
      overflow: visible !important;
      transform: none !important;
    }
  `;
  doc.head.appendChild(captureStyle);

  await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
  if ("fonts" in doc) await doc.fonts.ready;

  const target = doc.body;
  if (!target) {
    frame.remove();
    throw new Error("캡처할 본문을 찾을 수 없습니다.");
  }

  await waitForImages(target);
  const height = Math.ceil(Math.max(target.scrollHeight, target.getBoundingClientRect().height));
  frame.style.height = `${height}px`;
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

  return { frame, doc, target };
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
    ...data,
    labelFontOffset: clampLabelFontOffset(data.labelFontOffset ?? 0),
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

const ROOM_STORAGE_KEY = "theater-tool-room-code";
const TEMPLATES_API_PATH = "/.netlify/functions/templates";

function loadSavedRoomCode() {
  try {
    return window.localStorage.getItem(ROOM_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveRoomCode(roomCode: string) {
  window.localStorage.setItem(ROOM_STORAGE_KEY, roomCode);
}

function normalizeRoomCode(roomCode: string) {
  return roomCode.trim().replace(/\s+/g, " ");
}

function validateRoomCode(roomCode: string) {
  const length = Array.from(roomCode).length;
  if (length < 6) return "접속코드는 6글자 이상이어야 합니다.";
  if (length > 40) return "접속코드는 40글자 이하로 입력해주세요.";
  return "";
}

async function requestTemplates(method: "GET" | "POST" | "DELETE", roomCode: string, payload?: Record<string, unknown>) {
  const url = method === "GET" ? `${TEMPLATES_API_PATH}?roomCode=${encodeURIComponent(roomCode)}` : TEMPLATES_API_PATH;
  const response = await fetch(url, {
    method,
    headers: method === "GET" ? undefined : { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify({ roomCode, ...payload })
  });
  const result = (await response.json()) as TemplatesApiResponse;
  if (!response.ok) throw new Error(result.error || "템플릿 저장소 요청에 실패했습니다.");
  return Array.isArray(result.templates) ? result.templates : [];
}

function getDefaultTemplateName(data: TheaterData) {
  const titleBlock = data.blocks.find((block): block is ModuleBlock => block.kind === "module" && block.moduleType === "title");
  return titleBlock?.content.replace(/\[[^\]]+\]|\[\/[^\]]+\]|\*\*|\/\//g, "").trim() || "새 템플릿";
}

function createSaveFile(data: TheaterData, presets: CharacterPreset[]): Required<TheaterSaveFile> {
  return {
    schemaVersion: SCHEMA_VERSION,
    data: normalizeTheaterData(data),
    presets: normalizeCharacterPresets(presets)
  };
}

function makeCaptureFilename() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `theater-capture-${stamp}.png`;
}

function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (value: string) => void; rows?: number }) {
  return <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />;
}

function RichTextArea({ value, onChange, rows = 3 }: { value: string; onChange: (value: string) => void; rows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [color, setColor] = useState("#c8a96e");
  const [fontSizeInput, setFontSizeInput] = useState(String(DEFAULT_TEXT_STYLE.fontSize ?? 16));
  const getSafeFontSize = () => clampFontSize(fontSizeInput.trim() ? Number(fontSizeInput) : (DEFAULT_TEXT_STYLE.fontSize ?? 16));
  const changeFontSize = (delta: number) => {
    setFontSizeInput((current) => String(clampFontSize((current.trim() ? Number(current) : (DEFAULT_TEXT_STYLE.fontSize ?? 16)) + delta)));
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
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              value={fontSizeInput}
              onChange={(event) => setFontSizeInput(event.target.value)}
              onBlur={() => setFontSizeInput(String(getSafeFontSize()))}
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
        <button type="button" onClick={() => wrapSelection(`[size=${getSafeFontSize()}]`, "[/size]", "크기 텍스트")} title="선택 글자 크기 적용">
          적용
        </button>
        <button type="button" onClick={() => wrapSelection("[ruby=루비]", "[/ruby]", "본문")} title="선택 글자 위에 루비 문자 추가">
          <Languages size={15} />
          루비
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
              {preset.imageData ? <img key={preset.imageData} src={preset.imageData} alt="" /> : preset.name.slice(0, 2)}
            </span>
            <span>{preset.name}</span>
            <input
              type="file"
              accept="image/*"
              onClick={(event) => {
                event.currentTarget.value = "";
              }}
              onChange={(event) => {
                const input = event.currentTarget;
                const file = event.target.files?.[0];
                input.value = "";
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

const SceneBlockEditor = React.memo(function SceneBlockEditor({
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
            onClick={(event) => {
              event.currentTarget.value = "";
            }}
            onChange={(event) => {
              const input = event.currentTarget;
              const file = event.target.files?.[0];
              input.value = "";
              if (!file) return;
              readImageFile(file, (imageData) => onChange({ ...block, imageData }));
            }}
          />
        </label>
        {block.imageData ? (
          <button type="button" className="danger" onClick={() => onChange({ ...block, imageData: undefined })}>
            <Trash2 size={15} />
            이미지 제거
          </button>
        ) : null}
        <RichTextArea value={block.desc} rows={4} onChange={(desc) => onChange({ ...block, desc })} />
      </div>
    );
  }

  if (block.type === "character") {
    return (
      <div className="fieldGrid">
        <select value={normalizeCharacterId(block.characterId)} onChange={(event) => onChange({ ...block, characterId: event.target.value })}>
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

  if (block.type === "reference") {
    return (
      <div className="fieldGrid referenceEditor">
        <input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} placeholder="참고 제목" />
        <TextArea value={block.text} rows={5} onChange={(text) => onChange({ ...block, text })} />
      </div>
    );
  }

  return (
    <div className="fieldGrid">
      <input value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} placeholder="제목" />
      <RichTextArea value={block.text} rows={4} onChange={(text) => onChange({ ...block, text })} />
    </div>
  );
}, (prev, next) => prev.block === next.block && prev.presets === next.presets);

const SceneEditor = React.memo(function SceneEditor({
  scene,
  presets,
  onChange,
  onBlockChange,
  showReferences
}: {
  scene: SceneCardData;
  presets: CharacterPreset[];
  onChange: (scene: SceneCardData) => void;
  onBlockChange: (sceneId: string, blockId: string, block: SceneBlock) => void;
  showReferences: boolean;
}) {
  const defaultCharacterId = presets[0]?.id ?? "etc";

  return (
    <section className="sceneEditor">
      <input className="sceneName" value={scene.name} onChange={(event) => onChange({ ...scene, name: event.target.value })} />
      <div className="addRow">
        {(["sceneHeader", "character", "narration", "afterword", "tikitaka", "reference"] as SceneBlockType[]).map((type) => (
          <button key={type} type="button" onClick={() => onChange({ ...scene, blocks: [...scene.blocks, createSceneBlock(type, defaultCharacterId)] })}>
            <Plus size={14} />
            {SCENE_BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
      {scene.blocks.map((block, index) =>
        block.type === "reference" && !showReferences ? null : (
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
              onChange={(nextBlock) => onBlockChange(scene.id, block.id, nextBlock)}
            />
          </div>
        )
      )}
    </section>
  );
}, (prev, next) => prev.scene === next.scene && prev.presets === next.presets && prev.showReferences === next.showReferences);

export default function TheaterToolBuilder() {
  const [data, setData] = useState<TheaterData>(() => normalizeTheaterData(defaultTemplate as TheaterData));
  const [history, setHistory] = useState<TheaterData[]>([]);
  const [future, setFuture] = useState<TheaterData[]>([]);
  const [presets, setPresets] = useState<CharacterPreset[]>(() => normalizeCharacterPresets(CHARACTER_PRESETS));
  const [roomInput, setRoomInput] = useState(() => loadSavedRoomCode());
  const [activeRoomCode, setActiveRoomCode] = useState(() => loadSavedRoomCode());
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesMessage, setTemplatesMessage] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [editorPercent, setEditorPercent] = useState(52);
  const [isResizing, setIsResizing] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [showReferences, setShowReferences] = useState(true);
  const importRef = useRef<HTMLInputElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const previewScrollRef = useRef({ x: 0, y: 0 });
  const [previewBody, setPreviewBody] = useState(() => renderPreviewBody(data, presets));
  const [previewCss, setPreviewCss] = useState(() => renderCss(data));

  useEffect(() => {
    const roomCode = normalizeRoomCode(activeRoomCode);
    if (!roomCode) {
      setTemplates([]);
      setTemplatesMessage("");
      return;
    }

    let cancelled = false;
    setTemplatesLoading(true);
    setTemplatesMessage("템플릿을 불러오는 중입니다.");
    requestTemplates("GET", roomCode)
      .then((nextTemplates) => {
        if (cancelled) return;
        setTemplates(nextTemplates);
        setTemplatesMessage(nextTemplates.length ? "" : "이 접속코드에는 아직 저장된 템플릿이 없습니다.");
      })
      .catch((error) => {
        if (cancelled) return;
        setTemplates([]);
        setTemplatesMessage(error instanceof Error ? error.message : "템플릿을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoomCode]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPreviewBody(renderPreviewBody(data, presets));
      setPreviewCss(renderCss(data));
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [data, presets]);

  const commitData = (next: TheaterData | ((current: TheaterData) => TheaterData)) => {
    setData((current) => {
      const resolved = typeof next === "function" ? (next as (current: TheaterData) => TheaterData)(current) : next;
      if (resolved === current) return current;
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

  const capturePreview = async () => {
    setIsCapturing(true);
    let captureFrame: HTMLIFrameElement | null = null;
    try {
      const exportHtml = await renderDownloadHtml(data, presets, theme);
      const { frame, doc, target } = await createCaptureFrame(exportHtml);
      captureFrame = frame;

      const rect = target.getBoundingClientRect();
      const width = Math.ceil(rect.width || target.scrollWidth);
      const height = Math.ceil(Math.max(target.scrollHeight, rect.height));
      const backgroundColor = doc.defaultView?.getComputedStyle(target).backgroundColor || "#0f0e0d";
      const pixelRatio = height > 12000 ? 1 : Math.min(2, window.devicePixelRatio || 1);
      const dataUrl = await toPng(target, {
        cacheBust: true,
        pixelRatio,
        width,
        height,
        backgroundColor,
        style: {
          width: `${width}px`,
          minHeight: `${height}px`,
          height: `${height}px`,
          overflow: "visible"
        }
      });

      downloadDataUrl(makeCaptureFilename(), dataUrl);
    } catch (error) {
      window.alert(error instanceof Error ? `캡처에 실패했습니다: ${error.message}` : "캡처에 실패했습니다.");
    } finally {
      captureFrame?.remove();
      setIsCapturing(false);
    }
  };

  useEffect(() => {
    const frame = previewRef.current;
    const win = frame?.contentWindow;
    if (!win) return;

    const rememberScroll = () => {
      previewScrollRef.current = { x: win.scrollX, y: win.scrollY };
    };

    win.addEventListener("scroll", rememberScroll, { passive: true });

    return () => {
      rememberScroll();
      win.removeEventListener("scroll", rememberScroll);
    };
  }, []);

  useLayoutEffect(() => {
    const frame = previewRef.current;
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    if (!doc || !win) return;

    previewScrollRef.current = { x: win.scrollX, y: win.scrollY };

    if (!doc.getElementById("preview-css") || !doc.body) {
      doc.open();
      doc.write(renderPreviewShell(previewCss, theme));
      doc.close();
    }

    const styleElement = doc.getElementById("preview-css");
    if (styleElement) styleElement.textContent = previewCss;

    if (doc.body) {
      doc.body.className = `theme-${theme}`;
      doc.body.innerHTML = previewBody;
    }

    const restoreScroll = () => {
      win.scrollTo(previewScrollRef.current.x, previewScrollRef.current.y);
    };

    window.requestAnimationFrame(restoreScroll);
  }, [previewBody, previewCss, theme]);

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
    commitData((current) => ({ ...current, blocks: current.blocks.map((block) => (block.id === id ? nextBlock : block)) }));
  };

  const updateSceneBlock = (sceneId: string, blockId: string, nextBlock: SceneBlock) => {
    commitData((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== sceneId || !isSceneCard(block)) return block;
        return {
          ...block,
          blocks: block.blocks.map((sceneBlock) => (sceneBlock.id === blockId ? nextBlock : sceneBlock))
        };
      })
    }));
  };

  const resetBodyFontSizes = () => {
    commitData((current) => ({
      ...current,
      blocks: current.blocks.map((block) => updatePageBlockFontSizes(block, { mode: "reset" }))
    }));
  };

  const shiftBodyFontSizes = (delta: -1 | 1) => {
    commitData((current) => ({
      ...current,
      blocks: current.blocks.map((block) => updatePageBlockFontSizes(block, { mode: "shift", delta }))
    }));
  };

  const resetLabelFontSizes = () => {
    commitData((current) => ({
      ...current,
      labelFontOffset: 0
    }));
  };

  const shiftLabelFontSizes = (delta: -1 | 1) => {
    commitData((current) => ({
      ...current,
      labelFontOffset: clampLabelFontOffset((current.labelFontOffset ?? 0) + delta)
    }));
  };

  const enterTemplateRoom = () => {
    const roomCode = normalizeRoomCode(roomInput);
    const error = validateRoomCode(roomCode);
    if (error) {
      setTemplatesMessage(error);
      return;
    }
    saveRoomCode(roomCode);
    setRoomInput(roomCode);
    setActiveRoomCode(roomCode);
  };

  const leaveTemplateRoom = () => {
    saveRoomCode("");
    setRoomInput("");
    setActiveRoomCode("");
    setTemplates([]);
    setTemplatesMessage("");
  };

  const saveCurrentTemplate = async () => {
    const roomCode = normalizeRoomCode(activeRoomCode);
    const error = validateRoomCode(roomCode);
    if (error) {
      setTemplatesMessage(error);
      return;
    }
    const name = window.prompt("저장할 템플릿 이름을 입력하세요.", getDefaultTemplateName(data));
    if (!name?.trim()) return;
    const nextTemplate: SavedTemplate = {
      id: makeId(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      data: normalizeTheaterData(data),
      presets: normalizeCharacterPresets(presets)
    };
    setTemplatesLoading(true);
    setTemplatesMessage("템플릿을 저장하는 중입니다.");
    try {
      const nextTemplates = await requestTemplates("POST", roomCode, { template: nextTemplate });
      setTemplates(nextTemplates);
      setTemplatesMessage("저장했습니다.");
    } catch (saveError) {
      setTemplatesMessage(saveError instanceof Error ? saveError.message : "템플릿 저장에 실패했습니다.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadTemplate = (template: SavedTemplate) => {
    commitData(normalizeTheaterData(template.data));
    setPresets(normalizeCharacterPresets(template.presets));
  };

  const deleteTemplate = async (templateId: string) => {
    if (!window.confirm("이 템플릿을 삭제할까요?")) return;
    const roomCode = normalizeRoomCode(activeRoomCode);
    setTemplatesLoading(true);
    setTemplatesMessage("템플릿을 삭제하는 중입니다.");
    try {
      const nextTemplates = await requestTemplates("DELETE", roomCode, { templateId });
      setTemplates(nextTemplates);
      setTemplatesMessage(nextTemplates.length ? "삭제했습니다." : "이 접속코드에는 아직 저장된 템플릿이 없습니다.");
    } catch (deleteError) {
      setTemplatesMessage(deleteError instanceof Error ? deleteError.message : "템플릿 삭제에 실패했습니다.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = JSON.parse(String(reader.result || "{}")) as TheaterSaveFile;
      if (parsed.data?.blocks) commitData(normalizeTheaterData(parsed.data));
      if (parsed.presets) setPresets(normalizeCharacterPresets(parsed.presets));
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
          <button type="button" onClick={() => setShowReferences((current) => !current)}>
            <Eye size={16} />
            {showReferences ? "참고 데이터 숨기기" : "참고 데이터 보이기"}
          </button>
          <button type="button" onClick={() => importRef.current?.click()}>
            <Upload size={16} />
            JSON 가져오기
          </button>
          <input ref={importRef} className="hiddenInput" type="file" accept="application/json" onChange={importJson} />
          <button type="button" onClick={() => downloadFile("theater-data.json", JSON.stringify(createSaveFile(data, presets), null, 2), "application/json")}>
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
          <button type="button" onClick={capturePreview} disabled={isCapturing}>
            <Camera size={16} />
            {isCapturing ? "캡처 중" : "PNG 캡처"}
          </button>
        </div>
      </header>

      <div ref={splitRef} className={`splitWorkspace${isResizing ? " resizing" : ""}`} style={{ "--editor-percent": `${editorPercent}%` } as React.CSSProperties}>
        <section className="editorPane">
          <div className="editorTools">
            <CharacterImageManager presets={presets} setPresets={setPresets} />
            <section className="panel">
              <div className="panelTitle">
                <Palette size={18} />
                폰트 관리
              </div>
              <div className="fontControlGroup">
                <button type="button" onClick={resetBodyFontSizes} title="본문 폰트 크기를 종류별 기본값으로 되돌림">
                  <RotateCcw size={15} />
                  본문 재설정
                </button>
                <div className="fontBatchButtons">
                  <button type="button" onClick={() => shiftBodyFontSizes(-1)} title="본문 폰트 크기 1단계 감소">
                    본문 -1
                  </button>
                  <button type="button" onClick={() => shiftBodyFontSizes(1)} title="본문 폰트 크기 1단계 증가">
                    본문 +1
                  </button>
                </div>
              </div>
              <div className="fontControlGroup">
                <button type="button" onClick={resetLabelFontSizes} title="라벨 폰트 크기를 기본값으로 되돌림">
                  <RotateCcw size={15} />
                  라벨 재설정
                </button>
                <div className="fontBatchButtons">
                  <button type="button" onClick={() => shiftLabelFontSizes(-1)} title="라벨 폰트 크기 1단계 감소">
                    라벨 -1
                  </button>
                  <button type="button" onClick={() => shiftLabelFontSizes(1)} title="라벨 폰트 크기 1단계 증가">
                    라벨 +1
                  </button>
                </div>
              </div>
            </section>
            <section className="panel">
              <div className="panelTitle">
                <FileJson size={18} />
                템플릿
              </div>
              <div className="roomBox">
                <input
                  value={roomInput}
                  onChange={(event) => setRoomInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") enterTemplateRoom();
                  }}
                  placeholder="접속코드 6글자 이상"
                />
                <button type="button" onClick={enterTemplateRoom} disabled={templatesLoading}>
                  입장
                </button>
              </div>
              {activeRoomCode ? (
                <div className="roomStatus">
                  <span>현재 코드: {activeRoomCode}</span>
                  <button type="button" onClick={leaveTemplateRoom}>
                    나가기
                  </button>
                </div>
              ) : (
                <div className="emptyTemplates">접속코드를 입력하면 공유 템플릿 저장소가 열립니다.</div>
              )}
              <button type="button" onClick={saveCurrentTemplate} disabled={!activeRoomCode || templatesLoading}>
                <Plus size={15} />
                현재 회차 저장
              </button>
              {templatesMessage ? <div className="templateMessage">{templatesMessage}</div> : null}
              {activeRoomCode && templates.length === 0 && !templatesLoading ? (
                <div className="emptyTemplates">저장된 템플릿 없음</div>
              ) : (
                <div className="templateList">
                  {templates.map((template) => (
                    <div className="templateItem" key={template.id}>
                      <button type="button" className="templateLoad" onClick={() => loadTemplate(template)} title="템플릿 불러오기">
                        <span>{template.name}</span>
                        <small>{new Date(template.createdAt).toLocaleString()}</small>
                      </button>
                      <button type="button" className="iconButton danger" onClick={() => deleteTemplate(template.id)} aria-label="템플릿 삭제" disabled={templatesLoading}>
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
              <button type="button" onClick={() => commitData((current) => ({ ...current, blocks: [...current.blocks, createModuleBlock("title")] }))}>
                제목
              </button>
              <button type="button" onClick={() => commitData((current) => ({ ...current, blocks: [...current.blocks, createModuleBlock("subtitle")] }))}>
                부제
              </button>
              <button type="button" onClick={() => commitData((current) => ({ ...current, blocks: [...current.blocks, createModuleBlock("narration")] }))}>
                나레이션
              </button>
              <button type="button" onClick={() => commitData((current) => ({ ...current, blocks: [...current.blocks, createSceneCard()] }))}>
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
                    <button type="button" className="iconButton" onClick={() => commitData((current) => ({ ...current, blocks: moveArrayItem(current.blocks, index, -1) }))}>
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" className="iconButton" onClick={() => commitData((current) => ({ ...current, blocks: moveArrayItem(current.blocks, index, 1) }))}>
                      <ArrowDown size={15} />
                    </button>
                    <button type="button" className="iconButton danger" onClick={() => commitData((current) => ({ ...current, blocks: current.blocks.filter((item) => item.id !== block.id) }))}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {isSceneCard(block) ? (
                  <SceneEditor
                    scene={block}
                    presets={presets}
                    onChange={(scene) => updateBlock(block.id, scene)}
                    onBlockChange={updateSceneBlock}
                    showReferences={showReferences}
                  />
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
          <iframe ref={previewRef} className="previewFrame" title="미리보기" />
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
.appShell, .appShell * { box-sizing: border-box; }
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
input, textarea, select { width: 100%; max-width: 100%; min-width: 0; border: 1px solid var(--app-border-2); background: var(--app-control-2); color: var(--app-text); border-radius: 8px; padding: 9px 10px; }
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
.fontControlGroup { display: grid; gap: 7px; padding: 9px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-2); }
.fontBatchButtons { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.fontBatchButtons button { padding-left: 8px; padding-right: 8px; }
.emptyTemplates { padding: 10px; border: 1px dashed var(--app-border-2); border-radius: 8px; color: var(--app-faint); font-size: 12px; text-align: center; }
.roomBox { display: grid; grid-template-columns: minmax(0, 1fr) 58px; gap: 7px; }
.roomBox button { padding-left: 8px; padding-right: 8px; }
.roomStatus { display: grid; grid-template-columns: minmax(0, 1fr) 58px; gap: 7px; align-items: center; padding: 8px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-2); font-size: 12px; color: var(--app-dim); }
.roomStatus span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.roomStatus button { min-height: 28px; padding: 3px 7px; font-size: 12px; }
.templateMessage { padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--app-accent) 12%, transparent); color: var(--app-accent-soft); font-size: 12px; line-height: 1.5; }
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
.blockEditor:has(.referenceEditor) { border-style: dashed; background: color-mix(in srgb, var(--app-surface-2) 78%, var(--app-accent) 10%); }
.blockHeader > div { display: flex; gap: 6px; }
.iconButton { width: 34px; min-height: 34px; padding: 0; }
.danger:hover { border-color: #e37a7a; color: #ffb4b4; }
.fieldGrid { display: grid; gap: 9px; min-width: 0; }
.referenceEditor textarea { color: var(--app-dim); font-size: 13px; background: var(--app-surface-3); }
.lineEditor { display: grid; grid-template-columns: 110px minmax(0, 1fr) 34px; gap: 7px; }
.lineEditorRich { display: grid; gap: 7px; padding: 8px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-3); }
.lineMeta { display: grid; grid-template-columns: minmax(0, 1fr) 34px; gap: 7px; }
.fileButton { min-height: 36px; border: 1px dashed var(--app-border-2); background: var(--app-surface-2); border-radius: 8px; padding: 8px 10px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; color: var(--app-dim); }
.fileButton input { display: none; }
.richTextBox { display: grid; gap: 6px; min-width: 0; }
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
