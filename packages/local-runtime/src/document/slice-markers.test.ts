import assert from "node:assert/strict";
import test from "node:test";
import { createSliceMarkerContract, extractSliceResult } from "./slice-markers.js";

test("slice marker contract retains only the editable target and bounded context", () => {
  const paragraph = `До контекста. ${"Қазақша 😀 мәтін. ".repeat(20)} После контекста.`;
  const target = paragraph.slice(80, 180);
  const contract = createSliceMarkerContract(paragraph, 80, 180, 3);

  assert.ok(contract.contextBefore.length <= 600);
  assert.ok(contract.contextAfter.length <= 600);
  assert.match(contract.prompt, /READ-ONLY CONTEXT BEFORE/u);
  assert.equal(extractSliceResult(contract, contract.prompt), target);
  assert.doesNotMatch(extractSliceResult(contract, contract.prompt), /BANKAI/u);
});

test("slice markers reject missing, duplicated, modified, invented and reversed boundaries", () => {
  const contract = createSliceMarkerContract("Контекст до. Целевой текст. Контекст после.", 13, 28, 0);
  const cases = [
    contract.prompt.replace(contract.startMarker, ""),
    contract.prompt.replace(contract.endMarker, `${contract.endMarker}${contract.endMarker}`),
    contract.prompt.replace(contract.startMarker, "[[BANKAI:SLICESTARTZ]]"),
    `${contract.prompt} [[BANKAI:UNKNOWN]]`,
    contract.prompt.replace(contract.startMarker, "TEMP").replace(contract.endMarker, contract.startMarker).replace("TEMP", contract.endMarker)
  ];
  for (const result of cases) assert.throws(() => extractSliceResult(contract, result));
});

test("slice markers are deterministic, unique, and never split a surrogate pair in bounded context", () => {
  const paragraph = `${"x".repeat(601)}😀${"y".repeat(601)}`;
  const first = createSliceMarkerContract(paragraph, 603, 620, 4);
  const second = createSliceMarkerContract(paragraph, 603, 620, 4);
  assert.deepEqual(first, second);
  assert.notEqual(first.startMarker, first.endMarker);
  assert.equal(first.contextBefore.endsWith("😀"), true);
  assert.equal(/^[\uDC00-\uDFFF]/u.test(first.contextAfter), false);
});
