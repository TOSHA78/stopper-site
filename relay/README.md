# Релей заявок STOPPER → Telegram-бот

Сайт отправляет заявку (JSON, `Content-Type: text/plain`) на адрес из `window.STOPPER_LEADS.endpoint` в `index.html`.
Релей хранит токен бота и chat_id, поэтому в коде сайта их нет. Пока `endpoint` пустой, кнопка формы открывает
`https://t.me/hv99978?text=…` с уже заполненной заявкой.

## 1. Бот и chat_id
1. В Telegram: @BotFather → `/newbot` → получите токен.
2. Напишите своему боту любое сообщение (или добавьте его в группу и напишите там).
3. Откройте `https://api.telegram.org/bot<ТОКЕН>/getUpdates` и возьмите `message.chat.id` — это TG_CHAT_ID.

## 2а. Cloudflare Worker (рекомендуется)
```
npm i -g wrangler && wrangler login
wrangler init stopper-leads   # выберите «Hello World», JavaScript
# замените src/index.js содержимым cloudflare-worker.js
wrangler secret put TG_TOKEN
wrangler secret put TG_CHAT_ID
wrangler deploy               # получите https://stopper-leads.<аккаунт>.workers.dev
```
Либо в панели Cloudflare: Workers → Create → вставить код → Settings → Variables → добавить секреты.

## 2б. Google Apps Script
См. комментарии в `apps-script.gs` (свойства скрипта TG_TOKEN / TG_CHAT_ID, развёртывание «Веб-приложение, доступ: все»).

## 3. Подключение на сайте
В `index.html`: `window.STOPPER_LEADS={endpoint:'https://stopper-leads.<аккаунт>.workers.dev'};`
После этого основная кнопка — «Отправить заявку»: заявка уходит боту автоматически, посетитель видит
«Заявка отправлена, свяжемся в течение 15 минут». Если релей не ответил, открывается Telegram с готовым текстом.

Проверка: `curl -X POST <endpoint> -H 'Content-Type: text/plain' -d '{"name":"Тест","phone":"+79161234567","text":"Тестовая заявка"}'`
