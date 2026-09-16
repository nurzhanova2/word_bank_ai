import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_VERSION,
  getActionDefinition,
  transformActions,
  type ApiError,
  type HealthResponse,
  type GrammarCheckResponse,
  type TransformAction,
  type TransformResponse
} from "@bank-ai/contracts";
import cors from "cors";
import express from "express";
import { z } from "zod";
import type { AiProvider } from "./provider.js";
import { toApiFailure } from "./errors.js";
import { GrammarService } from "./grammar/grammar-service.js";
import { LanguageToolEngine } from "./grammar/languagetool-engine.js";
import { LlmGrammarEngine } from "./grammar/llm-grammar-engine.js";
import { KazakhGrammarEngine } from "./grammar/kazakh-grammar-engine.js";
import { KazakhHunspellEngine } from "./grammar/kazakh-hunspell-engine.js";
import { KazakhRulesEngine } from "./grammar/kazakh-rules-engine.js";
import { ReadinessService } from "./diagnostics/readiness.js";
import { DocumentOperationStore } from "./document/operation-store.js";

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

const grammarSchema = z.object({ text: z.string().trim().min(1).max(20_000) });
const documentSchema = z.object({
  action: z.enum(transformActions as [TransformAction, ...TransformAction[]]),
  paragraphs: z.array(z.object({ id: z.string().min(1), index: z.number().int().nonnegative(), text: z.string().max(20_000) })).min(1).max(2_000),
  targetLanguage: z.enum(["ru", "kk", "en"]).optional(), targetTone: z.enum(["neutral", "polite", "strict", "diplomatic"]).optional()
});

interface GrammarChecker { check(text: string): Promise<Omit<GrammarCheckResponse, "operationId" | "durationMs">> }
export interface AppSecurityOptions { sessionToken?: string; diagnostics?: Record<string, unknown> }

function isTrustedHost(host: string | undefined): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/u.test(host ?? "");
}
function isTrustedOrigin(origin: string | undefined): boolean {
  return !origin || origin === "https://localhost:3847" || origin === "https://127.0.0.1:3847";
}

function createKazakhEngine(): KazakhGrammarEngine {
  let spelling: KazakhHunspellEngine | undefined;
  const dictionaryDirectory = process.env.KAZAKH_HUNSPELL_PATH?.trim();
  if (dictionaryDirectory) {
    try { spelling = KazakhHunspellEngine.fromDirectory(dictionaryDirectory); }
    catch (error) { console.warn("[Bank AI] Kazakh Hunspell dictionary is unavailable.", error); }
  }
  return new KazakhGrammarEngine(spelling, new KazakhRulesEngine());
}

