# Чек-лист внедрения — Community Automation Hub (Apps Script)

Короткая версия для сверки по ходу настройки. Подробности каждого шага — в `community-hub-appsscript-guide.md`.

## A. Что нужно собрать (заполнить в CONFIG в Code.gs)

- [ ] `TELEGRAM_BOT_TOKEN` — от @BotFather
- [ ] `TELEGRAM_CHANNEL_ID` — `@username` канала (или числовой ID)
- [ ] `TELEGRAM_ADMIN_CHAT_ID` — твой личный chat_id (через `/getUpdates`)
- [ ] `CALENDAR_ID` — из Settings → Integrate calendar нового публичного календаря
- [ ] `CALENDAR_PUBLIC_LINK` — Public URL того же календаря
- [ ] `TALLY_FORM_ID` — из ссылки твоей формы (`/r/ЭТА_ЧАСТЬ`)
- [ ] `TALLY_WEBHOOK_SECRET` — придумай длинную случайную строку (например, через `=CONCATENATE()` со случайными символами или любой генератор паролей)
- [ ] `SPREADSHEET_ID` — из URL таблицы, между `/d/` и `/edit`

## B. Порядок действий

1. [ ] Загрузить `events-registrations-template.xlsx` в Google Sheets (File → Import) — листы Events и Registrations уже со столбцами и выпадающими списками
2. [ ] Создать Telegram-бота, добавить в канал админом → получить значения раздела A
3. [ ] Создать публичный Google Calendar → получить значения раздела A
4. [ ] Создать форму в Tally (поля: Full_Name, Telegram_Handle, Phone_Number, Age + hidden fields event_id/title/category/community/price/is_free + условная логика по категориям и is_free) → полная структура, тексты вейверов и политика отмены в `tally-form-structure.md`
5. [ ] Extensions → Apps Script в таблице → вставить `Code.gs`, заполнить CONFIG
6. [ ] Project Settings → Show appsscript.json → заменить на содержимое `appsscript.json`
7. [ ] Services (+) → добавить Google Calendar API
8. [ ] Запустить `onOpen` вручную → пройти экран авторизации (Advanced → Go to project unsafe → Allow)
9. [ ] Triggers → добавить три installable-триггера:
    - `onStatusChange` — On edit
    - `cleanupOldRegistrations` — Time-driven, Week timer
    - `sendEventReminders` — Time-driven, Day timer, время ~10:00 (шлёт напоминание за день до события, сравнивая календарную дату в Europe/Prague — не зависит от точного часа срабатывания триггера)
10. [ ] Deploy → New deployment → Web app → Execute as Me, Anyone → скопировать URL
11. [ ] В Tally: Integrations → Webhooks → вставить URL из шага 10 + `?secret=ТВОЙ_TALLY_WEBHOOK_SECRET`
12. [ ] Тест: тестовая строка в Events → `Status = Trigger_Sync` → проверить Calendar/Telegram/Sheet
13. [ ] Тест: пройти по `Tally_Form_URL` из тестовой строки → проверить Registrations
14. [ ] Тест на чекбоксы: один раз пройти форму НЕ отмечая чекбокс согласия на фото — убедиться, что в Registrations встало `Photo_Consent = no` (а не `yes`). Это проверка конкретного бага с пустым массивом, который был исправлен в коде
15. [ ] Тест на Free Event: создать тестовое событие с `Price_CZK = 0`, `Category = Free Event` → пройти по ссылке → убедиться, что форма показывает "Вход свободный", а НЕ "Оплатите 0 Kč"
16. [ ] Тест на отмену: тестовое событие → меню Community Hub → "❌ Отменить событие" → проверить, что в Telegram-канал ушло объявление и Status стал Archived
17. [ ] Tally → Form Settings → Email notifications → Self email notifications → включить (бесплатно, алерт на почту при каждой регистрации)
18. [ ] Tally → Form Settings → reCAPTCHA → включить (бесплатная защита от спам-регистраций)
19. [ ] (Параллельно, не блокирует запуск) Подать App Review + Business Verification в Meta для Facebook
20. [ ] Сайт: открой `ТВОЙ_URL_СО_ШАГА_10/exec` прямо в браузере (без `?callback=`) — должен вернуть JSON `{"events": [...]}`. Это и есть проверка, что `doGet` работает
21. [ ] В `index.html` найди строку `const EVENTS_API_URL = 'ВСТАВЬ_СЮДА_URL_ВЕБ_ПРИЛОЖЕНИЯ/exec';` и подставь туда тот же URL
22. [ ] Закоммить обновлённый `index.html` в свой GitHub-репозиторий (тот, что отдаёт `aliaksei-chareshneu.github.io/alchareshneu`) — у меня нет доступа на запись в репозиторий, это нужно сделать руками
23. [ ] Проверь публичный доступ календаря: Google Calendar → Settings → этот календарь → Access permissions → "Make available to public" должно быть включено, иначе embedded-календарь в `walkers-schedule` будет пустым

## C. На будущее — что появится отдельным шагом

- [ ] Когда Facebook одобрен: заполнить `FACEBOOK_PAGE_ID` / `FACEBOOK_PAGE_TOKEN`, поставить `FACEBOOK_ENABLED = true`
- [ ] Раз в месяц — бросить взгляд на `Sync_Error` в Events на предмет накопившихся ошибок
- [ ] Опционально: подключить нативную оплату картой через Stripe прямо в Tally вместо банковского перевода — убирает ручную сверку платежей, но это 5% комиссии на Free-плане Tally (0% на Pro) сверху обычных комиссий Stripe. Подробности и trade-off — в `tally-form-structure.md`
