import { detectTextLanguage, segmentByLanguage } from "./language-detector.js";
import type { GrammarCheckResult, GrammarEngine, GrammarIssue, GrammarReviewer, HunspellCandidate } from "./types.js";

export function applyGrammarIssues(text: string, issues: readonly GrammarIssue[]): string {
  const compatible: GrammarIssue[] = [];
  for (const issue of [...issues]
    .filter((issue) => issue.autoApply !== false && issue.replacements[0] !== undefined && text.slice(issue.offset, issue.offset + issue.length) === issue.original)
    .sort((left, right) => left.offset - right.offset || right.confidence - left.confidence || right.length - left.length)) {
    const previous = compatible.at(-1);
    if (!previous || issue.offset >= previous.offset + previous.length) compatible.push(issue);
  }
  return compatible.sort((left, right) => right.offset - left.offset)
    .reduce((result, issue) => `${result.slice(0, issue.offset)}${issue.replacements[0]}${result.slice(issue.offset + issue.length)}`, text);
}

export class GrammarService {
  constructor(
    private readonly engines: readonly GrammarEngine[],
    private readonly reviewer?: GrammarReviewer | GrammarEngine
  ) {}

  async check(text: string): Promise<GrammarCheckResult> {
    const segments = segmentByLanguage(text);
    const issues: GrammarIssue[] = [];
    const engines = new Set<string>();
    let hunspellValidation: GrammarCheckResult["hunspellValidation"] = [];
    let promptVersion: string | undefined;
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
    if (this.reviewer) {
      const hunspellCandidates: HunspellCandidate[] = issues
        .filter((issue) => issue.source === "hunspell-kk")
        .map((issue) => ({
          word: issue.original,
          start: issue.offset,
          end: issue.offset + issue.length,
          suggestions: issue.suggestions ?? []
        }));
      const detectedForReview = detectTextLanguage(text);
      const reviewLanguage = hunspellCandidates.length > 0
        ? "kk"
        : detectedForReview === "ru" || detectedForReview === "kk" || detectedForReview === "en"
        ? detectedForReview
        : segments[0]?.language ?? "ru";
      try {
        if ("review" in this.reviewer) {
          const review = await this.reviewer.review(text, reviewLanguage, hunspellCandidates);
          hunspellValidation = review.hunspellValidation;
          promptVersion = review.promptVersion;
          const rejected = new Set(review.hunspellValidation
            .filter((validation) => validation.decision === "REJECT")
            .map((validation) => `${validation.start}:${validation.end}:${validation.word}`));
          for (let index = issues.length - 1; index >= 0; index -= 1) {
            const issue = issues[index]!;
            if (issue.source === "hunspell-kk" && rejected.has(`${issue.offset}:${issue.offset + issue.length}:${issue.original}`)) {
              issues.splice(index, 1);
            }
          }
          issues.push(...review.issues);
          engines.add(`${this.reviewer.name}:${review.promptVersion}`);
        } else {
          issues.push(...await this.reviewer.check(text, reviewLanguage));
          engines.add(this.reviewer.name);
        }
      } catch {
        // AI-review является необязательным: локальные результаты остаются доступны.
      }
    }
    const unique = new Map<string, GrammarIssue>();
    for (const issue of issues) {
      const key = `${issue.offset}:${issue.length}`;
      const current = unique.get(key);
      const issueActionable = issue.autoApply !== false && issue.replacements[0] !== undefined;
      const currentActionable = current?.autoApply !== false && current?.replacements[0] !== undefined;
      if (!current || (issueActionable && !currentActionable) || (issueActionable === currentActionable && issue.confidence > current.confidence)) {
        unique.set(key, issue);
      }
    }
    issues.splice(0, issues.length, ...unique.values());
    issues.sort((left, right) => left.offset - right.offset);
    const detected = detectTextLanguage(text);
    const language = new Set(segments.map((segment) => segment.language)).size > 1 ? "mixed" : detected;
    return {
      language,
      issues,
      correctedText: applyGrammarIssues(text, issues),
      engines: [...engines],
      hunspellValidation,
      ...(promptVersion ? { promptVersion } : {})
    };
  }
}
