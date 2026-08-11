import type { TransformAction, TransformOptions } from "@bank-ai/contracts";

export interface AiProvider {
  readonly name: string;
  transform(action: TransformAction, text: string, options?: TransformOptions): Promise<string>;
}

export interface CompletionRequest {
  system: string;
  user: string;
  maxTokens: number;
}

export interface CompletionProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<string>;
}
