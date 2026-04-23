import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "theater-templates";
const MAX_ROOM_CODE_LENGTH = 40;
const MIN_ROOM_CODE_LENGTH = 6;
const MAX_TEMPLATES_PER_ROOM = 50;
const MAX_TEMPLATE_BYTES = 1_000_000;
const MAX_CHARACTER_LIBRARY_BYTES = 5_000_000;
const MAX_TEMPLATE_VERSIONS = 5;
const MAX_ACTIVITY_LOGS = 40;
const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const json = (status, body) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const normalizeRoomCode = (value) => String(value || "").trim().replace(/\s+/g, " ");

const validateRoomCode = (roomCode) => {
  const length = Array.from(roomCode).length;
  if (length < MIN_ROOM_CODE_LENGTH) return "접속코드는 6글자 이상이어야 합니다.";
  if (length > MAX_ROOM_CODE_LENGTH) return "접속코드는 40글자 이하로 입력해주세요.";
  return "";
};

const roomHash = (roomCode) => createHash("sha256").update(roomCode, "utf8").digest("hex").slice(0, 32);
const roomRoot = (roomCode) => `rooms/${roomHash(roomCode)}/`;
const roomPrefix = (roomCode) => `${roomRoot(roomCode)}templates/`;
const trashPrefix = (roomCode) => `${roomRoot(roomCode)}trash/`;
const versionPrefix = (roomCode, templateId) => `${roomRoot(roomCode)}versions/${encodeURIComponent(templateId)}/`;
const templateKey = (roomCode, templateId) => `${roomPrefix(roomCode)}${encodeURIComponent(templateId)}.json`;
const trashKey = (roomCode, templateId) => `${trashPrefix(roomCode)}${encodeURIComponent(templateId)}.json`;
const versionKey = (roomCode, templateId, versionId) => `${versionPrefix(roomCode, templateId)}${encodeURIComponent(versionId)}.json`;
const characterLibraryKey = (roomCode) => `${roomRoot(roomCode)}character-library.json`;
const activityLogKey = (roomCode) => `${roomRoot(roomCode)}activity.json`;

const jsonByteLength = (value) => new TextEncoder().encode(JSON.stringify(value ?? null)).length;

const isValidTemplate = (template) =>
  template &&
  typeof template.id === "string" &&
  typeof template.name === "string" &&
  typeof template.createdAt === "string" &&
  template.data &&
  Array.isArray(template.data.blocks) &&
  Array.isArray(template.presets);

const isValidImagePreset = (preset) =>
  preset &&
  typeof preset.id === "string" &&
  typeof preset.name === "string" &&
  (typeof preset.imageData === "string" || typeof preset.imageKey === "string");

const isValidImagePresetGroup = (group) =>
  group &&
  typeof group.id === "string" &&
  typeof group.name === "string" &&
  Array.isArray(group.presets) &&
  group.presets.every(isValidImagePreset);

const isValidCharacterPreset = (preset) =>
  preset &&
  typeof preset.id === "string" &&
  typeof preset.name === "string" &&
  (typeof preset.imageData === "string" || typeof preset.imageKey === "string") &&
  typeof preset.ring === "string" &&
  (!preset.imagePresets || (Array.isArray(preset.imagePresets) && preset.imagePresets.every(isValidImagePreset))) &&
  (!preset.imagePresetGroups || (Array.isArray(preset.imagePresetGroups) && preset.imagePresetGroups.every(isValidImagePresetGroup)));

const isValidCharacterLibrary = (library) =>
  library &&
  typeof library.updatedAt === "string" &&
  Array.isArray(library.presets) &&
  library.presets.every(isValidCharacterPreset);

const readJson = async (store, key) => {
  try {
    return await store.get(key, { type: "json" });
  } catch {
    return null;
  }
};

const summarizeTemplate = (template, extras = {}) => ({
  id: template.id,
  name: template.name,
  createdAt: template.createdAt,
  bytes: jsonByteLength(template),
  ...extras
});

const summarizeTrash = (record) => ({
  ...summarizeTemplate(record.template, {
    deletedAt: record.deletedAt,
    expiresAt: record.expiresAt
  })
});

const summarizeCharacterLibrary = (library) =>
  library
    ? {
        updatedAt: library.updatedAt,
        bytes: jsonByteLength(library)
      }
    : null;

