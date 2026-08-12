import type { ApiError } from "@bank-ai/contracts";

export type RuntimeErrorCode =
  | "INVALID_API_KEY"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_UNAVAILABLE"
  | "RESULT_VALIDATION_FAILED"
  | "PROVIDER_ERROR";

export class RuntimeError extends Error {
  constructor(
    readonly code: RuntimeErrorCode,
    readonly status: number,
    readonly userMessage: string,
    readonly retryable: boolean
  ) {
    super(userMessage);
    this.name = new.target.name;
  }
}

export class ProviderAuthenticationError extends RuntimeError {
  constructor() { super("INVALID_API_KEY", 401, "API-ключ отклонён AI-сервисом.", false); }
}

export class ProviderTimeoutError extends RuntimeError {
  constructor() { super("PROVIDER_TIMEOUT", 504, "AI-сервис не ответил вовремя. Повторите попытку.", true); }
}

export class ProviderRateLimitError extends RuntimeError {
  constructor() { super("PROVIDER_RATE_LIMIT", 429, "AI-сервис перегружен. Повторите попытку позже.", true); }
}

export class ProviderUnavailableError extends RuntimeError {
  constructor() { super("PROVIDER_UNAVAILABLE", 503, "Нет соединения с AI-сервисом. Проверьте корпоративную сеть.", true); }
}

export class ResultValidationError extends RuntimeError {
  constructor() { super("RESULT_VALIDATION_FAILED", 422, "AI вернул результат, который не прошёл проверку защищённых данных или структуры абзацев. Повторите попытку.", true); }
}

export interface ApiFailure {
  status: number;
  body: ApiError;
}

export function toApiFailure(error: unknown, operationId: string): ApiFailure {
  const runtimeError = error instanceof RuntimeError
    ? error
    : new RuntimeError("PROVIDER_ERROR", 502, "AI-сервис временно недоступен. Повторите попытку.", true);
  return {
    status: runtimeError.status,
    body: {
      error: {
        code: runtimeError.code,
        message: runtimeError.userMessage,
        retryable: runtimeError.retryable,
        operationId
      }
    }
  };
}
