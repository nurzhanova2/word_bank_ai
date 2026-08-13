export const APP_VERSION = "0.5.1";

export const targetLanguages = ["ru", "kk", "en"] as const;
export type TargetLanguage = (typeof targetLanguages)[number];

export const targetTones = ["neutral", "polite", "strict", "diplomatic"] as const;
export type TargetTone = (typeof targetTones)[number];

export type ApplyMode = "replace" | "append";
export type ActionOptionField = "targetLanguage" | "targetTone";

export interface ActionOptionDefinition {
  requestField: ActionOptionField;
  ariaLabel: string;
  choices: readonly { value: string; label: string }[];
}

export interface ActionDefinition {
  id: string;
  title: string;
  description: string;
  applyMode: ApplyMode;
  resultPrefix?: string;
  option?: ActionOptionDefinition;
}

const actionDefinitionSource = [
  { id: "rewrite", title: "Переписать", description: "Улучшить структуру и формулировки текста.", applyMode: "replace" },
  { id: "shorten", title: "Сократить", description: "Сделать текст короче, сохранив суть.", applyMode: "replace" },
  { id: "summary", title: "Краткое содержание", description: "Выделить основные мысли и важные факты.", applyMode: "append", resultPrefix: "РЕЗЮМЕ:" },
  { id: "formalize", title: "Формальный стиль", description: "Преобразовать текст в деловой стиль.", applyMode: "replace" },
  { id: "grammar", title: "Проверить грамматику", description: "Исправить ошибки, окончания и пунктуацию.", applyMode: "replace" },
  {
    id: "translate",
    title: "Перевести",
    description: "Перевести с сохранением реквизитов.",
    applyMode: "replace",
    option: {
      requestField: "targetLanguage",
      ariaLabel: "Язык перевода",
      choices: [
        { value: "ru", label: "На русский" },
        { value: "kk", label: "Қазақша" },
        { value: "en", label: "To English" }
      ]
    }
  },
  { id: "expand", title: "Расширить текст", description: "Добавить подробности без новых фактов.", applyMode: "replace" },
  {
    id: "tone",
    title: "Изменить тон",
    description: "Изменить стиль без изменения смысла.",
    applyMode: "replace",
    option: {
      requestField: "targetTone",
      ariaLabel: "Тон текста",
      choices: [
        { value: "neutral", label: "Нейтральный" },
        { value: "polite", label: "Вежливый" },
        { value: "strict", label: "Строгий" },
        { value: "diplomatic", label: "Дипломатичный" }
      ]
    }
  }
] as const satisfies readonly ActionDefinition[];

export type TransformAction = (typeof actionDefinitionSource)[number]["id"];
export const actionDefinitions: readonly (ActionDefinition & { id: TransformAction })[] = actionDefinitionSource;
export const transformActions = actionDefinitions.map((definition) => definition.id) as TransformAction[];

const actionDefinitionMap = new Map<TransformAction, ActionDefinition>(
  actionDefinitions.map((definition) => [definition.id, definition])
);

export function getActionDefinition(action: TransformAction): ActionDefinition & { id: TransformAction } {
  const definition = actionDefinitionMap.get(action);
  if (!definition) throw new Error(`Unknown transform action: ${action}`);
  return definition as ActionDefinition & { id: TransformAction };
}

export interface TransformOptions {
  targetLanguage?: TargetLanguage;
  targetTone?: TargetTone;
}

export interface TransformRequest {
  action: TransformAction;
  text: string;
  targetLanguage?: TargetLanguage;
  targetTone?: TargetTone;
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
    retryable?: boolean;
    operationId?: string;
  };
}

export interface HealthResponse {
  status: "ok";
  version: string;
  provider: string;
}

export type TextLanguage = "ru" | "kk" | "en";
export type DetectedLanguage = TextLanguage | "mixed" | "unknown";
export type GrammarCategory = "spelling" | "grammar" | "punctuation" | "style" | "terminology";

export interface GrammarIssue {
  offset: number;
  length: number;
  original: string;
  message: string;
  category: GrammarCategory;
  replacements: string[];
  confidence: number;
  source: string;
  ruleId: string;
}

export interface GrammarCheckRequest { text: string }

export interface GrammarCheckResponse {
  operationId: string;
  language: DetectedLanguage;
  correctedText: string;
  issues: GrammarIssue[];
  engines: string[];
  durationMs: number;
}
