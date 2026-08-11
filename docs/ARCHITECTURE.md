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
  → requisite masking
  → action prompt + options
  → CompletionProvider (LiteLLM)
  → marker integrity validation
  → requisite restoration
  → action result validation
  → replace / append согласно applyMode
```

Реквизиты (числа, даты, email и URL) заменяются маркерами до обращения к LLM.
Для обычных действий каждый маркер должен вернуться ровно один раз. Для summary
второстепенные маркеры могут быть опущены, но модель не может изменить,
дублировать или добавить реквизиты.

## Структура AI-слоя

```text
local-runtime/src/
├── actions/       prompt catalog и параметры действий
├── providers/     интерфейсы, mock и LiteLLM adapter
├── services/      TransformService orchestration
└── validators/    защита реквизитов и проверка результата
```

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

## Границы MVP

- только настольный Word;
- обычный выделенный текст;
- без RAG, SSO и вопросов по всему документу;
- без гарантии сохранения сложного OOXML;
- каждое изменение требует Accept;
- содержимое документа не записывается в технические логи.

## Тестирование

Архитектурные изменения выполняются по TDD. Автотесты проверяют полноту реестра,
`applyMode`, маскирование и точное восстановление реквизитов, запрет новых данных,
retry при потере маркера и отсутствие исходных реквизитов в запросе к provider.

## Следующие архитектурные шаги

1. Расширить защиту на ФИО, ИИН/БИН, IBAN/BIC и корпоративные идентификаторы.
2. Добавить типизированные ошибки и журнал operation ID без текста документа.
3. Вынести Office.js в тестируемый WordAdapter.
4. Добавить chunking и map-reduce для длинных документов.
5. Хранить ключ через Windows Credential Manager/DPAPI.
