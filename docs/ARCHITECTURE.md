# Архитектура Bank AI

## Цель

Пользователь выделяет текст в Word, выполняет зарегистрированное AI-действие,
проверяет «Было / Стало» и применяет либо отклоняет результат.

## Компоненты

```text
packages/addin          Word Task Pane: Office.js и пользовательский интерфейс
packages/contracts      Общие типы, реестр действий, applyMode и параметры
packages/local-runtime  HTTPS API, orchestration, providers и validators
packages/desktop-host   Electron lifecycle, настройки, tray и установка Add-in
```

Runtime слушает только `127.0.0.1:3847`. В режиме разработки используется
доверенный локальный сертификат из `office-addin-dev-certs`. В поставке для
Windows установщик должен создать сертификат, зарегистрировать manifest,
настроить автозапуск и упаковать runtime.

## API

### `GET /health`

Возвращает версию и состояние локального runtime.

### `POST /api/v1/transform`

```json
{
  "action": "formalize",
  "text": "Выделенный текст"
}
```

Поддерживаемые действия: `rewrite`, `shorten`, `formalize`, `grammar`, `translate`,
`expand`, `tone`, `summary`. Для перевода передаётся `targetLanguage` (`ru`, `kk`, `en`),
для изменения тона — `targetTone` (`neutral`, `polite`, `strict`, `diplomatic`).
Размер текста ограничен 20 000 символами.

## Transform pipeline

```text
Word selection
  → action registry
  → paragraph boundary masking
  → requisite masking
  → action prompt + options
  → CompletionProvider (LiteLLM)
  → marker integrity validation
  → requisite restoration
  → action result validation
  → replace / append согласно applyMode
```

Реквизиты (числа, даты, email, URL, ФИО после метки, ИИН/БИН, IBAN, БИК,
банковские счета, телефоны и названия организаций с правовой формой) заменяются
типизированными маркерами до обращения к LLM.
Для обычных действий каждый маркер должен вернуться ровно один раз. Для summary
второстепенные маркеры могут быть опущены, но модель не может изменить,
дублировать или добавить реквизиты.

С версии 0.1.2 внутренние маркеры используют устойчивый для токенизатора ASCII-
формат `[[BANKAI:X]]` и `[[BANKAI:PAR:X]]`. Для перевода разрешены три попытки:
это снижает вероятность ложного отказа при сохранении строгого запрета на потерю,
подмену или дублирование защищённых значений.

Для действий, заменяющих исходный текст, переводы строк Word (`CR`, `LF` и
`CRLF`) также временно заменяются маркерами. Потеря, дублирование или создание
границы абзаца отклоняет ответ модели и запускает повторную попытку. Для summary
это не применяется, поскольку результат добавляется отдельно и может иметь свою
структуру.

## Структура AI-слоя

```text
local-runtime/src/
├── actions/       prompt catalog, отдельные action-промпты и параметры
├── providers/     интерфейсы, mock и LiteLLM adapter
├── services/      TransformService orchestration
└── validators/    защита реквизитов и проверка результата
```

Фасад каталога находится в `packages/local-runtime/src/actions/prompts.ts`, а
сами промпты — в `packages/local-runtime/src/actions/prompts/`:

```text
prompts/
├── builder.ts     единый XML-контракт и общие приоритеты
├── index.ts       типизированный каталог TransformAction → prompt
├── rewrite.ts
├── shorten.ts
├── formalize.ts
├── grammar.ts
├── translate.ts
├── expand.ts
├── tone.ts
└── summary.ts
```

Каждый prompt содержит разделы `role`, `priority`, `input_contract`, `task`,
`allowed_changes`, `must_preserve`, `output_contract`, `examples` и
`final_check`. На каждое действие заданы два коротких few-shot примера. Промпты
не смешаны с HTTP-клиентом LiteLLM или валидацией результата.

## Структура Word Add-in