const readTemplates = async (store, roomCode) => {
  const { blobs } = await store.list({ prefix: roomPrefix(roomCode) });
  const templates = await Promise.all(blobs.map((blob) => readJson(store, blob.key)));

  return templates
    .filter(isValidTemplate)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

const readTemplate = async (store, roomCode, templateId) => {
  const template = await readJson(store, templateKey(roomCode, templateId));
  return isValidTemplate(template) ? template : null;
};

const readTrashRecord = async (store, roomCode, templateId) => {
  const record = await readJson(store, trashKey(roomCode, templateId));
  return record?.template && isValidTemplate(record.template) ? record : null;
};

const readTrash = async (store, roomCode) => {
  await cleanupExpiredTrash(store, roomCode);
  const { blobs } = await store.list({ prefix: trashPrefix(roomCode) });
  const records = await Promise.all(blobs.map((blob) => readJson(store, blob.key)));
  return records
    .filter((record) => record?.template && isValidTemplate(record.template))
    .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
};

const readCharacterLibrary = async (store, roomCode) => {
  const library = await readJson(store, characterLibraryKey(roomCode));
  return isValidCharacterLibrary(library) ? library : null;
};

const readActivityLog = async (store, roomCode) => {
  const log = await readJson(store, activityLogKey(roomCode));
  return Array.isArray(log) ? log.slice(0, MAX_ACTIVITY_LOGS) : [];
};

const appendActivity = async (store, roomCode, type, targetName) => {
  const current = await readActivityLog(store, roomCode);
  const entry = {
    id: createHash("sha1").update(`${Date.now()}:${type}:${targetName}:${Math.random()}`).digest("hex").slice(0, 12),
    type,
    targetName: String(targetName || ""),
    at: new Date().toISOString()
  };
  await store.setJSON(activityLogKey(roomCode), [entry, ...current].slice(0, MAX_ACTIVITY_LOGS));
};

const readVersionRecords = async (store, roomCode, templateId) => {
  const { blobs } = await store.list({ prefix: versionPrefix(roomCode, templateId) });
  const versions = await Promise.all(
    blobs.map(async (blob) => {
      const record = await readJson(store, blob.key);
      return record?.template && isValidTemplate(record.template) ? { key: blob.key, ...record } : null;
    })
  );
  return versions.filter(Boolean).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
};

const saveTemplateVersion = async (store, roomCode, template) => {
  if (!isValidTemplate(template)) return;
  const versionId = new Date().toISOString().replace(/[:.]/g, "-");
  await store.setJSON(versionKey(roomCode, template.id, versionId), {
    id: versionId,
    savedAt: new Date().toISOString(),
    template
  });

  const versions = await readVersionRecords(store, roomCode, template.id);
  await Promise.all(versions.slice(MAX_TEMPLATE_VERSIONS).map((record) => store.delete(record.key)));
};

async function cleanupExpiredTrash(store, roomCode) {
  const now = Date.now();
  const { blobs } = await store.list({ prefix: trashPrefix(roomCode) });
  await Promise.all(
    blobs.map(async (blob) => {
      const record = await readJson(store, blob.key);
      const expiresAt = Date.parse(record?.expiresAt || "");
      if (Number.isFinite(expiresAt) && expiresAt <= now) await store.delete(blob.key);
    })
  );
}

const roomPayload = async (store, roomCode) => {
  const templates = await readTemplates(store, roomCode);
  const trashedTemplates = await readTrash(store, roomCode);
  const characterPresetLibrary = await readCharacterLibrary(store, roomCode);
  const activityLog = await readActivityLog(store, roomCode);
  const versionCounts = new Map(
    await Promise.all(
      templates.map(async (template) => {
        const versions = await readVersionRecords(store, roomCode, template.id);
        return [template.id, versions.length];
      })
    )
  );
  const templateSummaries = templates.map((template) => summarizeTemplate(template, { versionCount: versionCounts.get(template.id) ?? 0 }));

  return {
    templates: templateSummaries,
    trashedTemplates: trashedTemplates.map(summarizeTrash),
    characterPresetLibraryMeta: summarizeCharacterLibrary(characterPresetLibrary),
    activityLog,
    usage: {
      characterLibraryBytes: characterPresetLibrary ? jsonByteLength(characterPresetLibrary) : 0,
      characterLibraryLimitBytes: MAX_CHARACTER_LIBRARY_BYTES,
      templatesBytes: templateSummaries.reduce((total, template) => total + template.bytes, 0),
      templatesCount: templates.length,
      trashedTemplatesCount: trashedTemplates.length,
      maxTemplates: MAX_TEMPLATES_PER_ROOM,
      maxTemplateBytes: MAX_TEMPLATE_BYTES
    }
  };
};

export default async (request) => {
  if (request.method === "OPTIONS") return json(204, {});

  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const url = new URL(request.url);

  try {
    const roomCode = normalizeRoomCode(request.method === "GET" ? url.searchParams.get("roomCode") : (await request.clone().json()).roomCode);
    const roomError = validateRoomCode(roomCode);
    if (roomError) return json(400, { error: roomError });

    if (request.method === "GET") {
      const templateId = url.searchParams.get("templateId");
      if (templateId) {
        const template = await readTemplate(store, roomCode, templateId);
        if (!template) return json(404, { error: "템플릿을 찾을 수 없습니다." });
        return json(200, { template });
      }

      const versionsFor = url.searchParams.get("versionsFor");
      if (versionsFor) {
        const versions = await readVersionRecords(store, roomCode, versionsFor);
        return json(200, {
          versions: versions.map((record) => ({
            id: record.id,
            savedAt: record.savedAt,
            name: record.template.name,
            bytes: jsonByteLength(record.template)
          }))
        });
      }

      if (url.searchParams.get("library") === "1") {
        const characterPresetLibrary = await readCharacterLibrary(store, roomCode);
        return json(200, { characterPresetLibrary, ...(await roomPayload(store, roomCode)) });
      }

      return json(200, await roomPayload(store, roomCode));
    }

    const body = await request.json();

    if (request.method === "POST") {
      const restoreTemplateId = String(body.restoreTemplateId || "");
      if (restoreTemplateId) {
        const record = await readTrashRecord(store, roomCode, restoreTemplateId);
        if (!record) return json(404, { error: "복구할 템플릿을 찾을 수 없습니다." });

        const existing = await readTemplates(store, roomCode);
        if (!existing.some((item) => item.id === restoreTemplateId) && existing.length >= MAX_TEMPLATES_PER_ROOM) {
          return json(400, { error: `접속코드 하나에는 템플릿을 최대 ${MAX_TEMPLATES_PER_ROOM}개까지 저장할 수 있습니다.` });
        }

        await store.setJSON(templateKey(roomCode, restoreTemplateId), record.template);
        await store.delete(trashKey(roomCode, restoreTemplateId));
        await appendActivity(store, roomCode, "restore", record.template.name);
        return json(200, await roomPayload(store, roomCode));
      }

      const restoreVersionTemplateId = String(body.restoreVersionTemplateId || "");
      if (restoreVersionTemplateId) {
        const versions = await readVersionRecords(store, roomCode, restoreVersionTemplateId);
        const versionId = String(body.versionId || "");
        const record = versionId ? versions.find((item) => item.id === versionId) : versions[0];
        if (!record) return json(404, { error: "복원할 이전 버전을 찾을 수 없습니다." });

        const current = await readTemplate(store, roomCode, restoreVersionTemplateId);
        if (current) await saveTemplateVersion(store, roomCode, current);
        await store.setJSON(templateKey(roomCode, restoreVersionTemplateId), record.template);
        await appendActivity(store, roomCode, "revert", record.template.name);
        return json(200, await roomPayload(store, roomCode));
      }

      const characterPresetLibrary = body.characterPresetLibrary;
      if (characterPresetLibrary !== undefined) {
        if (!isValidCharacterLibrary(characterPresetLibrary)) {
          return json(400, { error: "저장할 캐릭터 프리셋 형식이 올바르지 않습니다." });
        }

        const libraryBytes = jsonByteLength(characterPresetLibrary);
        if (libraryBytes > MAX_CHARACTER_LIBRARY_BYTES) {
          return json(413, { error: "캐릭터 프리셋은 5MB 이하로 저장할 수 있습니다." });
        }

        await store.setJSON(characterLibraryKey(roomCode), characterPresetLibrary);
        await appendActivity(store, roomCode, "saveLibrary", "캐릭터 프리셋");
        return json(200, await roomPayload(store, roomCode));
      }

      const template = body.template;
      if (!isValidTemplate(template)) return json(400, { error: "저장할 템플릿 형식이 올바르지 않습니다." });

      const templateBytes = jsonByteLength(template);
      if (templateBytes > MAX_TEMPLATE_BYTES) {
        return json(413, { error: "템플릿 하나는 1MB 이하로 저장할 수 있습니다." });
      }

      const existing = await readTemplates(store, roomCode);
      const previous = await readTemplate(store, roomCode, template.id);
      const isUpdate = Boolean(previous);
      if (!isUpdate && existing.length >= MAX_TEMPLATES_PER_ROOM) {
        return json(400, { error: `접속코드 하나에는 템플릿을 최대 ${MAX_TEMPLATES_PER_ROOM}개까지 저장할 수 있습니다.` });
      }

      if (previous) await saveTemplateVersion(store, roomCode, previous);
      await store.delete(trashKey(roomCode, template.id));
      await store.setJSON(templateKey(roomCode, template.id), template);
      await appendActivity(store, roomCode, isUpdate ? "update" : "create", template.name);
      return json(200, await roomPayload(store, roomCode));
    }

    if (request.method === "DELETE") {
      const templateId = String(body.templateId || "");
      if (!templateId) return json(400, { error: "삭제할 템플릿을 찾을 수 없습니다." });

      const template = await readTemplate(store, roomCode, templateId);
      if (!template) return json(404, { error: "삭제할 템플릿을 찾을 수 없습니다." });

      const deletedAt = new Date().toISOString();
      await store.setJSON(trashKey(roomCode, templateId), {
        deletedAt,
        expiresAt: new Date(Date.now() + TRASH_RETENTION_MS).toISOString(),
        template
      });
      await store.delete(templateKey(roomCode, templateId));
      await appendActivity(store, roomCode, "trash", template.name);
      return json(200, await roomPayload(store, roomCode));
    }

    return json(405, { error: "지원하지 않는 요청입니다." });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "템플릿 저장소 요청에 실패했습니다." });
  }
};