export function createApp(provider: AiProvider, staticDirectory?: string, grammarChecker?: GrammarChecker, security: AppSecurityOptions = {}) {
  const app = express();
  const documentOperations = new DocumentOperationStore();
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    if (!isTrustedHost(request.headers.host)) { response.status(421).json({ error: { code: "UNTRUSTED_HOST", message: "Недопустимый локальный host.", retryable: false } }); return; }
    next();
  });
  app.use(cors({ origin: (origin, callback) => callback(null, isTrustedOrigin(origin)) }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => {
    const body: HealthResponse = { status: "ok", version: APP_VERSION, provider: provider.name };
    response.json(body);
  });

  app.get("/session", (request, response) => {
    if (!security.sessionToken || !isTrustedOrigin(request.headers.origin)) { response.status(404).end(); return; }
    response.setHeader("Cache-Control", "no-store");
    response.json({ token: security.sessionToken });
  });

  app.use("/api", (request, response, next) => {
    if (!isTrustedOrigin(request.headers.origin)) { response.status(403).json({ error: { code: "UNTRUSTED_ORIGIN", message: "Недопустимый origin.", retryable: false } }); return; }
    if (security.sessionToken && request.header("X-Bank-AI-Session") !== security.sessionToken) {
      response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Сеанс локального приложения недействителен.", retryable: false } }); return;
    }
    next();
  });
  const readiness = new ReadinessService(provider, process.env.LANGUAGETOOL_URL?.trim() || "http://127.0.0.1:8081/v2/check");
  app.get("/api/v1/diagnostics", async (request, response) => {
    const result = await readiness.check(request.query.refresh === "true");
    response.json({ version: APP_VERSION, ...result, ...security.diagnostics });
  });

  const llmReview = provider.name === "mock" ? undefined : new LlmGrammarEngine(provider);
  const grammar = grammarChecker ?? new GrammarService([
    new LanguageToolEngine(process.env.LANGUAGETOOL_URL?.trim() || "http://127.0.0.1:8081/v2/check"),
    createKazakhEngine()
  ], llmReview);

  app.post("/api/v1/grammar/check", async (request, response) => {
    const operationId = crypto.randomUUID();
    const parsed = grammarSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: { code: "INVALID_REQUEST", message: "Выделите текст длиной до 20 000 символов.", retryable: false, operationId } });
      return;
    }
    const startedAt = performance.now();
    try {
      const result = await grammar.check(parsed.data.text);
      const body: GrammarCheckResponse = { operationId, ...result, durationMs: Math.round(performance.now() - startedAt) };
      response.json(body);
    } catch (error) {
      const failure = toApiFailure(error, operationId);
      response.status(failure.status).json(failure.body);
    }
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

  app.post("/api/v1/document/transform", async (request, response) => {
    const operationId = crypto.randomUUID(); const parsed = documentSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.action === "grammar") { response.status(400).json({ error: { code: "INVALID_REQUEST", message: "Некорректный документ или действие.", retryable: false, operationId } }); return; }
    try {
      const options = { targetLanguage: parsed.data.targetLanguage, targetTone: parsed.data.targetTone };
      const created = documentOperations.create(`legacy:${operationId}`, parsed.data.action, parsed.data.paragraphs, options);
      for (let index = 0; index < created.totalChunks; index += 1) await documentOperations.execute(`legacy:${operationId}`, created.operationId, index, provider);
      const result = await documentOperations.finalize(`legacy:${operationId}`, created.operationId, provider);
      if (result.kind !== "paragraphs") throw new Error("summary");
      response.json({ operationId, paragraphs: result.paragraphs, provider: provider.name });
    } catch (error) { const failure = toApiFailure(error, operationId); response.status(failure.status).json(failure.body); }
  });
  app.post("/api/v1/document/operations", (request, response) => {
    const parsed = documentSchema.safeParse(request.body); if (!parsed.success || parsed.data.action === "grammar") { response.status(400).json({ error: { code: "INVALID_REQUEST", message: "Некорректный документ.", retryable: false } }); return; }
    response.status(201).json(documentOperations.create(request.header("X-Bank-AI-Session") ?? "development", parsed.data.action, parsed.data.paragraphs, { targetLanguage: parsed.data.targetLanguage, targetTone: parsed.data.targetTone }));
  });
  app.post("/api/v1/document/operations/:id/chunks/:index", async (request, response) => {
    try { response.json(await documentOperations.execute(request.header("X-Bank-AI-Session") ?? "development", request.params.id, Number(request.params.index), provider)); }
    catch { response.status(409).json({ error: { code: "DOCUMENT_OPERATION_FAILED", message: "Невозможно выполнить блок документа.", retryable: true } }); }
  });
  app.post("/api/v1/document/operations/:id/finalize", async (request, response) => {
    try { response.json({ operationId: request.params.id, ...await documentOperations.finalize(request.header("X-Bank-AI-Session") ?? "development", request.params.id, provider) }); }
    catch { response.status(409).json({ error: { code: "DOCUMENT_OPERATION_INCOMPLETE", message: "Не все блоки обработаны.", retryable: true } }); }
  });
  app.delete("/api/v1/document/operations/:id", (request, response) => { try { documentOperations.cancel(request.header("X-Bank-AI-Session") ?? "development", request.params.id); response.status(204).end(); } catch { response.status(404).end(); } });

  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const addinDirectory = staticDirectory ?? path.resolve(currentDirectory, "../../addin/dist");
  app.get("/api/{*path}", (_request, response) => response.status(404).json({ error: { code: "NOT_FOUND", message: "API route not found.", retryable: false } }));
  app.use(express.static(addinDirectory));
  app.get("/{*path}", (_request, response) => response.sendFile(path.join(addinDirectory, "index.html")));

  return app;
}
