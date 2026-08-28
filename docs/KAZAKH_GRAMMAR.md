# Казахская грамматика: Hunspell + LLM review

## Pipeline

Фактическая схема остаётся прежней:

```text
полный текст
  → Hunspell и локальные казахские правила
  → список Hunspell candidates без автоматических замен
  → Qwen: независимый full-context analysis + validation каждого candidate
  → confidence policy и строгая проверка JSON/UTF-16 ranges
  → объединение подтверждённых исправлений
```

Hunspell является только источником кандидатов. Его `suggestions` не попадают в
`replacements` и не применяются автоматически. Qwen получает полный текст вместе
с массивом `{ word, start, end, suggestions }`, ищет также context-only ошибки и
возвращает schema v2:

```json
{
  "version": 2,
  "errors": [
    {
      "original": "бардық",
      "correction": "бардым",
      "start": 33,
      "end": 39,
      "type": "subject_verb_agreement",
      "reason": "Бастауыш бірінші жақ жекеше түрде.",
      "confidence": 0.98,
      "source": "context"
    }
  ],
  "hunspell_validation": [
    {
      "word": "достарыммен",
      "decision": "REJECT",
      "reason": "дос + тар + ым + мен — дұрыс форма.",
      "confidence": 0.99
    }
  ]
}
```

Для каждого входного кандидата требуется ровно одно решение в том же порядке:
`ACCEPT`, `REJECT` или `UNCERTAIN`. `REJECT` удаляет ложное предупреждение
Hunspell, `UNCERTAIN` оставляет его только для ручной проверки, а `ACCEPT` может
стать исправлением лишь при наличии согласованной ошибки и достаточной уверенности.

## Prompt variants

Промпты находятся в
`packages/local-runtime/src/grammar/prompts/kazakh-grammar/`:

- `baseline_v1` — адаптированный прежний prompt для контрольного эксперимента;
- `english_v1` — английские control instructions;
- `kazakh_v1` — казахские instructions;
- `hybrid_v1` — английская control logic и казахская терминология;
- `hybrid_few_shot_v1` — hybrid + 6 размеченных примеров.

Выбор задаётся одним из способов:

```dotenv
PROMPT_VARIANT=english
# либо kazakh / hybrid
```

или точной воспроизводимой версией:

```dotenv
PROMPT_VARIANT=
GRAMMAR_PROMPT_VERSION=hybrid_few_shot_v1
```

Если заполнены оба поля, `PROMPT_VARIANT` имеет приоритет. Default —
`hybrid_few_shot_v1`.

## Confidence policy

```dotenv
GRAMMAR_CONFIDENCE_AUTO_APPLY=0.90
GRAMMAR_CONFIDENCE_REVIEW=0.70
```

- `>= AUTO_APPLY` — исправление может попасть в `correctedText`;
- от `REVIEW` до `AUTO_APPLY` — исходник сохраняется, замена показывается как
  требующая проверки;
- ниже `REVIEW` — предложение исправления отбрасывается.

Низкоуверенный `ACCEPT` кандидата нормализуется в `UNCERTAIN`. Пороги валидируются
как числа от 0 до 1; некорректные значения заменяются безопасными defaults.

## Evaluation

`packages/local-runtime/src/evals/kazakh/dataset.ts` формирует 200 размеченных
синтетических случаев: корректные/OOV формы, spelling, morphology, case,
possessive/person/number, agreement, word order, lexical, missing/extra affixes и
multi-error предложения. Набор предназначен для воспроизводимого первого
эксперимента; перед продуктовым выбором prompt его необходимо проверить и
расширить экспертной разметкой носителей языка.

Полный A/B запуск делает 1 000 последовательных LLM-вызовов: 200 случаев ×
5 вариантов prompt.

```powershell
npm run eval:kazakh
```

Для smoke-run:

```powershell
$env:KAZAKH_EVAL_LIMIT="10"
npm run eval:kazakh
```

Опциональная запись отчёта:

```powershell
$env:KAZAKH_EVAL_REPORT_PATH="reports/kazakh-grammar.json"
npm run eval:kazakh
```

Отчёт содержит TP, FP, FN, Precision, Recall, F1, F0.5, False Positive Rate,
Hunspell False Positive Rejection Rate и Context-only Recall. Выбирать вариант
следует прежде всего по Precision/F0.5 и ручному анализу false positives.

## Диагностическое логирование

По умолчанию production-запросы не сохраняются. Явно включить JSONL-диагностику:

```dotenv
GRAMMAR_REVIEW_LOG_PATH=C:\path\to\grammar-review.jsonl
GRAMMAR_LOG_INCLUDE_TEXT=false
```

Без `GRAMMAR_LOG_INCLUDE_TEXT=true` сохраняются hash и длина текста, кандидаты,
prompt version, provider/model, нормализованные ошибки, validation и latency.
Включать полный пользовательский текст можно только после утверждения политики
хранения чувствительных данных. Ошибка записи диагностического файла не должна
прерывать проверку документа.
