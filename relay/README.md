# Релей заявок VRAKK → Telegram-бот @VRAKK1_bot

Сайт отправляет заявку (JSON, `Content-Type: text/plain`, без предзапроса CORS) на адрес из `window.VRAKK_LEADS.endpoint` в `index.html`.
Токен бота и id чата живут только в секретах Cloudflare (или в свойствах Apps Script). В репозитории их нет.
Пока `endpoint` пустой или релей не ответил, форма показывает ссылки на Telegram и телефон и открывает чат @hv99978 с уже заполненной заявкой.

## Какие секреты задать при деплое

Воркер **не деплоить из этого репозитория автоматически**. Команды ниже — для владельца, с его машины после `npx wrangler login`.

| Имя | Где | Что это |
|---|---|---|
| `TG_TOKEN` | секрет Worker | Токен бота @VRAKK1_bot от @BotFather. Не логировать и не коммитить. |
| `TG_CHAT_ID` | секрет Worker | Id чата менеджера, только цифры. Раньше лежал в `wrangler.toml` — это персональные данные, в git больше не хранится. |
| `WEBHOOK_SECRET` | секрет Worker | Случайная строка. Путь вебхука `/tg/<WEBHOOK_SECRET>` и заголовок `X-Telegram-Bot-Api-Secret-Token`. |
| `ALLOWED_ORIGIN` | `[vars]` в `wrangler.toml` | Уже задан: `https://tosha78.github.io`. Это origin, без пути. Менять только если сменится домен. |
| `CLOUDFLARE_ACCOUNT_ID` | переменная окружения или `wrangler login` | Id аккаунта Cloudflare. В `wrangler.toml` не записан. |
| `LEADS` | KV binding | Неймспейс заявок. `id` в `wrangler.toml` — идентификатор привязки, не ключ доступа. |

Свойства Apps Script, если используется запасной релей: `TG_TOKEN`, `TG_CHAT_ID`.

```bash
cd relay
npx wrangler secret put TG_TOKEN
npx wrangler secret put TG_CHAT_ID
openssl rand -hex 24 | npx wrangler secret put WEBHOOK_SECRET
npx wrangler deploy
# один раз, подставьте секрет вебхука (его не сохраняйте в shell history скриншотом в открытый чат):
# curl "https://vrakk-leads.<account>.workers.dev/tg/<WEBHOOK_SECRET>/setup"
```

`/setup` ставит вебхук и меню команд. Повторять его нужно только если секрет или адрес воркера сменились.

Если неймспейс KV ещё не создан: `npx wrangler kv namespace create LEADS` и впишите выданный `id` в `wrangler.toml` локально.

## Что проверяет воркер

- CORS: `Access-Control-Allow-Origin` только если заголовок `Origin` равен `ALLOWED_ORIGIN`. Чужой origin — `403` без отражения origin. Запрос без `Origin` (curl с вашей машины) допускается.
- Тело не больше 16 КБ, только JSON-объект.
- Имя (от 2 символов, есть буква), телефон (РФ `7/8` и 10 цифр, либо `+` и 10–15 цифр), согласие `consent: true`. Иначе `400` и код `validation` или `consent`.
- Текст заявки собирается на сервере из полей. Переносы строк в имени и телефоне вырезаются, длина полей ограничена. VIN принимается только если это 17 символов без I, O, Q. Ссылка — только на `https://tosha78.github.io/stopper-site`.
- Скрытое поле `vrakk_hp` (honeypot): если заполнено, ответ `{ok:true}` и в Telegram ничего не уходит.
- Не больше 8 запросов за 10 минут с одного IP (`429`, `Retry-After`). Повтор той же заявки (телефон + имя + начало комментария) в течение 90 секунд не создаёт второе сообщение.
- Нет `TG_TOKEN` или `TG_CHAT_ID` — `503` и `error: "config"`, сайт уходит в запасной сценарий с Telegram и телефоном.
- Ошибка Telegram — `502` и `error: "telegram"`.

## Проверка с машины

```bash
curl -sS -X POST 'https://vrakk-leads.<account>.workers.dev' \
  -H 'Content-Type: text/plain; charset=utf-8' \
  -H 'Origin: https://tosha78.github.io' \
  -d '{"name":"Тест","phone":"+79172290000","consent":true,"comment":"проверочная заявка"}'
```

Слово «тест» в имени, авто или комментарии помечает заявку тестовой: в `/stats` она не считается.

## Команды бота

Работают только в чате `TG_CHAT_ID`: `/stats`, `/leads`, `/lead N`, `/sold N [сумма]`, `/help`.
Под заявкой кнопки «В работе / Продано / Отказ». После «Продано» ответьте на сообщение суммой (`350000` или `350к`).

## Запасной путь: Google Apps Script

См. комментарии в `apps-script.gs`. Тот же контракт полей (`name`, `phone`, `consent`, `vrakk_hp`). Секреты — только в свойствах скрипта.
