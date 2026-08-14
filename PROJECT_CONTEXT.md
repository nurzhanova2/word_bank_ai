# Контекст проекта Bank AI for Word

## 1. Статус снимка

Этот файл описывает фактическое состояние репозитория на 14 августа 2026 года, commit `88eb5c1`, версия приложения `0.5.5`. Источником истины при подготовке были исходный код, package-конфигурации, тесты, build-скрипты и workflow; документация использовалась как дополнительный источник и отдельно отмечена там, где расходится с реализацией.

Проверки, выполненные при подготовке контекста:

- `npm test` — успешно, 99 тестов: Add-in 23, Desktop Host 6, Local Runtime 70;
- `npm run typecheck` — успешно для всех четырёх workspace-пакетов;
- live-eval корпоративной модели в рамках этого аудита не запускался, поскольку он обращается во внешний API. `docs/PROGRESS.md` заявляет ранее выполненный результат 6/6, но это не было независимо перепроверено.

## 2. Назначение и границы продукта

Bank AI for Word — локально устанавливаемый AI-помощник для Microsoft Word под Windows. Пользователь выделяет фрагмент документа, запускает преобразование, видит inline-diff, затем явно применяет или отклоняет результат. Основной сценарий — редактирование банковских и официально-деловых текстов без передачи API-ключа в Word Add-in.

Реализованы восемь действий, зарегистрированных в `packages/contracts/src/index.ts`:

| Action | Интерфейс | Результат |
|---|---|---|
| `rewrite` | Переписать | заменяет выделение |
| `shorten` | Сократить | заменяет выделение |
| `summary` | Краткое содержание | добавляет после выделения блок `РЕЗЮМЕ:` |
| `formalize` | Формальный стиль | заменяет выделение |
| `grammar` | Проверить грамматику | отдельный Grammar Engine, исправления по одному или все |
| `translate` | Перевести | заменяет выделение; целевой язык `ru`, `kk` или `en` |
| `expand` | Расширить текст | заменяет выделение |
| `tone` | Изменить тон | заменяет выделение; `neutral`, `polite`, `strict`, `diplomatic` |

Текущая область продукта:

- только настольный Microsoft Word с Office Add-ins;
- только текущее текстовое выделение, до 20 000 символов;
- локальная панель и локальный HTTPS API на компьютере пользователя;
- рабочая генерация через внешний OpenAI-совместимый LiteLLM или локальный демонстрационный mock;
- grammar-проверка: локальный LanguageTool для русского/английского, Hunspell и детерминированные правила для казахского, плюс необязательный контекстный review через настроенную LLM.

Не реализованы: обработка всего документа, RAG, база знаний, Q&A по документу, SSO/AD/LDAP, роли, серверный BFF, централизованный аудит, история операций, DWH/Excel, общая БД и централизованное управление конфигурацией.

## 3. Фактическая архитектура

Репозиторий — npm workspaces monorepo из четырёх TypeScript-пакетов:

```text
Microsoft Word
  └─ Office.js Task Pane (@bank-ai/addin)
       ├─ читает выделение и OOXML
       ├─ показывает actions/diff/grammar issues
       └─ HTTPS fetch на тот же origin
            ↓
Local Runtime (@bank-ai/local-runtime), 127.0.0.1:3847
  ├─ Express API + статическая раздача Add-in
  ├─ TransformService → LiteLLM/OpenAI-compatible API или mock
  └─ GrammarService
       ├─ LanguageTool localhost:8081 — ru/en
       ├─ nspell + myspell-kk и локальные правила — kk
       └─ Qwen JSON review — необязательный внешний этап

Electron Desktop Host (@bank-ai/desktop-host)
  ├─ системный tray и окно настроек
  ├─ запускает Local Runtime в том же Electron-процессе
  ├─ запускает bundled LanguageTool отдельным Java-процессом
  └─ регистрирует manifest Word Add-in в HKCU

Shared contracts (@bank-ai/contracts)
  └─ версии, action registry, API/grammar-типы
```

Это локальный модульный монолит, а не набор серверных микросервисов. `packages/desktop-host/src/main.ts` координирует установленное приложение; `packages/local-runtime/src/server.ts` является отдельной точкой запуска для разработки без Electron.

### Компоненты и зависимости

