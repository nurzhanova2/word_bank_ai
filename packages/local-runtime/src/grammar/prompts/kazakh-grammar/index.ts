import { englishV1 } from "./english-v1.js";
import { hybridFewShotV1, hybridV1 } from "./hybrid-v1.js";
import { kazakhV1 } from "./kazakh-v1.js";

export const kazakhGrammarPromptVersions = ["baseline_v1", "english_v1", "kazakh_v1", "hybrid_v1", "hybrid_few_shot_v1"] as const;
export type KazakhGrammarPromptVersion = (typeof kazakhGrammarPromptVersions)[number];

const prompts: Record<KazakhGrammarPromptVersion, string> = {
  baseline_v1: baselineV1,
  english_v1: englishV1,
  kazakh_v1: kazakhV1,
  hybrid_v1: hybridV1,
  hybrid_few_shot_v1: hybridFewShotV1
};

type Environment = Readonly<Record<string, string | undefined>>;

export function resolveKazakhGrammarPromptVersion(environment: Environment = process.env): KazakhGrammarPromptVersion {
  const variant = environment.PROMPT_VARIANT?.trim().toLocaleLowerCase();
  if (variant === "english") return "english_v1";
  if (variant === "kazakh") return "kazakh_v1";
  if (variant === "hybrid") return "hybrid_v1";
  const explicit = environment.GRAMMAR_PROMPT_VERSION?.trim();
  if (kazakhGrammarPromptVersions.includes(explicit as KazakhGrammarPromptVersion)) {
    return explicit as KazakhGrammarPromptVersion;
  }
  return "hybrid_few_shot_v1";
}

export function getKazakhGrammarPrompt(version: KazakhGrammarPromptVersion): string {
  return prompts[version];
}
import { baselineV1 } from "./baseline-v1.js";
