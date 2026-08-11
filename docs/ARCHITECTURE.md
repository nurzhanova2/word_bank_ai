# Архитектура Bank AI MVP

## Цель

Первый MVP проверяет один сценарий: выделить текст в Word, выполнить одно из трёх
AI-действий, увидеть «Было / Стало» и применить либо отклонить результат.

## Компоненты

```text
packages/addin          Word Task Pane: Office.js и пользовательский интерфейс
packages/contracts      Общие TypeScript-типы API
packages/local-runtime  HTTPS localhost API, статика панели и AI Provider
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
`expand`, `tone`. Для перевода передаётся `targetLanguage` (`ru`, `kk`, `en`),
для изменения тона — `targetTone` (`neutral`, `polite`, `strict`, `diplomatic`).
Размер текста ограничен 20 000 символами.

## AI Provider

Для локальной демонстрации доступен `MockAiProvider`, который работает без ключей
и не передаёт текст наружу. Для рабочего теста реализован `OpenAiProvider` через
OpenAI-совместимый LiteLLM Chat Completions API. Оба реализуют единый интерфейс `AiProvider`; ключи и
системные промпты не попадают в add-in.

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

## Следующие архитектурные шаги

1. Подключить корпоративный AI Gateway вместо mock-провайдера.
2. Добавить журнал метаданных Accept/Reject без текста документа.
3. Проверить сохранение стилей выделенного диапазона.
4. Создать Windows tray-host и установщик.
5. Подписать установщик и провести пилот на 2–5 устройствах.
