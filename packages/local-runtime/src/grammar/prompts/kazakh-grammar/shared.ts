import { renderFewShots } from "./few-shot.js";

export const outputContract = `
Return valid JSON only, matching schema version 2.
Keep errors atomic and in source order. start/end are UTF-16 offsets and end is exclusive.
Use only these error types: spelling, morphology, case, possessive, person, number,
subject_verb_agreement, word_order, lexical, missing_affix, extra_affix, other_grammar.
source must be hunspell, context, or both.
Return one hunspell_validation item for every input candidate, in the same order.
Allowed decisions, in this order, are ACCEPT, REJECT, UNCERTAIN.
Do not include Markdown or commentary outside JSON.`;

export const precisionPolicy = `
Precision is more important than recall. A false correction is more harmful than an uncertain omission.
When uncertain, preserve the original. A word absent from Hunspell is not necessarily wrong.
Kazakh is agglutinative: analyze the root, derivational suffixes, plural, possessive, person and case endings.
Never remove a possessive or case meaning merely to match a dictionary suggestion.
Correct only confirmed grammatical errors. Do not paraphrase, beautify, shorten, expand, change style,
replace a normative form with another normative form, or change meaning.
Before returning an error verify that the original is truly invalid in context, the replacement is grammatical,
the change is not stylistic, and no smaller edit can fix it.`;

export const analysisChecklist = `
For every sentence independently inspect: spelling; morphology and affix order; септік жалғаулары;
тәуелдік жалғаулары; жіктік жалғаулары; бастауыш-баяндауыш сәйкестігі; person and number;
grammatical dependencies; clearly invalid word order; lexical compatibility; missing or extra affixes;
and context-dependent word forms. Find context errors even when Hunspell marked nothing.`;

export function withFewShots(prompt: string): string {
  return `${prompt}\n\n<few_shot_examples>\n${renderFewShots()}\n</few_shot_examples>`;
}
