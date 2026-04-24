import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "theater-images";
const TEMPLATE_STORE_NAME = "theater-templates";
const PUBLIC_SAMPLE_ROOM_CODE = "000000";
const MAX_ROOM_CODE_LENGTH = 40;
const MIN_ROOM_CODE_LENGTH = 6;
const MAX_IMAGE_BYTES = 1_500_000;
const ADMIN_MAX_IMAGE_BYTES = 25_000_000;
const DEFAULT_ROOM_IMAGE_LIMIT_BYTES = 100_000_000;
const ADMIN_ROOM_IMAGE_LIMIT_BYTES = 1_000_000_000;
const RATE_WINDOW_MS = 60_000;
const MAX_UPLOADS_PER_WINDOW = 60;
const MAX_UPLOAD_BYTES_PER_WINDOW = 25_000_000;
const TEMP_IMAGE_TTL_MS = 24 * 60 * 60 * 1000;
const IMAGE_KEY_PATTERN = /^images\/[a-f0-9]{64}\.(webp|jpg|jpeg|png|gif)$/;

const json = (status, body) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const normalizeRoomCode = (value) => String(value || "").trim().replace(/\s+/g, " ");
const roomHash = (roomCode) => createHash("sha256").update(roomCode, "utf8").digest("hex").slice(0, 32);
const roomRoot = (roomCode) => `rooms/${roomHash(roomCode)}/`;
const roomPrefix = (roomCode) => `${roomRoot(roomCode)}templates/`;
const roomImagePrefix = (roomCode) => `${roomRoot(roomCode)}images/`;
const roomRateKey = (roomCode, windowId) => `${roomRoot(roomCode)}rate/upload-${windowId}.json`;
const templateIndexKey = (roomCode) => `${roomRoot(roomCode)}template-index.json`;
const characterLibraryKey = (roomCode) => `${roomRoot(roomCode)}character-library.json`;
const characterLibraryMetaKey = (roomCode) => `${roomRoot(roomCode)}character-library-meta.json`;
const imageManifestKey = (roomCode, imageKey) => `${roomImagePrefix(roomCode)}${encodeURIComponent(imageKey)}.json`;
const adminRoomCodes = () => new Set(String(process.env.THEATER_ADMIN_CODES || "").split(",").map(normalizeRoomCode).filter(Boolean));
const isAdminRoom = (roomCode) => adminRoomCodes().has(roomCode);
const roomImageLimitBytes = (roomCode) => (isAdminRoom(roomCode) ? ADMIN_ROOM_IMAGE_LIMIT_BYTES : DEFAULT_ROOM_IMAGE_LIMIT_BYTES);

const validateRoomCode = (roomCode) => {
  const length = Array.from(roomCode).length;
  if (length < MIN_ROOM_CODE_LENGTH) return "접속코드는 6글자 이상이어야 합니다.";
  if (length > MAX_ROOM_CODE_LENGTH) return "접속코드는 40글자 이하로 입력해주세요.";
  return "";
};

const parseDataUrl = (dataUrl) => {
  const match = /^data:(image\/(?:webp|jpeg|jpg|png|gif));base64,([a-zA-Z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!match) return null;
  const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  return { mimeType, buffer };
};

const hasImageSignature = ({ mimeType, buffer }) => {
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/gif") return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
};

const extensionForMimeType = (mimeType) => {
  if (mimeType === "image/jpeg") return "jpg";
  return mimeType.replace("image/", "");
};

const collectImageKeys = (value, keys = new Set()) => {
  if (!value || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageKeys(item, keys));
    return keys;
  }
  if (typeof value.imageKey === "string" && IMAGE_KEY_PATTERN.test(value.imageKey)) keys.add(value.imageKey);
  Object.values(value).forEach((item) => collectImageKeys(item, keys));
  return keys;
};

