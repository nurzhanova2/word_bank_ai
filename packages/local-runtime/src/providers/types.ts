import type { TextLanguage, TransformAction, TransformOptions } from "@bank-ai/contracts";
import type { HunspellCandidate } from "../grammar/types.js";

export interface GrammarReviewRequest {
  text: string;
  language: TextLanguage;
  hunspellCandidates: readonly HunspellCandidate[];
  promptVersion: string;
}

export interface AiProvider {
  readonly name: string;
  transform(action: TransformAction, text: string, options?: TransformOptions): Promise<string>;
  completeGrammarReview?(request: GrammarReviewRequest): Promise<string>;
}

export interface CompletionRequest {
  system: string;
  user: string;
  maxTokens: number;
  responseFormat?: { name: string; schema: Record<string, unknown> };
}

export interface CompletionProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<string>;
}
