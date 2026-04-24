const roomUploadCache = new Map<string, Map<string, Promise<unknown>>>();

export function getCachedRoomUpload<T>(roomCode: string, imageData: string, upload: () => Promise<T>): Promise<T> {
  if (!roomCode || !imageData) return upload();
  let roomCache = roomUploadCache.get(roomCode);
  if (!roomCache) {
    roomCache = new Map<string, Promise<unknown>>();
    roomUploadCache.set(roomCode, roomCache);
  }
  const cached = roomCache.get(imageData);
  if (cached) return cached as Promise<T>;

  const nextPromise = upload().catch((error) => {
    roomCache?.delete(imageData);
    throw error;
  });
  roomCache.set(imageData, nextPromise as Promise<unknown>);
  return nextPromise;
}
