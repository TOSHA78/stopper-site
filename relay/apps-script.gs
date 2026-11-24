// VRAKK — релей заявок в Telegram (Google Apps Script, если Cloudflare недоступен).
// 1) script.google.com → Новый проект → вставьте этот код.
// 2) Настройки проекта → Свойства скрипта (не в код):
//      TG_TOKEN   = токен бота от @BotFather
//      TG_CHAT_ID = id чата менеджера
// 3) Развернуть → Новое развёртывание → Веб-приложение: «Запуск от имени: я», «Доступ: все».
// 4) URL вида https://script.google.com/macros/s/…/exec → window.VRAKK_LEADS.endpoint в index.html.
// Apps Script не умеет ограничить CORS так же жёстко, как Worker. Для продакшена предпочтителен Worker.
function doPost(e) {
  var out = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  var d; try { d = JSON.parse(e.postData && e.postData.contents); } catch (err) { return out({ ok: false, error: 'json' }); }
  if (!d || typeof d !== 'object') return out({ ok: false, error: 'json' });
  if (String(d.vrakk_hp || '').trim()) return out({ ok: true });
  var line = function (v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 300); };
  var block = function (v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, n || 800); };
  var name = line(d.name, 80), phone = line(d.phone, 24);
  var digits = phone.replace(/\D/g, '');
  var phoneOk = (digits.length >= 10 && digits.length <= 15) && (/^[78]\d{10}$/.test(digits) || phone.charAt(0) === '+');
  if (name.length < 2 || !phoneOk) return out({ ok: false, error: 'validation' });
  if (d.consent !== true) return out({ ok: false, error: 'consent' });
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('TG_TOKEN'), chat = p.getProperty('TG_CHAT_ID');
  if (!token || !chat) return out({ ok: false, error: 'config' });
  var parts = ['Заявка VRAKK', '', 'Имя: ' + name, 'Телефон: ' + phone, '', 'Автомобиль: ' + (line(d.car, 180) || 'не указан')];
  [['vin', 'VIN', 20], ['pcd', 'Разболтовка', 80], ['brand', 'Бренд', 80], ['pistons', 'Поршни', 80], ['disc', 'Диск', 80], ['pads', 'Колодки', 120], ['color', 'Цвет', 40], ['kit', 'Комплект', 240], ['link', 'Ссылка', 300]].forEach(function (f) {
    var v = line(d[f[0]], f[2]); if (v) parts.push(f[1] + ': ' + v);
  });
  var comment = block(d.comment, 400), calc = block(d.calc, 500);
  if (calc) parts.push('', calc);
  if (comment) parts.push('', 'Комментарий: ' + comment);
  parts.push('', 'Согласие на обработку ПДн: дано');
  var text = parts.join('\n').replace(/\n{3,}/g, '\n\n').slice(0, 3500);
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ chat_id: chat, text: text, disable_web_page_preview: true })
  });
  var t = {}; try { t = JSON.parse(r.getContentText()); } catch (err) {}
  return out(t.ok ? { ok: true } : { ok: false, error: 'telegram' });
}
