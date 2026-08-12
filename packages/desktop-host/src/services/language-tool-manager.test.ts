import assert from "node:assert/strict";
import test from "node:test";
import { LanguageToolManager } from "./language-tool-manager.js";

test("starts bundled LanguageTool with bundled Java and stops the child process", async () => {
  let executable = "";
  let argumentsList: readonly string[] = [];
  let killed = false;
  const manager = new LanguageToolManager("C:\\resources", 8081, {
    exists: () => true,
    spawn: (file, args) => {
      executable = file;
      argumentsList = args;
      return { kill: () => { killed = true; } };
    },
    waitUntilReady: async () => true
  });

  assert.equal(await manager.start(), true);
  assert.match(executable, /jre[\\/]bin[\\/]java\.exe$/u);
  assert.deepEqual(argumentsList.slice(-4), ["--port", "8081", "--allow-origin", "https://localhost:3847"]);
  manager.stop();
  assert.equal(killed, true);
});

test("does not spawn when bundled resources are absent", async () => {
  const manager = new LanguageToolManager("C:\\missing", 8081, {
    exists: () => false,
    spawn: () => { throw new Error("must not spawn"); },
    waitUntilReady: async () => false
  });
  assert.equal(await manager.start(), false);
});
