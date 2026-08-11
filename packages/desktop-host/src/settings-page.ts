export const settingsPage = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Настройки Bank AI</title>
  <style>
    :root { font-family: Inter, "Segoe UI", sans-serif; color: #142033; background: #f7faf8; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; }
    .card { max-width: 470px; margin: auto; padding: 28px; border: 1px solid #dce6e0; border-radius: 18px; background: #fff; box-shadow: 0 18px 45px rgba(22,63,42,.09); }
    .brand { display: flex; align-items: center; gap: 13px; margin-bottom: 24px; }
    .logo { display: grid; place-items: center; width: 44px; height: 44px; color: white; font-size: 23px; font-weight: 700; border-radius: 11px; background: linear-gradient(145deg,#087443,#0a5e39); }
    h1 { margin: 0; font-size: 22px; }
    .intro { margin: 5px 0 0; color: #667085; font-size: 13px; }
    label { display: block; margin-top: 18px; color: #344054; font-size: 13px; font-weight: 650; }
    input { width: 100%; height: 44px; margin-top: 7px; padding: 0 13px; color: #142033; border: 1px solid #cfd9d3; border-radius: 10px; background: #fbfdfc; outline: none; }
    input:focus { border-color: #087443; box-shadow: 0 0 0 3px rgba(8,116,67,.1); }
    .hint { margin: 6px 0 0; color: #7a8699; font-size: 11px; line-height: 1.4; }
    .reveal { display: flex; align-items: center; gap: 7px; margin-top: 8px; font-size: 12px; font-weight: 400; cursor: pointer; }
    .reveal input { width: 15px; height: 15px; margin: 0; accent-color: #087443; }
    .status { min-height: 38px; margin-top: 20px; padding: 10px 12px; color: #526173; font-size: 12px; line-height: 1.4; border-radius: 9px; background: #f1f7f3; }
    .status.success { color: #06683c; background: #eaf7ef; }
    .status.error { color: #b42318; background: #fff0ef; }
    .buttons { display: grid; grid-template-columns: 1fr 1.45fr; gap: 10px; margin-top: 18px; }
    button { height: 44px; font: inherit; font-weight: 650; border-radius: 10px; cursor: pointer; }
    .cancel { color: #344054; border: 1px solid #d0d8d4; background: #fff; }
    .save { color: #fff; border: 0; background: linear-gradient(135deg,#087443,#0a633b); }
    button:disabled { opacity: .55; cursor: wait; }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <div class="logo">AI</div>
      <div><h1>Настройки подключения</h1><p class="intro">Ключ хранится только в вашем профиле Windows.</p></div>
    </div>
    <form id="settings-form">
      <label for="api-key">API-ключ</label>
      <input id="api-key" type="password" autocomplete="off" placeholder="Введите API-ключ">
      <label class="reveal"><input id="show-key" type="checkbox">Показать введённый ключ</label>
      <p id="key-hint" class="hint">Пустое поле сохранит уже настроенный ключ.</p>

      <label for="api-base">Адрес LiteLLM</label>
      <input id="api-base" type="url" required spellcheck="false">

      <label for="model">Модель</label>
      <input id="model" type="text" required spellcheck="false">

      <div id="status" class="status" role="status">Загрузка настроек…</div>
      <div class="buttons">
        <button class="cancel" id="cancel" type="button">Закрыть</button>
        <button class="save" id="save" type="submit">Сохранить и подключить</button>
      </div>
    </form>
  </main>
  <script>
    const apiKey = document.querySelector('#api-key');
    const apiBase = document.querySelector('#api-base');
    const model = document.querySelector('#model');
    const status = document.querySelector('#status');
    const save = document.querySelector('#save');

    function setStatus(message, kind = '') {
      status.textContent = message;
      status.className = 'status' + (kind ? ' ' + kind : '');
    }

    document.querySelector('#show-key').addEventListener('change', (event) => {
      apiKey.type = event.target.checked ? 'text' : 'password';
    });
    document.querySelector('#cancel').addEventListener('click', () => window.bankAiSettings.close());

    window.bankAiSettings.load().then((settings) => {
      apiBase.value = settings.apiBase;
      model.value = settings.model;
      apiKey.placeholder = settings.hasApiKey ? 'Ключ уже сохранён — введите новый для замены' : 'Введите API-ключ';
      setStatus(settings.hasApiKey ? 'API-ключ настроен. Можно изменить параметры подключения.' : 'Введите API-ключ для подключения к AI.');
    }).catch((error) => setStatus(error.message || String(error), 'error'));

    document.querySelector('#settings-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      save.disabled = true;
      setStatus('Сохраняем настройки и перезапускаем локальный API…');
      try {
        const result = await window.bankAiSettings.save({
          apiKey: apiKey.value,
          apiBase: apiBase.value,
          model: model.value
        });
        apiKey.value = '';
        apiKey.placeholder = 'Ключ уже сохранён — введите новый для замены';
        setStatus('Готово. Подключение активно: ' + result.provider, 'success');
      } catch (error) {
        setStatus(error.message || String(error), 'error');
      } finally {
        save.disabled = false;
      }
    });
  </script>
</body>
</html>`;
