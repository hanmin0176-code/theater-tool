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
  GripVertical,
  ImagePlus,
  Italic,
  Keyboard,
  Languages,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  Upload
} from "lucide-react";
import TemplateStoragePanel from "./components/TemplateStoragePanel";
import { SCENE_BACKGROUND_SAMPLES } from "./sceneBackgroundSamples";
import { getCachedRoomUpload } from "./utils/imageUploadCache";

type ModuleType = "title" | "subtitle" | "narration";
type SceneBlockType = "sceneHeader" | "character" | "narration" | "afterword" | "tikitaka" | "reference";

type TextStyle = {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
};

type CharacterImagePreset = {
  id: string;
  name: string;
  imageData?: string;
  imageKey?: string;
  imageMimeType?: string;
};

type CharacterImagePresetGroup = {
  id: string;
  name: string;
  presets: CharacterImagePreset[];
  locked?: boolean;
};

type CharacterPreset = {
  id: string;
  name: string;
  imageData?: string;
  imageKey?: string;
  imageMimeType?: string;
  imagePresetGroups?: CharacterImagePresetGroup[];
  imagePresets?: CharacterImagePreset[];
  selectedImagePresetId?: string;
  hiddenGlobalImagePresetIds?: string[];
  markImageData?: string;
  markImageKey?: string;
  prisonerNumber?: number;
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
  imageKey?: string;
  imageMimeType?: string;
  titleStyle?: TextStyle;
  descStyle?: TextStyle;
};

type CharacterBlock = {
  id: string;
  type: "character";
  characterId: string;
  role?: string;
  dataTag?: string;
  imagePresetId?: string;
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

type LabelFontSizes = {
  postTag: number;
  sceneNumber: number;
  sceneImageLabel: number;
  avatarFallback: number;
  characterName: number;
  blockLabel: number;
  sideTitle: number;
};

type FontPresetId = "pc" | "mobile" | "mixed";

type TheaterData = {
  blocks: PageBlock[];
  fontPreset?: FontPresetId;
  labelFontSizes?: Partial<LabelFontSizes>;
  portraitSize?: number;
  labelFontOffset?: number;
};

type ThemeMode = "blackGold" | "ivoryGold" | "midnightBlue" | "wineRose" | "dcBlueWhite" | "sakuraPlum";

type SavedTemplate = {
  id: string;
  name: string;
  createdAt: string;
  data: TheaterData;
  presets: CharacterPreset[];
};

type SavedTemplateSummary = {
  id: string;
  name: string;
  createdAt: string;
  bytes?: number;
  versionCount?: number;
  deletedAt?: string;
  expiresAt?: string;
};

type CharacterPresetLibrary = {
  updatedAt: string;
  presets: CharacterPreset[];
};

type CharacterPresetLibraryMeta = {
  updatedAt: string;
  bytes: number;
};

type TemplatesApiResponse = {
  templates?: SavedTemplateSummary[];
  trashedTemplates?: SavedTemplateSummary[];
  template?: SavedTemplate;
  versions?: SavedTemplateVersion[];
  characterPresetLibrary?: CharacterPresetLibrary | null;
  characterPresetLibraryMeta?: CharacterPresetLibraryMeta | null;
  activityLog?: ActivityLogEntry[];
  usage?: RoomStorageUsage;
  error?: string;
};

type RoomStorageUsage = {
  characterLibraryBytes: number;
  characterLibraryLimitBytes: number;
  templatesBytes: number;
  templatesCount: number;
  trashedTemplatesCount?: number;
  maxTemplates: number;
  maxTemplateBytes: number;
};

type SavedTemplateVersion = {
  id: string;
  name: string;
  savedAt: string;
  bytes?: number;
};

type ActivityLogEntry = {
  id: string;
  type: string;
  targetName: string;
  at: string;
};

type ImageStorageUsage = {
  imageBytes: number;
  imageCount: number;
  temporaryImageBytes?: number;
  temporaryImageCount?: number;
  referencedImageCount?: number;
  missingImages?: number;
  imageLimitBytes?: number;
};

type ImagesApiResponse = {
  usage?: ImageStorageUsage;
  imageKey?: string;
  imageUrl?: string;
  bytes?: number;
  mimeType?: string;
  error?: string;
};

type TemplatesApiPayload = {
  templates: SavedTemplateSummary[];
  trashedTemplates: SavedTemplateSummary[];
  template: SavedTemplate | null;
  versions: SavedTemplateVersion[];
  characterPresetLibrary: CharacterPresetLibrary | null;
  characterPresetLibraryMeta: CharacterPresetLibraryMeta | null;
  activityLog: ActivityLogEntry[];
  usage: RoomStorageUsage | null;
};

type TheaterSaveFile = {
  schemaVersion?: number;
  data?: TheaterData;
  presets?: CharacterPreset[];
};

const SCHEMA_VERSION = 1;
const PUBLIC_SAMPLE_ROOM_CODE = "000000";
const MAX_IMAGE_PRESET_GROUPS_PER_CHARACTER = 10;
const MAX_IMAGE_PRESETS_PER_GROUP = 20;
const LEGACY_IMAGE_PRESET_GROUP_ID = "legacy";
const IMAGE_UPLOAD_CONCURRENCY = 4;
const CHARACTER_LIBRARY_LIMIT_BYTES = 5_000_000;
const TEMPLATE_LIMIT_BYTES = 1_000_000;
const ROOM_IMAGE_LIMIT_BYTES = 100_000_000;
const PROFILE_IMAGE_OPTIONS = { maxDimension: 512, targetBytes: 150_000 };
const SCENE_IMAGE_OPTIONS = { maxDimension: 1200, targetBytes: 400_000 };
const EXPORT_CONTENT_WIDTH = 900;
const MAX_CAPTURE_CANVAS_HEIGHT = 14_000;
const TARGET_CAPTURE_CHUNK_HEIGHT = 4_200;
const MIN_CAPTURE_CHUNK_HEIGHT = 3_200;
const MAX_CAPTURE_CHUNK_HEIGHT = 5_200;

const THEME_OPTIONS: Array<{ id: ThemeMode; name: string; colors: [string, string] }> = [
  { id: "blackGold", name: "블랙/골드", colors: ["#12110f", "#c8a96e"] },
  { id: "ivoryGold", name: "아이보리/골드", colors: ["#fffaf2", "#8f6f32"] },
  { id: "midnightBlue", name: "미드나이트/실버", colors: ["#0d1320", "#9fb6d8"] },
  { id: "wineRose", name: "와인/로즈", colors: ["#1d0f15", "#d6a0a8"] },
  { id: "dcBlueWhite", name: "디시 블루/화이트", colors: ["#ffffff", "#2f3f8f"] },
  { id: "sakuraPlum", name: "사쿠라 핑크/플럼", colors: ["#fff7fb", "#8f4f73"] }
];

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

const DEFAULT_FONT_PRESET_ID: FontPresetId = "mixed";

const FONT_PRESET_OPTIONS: Array<{ id: FontPresetId; label: string }> = [
  { id: "pc", label: "PC" },
  { id: "mobile", label: "모바일" },
  { id: "mixed", label: "혼합" }
];

const BASE_BODY_FONT_SIZE = 16;
const BASE_TITLE_FONT_SIZE = 23;
const BASE_SCENE_TITLE_FONT_SIZE = 15;
const BASE_SCENE_DESC_FONT_SIZE = 15;
const BASE_AFTERWORD_FONT_SIZE = 14;
const BASE_TIKITAKA_FONT_SIZE = 15;
const DEFAULT_PORTRAIT_SIZE = 74;
const MIN_PORTRAIT_SIZE = 56;
const MAX_PORTRAIT_SIZE = 120;

const BASE_LABEL_FONT_SIZES: LabelFontSizes = {
  postTag: 13,
  sceneNumber: 13,
  sceneImageLabel: 14,
  avatarFallback: 15,
  characterName: 12,
  blockLabel: 12,
  sideTitle: 12
};

const FONT_PRESETS: Record<FontPresetId, { bodyBonus: number; labelSizes: LabelFontSizes }> = {
  pc: {
    bodyBonus: 8,
    labelSizes: {
      postTag: 15,
      sceneNumber: 15,
      sceneImageLabel: 16,
      avatarFallback: 17,
      characterName: 14,
      blockLabel: 14,
      sideTitle: 14
    }
  },
  mobile: {
    bodyBonus: 11,
    labelSizes: {
      postTag: 17,
      sceneNumber: 17,
      sceneImageLabel: 18,
      avatarFallback: 19,
      characterName: 16,
      blockLabel: 16,
      sideTitle: 16
    }
  },
  mixed: {
    bodyBonus: 10,
    labelSizes: {
      postTag: 16,
      sceneNumber: 16,
      sceneImageLabel: 17,
      avatarFallback: 18,
      characterName: 15,
      blockLabel: 15,
      sideTitle: 15
    }
  }
};

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: BASE_BODY_FONT_SIZE + FONT_PRESETS[DEFAULT_FONT_PRESET_ID].bodyBonus,
  bold: false,
  italic: false
};

const MIN_FONT_SIZE = 9;
const MAX_FONT_SIZE = 48;

const MODULE_DEFAULT_FONT_SIZES: Record<ModuleType, number> = {
  title: BASE_TITLE_FONT_SIZE + FONT_PRESETS[DEFAULT_FONT_PRESET_ID].bodyBonus,
  subtitle: DEFAULT_TEXT_STYLE.fontSize ?? BASE_BODY_FONT_SIZE,
  narration: DEFAULT_TEXT_STYLE.fontSize ?? BASE_BODY_FONT_SIZE
};

const SCENE_DEFAULT_FONT_SIZES = {
  sceneTitle: BASE_SCENE_TITLE_FONT_SIZE + FONT_PRESETS[DEFAULT_FONT_PRESET_ID].bodyBonus,
  sceneDesc: BASE_SCENE_DESC_FONT_SIZE + FONT_PRESETS[DEFAULT_FONT_PRESET_ID].bodyBonus,
  character: DEFAULT_TEXT_STYLE.fontSize ?? BASE_BODY_FONT_SIZE,
  narration: DEFAULT_TEXT_STYLE.fontSize ?? BASE_BODY_FONT_SIZE,
  afterword: BASE_AFTERWORD_FONT_SIZE + FONT_PRESETS[DEFAULT_FONT_PRESET_ID].bodyBonus,
  tikitaka: BASE_TIKITAKA_FONT_SIZE + FONT_PRESETS[DEFAULT_FONT_PRESET_ID].bodyBonus
};

const CHARACTER_DIALOGUE_COLORS: Record<string, string> = {
  emma: "#B93D6E",
  hiro: "#9A1E45",
  anan: "#4E5F9D",
  noa: "#1D7894",
  leia: "#9A6B48",
  miria: "#8F5D33",
  mago: "#6E3EC5",
  nanoka: "#596273",
  arisa: "#B72035",
  sherry: "#3F6DB7",
  hanna: "#5F7A1E",
  coco: "#C04E1D",
  meruru: "#5F697D",
  warden: "#4C475B",
  yuki: "#6978B8",
  guard: "#3C2835"
};

const LABEL_FONT_SIZES: LabelFontSizes = {
  ...FONT_PRESETS[DEFAULT_FONT_PRESET_ID].labelSizes
};

