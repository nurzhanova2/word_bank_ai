export const transformActions = ["rewrite", "shorten", "formalize", "grammar", "translate", "expand", "tone", "summary"] as const;

export type TransformAction = (typeof transformActions)[number];

export const targetLanguages = ["ru", "kk", "en"] as const;
export type TargetLanguage = (typeof targetLanguages)[number];

export const targetTones = ["neutral", "polite", "strict", "diplomatic"] as const;
export type TargetTone = (typeof targetTones)[number];

export interface TransformOptions {
  targetLanguage?: TargetLanguage;
  targetTone?: TargetTone;
}

export interface TransformRequest {
  action: TransformAction;
  text: string;
  targetLanguage?: TargetLanguage;
  targetTone?: TargetTone;
}

export interface TransformResponse {
  operationId: string;
  result: string;
  provider: string;
  durationMs: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface HealthResponse {
  status: "ok";
  version: string;
  provider: string;
}
