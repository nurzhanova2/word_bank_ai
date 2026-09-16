import assert from "node:assert/strict";
import test from "node:test";
import { detectUnsupportedWordStructures } from "./word-adapter.js";

test("plain Word OOXML is allowed for whole-document processing", () => {
  assert.deepEqual(detectUnsupportedWordStructures("<w:document><w:body><w:p><w:r><w:t>Текст</w:t></w:r></w:p></w:body></w:document>"), []);
});

for (const [name, ooxml, expected] of [
  ["table", "<w:tbl><w:tr/></w:tbl>", "table"],
  ["field", "<w:fldChar w:fldCharType=\"begin\"/>", "field"],
  ["content control", "<w:sdt><w:sdtContent/></w:sdt>", "contentControl"],
  ["tracked revision", "<w:ins w:id=\"1\"><w:r/></w:ins>", "trackedRevision"]
] as const) {
  test(`${name} is blocked before a whole-document operation`, () => {
    assert.deepEqual(detectUnsupportedWordStructures(ooxml), [expected]);
  });
}
