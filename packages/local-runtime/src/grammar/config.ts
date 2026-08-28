export interface GrammarConfidenceConfig {
  autoApply: number;
  review: number;
}

type Environment = Readonly<Record<string, string | undefined>>;

function confidence(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function grammarConfidenceConfig(environment: Environment = process.env): GrammarConfidenceConfig {
  const autoApply = confidence(environment.GRAMMAR_CONFIDENCE_AUTO_APPLY, 0.9);
  const review = confidence(environment.GRAMMAR_CONFIDENCE_REVIEW, 0.7);
  return { autoApply, review: Math.min(review, autoApply) };
}
