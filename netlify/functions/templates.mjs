import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "theater-templates";
const MAX_ROOM_CODE_LENGTH = 40;
const MIN_ROOM_CODE_LENGTH = 6;
const MAX_TEMPLATES_PER_ROOM = 50;
const MAX_TEMPLATE_BYTES = 1_000_000;
const MAX_CHARACTER_LIBRARY_BYTES = 5_000_000;
const MAX_TEMPLATE_VERSIONS = 5;
const MAX_ACTIVITY_LOGS = 10;
const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function json(status, body) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function normalizeRoomCode(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validateRoomCode(roomCode) {
  const length = Array.from(roomCode).length;
  if (length < MIN_ROOM_CODE_LENGTH) return "접속코드는 6글자 이상이어야 합니다.";
  if (length > MAX_ROOM_CODE_LENGTH) return "접속코드는 40글자 이하로 입력해주세요.";
  return "";
}

function roomHash(roomCode) {
  return createHash("sha256").update(roomCode, "utf8").digest("hex").slice(0, 32);
}

function roomRoot(roomCode) {
  return `rooms/${roomHash(roomCode)}/`;
}

function roomPrefix(roomCode) {
  return `${roomRoot(roomCode)}templates/`;
}

function trashPrefix(roomCode) {
  return `${roomRoot(roomCode)}trash/`;
}

function versionPrefix(roomCode, templateId) {
  return `${roomRoot(roomCode)}versions/${encodeURIComponent(templateId)}/`;
}

function templateKey(roomCode, templateId) {
  return `${roomPrefix(roomCode)}${encodeURIComponent(templateId)}.json`;
}

function trashKey(roomCode, templateId) {
  return `${trashPrefix(roomCode)}${encodeURIComponent(templateId)}.json`;
}

function versionKey(roomCode, templateId, versionId) {
  return `${versionPrefix(roomCode, templateId)}${encodeURIComponent(versionId)}.json`;
}

function templateIndexKey(roomCode) {
  return `${roomRoot(roomCode)}template-index.json`;
}

function trashIndexKey(roomCode) {
  return `${roomRoot(roomCode)}trash-index.json`;
}

function versionMetaKey(roomCode, templateId) {
  return `${roomRoot(roomCode)}version-meta/${encodeURIComponent(templateId)}.json`;
}

function characterLibraryKey(roomCode) {
  return `${roomRoot(roomCode)}character-library.json`;
}

function characterLibraryMetaKey(roomCode) {
  return `${roomRoot(roomCode)}character-library-meta.json`;
}

function activityLogKey(roomCode) {
  return `${roomRoot(roomCode)}activity.json`;
}

function jsonByteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).length;
}

function collectImageKeys(value, keys = new Set()) {
  if (!value || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageKeys(item, keys));
    return keys;
  }
  if (typeof value.imageKey === "string") keys.add(value.imageKey);
  Object.values(value).forEach((item) => collectImageKeys(item, keys));
  return keys;
}

function isValidTemplate(template) {
  return Boolean(
    template &&
      typeof template.id === "string" &&
      typeof template.name === "string" &&
      typeof template.createdAt === "string" &&
      template.data &&
      Array.isArray(template.data.blocks) &&
      Array.isArray(template.presets)
  );
}

function isValidImagePreset(preset) {
  return Boolean(
    preset &&
      typeof preset.id === "string" &&
      typeof preset.name === "string" &&
      (typeof preset.imageData === "string" || typeof preset.imageKey === "string")
  );
}

function isValidImagePresetGroup(group) {
  return Boolean(
    group &&
      typeof group.id === "string" &&
      typeof group.name === "string" &&
      Array.isArray(group.presets) &&
      group.presets.every(isValidImagePreset)
  );
}

function isValidCharacterPreset(preset) {
  return Boolean(
    preset &&
      typeof preset.id === "string" &&
      typeof preset.name === "string" &&
      (typeof preset.imageData === "string" || typeof preset.imageKey === "string") &&
      typeof preset.ring === "string" &&
      (!preset.imagePresets || (Array.isArray(preset.imagePresets) && preset.imagePresets.every(isValidImagePreset))) &&
      (!preset.imagePresetGroups || (Array.isArray(preset.imagePresetGroups) && preset.imagePresetGroups.every(isValidImagePresetGroup)))
  );
}

