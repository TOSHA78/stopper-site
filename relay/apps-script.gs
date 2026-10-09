// STOPPER — релей заявок в Telegram (Google Apps Script, если Cloudflare недоступен).
// 1) script.google.com → Новый проект → вставьте этот код.
// 2) Настройки проекта → Свойства скрипта: TG_TOKEN = токен бота, TG_CHAT_ID = id чата.
// 3) Развернуть → Новое развёртывание → Веб-приложение: «Запуск от имени: я», «Доступ: все».
// 4) Скопируйте URL вида https://script.google.com/macros/s/…/exec в STOPPER_LEADS.endpoint на сайте.
function doPost(e) {
  var out = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  var d; try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'json' }); }
  if (d.website) return out({ ok: true }); // honeypot
  var digits = String(d.phone || '').replace(/\D/g, '');
  if (!String(d.name || '').trim() || digits.length < 10 || digits.length > 15) return out({ ok: false, error: 'validation' });
  var p = PropertiesService.getScriptProperties();
  var text = String(d.text || ('Заявка STOPPER\nИмя: ' + d.name + '\nТелефон: ' + d.phone + '\nАвтомобиль: ' + (d.car || '') + '\nКомплект: ' + (d.link || ''))).slice(0, 3500);
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + p.getProperty('TG_TOKEN') + '/sendMessage', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ chat_id: p.getProperty('TG_CHAT_ID'), text: text, disable_web_page_preview: true })
  });
  var t = {}; try { t = JSON.parse(r.getContentText()); } catch (err) {}
  return out({ ok: !!t.ok });
}
