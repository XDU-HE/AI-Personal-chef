function randomBytes(length) {
  const bytes = new Uint8Array(length);
  const cryptoProvider = globalThis.crypto;

  if (typeof cryptoProvider?.getRandomValues === "function") {
    cryptoProvider.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

export function createUuid() {
  const cryptoProvider = globalThis.crypto;
  if (typeof cryptoProvider?.randomUUID === "function") {
    try {
      return cryptoProvider.randomUUID();
    } catch {
      // Fall through for older or restricted browser contexts.
    }
  }

  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hexadecimal = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hexadecimal.slice(0, 4).join(""),
    hexadecimal.slice(4, 6).join(""),
    hexadecimal.slice(6, 8).join(""),
    hexadecimal.slice(8, 10).join(""),
    hexadecimal.slice(10, 16).join(""),
  ].join("-");
}

export const generateUuid = createUuid;