function isValidCharacterLibrary(library) {
  return Boolean(
    library && typeof library.updatedAt === "string" && Array.isArray(library.presets) && library.presets.every(isValidCharacterPreset)
  );
}

function normalizeTemplateSummary(item) {
  if (!item || typeof item.id !== "string" || typeof item.name !== "string" || typeof item.createdAt !== "string") return null;
  return {
    id: item.id,
    name: item.name,
    createdAt: item.createdAt,
    bytes: Number.isFinite(Number(item.bytes)) ? Number(item.bytes) : 0,
    versionCount: Number.isFinite(Number(item.versionCount)) ? Number(item.versionCount) : 0,
    imageKeys: Array.isArray(item.imageKeys) ? item.imageKeys.filter((key) => typeof key === "string") : []
  };
}

function normalizeTrashSummary(item) {
  const base = normalizeTemplateSummary(item);
  if (!base || typeof item.deletedAt !== "string" || typeof item.expiresAt !== "string") return null;
  return {
    ...base,
    deletedAt: item.deletedAt,
    expiresAt: item.expiresAt
  };
}

function normalizeVersionSummary(item) {
  if (!item || typeof item.id !== "string" || typeof item.savedAt !== "string" || typeof item.name !== "string") return null;
  return {
    id: item.id,
    savedAt: item.savedAt,
    name: item.name,
    bytes: Number.isFinite(Number(item.bytes)) ? Number(item.bytes) : 0
  };
}

function summarizeTemplate(template, extras = {}) {
  return {
    id: template.id,
    name: template.name,
    createdAt: template.createdAt,
    bytes: jsonByteLength(template),
    imageKeys: [...collectImageKeys(template)],
    versionCount: 0,
    ...extras
  };
}

function summarizeTrash(record, extras = {}) {
  return {
    ...summarizeTemplate(record.template, extras),
    deletedAt: record.deletedAt,
    expiresAt: record.expiresAt
  };
}

function summarizeCharacterLibrary(library) {
  if (!library) return null;
  return {
    updatedAt: library.updatedAt,
    bytes: jsonByteLength(library),
    imageKeys: [...collectImageKeys(library)]
  };
}

async function readJson(store, key) {
  try {
    return await store.get(key, { type: "json" });
  } catch {
    return null;
  }
}

async function writeJson(store, key, value) {
  await store.setJSON(key, value);
}

