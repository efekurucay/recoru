// src/content/index.js
// Uses window.recoruDB and window.recoruUI defined by previous scripts

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

if (songInfo) {
  main();
}

let recorderFrame = null;

function ensureRecorderFrame() {
  if (recorderFrame) return;
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('src/recorder/frame.html');
  iframe.allow = 'microphone';
  iframe.style.cssText = 'position:fixed;width:1px;height:1px;top:-9999px;left:-9999px;border:0;opacity:0;pointer-events:none;';
  document.documentElement.appendChild(iframe);
  recorderFrame = iframe;
}

async function loadRecordings() {
  try {
    const recs = await window.recoruDB.getRecordings(songInfo.songKey);
    window.recoruUI.updateRecordings(recs);
  } catch (err) {
    window.recoruUI.showError('Kayıtlar yüklenirken bir hata oluştu.');
  }
}

async function main() {
  await window.recoruDB.initDB();
  ensureRecorderFrame();
  
  window.recoruUI.initUI(songInfo, {
    onStartRecord: () => {
      recorderFrame.contentWindow.postMessage({ type: 'START_RECORDING' }, '*');
    },
    onStopRecord: () => {
      recorderFrame.contentWindow.postMessage({ type: 'STOP_RECORDING' }, '*');
    },
    onDeleteRecord: async (id) => {
      try {
        await window.recoruDB.deleteRecording(id);
        await loadRecordings();
      } catch {
        window.recoruUI.showError('Silinemedi.');
      }
    }
  });

  await loadRecordings();

  window.addEventListener('message', async (event) => {
    if (!event.data?.type) return;
    
    switch (event.data.type) {
      case 'RECORDING_STARTED':
        window.recoruUI.setRecordingState(true);
        break;
      case 'RECORDING_ERROR':
        window.recoruUI.setRecordingState(false);
        window.recoruUI.showError(event.data.error || 'Mikrofon hatası');
        break;
      case 'RECORDING_DONE':
        window.recoruUI.setRecordingState(false);
        try {
          const blob = new Blob([event.data.buffer], { type: event.data.mimeType });
          const labelInput = document.getElementById('recoru-record-label');
          const label = labelInput ? labelInput.value.trim() : '';
          if (labelInput) labelInput.value = '';
          
          await window.recoruDB.saveRecording(songInfo.songKey, blob, label || 'İsimsiz kayıt');
          await loadRecordings();
        } catch (err) {
          window.recoruUI.showError('Kayıt kaydedilemedi.');
        }
        break;
    }
  });
}