| Компонент | Ответственность | Основные зависимости |
|---|---|---|
| `@bank-ai/contracts` | единый action registry, версия, request/response и grammar-типы | только TypeScript |
| `@bank-ai/addin` | Word Task Pane, API client, diff, применение результата и сохранение оформления | contracts, Office.js, `diff`, Vite |
| `@bank-ai/local-runtime` | HTTPS/Express API, prompts, LLM orchestration, validators, Grammar Engine | contracts, Express, Zod, OpenAI SDK, `nspell`, `diff`, dotenv |
| `@bank-ai/desktop-host` | Electron lifecycle, tray, настройки, запуск runtime/LanguageTool, Word sideloading, NSIS | local-runtime, Electron, electron-builder |

`contracts` — единственный декларативный источник метаданных действий. Add-in строит карточки из `actionDefinitions`, а API валидирует `action` и обязательные опции из того же реестра. Это уменьшает рассинхронизацию UI и backend.

## 4. Структура репозитория

```text
word_bank_ai/
├─ .github/workflows/build-windows.yml   # CI-сборка Windows installer
├─ .hallmark/                            # запись параметров UI-редизайна
├─ docs/
│  ├─ ARCHITECTURE.md                    # описание текущей локальной архитектуры
│  ├─ PROGRESS.md                        # журнал готового и ближайшие задачи
│  ├─ WINDOWS.md                         # установка и диагностика EXE
│  └─ README.md                          # раннее/перспективное сервисное видение
├─ packages/
│  ├─ contracts/
│  ├─ addin/
│  ├─ local-runtime/
│  └─ desktop-host/
├─ .env.example                          # пример dev-конфигурации без ключа
├─ package.json                          # workspace-команды
├─ package-lock.json                     # зафиксированный npm dependency graph
├─ tsconfig.base.json                    # общие strict TypeScript-настройки
├─ THIRD_PARTY_NOTICES.md                # nspell/myspell-kk лицензии
└─ README.md                              # основной пользовательский README
```

Сгенерированные `dist/`, `release/`, `node_modules/`, `.npm-cache/`, локальный `.env` и `packages/desktop-host/vendor/grammar/` исключены из Git. На машине аудита присутствуют локальные installer-файлы `0.5.4` и `0.5.5`, но они не являются частью репозитория.

### `packages/contracts`

- `src/index.ts` — `APP_VERSION = "0.5.5"`, action registry, apply mode, опции, API errors, health и grammar contracts.
- Компилируется в `dist` с `.d.ts` и экспортируется остальным workspace-пакетам.

### `packages/addin`

- `manifest.xml` — TaskPaneApp с постоянным ID `f5212ec9-4a1a-4ca7-a195-6fbcd8f7822e`, `ReadWriteDocument`, URL `https://localhost:3847/`.
- `index.html` — фактическая Workbench-разметка: status, actions, tone, единый блок «Изменения», grammar cards, Accept/Reject.
- `src/main.ts` — UI-controller и всё transient-состояние текущей операции.
- `src/ui/action-renderer.ts` — генерация карточек действий из shared registry; tone выводится отдельной панелью.
- `src/api/transform-client.ts` — relative-origin клиенты `/api/v1/transform` и `/api/v1/grammar/check`, преобразование API errors в `TransformApiError`.
- `src/diff/text-diff.ts` — токенизированный inline-diff, grammar ranges и применение выбранного множества исправлений.
- `src/office/word-adapter.ts` — чтение выделения/OOXML, replace/append через Word JavaScript API, snapshot и восстановление стилей абзацев.
- `src/office/formatted-ooxml.ts` — безопасная замена текста внутри исходных `w:p`/`w:r`/`w:t` при совпадающем числе абзацев.
- `src/tokens.css`, `src/styles.css` — OKLCH design tokens, адаптивная Workbench-сетка, sticky decision row, busy/error/reduced-motion состояния.
- `public/assets/` — иконки; `assistant-hero.png` остался в репозитории, но текущая разметка его не использует.

### `packages/local-runtime`

