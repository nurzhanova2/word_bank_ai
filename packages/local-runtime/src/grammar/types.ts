import type { DetectedLanguage, GrammarCategory, GrammarIssue, TextLanguage } from "@bank-ai/contracts";

export type { DetectedLanguage, GrammarCategory, GrammarIssue, TextLanguage } from "@bank-ai/contracts";

export interface GrammarCheckResult {
  language: DetectedLanguage;
  correctedText: string;
  issues: GrammarIssue[];
  engines: string[];
}

export interface GrammarEngine {
  readonly name: string;
  supports(language: TextLanguage): boolean;
  check(text: string, language: TextLanguage): Promise<GrammarIssue[]>;
}