function sortTemplateSummaries(items) {
  return [...items].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function sortTrashSummaries(items) {
  return [...items].sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
}

function sortVersionSummaries(items) {
  return [...items].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

async function cleanupExpiredTrash(store, roomCode) {
  const now = Date.now();
  const { blobs } = await store.list({ prefix: trashPrefix(roomCode) });
  let didDelete = false;
  await Promise.all(
    blobs.map(async (blob) => {
      const record = await readJson(store, blob.key);
      const expiresAt = Date.parse(record?.expiresAt || "");
      if (Number.isFinite(expiresAt) && expiresAt <= now) {
        didDelete = true;
        await store.delete(blob.key);
      }
    })
  );
  return didDelete;
}

async function rebuildVersionMeta(store, roomCode, templateId) {
  const { blobs } = await store.list({ prefix: versionPrefix(roomCode, templateId) });
  const versions = await Promise.all(
    blobs.map(async (blob) => {
      const record = await readJson(store, blob.key);
      if (!record?.template || !isValidTemplate(record.template) || typeof record.id !== "string" || typeof record.savedAt !== "string") return null;
      return normalizeVersionSummary({
        id: record.id,
        savedAt: record.savedAt,
        name: record.template.name,
        bytes: jsonByteLength(record.template)
      });
    })
  );
  const normalized = sortVersionSummaries(versions.filter(Boolean));
  if (normalized.length) await writeJson(store, versionMetaKey(roomCode, templateId), normalized);
  else await store.delete(versionMetaKey(roomCode, templateId));
  return normalized;
}

async function readVersionMeta(store, roomCode, templateId) {
  const existing = await readJson(store, versionMetaKey(roomCode, templateId));
  if (Array.isArray(existing)) {
    const normalized = sortVersionSummaries(existing.map(normalizeVersionSummary).filter(Boolean));
    if (normalized.length === existing.length) return normalized;
  }
  return rebuildVersionMeta(store, roomCode, templateId);
}

async function readVersionRecord(store, roomCode, templateId, versionId) {
  const record = await readJson(store, versionKey(roomCode, templateId, versionId));
  if (!record?.template || !isValidTemplate(record.template)) return null;
  return record;
}

async function saveTemplateVersion(store, roomCode, template) {
  if (!isValidTemplate(template)) return [];
  const existingMeta = await readVersionMeta(store, roomCode, template.id);
  const versionId = new Date().toISOString().replace(/[:.]/g, "-");
  const savedAt = new Date().toISOString();
  await writeJson(store, versionKey(roomCode, template.id, versionId), {
    id: versionId,
    savedAt,
    template
  });

  const versionMeta = sortVersionSummaries([
    {
      id: versionId,
      savedAt,
      name: template.name,
      bytes: jsonByteLength(template)
    },
    ...existingMeta
  ]).slice(0, MAX_TEMPLATE_VERSIONS);
  await writeJson(store, versionMetaKey(roomCode, template.id), versionMeta);

  const { blobs } = await store.list({ prefix: versionPrefix(roomCode, template.id) });
  const keepIds = new Set(versionMeta.map((item) => item.id));
  await Promise.all(
    blobs.map(async (blob) => {
      const versionIdFromKey = decodeURIComponent(blob.key.split("/").pop()?.replace(/\.json$/u, "") || "");
      if (!keepIds.has(versionIdFromKey)) await store.delete(blob.key);
    })
  );

  return versionMeta;
}

async function rebuildTemplateIndex(store, roomCode) {
  const { blobs } = await store.list({ prefix: roomPrefix(roomCode) });
  const templates = await Promise.all(blobs.map((blob) => readJson(store, blob.key)));
  const summaries = await Promise.all(
    templates.filter(isValidTemplate).map(async (template) => {
      const versionMeta = await readVersionMeta(store, roomCode, template.id);
      return summarizeTemplate(template, { versionCount: versionMeta.length });
    })
  );
  const normalized = sortTemplateSummaries(summaries);
  await writeJson(store, templateIndexKey(roomCode), normalized);
  return normalized;
}

async function rebuildTrashIndex(store, roomCode) {
  await cleanupExpiredTrash(store, roomCode);
  const { blobs } = await store.list({ prefix: trashPrefix(roomCode) });
  const records = await Promise.all(blobs.map((blob) => readJson(store, blob.key)));
  const normalized = sortTrashSummaries(
    records
      .filter((record) => record?.template && isValidTemplate(record.template))
      .map((record) => summarizeTrash(record))
  );
  await writeJson(store, trashIndexKey(roomCode), normalized);
  return normalized;
}

async function readTemplateIndex(store, roomCode) {
  const existing = await readJson(store, templateIndexKey(roomCode));
  if (Array.isArray(existing)) {
    const normalized = sortTemplateSummaries(existing.map(normalizeTemplateSummary).filter(Boolean));
    if (normalized.length === existing.length) return normalized;
  }
  return rebuildTemplateIndex(store, roomCode);
}

async function readTrashIndex(store, roomCode) {
  const deletedExpired = await cleanupExpiredTrash(store, roomCode);
  const existing = await readJson(store, trashIndexKey(roomCode));
  if (!deletedExpired && Array.isArray(existing)) {
    const normalized = sortTrashSummaries(existing.map(normalizeTrashSummary).filter(Boolean));
    if (normalized.length === existing.length) return normalized;
  }
  return rebuildTrashIndex(store, roomCode);
}

async function readTemplate(store, roomCode, templateId) {
  const template = await readJson(store, templateKey(roomCode, templateId));
  return isValidTemplate(template) ? template : null;
}

async function readTrashRecord(store, roomCode, templateId) {
  const record = await readJson(store, trashKey(roomCode, templateId));
  return record?.template && isValidTemplate(record.template) ? record : null;
}

async function readCharacterLibrary(store, roomCode) {
  const library = await readJson(store, characterLibraryKey(roomCode));
  return isValidCharacterLibrary(library) ? library : null;
}

async function readCharacterLibraryMeta(store, roomCode) {
  const meta = await readJson(store, characterLibraryMetaKey(roomCode));
  if (meta && typeof meta.updatedAt === "string" && Number.isFinite(Number(meta.bytes))) {
    return {
      updatedAt: meta.updatedAt,
      bytes: Number(meta.bytes),
      imageKeys: Array.isArray(meta.imageKeys) ? meta.imageKeys.filter((key) => typeof key === "string") : []
    };
  }
  const library = await readCharacterLibrary(store, roomCode);
  const nextMeta = summarizeCharacterLibrary(library);
  if (nextMeta) await writeJson(store, characterLibraryMetaKey(roomCode), nextMeta);
  else await store.delete(characterLibraryMetaKey(roomCode));
  return nextMeta;
}

async function readActivityLog(store, roomCode) {
  const log = await readJson(store, activityLogKey(roomCode));
  return Array.isArray(log) ? log.slice(0, MAX_ACTIVITY_LOGS) : [];
}

async function appendActivity(store, roomCode, type, targetName) {
  const current = await readActivityLog(store, roomCode);
  const entry = {
    id: createHash("sha1").update(`${Date.now()}:${type}:${targetName}:${Math.random()}`).digest("hex").slice(0, 12),
    type,
    targetName: String(targetName || ""),
    at: new Date().toISOString()
  };
  await writeJson(store, activityLogKey(roomCode), [entry, ...current].slice(0, MAX_ACTIVITY_LOGS));
}

async function updateTemplateIndex(store, roomCode, nextSummary) {
  const current = await readTemplateIndex(store, roomCode);
  const filtered = current.filter((item) => item.id !== nextSummary.id);
  const next = sortTemplateSummaries([nextSummary, ...filtered]);
  await writeJson(store, templateIndexKey(roomCode), next);
  return next;
}

async function removeTemplateIndexEntry(store, roomCode, templateId) {
  const current = await readTemplateIndex(store, roomCode);
  const next = current.filter((item) => item.id !== templateId);
  await writeJson(store, templateIndexKey(roomCode), next);
  return next;
}

async function updateTrashIndex(store, roomCode, nextSummary) {
  const current = await readTrashIndex(store, roomCode);
  const filtered = current.filter((item) => item.id !== nextSummary.id);
  const next = sortTrashSummaries([nextSummary, ...filtered]);
  await writeJson(store, trashIndexKey(roomCode), next);
  return next;
}

async function removeTrashIndexEntry(store, roomCode, templateId) {
  const current = await readTrashIndex(store, roomCode);
  const next = current.filter((item) => item.id !== templateId);
  await writeJson(store, trashIndexKey(roomCode), next);
  return next;
}

async function roomPayload(store, roomCode, options = {}) {
  const templateLimit = Number.parseInt(String(options.templateLimit ?? "0"), 10);
  const includeTrash = options.includeTrash !== false;
  const includeActivity = options.includeActivity !== false;
  const templates = await readTemplateIndex(store, roomCode);
  const visibleTemplates = Number.isFinite(templateLimit) && templateLimit > 0 ? templates.slice(0, templateLimit) : templates;
  const trashedTemplates = includeTrash ? await readTrashIndex(store, roomCode) : [];
  const characterPresetLibraryMeta = await readCharacterLibraryMeta(store, roomCode);
  const activityLog = includeActivity ? await readActivityLog(store, roomCode) : [];
  const hiddenTrashCount = includeTrash ? trashedTemplates.length : (await readTrashIndex(store, roomCode)).length;

  return {
    templates: visibleTemplates,
    trashedTemplates,
    characterPresetLibraryMeta: characterPresetLibraryMeta
      ? { updatedAt: characterPresetLibraryMeta.updatedAt, bytes: characterPresetLibraryMeta.bytes }
      : null,
    activityLog,
    usage: {
      characterLibraryBytes: characterPresetLibraryMeta?.bytes ?? 0,
      characterLibraryLimitBytes: MAX_CHARACTER_LIBRARY_BYTES,
      templatesBytes: templates.reduce((total, template) => total + (template.bytes || 0), 0),
      templatesCount: templates.length,
      trashedTemplatesCount: hiddenTrashCount,
      maxTemplates: MAX_TEMPLATES_PER_ROOM,
      maxTemplateBytes: MAX_TEMPLATE_BYTES
    }
  };
}

function requestOptionsFromQuery(url) {
  return {
    templateLimit: url.searchParams.get("templateLimit") || "0",
    includeTrash: url.searchParams.get("includeTrash") !== "0",
    includeActivity: url.searchParams.get("includeActivity") !== "0"
  };
}

function requestOptionsFromBody(body) {
  return {
    templateLimit: body?.requestOptions?.templateLimit || "0",
    includeTrash: body?.requestOptions?.includeTrash !== "0",
    includeActivity: body?.requestOptions?.includeActivity !== "0"
  };
}

export default async (request) => {
  if (request.method === "OPTIONS") return json(204, {});

  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const url = new URL(request.url);

  try {
    const requestBody = request.method === "GET" ? null : await request.clone().json();
    const roomCode = normalizeRoomCode(request.method === "GET" ? url.searchParams.get("roomCode") : requestBody?.roomCode);
    const roomError = validateRoomCode(roomCode);
    if (roomError) return json(400, { error: roomError });

    if (request.method === "GET") {
      const requestOptions = requestOptionsFromQuery(url);
      const templateId = url.searchParams.get("templateId");
      if (templateId) {
        const template = await readTemplate(store, roomCode, templateId);
        if (!template) return json(404, { error: "템플릿을 찾을 수 없습니다." });
        return json(200, { template });
      }

      const versionsFor = url.searchParams.get("versionsFor");
      if (versionsFor) {
        return json(200, { versions: await readVersionMeta(store, roomCode, versionsFor) });
      }

      if (url.searchParams.get("library") === "1") {
        const characterPresetLibrary = await readCharacterLibrary(store, roomCode);
        return json(200, { characterPresetLibrary, ...(await roomPayload(store, roomCode, requestOptions)) });
      }

      return json(200, await roomPayload(store, roomCode, requestOptions));
    }

    const body = requestBody ?? (await request.json());
    const requestOptions = requestOptionsFromBody(body);

    if (request.method === "POST") {
      const restoreTemplateId = String(body.restoreTemplateId || "");
      if (restoreTemplateId) {
        const record = await readTrashRecord(store, roomCode, restoreTemplateId);
        if (!record) return json(404, { error: "복구할 템플릿을 찾을 수 없습니다." });

        const currentIndex = await readTemplateIndex(store, roomCode);
        if (!currentIndex.some((item) => item.id === restoreTemplateId) && currentIndex.length >= MAX_TEMPLATES_PER_ROOM) {
          return json(400, { error: `접속코드 하나에는 템플릿을 최대 ${MAX_TEMPLATES_PER_ROOM}개까지 저장할 수 있습니다.` });
        }

        await writeJson(store, templateKey(roomCode, restoreTemplateId), record.template);
        await store.delete(trashKey(roomCode, restoreTemplateId));
        const versionMeta = await readVersionMeta(store, roomCode, restoreTemplateId);
        await updateTemplateIndex(store, roomCode, summarizeTemplate(record.template, { versionCount: versionMeta.length }));
        await removeTrashIndexEntry(store, roomCode, restoreTemplateId);
        await appendActivity(store, roomCode, "restore", record.template.name);
        return json(200, await roomPayload(store, roomCode, requestOptions));
      }

      const restoreVersionTemplateId = String(body.restoreVersionTemplateId || "");
      if (restoreVersionTemplateId) {
        const versionMeta = await readVersionMeta(store, roomCode, restoreVersionTemplateId);
        const versionId = String(body.versionId || "");
        const selected = versionId ? versionMeta.find((item) => item.id === versionId) : versionMeta[0];
        if (!selected) return json(404, { error: "복원할 이전 버전을 찾을 수 없습니다." });

        const record = await readVersionRecord(store, roomCode, restoreVersionTemplateId, selected.id);
        if (!record?.template) return json(404, { error: "복원할 이전 버전 데이터를 찾을 수 없습니다." });

        const current = await readTemplate(store, roomCode, restoreVersionTemplateId);
        let nextVersionMeta = versionMeta;
        if (current) nextVersionMeta = await saveTemplateVersion(store, roomCode, current);
        await writeJson(store, templateKey(roomCode, restoreVersionTemplateId), record.template);
        await updateTemplateIndex(store, roomCode, summarizeTemplate(record.template, { versionCount: nextVersionMeta.length }));
        await appendActivity(store, roomCode, "revert", record.template.name);
        return json(200, await roomPayload(store, roomCode, requestOptions));
      }

      if (body.characterPresetLibrary !== undefined) {
        const characterPresetLibrary = body.characterPresetLibrary;
        if (!isValidCharacterLibrary(characterPresetLibrary)) {
          return json(400, { error: "저장할 캐릭터 프리셋 형식이 올바르지 않습니다." });
        }

        const libraryBytes = jsonByteLength(characterPresetLibrary);
        if (libraryBytes > MAX_CHARACTER_LIBRARY_BYTES) {
          return json(413, { error: "캐릭터 프리셋은 5MB 이하로 저장할 수 있습니다." });
        }

        const meta = summarizeCharacterLibrary(characterPresetLibrary);
        await writeJson(store, characterLibraryKey(roomCode), characterPresetLibrary);
        if (meta) await writeJson(store, characterLibraryMetaKey(roomCode), meta);
        await appendActivity(store, roomCode, "saveLibrary", "캐릭터 프리셋");
        return json(200, await roomPayload(store, roomCode, requestOptions));
      }

      const template = body.template;
      if (!isValidTemplate(template)) return json(400, { error: "저장할 템플릿 형식이 올바르지 않습니다." });

      const templateBytes = jsonByteLength(template);
      if (templateBytes > MAX_TEMPLATE_BYTES) {
        return json(413, { error: "템플릿 하나는 1MB 이하로 저장할 수 있습니다." });
      }

      const currentIndex = await readTemplateIndex(store, roomCode);
      const previous = await readTemplate(store, roomCode, template.id);
      const isUpdate = Boolean(previous);
      if (!isUpdate && currentIndex.length >= MAX_TEMPLATES_PER_ROOM) {
        return json(400, { error: `접속코드 하나에는 템플릿을 최대 ${MAX_TEMPLATES_PER_ROOM}개까지 저장할 수 있습니다.` });
      }

      let versionMeta = await readVersionMeta(store, roomCode, template.id);
      if (previous) versionMeta = await saveTemplateVersion(store, roomCode, previous);
      await store.delete(trashKey(roomCode, template.id));
      await writeJson(store, templateKey(roomCode, template.id), template);
      await updateTemplateIndex(store, roomCode, summarizeTemplate(template, { versionCount: versionMeta.length }));
      await removeTrashIndexEntry(store, roomCode, template.id);
      await appendActivity(store, roomCode, isUpdate ? "update" : "create", template.name);
      return json(200, await roomPayload(store, roomCode, requestOptions));
    }

    if (request.method === "DELETE") {
      const templateId = String(body.templateId || "");
      if (!templateId) return json(400, { error: "삭제할 템플릿을 찾을 수 없습니다." });

      const template = await readTemplate(store, roomCode, templateId);
      if (!template) return json(404, { error: "삭제할 템플릿을 찾을 수 없습니다." });

      const deletedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + TRASH_RETENTION_MS).toISOString();
      const record = { deletedAt, expiresAt, template };
      await writeJson(store, trashKey(roomCode, templateId), record);
      await store.delete(templateKey(roomCode, templateId));
      await removeTemplateIndexEntry(store, roomCode, templateId);
      await updateTrashIndex(store, roomCode, summarizeTrash(record));
      await appendActivity(store, roomCode, "trash", template.name);
      return json(200, await roomPayload(store, roomCode, requestOptions));
    }

    return json(405, { error: "지원하지 않는 요청입니다." });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "템플릿 저장소 요청에 실패했습니다." });
  }
};
