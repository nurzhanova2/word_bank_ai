import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ApiError, HealthResponse, TransformResponse } from "@bank-ai/contracts";
import cors from "cors";
import express from "express";
import { z } from "zod";
import type { AiProvider } from "./provider.js";

const transformSchema = z.object({
  action: z.enum(["rewrite", "shorten", "formalize"]),
  text: z.string().trim().min(1).max(20_000)
});

export function createApp(provider: AiProvider, staticDirectory?: string) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: ["https://localhost:3847", "https://127.0.0.1:3847"] }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => {
    const body: HealthResponse = { status: "ok", version: "0.1.0", provider: provider.name };
    response.json(body);
  });

  app.post("/api/v1/transform", async (request, response) => {
    const parsed = transformSchema.safeParse(request.body);
    if (!parsed.success) {
      const body: ApiError = {
        error: { code: "INVALID_REQUEST", message: "Выберите действие и текст длиной до 20 000 символов." }
      };
      response.status(400).json(body);
      return;
    }

    const startedAt = performance.now();
    try {
      const result = await provider.transform(parsed.data.action, parsed.data.text);
      const body: TransformResponse = {
        operationId: crypto.randomUUID(),
        result,
        provider: provider.name,
        durationMs: Math.round(performance.now() - startedAt)
      };
      response.json(body);
    } catch {
      const body: ApiError = {
        error: { code: "PROVIDER_ERROR", message: "AI-сервис временно недоступен. Повторите попытку." }
      };
      response.status(502).json(body);
    }
  });

  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const addinDirectory = staticDirectory ?? path.resolve(currentDirectory, "../../addin/dist");
  app.use(express.static(addinDirectory));
  app.get("/{*path}", (_request, response) => response.sendFile(path.join(addinDirectory, "index.html")));

  return app;
}
