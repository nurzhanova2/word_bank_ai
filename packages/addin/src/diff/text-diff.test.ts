import assert from "node:assert/strict";
import test from "node:test";
import { changedResultWordIndexes } from "./text-diff.js";

test("diff marks only inserted and replaced result words", () => {
  assert.deepEqual([...changedResultWordIndexes("Банк рассмотрел документ", "Банк быстро проверил документ")], [1, 2]);
});

test("diff keeps repeated unchanged words stable", () => {
  assert.deepEqual([...changedResultWordIndexes("очень важный документ", "очень важный и точный документ")], [2, 3]);
});