- `src/app.ts` — Express application, API routes, CORS, static Add-in hosting.
- `src/server.ts` — standalone HTTPS entry point для dev/start.
- `src/provider.ts`, `src/providers/` — provider facade, LiteLLM adapter и mock.
- `src/services/transform-service.ts` — полный transform pipeline и retry/chunking.
- `src/actions/` — options, глоссарий, защита XML-оболочки и каталог prompts.
- `src/actions/prompts/` — отдельный prompt каждого действия, общий builder и независимая версия каталога `2026.08.2`.
- `src/validators/` — защита реквизитов, абзацев и инварианты результата.
- `src/grammar/` — language detection, engines, orchestration и Qwen JSON contract.
- `src/evals/` — 6 live quality cases и детерминированный evaluator.
- `src/errors.ts` — стабильная публичная модель ошибок.
- `src/https-options.ts` — чтение либо создание доверенного localhost-сертификата через `office-addin-dev-certs`.

### `packages/desktop-host`

- `src/main.ts` — single-instance Electron app, tray, startup/shutdown и координация сервисов.
- `src/services/config-service.ts` — чтение/запись настроек подключения.
- `src/services/runtime-manager.ts` — in-process HTTPS runtime и fallback в mock при ошибке конфигурации.
- `src/services/language-tool-manager.ts` — скрытый запуск bundled Java/LanguageTool на `127.0.0.1:8081`.
- `src/services/word-addin-installer.ts` — HKCU-регистрация manifest и поиск/запуск `WINWORD.EXE`.
- `src/ipc/settings-ipc.ts`, `src/settings-page.ts`, `assets/settings-preload.cjs` — изолированное окно настроек через узкий contextBridge API.
- `scripts/prepare-grammar.ps1` — подготовка JRE 17, LanguageTool и myspell-kk перед installer build.
- `assets/installer.nsh` — завершение старого процесса при установке и удаление Word-регистрации при uninstall.
- `package.json` — electron-builder/NSIS packaging configuration.

## 5. Основные runtime flows

### Установленное Windows-приложение

1. Electron получает single-instance lock и создаёт tray.
2. Определяется каталог packaged resources и пользовательский `.env` в Electron `userData`.
3. `LanguageToolManager` пытается запустить bundled `jre/bin/java.exe` и `languagetool-server.jar`, ожидая готовность до примерно 10 секунд.
4. `RuntimeManager` загружает конфигурацию, создаёт LiteLLM provider. При отсутствующем ключе/ошибке выбора provider запускается mock и открывается окно настроек.
5. HTTPS Express server слушает только `127.0.0.1:3847`, раздаёт Add-in и API.
6. Приложение включает автозапуск текущего пользователя (`openAtLogin`, hidden).
7. Пользователь вручную выбирает в tray «Установить дополнение в Word». В HKCU `Software\Microsoft\Office\16.0\Wef\Developer` записывается путь к manifest, затем Word запускается, если executable найден.

NSIS сам не регистрирует Add-in при install: custom install hook только завершает старый процесс. Регистрация выполняется командой tray. При uninstall соответствующее значение HKCU удаляется.

### Обычное преобразование

1. `OfficeWordAdapter.getSelectedContent()` получает `range.text.trim()` и исходный OOXML.
2. Add-in отправляет `{ action, text, targetLanguage?, targetTone? }` на `/api/v1/transform`.
3. Zod проверяет action, непустой текст, максимум 20 000 символов и обязательную action option.
4. Для replace-действий границы строк маскируются `[[BANKAI:PAR:X]]`. Для summary структура может измениться, поэтому paragraph masking отключён.
5. Реквизиты маскируются `[[BANKAI:X]]`: URL, email, организации с правовой формой, ФИО после метки, ИИН/БИН, IBAN, БИК, счета, телефоны и числа.
6. Строится user message из mode option, целевого glossary для перевода, правил маркеров и XML-encoded `<source>`; инструкции внутри текста считаются недоверенными данными.
7. System prompt берётся из отдельного action-модуля. Все prompts создаются общим XML-like builder с role/priority/contracts/examples/final check.
8. LiteLLM вызывается через OpenAI Chat Completions с `temperature: 0`, timeout 45 секунд, максимум 2 SDK retry и `chat_template_kwargs.enable_thinking = false`.
9. Runtime декодирует XML entities, проверяет маркеры, восстанавливает реквизиты и абзацы, затем применяет action-specific result gates.
10. Обычные действия получают до 2 model attempts; перевод — до 3. При невозможности получить валидный ответ возвращается `RESULT_VALIDATION_FAILED`.
11. Add-in показывает единый inline-diff. Никакая правка не применяется до нажатия пользователем.
12. `Применить` заменяет выделение либо для summary добавляет `РЕЗЮМЕ: ...` двумя переводами строки ниже. `Отклонить` очищает preview; после частичных grammar-правок также восстанавливает исходный текст.

