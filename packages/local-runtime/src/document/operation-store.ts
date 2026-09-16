import crypto from "node:crypto";
import type { TransformAction, TransformOptions } from "@bank-ai/contracts";
import type { AiProvider } from "../providers/types.js";
import { DOCUMENT_CHUNK_TARGET, planParagraphChunks, type MappedDocumentChunk } from "./chunker.js";
import { createSliceMarkerContract, extractSliceResult } from "./slice-markers.js";

export interface OperationParagraph { id: string; index: number; text: string }
interface Operation { owner: string; action: TransformAction; options: TransformOptions; paragraphs: OperationParagraph[]; chunks: MappedDocumentChunk[]; results: Map<number, string>; cancelled: boolean; summary?: string }
export class DocumentOperationStore {
  constructor(private readonly chunkTarget = DOCUMENT_CHUNK_TARGET) {}
  private readonly operations = new Map<string, Operation>();
  create(owner: string, action: TransformAction, paragraphs: OperationParagraph[], options: TransformOptions) {
    const id = crypto.randomUUID(); const chunks = planParagraphChunks(paragraphs, this.chunkTarget);
    this.operations.set(id, { owner, action, options, paragraphs, chunks, results: new Map(), cancelled: false }); return { operationId: id, totalChunks: chunks.length };
  }
  async execute(owner: string, id: string, index: number, provider: AiProvider) {
    const operation = this.get(owner, id); if (operation.cancelled) throw new Error("cancelled"); const chunk = operation.chunks[index]; if (!chunk) throw new Error("chunk");
    if (!operation.results.has(index)) {
      const slice = chunk.slices[0]!;
      const isLongParagraphSlice = operation.action !== "summary" && chunk.paragraphText !== undefined && (slice.startOffset > 0 || slice.endOffset < chunk.paragraphText.length);
      if (!chunk.text) operation.results.set(index, "");
      else if (!isLongParagraphSlice) operation.results.set(index, await provider.transform(operation.action, chunk.text, operation.options));
      else {
        const contract = createSliceMarkerContract(chunk.paragraphText!, slice.startOffset, slice.endOffset, chunk.index);
        const modelResult = await provider.transform(operation.action, contract.prompt, operation.options);
        operation.results.set(index, extractSliceResult(contract, modelResult));
      }
    }
    return { chunkIndex: index, completed: operation.results.size, total: operation.chunks.length };
  }
  async finalize(owner: string, id: string, provider: AiProvider) {
    const operation = this.get(owner, id); if (operation.cancelled || operation.results.size !== operation.chunks.length) throw new Error("incomplete");
    if (operation.action === "summary") {
      if (!operation.summary) operation.summary = await provider.transform("summary", operation.chunks.map((chunk) => operation.results.get(chunk.index)!).join("\n"));
      return { kind: "summary" as const, summary: operation.summary };
    }
    const pieces = new Map<number, string[]>(); for (const chunk of operation.chunks) { const index = chunk.slices[0]!.paragraphIndex; pieces.set(index, [...(pieces.get(index) ?? []), operation.results.get(chunk.index)!]); }
    return { kind: "paragraphs" as const, paragraphs: operation.paragraphs.map((paragraph) => { const result = (pieces.get(paragraph.index) ?? []).join(""); return { ...paragraph, original: paragraph.text, result, changed: result !== paragraph.text }; }) };
  }
  cancel(owner: string, id: string) { const operation = this.get(owner, id); operation.cancelled = true; }
  private get(owner: string, id: string) { const operation = this.operations.get(id); if (!operation || operation.owner !== owner) throw new Error("operation"); return operation; }
}
