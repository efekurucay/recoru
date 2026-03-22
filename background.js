// background.js — Service Worker
// Offscreen document yönetimi + ses kayıt mesajlaşması

async function ensureOffscreen() {
  // Chrome 116+ hasDocument kaldırıldı, clients API ile kontrol ediyoruz
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Mikrofon ile ses kaydı almak için'
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_RECORDING') {
    ensureOffscreen()
      .then(() => {
        // Offscreen doc'a kayıt başlat komutu ilet
        chrome.runtime.sendMessage({ type: 'OFFSCREEN_START' })
          .catch(() => {}); // offscreen henüz dinlemiyor olabilir, hata önemli değil
        sendResponse({ ok: true });
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
    return true; // async sendResponse
  }

  if (msg.type === 'STOP_RECORDING') {
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  // Offscreen'den gelen mesajları popup'a iletme
  // (popup zaten chrome.runtime.onMessage'ı dinliyor, broadcast olarak gelir)
});