Для перевода текст длиннее 2 200 символов разбивается на блоки только по границам абзацев; блоки обрабатываются последовательно, объединяются и повторно валидируются целиком. Один отдельный абзац длиннее лимита не режется дальше.

### Инварианты результата

`validators/result.ts` отклоняет пустой ответ, новые/изменённые критические числовые токены, чрезмерное увеличение, нарушение ожидаемого направления длины для shorten/summary/expand и reasoning/boilerplate вроде `<think>` или «Вот результат». Summary может опустить исходные числа, но не изменить и не придумать их; другие действия должны сохранить полный multiset чисел.

Marker validation строже общей result validation: для обычных действий каждый защищённый реквизит и каждый paragraph marker должен вернуться ровно один раз, неизвестные и дублированные маркеры запрещены. Summary может опускать исходные реквизиты, но не добавлять/изменять их.

### Grammar flow

1. `language-detector.ts` определяет `ru`, `kk`, `en`, `mixed` или `unknown` эвристиками по латинице, кириллице, характерным казахским буквам/словам и сегментирует текст по предложениям/строкам с глобальными UTF-16 offsets.
2. Для `ru`/`en` первый совместимый локальный engine — LanguageTool (`ru-RU`, `en-US`) по `http://127.0.0.1:8081/v2/check` с timeout 15 секунд.
3. Для `kk` composite engine объединяет Hunspell и казахские правила. Hunspell через `nspell` читает `kk_KZ.aff/.dic`, игнорирует ссылки, email, реквизиты, аббревиатуры и whitelist. Неизвестные слова выдаются только как `suggestions`, `autoApply: false`; edit-distance подсказка никогда не заменяет слово автоматически.
4. Казахские rules автоматически находят повтор слова, пробел перед пунктуацией и известные ошибки раскладки; смешение латиницы/кириллицы помечается без автоматической замены.
5. Если provider не mock, после локального этапа Qwen проверяет весь исходный текст. Реквизиты заменяются равнодлинной маской `¤`, чтобы сохранить offsets. Ответ обязан соответствовать JSON Schema версии 1 с атомарными corrections.
6. Parser проверяет schema, точное совпадение `original`, диапазоны, пересечения, защищённые термины и запрещает замену одного слова фразой с пробелом. Ошибочный offset может быть восстановлен, только если фрагмент уникален. Невалидный отдельный элемент пропускается; недоступный/полностью невалидный AI review не уничтожает локальные результаты.
7. Находки объединяются по диапазону, предпочтение отдаётся применимой и затем более уверенной. Автоматические изменения применяются справа налево.
8. Add-in показывает максимум 24 карточки, позволяет применить одну правку или `Исправить всё`. Частичная правка каждый раз пересобирает текст из исходника и накопленного набора выбранных issues; список остаётся открыт. Review-only findings подсвечиваются, но кнопки замены не имеют.

Существенная деталь fallback: orchestration прекращает перебор локальных engines после первого успешно ответившего совместимого engine. Для русского/английского в текущем массиве нет второго локального engine; при падении LanguageTool остаётся только необязательный Qwen review (если не mock). Для mixed-текста язык Qwen review выбирается как общий detected language либо язык первого сегмента, поэтому это не полноценный поязыковой LLM-review каждого сегмента.

### Применение и сохранение Word-оформления

Для replace Add-in сначала снимает style/font/paragraph snapshots каждого затронутого абзаца. Если число строк результата совпало с числом OOXML paragraphs, новый текст распределяется по существующим text runs примерно по количеству слов; это сохраняет смешанное bold/italic форматирование лучше простой вставки. После insert OOXML вычисленные шрифт, размер, bold, italic, color, style, alignment, indents, spacing повторно применяются к вставленным абзацам. Если безопасное OOXML-сопоставление невозможно, используется `range.insertText` и paragraph snapshots.

