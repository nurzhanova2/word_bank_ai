import type {
  DetectedLanguage,
  GrammarCategory,
  GrammarIssue,
  HunspellValidation,
  TextLanguage
} from "@bank-ai/contracts";

export type { DetectedLanguage, GrammarCategory, GrammarIssue, TextLanguage } from "@bank-ai/contracts";

export interface HunspellCandidate {
  word: string;
  start: number;
  end: number;
  suggestions: string[];
}

export interface GrammarReviewResult {
  issues: GrammarIssue[];
  hunspellValidation: HunspellValidation[];
  promptVersion: string;
}

export interface GrammarReviewer {
  readonly name: string;
  review(
    text: string,
    language: TextLanguage,
    hunspellCandidates: readonly HunspellCandidate[]
  ): Promise<GrammarReviewResult>;
}

export interface GrammarCheckResult {
  language: DetectedLanguage;
  correctedText: string;
  issues: GrammarIssue[];
  engines: string[];
  hunspellValidation: HunspellValidation[];
  promptVersion?: string;
}

export interface GrammarEngine {
  readonly name: string;
  supports(language: TextLanguage): boolean;
  check(text: string, language: TextLanguage): Promise<GrammarIssue[]>;
}
