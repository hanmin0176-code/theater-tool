import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "theater-templates";
const MAX_ROOM_CODE_LENGTH = 40;
const MIN_ROOM_CODE_LENGTH = 6;
const MAX_TEMPLATES_PER_ROOM = 50;
const MAX_TEMPLATE_BYTES = 1_000_000;

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
const roomPrefix = (roomCode) => `rooms/${roomHash(roomCode)}/templates/`;
const templateKey = (roomCode, templateId) => `${roomPrefix(roomCode)}${encodeURIComponent(templateId)}.json`;

const isValidTemplate = (template) =>
  template &&
  typeof template.id === "string" &&
  typeof template.name === "string" &&
  typeof template.createdAt === "string" &&
  template.data &&
  Array.isArray(template.data.blocks) &&
  Array.isArray(template.presets);

const readTemplates = async (store, roomCode) => {
  const { blobs } = await store.list({ prefix: roomPrefix(roomCode) });
  const templates = await Promise.all(
    blobs.map(async (blob) => {
      try {
        return await store.get(blob.key, { type: "json" });
      } catch {
        return null;
      }
    })
  );

  return templates
    .filter(isValidTemplate)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export default async (request) => {
  if (request.method === "OPTIONS") return json(204, {});

  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const url = new URL(request.url);

  try {
    if (request.method === "GET") {
      const roomCode = normalizeRoomCode(url.searchParams.get("roomCode"));
      const error = validateRoomCode(roomCode);
      if (error) return json(400, { error });

      return json(200, { templates: await readTemplates(store, roomCode) });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const roomCode = normalizeRoomCode(body.roomCode);
      const error = validateRoomCode(roomCode);
      if (error) return json(400, { error });

      const template = body.template;
      if (!isValidTemplate(template)) return json(400, { error: "저장할 템플릿 형식이 올바르지 않습니다." });

      const serialized = JSON.stringify(template);
      if (new TextEncoder().encode(serialized).length > MAX_TEMPLATE_BYTES) {
        return json(413, { error: "템플릿 하나는 1MB 이하로 저장할 수 있습니다." });
      }

      const existing = await readTemplates(store, roomCode);
      const isUpdate = existing.some((item) => item.id === template.id);
      if (!isUpdate && existing.length >= MAX_TEMPLATES_PER_ROOM) {
        return json(400, { error: `접속코드 하나에는 템플릿을 최대 ${MAX_TEMPLATES_PER_ROOM}개까지 저장할 수 있습니다.` });
      }

      await store.setJSON(templateKey(roomCode, template.id), template);
      return json(200, { templates: await readTemplates(store, roomCode) });
    }

    if (request.method === "DELETE") {
      const body = await request.json();
      const roomCode = normalizeRoomCode(body.roomCode);
      const error = validateRoomCode(roomCode);
      if (error) return json(400, { error });

      const templateId = String(body.templateId || "");
      if (!templateId) return json(400, { error: "삭제할 템플릿을 찾을 수 없습니다." });

      await store.delete(templateKey(roomCode, templateId));
      return json(200, { templates: await readTemplates(store, roomCode) });
    }

    return json(405, { error: "지원하지 않는 요청입니다." });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "템플릿 저장소 요청에 실패했습니다." });
  }
};
