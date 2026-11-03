# IMPERION B2B: проверка и выпуск после отдельного GO

Статус этой поставки: CODE_READY / ISOLATED_TESTED, не LIVE.
Реальные заказы, счета и поступления этой работой не создавались.
Связанные задачи: #195, PR #167 (восстановленный исходник), PR #111 (проверка доказательств), PR #198 (уже выявленная рассинхронизация JS переводов RSVP).

## Что существует и что проверено 3 ноября 2026

| Этап | Существующий компонент | Независимая проверка |
| --- | --- | --- |
| Вход | `/corporate/` → `/corporate/request/`, четыре языка | Браузер нажимает существующий CTA; UTM переходят в форму |
| Приём | `supabase/functions/imperion-b2b-intake/index.ts` | Исходник production v1 совпал с PR #167 посимвольно: 5648 символов; новые изменения только в PR |
| Хранение | `public.imperion_b2b_inquiries` | Read-only catalog: RLS включён, grants только postgres/service_role; 0 строк на момент аудита |
| Приватная передача | `imperion-intake-bridge` | Проверяет существующий Vault bearer через RPC до чтения; GET pending / POST ACK |
| CRM | `imperion-intake-sync.gs` → существующий `Leads` | Read-only проверены 32 заголовка и действующий dropdown Stage; импорт по Submission_ID |
| Владелец | `impFlushOwnerDigest_`, существующий `IMPERION_NOTIFY_EMAIL` | Очередь Script Properties, UUID и приватная ссылка на строку; локальный mail sink в тесте |
| Копия заявителю | Существующий transactional receipt queue | Не менялась; отдельна от уведомления владельцу и маркетинга |