const metadataBytes = (metadata) => {
  const raw = metadata?.bytes ?? metadata?.metadata?.bytes;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const readTemplates = async (templateStore, roomCode) => {
  const { blobs } = await templateStore.list({ prefix: roomPrefix(roomCode) });
  return Promise.all(
    blobs.map(async (blob) => {
      try {
        return await templateStore.get(blob.key, { type: "json" });
      } catch {
        return null;
      }
    })
  );
};

const readJson = async (store, key) => {
  try {
    return await store.get(key, { type: "json" });
  } catch {
    return null;
  }
};

const getRoomReferencedImageKeys = async (templateStore, roomCode) => {
  const templateIndex = await readJson(templateStore, templateIndexKey(roomCode));
  const libraryMeta = await readJson(templateStore, characterLibraryMetaKey(roomCode));
  if (Array.isArray(templateIndex)) {
    const keys = new Set();
    templateIndex.forEach((item) => {
      if (Array.isArray(item?.imageKeys)) item.imageKeys.filter((key) => typeof key === "string").forEach((key) => keys.add(key));
    });
    if (Array.isArray(libraryMeta?.imageKeys)) libraryMeta.imageKeys.filter((key) => typeof key === "string").forEach((key) => keys.add(key));
    return keys;
  }

  const keys = new Set();
  const templates = await readTemplates(templateStore, roomCode);
  templates.forEach((template) => collectImageKeys(template, keys));
  try {
    collectImageKeys(await templateStore.get(characterLibraryKey(roomCode), { type: "json" }), keys);
  } catch {
    // No character preset library has been saved yet.
  }
  return keys;
};

const getGlobalReferencedImageKeys = async (templateStore) => {
  const keys = new Set();
  const { blobs } = await templateStore.list({ prefix: "rooms/" });
  const dataBlobs = blobs.filter((blob) => blob.key.endsWith("/template-index.json") || blob.key.endsWith("/character-library-meta.json"));
  await Promise.all(
    dataBlobs.map(async (blob) => {
      try {
        const data = await templateStore.get(blob.key, { type: "json" });
        if (Array.isArray(data)) {
          data.forEach((item) => {
            if (Array.isArray(item?.imageKeys)) item.imageKeys.filter((key) => typeof key === "string").forEach((key) => keys.add(key));
          });
          return;
        }
        if (Array.isArray(data?.imageKeys)) data.imageKeys.filter((key) => typeof key === "string").forEach((key) => keys.add(key));
      } catch {
        // Ignore malformed or deleted records.
      }
    })
  );
  return keys;
};

const readRoomImageManifests = async (templateStore, roomCode) => {
  const { blobs } = await templateStore.list({ prefix: roomImagePrefix(roomCode) });
  const manifests = await Promise.all(
    blobs.map(async (blob) => {
      try {
        return { key: blob.key, data: await templateStore.get(blob.key, { type: "json" }) };
      } catch {
        return null;
      }
    })
  );
  return manifests.filter((manifest) => manifest?.data?.imageKey && IMAGE_KEY_PATTERN.test(manifest.data.imageKey));
};

const getImageBytes = async (imageStore, imageKey) => {
  const metadata = await imageStore.getMetadata(imageKey);
  if (!metadata) return null;
  const metaBytes = metadataBytes(metadata);
  if (metaBytes) return metaBytes;
  const data = await imageStore.get(imageKey, { type: "arrayBuffer" });
  return data?.byteLength ?? 0;
};

const hasRecentUploadManifest = async (templateStore, imageKey) => {
  const encoded = `${encodeURIComponent(imageKey)}.json`;
  const { blobs } = await templateStore.list({ prefix: "rooms/" });
  const manifestBlobs = blobs.filter((blob) => blob.key.endsWith(`/images/${encoded}`));
  const now = Date.now();
  for (const blob of manifestBlobs) {
    try {
      const manifest = await templateStore.get(blob.key, { type: "json" });
      const uploadedAt = Date.parse(manifest?.uploadedAt || "");
      if (Number.isFinite(uploadedAt) && now - uploadedAt <= TEMP_IMAGE_TTL_MS) return true;
    } catch {
      // Ignore malformed manifests.
    }
  }
  return false;
};

const deleteImageIfGloballyUnreferenced = async (imageStore, templateStore, imageKey) => {
  const globalReferences = await getGlobalReferencedImageKeys(templateStore);
  if (globalReferences.has(imageKey)) return false;
  if (await hasRecentUploadManifest(templateStore, imageKey)) return false;
  await imageStore.delete(imageKey);
  return true;
};

const cleanupRoomTemporaryImages = async (imageStore, templateStore, roomCode) => {
  const now = Date.now();
  const referencedKeys = await getRoomReferencedImageKeys(templateStore, roomCode);
  const manifests = await readRoomImageManifests(templateStore, roomCode);
  const stale = manifests.filter((manifest) => {
    const uploadedAt = Date.parse(manifest.data.uploadedAt || "");
    return !referencedKeys.has(manifest.data.imageKey) && Number.isFinite(uploadedAt) && now - uploadedAt > TEMP_IMAGE_TTL_MS;
  });

  let cleanedImages = 0;
  await Promise.all(
    stale.map(async (manifest) => {
      await templateStore.delete(manifest.key);
      if (await deleteImageIfGloballyUnreferenced(imageStore, templateStore, manifest.data.imageKey)) cleanedImages += 1;
    })
  );
  return cleanedImages;
};

const getRoomImageUsage = async (imageStore, roomCode) => {
  const templateStore = getStore({ name: TEMPLATE_STORE_NAME, consistency: "strong" });
  await cleanupRoomTemporaryImages(imageStore, templateStore, roomCode);

  const referencedKeys = await getRoomReferencedImageKeys(templateStore, roomCode);
  const manifests = await readRoomImageManifests(templateStore, roomCode);
  const temporaryKeys = new Set(manifests.map((manifest) => manifest.data.imageKey).filter((imageKey) => !referencedKeys.has(imageKey)));
  const keys = new Set([...referencedKeys, ...temporaryKeys]);

  let imageBytes = 0;
  let temporaryImageBytes = 0;
  let missingImages = 0;
  await Promise.all(
    [...keys].map(async (imageKey) => {
      const bytes = await getImageBytes(imageStore, imageKey);
      if (bytes === null) {
        missingImages += 1;
        return;
      }
      imageBytes += bytes;
      if (temporaryKeys.has(imageKey)) temporaryImageBytes += bytes;
    })
  );

  return {
    imageBytes,
    imageCount: keys.size,
    temporaryImageBytes,
    temporaryImageCount: temporaryKeys.size,
    referencedImageCount: referencedKeys.size,
    missingImages,
    imageLimitBytes: roomImageLimitBytes(roomCode)
  };
};

const checkUploadRate = async (templateStore, roomCode, bytes) => {
  if (isAdminRoom(roomCode)) return null;
  const now = Date.now();
  const windowId = Math.floor(now / RATE_WINDOW_MS);
  const key = roomRateKey(roomCode, windowId);
  const current = (await templateStore.get(key, { type: "json" }).catch(() => null)) || { count: 0, bytes: 0, resetAt: (windowId + 1) * RATE_WINDOW_MS };
  if (current.count + 1 > MAX_UPLOADS_PER_WINDOW || current.bytes + bytes > MAX_UPLOAD_BYTES_PER_WINDOW) {
    return {
      error: "같은 접속코드에서 이미지 업로드가 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
      resetAt: current.resetAt
    };
  }
  await templateStore.setJSON(key, { count: current.count + 1, bytes: current.bytes + bytes, resetAt: current.resetAt });
  return null;
};

export default async (request) => {
  if (request.method === "OPTIONS") return json(204, {});

  const imageStore = getStore({ name: STORE_NAME, consistency: "strong" });
  const templateStore = getStore({ name: TEMPLATE_STORE_NAME, consistency: "strong" });
  const url = new URL(request.url);

  try {
    if (request.method === "GET") {
      if (url.searchParams.get("usage") === "1") {
        const roomCode = normalizeRoomCode(url.searchParams.get("roomCode"));
        const error = validateRoomCode(roomCode);
        if (error) return json(400, { error });
        return json(200, { usage: await getRoomImageUsage(imageStore, roomCode) });
      }

      const imageKey = String(url.searchParams.get("key") || "");
      if (!IMAGE_KEY_PATTERN.test(imageKey)) return json(400, { error: "이미지 키가 올바르지 않습니다." });

      const [data, metadata] = await Promise.all([imageStore.get(imageKey, { type: "arrayBuffer" }), imageStore.getMetadata(imageKey)]);
      if (!data) return json(404, { error: "이미지를 찾을 수 없습니다." });

      return new Response(data, {
        status: 200,
        headers: {
          "content-type": metadata?.contentType || metadata?.metadata?.contentType || "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable"
        }
      });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const roomCode = normalizeRoomCode(body.roomCode);
      const error = validateRoomCode(roomCode);
      if (error) return json(400, { error });
      if (roomCode === PUBLIC_SAMPLE_ROOM_CODE && !isAdminRoom(roomCode)) return json(403, { error: "000000 샘플 코드는 이미지 업로드가 금지되어 있습니다." });

      const parsed = parseDataUrl(body.imageData);
      if (!parsed) return json(400, { error: "저장할 이미지 형식이 올바르지 않습니다." });
      if (!hasImageSignature(parsed)) return json(400, { error: "이미지 파일 내용이 올바르지 않습니다." });

      const maxImageBytes = isAdminRoom(roomCode) ? ADMIN_MAX_IMAGE_BYTES : MAX_IMAGE_BYTES;
      if (parsed.buffer.byteLength > maxImageBytes) return json(413, { error: `이미지는 1장당 ${Math.round(maxImageBytes / 1_000_000)}MB 이하로 저장할 수 있습니다.` });

      const rateError = await checkUploadRate(templateStore, roomCode, parsed.buffer.byteLength);
      if (rateError) return json(429, rateError);

      const hash = createHash("sha256").update(parsed.buffer).digest("hex");
      const imageKey = `images/${hash}.${extensionForMimeType(parsed.mimeType)}`;
      const existingManifest = await templateStore.get(imageManifestKey(roomCode, imageKey), { type: "json" }).catch(() => null);
      const referencedKeys = await getRoomReferencedImageKeys(templateStore, roomCode);
      const roomAlreadyHasImage = Boolean(existingManifest) || referencedKeys.has(imageKey);
      const usage = await getRoomImageUsage(imageStore, roomCode);
      const wouldAddBytes = roomAlreadyHasImage ? 0 : parsed.buffer.byteLength;
      if (usage.imageBytes + wouldAddBytes > usage.imageLimitBytes && !isAdminRoom(roomCode)) {
        return json(413, { error: `접속코드당 이미지 저장량은 ${Math.round(DEFAULT_ROOM_IMAGE_LIMIT_BYTES / 1_000_000)}MB 이하로 제한됩니다.` });
      }

      const existing = await imageStore.getMetadata(imageKey);
      if (!existing) {
        await imageStore.set(imageKey, parsed.buffer, {
          metadata: {
            contentType: parsed.mimeType,
            bytes: parsed.buffer.byteLength,
            uploadedAt: new Date().toISOString()
          }
        });
      }

      await templateStore.setJSON(imageManifestKey(roomCode, imageKey), {
        imageKey,
        bytes: existing ? metadataBytes(existing) || parsed.buffer.byteLength : parsed.buffer.byteLength,
        uploadedAt: new Date().toISOString()
      });

      return json(200, {
        imageKey,
        imageUrl: `/.netlify/functions/images?key=${encodeURIComponent(imageKey)}`,
        bytes: parsed.buffer.byteLength,
        mimeType: parsed.mimeType
      });
    }

    return json(405, { error: "지원하지 않는 요청입니다." });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "이미지 저장소 요청에 실패했습니다." });
  }
};