```text
addin/src/
├── api/          типизированный TransformClient
├── diff/         чистый алгоритм сравнения слов
├── office/       WordAdapter и безопасная замена текста внутри OOXML
├── ui/           построение карточек из action registry
└── main.ts       UI-controller и состояние текущей операции
```

## Структура Desktop Host

```text
desktop-host/src/
├── ipc/          обработчики окна настроек
├── services/
│   ├── config-service.ts
│   ├── runtime-manager.ts
│   └── word-addin-installer.ts
└── main.ts       Electron lifecycle, tray и координация сервисов
```

## Модель ошибок

Runtime возвращает стабильные коды `INVALID_API_KEY`, `PROVIDER_TIMEOUT`,
`PROVIDER_RATE_LIMIT`, `PROVIDER_UNAVAILABLE`, `RESULT_VALIDATION_FAILED` и
`PROVIDER_ERROR`. Ответ содержит безопасное сообщение, признак `retryable` и
`operationId`; внутренние сообщения провайдера пользователю не передаются.

## AI Provider

Для локальной демонстрации доступен `MockAiProvider`, который работает без ключей
и не передаёт текст наружу. Для рабочего теста реализован `OpenAiProvider` через
OpenAI-совместимый LiteLLM Chat Completions API. `TransformService` зависит от
интерфейса `CompletionProvider`, поэтому транспорт модели заменяется отдельно от
действий, промптов и валидаторов. Ключи и системные промпты не попадают в add-in.

Конфигурация OpenAI хранится только в локальном `.env`:

```dotenv
BANK_AI_PROVIDER=litellm
LLM_API_KEY=
LLM_API_BASE=https://prod-litellm.nationalbank.kz
LLM_MODEL=Qwen/Qwen3.5-35B-A3B-FP8
```

Для возврата к полностью локальному демонстрационному режиму достаточно указать
`BANK_AI_PROVIDER=mock`.

## Сохранение оформления Word

При чтении выделения Add-in сохраняет его OOXML. Если результат содержит то же
число абзацев, текст распределяется между исходными `w:r`/`w:t` по количеству
слов. Поэтому жирное начертание первого слова не переносится на остаток абзаца,
а свойства абзацев, заголовки, пустые абзацы, отступы, выравнивание, интервалы и
параметры списков сохраняются. Обрабатываются все виды границ строк Word: `CR`,
`LF` и `CRLF`. Если фрагмент OOXML нельзя безопасно сопоставить, используется
штатная текстовая вставка Word без риска повредить документ.

## Границы MVP

- только настольный Word;
- обычный выделенный текст;
- без RAG, SSO и вопросов по всему документу;
- сложное смешанное форматирование внутри одного абзаца может наследоваться от
  первого текстового run; изменения количества строк используют безопасный fallback;
- каждое изменение требует Accept;
- содержимое документа не записывается в технические логи.

## Тестирование

Архитектурные изменения выполняются по TDD. Автотесты Add-in, Desktop Host и
runtime проверяют полноту реестра,
`applyMode`, маскирование и точное восстановление реквизитов, запрет новых данных,
retry при потере маркера, API client, diff, настройки, поиск Word, типизированные
HTTP-ошибки, отсутствие исходных реквизитов в запросе к provider, сохранение
структуры OOXML и детерминированные quality gates для промптов.

Набор eval-кейсов находится в `packages/local-runtime/src/evals/`. Команда
`npm run eval:prompts` выполняет его на настроенном provider и возвращает
ненулевой код, если хотя бы один инвариант нарушен. Live-eval выполняется явно,
так как он обращается к внешнему корпоративному AI API.

## Следующие архитектурные шаги

1. Сохранять смешанное форматирование отдельных runs при значительном изменении текста.
2. Добавить экспертную разметку и эталонные ответы в eval-набор.
3. Добавить chunking и map-reduce для длинных документов.
4. Хранить ключ через Windows Credential Manager/DPAPI.
