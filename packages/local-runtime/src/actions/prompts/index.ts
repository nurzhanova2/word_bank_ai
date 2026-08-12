import type { TransformAction } from "@bank-ai/contracts";
import { expandPrompt } from "./expand.js";
import { formalizePrompt } from "./formalize.js";
import { grammarPrompt } from "./grammar.js";
import { rewritePrompt } from "./rewrite.js";
import { shortenPrompt } from "./shorten.js";
import { summaryPrompt } from "./summary.js";
import { tonePrompt } from "./tone.js";
import { translatePrompt } from "./translate.js";

export { PROMPT_CATALOG_VERSION } from "./version.js";

export const actionPrompts: Record<TransformAction, string> = {
  rewrite: rewritePrompt,
  shorten: shortenPrompt,
  summary: summaryPrompt,
  formalize: formalizePrompt,
  grammar: grammarPrompt,
  translate: translatePrompt,
  expand: expandPrompt,
  tone: tonePrompt
};