Summary вставляется обычным текстом после selection и наследует font в конце выделения плюс style/paragraph formatting последнего абзаца. Экспортируемый helper `buildStyledAppendOoxml()` покрыт тестами, но фактический `appendAfterSelection()` его не вызывает.

## 6. API и ошибки

### `GET /health`

Возвращает `{ status: "ok", version, provider }` без проверки доступности LanguageTool или внешнего LLM. Это liveness runtime, а не полный readiness.

### `POST /api/v1/transform`

Принимает `TransformRequest`, возвращает `operationId`, `result`, имя provider и `durationMs`.

### `POST /api/v1/grammar/check`

Принимает `{ text }`, возвращает detected language, `correctedText`, массив позиционных `GrammarIssue`, имена реально отработавших engines и duration.

Стабильные ошибки runtime: `INVALID_API_KEY` (401), `PROVIDER_RATE_LIMIT` (429), `PROVIDER_UNAVAILABLE` (503), `PROVIDER_TIMEOUT` (504), `RESULT_VALIDATION_FAILED` (422), общий `PROVIDER_ERROR` (502); ошибки request schema возвращаются как `INVALID_REQUEST` (400). Пользователь получает безопасное сообщение, `retryable` и `operationId`, а не сырой ответ provider.

Express отключает `x-powered-by`, ограничивает JSON body 64 KiB и CORS origin двумя адресами: `https://localhost:3847` и `https://127.0.0.1:3847`.

## 7. Данные, конфигурация и внешние сервисы

### Хранение данных

- Базы данных, ORM, migrations, object storage и persistent document store отсутствуют.
- Текст текущей операции и issues хранятся только в памяти Add-in/runtime. История между запусками не сохраняется.
- Приложение не пишет содержимое документа в свои console logs; runtime логирует только `operationId` и безопасный error code для transform failure.
- Политика хранения и журналирования на стороне корпоративного LiteLLM/Qwen из репозитория не определяется.

### Конфигурация

Dev-конфигурация находится в корневом `.env` (ignored) по образцу `.env.example`:

```dotenv
BANK_AI_PORT=3847
BANK_AI_PROVIDER=litellm
LLM_API_KEY=
LLM_API_BASE=https://prod-litellm.nationalbank.kz
LLM_MODEL=Qwen/Qwen3.5-35B-A3B-FP8
```

Фактическое содержимое локального `.env` и секреты не включены в этот контекст. Provider также принимает aliases `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`; default без заданного provider — `mock`, default base — `https://api.openai.com/v1`, default model — `gpt-5.6-sol`.

В packaged Electron настройки лежат в `.env` внутри `app.getPath("userData")`. Окно настроек никогда не возвращает ключ renderer-процессу, а сообщает только `hasApiKey`; пустое поле сохраняет существующий ключ. Перед записью проверяются непустой ключ/model и HTTPS URL, затем выполняется пробный grammar transform. Файл создаётся с mode `0o600`, но ключ хранится как plaintext, без Windows Credential Manager/DPAPI.

Desktop Host жёстко использует порт 3847. `BANK_AI_PORT` влияет на standalone `server.ts`, но не на Electron `RuntimeManager`; manifest и CORS также жёстко привязаны к 3847. Поэтому изменение порта только в `.env` не является поддерживаемой конфигурацией всей системы.

### Внешние/локальные сервисы

- Корпоративный LiteLLM: default `https://prod-litellm.nationalbank.kz`, модель `Qwen/Qwen3.5-35B-A3B-FP8`; API key вводится пользователем.
- OpenAI-compatible transport: пакет `openai` и endpoint Chat Completions.
- Microsoft Office.js загружается Add-in из `https://appsforoffice.microsoft.com/lib/1/hosted/office.js`; работа UI зависит от доступности/кэша этого hosted script.
- LanguageTool работает локально отдельным Java-процессом, не как облачный API.
- myspell-kk работает полностью локально через `nspell`.
- HTTPS localhost использует сертификаты `office-addin-dev-certs` в пользовательском каталоге `~/.office-addin-dev-certs`.

## 8. Технологии и библиотеки

