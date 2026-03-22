// content.js — Sayfa üzerine gizli iframe inject eder
// iframe extension origin'den yüklenir → getUserMedia oradan çalışır

const SITES = {
  'hakoru.net': {
    pattern: /^\/akor\/([^/?#]+)/,
    prefix: 'hakoru',
    name: 'Hakoru'
  },
  'repertuarim.com': {
    pattern: /^\/akor\/([^/?#]+?)(?:\.html)?$/,
    prefix: 'repertuarim',
    name: 'Repertuarım'
  }
};

function parseSong(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');
    const config = SITES[host];
    if (!config) return null;
    const match = parsed.pathname.match(config.pattern);
    if (!match || !match[1]) return null;
    return {
      songKey: config.prefix + ':' + match[1],
      songTitle: match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      site: config.name
    };
  } catch {
    return null;
  }
}

const songInfo = parseSong(window.location.href);

// Gizli iframe oluştur
let recorderFrame = null;
let frameReady = false;

function ensureFrame() {
  if (recorderFrame) return;

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('recorder.html');
  iframe.allow = 'microphone';
  iframe.style.cssText = 'position:fixed;width:1px;height:1px;top:-9999px;left:-9999px;border:0;opacity:0;pointer-events:none;';
  iframe.id = 'recoru-frame';
  document.documentElement.appendChild(iframe);
  recorderFrame = iframe;

  iframe.onload = () => {
    frameReady = true;
  };
}

// iframe'den gelen postMessage'ları chrome.runtime'a ilet
window.addEventListener('message', (event) => {
  if (!event.data?.type) return;
  const t = event.data.type;
  if (t === 'RECORDING_STARTED' || t === 'RECORDING_DONE' || t === 'RECORDING_ERROR') {
    chrome.runtime.sendMessage(event.data);
  }
});

// popup.js'den gelen mesajları dinle
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SONG') {
    sendResponse(songInfo || null);
    return true;
  }

  if (msg.type === 'START_RECORDING' || msg.type === 'STOP_RECORDING') {
    ensureFrame();

    const send = () => {
      recorderFrame.contentWindow.postMessage({ type: msg.type }, '*');
      sendResponse({ ok: true });
    };

    if (frameReady) {
      send();
    } else {
      // iframe henüz yüklenmediyse kısa süre bekle
      const check = setInterval(() => {
        if (frameReady) {
          clearInterval(check);
          send();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        sendResponse({ ok: false, error: 'Kayıt bileşeni yüklenemedi.' });
      }, 3000);
    }
    return true; // async
  }
});

// Sayfa yüklenince frame'i başlat
if (songInfo) {
  ensureFrame();
}
