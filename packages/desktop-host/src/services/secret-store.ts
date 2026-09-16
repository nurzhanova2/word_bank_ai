/** Keeps credentials outside the ordinary, user-readable connection file. */
export interface SecretStore {
  getApiKey(): Promise<string | null>;
  setApiKey(value: string): Promise<void>;
  deleteApiKey(): Promise<void>;
}

/** Stores only the DPAPI-encrypted blob; the plaintext never reaches .env. */
export function createFileSecretStorage(filePath: string): { get(key: string): Buffer | undefined; set(key: string, value: Buffer): void; delete(key: string): void } {
  const read = (): Record<string, string> => {
    try { return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, string>; }
    catch { return {}; }
  };
  const write = (values: Record<string, string>): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(values), { encoding: "utf8", mode: 0o600 });
  };
  return {
    get: (key) => { const value = read()[key]; return value ? Buffer.from(value, "base64") : undefined; },
    set: (key, value) => { const values = read(); values[key] = value.toString("base64"); write(values); },
    delete: (key) => { const values = read(); delete values[key]; write(values); }
  };
}

/** A deliberately small adapter around Electron safeStorage (Windows DPAPI). */
export function createSafeStorageSecretStore(safeStorage: {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}, storage: { get(key: string): Buffer | undefined; set(key: string, value: Buffer): void; delete(key: string): void }, key = "bank-ai.llm-api-key"): SecretStore {
  return {
    async getApiKey() {
      const encrypted = storage.get(key);
      if (!encrypted) return null;
      if (!safeStorage.isEncryptionAvailable()) throw new Error("Защищённое хранилище Windows недоступно.");
      return safeStorage.decryptString(encrypted);
    },
    async setApiKey(value) {
      if (!value) throw new Error("API-ключ не может быть пустым.");
      if (!safeStorage.isEncryptionAvailable()) throw new Error("Защищённое хранилище Windows недоступно.");
      storage.set(key, safeStorage.encryptString(value));
    },
    async deleteApiKey() { storage.delete(key); }
  };
}
import fs from "node:fs";
import path from "node:path";