- Node.js `>=20`; CI использует Node 22.
- TypeScript 5.9, ES2022, ESM, strict, `noUncheckedIndexedAccess`.
- Vanilla TypeScript/HTML/CSS + Vite 7 для Add-in; React/Vue отсутствуют.
- Microsoft Office JavaScript API и OOXML.
- Express 5, CORS, Zod 4, dotenv.
- OpenAI JavaScript SDK 5 для LiteLLM-compatible Chat Completions.
- `diff` 9 для UI/LLM diff.
- `nspell` 2.1.5 + myspell-kk.
- LanguageTool Java server + bundled Eclipse Adoptium JRE 17.
- Electron 43.3 и electron-builder 26/NSIS.
- Node built-in test runner через `tsx`; отдельного Jest/Vitest нет.

Точные transitive npm-версии зафиксированы `package-lock.json`. Версия LanguageTool берётся из mutable `LanguageTool-stable.zip`, а JRE — из `latest/17` Adoptium API, поэтому их точные версии не закреплены исходным кодом.

## 9. Запуск и сборка

### Разработка

```powershell
npm install
Copy-Item .env.example .env
npx office-addin-dev-certs install
npm run build
npm start
```

После запуска: панель `https://localhost:3847`, health `https://localhost:3847/health`. Manifest для ручного sideloading: `packages/addin/manifest.xml`.

Основные команды:

| Команда | Что делает |
|---|---|
| `npm run dev` | build contracts/Add-in, затем watch standalone runtime |
| `npm run build` | последовательно собирает contracts, Add-in, runtime, desktop-host |
| `npm run typecheck` | build contracts/runtime и no-emit checks Add-in/Desktop |
| `npm test` | build contracts и тесты всех workspace с test script |
| `npm start` | запускает собранный standalone runtime |
| `npm run desktop` | собирает и запускает Electron host для разработки |
| `npm run eval:prompts` | live-eval текущего provider; может отправлять тестовые тексты наружу |
| `npm run dist:win` | полная build, загрузка grammar dependencies, x64 NSIS installer |

`npm run dist:win` требует Windows/PowerShell и сети. `prepare-grammar.ps1` проверяет SHA-256 только для трёх myspell-kk файлов. LanguageTool archive и Adoptium JRE скачиваются без зафиксированного hash в скрипте.

### Installer и CI

electron-builder создаёт per-user assisted NSIS `packages/desktop-host/release/BankAI-Setup-${version}.exe`, без desktop shortcut, со Start Menu shortcut и автозапуском после установки. `deleteAppDataOnUninstall: false`, поэтому пользовательская конфигурация остаётся после uninstall. Developer CA также намеренно не удаляется.

`.github/workflows/build-windows.yml` запускается вручную или по tag `v*`: checkout → Node 22/npm ci → typecheck → tests → installer build → artifact `BankAI-Windows-x64`. Workflow не публикует GitHub Release и явно отключает auto-discovery code-signing identity. Коммерческая подпись installer отсутствует; SmartScreen warning ожидаем для pilot build.

## 10. Тестирование и quality gates

Тесты размещены рядом с production-кодом как `*.test.ts` и запускаются Node test runner:

- Add-in: API client, diff, individual grammar fix, OOXML paragraphs/runs/styles, Word formatting helpers и статические UI layout/accessibility contracts.
- Desktop Host: config validation, LanguageTool lifecycle, parsing Word executable.
- Runtime: API, registry architecture, error mapping, prompts, validators, retries, translation chunking, grammar engines, language detection, Qwen JSON parsing и eval evaluator.

Тесты в основном unit/integration на уровне функций и Express app. Реального Microsoft Word/Office COM, Electron GUI, NSIS install/uninstall, настоящего LanguageTool процесса и end-to-end UI automation в suite нет. Единственный явно незавершённый пункт `docs/PROGRESS.md` — визуальная приёмка grammar cards внутри Word.

`src/evals/` содержит 6 последовательных provider cases: grammar с реквизитами/абзацами, rewrite ФИО/телефона, shorten, expand, казахский перевод и summary. Проверяются non-empty, реквизиты, число абзацев, length ratios, обязательные и запрещённые строки. Это детерминированные инварианты, а не полноценная экспертная оценка качества языка.

## 11. Логирование, мониторинг и безопасность

