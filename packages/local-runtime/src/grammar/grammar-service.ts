import { detectTextLanguage, segmentByLanguage } from "./language-detector.js";
import type { GrammarCheckResult, GrammarEngine, GrammarIssue } from "./types.js";

export function applyGrammarIssues(text: string, issues: readonly GrammarIssue[]): string {
  const compatible: GrammarIssue[] = [];
  for (const issue of [...issues]
    .filter((issue) => issue.replacements[0] !== undefined && text.slice(issue.offset, issue.offset + issue.length) === issue.original)
    .sort((left, right) => left.offset - right.offset || right.confidence - left.confidence || right.length - left.length)) {
    const previous = compatible.at(-1);
    if (!previous || issue.offset >= previous.offset + previous.length) compatible.push(issue);
  }
  return compatible.sort((left, right) => right.offset - left.offset)
    .reduce((result, issue) => `${result.slice(0, issue.offset)}${issue.replacements[0]}${result.slice(issue.offset + issue.length)}`, text);
}

export class GrammarService {
  constructor(private readonly engines: readonly GrammarEngine[]) {}

  async check(text: string): Promise<GrammarCheckResult> {
    const segments = segmentByLanguage(text);
    const issues: GrammarIssue[] = [];
    const engines = new Set<string>();
    for (const segment of segments) {
      const candidates = this.engines.filter((candidate) => candidate.supports(segment.language));
      for (const engine of candidates) {
        try {
          const localIssues = await engine.check(segment.text, segment.language);
          engines.add(engine.name);
          issues.push(...localIssues.map((issue) => ({ ...issue, offset: issue.offset + segment.offset })));
          break;
        } catch {
          // Следующий совместимый engine является безопасным fallback.
        }
      }
    }
    issues.sort((left, right) => left.offset - right.offset);
    const detected = detectTextLanguage(text);
    const language = new Set(segments.map((segment) => segment.language)).size > 1 ? "mixed" : detected;
    return { language, issues, correctedText: applyGrammarIssues(text, issues), engines: [...engines] };
  }
}
