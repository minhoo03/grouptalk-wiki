/**
 * Reads a File/Blob in fixed-size byte chunks and decodes them as UTF-8.
 *
 * A Korean character is 3 bytes in UTF-8, so a byte boundary can fall in the middle
 * of a character. `TextDecoder` in `stream: true` mode keeps the incomplete trailing
 * bytes and prepends them to the next chunk, so no character is ever corrupted.
 * Line boundaries are handled one level up by `ChatStreamParser`, which buffers the
 * unfinished last line of every chunk.
 */

export const DEFAULT_CHUNK_BYTES = 1024 * 1024;

export interface Utf8ChunkDecoder {
  decode: (bytes: Uint8Array) => string;
  flush: () => string;
}

export function createUtf8Decoder(): Utf8ChunkDecoder {
  const decoder = new TextDecoder("utf-8");
  return {
    decode: (bytes) => decoder.decode(bytes, { stream: true }),
    flush: () => decoder.decode(),
  };
}

export interface FileChunk {
  text: string;
  bytesRead: number;
}

export async function* readFileChunks(
  blob: Blob,
  chunkBytes = DEFAULT_CHUNK_BYTES,
): AsyncGenerator<FileChunk> {
  const decoder = createUtf8Decoder();
  for (let offset = 0; offset < blob.size; offset += chunkBytes) {
    const end = Math.min(offset + chunkBytes, blob.size);
    const buffer = await blob.slice(offset, end).arrayBuffer();
    yield { text: decoder.decode(new Uint8Array(buffer)), bytesRead: end };
  }
  const tail = decoder.flush();
  if (tail) yield { text: tail, bytesRead: blob.size };
}