- Централизованного logging/metrics/tracing/alerting нет.
- Нет audit trail Accept/Reject, пользователей или документов.
- `operationId` помогает связать UI error с одной runtime-ошибкой, но логи не персистентны.
- stdout/stderr LanguageTool подавлены (`stdio: "ignore"`).
- `/health` не проверяет LLM/LanguageTool и не содержит метрик.
- Runtime слушает loopback, однако API не имеет собственной аутентификации/CSRF token. Защитой служат локальная привязка и ограниченный CORS; это не эквивалент авторизации процесса на localhost.
- API key не попадает в manifest/Add-in и не возвращается settings renderer, но хранится незашифрованным в пользовательском `.env`.
- Prompt injection частично смягчается system contract и XML-encoding source; это логическая защита, не абсолютная гарантия поведения модели.
- Реквизит masking снижает риск изменения значений, но masked документ всё равно отправляется во внешний LiteLLM, и остальной текст не обезличивается.
- Code signing и supply-chain pinning LanguageTool/JRE пока отсутствуют.

## 12. Текущее состояние

### Реализовано

- Windows tray app, settings UI, localhost HTTPS runtime и Word manifest registration;
- все 8 actions, shared registry/options/apply modes;
- отдельные versioned prompts с общим контрактом и few-shot examples;
- mask/restore реквизитов и абзацев, retry и result validation;
- длинный translation chunking по абзацам;
- единый inline-diff и явный human-in-the-loop;
- summary append с `РЕЗЮМЕ:`;
- сохранение paragraph/style/font и части mixed-run formatting через OOXML;
- Grammar Engine 0.5.x: language detection, LT ru/en, Hunspell/rules kk, Qwen JSON review, individual fixes/Fix all;
- mock-mode, safe typed errors, tests, live eval harness и Windows CI artifact.

### Частично реализовано или ограничено

- Сохранение mixed formatting эвристическое: новый текст распределяется по исходным runs по числу слов, а при изменении paragraph count используется fallback.
- Проверка языка эвристическая, а mixed Qwen review не выполняется отдельно для каждого языка.
- Казахская грамматика покрыта только небольшим набором правил; Hunspell intentionally review-only и имеет ограниченный словарь/whitelist.
- LanguageTool fallback для ru/en локально отсутствует; Qwen может компенсировать это только при рабочем external provider.
- UI показывает не более 24 grammar issue cards, даже если API вернул больше; `Исправить всё` использует все применимые issues.
- Максимум API — 20 000 символов; chunking есть только у translation и только на paragraph boundaries.
- Healthcheck поверхностный; observability и audit отсутствуют.
- Настройки локальные и plaintext; enterprise distribution/configuration отсутствуют.

### Запланировано документацией

Согласно `docs/PROGRESS.md`: визуальная приёмка grammar cards в Word, весь документ/разделы, пользовательские prompt templates и корпоративный glossary, metadata-only история, централизованное развёртывание и управляемая pilot-конфигурация. `docs/ARCHITECTURE.md` дополнительно предлагает экспертный eval dataset, улучшение run-format preservation, long-document map-reduce и Windows Credential Manager/DPAPI.

Более дальние RAG/DWH/Excel/Workspace/SSO/audit идеи из `docs/README.md` являются видением, а не текущим backlog, подтверждённым кодом.

## 13. Известный технический долг и риски

1. `ConfigService` хранит API key в plaintext; перенести секрет в Windows Credential Manager/DPAPI, оставив в `.env` только несекретные параметры.
2. Порт 3847 продублирован в manifest, CORS, Desktop Host и config output. Либо сделать его константой build-time, либо полностью поддержать configurable manifest/origins/runtime.
3. Нет process-level auth для localhost API. Для более строгой модели угроз нужен случайный per-install/session token и проверка Origin/Host.
4. `LanguageTool-stable.zip` и latest JRE не pin/hash-validated; нужны фиксированные версии и контрольные суммы/SBOM.
5. Отсутствует code signing installer и release publication policy.
6. Нет E2E Word/Electron/installer тестов; статические HTML/CSS assertions не заменяют визуальную и Office-host приёмку.
7. Grammar aggregation дедуплицирует только одинаковые диапазоны; частично пересекающиеся issues сохраняются до стадии apply/diff, где один из них может быть отброшен по порядку.
8. Qwen review masked requisites, но один язык выбирается для всего mixed-текста.
9. `getSelectedContent()` применяет `.trim()`, поэтому значимые leading/trailing whitespace выделения не входят в model input.
10. Сложное OOXML (таблицы, поля, content controls, revisions, нетекстовые runs) не имеет специальных тестов/контрактов.
11. `buildStyledAppendOoxml()` и `changedResultWordIndexes()` используются только тестами, а `assistant-hero.png` не используется UI; следует удалить либо подключить осознанно.
12. `app.get("/{*path}")` отдаёт `index.html` для любого неизвестного GET, поэтому опечатка API GET может маскироваться HTML-ответом.
13. Нет graceful health/readiness для LanguageTool и LLM, persistent diagnostics, crash reporting или automatic update mechanism.
14. Нет privacy classification/redaction кроме фиксированного набора реквизитов; неизвестно, допустима ли отправка остального банковского текста во внешний контур.

