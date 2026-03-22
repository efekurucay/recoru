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
  
  window.recoruUI.initUI(songInfo, {
    onStartRecord: () => {
      // Send directly to background.js service worker which manages offscreen recording
      chrome.runtime.sendMessage({ type: 'START_RECORDING' });
    },
    onStopRecord: () => {
      chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
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

  // Listen to messages from the background service worker
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (!msg.type) return;
    
    switch (msg.type) {
      case 'RECORDING_STARTED':
        window.recoruUI.setRecordingState(true);
        break;
      case 'RECORDING_ERROR':
        window.recoruUI.setRecordingState(false);
        window.recoruUI.showError(msg.error || 'Mikrofon hatası');
        break;
      case 'RECORDING_DONE':
        window.recoruUI.setRecordingState(false);
        try {
          const blob = new Blob([msg.buffer], { type: msg.mimeType });
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
