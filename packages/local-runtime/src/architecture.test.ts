import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_VERSION,
  actionDefinitions,
  getActionDefinition,
  transformActions
} from "@bank-ai/contracts";
import { actionPrompts } from "./actions/prompts.js";

test("the action registry is the single complete source of action metadata", () => {
  assert.equal(new Set(transformActions).size, transformActions.length);
  assert.deepEqual(actionDefinitions.map((definition) => definition.id), transformActions);

  for (const action of transformActions) {
    const definition = getActionDefinition(action);
    assert.equal(definition.id, action);
    assert.ok(definition.title.length > 0);
    assert.ok(definition.description.length > 0);
    assert.ok(actionPrompts[action].length > 0);
  }
});

test("release version is available to every client through contracts", () => {
  assert.equal(APP_VERSION, "0.1.1");
});

test("action behavior and options are declared instead of hard-coded in clients", () => {
  assert.equal(getActionDefinition("summary").applyMode, "append");
  assert.equal(getActionDefinition("summary").resultPrefix, "РЕЗЮМЕ:");
  assert.equal(getActionDefinition("rewrite").applyMode, "replace");
  assert.equal(getActionDefinition("translate").option?.requestField, "targetLanguage");
  assert.equal(getActionDefinition("tone").option?.requestField, "targetTone");
});
