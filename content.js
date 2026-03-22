// content.js — Sayfa context'inde çalışır
// 1. URL parse → şarkı bilgisini saklar
// 2. Kayıt komutlarını dinler, getUserMedia burada çalışır

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

// Kayıt durumu
let mediaRecorder = null;
let audioChunks = [];
let stream = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SONG') {
    sendResponse(songInfo || null);
    return true;
  }

  if (msg.type === 'START_RECORDING') {
    startRecording(sendResponse);
    return true; // async
  }

  if (msg.type === 'STOP_RECORDING') {
    stopRecording();
    sendResponse({ ok: true });
    return true;
  }
});

async function startRecording(sendResponse) {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
      const blob = new Blob(audioChunks, { type: mimeType });
      const buffer = await blob.arrayBuffer();
      // ArrayBuffer popup'a iletilebilir (Blob iletilemez)
      chrome.runtime.sendMessage({
        type: 'RECORDING_DONE',
        buffer,
        mimeType
      });
    };

    mediaRecorder.start();
    sendResponse({ ok: true });
  } catch (err) {
    stream = null;
    let errorMsg = 'Mikrofon açılamadı.';
    if (err.name === 'NotAllowedError') {
      errorMsg = 'Mikrofon izni verilmedi. Adres çubuğundaki kilit ikonuna tıklayarak izin ver.';
    } else if (err.name === 'NotFoundError') {
      errorMsg = 'Mikrofon bulunamadı. Cihazını kontrol et.';
    }
    sendResponse({ ok: false, error: errorMsg });
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}
