import type { HunspellDecision, KazakhGrammarErrorType } from "@bank-ai/contracts";
import type { HunspellCandidate } from "../../grammar/types.js";

export interface KazakhGoldError {
  original: string;
  correction: string;
  start: number;
  end: number;
  type: KazakhGrammarErrorType;
  source: "hunspell" | "context" | "both";
}

export interface KazakhGoldCandidate extends HunspellCandidate {
  expectedDecision: HunspellDecision;
}

export interface KazakhEvalCase {
  id: string;
  text: string;
  errors: KazakhGoldError[];
  hunspellCandidates: KazakhGoldCandidate[];
  tags: string[];
}

export interface KazakhPrediction {
  errors: KazakhGoldError[];
  hunspellValidation: Array<{ word: string; start: number; end: number; decision: HunspellDecision }>;
}
