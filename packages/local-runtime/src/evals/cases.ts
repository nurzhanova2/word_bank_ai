import type { QualityEvalCase } from "./quality-evaluator.js";

export const defaultQualityCases: readonly QualityEvalCase[] = [
  {
    id: "grammar-requisites-and-layout",
    action: "grammar",
    input: "ТОО «Банк Решений», БИН 123456789012 сообщает:\nОплата по ИИК KZ86125KZT5004100100 были получены.",
    assertions: { preserveRequisites: true, preserveParagraphCount: true }
  },
  {
    id: "rewrite-person-and-phone",
    action: "rewrite",
    input: "ФИО: Нуржанова Шынар Бакытовна. Позвонить по номеру +7 (777) 123-45-67 и сказать по вопросу.",
    assertions: { preserveRequisites: true, preserveParagraphCount: true }
  },
  {
    id: "shorten",
    action: "shorten",
    input: "В связи с тем, что обращение было рассмотрено ранее, повторно сообщаем ранее указанную информацию. Решение остаётся без изменений.",
    assertions: { preserveParagraphCount: true, maxLengthRatio: 0.85 }
  },
  {
    id: "expand-without-new-details",
    action: "expand",
    input: "Необходимо обновить внутренний регламент.",
    assertions: { preserveParagraphCount: true, minLengthRatio: 1.2 }
  },
  {
    id: "translate-kazakh",
    action: "translate",
    input: "Договор № 417 действует до 15.09.2026.",
    options: { targetLanguage: "kk" },
    assertions: {
      preserveRequisites: true,
      preserveParagraphCount: true,
      includes: ["шарт"],
      excludes: ["әрине", "аударма:", "вот перевод"]
    }
  },
  {
    id: "summary",
    action: "summary",
    input: "Комитет рассмотрел заявление клиента. По итогам рассмотрения принято решение запросить дополнительные документы до 20.08.2026.",
    assertions: { maxLengthRatio: 0.85, excludes: ["краткое содержание:", "резюме:", "вот результат"] }
  }
];