Не создаются CRM, endpoint, scheduler или агентная система. Существующий пятиминутный импортёр остаётся единственным импортёром.
Security advisor вернул только INFO `rls_enabled_no_policy` для 13 закрытых таблиц, включая B2B: отсутствие policies здесь соответствует server-only модели, открывать их не требуется. [Описание advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Read-only проверка Google выполнена через Google Drive/Sheets; доступ к клиентским строкам для аудита не требовался.
Удалённый исходник bound Apps Script и текущие Script Properties/владельцы триггеров не были доступны через этот connector: их точное совпадение с Git **не подтверждено**, сверка обязательна до выпуска.

## Исправленные дефекты

1. В live catalog ограничение `imperion_b2b_valid_email` содержало SQL-regex с двойными backslash (`\\s`, `\\.`). Этот шаблон отвергает обычный синтетический email. Миграция использует POSIX `[:space:]` и `[.]`, сохраняя остальные ограничения. Она **не применялась** к production.
2. Форма принимала success-looking ответ без reference, включая honeypot/duplicate. Теперь receipt требует UUID; honeypot не заявляет о сохранении, duplicate получает ID только через чтение сохранённой строки.
3. Старый dedup email+offer+день мог скрыть другую заявку и раскрыть её ID при угадывании email. Хеш использует полный серверный ключ вместо JWT-префикса. Теперь серверный хеш связан с полным нормализованным содержимым заявки, без даты и attribution. Точный повтор даёт тот же ID, отличающийся запрос — отдельный. Изменение серверного ключа изменит хеши: при ротации требуется отдельно проверить повторы.
4. UTM раньше склеивались в обрезаемый source. Теперь три ограниченных поля проходят от CTA до БД, приватного bridge и Notes существующего lead. Source сохраняет исходный CTA. URL, email, пробелы и слишком длинные labels отбрасываются. Campaign-коды должны быть неперсональными; синтаксическая валидация не определяет смысл произвольного слова.
5. Сбой после CRM append, но до очереди уведомления терял handoff. Восстановление теперь читает существующий Action_Status; UUID дедуплицирует запись очереди, следующий запуск подхватывает оставшиеся строки даже после ACK. Пакет больше 12 не теряет оставшиеся заявки.
6. Импорт блокируется без Created_At, Email, Notes, Retention_Until или Next_Action_At вместо тихого пропуска обязательных полей. В Notes записано действие владельца, дата — в Next_Action_At (24 часа после импорта).
7. Поток тела ограничен 8192 байтами; исключения транспорта дают generic 503 без PII. Неуспех скрывает предыдущий receipt.
8. Унаследованный красный глобальный тест `application script drift en` устранён той же точечной синхронизацией JS EN/RU/UK с canonical CS, которая уже подготовлена в #198. Метаданные и переводная HTML-разметка сохранены. Старый layout-тест также использовал CSP-несовместимый waitForFunction в Chromium этой среды: заменён на expect.poll с locator.evaluateAll, без ослабления CSP или критериев размеров.

9. npm audit выявил унаследованную high severity проблему проверки TLS при загрузке браузера в Playwright <1.55.1 ([GHSA-7mvr-c777-76hp](https://github.com/advisories/GHSA-7mvr-c777-76hp)). Test-only зависимость и lock обновлены минимально до 1.55.1. Статическая job загружает тестовый SDK только при необходимости; Docker readiness ждёт TCP-сервер после завершения init, а не временный Unix-only сервер.

## Воспроизведение без production

Требуются Node 22.16+ (CI использует текущий Node 22), Docker с локальным сокетом, Python 3 и Chromium.

```sh
npm ci --ignore-scripts
npx playwright install chromium
node --test tests/*.test.cjs
npm run test:security
npm run test:dom
npm test
npm run test:b2b:isolated
```

На Debian 13 в этой среде исходный bundled Chromium 134 падал на загрузке страниц; добавлен необязательный выбор установленного Chromium:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:b2b:isolated
```

CI использует поддерживаемый Ubuntu 24.04 и pinned Playwright 1.55.1. Новая job `b2b-isolated` сама запускает и удаляет контейнеры с уникальными именами и отдельной Docker-сетью. Порт REST привязан только к loopback, образы закреплены digest. Реальных ключей Supabase/Google не нужно.

Изолированный тест выполняет actual версии исходников Edge Functions с Deno.serve/env shim и настоящим pinned supabase-js через настоящий PostgREST к PostgreSQL. Для двух посторонних пустых очередей bridge созданы только необходимые контракты колонок; rate-limit SQL взят из существующей миграции. Проверка Vault заменена SQL-fixture с синтетическим ключом. GAS mapping/recovery/digest выполняются из actual исходника с локальными Sheets/Properties/Mail adapters. Это интеграционная проверка кода; облачные Deno gateway, Google IAM/триггеры и доставку Gmail она не подтверждает.

Независимые чтения: прямой `psql SELECT` после POST; отдельный снимок grid адаптера после импорта; `psql` после ACK; чтение локального mailbox после отправки. Артефакт `isolated-readback.json` содержит только синтетический UUID, счётчики и этап. Дополнительные проверки: повтор POST/ACK/import, неавторизованный bridge, anon/authenticated без доступа к таблице, неверные поля, honeypot, лимит спама, отсутствие UUID, сбои Properties/marker/MailApp и пакет 15 заявок.

Почта имеет семантику at-least-once: сбой сразу после передачи провайдеру может дать повтор. UUID в сообщении позволяет распознать его. `SENT_TO_PROVIDER` не равно доставке в inbox. Source ACK подтверждает CRM, а не доставку почты; очередь и Action_Status отслеживаются отдельно.

## Этапы продаж и доказательства

Публичный receipt `RECEIVED_UNCONFIRMED`, SQL `NEW_UNCONFIRMED` и CRM `New` означают только сохранённую заявку (нормализованный этап **NEW**). Импортёр никогда не повышает коммерческий этап. Внешний `status=PAID` не меняет Stage или Paid_CZK.

| Нормализованный этап | Обязательное независимое доказательство | Совместимость существующей CRM |
| --- | --- | --- |
| NEW | UUID сохранённой заявки, дата, контакт, source | `New` |
| QUALIFIED | Ответ покупателя: проблема, полномочный ЛПР, бюджет, срок | `Qualified`, private evidence reference в Notes |
| PROPOSAL | Конкретный scope, результат, acceptance, цена, payment/cancellation terms и переданная версия предложения | `Proposal_Sent`; черновик не считается переданным |
| CONTRACTED | Прочитанное письменное принятие/договор нужного OSVČ и согласованный scope | Существующий dropdown не имеет CONTRACTED; `Contract_Pending` не доказательство договора. Явно записать verified milestone + private reference в Notes |
| INVOICED | Прочитанный выданный счёт с номером, суммой, должником и сроком | `Awaiting_Payment` только вместе с invoice evidence в Notes |
| PAID | Независимое банковское чтение: правильный получатель, сумма, валюта, уникальная транзакция, связь со счётом | `Paid` и фактический Paid_CZK только после readback |

Нельзя выводить CONTRACTED/INVOICED только из текущего dropdown или публиковать evidence в GitHub. Не менять production validation для имитации шести этапов. PR #111 повторно использован как существующий локальный `ops/deal-proof-gate.cjs`: введённые ссылки — readiness, всегда `NEEDS_INDEPENDENT_READBACK`, никогда verified cash/order. Это не реестр сделок. См. [DEAL-PROOF-GATE.md](DEAL-PROOF-GATE.md).

## Порядок безопасного production-выпуска — только после отдельного GO

1. Зафиксировать одобренный commit и readback текущих Pages source/workflow/deployed SHA, двух Edge Functions, схемы БД, bound Apps Script и свойств без вывода значений секретов. На аудите Pages settings указывают `growth-experience`, а `.github/workflows/pages-production.yml` реагирует на `main`. Разрешить это расхождение явно; merge в main может запустить публикацию. Ни merge, ни изменение publishing branch этой работой не выполнялись.
2. Сохранить приватно rollback-копии двух функций, bound script и схему. Проверить текущий счётчик B2B и владельцев существующих триггеров. Сверить actual source импортёра с предлагаемым файлом, не перезаписывать посторонние изменения и Code.gs. Не устанавливать второй триггер.
3. Под owner GO применить **только** `20261103062215_imperion_b2b_revenue_hardening.sql` после сверки live schema. Не выполнять общий db push всех старых миграций. Перед заменой email-check проверить существующие строки на новый шаблон: при несовместимости остановиться, данные не удалять.
4. Убедиться, что RLS включён, anon/authenticated не имеют SELECT/INSERT/UPDATE/DELETE и policies не открывают доступ. Сверить ограничение email и три nullable UTM поля. Серверные service_role и Vault token остаются только в текущих защищённых хранилищах.
5. Обновить существующий GAS file в том же bound project и две существующие функции. Для обеих требуется `verify_jwt=false`: публичная форма без JWT, приватный bridge использует собственный Vault bearer, а не JWT. B2B production v1 уже имеет этот флаг; проверить bridge отдельно. Не менять URL, токены или владельцев триггеров. Проверить cron удаления B2B по retention_until и отдельный GAS cleanup; в этом PR новый cron не создаётся.
6. Проверить ограничения по IP в реальном gateway: заголовки forwarding должны перезаписываться доверенной инфраструктурой. CORS не является авторизацией; email/IP budgets и honeypot лишь уменьшают спам. При подтверждённом обходе лимитов остановить продвижение формы до дополнительной защиты на существующей инфраструктуре.
7. После явного GO опубликовать точный одобренный frontend в фактический Pages pipeline. Проверить CSP/CORS, 4 языка, телефон, CTA, UTM, доступность и generic ошибки. Публичные цены/сроки/обязательства в этом PR не меняются.
8. **Отдельное разрешение на production QA:** один тестовый запрос с owner-controlled email, маркером QA и заранее согласованным временем. В разрешении перечислить допустимую копию заявителю и уведомление владельцу, место хранения приватного UUID и удаление. До него production POST запрещён.
9. Прочитать по UUID: Supabase row → ровно один `Leads.Submission_ID=OSVC-B2B-UUID` → owner/дата/действие/Notes UTM → `crm_synced_at` → фактический inbox владельца с UUID. Отдельно проверить повтор: та же запись, без нового lead, без ложного повышения этапа. Убедиться, что серверный ключ не попал в браузер, логи или response.
10. Удалить **только одобренные QA UUID** из Supabase и точно соответствующие строки Leads; удалить только связанные pending-entries, если остались. Перечитать оба хранилища (0 этих UUID), проверить отсутствие остаточного письма/QA-очереди. Не сбрасывать общие лимиты или очереди реальных заявок; письмо в owner inbox удаляется владельцем по согласованию. Не удалять записи клиентов, попавшие в систему за время теста.
11. Только после независимого readback объявлять LIVE. В первые сутки контролировать возраст несинхронизированных B2B, ошибки триггера и pending digest, квоту MailApp и Next_Action_At. Не объявлять нулевую очередь при ошибке чтения. Ответ покупателю — вручную; никаких автоматических продаж или платежей.

При отказе любого этапа: остановить дальнейший выпуск, сохранить приватный incident по UUID, вернуть одобренные frontend/functions/GAS версии. Nullable UTM колонки можно оставить; старое неисправное regex-ограничение не возвращать автоматически. Не удалять реальные поступившие заявки при откате. Точная live-проверка и delivery остаются release gates, даже при зелёном CI.