const LEGACY_LABEL_FONT_SIZES: LabelFontSizes = {
  ...BASE_LABEL_FONT_SIZES
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

function clampPortraitSize(value: number, fallback = DEFAULT_PORTRAIT_SIZE) {
  const numeric = Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(MAX_PORTRAIT_SIZE, Math.max(MIN_PORTRAIT_SIZE, numeric));
}

function normalizeFontPresetId(value?: string): FontPresetId {
  return value === "pc" || value === "mobile" || value === "mixed" ? value : DEFAULT_FONT_PRESET_ID;
}

function getBodyFontBonus(presetId: FontPresetId) {
  return FONT_PRESETS[presetId].bodyBonus;
}

function getDefaultTextStyle(presetId: FontPresetId): TextStyle {
  return {
    fontSize: BASE_BODY_FONT_SIZE + getBodyFontBonus(presetId),
    bold: false,
    italic: false
  };
}

function getModuleDefaultFontSizes(presetId: FontPresetId): Record<ModuleType, number> {
  const bodySize = getDefaultTextStyle(presetId).fontSize ?? BASE_BODY_FONT_SIZE;
  return {
    title: BASE_TITLE_FONT_SIZE + getBodyFontBonus(presetId),
    subtitle: bodySize,
    narration: bodySize
  };
}

function getSceneDefaultFontSizes(presetId: FontPresetId) {
  const bodySize = getDefaultTextStyle(presetId).fontSize ?? BASE_BODY_FONT_SIZE;
  return {
    sceneTitle: BASE_SCENE_TITLE_FONT_SIZE + getBodyFontBonus(presetId),
    sceneDesc: BASE_SCENE_DESC_FONT_SIZE + getBodyFontBonus(presetId),
    character: bodySize,
    narration: bodySize,
    afterword: BASE_AFTERWORD_FONT_SIZE + getBodyFontBonus(presetId),
    tikitaka: BASE_TIKITAKA_FONT_SIZE + getBodyFontBonus(presetId)
  };
}

function cloneLabelFontSizes(source: LabelFontSizes): LabelFontSizes {
  return {
    postTag: source.postTag,
    sceneNumber: source.sceneNumber,
    sceneImageLabel: source.sceneImageLabel,
    avatarFallback: source.avatarFallback,
    characterName: source.characterName,
    blockLabel: source.blockLabel,
    sideTitle: source.sideTitle
  };
}

function getDefaultLabelFontSizes(presetId: FontPresetId = DEFAULT_FONT_PRESET_ID): LabelFontSizes {
  return cloneLabelFontSizes(FONT_PRESETS[presetId].labelSizes);
}

function shiftLabelFontSizesByDelta(sizes: LabelFontSizes, delta: number): LabelFontSizes {
  return {
    postTag: clampFontSize(sizes.postTag + delta, LABEL_FONT_SIZES.postTag),
    sceneNumber: clampFontSize(sizes.sceneNumber + delta, LABEL_FONT_SIZES.sceneNumber),
    sceneImageLabel: clampFontSize(sizes.sceneImageLabel + delta, LABEL_FONT_SIZES.sceneImageLabel),
    avatarFallback: clampFontSize(sizes.avatarFallback + delta, LABEL_FONT_SIZES.avatarFallback),
    characterName: clampFontSize(sizes.characterName + delta, LABEL_FONT_SIZES.characterName),
    blockLabel: clampFontSize(sizes.blockLabel + delta, LABEL_FONT_SIZES.blockLabel),
    sideTitle: clampFontSize(sizes.sideTitle + delta, LABEL_FONT_SIZES.sideTitle)
  };
}

function getLegacyLabelFontSizes(offset: number): LabelFontSizes {
  const safeOffset = clampLabelFontOffset(offset);
  return {
    postTag: clampFontSize(LEGACY_LABEL_FONT_SIZES.postTag + safeOffset, LEGACY_LABEL_FONT_SIZES.postTag),
    sceneNumber: clampFontSize(LEGACY_LABEL_FONT_SIZES.sceneNumber + safeOffset, LEGACY_LABEL_FONT_SIZES.sceneNumber),
    sceneImageLabel: clampFontSize(LEGACY_LABEL_FONT_SIZES.sceneImageLabel + safeOffset, LEGACY_LABEL_FONT_SIZES.sceneImageLabel),
    avatarFallback: clampFontSize(LEGACY_LABEL_FONT_SIZES.avatarFallback + safeOffset, LEGACY_LABEL_FONT_SIZES.avatarFallback),
    characterName: clampFontSize(LEGACY_LABEL_FONT_SIZES.characterName + safeOffset, LEGACY_LABEL_FONT_SIZES.characterName),
    blockLabel: clampFontSize(LEGACY_LABEL_FONT_SIZES.blockLabel + safeOffset, LEGACY_LABEL_FONT_SIZES.blockLabel),
    sideTitle: clampFontSize(LEGACY_LABEL_FONT_SIZES.sideTitle + safeOffset, LEGACY_LABEL_FONT_SIZES.sideTitle)
  };
}

function normalizeLabelFontSizes(input?: Partial<LabelFontSizes>, legacyOffset?: number, presetId: FontPresetId = DEFAULT_FONT_PRESET_ID): LabelFontSizes {
  const fallback = input ? getDefaultLabelFontSizes(presetId) : getLegacyLabelFontSizes(legacyOffset ?? 0);
  return {
    postTag: clampFontSize(input?.postTag ?? fallback.postTag, getDefaultLabelFontSizes(presetId).postTag),
    sceneNumber: clampFontSize(input?.sceneNumber ?? fallback.sceneNumber, getDefaultLabelFontSizes(presetId).sceneNumber),
    sceneImageLabel: clampFontSize(input?.sceneImageLabel ?? fallback.sceneImageLabel, getDefaultLabelFontSizes(presetId).sceneImageLabel),
    avatarFallback: clampFontSize(input?.avatarFallback ?? fallback.avatarFallback, getDefaultLabelFontSizes(presetId).avatarFallback),
    characterName: clampFontSize(input?.characterName ?? fallback.characterName, getDefaultLabelFontSizes(presetId).characterName),
    blockLabel: clampFontSize(input?.blockLabel ?? fallback.blockLabel, getDefaultLabelFontSizes(presetId).blockLabel),
    sideTitle: clampFontSize(input?.sideTitle ?? fallback.sideTitle, getDefaultLabelFontSizes(presetId).sideTitle)
  };
}

const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: "emma",
    name: "에마",
    imageData: "/characters/profiles/emma/default.png",
    imagePresetGroups: [
      {
        id: "emma-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "emma-joy", name: "희", imageData: "/characters/profiles/emma/joy.png" },
          { id: "emma-anger", name: "로", imageData: "/characters/profiles/emma/anger.png" },
          { id: "emma-sad", name: "애", imageData: "/characters/profiles/emma/sad.png" },
          { id: "emma-fun", name: "락", imageData: "/characters/profiles/emma/fun.png" }
        ]
      },
      {
        id: "emma-rooftop",
        name: "옥상조",
        locked: true,
        presets: [
          { id: "emma-rooftop-01", name: "옥상조 1", imageData: "/characters/profiles/emma/rooftop/rooftop-01.png" },
          { id: "emma-rooftop-02", name: "옥상조 2", imageData: "/characters/profiles/emma/rooftop/rooftop-02.png" },
          { id: "emma-rooftop-03", name: "옥상조 3", imageData: "/characters/profiles/emma/rooftop/rooftop-03.png" },
          { id: "emma-rooftop-04", name: "옥상조 4", imageData: "/characters/profiles/emma/rooftop/rooftop-04.png" },
          { id: "emma-rooftop-05", name: "옥상조 5", imageData: "/characters/profiles/emma/rooftop/rooftop-05.png" },
          { id: "emma-rooftop-06", name: "옥상조 6", imageData: "/characters/profiles/emma/rooftop/rooftop-06.png" },
          { id: "emma-rooftop-trio-01", name: "3인 1", imageData: "/characters/profiles/common/rooftop/trio-01.png" },
          { id: "emma-rooftop-emma-01", name: "에마 1", imageData: "/characters/profiles/emma/rooftop/emma-01.png" },
          { id: "emma-rooftop-emma-02", name: "에마 2", imageData: "/characters/profiles/emma/rooftop/emma-02.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/658-emma.webp",
    prisonerNumber: 658,
    ring: "#e7a8ba"
  },
  {
    id: "hiro",
    name: "히로",
    imageData: "/characters/hiro.png",
    imagePresetGroups: [
      {
        id: "hiro-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "hiro-joy", name: "희", imageData: "/characters/profiles/hiro/joy.png" },
          { id: "hiro-anger", name: "로", imageData: "/characters/profiles/hiro/anger.png" },
          { id: "hiro-sad", name: "애", imageData: "/characters/profiles/hiro/sad.png" },
          { id: "hiro-fun", name: "락", imageData: "/characters/profiles/hiro/fun.png" }
        ]
      },
      {
        id: "hiro-rooftop",
        name: "옥상조",
        locked: true,
        presets: [
          { id: "hiro-rooftop-01", name: "옥상조 1", imageData: "/characters/profiles/hiro/rooftop/rooftop-01.png" },
          { id: "hiro-rooftop-02", name: "옥상조 2", imageData: "/characters/profiles/hiro/rooftop/rooftop-02.png" },
          { id: "hiro-rooftop-03", name: "옥상조 3", imageData: "/characters/profiles/hiro/rooftop/rooftop-03.png" },
          { id: "hiro-rooftop-04", name: "옥상조 4", imageData: "/characters/profiles/hiro/rooftop/rooftop-04.png" },
          { id: "hiro-rooftop-05", name: "옥상조 5", imageData: "/characters/profiles/hiro/rooftop/rooftop-05.png" },
          { id: "hiro-rooftop-06", name: "옥상조 6", imageData: "/characters/profiles/hiro/rooftop/rooftop-06.png" },
          { id: "hiro-rooftop-07", name: "옥상조 7", imageData: "/characters/profiles/hiro/rooftop/rooftop-07.png" },
          { id: "hiro-rooftop-08", name: "옥상조 8", imageData: "/characters/profiles/hiro/rooftop/rooftop-08.png" },
          { id: "hiro-rooftop-trio-01", name: "3인 1", imageData: "/characters/profiles/common/rooftop/trio-01.png" },
          { id: "hiro-rooftop-hiro-01", name: "히로 1", imageData: "/characters/profiles/hiro/rooftop/hiro-01.png" },
          { id: "hiro-rooftop-hiro-02", name: "히로 2", imageData: "/characters/profiles/hiro/rooftop/hiro-02.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/659-hiro.webp",
    prisonerNumber: 659,
    ring: "#b51f47"
  },
  {
    id: "anan",
    name: "안안",
    imageData: "/characters/anan.png",
    imagePresetGroups: [
      {
        id: "anan-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "anan-joy", name: "희", imageData: "/characters/profiles/anan/joy.png" },
          { id: "anan-anger", name: "로", imageData: "/characters/profiles/anan/anger.png" },
          { id: "anan-sad", name: "애", imageData: "/characters/profiles/anan/sad.png" },
          { id: "anan-fun", name: "락", imageData: "/characters/profiles/anan/fun.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/660-anan.webp",
    prisonerNumber: 660,
    ring: "#6f81c8"
  },
  {
    id: "noa",
    name: "노아",
    imageData: "/characters/noa.png",
    imagePresetGroups: [
      {
        id: "noa-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "noa-joy", name: "희", imageData: "/characters/profiles/noa/joy.png" },
          { id: "noa-anger", name: "로", imageData: "/characters/profiles/noa/anger.png" },
          { id: "noa-sad", name: "애", imageData: "/characters/profiles/noa/sad.png" },
          { id: "noa-fun", name: "락", imageData: "/characters/profiles/noa/fun.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/661-noa.webp",
    prisonerNumber: 661,
    ring: "#9bb7d4"
  },
  {
    id: "leia",
    name: "레이아",
    imageData: "/characters/leia.png",
    imagePresetGroups: [
      {
        id: "leia-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "leia-joy", name: "희", imageData: "/characters/profiles/leia/joy.png" },
          { id: "leia-anger", name: "로", imageData: "/characters/profiles/leia/anger.png" },
          { id: "leia-sad", name: "애", imageData: "/characters/profiles/leia/sad.png" },
          { id: "leia-fun", name: "락", imageData: "/characters/profiles/leia/fun.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/662-leia.webp",
    prisonerNumber: 662,
    ring: "#d4b27c"
  },
  {
    id: "miria",
    name: "미리아",
    imageData: "/characters/miria.png",
    imagePresetGroups: [
      {
        id: "miria-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "miria-joy", name: "희", imageData: "/characters/profiles/miria/joy.png" },
          { id: "miria-anger", name: "로", imageData: "/characters/profiles/miria/anger.png" },
          { id: "miria-sad", name: "애", imageData: "/characters/profiles/miria/sad.png" },
          { id: "miria-fun", name: "락", imageData: "/characters/profiles/miria/fun.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/663-miria.webp",
    prisonerNumber: 663,
    ring: "#d7bf8b"
  },
  {
    id: "mago",
    name: "마고",
    imageData: "/characters/mago.png",
    imagePresetGroups: [
      {
        id: "mago-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "mago-joy", name: "희", imageData: "/characters/profiles/mago/joy.png" },
          { id: "mago-anger", name: "로", imageData: "/characters/profiles/mago/anger.png" },
          { id: "mago-sad", name: "애", imageData: "/characters/profiles/mago/sad.png" },
          { id: "mago-fun", name: "락", imageData: "/characters/profiles/mago/fun.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/664-mago.webp",
    prisonerNumber: 664,
    ring: "#9a63d8"
  },
  {
    id: "nanoka",
    name: "나노카",
    imageData: "/characters/nanoka.png",
    imagePresetGroups: [
      {
        id: "nanoka-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "nanoka-joy", name: "희", imageData: "/characters/profiles/nanoka/joy.png" },
          { id: "nanoka-anger", name: "로", imageData: "/characters/profiles/nanoka/anger.png" },
          { id: "nanoka-sad", name: "애", imageData: "/characters/profiles/nanoka/sad.png" },
          { id: "nanoka-fun", name: "락", imageData: "/characters/profiles/nanoka/fun.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/665-nanoka.webp",
    prisonerNumber: 665,
    ring: "#8f939d"
  },
  {
    id: "arisa",
    name: "아리사",
    imageData: "/characters/arisa.png",
    imagePresetGroups: [
      {
        id: "arisa-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "arisa-joy", name: "희", imageData: "/characters/profiles/arisa/joy.png" },
          { id: "arisa-anger", name: "로", imageData: "/characters/profiles/arisa/anger.png" },
          { id: "arisa-sad", name: "애", imageData: "/characters/profiles/arisa/sad.png" },
          { id: "arisa-fun", name: "락", imageData: "/characters/profiles/arisa/fun.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/666-arisa.webp",
    prisonerNumber: 666,
    ring: "#b91c1c"
  },
  {
    id: "sherry",
    name: "셰리",
    imageData: "/characters/sherry.png",
    imagePresetGroups: [
      {
        id: "sherry-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "sherry-joy", name: "희", imageData: "/characters/profiles/sherry/joy.png" },
          { id: "sherry-anger", name: "로", imageData: "/characters/profiles/sherry/anger.png" },
          { id: "sherry-sad", name: "애", imageData: "/characters/profiles/sherry/sad.png" },
          { id: "sherry-fun", name: "락", imageData: "/characters/profiles/sherry/fun.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/667-sherry.webp",
    prisonerNumber: 667,
    ring: "#7c9ef0"
  },
  {
    id: "hanna",
    name: "한나",
    imageData: "/characters/hanna.png",
    imagePresetGroups: [
      {
        id: "hanna-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "hanna-joy", name: "희", imageData: "/characters/profiles/hanna/joy.png" },
          { id: "hanna-anger", name: "로", imageData: "/characters/profiles/hanna/anger.png" },
          { id: "hanna-sad", name: "애", imageData: "/characters/profiles/hanna/sad.png" },
          { id: "hanna-fun", name: "락", imageData: "/characters/profiles/hanna/fun.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/668-hanna.webp",
    prisonerNumber: 668,
    ring: "#a8c65a"
  },
  {
    id: "coco",
    name: "코코",
    imageData: "/characters/coco.png",
    imagePresetGroups: [
      {
        id: "coco-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "coco-joy", name: "희", imageData: "/characters/profiles/coco/joy.png" },
          { id: "coco-anger", name: "로", imageData: "/characters/profiles/coco/anger.png" },
          { id: "coco-sad", name: "애", imageData: "/characters/profiles/coco/sad.png" },
          { id: "coco-fun", name: "락", imageData: "/characters/profiles/coco/fun.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/669-coco.webp",
    prisonerNumber: 669,
    ring: "#ef7d36"
  },
  {
    id: "meruru",
    name: "메루루",
    imageData: "/characters/meruru.png",
    imagePresetGroups: [
      {
        id: "meruru-emotions",
        name: "희로애락",
        locked: true,
        presets: [
          { id: "meruru-joy", name: "희", imageData: "/characters/profiles/meruru/joy.png" },
          { id: "meruru-anger", name: "로", imageData: "/characters/profiles/meruru/anger.png" },
          { id: "meruru-sad", name: "애", imageData: "/characters/profiles/meruru/sad.png" },
          { id: "meruru-fun", name: "락", imageData: "/characters/profiles/meruru/fun.png" }
        ]
      }
    ],
    markImageData: "/characters/marks/670-meruru.webp",
    prisonerNumber: 670,
    ring: "#b6b6be"
  },
  { id: "warden", name: "교도소장", imageData: "/characters/warden.png", ring: "#666666" },
  { id: "guard", name: "간수", imageData: "/characters/guard.png", ring: "#444444" },
  {
    id: "yuki",
    name: "유키",
    imageData: "/characters/profiles/yuki/default.png",
    imagePresetGroups: [
      {
        id: "yuki-rooftop",
        name: "옥상조",
        locked: true,
        presets: [
          { id: "yuki-rooftop-01", name: "옥상조 1", imageData: "/characters/profiles/yuki/rooftop/rooftop-01.png" },
          { id: "yuki-rooftop-02", name: "옥상조 2", imageData: "/characters/profiles/yuki/rooftop/rooftop-02.png" },
          { id: "yuki-rooftop-03", name: "옥상조 3", imageData: "/characters/profiles/yuki/rooftop/rooftop-03.png" },
          { id: "yuki-rooftop-04", name: "옥상조 4", imageData: "/characters/profiles/yuki/rooftop/rooftop-04.png" },
          { id: "yuki-rooftop-05", name: "옥상조 5", imageData: "/characters/profiles/yuki/rooftop/rooftop-05.png" },
          { id: "yuki-rooftop-trio-01", name: "3인 1", imageData: "/characters/profiles/common/rooftop/trio-01.png" },
          { id: "yuki-rooftop-yuki-01", name: "유키 1", imageData: "/characters/profiles/yuki/rooftop/yuki-01.png" },
          { id: "yuki-rooftop-yuki-02", name: "유키 2", imageData: "/characters/profiles/yuki/rooftop/yuki-02.png" }
        ]
      }
    ],
    ring: "#6b7280"
  },
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

const CHARACTER_PRESET_ORDER = CHARACTER_PRESETS.map((preset) => preset.id);

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

const PUBLIC_SAMPLE_TEMPLATE_SUMMARIES: SavedTemplateSummary[] = [
  { id: "sample-default-template", name: "제작 참고 템플릿 1", createdAt: "2026-04-23T00:00:00.000Z" },
  { id: "sample-scene-template", name: "제작 참고 템플릿 2", createdAt: "2026-04-23T00:00:00.000Z" },
  { id: "sample-image-guide-template", name: "이미지 설명서 3인방", createdAt: "2026-04-24T00:00:00.000Z" }
];

const publicSampleTemplateCache = new Map<string, Promise<SavedTemplate | null>>();

async function importPublicSampleTemplate(templateId: string): Promise<TheaterSaveFile & TheaterData> {
  if (templateId === "sample-default-template") {
    const { default: template } = await import("./publicSampleTemplate1.json");
    return template as TheaterSaveFile & TheaterData;
  }
  if (templateId === "sample-scene-template") {
    const { default: template } = await import("./publicSampleTemplate2.json");
    return template as TheaterSaveFile & TheaterData;
  }
  if (templateId === "sample-image-guide-template") {
    const { default: template } = await import("./publicSampleTemplate3.json");
    return template as TheaterSaveFile & TheaterData;
  }
  throw new Error("샘플 템플릿을 찾을 수 없습니다.");
}

async function loadPublicSampleTemplate(templateId: string): Promise<SavedTemplate | null> {
  const summary = PUBLIC_SAMPLE_TEMPLATE_SUMMARIES.find((item) => item.id === templateId);
  if (!summary) return null;
  if (!publicSampleTemplateCache.has(templateId)) {
    publicSampleTemplateCache.set(
      templateId,
      importPublicSampleTemplate(templateId).then((importedTemplate) => ({
        id: summary.id,
        name: summary.name,
        createdAt: summary.createdAt,
        data: normalizeTheaterData((importedTemplate.data ?? importedTemplate) as TheaterData),
        presets: normalizeCharacterPresets(Array.isArray(importedTemplate.presets) ? importedTemplate.presets : CHARACTER_PRESETS)
      }))
    );
  }
  return publicSampleTemplateCache.get(templateId)!;
}

function summarizeTemplate(template: SavedTemplate): SavedTemplateSummary {
  return {
    id: template.id,
    name: template.name,
    createdAt: template.createdAt,
    bytes: getJsonByteLength(template)
  };
}

function isPublicSampleRoom(roomCode: string) {
  return normalizeRoomCode(roomCode) === PUBLIC_SAMPLE_ROOM_CODE;
}

function getJsonByteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).length;
}

function createCharacterPresetLibrary(presets: CharacterPreset[]): CharacterPresetLibrary {
  return {
    updatedAt: new Date().toISOString(),
    presets: normalizeCharacterPresets(presets)
  };
}

function getCharacterLibraryBytes(presets: CharacterPreset[]) {
  return getJsonByteLength(createCharacterPresetLibrary(estimateRemotePresets(presets)));
}

function getTemplateBytes(data: TheaterData, presets: CharacterPreset[], name = getDefaultTemplateName(data)) {
  return getJsonByteLength({
    id: "size-check",
    name,
    createdAt: "2000-01-01T00:00:00.000Z",
    data: normalizeTheaterData(estimateRemoteData(data)),
    presets: normalizeCharacterPresets(estimateRemotePresets(presets))
  });
}

function isDataUrl(src?: string) {
  return Boolean(src?.startsWith("data:"));
}

function imageUrlFromKey(imageKey: string) {
  return `${IMAGES_API_PATH}?key=${encodeURIComponent(imageKey)}`;
}

function imageKeyFromUrl(src?: string) {
  if (!src || !src.includes(IMAGES_API_PATH)) return "";
  try {
    return new URL(src, window.location.origin).searchParams.get("key") || "";
  } catch {
    return "";
  }
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function withHydratedImage<T extends { imageData?: string; imageKey?: string }>(value: T): T {
  if (!value.imageKey) return value;
  return { ...value, imageData: imageUrlFromKey(value.imageKey) };
}

function hydrateDataImages(data: TheaterData): TheaterData {
  return {
    ...data,
    blocks: data.blocks.map((block) => {
      if (!isSceneCard(block)) return block;
      return {
        ...block,
        blocks: block.blocks.map((sceneBlock) => (sceneBlock.type === "sceneHeader" ? withHydratedImage(sceneBlock) : sceneBlock))
      };
    })
  };
}

function hydratePresetImages(presets: CharacterPreset[]) {
  return presets.map((preset) => ({
    ...withHydratedImage(preset),
    imagePresetGroups: preset.imagePresetGroups?.map((group) => ({
      ...group,
      presets: group.presets.map(withHydratedImage)
    })),
    imagePresets: preset.imagePresets?.map(withHydratedImage)
  }));
}

function stripDataImagesForEstimate<T extends { imageData?: string; imageKey?: string; imageMimeType?: string }>(value: T): T {
  const existingKey = value.imageKey || imageKeyFromUrl(value.imageData);
  if (existingKey || isDataUrl(value.imageData)) {
    return withoutUndefined({ ...value, imageData: undefined, imageKey: existingKey || "pending-image-key", imageMimeType: value.imageMimeType });
  }
  return value;
}

function estimateRemoteData(data: TheaterData): TheaterData {
  return {
    ...data,
    blocks: data.blocks.map((block) => {
      if (!isSceneCard(block)) return block;
      return {
        ...block,
        blocks: block.blocks.map((sceneBlock) => (sceneBlock.type === "sceneHeader" ? stripDataImagesForEstimate(sceneBlock) : sceneBlock))
      };
    })
  };
}

function estimateRemotePresets(presets: CharacterPreset[]) {
  return presets.map((preset) => ({
    ...stripDataImagesForEstimate(preset),
    imagePresetGroups: preset.imagePresetGroups?.map((group) => ({
      ...group,
      presets: group.presets.map(stripDataImagesForEstimate)
    })),
    imagePresets: preset.imagePresets?.map(stripDataImagesForEstimate)
  }));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatActivityType(type: string) {
  if (type === "create") return "저장";
  if (type === "update") return "수정";
  if (type === "trash") return "삭제";
  if (type === "restore") return "복구";
  if (type === "revert") return "되돌림";
  if (type === "saveLibrary") return "프리셋";
  return "기록";
}

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
html.theme-ivoryGold,
body.theme-ivoryGold {
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
html.theme-midnightBlue,
body.theme-midnightBlue {
  --bg: #0d1320;
  --surface: #151d2b;
  --surface-2: #111827;
  --border: #2c3a52;
  --accent: #9fb6d8;
  --text: #d9e4f2;
  --text-dim: #aebbd0;
  --text-faint: #6f7f98;
  --scroll-track: #101828;
  --scroll-thumb: #8ea9cf;
}
html.theme-wineRose,
body.theme-wineRose {
  --bg: #1d0f15;
  --surface: #27151d;
  --surface-2: #211219;
  --border: #49303a;
  --accent: #d6a0a8;
  --text: #f0dbe0;
  --text-dim: #c8adb4;
  --text-faint: #866b73;
  --scroll-track: #24131a;
  --scroll-thumb: #c88d98;
}
html.theme-dcBlueWhite,
body.theme-dcBlueWhite {
  --bg: #ffffff;
  --surface: #ffffff;
  --surface-2: #f5f7fb;
  --border: #d9dfeb;
  --accent: #2f3f8f;
  --text: #20243a;
  --text-dim: #58627f;
  --text-faint: #94a0bd;
  --scroll-track: #edf2fb;
  --scroll-thumb: #2f3f8f;
}
html.theme-sakuraPlum,
body.theme-sakuraPlum {
  --bg: #fff8fb;
  --surface: #ffffff;
  --surface-2: #fff0f6;
  --border: #eed7e4;
  --accent: #b85f8f;
  --text: #3c2a35;
  --text-dim: #7c5b6f;
  --text-faint: #b79aae;
  --scroll-track: #faedf3;
  --scroll-thumb: #b85f8f;
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
  max-width: ${EXPORT_CONTENT_WIDTH}px;
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
.scene-img-placeholder { width: 100%; min-height: 180px; background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 6px; color: var(--text-faint); font-size: var(--font-scene-image-label); letter-spacing: 1px; padding: 12px; text-align: center; overflow: hidden; }
.scene-img-placeholder img { max-width: 100%; max-height: 420px; object-fit: contain; display: block; }
.scene-desc { padding: 12px 16px; font-size: 15px; color: var(--text-dim); border-bottom: 1px solid var(--border); line-height: 1.7; white-space: pre-wrap; }
.dialogue-block { padding: 8px 16px; display: flex; flex-direction: column; gap: 2px; }
.dialogue-row, .narration-row { display: flex; gap: 15px; align-items: flex-start; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.char-portrait { flex-shrink: 0; width: calc(var(--portrait-size, 74px) + 12px); display: flex; flex-direction: column; align-items: center; gap: 5px; }
.avatar, .avatar-img { width: var(--portrait-size, 74px); height: var(--portrait-size, 74px); border-radius: 9999px; border: 3px solid var(--ring, var(--border)); background: #26231e; object-fit: cover; display: flex; align-items: center; justify-content: center; font-size: var(--font-avatar-fallback); font-weight: 700; text-align: center; padding: 4px; }
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
[data-preview-block-id] { scroll-margin: 72px; }
[data-preview-block-id]:hover { cursor: pointer; }
.preview-target-flash { outline: 3px solid var(--accent); box-shadow: 0 0 0 6px rgba(200,169,110,0.16); transition: outline-color 160ms ease, box-shadow 160ms ease; }
`;

function renderLabelFontCss(data: TheaterData) {
  const presetId = normalizeFontPresetId(data.fontPreset);
  const sizes = normalizeLabelFontSizes(data.labelFontSizes, data.labelFontOffset, presetId);
  const portraitSize = clampPortraitSize(data.portraitSize ?? DEFAULT_PORTRAIT_SIZE);
  return `:root {
  --font-post-tag: ${sizes.postTag}px;
  --font-scene-number: ${sizes.sceneNumber}px;
  --font-scene-image-label: ${sizes.sceneImageLabel}px;
  --font-avatar-fallback: ${sizes.avatarFallback}px;
  --font-character-name: ${sizes.characterName}px;
  --font-block-label: ${sizes.blockLabel}px;
  --font-side-title: ${sizes.sideTitle}px;
  --portrait-size: ${portraitSize}px;
}`;
}

function renderCss(data: TheaterData) {
  return `${baseCss}\n${renderLabelFontCss(data)}`;
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function previewBlockAttr(id: string) {
  return ` data-preview-block-id="${escapeHtml(id)}"`;
}

function isSceneCard(block: PageBlock): block is SceneCardData {
  return block.kind === "scene";
}

function normalizeCharacterId(id: string) {
  return CHARACTER_ID_ALIASES[id] ?? id;
}

function getCharacterImagePresetGroups(character: CharacterPreset | undefined, includeEmpty = false) {
  const groups = character?.imagePresetGroups ?? [];
  return includeEmpty ? groups : groups.filter((group) => group.presets.length);
}

function flattenImagePresetGroups(groups: CharacterImagePresetGroup[] = []) {
  return groups.flatMap((group) => group.presets);
}

function getDefaultImagePresetGroups(defaults: CharacterPreset | undefined) {
  if (defaults?.imagePresetGroups?.length) return defaults.imagePresetGroups;
  if (defaults?.imagePresets?.length) return [{ id: LEGACY_IMAGE_PRESET_GROUP_ID, name: "프리셋", locked: true, presets: defaults.imagePresets }];
  return [];
}

function getIncomingImagePresetGroups(preset: CharacterPreset) {
  const groups = preset.imagePresetGroups ?? [];
  if (!preset.imagePresets?.length) return groups;
  return [
    ...groups,
    {
      id: LEGACY_IMAGE_PRESET_GROUP_ID,
      name: "개인",
      presets: preset.imagePresets
    }
  ];
}

function mergeCharacterImagePresetGroups(defaults: CharacterPreset | undefined, preset: CharacterPreset) {
  const globalGroups = getDefaultImagePresetGroups(defaults);
  const globalPresets = flattenImagePresetGroups(globalGroups);
  const globalIds = new Set(globalPresets.map((imagePreset) => imagePreset.id));
  const hiddenGlobalIds = new Set(preset.hiddenGlobalImagePresetIds ?? []);
  const incomingGroups = getIncomingImagePresetGroups(preset);
  const incomingPresetsById = new Map(flattenImagePresetGroups(incomingGroups).map((imagePreset) => [imagePreset.id, imagePreset]));
  const incomingGroupsById = new Map(incomingGroups.map((group) => [group.id, group]));
  const usedCustomIds = new Set<string>();

  const mergedGlobalGroups = globalGroups
    .map((group) => {
      const incomingGroup = incomingGroupsById.get(group.id);
      const mergedGlobalPresets = group.presets
        .filter((imagePreset) => !hiddenGlobalIds.has(imagePreset.id))
        .map((imagePreset) => mergeImagePresetWithDefaults(imagePreset, incomingPresetsById.get(imagePreset.id)));
      const groupCustomPresets = (incomingGroup?.presets ?? []).filter((imagePreset) => !globalIds.has(imagePreset.id));
      groupCustomPresets.forEach((imagePreset) => usedCustomIds.add(imagePreset.id));
      return {
        ...group,
        name: preferNonEmptyString(incomingGroup?.name, group.name) ?? group.name,
        presets: [...mergedGlobalPresets, ...groupCustomPresets]
      };
    })
    .filter((group) => group.presets.length);

  const globalGroupIds = new Set(globalGroups.map((group) => group.id));
  const customGroups = incomingGroups
    .filter((group) => !globalGroupIds.has(group.id))
    .map((group) => ({
      ...group,
      locked: false,
      presets: group.presets.filter((imagePreset) => !globalIds.has(imagePreset.id) && !usedCustomIds.has(imagePreset.id))
    }))
    .filter((group) => group.presets.length || group.id !== LEGACY_IMAGE_PRESET_GROUP_ID);

  const mergedGlobalGroupsById = new Map(mergedGlobalGroups.map((group) => [group.id, group]));
  const customGroupsById = new Map(customGroups.map((group) => [group.id, group]));
  const orderedIds = incomingGroups
    .map((group) => group.id)
    .filter((groupId, index, items) => items.indexOf(groupId) === index)
    .filter((groupId) => mergedGlobalGroupsById.has(groupId) || customGroupsById.has(groupId));
  const missingGlobalIds = mergedGlobalGroups.map((group) => group.id).filter((groupId) => !orderedIds.includes(groupId));

  return [...orderedIds, ...missingGlobalIds]
    .map((groupId) => mergedGlobalGroupsById.get(groupId) ?? customGroupsById.get(groupId))
    .filter((group): group is CharacterImagePresetGroup => Boolean(group));
}

function isGlobalImagePreset(characterId: string, imagePresetId: string) {
  const id = normalizeCharacterId(characterId);
  const defaults = CHARACTER_PRESETS.find((preset) => preset.id === id);
  return Boolean(flattenImagePresetGroups(getDefaultImagePresetGroups(defaults)).some((imagePreset) => imagePreset.id === imagePresetId));
}

function isGlobalImagePresetGroup(characterId: string, groupId: string) {
  const id = normalizeCharacterId(characterId);
  const defaults = CHARACTER_PRESETS.find((preset) => preset.id === id);
  return Boolean(getDefaultImagePresetGroups(defaults).some((group) => group.id === groupId));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function preferNonEmptyString(value?: string, fallback?: string) {
  return value?.trim() ? value : fallback;
}

function mergeImagePresetWithDefaults(defaultPreset: CharacterImagePreset, incomingPreset?: CharacterImagePreset): CharacterImagePreset {
  if (!incomingPreset) return defaultPreset;
  return {
    ...defaultPreset,
    ...incomingPreset,
    name: preferNonEmptyString(incomingPreset.name, defaultPreset.name) ?? defaultPreset.name,
    imageData: preferNonEmptyString(incomingPreset.imageData, defaultPreset.imageData),
    imageKey: preferNonEmptyString(incomingPreset.imageKey, defaultPreset.imageKey),
    imageMimeType: preferNonEmptyString(incomingPreset.imageMimeType, defaultPreset.imageMimeType)
  };
}

function normalizeCharacterPresets(presets: CharacterPreset[]) {
  const normalizedById = new Map<string, CharacterPreset>();

  for (const preset of presets) {
    const id = normalizeCharacterId(preset.id);
    if (normalizedById.has(id)) continue;
    const defaults = CHARACTER_PRESETS.find((item) => item.id === id);
    const hiddenGlobalImagePresetIds = uniqueStrings(preset.hiddenGlobalImagePresetIds ?? []);
    normalizedById.set(id, {
      ...defaults,
      ...preset,
      id,
      name: preferNonEmptyString(preset.name, defaults?.name) ?? id,
      imageData: preferNonEmptyString(preset.imageData, defaults?.imageData),
      imageKey: preferNonEmptyString(preset.imageKey, defaults?.imageKey),
      imageMimeType: preferNonEmptyString(preset.imageMimeType, defaults?.imageMimeType),
      ring: preferNonEmptyString(preset.ring, defaults?.ring) ?? "#bbbbbb",
      selectedImagePresetId: preferNonEmptyString(preset.selectedImagePresetId, defaults?.selectedImagePresetId),
      imagePresetGroups: mergeCharacterImagePresetGroups(defaults, { ...preset, id, hiddenGlobalImagePresetIds }),
      imagePresets: undefined,
      hiddenGlobalImagePresetIds: hiddenGlobalImagePresetIds.length ? hiddenGlobalImagePresetIds : undefined,
      markImageData: preferNonEmptyString(preset.markImageData, defaults?.markImageData),
      markImageKey: preferNonEmptyString(preset.markImageKey, defaults?.markImageKey),
      prisonerNumber: preset.prisonerNumber ?? defaults?.prisonerNumber
    });
  }

  for (const defaults of CHARACTER_PRESETS) {
    if (normalizedById.has(defaults.id)) continue;
    normalizedById.set(defaults.id, {
      ...defaults,
      imagePresetGroups: mergeCharacterImagePresetGroups(defaults, defaults),
      imagePresets: undefined
    });
  }

  return Array.from(normalizedById.values()).sort((a, b) => {
    const aIndex = CHARACTER_PRESET_ORDER.indexOf(a.id);
    const bIndex = CHARACTER_PRESET_ORDER.indexOf(b.id);
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  });
}

function normalizeTheaterData(data: TheaterData): TheaterData {
  const fontPreset = normalizeFontPresetId(data.fontPreset);
  return {
    ...data,
    fontPreset,
    labelFontSizes: normalizeLabelFontSizes(data.labelFontSizes, data.labelFontOffset, fontPreset),
    portraitSize: clampPortraitSize(data.portraitSize ?? DEFAULT_PORTRAIT_SIZE),
    labelFontOffset: undefined,
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

function getCharacterImagePreset(character: CharacterPreset | undefined, imagePresetId?: string) {
  if (!character || !imagePresetId) return undefined;
  return flattenImagePresetGroups(getCharacterImagePresetGroups(character)).find((preset) => preset.id === imagePresetId);
}

function getCharacterAvatarImage(character: CharacterPreset | undefined, imagePresetId?: string) {
  const presetImage = getCharacterImagePreset(character, imagePresetId ?? character?.selectedImagePresetId)?.imageData;
  return presetImage || character?.imageData || "";
}

function moveArrayItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function moveArrayItemTo<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

type DragPayload = { scope: "page"; id: string } | { scope: "scene"; sceneId: string; id: string };

const DRAG_DATA_TYPE = "application/x-theater-drag";

function writeDragPayload(event: React.DragEvent, payload: DragPayload) {
  const serialized = JSON.stringify(payload);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(DRAG_DATA_TYPE, serialized);
  event.dataTransfer.setData("text/plain", serialized);
}

function readDragPayload(event: React.DragEvent): DragPayload | null {
  const serialized = event.dataTransfer.getData(DRAG_DATA_TYPE) || event.dataTransfer.getData("text/plain");
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized) as DragPayload;
    if (parsed.scope === "page" || parsed.scope === "scene") return parsed;
  } catch {
    return null;
  }
  return null;
}

function collectCollapsibleBlockIds(data: TheaterData) {
  return data.blocks.flatMap((block) => (isSceneCard(block) ? [block.id, ...block.blocks.map((sceneBlock) => sceneBlock.id)] : [block.id]));
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

function updateSceneBlockFontSizes(block: SceneBlock, action: FontSizeAction, presetId: FontPresetId): SceneBlock {
  const sceneDefaults = getSceneDefaultFontSizes(presetId);
  if (block.type === "reference") return block;
  if (block.type === "sceneHeader") {
    const selectedSample = SCENE_BACKGROUND_SAMPLES.find((sample) => sample.fullSrc === block.imageData) ?? null;
    return {
      ...block,
      title: updateTextSizeTags(block.title, action, sceneDefaults.sceneTitle),
      desc: updateTextSizeTags(block.desc, action, sceneDefaults.sceneDesc),
      titleStyle: updateStyleFontSize(block.titleStyle, action, sceneDefaults.sceneTitle),
      descStyle: updateStyleFontSize(block.descStyle, action, sceneDefaults.sceneDesc)
    };
  }
  if (block.type === "character") {
    return {
      ...block,
      text: updateTextSizeTags(block.text, action, sceneDefaults.character),
      textStyle: updateStyleFontSize(block.textStyle, action, sceneDefaults.character)
    };
  }
  if (block.type === "narration") {
    return {
      ...block,
      text: updateTextSizeTags(block.text, action, sceneDefaults.narration),
      textStyle: updateStyleFontSize(block.textStyle, action, sceneDefaults.narration)
    };
  }
  if (block.type === "afterword") {
    return {
      ...block,
      text: updateTextSizeTags(block.text, action, sceneDefaults.afterword),
      textStyle: updateStyleFontSize(block.textStyle, action, sceneDefaults.afterword)
    };
  }
  return {
    ...block,
    textStyle: updateStyleFontSize(block.textStyle, action, sceneDefaults.tikitaka),
    lines: block.lines.map((line) => ({ ...line, text: updateTextSizeTags(line.text, action, sceneDefaults.tikitaka) }))
  };
}

function updatePageBlockFontSizes(block: PageBlock, action: FontSizeAction, presetId: FontPresetId): PageBlock {
  const moduleDefaults = getModuleDefaultFontSizes(presetId);
  if (!isSceneCard(block)) {
    const defaultSize = moduleDefaults[block.moduleType];
    return {
      ...block,
      content: updateTextSizeTags(block.content, action, defaultSize),
      textStyle: updateStyleFontSize(block.textStyle, action, defaultSize)
    };
  }
  return { ...block, blocks: block.blocks.map((sceneBlock) => updateSceneBlockFontSizes(sceneBlock, action, presetId)) };
}

function updateCharacterDialogueColor(block: SceneBlock, mode: "reset" | "personal"): SceneBlock {
  if (block.type !== "character") return block;
  const { color: _color, ...styleWithoutColor } = block.textStyle ?? {};
  if (mode === "reset") return { ...block, textStyle: withoutUndefined(styleWithoutColor) };
  const color = CHARACTER_DIALOGUE_COLORS[normalizeCharacterId(block.characterId)];
  return { ...block, textStyle: withoutUndefined({ ...styleWithoutColor, color }) };
}

function updatePageBlockDialogueColors(block: PageBlock, mode: "reset" | "personal"): PageBlock {
  if (!isSceneCard(block)) return block;
  return { ...block, blocks: block.blocks.map((sceneBlock) => updateCharacterDialogueColor(sceneBlock, mode)) };
}

function withSceneHeaderImage(block: SceneHeaderBlock, imageData?: string): SceneHeaderBlock {
  return withoutUndefined({
    ...block,
    imageData,
    imageKey: undefined,
    imageMimeType: undefined
  });
}

function renderModuleBlock(block: ModuleBlock) {
  const style = styleToCss(block.textStyle);
  const blockAttr = previewBlockAttr(block.id);
  if (block.moduleType === "title") return `<div class="module-title"${blockAttr}><h1 class="post-title"${style}>${renderRichText(block.content)}</h1></div>`;
  if (block.moduleType === "subtitle") return `<div class="module-subtitle"${blockAttr}><p class="post-subtitle"${style}>${renderRichText(block.content)}</p></div>`;
  return `<p class="narrative"${blockAttr}${style}>${renderRichText(block.content)}</p>`;
}

function renderSceneBlock(block: SceneBlock, presets: CharacterPreset[]) {
  if (block.type === "reference") return "";
  const blockAttr = previewBlockAttr(block.id);
  if (block.type === "sceneHeader") {
    const image = block.imageData
      ? `<img src="${block.imageData}" alt="${escapeHtml(block.imageLabel || block.title)}" />`
      : `<span>${escapeHtml(block.imageLabel || "이미지 없음")}</span>`;
    return `<div class="scene-header"${blockAttr}><span class="scene-num">${escapeHtml(block.sceneNumber)}</span><span class="scene-title"${styleToCss(
      block.titleStyle
    )}>${renderRichText(block.title)}</span></div><div class="scene-img-placeholder"${blockAttr}>${image}</div><div class="scene-desc"${blockAttr}${styleToCss(
      block.descStyle
    )}>${renderRichText(block.desc)}</div>`;
  }
  if (block.type === "character") {
    const characterId = normalizeCharacterId(block.characterId);
    const character = presets.find((preset) => preset.id === characterId) ?? presets[0];
    const role = block.role ?? "";
    const avatarImage = getCharacterAvatarImage(character, block.imagePresetId);
    const avatar = avatarImage
      ? `<img class="avatar-img" style="--ring:${character.ring}" src="${avatarImage}" alt="${escapeHtml(character.name)}" />`
      : `<div class="avatar" style="--ring:${character.ring}">${escapeHtml(character.name.slice(0, 2))}</div>`;
    return `<div class="dialogue-block"${blockAttr}><div class="dialogue-row"><div class="char-portrait">${avatar}<div class="char-name">${escapeHtml(
      character.name
    )}</div></div><div class="dialogue-content"><div class="dialogue-label">${escapeHtml(role)}</div><div class="dialogue-text"${styleToCss(
      block.textStyle
    )}>${renderRichText(block.text)}</div></div></div></div>`;
  }
  if (block.type === "narration") {
    const label = block.title.trim() ? `<div class="narration-label">${escapeHtml(block.title)}</div>` : "";
    return `<div class="narration-row"${blockAttr}><div class="narration-content">${label}<div class="narration-text"${styleToCss(
      block.textStyle
    )}>${renderRichText(block.text)}</div></div></div>`;
  }
  if (block.type === "afterword") {
    return `<div class="afterword"${blockAttr}${styleToCss(block.textStyle)}><div class="afterword-title">${escapeHtml(block.title)}</div>${renderRichText(block.text)}</div>`;
  }
  return `<div class="tikitaka"${blockAttr}${styleToCss(block.textStyle)}><div class="tikitaka-title">${escapeHtml(block.title)}</div>${block.lines
    .map((line) => `<strong>${escapeHtml(line.speaker)}</strong>: ${renderRichText(line.text)}`)
    .join("<br />")}</div>`;
}

function renderPreviewBody(data: TheaterData, presets: CharacterPreset[]) {
  const blocks = [...data.blocks];
  let header = "";
  if (blocks[0]?.kind === "module" && blocks[0].moduleType === "title" && blocks[1]?.kind === "module" && blocks[1].moduleType === "subtitle") {
    const title = blocks.shift() as ModuleBlock;
    const subtitle = blocks.shift() as ModuleBlock;
    header = `<div class="post-header"><div class="post-title"${previewBlockAttr(title.id)}${styleToCss(
      title.textStyle
    )}>${renderRichText(title.content)}</div><div class="post-subtitle"${previewBlockAttr(subtitle.id)}${styleToCss(subtitle.textStyle)}>${renderRichText(subtitle.content)}</div></div>`;
  }

  const body = blocks
    .map((block) => {
      if (!isSceneCard(block)) return renderModuleBlock(block);
      return `<section class="scene"${previewBlockAttr(block.id)}>${block.blocks.map((sceneBlock) => renderSceneBlock(sceneBlock, presets)).join("")}</section>`;
    })
    .join("\n");
  return `${header}${body}`;
}

function renderPreviewShell(css: string, theme: ThemeMode = "blackGold") {
  return `<!doctype html><html lang="ko" class="theme-${theme}"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Theater Export</title><style id="preview-css">${css}</style></head><body class="theme-${theme}"></body></html>`;
}

function renderHtml(data: TheaterData, presets: CharacterPreset[], theme: ThemeMode = "blackGold") {
  return renderStandaloneHtml(renderPreviewBody(data, presets), data, theme);
}

function renderStandaloneHtml(bodyHtml: string, data: TheaterData, theme: ThemeMode = "blackGold") {
  return `<!doctype html><html lang="ko" class="theme-${theme}"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Theater Export</title><style>${renderCss(
    data
  )}</style></head><body class="theme-${theme}">${bodyHtml}</body></html>`;
}

function measureElementHeight(element: Element) {
  const rect = element.getBoundingClientRect();
  return Math.ceil(Math.max(rect.height, (element as HTMLElement).offsetHeight || 0, (element as HTMLElement).scrollHeight || 0));
}

type CaptureSlice = { top: number; height: number };

function getCaptureBlockBoundaries(target: HTMLElement, totalHeight: number) {
  const targetRect = target.getBoundingClientRect();
  const boundaries = new Set<number>([0, totalHeight]);
  target.querySelectorAll<HTMLElement>("[data-preview-block-id]").forEach((element) => {
    const rect = element.getBoundingClientRect();
    const top = Math.round(rect.top - targetRect.top);
    const bottom = Math.round(rect.bottom - targetRect.top);
    if (bottom <= 0 || top >= totalHeight || bottom - top < 1) return;
    boundaries.add(Math.max(0, Math.min(totalHeight, top)));
    boundaries.add(Math.max(0, Math.min(totalHeight, bottom)));
  });
  return Array.from(boundaries).sort((a, b) => a - b);
}

function pickCaptureCut(boundaries: number[], currentTop: number, totalHeight: number, preferredMinHeight: number, preferredMaxHeight: number) {
  const ideal = Math.min(totalHeight, currentTop + TARGET_CAPTURE_CHUNK_HEIGHT);
  const minCut = Math.min(totalHeight, currentTop + preferredMinHeight);
  const maxCut = Math.min(totalHeight, currentTop + preferredMaxHeight);
  const forwardBoundaries = boundaries.filter((boundary) => boundary > currentTop);
  if (forwardBoundaries.length === 0) return totalHeight;
  if (totalHeight <= maxCut) return totalHeight;

  const comfortable = forwardBoundaries.filter((boundary) => boundary >= minCut && boundary <= maxCut);
  if (comfortable.length > 0) {
    return comfortable.reduce((best, boundary) => (Math.abs(boundary - ideal) < Math.abs(best - ideal) ? boundary : best), comfortable[0]);
  }

  const beforeMax = forwardBoundaries.filter((boundary) => boundary <= maxCut);
  if (beforeMax.length > 0) return beforeMax[beforeMax.length - 1];

  return forwardBoundaries[0];
}

function buildCaptureSlices(target: HTMLElement, preferredMinHeight: number, preferredMaxHeight: number) {
  const totalHeight = Math.max(1, measureElementHeight(target));
  const boundaries = getCaptureBlockBoundaries(target, totalHeight);
  const slices: CaptureSlice[] = [];
  let currentTop = 0;

  while (currentTop < totalHeight) {
    const nextCut = pickCaptureCut(boundaries, currentTop, totalHeight, preferredMinHeight, preferredMaxHeight);
    const safeCut = nextCut > currentTop ? nextCut : Math.min(totalHeight, currentTop + TARGET_CAPTURE_CHUNK_HEIGHT);
    slices.push({ top: currentTop, height: Math.max(1, safeCut - currentTop) });
    currentTop = safeCut;
  }

  if (slices.length > 1) {
    const lastSlice = slices[slices.length - 1];
    const previousSlice = slices[slices.length - 2];
    if (lastSlice.height < preferredMinHeight && previousSlice.height + lastSlice.height <= preferredMaxHeight) {
      previousSlice.height += lastSlice.height;
      slices.pop();
    }
  }

  return slices;
}

function applyCaptureSliceViewport(doc: Document, target: HTMLElement, slice: CaptureSlice) {
  let content = doc.getElementById("capture-slice-content") as HTMLElement | null;
  if (!content) {
    content = doc.createElement("div");
    content.id = "capture-slice-content";
    while (target.firstChild) content.appendChild(target.firstChild);
    target.appendChild(content);
  }

  target.style.height = `${slice.height}px`;
  target.style.minHeight = `${slice.height}px`;
  target.style.overflow = "hidden";
  content.style.transform = `translateY(-${slice.top}px)`;
  content.style.transformOrigin = "top left";
}

function createModuleBlock(moduleType: ModuleType, presetId: FontPresetId): ModuleBlock {
  const moduleDefaults = getModuleDefaultFontSizes(presetId);
  const defaultTextStyle = getDefaultTextStyle(presetId);
  return {
    id: makeId(),
    kind: "module",
    moduleType,
    content: moduleType === "title" ? "새 제목" : moduleType === "subtitle" ? "새 부제" : "새 나레이션",
    textStyle: moduleType === "title" ? { ...defaultTextStyle, fontSize: moduleDefaults.title, bold: true } : { ...defaultTextStyle }
  };
}

function createSceneCard(presetId: FontPresetId): SceneCardData {
  const defaultTextStyle = getDefaultTextStyle(presetId);
  const sceneDefaults = getSceneDefaultFontSizes(presetId);
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
        titleStyle: { ...defaultTextStyle, fontSize: sceneDefaults.sceneTitle, bold: true },
        descStyle: { ...defaultTextStyle, fontSize: sceneDefaults.sceneDesc, color: "#9a9080" }
      }
    ]
  };
}

function createSceneBlock(type: SceneBlockType, defaultCharacterId: string, presetId: FontPresetId): SceneBlock {
  const defaultTextStyle = getDefaultTextStyle(presetId);
  const sceneDefaults = getSceneDefaultFontSizes(presetId);
  if (type === "sceneHeader") {
    return {
      id: makeId(),
      type,
      sceneNumber: "SCENE",
      title: "장면 제목",
      desc: "",
      imageLabel: "이미지",
      titleStyle: { ...defaultTextStyle, fontSize: sceneDefaults.sceneTitle, bold: true },
      descStyle: { ...defaultTextStyle, fontSize: sceneDefaults.sceneDesc, color: "#9a9080" }
    };
  }
  if (type === "character") return { id: makeId(), type, characterId: defaultCharacterId, role: "대사", text: "", textStyle: { ...defaultTextStyle } };
  if (type === "narration") return { id: makeId(), type, title: "나레이션", text: "", textStyle: { ...defaultTextStyle } };
  if (type === "afterword") return { id: makeId(), type, title: "후기", text: "", textStyle: { ...defaultTextStyle, fontSize: sceneDefaults.afterword, color: "#9a9080" } };
  if (type === "reference") return { id: makeId(), type, title: "참고 데이터", text: "" };
  return { id: makeId(), type, title: "티키타카", textStyle: { ...defaultTextStyle, fontSize: sceneDefaults.tikitaka, color: "#9a9080" }, lines: [{ id: makeId(), speaker: "화자", text: "" }] };
}

type ImageOptimizeOptions = {
  maxDimension: number;
  targetBytes: number;
};

function dataUrlByteLength(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  const base64 = commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
  return Math.ceil((base64.length * 3) / 4);
}

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없습니다."));
    };
    image.src = url;
  });
}

async function optimizeImageFile(file: File, options: ImageOptimizeOptions) {
  const image = await loadImageElement(file);
  const scale = Math.min(1, options.maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지 변환을 준비할 수 없습니다.");
  context.drawImage(image, 0, 0, width, height);

  const webpProbe = canvas.toDataURL("image/webp", 0.82);
  const mimeType = webpProbe.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
  const qualities = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38];
  let best = webpProbe;

  for (const quality of qualities) {
    const dataUrl = canvas.toDataURL(mimeType, quality);
    best = dataUrl;
    if (dataUrlByteLength(dataUrl) <= options.targetBytes) break;
  }

  return best;
}

function readImageFile(file: File, callback: (dataUrl: string) => void, options: ImageOptimizeOptions = SCENE_IMAGE_OPTIONS) {
  optimizeImageFile(file, options)
    .then(callback)
    .catch(() => {
      const reader = new FileReader();
      reader.onload = () => callback(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
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

const CAPTURE_WIDTH = EXPORT_CONTENT_WIDTH;

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
      imageData: await assetToDataUrl(preset.imageData || ""),
      imagePresetGroups: preset.imagePresetGroups
        ? await Promise.all(
            preset.imagePresetGroups.map(async (group) => ({
              ...group,
              presets: await Promise.all(
                group.presets.map(async (imagePreset) => ({
                  ...imagePreset,
                  imageData: await assetToDataUrl(imagePreset.imageData || "")
                }))
              )
            }))
          )
        : undefined
    }))
  );

  const exportData: TheaterData = {
    ...normalizeTheaterData(data),
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
const ROOM_DRAFT_STORAGE_PREFIX = "theater-tool-room-draft:";
const PROFILE_GROUP_EXPANDED_STORAGE_KEY = "theater-tool-profile-groups-expanded";
const PRESET_MANAGER_GROUP_EXPANDED_STORAGE_KEY = "theater-tool-preset-manager-groups-expanded";
const TEMPLATE_LIST_EXPANDED_STORAGE_KEY = "theater-tool-template-list-expanded";
const TEMPLATE_TRASH_EXPANDED_STORAGE_KEY = "theater-tool-template-trash-expanded";
const TEMPLATES_API_PATH = "/.netlify/functions/templates";
const IMAGES_API_PATH = "/.netlify/functions/images";

function saveRoomCode(roomCode: string) {
  window.localStorage.setItem(ROOM_STORAGE_KEY, roomCode);
}

function loadInitialRoomCode() {
  const fallback = PUBLIC_SAMPLE_ROOM_CODE;
  try {
    const saved = normalizeRoomCode(window.localStorage.getItem(ROOM_STORAGE_KEY) || "");
    const nextRoomCode = saved && !validateRoomCode(saved) ? saved : fallback;
    if (saved !== nextRoomCode) saveRoomCode(nextRoomCode);
    return nextRoomCode;
  } catch {
    return fallback;
  }
}

function loadStringSet(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return new Set<string>(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function saveStringSet(key: string, values: Set<string>) {
  window.localStorage.setItem(key, JSON.stringify([...values]));
}

function loadBoolean(key: string, fallback = false) {
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === null) return fallback;
    return saved === "1";
  } catch {
    return fallback;
  }
}

function saveBoolean(key: string, value: boolean) {
  window.localStorage.setItem(key, value ? "1" : "0");
}

function createEmptyTheaterData(): TheaterData {
  return {
    blocks: [],
    fontPreset: DEFAULT_FONT_PRESET_ID,
    labelFontSizes: getDefaultLabelFontSizes(DEFAULT_FONT_PRESET_ID),
    portraitSize: DEFAULT_PORTRAIT_SIZE
  };
}

function getInitialDefaultData() {
  return normalizeTheaterData(createEmptyTheaterData());
}

function getInitialDefaultPresets() {
  return normalizeCharacterPresets(CHARACTER_PRESETS);
}

function getRoomDraftStorageKey(roomCode: string) {
  return `${ROOM_DRAFT_STORAGE_PREFIX}${normalizeRoomCode(roomCode)}`;
}

function loadRoomDraft(roomCode: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getRoomDraftStorageKey(roomCode)) || "null") as (TheaterSaveFile & { savedAt?: string }) | null;
    if (!parsed?.data?.blocks) return null;
    return {
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
      data: normalizeTheaterData(hydrateDataImages(parsed.data)),
      presets: parsed.presets ? normalizeCharacterPresets(hydratePresetImages(parsed.presets)) : getInitialDefaultPresets()
    };
  } catch {
    return null;
  }
}

function saveRoomDraft(roomCode: string, data: TheaterData, presets: CharacterPreset[]) {
  if (!roomCode) return;
  const saveFile = createSaveFile(data, presets);
  window.localStorage.setItem(
    getRoomDraftStorageKey(roomCode),
    JSON.stringify({
      ...saveFile,
      savedAt: new Date().toISOString()
    })
  );
}

function clearRoomDraft(roomCode: string) {
  if (!roomCode) return;
  window.localStorage.removeItem(getRoomDraftStorageKey(roomCode));
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

async function requestTemplates(
  method: "GET" | "POST" | "DELETE",
  roomCode: string,
  payload?: Record<string, unknown>,
  query?: Record<string, string>
) {
  const params = new URLSearchParams({ roomCode, ...(query ?? {}) });
  const url = method === "GET" ? `${TEMPLATES_API_PATH}?${params.toString()}` : TEMPLATES_API_PATH;
  const response = await fetch(url, {
    method,
    headers: method === "GET" ? undefined : { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify({ roomCode, ...payload, requestOptions: query })
  });
  const result = (await response.json()) as TemplatesApiResponse;
  if (!response.ok) throw new Error(result.error || "템플릿 저장소 요청에 실패했습니다.");
  return {
    templates: Array.isArray(result.templates) ? result.templates : [],
    trashedTemplates: Array.isArray(result.trashedTemplates) ? result.trashedTemplates : [],
    template: result.template ?? null,
    versions: Array.isArray(result.versions) ? result.versions : [],
    characterPresetLibrary: result.characterPresetLibrary ?? null,
    characterPresetLibraryMeta: result.characterPresetLibraryMeta ?? null,
    activityLog: Array.isArray(result.activityLog) ? result.activityLog : [],
    usage: result.usage ?? null
  } satisfies TemplatesApiPayload;
}

async function uploadImageData(roomCode: string, imageData: string) {
  const response = await fetch(IMAGES_API_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomCode, imageData })
  });
  const result = (await response.json()) as ImagesApiResponse;
  if (!response.ok || !result.imageKey) throw new Error(result.error || "이미지 저장에 실패했습니다.");
  return result;
}

async function requestImageUsage(roomCode: string) {
  const params = new URLSearchParams({ roomCode, usage: "1" });
  const response = await fetch(`${IMAGES_API_PATH}?${params.toString()}`);
  const result = (await response.json()) as ImagesApiResponse;
  if (!response.ok) throw new Error(result.error || "이미지 사용량을 불러오지 못했습니다.");
  return result.usage ?? { imageBytes: 0, imageCount: 0, missingImages: 0 };
}

function createLimitedImageUploader(roomCode: string) {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const runNext = () => {
    activeCount -= 1;
    queue.shift()?.();
  };

  return (imageData: string) =>
    getCachedRoomUpload(roomCode, imageData, () =>
      new Promise<ImagesApiResponse>((resolve, reject) => {
        const run = () => {
          activeCount += 1;
          uploadImageData(roomCode, imageData).then(resolve, reject).finally(runNext);
        };
        if (activeCount < IMAGE_UPLOAD_CONCURRENCY) run();
        else queue.push(run);
      })
    );
}

async function imageFieldsForRemote<T extends { imageData?: string; imageKey?: string; imageMimeType?: string }>(
  value: T,
  roomCode: string,
  upload: (imageData: string) => Promise<ImagesApiResponse> = (imageData) => uploadImageData(roomCode, imageData)
): Promise<T> {
  const existingKey = value.imageKey || imageKeyFromUrl(value.imageData);
  if (isDataUrl(value.imageData)) {
    const uploaded = await upload(value.imageData || "");
    return withoutUndefined({ ...value, imageData: undefined, imageKey: uploaded.imageKey, imageMimeType: uploaded.mimeType });
  }
  if (existingKey) {
    return withoutUndefined({ ...value, imageData: undefined, imageKey: existingKey });
  }
  return value;
}

async function preparePresetsForRemote(presets: CharacterPreset[], roomCode: string, upload = createLimitedImageUploader(roomCode)) {
  return Promise.all(
    normalizeCharacterPresets(presets).map(async (preset) => ({
      ...(await imageFieldsForRemote(preset, roomCode, upload)),
      imagePresetGroups: preset.imagePresetGroups
        ? await Promise.all(
            preset.imagePresetGroups.map(async (group) => ({
              ...group,
              presets: await Promise.all(group.presets.map((imagePreset) => imageFieldsForRemote(imagePreset, roomCode, upload)))
            }))
          )
        : undefined,
      imagePresets: undefined
    }))
  );
}

async function prepareDataForRemote(data: TheaterData, roomCode: string, upload = createLimitedImageUploader(roomCode)): Promise<TheaterData> {
  const normalized = normalizeTheaterData(data);
  return {
    ...normalized,
    blocks: await Promise.all(
      normalized.blocks.map(async (block) => {
        if (!isSceneCard(block)) return block;
        return {
          ...block,
          blocks: await Promise.all(
            block.blocks.map((sceneBlock) => (sceneBlock.type === "sceneHeader" ? imageFieldsForRemote(sceneBlock, roomCode, upload) : sceneBlock))
          )
        };
      })
    )
  };
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

function makeCaptureStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function makeCaptureFilename(stamp: string, part?: number, totalParts?: number) {
  if (!part || !totalParts || totalParts <= 1) return `theater-capture-${stamp}.png`;
  const digits = String(totalParts).length;
  return `theater-capture-${stamp}-${String(part).padStart(digits, "0")}.png`;
}

function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (value: string) => void; rows?: number }) {
  return <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />;
}

type CommitMode = "immediate" | "textGroup";

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
  setPresets,
  activeRoomCode,
  characterLibraryLoading,
  characterLibraryMessage,
  hasCharacterLibrary,
  characterLibraryUsageBytes,
  characterLibraryLimitBytes,
  isPublicRoom,
  onSaveCharacterLibrary,
  onLoadCharacterLibrary
}: {
  presets: CharacterPreset[];
  setPresets: React.Dispatch<React.SetStateAction<CharacterPreset[]>>;
  activeRoomCode: string;
  characterLibraryLoading: boolean;
  characterLibraryMessage: string;
  hasCharacterLibrary: boolean;
  characterLibraryUsageBytes: number;
  characterLibraryLimitBytes: number;
  isPublicRoom: boolean;
  onSaveCharacterLibrary: (nextPresets?: CharacterPreset[], silent?: boolean) => void;
  onLoadCharacterLibrary: () => void;
}) {
  const [activeCharacterId, setActiveCharacterId] = useState(presets[0]?.id ?? "");
  const [expandedImageGroupIds, setExpandedImageGroupIds] = useState<Set<string>>(() => loadStringSet(PRESET_MANAGER_GROUP_EXPANDED_STORAGE_KEY));
  const activeCharacter = presets.find((preset) => preset.id === activeCharacterId) ?? presets[0];
  const activeImageGroups = useMemo(() => getCharacterImagePresetGroups(activeCharacter, true), [activeCharacter]);
  const activeCustomGroupCount = activeCharacter?.imagePresetGroups?.filter((group) => !isGlobalImagePresetGroup(activeCharacter.id, group.id)).length ?? 0;
  const isImagePresetGroupLimitReached = activeCustomGroupCount >= MAX_IMAGE_PRESET_GROUPS_PER_CHARACTER;
  const usageRatio = Math.min(100, Math.round((characterLibraryUsageBytes / characterLibraryLimitBytes) * 100));

  useEffect(() => {
    if (!presets.some((preset) => preset.id === activeCharacterId)) {
      setActiveCharacterId(presets[0]?.id ?? "");
    }
  }, [activeCharacterId, presets]);

  const updateCharacter = (characterId: string, updater: (character: CharacterPreset) => CharacterPreset, persist = false) => {
    const nextPresets = presets.map((preset) => (preset.id === characterId ? updater(preset) : preset));
    setPresets(nextPresets);
    if (persist && activeRoomCode && !isPublicRoom) {
      onSaveCharacterLibrary(nextPresets, true);
    }
  };

  const addImageGroup = () => {
    if (!activeCharacter) return;
    if (isPublicRoom) {
      window.alert("000000 샘플 코드는 읽기 전용이라 이미지 프리셋 그룹을 추가할 수 없습니다.");
      return;
    }
    if (isImagePresetGroupLimitReached) {
      window.alert(`캐릭터당 개인 프로필 그룹은 최대 ${MAX_IMAGE_PRESET_GROUPS_PER_CHARACTER}개까지 추가할 수 있습니다.`);
      return;
    }
    const name = window.prompt("추가할 프로필 사진 그룹 이름을 입력하세요.", "새 그룹");
    if (!name?.trim()) return;
    const groupId = `${activeCharacter.id}-group-${makeId()}`;
    updateCharacter(activeCharacter.id, (character) => ({
      ...character,
      imagePresetGroups: [...(character.imagePresetGroups ?? []), { id: groupId, name: name.trim(), presets: [] }]
    }));
    setExpandedImageGroupIds((current) => new Set([...current, groupId]));
    saveStringSet(PRESET_MANAGER_GROUP_EXPANDED_STORAGE_KEY, new Set([...expandedImageGroupIds, groupId]));
  };

  const addImagePreset = (groupId: string) => {
    if (!activeCharacter) return;
    if (isPublicRoom) {
      window.alert("000000 샘플 코드는 읽기 전용이라 이미지 프리셋을 추가할 수 없습니다.");
      return;
    }
    const targetGroup = activeImageGroups.find((group) => group.id === groupId);
    if (!targetGroup) return;
    if (targetGroup.presets.length >= MAX_IMAGE_PRESETS_PER_GROUP) {
      window.alert(`프로필 그룹당 이미지는 최대 ${MAX_IMAGE_PRESETS_PER_GROUP}개까지 추가할 수 있습니다.`);
      return;
    }
    const presetId = `${activeCharacter.id}-${makeId()}`;
    updateCharacter(activeCharacter.id, (character) => ({
      ...character,
      imagePresetGroups: (character.imagePresetGroups ?? []).map((group) =>
        group.id === groupId ? { ...group, presets: [...group.presets, { id: presetId, name: `사진 ${group.presets.length + 1}`, imageData: "" }] } : group
      )
    }));
    setExpandedImageGroupIds((current) => new Set([...current, groupId]));
  };

  const updateImagePreset = (characterId: string, imagePresetId: string, updater: (preset: CharacterImagePreset) => CharacterImagePreset) => {
    updateCharacter(characterId, (character) => ({
      ...character,
      imagePresetGroups:
        character.imagePresetGroups?.map((group) => ({
          ...group,
          presets: group.presets.map((preset) => (preset.id === imagePresetId ? updater(preset) : preset))
        })) ?? []
    }));
  };

  const deleteImagePreset = (characterId: string, imagePresetId: string) => {
    updateCharacter(characterId, (character) => ({
      ...character,
      selectedImagePresetId: character.selectedImagePresetId === imagePresetId ? undefined : character.selectedImagePresetId,
      hiddenGlobalImagePresetIds: isGlobalImagePreset(characterId, imagePresetId)
        ? uniqueStrings([...(character.hiddenGlobalImagePresetIds ?? []), imagePresetId])
        : character.hiddenGlobalImagePresetIds,
      imagePresetGroups:
        character.imagePresetGroups
          ?.map((group) => ({ ...group, presets: group.presets.filter((preset) => preset.id !== imagePresetId) }))
          .filter((group) => group.presets.length || !isGlobalImagePresetGroup(characterId, group.id)) ?? []
    }), true);
  };

  const deleteImageGroup = (characterId: string, groupId: string) => {
    updateCharacter(characterId, (character) => {
      const group = character.imagePresetGroups?.find((item) => item.id === groupId);
      const hiddenIds = group && isGlobalImagePresetGroup(characterId, groupId) ? group.presets.map((preset) => preset.id) : [];
      return {
        ...character,
        selectedImagePresetId: group?.presets.some((preset) => preset.id === character.selectedImagePresetId) ? undefined : character.selectedImagePresetId,
        hiddenGlobalImagePresetIds: uniqueStrings([...(character.hiddenGlobalImagePresetIds ?? []), ...hiddenIds]),
        imagePresetGroups: character.imagePresetGroups?.filter((item) => item.id !== groupId) ?? []
      };
    }, true);
  };

  const moveImageGroup = (characterId: string, groupId: string, direction: -1 | 1) => {
    updateCharacter(
      characterId,
      (character) => {
        const groups = character.imagePresetGroups ?? [];
        const index = groups.findIndex((group) => group.id === groupId);
        if (index === -1) return character;
        return {
          ...character,
          imagePresetGroups: moveArrayItem(groups, index, direction)
        };
      },
      true
    );
  };

  const toggleImageGroup = (groupId: string) => {
    setExpandedImageGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      saveStringSet(PRESET_MANAGER_GROUP_EXPANDED_STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <section className="panel">
      <div className="panelTitle">
        <ImagePlus size={18} />
        캐릭터
      </div>
      <div className="characterGrid">
        {presets.map((preset) => (
          <button
            type="button"
            className={`characterChip${preset.id === activeCharacter?.id ? " active" : ""}`}
            key={preset.id}
            onClick={() => setActiveCharacterId(preset.id)}
          >
            <span className="miniAvatar" style={{ borderColor: preset.ring }}>
              {preset.imageData ? <img key={preset.imageData} src={preset.imageData} alt="" /> : preset.name.slice(0, 2)}
            </span>
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
      {activeCharacter ? (
        <div className="characterPresetManager">
          <div className="characterPresetHeader">
            <span className="miniAvatar" style={{ borderColor: activeCharacter.ring }}>
              {activeCharacter.imageData ? <img key={activeCharacter.imageData} src={activeCharacter.imageData} alt="" /> : activeCharacter.name.slice(0, 2)}
            </span>
            <strong>{activeCharacter.name}</strong>
          </div>
          <label className={`fileButton${isPublicRoom ? " disabled" : ""}`}>
            <Upload size={15} />
            기본 프로필 이미지
            <input
              type="file"
              accept="image/*"
              disabled={isPublicRoom}
              onClick={(event) => {
                event.currentTarget.value = "";
              }}
              onChange={(event) => {
                const input = event.currentTarget;
                const file = event.target.files?.[0];
                input.value = "";
                if (!file) return;
                readImageFile(file, (imageData) => updateCharacter(activeCharacter.id, (character) => ({ ...character, imageData })), PROFILE_IMAGE_OPTIONS);
              }}
            />
          </label>
          <div className="presetManagerTitle">
            <span>프로필 사진 그룹</span>
            <button type="button" onClick={addImageGroup} disabled={isPublicRoom || isImagePresetGroupLimitReached}>
              <Plus size={14} />
              그룹 추가
            </button>
          </div>
          <div className="presetCount">
            개인 그룹 {activeCustomGroupCount} / {MAX_IMAGE_PRESET_GROUPS_PER_CHARACTER}
          </div>
          {activeImageGroups.length ? (
            <div className="profilePresetFolderList">
              {activeImageGroups.map((group, groupIndex) => {
                const isExpanded = expandedImageGroupIds.has(group.id);
                const isGroupFull = group.presets.length >= MAX_IMAGE_PRESETS_PER_GROUP;
                return (
                  <section className="profilePresetFolder" key={group.id}>
                    <div className="profilePresetFolderTop">
                      <button type="button" className="profilePresetFolderName" onClick={() => toggleImageGroup(group.id)}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span>{group.name}</span>
                        <small>{group.presets.length}</small>
                      </button>
                      <div className="profilePresetOrderActions">
                        <button
                          type="button"
                          className="iconButton"
                          onClick={() => moveImageGroup(activeCharacter.id, group.id, -1)}
                          disabled={isPublicRoom || groupIndex === 0}
                          aria-label="그룹 위로 이동"
                          title="그룹 위로 이동"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="iconButton"
                          onClick={() => moveImageGroup(activeCharacter.id, group.id, 1)}
                          disabled={isPublicRoom || groupIndex === activeImageGroups.length - 1}
                          aria-label="그룹 아래로 이동"
                          title="그룹 아래로 이동"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>
                    {isExpanded ? (
                      <div className="profilePresetFolderBody">
                        <div className="profilePresetFolderActions">
                          <button type="button" onClick={() => addImagePreset(group.id)} disabled={isPublicRoom || isGroupFull}>
                            <Plus size={14} />
                            <span>사진<br />추가</span>
                          </button>
                          <button
                            type="button"
                            className="dangerTextButton"
                            onClick={() => deleteImageGroup(activeCharacter.id, group.id)}
                            disabled={isPublicRoom}
                          >
                            <Trash2 size={14} />
                            <span>그룹<br />삭제</span>
                          </button>
                        </div>
                        {group.presets.length ? (
                          <div className="profilePresetPreviewGrid">
                            {group.presets.map((imagePreset) => (
                              <div className="profilePresetTileWrap" key={imagePreset.id}>
                                <label className="profilePresetTile" title={`${group.name} / ${imagePreset.name}`}>
                                  {imagePreset.imageData ? <img src={imagePreset.imageData} alt="" /> : <Upload size={18} />}
                                  {imagePreset.imageData ? (
                                    <span className="imageHoverPreview" aria-hidden="true">
                                      <img src={imagePreset.imageData} alt="" />
                                    </span>
                                  ) : null}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={isPublicRoom}
                                    onClick={(event) => {
                                      event.currentTarget.value = "";
                                    }}
                                    onChange={(event) => {
                                      const input = event.currentTarget;
                                      const file = event.target.files?.[0];
                                      input.value = "";
                                      if (!file) return;
                                      readImageFile(
                                        file,
                                        (imageData) => updateImagePreset(activeCharacter.id, imagePreset.id, (preset) => ({ ...preset, imageData })),
                                        PROFILE_IMAGE_OPTIONS
                                      );
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className="profilePresetTileDelete"
                                  onClick={() => deleteImagePreset(activeCharacter.id, imagePreset.id)}
                                  disabled={isPublicRoom}
                                  aria-label="프리셋 삭제"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="emptyTemplates">사진 없음</div>
                        )}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="emptyTemplates">프로필 그룹 없음</div>
          )}
        </div>
      ) : null}
      <div className="characterLibraryBox">
        <div className="presetManagerTitle">
          <span>개인 캐릭터 프리셋</span>
        </div>
        {activeRoomCode ? (
          <div className="characterLibraryCode">현재 코드: {activeRoomCode}</div>
        ) : (
          <div className="emptyTemplates">접속코드를 입력하면 개인 캐릭터 프리셋을 다른 기기에서도 불러올 수 있습니다.</div>
        )}
        <div className="usageBox">
          <div className="usageText">
            <span>사용량</span>
            <strong>
              {formatBytes(characterLibraryUsageBytes)} / {formatBytes(characterLibraryLimitBytes)}
            </strong>
          </div>
          <div className="usageTrack" aria-hidden="true">
            <span style={{ width: `${usageRatio}%` }} />
          </div>
        </div>
        {isPublicRoom ? <div className="emptyTemplates">000000 샘플 코드는 읽기 전용입니다.</div> : null}
        <div className="characterLibraryActions">
          <button type="button" onClick={() => onSaveCharacterLibrary()} disabled={!activeRoomCode || characterLibraryLoading || isPublicRoom}>
            <Upload size={15} />
            저장
          </button>
          <button type="button" onClick={onLoadCharacterLibrary} disabled={!activeRoomCode || characterLibraryLoading || !hasCharacterLibrary}>
            <Download size={15} />
            불러오기
          </button>
        </div>
        {characterLibraryMessage ? <div className="templateMessage">{characterLibraryMessage}</div> : null}
      </div>
    </section>
  );
}

const SceneBlockEditor = React.memo(function SceneBlockEditor({
  block,
  presets,
  onChange,
  onTextChange
}: {
  block: SceneBlock;
  presets: CharacterPreset[];
  onChange: (block: SceneBlock) => void;
  onTextChange: (block: SceneBlock) => void;
}) {
  const [isCharacterPickerOpen, setIsCharacterPickerOpen] = useState(false);
  const [isSceneSampleOpen, setIsSceneSampleOpen] = useState(false);
  const [expandedProfileGroupIds, setExpandedProfileGroupIds] = useState<Set<string>>(() => loadStringSet(PROFILE_GROUP_EXPANDED_STORAGE_KEY));
  const toggleProfileGroup = (groupId: string) => {
    setExpandedProfileGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      saveStringSet(PROFILE_GROUP_EXPANDED_STORAGE_KEY, next);
      return next;
    });
  };

  if (block.type === "sceneHeader") {
    const selectedSample = SCENE_BACKGROUND_SAMPLES.find((sample) => sample.fullSrc === block.imageData) ?? null;
    return (
      <div className="fieldGrid">
        <input value={block.sceneNumber} onChange={(event) => onTextChange({ ...block, sceneNumber: event.target.value })} placeholder="SCENE 01" />
        <RichTextArea value={block.title} rows={2} onChange={(title) => onTextChange({ ...block, title })} />
        <input value={block.imageLabel} onChange={(event) => onTextChange({ ...block, imageLabel: event.target.value })} placeholder="이미지 라벨" />
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
              readImageFile(file, (imageData) => onChange(withSceneHeaderImage(block, imageData)), SCENE_IMAGE_OPTIONS);
            }}
          />
        </label>
        {block.imageData ? (
          <button type="button" className="danger" onClick={() => onChange(withSceneHeaderImage(block, undefined))}>
            <Trash2 size={15} />
            이미지 제거
          </button>
        ) : null}
        {block.imageData ? (
          <div className="sceneImagePreview">
            <img src={block.imageData} alt={block.imageLabel || block.title || "Scene image"} loading="lazy" decoding="async" />
            <div className="sceneImagePreviewMeta">
              <strong>{selectedSample ? "현재 선택된 배경 샘플" : "현재 장면 이미지"}</strong>
              <span>{selectedSample ? "기본 제공 배경 샘플이 적용되어 있습니다." : "업로드한 장면 이미지를 사용 중입니다."}</span>
            </div>
          </div>
        ) : null}
        <div className="sceneSampleSection">
          <button type="button" className="sceneSampleToggle" onClick={() => setIsSceneSampleOpen((current) => !current)}>
            <strong>배경 샘플</strong>
            <span>{isSceneSampleOpen ? "접기" : "펼치기"}</span>
            {isSceneSampleOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {isSceneSampleOpen ? (
            <>
              <div className="sceneSampleHeader">
                <span>썸네일만 먼저 불러오고, 클릭했을 때 실제 배경 이미지를 적용합니다.</span>
              </div>
              <div className="sceneSampleGrid">
                {SCENE_BACKGROUND_SAMPLES.map((sample) => {
                  const isActive = sample.fullSrc === block.imageData;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      className={`sceneSampleTile${isActive ? " active" : ""}`}
                      onClick={() => onChange(withSceneHeaderImage(block, sample.fullSrc))}
                      title={sample.name}
                    >
                      <img
                        src={sample.thumbnailSrc}
                        alt={sample.name}
                        loading="lazy"
                        decoding="async"
                        style={{ aspectRatio: `${sample.width} / ${sample.height}` }}
                      />
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
        <RichTextArea value={block.desc} rows={4} onChange={(desc) => onTextChange({ ...block, desc })} />
      </div>
    );
  }

  if (block.type === "character") {
    const selectedCharacterId = normalizeCharacterId(block.characterId);
    const selectedPreset = presets.find((preset) => preset.id === selectedCharacterId) ?? presets[0];
    const selectedImageData = selectedPreset?.markImageData || selectedPreset?.imageData;
    const profileGroups = getCharacterImagePresetGroups(selectedPreset);
    return (
      <div className="fieldGrid">
        <div className="characterPicker">
          <button type="button" className="characterPickerButton" onClick={() => setIsCharacterPickerOpen((current) => !current)}>
            <span className="characterPickerImage" style={{ borderColor: selectedPreset?.ring }}>
              {selectedImageData ? <img src={selectedImageData} alt="" /> : selectedPreset?.name.slice(0, 2)}
            </span>
            <span className="characterPickerText">
              <span>{selectedPreset?.name ?? "캐릭터 선택"}</span>
            </span>
            <ChevronDown size={15} />
          </button>
          {isCharacterPickerOpen ? (
            <div className="characterSelectGrid">
              {presets.map((preset) => {
                const imageData = preset.markImageData || preset.imageData;
                const isSelected = preset.id === selectedCharacterId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`characterSelectCard${isSelected ? " active" : ""}`}
                    onClick={() => {
                      onChange({ ...block, characterId: preset.id, imagePresetId: undefined });
                      setIsCharacterPickerOpen(false);
                    }}
                    title={preset.prisonerNumber ? `${preset.prisonerNumber} ${preset.name}` : preset.name}
                  >
                    <span className="characterSelectImage" style={{ borderColor: preset.ring }}>
                      {imageData ? <img src={imageData} alt="" /> : preset.name.slice(0, 2)}
                    </span>
                    <span className="characterSelectName">
                      <span>{preset.name}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {profileGroups.length ? (
          <div className="profileImageFolders">
            <button type="button" className={`profileImageTile default${block.imagePresetId ? "" : " active"}`} onClick={() => onChange({ ...block, imagePresetId: undefined })}>
              <span className="profileImageTilePreview" style={{ borderColor: selectedPreset?.ring }}>
                {selectedPreset?.imageData ? <img src={selectedPreset.imageData} alt="" /> : selectedPreset?.name.slice(0, 2)}
              </span>
              <span>기본</span>
              {selectedPreset?.imageData ? (
                <span className="imageHoverPreview" aria-hidden="true">
                  <img src={selectedPreset.imageData} alt="" />
                </span>
              ) : null}
            </button>
            {profileGroups.map((group) => {
              const isExpanded = expandedProfileGroupIds.has(group.id);
              return (
                <section className="profileImageFolder" key={group.id}>
                  <button type="button" className="profileImageFolderHeader" onClick={() => toggleProfileGroup(group.id)}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span>{group.name}</span>
                    <small>{group.presets.length}</small>
                  </button>
                  {isExpanded ? (
                    <div className="profileImageGrid">
                      {group.presets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`profileImageTile${block.imagePresetId === preset.id ? " active" : ""}`}
                          onClick={() => onChange({ ...block, imagePresetId: preset.id })}
                          title={`${group.name} / ${preset.name}`}
                        >
                          <span className="profileImageTilePreview" style={{ borderColor: selectedPreset?.ring }}>
                            {preset.imageData ? <img src={preset.imageData} alt="" /> : preset.name.slice(0, 2)}
                          </span>
                          {preset.imageData ? (
                            <span className="imageHoverPreview" aria-hidden="true">
                              <img src={preset.imageData} alt="" />
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : null}
        <input value={block.role ?? ""} onChange={(event) => onTextChange({ ...block, role: event.target.value })} placeholder="역할/라벨" />
        <RichTextArea value={block.text} rows={4} onChange={(text) => onTextChange({ ...block, text })} />
      </div>
    );
  }

  if (block.type === "tikitaka") {
    return (
      <div className="fieldGrid">
        <input value={block.title} onChange={(event) => onTextChange({ ...block, title: event.target.value })} placeholder="제목" />
        {block.lines.map((line, index) => (
          <div className="lineEditorRich" key={line.id}>
            <div className="lineMeta">
              <input
                value={line.speaker}
                onChange={(event) =>
                  onTextChange({ ...block, lines: block.lines.map((item) => (item.id === line.id ? { ...item, speaker: event.target.value } : item)) })
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
                onTextChange({ ...block, lines: block.lines.map((item) => (item.id === line.id ? { ...item, text } : item)) })
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
        <input value={block.title} onChange={(event) => onTextChange({ ...block, title: event.target.value })} placeholder="참고 제목" />
        <TextArea value={block.text} rows={5} onChange={(text) => onTextChange({ ...block, text })} />
      </div>
    );
  }

  return (
    <div className="fieldGrid">
      <input value={block.title} onChange={(event) => onTextChange({ ...block, title: event.target.value })} placeholder="제목" />
      <RichTextArea value={block.text} rows={4} onChange={(text) => onTextChange({ ...block, text })} />
    </div>
  );
}, (prev, next) => prev.block === next.block && prev.presets === next.presets);

const SceneEditor = React.memo(function SceneEditor({
  scene,
  presets,
  fontPreset,
  onChange,
  onTextChange,
  onBlockChange,
  onTextBlockChange,
  showReferences,
  collapsedIds,
  highlightedBlockId,
  onToggleCollapse,
  onPreviewJump,
  registerEditorBlock
}: {
  scene: SceneCardData;
  presets: CharacterPreset[];
  fontPreset: FontPresetId;
  onChange: (scene: SceneCardData) => void;
  onTextChange: (scene: SceneCardData) => void;
  onBlockChange: (sceneId: string, blockId: string, block: SceneBlock) => void;
  onTextBlockChange: (sceneId: string, blockId: string, block: SceneBlock) => void;
  showReferences: boolean;
  collapsedIds: Set<string>;
  highlightedBlockId: string | null;
  onToggleCollapse: (id: string) => void;
  onPreviewJump: (id: string) => void;
  registerEditorBlock: (id: string, node: HTMLElement | null) => void;
}) {
  const defaultCharacterId = presets[0]?.id ?? "etc";
  const moveSceneBlockByDrop = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (!payload || payload.scope !== "scene" || payload.sceneId !== scene.id) return;
    const sourceIndex = scene.blocks.findIndex((item) => item.id === payload.id);
    if (sourceIndex === -1 || sourceIndex === targetIndex) return;
    onChange({ ...scene, blocks: moveArrayItemTo(scene.blocks, sourceIndex, targetIndex) });
  };

  return (
    <section className="sceneEditor">
      <input className="sceneName" value={scene.name} onChange={(event) => onTextChange({ ...scene, name: event.target.value })} />
      <div className="addRow">
        {(["sceneHeader", "character", "narration", "afterword", "tikitaka", "reference"] as SceneBlockType[]).map((type) => (
          <button key={type} type="button" onClick={() => onChange({ ...scene, blocks: [...scene.blocks, createSceneBlock(type, defaultCharacterId, fontPreset)] })}>
            <Plus size={14} />
            {SCENE_BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
      {scene.blocks.map((block, index) =>
        block.type === "reference" && !showReferences ? null : (
          <div
            className={`blockEditor${collapsedIds.has(block.id) ? " collapsed" : ""}${highlightedBlockId === block.id ? " jumpTarget" : ""}`}
            key={block.id}
            ref={(node) => registerEditorBlock(block.id, node)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => moveSceneBlockByDrop(event, index)}
          >
            <div className="blockHeader">
              <strong>
                <span
                  className="dragHandle"
                  draggable
                  title="드래그로 이동"
                  onDragStart={(event) => writeDragPayload(event, { scope: "scene", sceneId: scene.id, id: block.id })}
                >
                  <GripVertical size={15} />
                </span>
                {SCENE_BLOCK_LABELS[block.type]}
              </strong>
              <div>
                <button type="button" className="iconButton" onClick={() => onToggleCollapse(block.id)} title={collapsedIds.has(block.id) ? "펼치기" : "접기"}>
                  {collapsedIds.has(block.id) ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                </button>
                <button type="button" className="iconButton" onClick={() => onChange({ ...scene, blocks: moveArrayItem(scene.blocks, index, -1) })}>
                  <ArrowUp size={15} />
                </button>
                <button type="button" className="iconButton" onClick={() => onPreviewJump(block.id)} title="미리보기에서 이 블럭 보기">
                  <Eye size={15} />
                </button>
                <button type="button" className="iconButton" onClick={() => onChange({ ...scene, blocks: moveArrayItem(scene.blocks, index, 1) })}>
                  <ArrowDown size={15} />
                </button>
                <button type="button" className="iconButton danger" onClick={() => onChange({ ...scene, blocks: scene.blocks.filter((item) => item.id !== block.id) })}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            {collapsedIds.has(block.id) ? null : (
              <SceneBlockEditor
                block={block}
                presets={presets}
                onChange={(nextBlock) => onBlockChange(scene.id, block.id, nextBlock)}
                onTextChange={(nextBlock) => onTextBlockChange(scene.id, block.id, nextBlock)}
              />
            )}
          </div>
        )
      )}
    </section>
  );
}, (prev, next) =>
  prev.scene === next.scene &&
  prev.presets === next.presets &&
  prev.showReferences === next.showReferences &&
  prev.collapsedIds === next.collapsedIds &&
  prev.highlightedBlockId === next.highlightedBlockId
);

export default function TheaterToolBuilder() {
  const [data, setData] = useState<TheaterData>(() => getInitialDefaultData());
  const [history, setHistory] = useState<TheaterData[]>([]);
  const [future, setFuture] = useState<TheaterData[]>([]);
  const [presets, setPresets] = useState<CharacterPreset[]>(() => getInitialDefaultPresets());
  const [roomInput, setRoomInput] = useState(() => loadInitialRoomCode());
  const [activeRoomCode, setActiveRoomCode] = useState(() => loadInitialRoomCode());
  const [templates, setTemplates] = useState<SavedTemplateSummary[]>([]);
  const [trashedTemplates, setTrashedTemplates] = useState<SavedTemplateSummary[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [isTemplateListExpanded, setIsTemplateListExpanded] = useState(() => loadBoolean(TEMPLATE_LIST_EXPANDED_STORAGE_KEY, false));
  const [isTrashExpanded, setIsTrashExpanded] = useState(() => loadBoolean(TEMPLATE_TRASH_EXPANDED_STORAGE_KEY, false));
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesMessage, setTemplatesMessage] = useState("");
  const [characterPresetLibraryMeta, setCharacterPresetLibraryMeta] = useState<CharacterPresetLibraryMeta | null>(null);
  const [roomStorageUsage, setRoomStorageUsage] = useState<RoomStorageUsage | null>(null);
  const [imageStorageUsage, setImageStorageUsage] = useState<ImageStorageUsage | null>(null);
  const [characterLibraryLoading, setCharacterLibraryLoading] = useState(false);
  const [characterLibraryMessage, setCharacterLibraryMessage] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [editorPercent, setEditorPercent] = useState(52);
  const [isResizing, setIsResizing] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("blackGold");
  const [showReferences, setShowReferences] = useState(true);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [highlightedEditorBlockId, setHighlightedEditorBlockId] = useState<string | null>(null);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const editorBlockRefs = useRef(new Map<string, HTMLElement>());
  const jumpHighlightTimerRef = useRef<number | null>(null);
  const previewScrollRef = useRef({ x: 0, y: 0 });
  const hydratedRoomRef = useRef<string | null>(null);
  const dataRef = useRef(data);
  const pendingTextUndoSnapshotRef = useRef<TheaterData | null>(null);
  const textUndoTimerRef = useRef<number | null>(null);
  const [previewBody, setPreviewBody] = useState(() => renderPreviewBody(data, presets));
  const [previewCss, setPreviewCss] = useState(() => renderCss(data));
  const isActivePublicRoom = isPublicSampleRoom(activeRoomCode);
  const characterLibraryUsageBytes = useMemo(() => getCharacterLibraryBytes(presets), [presets]);
  const characterLibraryLimitBytes = roomStorageUsage?.characterLibraryLimitBytes ?? CHARACTER_LIBRARY_LIMIT_BYTES;
  const currentTemplateBytes = useMemo(() => getTemplateBytes(data, presets), [data, presets]);
  const currentTemplateLimitBytes = roomStorageUsage?.maxTemplateBytes || TEMPLATE_LIMIT_BYTES;
  const currentTemplateRatio = Math.min(100, Math.round((currentTemplateBytes / currentTemplateLimitBytes) * 100));
  const imageStorageLimitBytes = imageStorageUsage?.imageLimitBytes ?? ROOM_IMAGE_LIMIT_BYTES;
  const imageStorageRatio = imageStorageUsage ? Math.min(100, Math.round((imageStorageUsage.imageBytes / imageStorageLimitBytes) * 100)) : 0;
  const isImageStorageTooLarge = Boolean(imageStorageUsage && imageStorageUsage.imageBytes > imageStorageLimitBytes);
  const isCurrentTemplateTooLarge = currentTemplateBytes > currentTemplateLimitBytes;
  const hiddenTemplateCount = Math.max(0, (roomStorageUsage?.templatesCount ?? templates.length) - templates.length);
  const hiddenTrashCount = Math.max(0, (roomStorageUsage?.trashedTemplatesCount ?? trashedTemplates.length) - trashedTemplates.length);
  const buildTemplateRequestOptions = (overrides?: { includeAllTemplates?: boolean; includeTrash?: boolean; includeActivity?: boolean }) => ({
    templateLimit: (overrides?.includeAllTemplates ?? isTemplateListExpanded) ? "0" : "5",
    includeTrash: (overrides?.includeTrash ?? isTrashExpanded) ? "1" : "0",
    includeActivity: (overrides?.includeActivity ?? true) ? "1" : "0"
  });
  const toggleCollapsed = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const registerEditorBlock = (id: string, node: HTMLElement | null) => {
    if (node) editorBlockRefs.current.set(id, node);
    else editorBlockRefs.current.delete(id);
  };
  const flashEditorBlock = (id: string) => {
    if (jumpHighlightTimerRef.current !== null) window.clearTimeout(jumpHighlightTimerRef.current);
    setHighlightedEditorBlockId(id);
    jumpHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightedEditorBlockId((current) => (current === id ? null : current));
      jumpHighlightTimerRef.current = null;
    }, 1200);
  };
  const scrollEditorBlockIntoView = (id: string) => {
    const target = editorBlockRefs.current.get(id);
    if (!target) {
      const parentScene = dataRef.current.blocks.find((block) => isSceneCard(block) && block.blocks.some((sceneBlock) => sceneBlock.id === id));
      if (parentScene) {
        setCollapsedIds((current) => {
          if (!current.has(parentScene.id) && !current.has(id)) return current;
          const next = new Set(current);
          next.delete(parentScene.id);
          next.delete(id);
          return next;
        });
        window.requestAnimationFrame(() => scrollEditorBlockIntoView(id));
      }
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    flashEditorBlock(id);
  };
  const flashPreviewBlock = (doc: Document, id: string) => {
    const targets = Array.from(doc.querySelectorAll<HTMLElement>("[data-preview-block-id]")).filter((node) => node.dataset.previewBlockId === id);
    targets.forEach((target) => target.classList.add("preview-target-flash"));
    window.setTimeout(() => targets.forEach((target) => target.classList.remove("preview-target-flash")), 1200);
  };
  const scrollPreviewBlockIntoView = (id: string) => {
    const doc = previewRef.current?.contentDocument;
    if (!doc) return;
    const target = Array.from(doc.querySelectorAll<HTMLElement>("[data-preview-block-id]")).find((node) => node.dataset.previewBlockId === id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    flashPreviewBlock(doc, id);
  };
  const collapseAllBlocks = () => setCollapsedIds(new Set(collectCollapsibleBlockIds(data)));
  const expandAllBlocks = () => setCollapsedIds(new Set());
  const movePageBlockByDrop = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (!payload || payload.scope !== "page") return;
    commitData((current) => {
      const sourceIndex = current.blocks.findIndex((block) => block.id === payload.id);
      if (sourceIndex === -1 || sourceIndex === targetIndex) return current;
      return { ...current, blocks: moveArrayItemTo(current.blocks, sourceIndex, targetIndex) };
    });
  };
  const refreshImageStorageUsage = async (roomCode: string) => {
    try {
      setImageStorageUsage(await requestImageUsage(roomCode));
    } catch {
      setImageStorageUsage(null);
    }
  };

  const clearPendingTextUndo = () => {
    pendingTextUndoSnapshotRef.current = null;
    if (textUndoTimerRef.current !== null) {
      window.clearTimeout(textUndoTimerRef.current);
      textUndoTimerRef.current = null;
    }
  };

  const flushPendingTextUndo = () => {
    const snapshot = pendingTextUndoSnapshotRef.current;
    clearPendingTextUndo();
    if (!snapshot) return;
    setHistory((items) => [...items.slice(-79), snapshot]);
    setFuture([]);
  };

  const applyTemplatesPayload = (payload: Pick<TemplatesApiPayload, "templates" | "trashedTemplates" | "activityLog" | "characterPresetLibraryMeta" | "usage">) => {
    setTemplates(payload.templates);
    setTrashedTemplates(payload.trashedTemplates);
    setActivityLog(payload.activityLog);
    setCharacterPresetLibraryMeta(payload.characterPresetLibraryMeta);
    setRoomStorageUsage(payload.usage);
  };

  const refreshTemplateSidebar = async (
    roomCode: string,
    overrides?: { includeAllTemplates?: boolean; includeTrash?: boolean; includeActivity?: boolean }
  ) => {
    const payload = await requestTemplates("GET", roomCode, undefined, buildTemplateRequestOptions(overrides));
    applyTemplatesPayload(payload);
    return payload;
  };

  const scheduleTextUndoFlush = () => {
    if (textUndoTimerRef.current !== null) window.clearTimeout(textUndoTimerRef.current);
    textUndoTimerRef.current = window.setTimeout(() => {
      textUndoTimerRef.current = null;
      flushPendingTextUndo();
    }, 900);
  };

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    saveBoolean(TEMPLATE_LIST_EXPANDED_STORAGE_KEY, isTemplateListExpanded);
  }, [isTemplateListExpanded]);

  useEffect(() => {
    saveBoolean(TEMPLATE_TRASH_EXPANDED_STORAGE_KEY, isTrashExpanded);
  }, [isTrashExpanded]);

  useEffect(() => {
    const roomCode = normalizeRoomCode(activeRoomCode);
    clearPendingTextUndo();
    hydratedRoomRef.current = null;
    if (!roomCode) {
      setHistory([]);
      setFuture([]);
      setData(getInitialDefaultData());
      setPresets(getInitialDefaultPresets());
      setTemplates([]);
      setTrashedTemplates([]);
      setActivityLog([]);
      setSelectedTemplateId(null);
      setSelectedTemplateName("");
      setTemplatesMessage("");
      setCharacterPresetLibraryMeta(null);
      setRoomStorageUsage(null);
      setImageStorageUsage(null);
      setCharacterLibraryMessage("");
      hydratedRoomRef.current = "";
      return;
    }

    if (isPublicSampleRoom(roomCode)) {
      clearRoomDraft(roomCode);
      let cancelled = false;
      setTemplatesLoading(true);
      const sampleLibrary = createCharacterPresetLibrary(CHARACTER_PRESETS);
      setHistory([]);
      setFuture([]);
      setData(getInitialDefaultData());
      setPresets(normalizeCharacterPresets(sampleLibrary.presets));
      setSelectedTemplateId(null);
      setSelectedTemplateName("");
      setTemplates(PUBLIC_SAMPLE_TEMPLATE_SUMMARIES);
      setTrashedTemplates([]);
      setActivityLog([]);
      setTemplatesMessage("000000은 읽기 전용 샘플 코드입니다. 목록에서 템플릿을 클릭하면 해당 샘플만 불러옵니다.");
      setCharacterPresetLibraryMeta({ updatedAt: sampleLibrary.updatedAt, bytes: getJsonByteLength(sampleLibrary) });
      setRoomStorageUsage({
        characterLibraryBytes: getJsonByteLength(sampleLibrary),
        characterLibraryLimitBytes: CHARACTER_LIBRARY_LIMIT_BYTES,
        templatesBytes: 0,
        templatesCount: PUBLIC_SAMPLE_TEMPLATE_SUMMARIES.length,
        trashedTemplatesCount: 0,
        maxTemplates: PUBLIC_SAMPLE_TEMPLATE_SUMMARIES.length,
        maxTemplateBytes: TEMPLATE_LIMIT_BYTES
      });
      setImageStorageUsage({ imageBytes: 0, imageCount: 0, missingImages: 0, imageLimitBytes: ROOM_IMAGE_LIMIT_BYTES });
      setCharacterLibraryMessage("공식 샘플 프리셋을 불러왔습니다.");
      hydratedRoomRef.current = roomCode;
      setTemplatesLoading(false);
      return;
    }

    let cancelled = false;
    setTemplatesLoading(true);
    setTemplatesMessage("템플릿을 불러오는 중입니다.");
    Promise.all([requestTemplates("GET", roomCode, undefined, buildTemplateRequestOptions()), requestImageUsage(roomCode)])
      .then(async ([{ templates: nextTemplates, trashedTemplates: nextTrashedTemplates, activityLog: nextActivityLog, characterPresetLibraryMeta: nextLibraryMeta, usage }, nextImageUsage]) => {
        if (cancelled) return;
        const draft = loadRoomDraft(roomCode);
        applyTemplatesPayload({
          templates: nextTemplates,
          trashedTemplates: nextTrashedTemplates,
          activityLog: nextActivityLog,
          characterPresetLibraryMeta: nextLibraryMeta,
          usage
        });
        setSelectedTemplateId(null);
        setSelectedTemplateName("");
        setImageStorageUsage(nextImageUsage);
        setCharacterLibraryMessage("");
        setHistory([]);
        setFuture([]);

        if (draft) {
          setData(draft.data);
          setPresets(draft.presets);
          setTemplatesMessage("마지막 작업 초안을 불러왔습니다.");
          hydratedRoomRef.current = roomCode;
          return;
        }

        if (nextTemplates.length) {
          const { template: firstTemplate } = await requestTemplates("GET", roomCode, undefined, { templateId: nextTemplates[0].id });
          if (cancelled) return;
          if (firstTemplate) {
            setData(normalizeTheaterData(hydrateDataImages(firstTemplate.data)));
            setPresets(normalizeCharacterPresets(hydratePresetImages(firstTemplate.presets)));
            setSelectedTemplateId(firstTemplate.id);
            setSelectedTemplateName(firstTemplate.name);
            setTemplatesMessage("1번 템플릿을 불러왔습니다.");
            hydratedRoomRef.current = roomCode;
            return;
          }
        }

        setData(getInitialDefaultData());
        setPresets(getInitialDefaultPresets());
        setTemplatesMessage("이 접속코드에는 아직 저장된 템플릿이 없습니다.");
        hydratedRoomRef.current = roomCode;
      })
      .catch((error) => {
        if (cancelled) return;
        setHistory([]);
        setFuture([]);
        setData(getInitialDefaultData());
        setPresets(getInitialDefaultPresets());
        setTemplates([]);
        setTrashedTemplates([]);
        setActivityLog([]);
        setSelectedTemplateId(null);
        setSelectedTemplateName("");
        setCharacterPresetLibraryMeta(null);
        setRoomStorageUsage(null);
        setImageStorageUsage(null);
        setCharacterLibraryMessage("");
        setTemplatesMessage(error instanceof Error ? error.message : "템플릿을 불러오지 못했습니다.");
        hydratedRoomRef.current = roomCode;
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoomCode]);

  useEffect(
    () => () => {
      clearPendingTextUndo();
      if (jumpHighlightTimerRef.current !== null) window.clearTimeout(jumpHighlightTimerRef.current);
    },
    []
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPreviewBody(renderPreviewBody(data, presets));
      setPreviewCss(renderCss(data));
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [data, presets]);

  useEffect(() => {
    const roomCode = normalizeRoomCode(activeRoomCode);
    if (!roomCode || hydratedRoomRef.current !== roomCode || isPublicSampleRoom(roomCode)) return;
    const timeoutId = window.setTimeout(() => {
      saveRoomDraft(roomCode, data, presets);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [activeRoomCode, data, presets]);

  const commitData = (next: TheaterData | ((current: TheaterData) => TheaterData), mode: CommitMode = "immediate") => {
    if (mode === "immediate") flushPendingTextUndo();
    setData((current) => {
      const resolved = typeof next === "function" ? (next as (current: TheaterData) => TheaterData)(current) : next;
      if (resolved === current) return current;
      if (mode === "textGroup") {
        if (!pendingTextUndoSnapshotRef.current) pendingTextUndoSnapshotRef.current = current;
        scheduleTextUndoFlush();
      } else {
        setHistory((items) => [...items.slice(-79), current]);
        setFuture([]);
      }
      return resolved;
    });
  };

  const undo = () => {
    flushPendingTextUndo();
    setHistory((items) => {
      if (items.length === 0) return items;
      const previous = items[items.length - 1];
      setFuture((futureItems) => [data, ...futureItems.slice(0, 79)]);
      setData(previous);
      return items.slice(0, -1);
    });
  };

  const redo = () => {
    flushPendingTextUndo();
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
      const { toPng } = await import("html-to-image");
      const { frame, doc, target } = await createCaptureFrame(exportHtml);
      captureFrame = frame;

      const rect = target.getBoundingClientRect();
      const measuredWidth = Math.ceil(rect.width || target.scrollWidth);
      const measuredHeight = Math.ceil(Math.max(target.scrollHeight, rect.height));
      const backgroundColor = doc.defaultView?.getComputedStyle(target).backgroundColor || "#0f0e0d";
      const devicePixelRatio = Math.min(2, window.devicePixelRatio || 1);
      const hardMaxChunkHeight = Math.max(2048, Math.floor(MAX_CAPTURE_CANVAS_HEIGHT / devicePixelRatio));
      const preferredMaxChunkHeight = Math.min(MAX_CAPTURE_CHUNK_HEIGHT, hardMaxChunkHeight);
      const preferredMinChunkHeight = Math.min(MIN_CAPTURE_CHUNK_HEIGHT, preferredMaxChunkHeight);
      const captureSlices = buildCaptureSlices(target, preferredMinChunkHeight, preferredMaxChunkHeight);
      const partCount = captureSlices.length;
      const pixelRatio = partCount > 1 ? devicePixelRatio : measuredHeight > 12000 ? 1 : devicePixelRatio;
      const captureStamp = makeCaptureStamp();

      for (let partIndex = 0; partIndex < captureSlices.length; partIndex += 1) {
        const slice = captureSlices[partIndex];
        applyCaptureSliceViewport(doc, target, slice);
        frame.style.height = `${slice.height}px`;
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        const width = measuredWidth;
        const height = slice.height;
        const chunkPixelRatio = Math.min(pixelRatio, Math.max(1, MAX_CAPTURE_CANVAS_HEIGHT / height));
        const dataUrl = await toPng(target, {
          cacheBust: true,
          pixelRatio: chunkPixelRatio,
          width,
          height,
          canvasWidth: width,
          canvasHeight: height,
          backgroundColor,
          style: {
            width: `${width}px`,
            minHeight: `${height}px`,
            height: `${height}px`,
            overflow: "visible"
          }
        });

        downloadDataUrl(makeCaptureFilename(captureStamp, partIndex + 1, partCount), dataUrl);
        if (partCount > 1 && partIndex < partCount - 1) {
          await new Promise<void>((resolve) => window.setTimeout(() => resolve(), 120));
        }
      }
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
      doc.documentElement.className = `theme-${theme}`;
      doc.body.className = `theme-${theme}`;
      doc.body.innerHTML = previewBody;
    }

    const getPreviewJumpTargetId = (event: MouseEvent) => {
      const directTarget = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-preview-block-id]") : null;
      if (directTarget?.dataset.previewBlockId) return directTarget.dataset.previewBlockId;
      return doc
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest<HTMLElement>("[data-preview-block-id]"))
        .find((element): element is HTMLElement => Boolean(element?.dataset.previewBlockId))
        ?.dataset.previewBlockId;
    };

    const handlePreviewJump = (event: MouseEvent) => {
      if (!event.ctrlKey) return;
      const blockId = getPreviewJumpTargetId(event);
      if (!blockId) return;
      event.preventDefault();
      event.stopPropagation();
      scrollEditorBlockIntoView(blockId);
    };

    doc.addEventListener("pointerdown", handlePreviewJump);

    const restoreScroll = () => {
      win.scrollTo(previewScrollRef.current.x, previewScrollRef.current.y);
    };

    window.requestAnimationFrame(restoreScroll);

    return () => doc.removeEventListener("pointerdown", handlePreviewJump);
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

  const updateBlockText = (id: string, nextBlock: PageBlock) => {
    commitData((current) => ({ ...current, blocks: current.blocks.map((block) => (block.id === id ? nextBlock : block)) }), "textGroup");
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

  const updateSceneBlockText = (sceneId: string, blockId: string, nextBlock: SceneBlock) => {
    commitData(
      (current) => ({
        ...current,
        blocks: current.blocks.map((block) => {
          if (block.id !== sceneId || !isSceneCard(block)) return block;
          return {
            ...block,
            blocks: block.blocks.map((sceneBlock) => (sceneBlock.id === blockId ? nextBlock : sceneBlock))
          };
        })
      }),
      "textGroup"
    );
  };

  const resetBodyFontSizes = () => {
    commitData((current) => ({
      ...current,
      blocks: current.blocks.map((block) => updatePageBlockFontSizes(block, { mode: "reset" }, normalizeFontPresetId(current.fontPreset)))
    }));
  };

  const shiftBodyFontSizes = (delta: -1 | 1) => {
    commitData((current) => ({
      ...current,
      blocks: current.blocks.map((block) => updatePageBlockFontSizes(block, { mode: "shift", delta }, normalizeFontPresetId(current.fontPreset)))
    }));
  };

  const resetLabelFontSizes = () => {
    commitData((current) => ({
      ...current,
      labelFontSizes: getDefaultLabelFontSizes()
    }));
  };

  const shiftLabelFontSizes = (delta: -1 | 1) => {
    commitData((current) => ({
      ...current,
      labelFontSizes: shiftLabelFontSizesByDelta(
        normalizeLabelFontSizes(current.labelFontSizes, current.labelFontOffset, normalizeFontPresetId(current.fontPreset)),
        delta
      )
    }));
  };

  const resetPortraitSize = () => {
    commitData((current) => ({
      ...current,
      portraitSize: DEFAULT_PORTRAIT_SIZE
    }));
  };

  const shiftPortraitSize = (delta: -1 | 1) => {
    commitData((current) => ({
      ...current,
      portraitSize: clampPortraitSize((current.portraitSize ?? DEFAULT_PORTRAIT_SIZE) + delta * 4)
    }));
  };

  const applyDialogueColorMode = (mode: "reset" | "personal") => {
    commitData((current) => ({
      ...current,
      blocks: current.blocks.map((block) => updatePageBlockDialogueColors(block, mode))
    }));
  };

  const applyFontPreset = (presetId: FontPresetId) => {
    commitData((current) => ({
      ...current,
      fontPreset: presetId,
      blocks: current.blocks.map((block) => updatePageBlockFontSizes(block, { mode: "reset" }, presetId)),
      labelFontSizes: getDefaultLabelFontSizes(presetId)
    }));
  };

  const resetTemplateToDefaults = () => {
    if (!window.confirm("현재 편집 내용을 기본 템플릿으로 초기화할까요? 저장된 템플릿 목록은 삭제되지 않습니다.")) return;
    commitData(getInitialDefaultData());
    setPresets(getInitialDefaultPresets());
    setTemplatesMessage("기본 템플릿으로 초기화했습니다.");
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
    setTrashedTemplates([]);
    setActivityLog([]);
    setSelectedTemplateId(null);
    setSelectedTemplateName("");
    setTemplatesMessage("");
    setCharacterPresetLibraryMeta(null);
    setRoomStorageUsage(null);
    setCharacterLibraryMessage("");
  };

  const toggleTemplateListExpanded = async () => {
    const next = !isTemplateListExpanded;
    setIsTemplateListExpanded(next);
    const roomCode = normalizeRoomCode(activeRoomCode);
    if (!roomCode || isPublicSampleRoom(roomCode)) return;
    try {
      await refreshTemplateSidebar(roomCode, { includeAllTemplates: next });
    } catch (error) {
      setTemplatesMessage(error instanceof Error ? error.message : "템플릿 목록을 불러오지 못했습니다.");
    }
  };

  const toggleTrashExpanded = async () => {
    const next = !isTrashExpanded;
    setIsTrashExpanded(next);
    const roomCode = normalizeRoomCode(activeRoomCode);
    if (!roomCode || isPublicSampleRoom(roomCode)) return;
    try {
      await refreshTemplateSidebar(roomCode, { includeTrash: next });
    } catch (error) {
      setTemplatesMessage(error instanceof Error ? error.message : "휴지통을 불러오지 못했습니다.");
    }
  };

  const saveCurrentTemplate = async () => {
    const roomCode = normalizeRoomCode(activeRoomCode);
    const error = validateRoomCode(roomCode);
    if (error) {
      setTemplatesMessage(error);
      return;
    }
    if (isPublicSampleRoom(roomCode)) {
      setTemplatesMessage("000000 샘플 코드는 읽기 전용이라 저장할 수 없습니다. 개인 코드를 만들어 저장하세요.");
      return;
    }
    if (isCurrentTemplateTooLarge) {
      setTemplatesMessage(`현재 회차가 ${formatBytes(currentTemplateLimitBytes)}를 넘어서 저장할 수 없습니다. 이미지나 프리셋을 줄여주세요.`);
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
    const nextTemplateBytes = getJsonByteLength(nextTemplate);
    if (nextTemplateBytes > currentTemplateLimitBytes) {
      setTemplatesMessage(`현재 회차가 ${formatBytes(currentTemplateLimitBytes)}를 넘어서 저장할 수 없습니다. 이미지나 프리셋을 줄여주세요.`);
      return;
    }
    setTemplatesLoading(true);
    setTemplatesMessage("템플릿을 저장하는 중입니다.");
    try {
      const payload = await requestTemplates("POST", roomCode, { template: nextTemplate }, buildTemplateRequestOptions());
      applyTemplatesPayload(payload);
      await refreshImageStorageUsage(roomCode);
      setTemplatesMessage("저장했습니다.");
    } catch (saveError) {
      setTemplatesMessage(saveError instanceof Error ? saveError.message : "템플릿 저장에 실패했습니다.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const saveCurrentTemplateWithImages = async (mode: "create" | "update" = "create") => {
    const roomCode = normalizeRoomCode(activeRoomCode);
    const error = validateRoomCode(roomCode);
    if (error) {
      setTemplatesMessage(error);
      return;
    }
    if (isPublicSampleRoom(roomCode)) {
      setTemplatesMessage("000000 샘플 코드는 읽기 전용이라 저장할 수 없습니다. 개인 코드를 만들어 저장하세요.");
      return;
    }
    if (isCurrentTemplateTooLarge) {
      setTemplatesMessage(`현재 회차가 ${formatBytes(currentTemplateLimitBytes)}를 넘어서 저장할 수 없습니다. 이미지나 프리셋을 줄여주세요.`);
      return;
    }

    const isUpdate = mode === "update" && Boolean(selectedTemplateId);
    if (mode === "update" && !selectedTemplateId) {
      setTemplatesMessage("먼저 템플릿을 불러오거나 새 템플릿으로 저장한 뒤 덮어쓰기를 사용할 수 있습니다.");
      return;
    }

    const name = window.prompt(
      isUpdate ? "덮어쓸 템플릿 이름을 확인하세요." : "저장할 템플릿 이름을 입력하세요.",
      isUpdate ? selectedTemplateName || getDefaultTemplateName(data) : getDefaultTemplateName(data)
    );
    if (!name?.trim()) return;

    setTemplatesLoading(true);
    setTemplatesMessage(isUpdate ? "이미지를 정리하고 템플릿을 덮어쓰는 중입니다." : "이미지를 정리하고 템플릿을 저장하는 중입니다.");
    try {
      const upload = createLimitedImageUploader(roomCode);
      const [remoteData, remotePresets] = await Promise.all([prepareDataForRemote(data, roomCode, upload), preparePresetsForRemote(presets, roomCode, upload)]);
      const nextName = name.trim();
      const nextTemplate: SavedTemplate = {
        id: isUpdate ? selectedTemplateId! : makeId(),
        name: nextName,
        createdAt: new Date().toISOString(),
        data: remoteData,
        presets: remotePresets
      };
      const nextTemplateBytes = getJsonByteLength(nextTemplate);
      if (nextTemplateBytes > currentTemplateLimitBytes) {
        setTemplatesMessage(`현재 회차가 ${formatBytes(currentTemplateLimitBytes)}를 넘어서 저장할 수 없습니다. 이미지나 프리셋을 줄여주세요.`);
        return;
      }
      const payload = await requestTemplates("POST", roomCode, { template: nextTemplate }, buildTemplateRequestOptions());
      setData(normalizeTheaterData(hydrateDataImages(remoteData)));
      setPresets(normalizeCharacterPresets(hydratePresetImages(remotePresets)));
      setSelectedTemplateId(nextTemplate.id);
      setSelectedTemplateName(nextName);
      applyTemplatesPayload(payload);
      await refreshImageStorageUsage(roomCode);
      setTemplatesMessage(isUpdate ? "덮어써서 저장했습니다." : "저장했습니다.");
    } catch (saveError) {
      setTemplatesMessage(saveError instanceof Error ? saveError.message : "템플릿 저장에 실패했습니다.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadTemplate = async (template: SavedTemplateSummary) => {
    const roomCode = normalizeRoomCode(activeRoomCode);
    if (isPublicSampleRoom(roomCode)) {
      setTemplatesLoading(true);
      setTemplatesMessage("샘플 템플릿을 불러오는 중입니다.");
      try {
        const sampleTemplate = await loadPublicSampleTemplate(template.id);
        if (!sampleTemplate) {
          setTemplatesMessage("샘플 템플릿을 찾을 수 없습니다.");
          return;
        }
        commitData(normalizeTheaterData(sampleTemplate.data));
        setPresets(normalizeCharacterPresets(sampleTemplate.presets));
        setSelectedTemplateId(sampleTemplate.id);
        setSelectedTemplateName(sampleTemplate.name);
        setTemplatesMessage("");
      } catch (loadError) {
        setTemplatesMessage(loadError instanceof Error ? loadError.message : "샘플 템플릿을 불러오지 못했습니다.");
      } finally {
        setTemplatesLoading(false);
      }
      return;
    }

    setTemplatesLoading(true);
    setTemplatesMessage("템플릿을 불러오는 중입니다.");
    try {
      const { template: loadedTemplate } = await requestTemplates("GET", roomCode, undefined, { templateId: template.id });
      if (!loadedTemplate) {
        setTemplatesMessage("템플릿을 찾을 수 없습니다.");
        return;
      }
      commitData(normalizeTheaterData(hydrateDataImages(loadedTemplate.data)));
      setPresets(normalizeCharacterPresets(hydratePresetImages(loadedTemplate.presets)));
      setSelectedTemplateId(loadedTemplate.id);
      setSelectedTemplateName(loadedTemplate.name);
      setTemplatesMessage("");
    } catch (loadError) {
      setTemplatesMessage(loadError instanceof Error ? loadError.message : "템플릿 불러오기에 실패했습니다.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!window.confirm("이 템플릿을 삭제할까요?")) return;
    const roomCode = normalizeRoomCode(activeRoomCode);
    if (isPublicSampleRoom(roomCode)) {
      setTemplatesMessage("000000 샘플 코드는 읽기 전용이라 삭제할 수 없습니다.");
      return;
    }
    setTemplatesLoading(true);
    setTemplatesMessage("템플릿을 삭제하는 중입니다.");
    try {
      const payload = await requestTemplates("DELETE", roomCode, { templateId }, buildTemplateRequestOptions());
      applyTemplatesPayload(payload);
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
        setSelectedTemplateName("");
      }
      await refreshImageStorageUsage(roomCode);
      setTemplatesMessage(payload.templates.length ? "삭제했습니다." : "이 접속코드에는 아직 저장된 템플릿이 없습니다.");
    } catch (deleteError) {
      setTemplatesMessage(deleteError instanceof Error ? deleteError.message : "템플릿 삭제에 실패했습니다.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const restoreTemplate = async (templateId: string) => {
    const roomCode = normalizeRoomCode(activeRoomCode);
    if (isPublicSampleRoom(roomCode)) {
      setTemplatesMessage("000000 샘플 코드는 읽기 전용이라 복구할 수 없습니다.");
      return;
    }
    setTemplatesLoading(true);
    setTemplatesMessage("템플릿을 복구하는 중입니다.");
    try {
      const payload = await requestTemplates("POST", roomCode, { restoreTemplateId: templateId }, buildTemplateRequestOptions());
      applyTemplatesPayload(payload);
      await refreshImageStorageUsage(roomCode);
      setTemplatesMessage("복구했습니다.");
    } catch (restoreError) {
      setTemplatesMessage(restoreError instanceof Error ? restoreError.message : "템플릿 복구에 실패했습니다.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const restoreLatestTemplateVersion = async (templateId: string) => {
    if (!window.confirm("이 템플릿을 직전 버전으로 되돌릴까요?")) return;
    const roomCode = normalizeRoomCode(activeRoomCode);
    if (isPublicSampleRoom(roomCode)) {
      setTemplatesMessage("000000 샘플 코드는 읽기 전용이라 되돌릴 수 없습니다.");
      return;
    }
    setTemplatesLoading(true);
    setTemplatesMessage("이전 버전으로 되돌리는 중입니다.");
    try {
      const payload = await requestTemplates("POST", roomCode, { restoreVersionTemplateId: templateId }, buildTemplateRequestOptions());
      applyTemplatesPayload(payload);
      await refreshImageStorageUsage(roomCode);
      setTemplatesMessage("이전 버전으로 되돌렸습니다.");
    } catch (restoreError) {
      setTemplatesMessage(restoreError instanceof Error ? restoreError.message : "이전 버전 복원에 실패했습니다.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const saveCharacterPresetLibrary = async () => {
    const roomCode = normalizeRoomCode(activeRoomCode);
    const error = validateRoomCode(roomCode);
    if (error) {
      setCharacterLibraryMessage(error);
      return;
    }
    if (isPublicSampleRoom(roomCode)) {
      setCharacterLibraryMessage("000000 샘플 코드는 읽기 전용이라 캐릭터 프리셋을 저장할 수 없습니다.");
      return;
    }

    const nextLibrary = createCharacterPresetLibrary(presets);
    const nextLibraryBytes = getJsonByteLength(nextLibrary);
    if (nextLibraryBytes > CHARACTER_LIBRARY_LIMIT_BYTES) {
      setCharacterLibraryMessage(`캐릭터 프리셋 사용량이 ${formatBytes(CHARACTER_LIBRARY_LIMIT_BYTES)}를 넘었습니다. 이미지를 줄이거나 프리셋을 삭제하세요.`);
      return;
    }

    setCharacterLibraryLoading(true);
    setCharacterLibraryMessage("캐릭터 프리셋을 저장하는 중입니다.");
    try {
      const payload = await requestTemplates("POST", roomCode, {
        characterPresetLibrary: nextLibrary
      }, buildTemplateRequestOptions());
      applyTemplatesPayload(payload);
      setCharacterPresetLibraryMeta(payload.characterPresetLibraryMeta ?? { updatedAt: nextLibrary.updatedAt, bytes: getJsonByteLength(nextLibrary) });
      await refreshImageStorageUsage(roomCode);
      setCharacterLibraryMessage("캐릭터 프리셋을 저장했습니다.");
    } catch (saveError) {
      setCharacterLibraryMessage(saveError instanceof Error ? saveError.message : "캐릭터 프리셋 저장에 실패했습니다.");
    } finally {
      setCharacterLibraryLoading(false);
    }
  };

  const saveCharacterPresetLibraryWithImages = async (sourcePresets: CharacterPreset[] = presets, silent = false) => {
    const roomCode = normalizeRoomCode(activeRoomCode);
    const error = validateRoomCode(roomCode);
    if (error) {
      setCharacterLibraryMessage(error);
      return;
    }
    if (isPublicSampleRoom(roomCode)) {
      setCharacterLibraryMessage("000000 샘플 코드는 읽기 전용이라 캐릭터 프리셋을 저장할 수 없습니다.");
      return;
    }

    setCharacterLibraryLoading(true);
    setCharacterLibraryMessage(silent ? "프리셋 변경을 저장하는 중입니다." : "이미지를 정리하고 캐릭터 프리셋을 저장하는 중입니다.");
    try {
      const upload = createLimitedImageUploader(roomCode);
      const remotePresets = await preparePresetsForRemote(sourcePresets, roomCode, upload);
      const nextLibrary = createCharacterPresetLibrary(remotePresets);
      const nextLibraryBytes = getJsonByteLength(nextLibrary);
      if (nextLibraryBytes > CHARACTER_LIBRARY_LIMIT_BYTES) {
        setCharacterLibraryMessage(`캐릭터 프리셋 사용량이 ${formatBytes(CHARACTER_LIBRARY_LIMIT_BYTES)}를 넘었습니다. 이미지를 줄이거나 프리셋을 삭제하세요.`);
        return;
      }
      const payload = await requestTemplates("POST", roomCode, {
        characterPresetLibrary: nextLibrary
      }, buildTemplateRequestOptions());
      applyTemplatesPayload(payload);
      setCharacterPresetLibraryMeta(payload.characterPresetLibraryMeta ?? { updatedAt: nextLibrary.updatedAt, bytes: getJsonByteLength(nextLibrary) });
      await refreshImageStorageUsage(roomCode);
      setCharacterLibraryMessage(silent ? "프리셋 변경을 저장했습니다." : "캐릭터 프리셋을 저장했습니다.");
    } catch (saveError) {
      setCharacterLibraryMessage(saveError instanceof Error ? saveError.message : "캐릭터 프리셋 저장에 실패했습니다.");
    } finally {
      setCharacterLibraryLoading(false);
    }
  };

  const loadCharacterPresetLibrary = async () => {
    if (!window.confirm("저장된 캐릭터 프리셋으로 현재 캐릭터 설정을 바꿀까요?")) return;

    const roomCode = normalizeRoomCode(activeRoomCode);
    const error = validateRoomCode(roomCode);
    if (error) {
      setCharacterLibraryMessage(error);
      return;
    }
    if (isPublicSampleRoom(roomCode)) {
      const sampleLibrary = createCharacterPresetLibrary(CHARACTER_PRESETS);
      setCharacterPresetLibraryMeta({ updatedAt: sampleLibrary.updatedAt, bytes: getJsonByteLength(sampleLibrary) });
      setPresets(normalizeCharacterPresets(sampleLibrary.presets));
      setCharacterLibraryMessage("공식 샘플 프리셋을 불러왔습니다.");
      return;
    }

    setCharacterLibraryLoading(true);
    setCharacterLibraryMessage("캐릭터 프리셋을 불러오는 중입니다.");
    try {
      const payload = await requestTemplates("GET", roomCode, undefined, {
        ...buildTemplateRequestOptions(),
        library: "1"
      });
      applyTemplatesPayload(payload);
      setCharacterPresetLibraryMeta(payload.characterPresetLibraryMeta);
      await refreshImageStorageUsage(roomCode);
      if (!payload.characterPresetLibrary) {
        setCharacterLibraryMessage("이 접속코드에는 아직 저장된 캐릭터 프리셋이 없습니다.");
        return;
      }
      setPresets(normalizeCharacterPresets(hydratePresetImages(payload.characterPresetLibrary.presets)));
      setCharacterLibraryMessage("캐릭터 프리셋을 불러왔습니다.");
    } catch (loadError) {
      setCharacterLibraryMessage(loadError instanceof Error ? loadError.message : "캐릭터 프리셋 불러오기에 실패했습니다.");
    } finally {
      setCharacterLibraryLoading(false);
    }
  };

  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = JSON.parse(String(reader.result || "{}")) as TheaterSaveFile;
      if (parsed.data?.blocks) commitData(normalizeTheaterData(hydrateDataImages(parsed.data)));
      if (parsed.presets) setPresets(normalizeCharacterPresets(hydratePresetImages(parsed.presets)));
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
          <h1>마녀극장 제작기</h1>
          <p>왼쪽에서 편집하고 오른쪽에서 결과를 바로 확인합니다.</p>
        </div>
        <div className="toolbarActions">
          <button type="button" onClick={() => setIsShortcutHelpOpen((current) => !current)} title="단축키 보기" aria-expanded={isShortcutHelpOpen}>
            <Keyboard size={16} />
            단축키
          </button>
          <button type="button" onClick={undo} disabled={history.length === 0} title="Ctrl+Z">
            <Undo2 size={16} />
            실행 취소
          </button>
          <button type="button" onClick={redo} disabled={future.length === 0} title="Ctrl+Y / Ctrl+Shift+Z">
            <Redo2 size={16} />
            다시 실행
          </button>
          <button type="button" onClick={collapseAllBlocks}>
            <ChevronUp size={16} />
            전부 접기
          </button>
          <button type="button" onClick={expandAllBlocks} disabled={collapsedIds.size === 0}>
            <ChevronDown size={16} />
            전부 펼치기
          </button>
          <div className="themePicker" aria-label="테마 선택">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`themeButton${theme === option.id ? " active" : ""}`}
                onClick={() => setTheme(option.id)}
                title={option.name}
                aria-label={option.name}
                style={{ "--theme-a": option.colors[0], "--theme-b": option.colors[1] } as React.CSSProperties}
              >
                <span className="themeSwatch" />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowReferences((current) => !current)}>
            <Eye size={16} />
            {showReferences ? "참고 데이터 숨기기" : "참고 데이터 보이기"}
          </button>
          <button type="button" onClick={() => importRef.current?.click()}>
            <Upload size={16} />
            불러오기
          </button>
          <input ref={importRef} className="hiddenInput" type="file" accept="application/json" onChange={importJson} />
          <button type="button" onClick={() => downloadFile("theater-data.json", JSON.stringify(createSaveFile(data, presets), null, 2), "application/json")}>
            <FileJson size={16} />
            저장
          </button>
          <button type="button" onClick={resetTemplateToDefaults} title="현재 편집 내용을 기본 템플릿으로 되돌립니다.">
            <RotateCcw size={16} />
            템플릿 초기화
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
        {isShortcutHelpOpen ? (
          <section className="shortcutHelpPanel" aria-label="단축키 설명서">
            <div className="shortcutHelpTitle">단축키</div>
            <dl>
              <div>
                <dt>Ctrl + Z</dt>
                <dd>실행 취소</dd>
              </div>
              <div>
                <dt>Ctrl + Y</dt>
                <dd>다시 실행</dd>
              </div>
              <div>
                <dt>Ctrl + Shift + Z</dt>
                <dd>다시 실행</dd>
              </div>
              <div>
                <dt>Ctrl + 미리보기 클릭</dt>
                <dd>클릭한 미리보기 위치의 편집 블럭으로 이동</dd>
              </div>
              <div>
                <dt>블럭 헤더의 눈 아이콘</dt>
                <dd>해당 블럭의 미리보기 위치로 이동</dd>
              </div>
            </dl>
          </section>
        ) : null}
      </header>

      <div ref={splitRef} className={`splitWorkspace${isResizing ? " resizing" : ""}`} style={{ "--editor-percent": `${editorPercent}%` } as React.CSSProperties}>
        <section className="editorPane">
          <div className="editorTools">
            <CharacterImageManager
              presets={presets}
              setPresets={setPresets}
              activeRoomCode={activeRoomCode}
              characterLibraryLoading={characterLibraryLoading}
              characterLibraryMessage={characterLibraryMessage}
              hasCharacterLibrary={Boolean(characterPresetLibraryMeta)}
              characterLibraryUsageBytes={characterLibraryUsageBytes}
              characterLibraryLimitBytes={characterLibraryLimitBytes}
              isPublicRoom={isActivePublicRoom}
              onSaveCharacterLibrary={saveCharacterPresetLibraryWithImages}
              onLoadCharacterLibrary={loadCharacterPresetLibrary}
            />
            <section className="panel">
              <div className="panelTitle">
                <Palette size={18} />
                폰트 관리
              </div>
              <div className="fontPresetButtons">
                {FONT_PRESET_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={normalizeFontPresetId(data.fontPreset) === option.id ? "active" : ""}
                    onClick={() => applyFontPreset(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
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
              <div className="fontControlGroup">
                <button type="button" onClick={resetPortraitSize} title="본문 캐릭터 프로필 사진 크기를 기본값으로 되돌림">
                  <RotateCcw size={15} />
                  프로필 재설정
                </button>
                <div className="fontBatchButtons">
                  <button type="button" onClick={() => shiftPortraitSize(-1)} title="본문 캐릭터 프로필 사진 크기 감소">
                    프로필 -1
                  </button>
                  <button type="button" onClick={() => shiftPortraitSize(1)} title="본문 캐릭터 프로필 사진 크기 증가">
                    프로필 +1
                  </button>
                </div>
              </div>
              <div className="fontControlGroup">
                <div className="fontColorButtons">
                  <button type="button" onClick={() => applyDialogueColorMode("reset")} title="캐릭터 대사 색상을 현재 테마 기본색으로 되돌림">
                    기본색으로 재설정
                  </button>
                  <button type="button" onClick={() => applyDialogueColorMode("personal")} title="캐릭터 대사에 캐릭터별 퍼스널 컬러를 적용">
                    캐릭터 색 적용
                  </button>
                </div>
              </div>
            </section>
            <TemplateStoragePanel
              roomInput={roomInput}
              activeRoomCode={activeRoomCode}
              templatesLoading={templatesLoading}
              isActivePublicRoom={isActivePublicRoom}
              isCurrentTemplateTooLarge={isCurrentTemplateTooLarge}
              roomStorageUsage={roomStorageUsage}
              imageStorageUsage={imageStorageUsage}
              imageStorageLimitBytes={imageStorageLimitBytes}
              imageStorageRatio={imageStorageRatio}
              isImageStorageTooLarge={isImageStorageTooLarge}
              templatesMessage={templatesMessage}
              templates={templates}
              trashedTemplates={trashedTemplates}
              activityLog={activityLog}
              selectedTemplateId={selectedTemplateId}
              selectedTemplateName={selectedTemplateName}
              currentTemplateBytes={currentTemplateBytes}
              currentTemplateLimitBytes={currentTemplateLimitBytes}
              currentTemplateRatio={currentTemplateRatio}
              hiddenTemplateCount={hiddenTemplateCount}
              hiddenTrashCount={hiddenTrashCount}
              isTemplateListExpanded={isTemplateListExpanded}
              isTrashExpanded={isTrashExpanded}
              formatBytes={formatBytes}
              formatActivityType={formatActivityType}
              setRoomInput={setRoomInput}
              enterTemplateRoom={enterTemplateRoom}
              leaveTemplateRoom={leaveTemplateRoom}
              saveNewTemplate={() => saveCurrentTemplateWithImages()}
              overwriteTemplate={() => saveCurrentTemplateWithImages("update")}
              toggleTemplateListExpanded={toggleTemplateListExpanded}
              toggleTrashExpanded={toggleTrashExpanded}
              loadTemplate={loadTemplate}
              restoreLatestTemplateVersion={restoreLatestTemplateVersion}
              deleteTemplate={deleteTemplate}
              restoreTemplate={restoreTemplate}
            />
            <section className="panel">
              <div className="panelTitle">
                <Plus size={18} />
                블록 추가
              </div>
              <button type="button" onClick={() => commitData((current) => ({ ...current, blocks: [...current.blocks, createModuleBlock("title", normalizeFontPresetId(current.fontPreset))] }))}>
                제목
              </button>
              <button type="button" onClick={() => commitData((current) => ({ ...current, blocks: [...current.blocks, createModuleBlock("subtitle", normalizeFontPresetId(current.fontPreset))] }))}>
                부제
              </button>
              <button type="button" onClick={() => commitData((current) => ({ ...current, blocks: [...current.blocks, createModuleBlock("narration", normalizeFontPresetId(current.fontPreset))] }))}>
                나레이션
              </button>
              <button type="button" onClick={() => commitData((current) => ({ ...current, blocks: [...current.blocks, createSceneCard(normalizeFontPresetId(current.fontPreset))] }))}>
                장면
              </button>
            </section>
          </div>

          <section className="editorList">
            {data.blocks.map((block, index) => {
              const isCollapsed = collapsedIds.has(block.id);
              return (
                <article
                  className={`editorCard${isCollapsed ? " collapsed" : ""}${highlightedEditorBlockId === block.id ? " jumpTarget" : ""}`}
                  key={block.id}
                  ref={(node) => registerEditorBlock(block.id, node)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => movePageBlockByDrop(event, index)}
                >
                <div className="blockHeader">
                  <strong>
                    <span
                      className="dragHandle"
                      draggable
                      title="드래그로 이동"
                      onDragStart={(event) => writeDragPayload(event, { scope: "page", id: block.id })}
                    >
                      <GripVertical size={15} />
                    </span>
                    {isSceneCard(block) ? "장면" : MODULE_LABELS[block.moduleType]}
                  </strong>
                  <div>
                    <button type="button" className="iconButton" onClick={() => toggleCollapsed(block.id)} title={isCollapsed ? "펼치기" : "접기"}>
                      {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                    </button>
                    <button type="button" className="iconButton" onClick={() => commitData((current) => ({ ...current, blocks: moveArrayItem(current.blocks, index, -1) }))}>
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" className="iconButton" onClick={() => scrollPreviewBlockIntoView(block.id)} title="미리보기에서 이 블럭 보기">
                      <Eye size={15} />
                    </button>
                    <button type="button" className="iconButton" onClick={() => commitData((current) => ({ ...current, blocks: moveArrayItem(current.blocks, index, 1) }))}>
                      <ArrowDown size={15} />
                    </button>
                    <button type="button" className="iconButton danger" onClick={() => commitData((current) => ({ ...current, blocks: current.blocks.filter((item) => item.id !== block.id) }))}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {isCollapsed ? null : isSceneCard(block) ? (
                  <SceneEditor
                    scene={block}
                    presets={presets}
                    fontPreset={normalizeFontPresetId(data.fontPreset)}
                    onChange={(scene) => updateBlock(block.id, scene)}
                    onTextChange={(scene) => updateBlockText(block.id, scene)}
                    onBlockChange={updateSceneBlock}
                    onTextBlockChange={updateSceneBlockText}
                    showReferences={showReferences}
                    collapsedIds={collapsedIds}
                    onToggleCollapse={toggleCollapsed}
                    highlightedBlockId={highlightedEditorBlockId}
                    onPreviewJump={scrollPreviewBlockIntoView}
                    registerEditorBlock={registerEditorBlock}
                  />
                ) : (
                  <div className="fieldGrid">
                    <RichTextArea value={block.content} rows={block.moduleType === "narration" ? 5 : 2} onChange={(content) => updateBlockText(block.id, { ...block, content })} />
                  </div>
                )}
                </article>
              );
            })}
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
  --app-surface: #151412;
  --app-surface-2: #1d1a16;
  --app-surface-3: #242019;
  --app-control: #201d18;
  --app-control-2: #141310;
  --app-border: #3a342a;
  --app-border-2: #4a4235;
  --app-text: #efe8dc;
  --app-dim: #a69b8c;
  --app-faint: #756c5f;
  --app-accent: rgb(200, 169, 110);
  --app-accent-soft: #f7d58f;
  --scroll-track: #1b1916;
  --scroll-thumb: rgb(200, 169, 110);
}
.appShell.theme-ivoryGold {
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
.appShell.theme-midnightBlue {
  --app-bg: #0d1320;
  --app-surface: #151d2b;
  --app-surface-2: #111827;
  --app-surface-3: #1d2738;
  --app-control: #1b2535;
  --app-control-2: #101827;
  --app-border: #2c3a52;
  --app-border-2: #3b4e6c;
  --app-text: #d9e4f2;
  --app-dim: #aebbd0;
  --app-faint: #6f7f98;
  --app-accent: #9fb6d8;
  --app-accent-soft: #d6e5f8;
  --scroll-track: #101828;
  --scroll-thumb: #8ea9cf;
}
.appShell.theme-wineRose {
  --app-bg: #1d0f15;
  --app-surface: #27151d;
  --app-surface-2: #211219;
  --app-surface-3: #321d26;
  --app-control: #33202a;
  --app-control-2: #1b1016;
  --app-border: #49303a;
  --app-border-2: #61404b;
  --app-text: #f0dbe0;
  --app-dim: #c8adb4;
  --app-faint: #866b73;
  --app-accent: #d6a0a8;
  --app-accent-soft: #ffd5dc;
  --scroll-track: #24131a;
  --scroll-thumb: #c88d98;
}
.appShell.theme-dcBlueWhite {
  --app-bg: #ffffff;
  --app-surface: #ffffff;
  --app-surface-2: #f6f8fc;
  --app-surface-3: #eef3fb;
  --app-control: #ffffff;
  --app-control-2: #f9fbff;
  --app-border: #d8dfec;
  --app-border-2: #c7d1e3;
  --app-text: #1f2233;
  --app-dim: #5d6680;
  --app-faint: #8d98b6;
  --app-accent: #2f3f8f;
  --app-accent-soft: #4457ae;
  --scroll-track: #eaf0f9;
  --scroll-thumb: #2f3f8f;
}
.appShell.theme-sakuraPlum {
  --app-bg: #fff8fb;
  --app-surface: #ffffff;
  --app-surface-2: #fff1f6;
  --app-surface-3: #fae8f1;
  --app-control: #fffafd;
  --app-control-2: #fff4f9;
  --app-border: #ecd6e1;
  --app-border-2: #dbbfd0;
  --app-text: #362632;
  --app-dim: #7a5b6c;
  --app-faint: #b392a7;
  --app-accent: #b85f8f;
  --app-accent-soft: #8f4f73;
  --scroll-track: #f9ecf2;
  --scroll-thumb: #b85f8f;
}
.appShell, .appShell * { box-sizing: border-box; }
html {
  --page-scroll-track: #1b1916;
  --page-scroll-thumb: rgb(200, 169, 110);
  scrollbar-color: var(--page-scroll-thumb) var(--page-scroll-track);
  scrollbar-width: thin;
}
html:has(.appShell.theme-ivoryGold) {
  --page-scroll-track: #e6dccd;
  --page-scroll-thumb: rgb(200, 169, 110);
}
html:has(.appShell.theme-midnightBlue) {
  --page-scroll-track: #101828;
  --page-scroll-thumb: #8ea9cf;
}
html:has(.appShell.theme-wineRose) {
  --page-scroll-track: #24131a;
  --page-scroll-thumb: #c88d98;
}
html:has(.appShell.theme-dcBlueWhite) {
  --page-scroll-track: #eaf0f9;
  --page-scroll-thumb: #2f3f8f;
}
html:has(.appShell.theme-sakuraPlum) {
  --page-scroll-track: #f9ecf2;
  --page-scroll-thumb: #b85f8f;
}
body { margin: 0; background: #12110f; color: #efe8dc; font-family: Pretendard, 'Noto Sans KR', system-ui, sans-serif; }
body:has(.appShell.theme-ivoryGold) { background: #f3eee6; color: #28231e; }
body:has(.appShell.theme-midnightBlue) { background: #0d1320; color: #d9e4f2; }
body:has(.appShell.theme-wineRose) { background: #1d0f15; color: #f0dbe0; }
body:has(.appShell.theme-dcBlueWhite) { background: #ffffff; color: #1f2233; }
body:has(.appShell.theme-sakuraPlum) { background: #fff8fb; color: #362632; }
* { scrollbar-color: var(--scroll-thumb, var(--page-scroll-thumb)) var(--scroll-track, var(--page-scroll-track)); scrollbar-width: thin; }
::-webkit-scrollbar { width: 12px; height: 12px; }
::-webkit-scrollbar-track { background: var(--scroll-track, var(--page-scroll-track)); }
::-webkit-scrollbar-thumb { background: var(--scroll-thumb, var(--page-scroll-thumb)); border: 3px solid var(--scroll-track, var(--page-scroll-track)); border-radius: 999px; }
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
.shortcutHelpPanel { position: absolute; top: calc(100% + 8px); right: 24px; z-index: 20; width: min(360px, calc(100vw - 32px)); padding: 14px; border: 1px solid var(--app-border-2); border-radius: 12px; background: var(--app-surface); box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42); }
.shortcutHelpTitle { margin-bottom: 10px; color: var(--app-accent-soft); font-weight: 800; }
.shortcutHelpPanel dl { display: grid; gap: 8px; margin: 0; }
.shortcutHelpPanel dl > div { display: grid; grid-template-columns: 136px minmax(0, 1fr); gap: 10px; align-items: start; padding: 8px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-2); }
.shortcutHelpPanel dt { color: var(--app-accent-soft); font-size: 12px; font-weight: 800; }
.shortcutHelpPanel dd { margin: 0; color: var(--app-dim); font-size: 12px; line-height: 1.45; }
.themePicker { display: inline-flex; align-items: center; gap: 6px; padding: 3px 7px; border: 1px solid var(--app-border-2); border-radius: 999px; background: var(--app-control); font-size: 0; }
.themeButton { width: 28px; min-height: 28px; height: 28px; padding: 0; border-radius: 999px; border-color: transparent; background: transparent; }
.themeButton.active { border-color: var(--app-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 22%, transparent); }
.themeSwatch { width: 18px; height: 18px; border: 1px solid color-mix(in srgb, var(--app-border-2) 70%, white 20%); border-radius: 999px; background: linear-gradient(90deg, var(--theme-a) 0 50%, var(--theme-b) 50% 100%); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); }
.splitWorkspace { --editor-percent: 52%; display: grid; grid-template-columns: minmax(420px, var(--editor-percent)) 12px minmax(360px, 1fr); gap: 12px; padding: 18px 24px 32px; align-items: start; }
.splitWorkspace.resizing { cursor: col-resize; user-select: none; }
.editorPane { min-width: 0; display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 14px; align-items: start; }
.editorTools { position: sticky; top: 92px; display: flex; flex-direction: column; gap: 14px; max-height: calc(100vh - 112px); overflow: auto; padding-right: 2px; }
.resizeHandle { position: sticky; top: 92px; width: 12px; height: calc(100vh - 112px); min-height: 180px; padding: 0; border: 0; border-radius: 999px; background: transparent; cursor: col-resize; align-self: start; }
.resizeHandle::before { content: ""; display: block; width: 4px; height: 100%; margin: 0 auto; border-radius: 999px; background: var(--app-border); transition: background 120ms ease, width 120ms ease; }
.resizeHandle:hover::before, .resizeHandle:focus-visible::before, .splitWorkspace.resizing .resizeHandle::before { width: 6px; background: var(--app-accent); }
.previewPane { position: sticky; top: 92px; min-width: 0; height: calc(100vh - 112px); border: 1px solid var(--app-border); background: var(--app-surface); border-radius: 8px; overflow: hidden; }
.previewHeader { height: 42px; display: flex; align-items: center; gap: 8px; padding: 0 13px; border-bottom: 1px solid var(--app-border); color: var(--app-accent-soft); font-weight: 700; }
.panel, .editorCard, .blockEditor { border: 1px solid var(--app-border); background: var(--app-surface); border-radius: 8px; padding: 14px; box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.04); transition: border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease; }
.editorCard:hover, .blockEditor:hover { border-color: color-mix(in srgb, var(--app-accent) 38%, var(--app-border-2)); }
.panel:hover { border-color: color-mix(in srgb, var(--app-accent) 24%, var(--app-border-2)); }
.panel { display: grid; gap: 8px; align-content: start; }
.panelTitle, .blockHeader { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; color: var(--app-accent-soft); font-weight: 700; }
.panelTitle { justify-content: flex-start; }
.fontControlGroup { display: grid; gap: 7px; padding: 9px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-2); }
.fontPresetButtons { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 8px; }
.fontPresetButtons button { min-width: 0; font-size: 12px; white-space: nowrap; padding-left: 8px; padding-right: 8px; }
.fontBatchButtons { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.fontBatchButtons button { padding-left: 8px; padding-right: 8px; }
.fontColorButtons { display: grid; grid-template-columns: 1fr; gap: 8px; }
.fontColorButtons button { width: 100%; min-width: 0; justify-content: center; white-space: nowrap; padding-left: 8px; padding-right: 8px; }
.emptyTemplates { padding: 10px; border: 1px dashed var(--app-border-2); border-radius: 8px; color: var(--app-faint); font-size: 12px; line-height: 1.45; text-align: center; word-break: keep-all; overflow-wrap: break-word; }
.roomBox { display: grid; grid-template-columns: minmax(0, 1fr) 58px; gap: 7px; }
.roomBox button { padding-left: 8px; padding-right: 8px; }
.roomStatus { display: grid; grid-template-columns: minmax(0, 1fr) 58px; gap: 7px; align-items: center; padding: 8px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-2); font-size: 12px; color: var(--app-dim); }
.roomStatus span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.roomStatus button { min-height: 28px; padding: 3px 7px; font-size: 12px; }
.templateActionGrid { display: grid; grid-template-columns: 1fr; gap: 8px; }
.templateMessage { padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--app-accent) 12%, transparent); color: var(--app-accent-soft); font-size: 12px; line-height: 1.5; }
.usageBox { display: grid; gap: 6px; padding: 8px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-2); }
.nestedUsage { margin-top: 2px; padding: 7px; background: var(--app-surface-3); }
.usageText { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; color: var(--app-dim); font-size: 12px; line-height: 1.4; }
.usageText span { flex: 0 0 auto; white-space: nowrap; word-break: keep-all; }
.usageText strong { margin-left: auto; min-width: 0; color: var(--app-accent-soft); font-size: 12px; white-space: nowrap; text-align: right; }
.usageText.subtle strong { color: var(--app-dim); font-weight: 600; }
.sectionHeaderRow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.inlineToggleButton { min-height: 28px; padding: 4px 8px; font-size: 12px; white-space: nowrap; }
.usageTrack { height: 6px; border-radius: 999px; overflow: hidden; background: var(--app-control-2); border: 1px solid var(--app-border); }
.usageTrack span { display: block; height: 100%; max-width: 100%; border-radius: inherit; background: var(--app-accent); }
.usageBox.warning { border-color: #e37a7a; background: color-mix(in srgb, var(--app-surface-2) 80%, #e37a7a 20%); }
.usageBox.warning .usageText strong { color: #ffb4b4; }
.usageBox.warning .usageTrack span { background: #e37a7a; }
.templateList { display: grid; gap: 7px; }
.templateItem { display: grid; grid-template-columns: minmax(0, 1fr) 34px 34px; gap: 7px; align-items: stretch; }
.templateLoad { min-width: 0; justify-content: flex-start; align-items: flex-start; flex-direction: column; gap: 1px; text-align: left; }
.templateLoad span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.templateLoad small { color: var(--app-faint); font-size: 11px; font-weight: 400; }
.trashBox, .activityBox { display: grid; gap: 7px; padding: 8px; border: 1px dashed var(--app-border-2); border-radius: 8px; background: var(--app-surface-2); }
.activityList { display: grid; gap: 7px; }
.activityList.scrollable { max-height: 228px; overflow-y: auto; padding-right: 4px; }
.activityItem { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 4px 7px; align-items: center; color: var(--app-dim); font-size: 12px; }
.activityItem strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--app-accent-soft); font-size: 12px; }
.activityItem small { grid-column: 2; color: var(--app-faint); font-size: 11px; }
.characterGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.characterChip { min-width: 0; min-height: 46px; border: 1px solid var(--app-border); background: var(--app-control-2); border-radius: 8px; padding: 7px; display: flex; align-items: center; justify-content: flex-start; gap: 7px; cursor: pointer; font-size: 12px; }
.characterChip span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hiddenInput { display: none; }
.miniAvatar { width: 30px; height: 30px; border: 2px solid; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; flex: 0 0 auto; font-size: 10px; }
.miniAvatar img { width: 100%; height: 100%; object-fit: cover; }
.characterPresetManager { display: grid; gap: 8px; padding: 9px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-2); }
.characterPresetHeader { display: flex; align-items: center; gap: 8px; color: var(--app-accent-soft); }
.characterLibraryBox { display: grid; gap: 8px; padding: 9px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-2); }
.characterLibraryActions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.characterLibraryActions button { min-width: 0; padding-left: 6px; padding-right: 6px; font-size: 12px; white-space: nowrap; }
.characterLibraryCode { min-width: 0; padding: 7px 8px; border: 1px solid var(--app-border); border-radius: 8px; color: var(--app-dim); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.presetManagerTitle { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; color: var(--app-dim); font-size: 12px; font-weight: 700; }
.characterLibraryBox .presetManagerTitle { grid-template-columns: 1fr; margin-bottom: 0; }
.presetManagerTitle button { min-height: 30px; padding: 4px 7px; font-size: 12px; }
.presetCount { margin-top: -3px; color: var(--app-faint); font-size: 11px; text-align: right; }
.dangerTextButton:hover { border-color: #e37a7a; color: #ffb4b4; }
.profilePresetFolderList { display: grid; gap: 8px; }
.profilePresetFolder { display: grid; gap: 6px; }
.profilePresetFolderTop { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: center; }
.profilePresetFolderName { width: 100%; min-height: 32px; justify-content: flex-start; display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; gap: 6px; align-items: center; text-align: left; padding: 5px 8px; border-color: var(--app-border-2); background: color-mix(in srgb, var(--app-control-2) 72%, var(--app-accent) 18%); color: var(--app-accent-soft); }
.profilePresetFolderName span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profilePresetFolderName small { color: var(--app-faint); font-size: 11px; }
.profilePresetOrderActions { display: flex; gap: 6px; }
.profilePresetOrderActions .iconButton { width: 30px; min-height: 30px; height: 30px; }
.profilePresetFolderBody { display: grid; gap: 7px; padding: 7px; border: 1px solid var(--app-border-2); border-radius: 8px; background: var(--app-surface-3); }
.profilePresetFolderActions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.profilePresetFolderActions button { min-width: 0; min-height: 42px; padding: 5px 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; line-height: 1.15; white-space: normal; }
.profilePresetFolderActions button span { display: inline-block; text-align: center; }
.profilePresetPreviewGrid { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-start; }
.profilePresetTileWrap { position: relative; width: 46px; height: 46px; }
.profilePresetTile { position: relative; width: 46px; height: 46px; padding: 0; border: 1px solid var(--app-border-2); border-radius: 8px; overflow: visible; display: flex; align-items: center; justify-content: center; background: var(--app-control-2); color: var(--app-dim); cursor: pointer; }
.profilePresetTile > img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 7px; }
.profilePresetTile input { display: none; }
.profilePresetTileDelete { position: absolute; top: -5px; right: -5px; width: 20px; min-height: 20px; height: 20px; padding: 0; border-radius: 999px; border-color: rgba(227, 122, 122, 0.7); background: color-mix(in srgb, var(--app-control) 72%, #9d2b2b 28%); color: #ffd2d2; }
.profilePresetTileDelete:disabled { opacity: 0.35; }
.fileIconButton { cursor: pointer; }
.fileIconButton input { display: none; }
.characterPicker { position: relative; display: grid; gap: 7px; }
.characterPickerButton { width: 100%; min-height: 52px; justify-content: flex-start; padding: 6px 9px; display: grid; grid-template-columns: 38px minmax(0, 1fr) 20px; text-align: left; }
.characterPickerImage { width: 36px; height: 36px; border: 2px solid; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--app-surface-3); color: var(--app-dim); font-size: 11px; font-weight: 700; }
.characterPickerImage img { width: 100%; height: 100%; object-fit: cover; display: block; }
.characterPickerText { min-width: 0; display: grid; gap: 1px; align-content: center; }
.characterPickerText span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profileImageFolders { display: grid; gap: 7px; padding: 7px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-2); }
.profileImageFolder { display: grid; gap: 6px; min-width: 0; }
.profileImageFolderHeader { width: 100%; min-height: 30px; display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; gap: 5px; align-items: center; justify-content: stretch; text-align: left; padding: 4px 7px; border-color: var(--app-border-2); background: color-mix(in srgb, var(--app-control) 78%, var(--app-accent) 22%); color: var(--app-accent-soft); }
.profileImageFolderHeader span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profileImageFolderHeader small { color: var(--app-faint); font-size: 11px; }
.profileImageGrid { display: flex; flex-wrap: wrap; gap: 7px; align-items: flex-start; }
.profileImageTile { position: relative; width: 54px; min-height: 54px; padding: 4px; display: grid; place-items: center; gap: 3px; border-radius: 8px; background: var(--app-control-2); color: var(--app-dim); font-size: 10px; }
.profileImageTile.default { width: auto; min-height: 40px; grid-template-columns: 30px auto; justify-content: flex-start; padding: 5px 8px; }
.profileImageTile.active { border-color: var(--app-accent); background: color-mix(in srgb, var(--app-control) 70%, var(--app-accent) 30%); color: var(--app-accent-soft); }
.profileImageTilePreview { width: 44px; height: 44px; border: 2px solid var(--app-border-2); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--app-surface-3); color: var(--app-dim); font-size: 10px; font-weight: 700; }
.profileImageTile.default .profileImageTilePreview { width: 28px; height: 28px; border-radius: 50%; }
.profileImageTilePreview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.imageHoverPreview { position: absolute; left: 50%; bottom: calc(100% + 8px); z-index: 50; width: 184px; height: 184px; padding: 5px; border: 1px solid var(--app-border-2); border-radius: 10px; background: var(--app-surface); box-shadow: 0 18px 42px rgba(0, 0, 0, 0.45); opacity: 0; pointer-events: none; transform: translate(-50%, 6px) scale(0.96); transition: opacity 120ms ease, transform 120ms ease; }
.imageHoverPreview img { width: 100%; height: 100%; object-fit: contain; display: block; border-radius: 7px; background: var(--app-surface-2); }
.profileImageTile:hover .imageHoverPreview,
.profilePresetTile:hover .imageHoverPreview { opacity: 1; transform: translate(-50%, 0) scale(1); }
.characterSelectGrid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; }
.characterSelectCard { min-width: 0; min-height: 88px; padding: 7px 4px; display: grid; justify-items: center; align-content: start; gap: 5px; border-radius: 8px; background: var(--app-control-2); }
.characterSelectCard.active { border-color: var(--app-accent); background: color-mix(in srgb, var(--app-control) 72%, var(--app-accent) 28%); color: var(--app-accent-soft); }
.characterSelectImage { width: 48px; height: 48px; border: 2px solid; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--app-surface-3); color: var(--app-dim); font-size: 11px; font-weight: 700; }
.characterSelectImage img { width: 100%; height: 100%; object-fit: cover; display: block; }
.characterSelectName { max-width: 100%; min-width: 0; display: grid; gap: 1px; text-align: center; font-size: 11px; line-height: 1.2; }
.characterSelectName span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.editorList { display: grid; gap: 14px; }
.sceneEditor { display: grid; gap: 12px; }
.sceneName { font-weight: 700; }
.addRow { display: flex; flex-wrap: wrap; gap: 8px; }
.blockEditor { background: var(--app-surface-2); }
.editorCard.collapsed, .blockEditor.collapsed { background: color-mix(in srgb, var(--app-surface-2) 86%, var(--app-control) 14%); }
.editorCard.jumpTarget, .blockEditor.jumpTarget { border-color: var(--app-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-accent) 26%, transparent), inset 0 1px 0 rgba(255, 240, 200, 0.08); }
.editorCard.collapsed .blockHeader, .blockEditor.collapsed .blockHeader { margin-bottom: 0; }
.blockEditor:has(.referenceEditor) { border-style: dashed; background: color-mix(in srgb, var(--app-surface-2) 78%, var(--app-accent) 10%); }
.blockHeader { justify-content: flex-start; }
.blockHeader strong { min-width: 0; flex: 1; display: flex; align-items: center; gap: 7px; }
.blockHeader > div { display: flex; gap: 6px; margin-left: auto; }
.dragHandle { width: 26px; height: 26px; border: 1px solid var(--app-border); border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; color: var(--app-dim); background: var(--app-control); cursor: grab; flex: 0 0 auto; }
.dragHandle:active { cursor: grabbing; }
.dragHandle:hover { color: var(--app-accent-soft); border-color: var(--app-border-2); }
.iconButton { width: 34px; min-height: 34px; padding: 0; }
.danger:hover { border-color: #e37a7a; color: #ffb4b4; }
.fieldGrid { display: grid; gap: 9px; min-width: 0; }
.sceneImagePreview { display: grid; grid-template-columns: 136px minmax(0, 1fr); gap: 10px; padding: 10px; border: 1px solid var(--app-border); border-radius: 10px; background: var(--app-surface-2); }
.sceneImagePreview img { width: 100%; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 8px; display: block; background: var(--app-surface-3); }
.sceneImagePreviewMeta { min-width: 0; display: grid; align-content: center; gap: 4px; }
.sceneImagePreviewMeta strong { color: var(--app-accent-soft); font-size: 13px; }
.sceneImagePreviewMeta span { color: var(--app-dim); font-size: 12px; line-height: 1.5; }
.sceneSampleSection { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--app-border); border-radius: 10px; background: var(--app-surface-2); }
.sceneSampleToggle { width: 100%; min-height: 38px; padding: 8px 10px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; text-align: left; background: var(--app-control-2); }
.sceneSampleToggle strong { color: var(--app-accent-soft); font-size: 13px; }
.sceneSampleToggle span { color: var(--app-dim); font-size: 12px; }
.sceneSampleHeader { display: grid; gap: 3px; }
.sceneSampleHeader span { color: var(--app-dim); font-size: 12px; line-height: 1.5; }
.sceneSampleGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); align-items: start; align-content: start; column-gap: 10px; row-gap: 10px; grid-auto-rows: max-content; max-height: 760px; overflow-y: auto; padding-right: 2px; }
.sceneSampleTile { min-width: 0; min-height: 0; padding: 6px; display: block; border-radius: 12px; background: var(--app-control-2); overflow: hidden; }
.sceneSampleTile img { width: 100%; height: auto; object-fit: contain; border-radius: 9px; display: block; background: var(--app-surface-3); }
.sceneSampleTile.active { border-color: var(--app-accent); background: color-mix(in srgb, var(--app-control) 72%, var(--app-accent) 28%); }
.referenceEditor textarea { color: var(--app-dim); font-size: 13px; background: var(--app-surface-3); }
.lineEditor { display: grid; grid-template-columns: 110px minmax(0, 1fr) 34px; gap: 7px; }
.lineEditorRich { display: grid; gap: 7px; padding: 8px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-surface-3); }
.lineMeta { display: grid; grid-template-columns: minmax(0, 1fr) 34px; gap: 7px; }
.fileButton { min-height: 36px; border: 1px dashed var(--app-border-2); background: var(--app-surface-2); border-radius: 8px; padding: 8px 10px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; color: var(--app-dim); }
.fileButton.disabled, .fileIconButton.disabled { opacity: 0.45; cursor: not-allowed; }
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
  .sceneImagePreview { grid-template-columns: 1fr; }
}
`;
