import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_VERSION,
  getActionDefinition,
  transformActions,
  type ApiError,
  type HealthResponse,
  type TransformAction,
  type TransformResponse
} from "@bank-ai/contracts";
import cors from "cors";
import express from "express";
import { z } from "zod";
import type { AiProvider } from "./provider.js";
import { toApiFailure } from "./errors.js";

const transformSchema = z.object({
  action: z.enum(transformActions as [TransformAction, ...TransformAction[]]),
  text: z.string().trim().min(1).max(20_000),
  targetLanguage: z.enum(["ru", "kk", "en"]).optional(),
  targetTone: z.enum(["neutral", "polite", "strict", "diplomatic"]).optional()
}).superRefine((value, context) => {
  const option = getActionDefinition(value.action).option;
  if (option && !value[option.requestField]) {
    context.addIssue({
      code: "custom",
      path: [option.requestField],
      message: `Выберите значение: ${option.ariaLabel.toLocaleLowerCase("ru")}.`
    });
  }
});

export function createApp(provider: AiProvider, staticDirectory?: string) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: ["https://localhost:3847", "https://127.0.0.1:3847"] }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => {
    const body: HealthResponse = { status: "ok", version: APP_VERSION, provider: provider.name };
    response.json(body);
  });

  app.post("/api/v1/transform", async (request, response) => {
    const operationId = crypto.randomUUID();
    const parsed = transformSchema.safeParse(request.body);
    if (!parsed.success) {
      const body: ApiError = {
        error: {
          code: "INVALID_REQUEST",
          message: "Выберите действие и текст длиной до 20 000 символов.",
          retryable: false,
          operationId
        }
      };
      response.status(400).json(body);
      return;
    }

    const startedAt = performance.now();
    try {
      const result = await provider.transform(parsed.data.action, parsed.data.text, {
        targetLanguage: parsed.data.targetLanguage,
        targetTone: parsed.data.targetTone
      });
      const body: TransformResponse = {
        operationId,
        result,
        provider: provider.name,
        durationMs: Math.round(performance.now() - startedAt)
      };
      response.json(body);
    } catch (error) {
      const failure = toApiFailure(error, operationId);
      console.error(`[Bank AI] operation=${operationId} code=${failure.body.error.code}`);
      response.status(failure.status).json(failure.body);
    }
  });

  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const addinDirectory = staticDirectory ?? path.resolve(currentDirectory, "../../addin/dist");
  app.use(express.static(addinDirectory));
  app.get("/{*path}", (_request, response) => response.sendFile(path.join(addinDirectory, "index.html")));

  return app;
}
