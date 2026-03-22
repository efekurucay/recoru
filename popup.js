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

function parseSongFromUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');
    const config = SITES[host];
    if (!config) return null;
    const match = parsed.pathname.match(config.pattern);
    if (!match || !match[1]) return null;
    const slug = match[1];
    return {
      songKey: config.prefix + ':' + slug,
      songTitle: slugToTitle(slug),
      site: config.name
    };
  } catch {
    return null;
  }
}

function slugToTitle(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// DOM refs
const noSong = document.getElementById('no-song');
const songInfoEl = document.getElementById('song-info');
const songSite = document.getElementById('song-site');
const songTitleEl = document.getElementById('song-title');
const recordingsSection = document.getElementById('recordings-section');
const recordingsList = document.getElementById('recordings-list');
const noRecordings = document.getElementById('no-recordings');
const recordingsCount = document.getElementById('recordings-count');
const recordSection = document.getElementById('record-section');
const recordLabel = document.getElementById('record-label');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const errorMsg = document.getElementById('error-msg');

let currentSong = null;
let isRecording = false;
let pendingBlob = null;
let currentAudio = null;
let currentPlayBtn = null;

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  setTimeout(() => errorMsg.classList.add('hidden'), 5000);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderRecordings(recordings) {
  recordingsList.innerHTML = '';

  if (recordings.length === 0) {
    noRecordings.classList.remove('hidden');
    recordingsCount.textContent = 'Kayıtlar';
    return;
  }

  noRecordings.classList.add('hidden');
  recordingsCount.textContent = `Kayıtlar (${recordings.length})`;

  recordings.forEach(rec => {
    const li = document.createElement('li');
    li.className = 'recording-item';
    const blobUrl = URL.createObjectURL(rec.audioBlob);

    li.innerHTML = `
      <div class="recording-info">
        <div class="recording-label">${escapeHtml(rec.label || 'İsimsiz kayıt')}</div>
        <div class="recording-date">${formatDate(rec.createdAt)}</div>
      </div>
      <div class="recording-actions">
        <button class="btn-play" title="Oynat">▶</button>
        <button class="btn-delete" title="Sil">🗑</button>
      </div>
    `;

    const playBtn = li.querySelector('.btn-play');
    const deleteBtn = li.querySelector('.btn-delete');

    playBtn.addEventListener('click', () => {
      if (currentPlayBtn && currentPlayBtn !== playBtn) {
        currentAudio && currentAudio.pause();
        currentPlayBtn.textContent = '▶';
        currentPlayBtn.classList.remove('playing');
      }

      if (currentAudio && !currentAudio.paused && currentPlayBtn === playBtn) {
        currentAudio.pause();
        playBtn.textContent = '▶';
        playBtn.classList.remove('playing');
        currentAudio = null;
        currentPlayBtn = null;
        return;
      }

      const audio = new Audio(blobUrl);
      currentAudio = audio;
      currentPlayBtn = playBtn;
      playBtn.textContent = '⏸';
      playBtn.classList.add('playing');
      audio.play().catch(() => showError('Ses oynatılamadı.'));
      audio.onended = () => {
        playBtn.textContent = '▶';
        playBtn.classList.remove('playing');
        currentAudio = null;
        currentPlayBtn = null;
      };
    });

    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Bu kaydı silmek istiyor musun?')) return;
      try {
        await deleteRecording(rec.id);
        URL.revokeObjectURL(blobUrl);
        await loadRecordings();
      } catch {
        showError('Kayıt silinemedi.');
      }
    });

    recordingsList.appendChild(li);
  });
}

async function loadRecordings() {
  if (!currentSong) return;
  try {
    const recs = await getRecordings(currentSong.songKey);
    renderRecordings(recs);
  } catch {
    showError('Kayıtlar yüklenemedi.');
  }
}

function setRecordingUI(recording) {
  isRecording = recording;
  btnStart.classList.toggle('hidden', recording);
  btnStop.classList.toggle('hidden', !recording);
  recordLabel.disabled = recording;
}

// Offscreen'den gelen mesajları dinle
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RECORDING_STARTED') {
    setRecordingUI(true);
  }

  if (msg.type === 'RECORDING_ERROR') {
    setRecordingUI(false);
    if (msg.error && msg.error.includes('NotAllowed')) {
      showError('Mikrofon izni verilmedi. Chrome ayarlarından eklentiye mikrofon izni ver.');
    } else {
      showError('Hata: ' + (msg.error || 'Bilinmeyen hata'));
    }
  }

  if (msg.type === 'RECORDING_DONE') {
    setRecordingUI(false);
    const blob = new Blob([msg.buffer], { type: msg.mimeType });
    const label = recordLabel.value.trim() || 'İsimsiz kayıt';
    recordLabel.value = '';
    saveRecording(currentSong.songKey, blob, label)
      .then(() => loadRecordings())
      .catch(() => showError('Kayıt kaydedilemedi.'));
  }
});

btnStart.addEventListener('click', () => {
  if (!currentSong) return;
  chrome.runtime.sendMessage({ type: 'START_RECORDING' }, (res) => {
    if (res && !res.ok) {
      showError('Kayıt başlatılamadı: ' + (res.error || ''));
    }
  });
});

btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
});

async function init() {
  await initDB();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    noSong.classList.remove('hidden');
    recordSection.classList.add('hidden');
    return;
  }

  currentSong = parseSongFromUrl(tab.url);

  if (!currentSong) {
    noSong.classList.remove('hidden');
    recordSection.classList.add('hidden');
    recordingsSection.classList.add('hidden');
    return;
  }

  noSong.classList.add('hidden');
  songInfoEl.classList.remove('hidden');
  songSite.textContent = currentSong.site;
  songTitleEl.textContent = currentSong.songTitle;

  await loadRecordings();
}

init().catch(console.error);
