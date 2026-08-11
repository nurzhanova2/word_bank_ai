export const transformActions = ["rewrite", "shorten", "formalize"] as const;

export type TransformAction = (typeof transformActions)[number];

export interface TransformRequest {
  action: TransformAction;
  text: string;
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