## 14. Расхождения документации и кода

- Корневой `README.md` говорит о preview «Было / Стало», но текущий UI намеренно имеет одну inline-вкладку/область «Изменения» без отдельных полных блоков.
- В корневом `README.md` пример installer path всё ещё `BankAI-Setup-0.5.4.exe`; package/version, Windows doc и текущая локальная сборка — `0.5.5`.
- Дерево в корневом `README.md` не показывает `packages/desktop-host`, хотя пакет является обязательной частью EXE.
- `docs/README.md` описывает предполагаемые API Gateway, Auth, Document Processing, Audit, Monitoring и другие сервисы. В текущем коде их нет; фактическая архитектура — localhost Express внутри Electron.
- `docs/ARCHITECTURE.md` в общем корректен, но формулировка о том, что installer должен зарегистрировать manifest, не соответствует текущей автоматике: пользователь запускает регистрацию из tray после install.
- `docs/PROGRESS.md` утверждает 99 тестов — это подтверждено текущим запуском. Утверждение live-eval 6/6 сохранено как заявленный исторический результат, не как проверка этого аудита.

## 15. Что важно знать перед изменениями

- Добавление action начинается в `packages/contracts/src/index.ts`; затем нужен отдельный prompt в `local-runtime/src/actions/prompts/`, mapping в `prompts/index.ts` и тесты registry/prompt/API/UI. Не дублировать action metadata вручную в клиентах.
- Для `grammar` не использовать обычный `/transform`: UI и response contract завязаны на `/api/v1/grammar/check` и точные UTF-16 offsets.
- Нельзя автоматически применять Hunspell suggestions для казахского. `suggestions` — справка, `replacements` — только подтверждённая замена.
- Любое изменение текста после вычисления grammar offsets должно учитывать, что offsets относятся к исходному JS string (UTF-16). Применять правки справа налево либо пересчитывать диапазоны.
- Не ослаблять marker validation без отдельного решения по риску реквизитов. Для summary omission разрешён намеренно, для replace-actions — нет.
- Изменение количества абзацев в replace-action конфликтует с layout contract и style preservation. Summary — единственное текущее действие с `append` и свободной структурой.
- Add-in должен оставаться same-origin с runtime и работать по доверенному HTTPS; Office manifest не принимает обычный HTTP localhost как текущий production-like сценарий.
- API key никогда не должен попадать в frontend, manifest, commit, диагностический ответ или этот контекст.
- Перед релизом минимум запускать `npm run typecheck`, `npm test`, `npm run build`; live `npm run eval:prompts` запускать только осознанно с разрешённым API/данными. Для UI/Word-изменений нужна ручная проверка внутри реального Word.
- При изменении версии синхронизировать root и все package versions, `APP_VERSION`, internal workspace dependency versions и документацию/installer filename.

## 16. Что нельзя определить из репозитория

- SLA, privacy/retention и доступность корпоративного LiteLLM/Qwen;
- владельцы продукта, support contacts и процесс выдачи API keys;
- поддерживаемые точные версии Microsoft Word/Office beyond manifest requirement WordApi 1.1;
- enterprise deployment mechanism и политики IT/ИБ;
- наличие коммерческого code-signing certificate;
- фактические версии LanguageTool/JRE в installer без анализа конкретного собранного artifact;
- production telemetry, поскольку соответствующей системы в коде нет;
- покрытие реальных банковских языковых кейсов экспертной разметкой — текущие tests/evals этого не доказывают.
