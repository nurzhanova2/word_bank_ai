import type { TextLanguage, TransformAction, TransformOptions } from "@bank-ai/contracts";

export interface AiProvider {
  readonly name: string;
  transform(action: TransformAction, text: string, options?: TransformOptions): Promise<string>;
  completeGrammarReview?(text: string, language: TextLanguage): Promise<string>;
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
