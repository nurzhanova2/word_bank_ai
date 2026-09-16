import type { TransformAction, TransformOptions } from "@bank-ai/contracts";
import type { AiProvider } from "../providers/types.js";
import { chunkDocument, type TextChunk } from "./chunker.js";

export interface DocumentSnapshot { operationId: string; text: string; chunks: TextChunk[]; createdAt: number }
export interface DocumentOperation { snapshot: DocumentSnapshot; action: TransformAction; options: TransformOptions; results: Map<number, string>; failed?: number; cancelled: boolean }
export interface DocumentProgress { phase: "reading" | "processing" | "aggregating"; completed: number; total: number }

export function createDocumentSnapshot(text: string, operationId = crypto.randomUUID()): DocumentSnapshot {
  if (!text.trim()) throw new Error("Выберите непустой текст документа.");
  return { operationId, text, chunks: chunkDocument(text), createdAt: Date.now() };
}

export class DocumentOrchestrator {
  constructor(private readonly provider: AiProvider) {}
  async start(action: TransformAction, text: string, options: TransformOptions = {}, signal?: AbortSignal, progress: (state: DocumentProgress) => void = () => undefined): Promise<DocumentOperation> {
    const snapshot = createDocumentSnapshot(text);
    const operation: DocumentOperation = { snapshot, action, options, results: new Map(), cancelled: false };
    await this.process(operation, signal, progress);
    return operation;
  }
  async retry(operation: DocumentOperation, signal?: AbortSignal, progress: (state: DocumentProgress) => void = () => undefined): Promise<DocumentOperation> {
    if (operation.failed === undefined) return operation;
    const failed = operation.failed; operation.failed = undefined;
    await this.process(operation, signal, progress, operation.snapshot.chunks
      .filter((chunk) => chunk.index === failed || !operation.results.has(chunk.index))
      .map((chunk) => chunk.index));
    return operation;
  }
  private async process(operation: DocumentOperation, signal: AbortSignal | undefined, progress: (state: DocumentProgress) => void, only?: number[]): Promise<void> {
    const chunks = only ? operation.snapshot.chunks.filter((chunk) => only.includes(chunk.index)) : operation.snapshot.chunks;
    for (const chunk of chunks) {
      if (signal?.aborted) { operation.cancelled = true; return; }
      progress({ phase: "processing", completed: operation.results.size, total: operation.snapshot.chunks.length });
      try { operation.results.set(chunk.index, await this.provider.transform(operation.action, chunk.text, operation.options)); }
      catch { operation.failed = chunk.index; return; }
    }
  }
  result(operation: DocumentOperation): string | undefined {
    if (operation.cancelled || operation.failed !== undefined || operation.results.size !== operation.snapshot.chunks.length) return undefined;
    return operation.snapshot.chunks.map((chunk) => operation.results.get(chunk.index)!).join("");
  }
  async summarize(text: string, signal?: AbortSignal, progress: (state: DocumentProgress) => void = () => undefined): Promise<{ snapshot: DocumentSnapshot; summary: string }> {
    const snapshot = createDocumentSnapshot(text);
    const partials: string[] = [];
    for (const chunk of snapshot.chunks) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      progress({ phase: "processing", completed: partials.length, total: snapshot.chunks.length });
      partials.push(await this.provider.transform("summary", chunk.text));
    }
    progress({ phase: "aggregating", completed: partials.length, total: snapshot.chunks.length });
    return { snapshot, summary: await this.provider.transform("summary", partials.join("\n")) };
  }
}
