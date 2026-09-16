import assert from "node:assert/strict";
import test from "node:test";
import { getLocalHttpsOptions } from "./https-options.js";

test("always delegates certificate validation and trust repair to the Office helper", async () => {
  let called = 0;
  const options = await getLocalHttpsOptions(async () => {
    called += 1;
    return { cert: Buffer.from("certificate"), key: Buffer.from("private-key") };
  });

  assert.equal(called, 1);
  assert.deepEqual(options, { cert: Buffer.from("certificate"), key: Buffer.from("private-key") });
});
