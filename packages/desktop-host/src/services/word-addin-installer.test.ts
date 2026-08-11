import assert from "node:assert/strict";
import test from "node:test";
import { parseWordExecutable } from "./word-addin-installer.js";

test("Word executable is parsed from localized reg.exe output", () => {
  const output = `HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Winword.exe\r\n    (По умолчанию)    REG_SZ    C:\\Program Files\\Microsoft Office\\Root\\Office16\\WINWORD.EXE\r\n`;
  assert.equal(parseWordExecutable(output), "C:\\Program Files\\Microsoft Office\\Root\\Office16\\WINWORD.EXE");
});

test("missing registry value returns undefined", () => {
  assert.equal(parseWordExecutable("ERROR: system could not find the key"), undefined);
});
