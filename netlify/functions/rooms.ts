import { getStore } from "@netlify/blobs";
import {
  handleRoomRequest,
  type RoomStore,
  type SharedRoom,
} from "../../src/rooms.js";

export default async function handler(request: Request): Promise<Response> {
  const blobs = getStore("pixel-pairs-temporary-rooms");
  if (request.method === "POST") {
    const body = (await request.clone().json().catch(() => null)) as
      | { action?: string }
      | null;
    if (body?.action === "create") {
      const { blobs: entries } = await blobs.list();
      await Promise.all(
        entries.map(async ({ key }) => {
          const room = (await blobs.get(key, { type: "json" })) as SharedRoom | null;
          if (room && room.expiresAt <= Date.now()) await blobs.delete(key);
        }),
      );
    }
  }
  const store: RoomStore = {
    get: async (code) =>
      (await blobs.get(code, { type: "json" })) as SharedRoom | null,
    set: async (room) => {
      await blobs.setJSON(room.code, room);
    },
    delete: async (code) => {
      await blobs.delete(code);
    },
  };
  return handleRoomRequest(request, store);
}