import * as Y from 'yjs';
import Room from './models/Room.js';

const debounceMap = new Map();

export const setupYjsPersistence = (ySocketIO) => {
  ySocketIO.on('document-loaded', async (doc) => {
    try {
      const room = await Room.findOne({ roomId: doc.name });
      if (room && room.documentState) {
        Y.applyUpdate(doc, new Uint8Array(room.documentState));
      }
    } catch (err) {
      console.error(err);
    }

    doc.on('update', () => {
      if (debounceMap.has(doc.name)) {
        clearTimeout(debounceMap.get(doc.name));
      }

      const timeoutId = setTimeout(async () => {
        debounceMap.delete(doc.name);
        try {
          const state = Y.encodeStateAsUpdate(doc);
          await Room.findOneAndUpdate(
            { roomId: doc.name },
            { documentState: Buffer.from(state) },
            { upsert: true }
          );
        } catch (err) {
          console.error(err);
        }
      }, 2000);

      debounceMap.set(doc.name, timeoutId);
    });

    doc.on('destroy', () => {
      if (debounceMap.has(doc.name)) {
        clearTimeout(debounceMap.get(doc.name));
        debounceMap.delete(doc.name);
      }
    });
  });
};
