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
      songTitle: slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      site: config.name
    };
  } catch {
    return null;
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
let activeTabId = null;
let currentAudio = null;
let currentPlayBtn = null;

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  setTimeout(() => errorMsg.classList.add('hidden'), 6000);
}

function setRecordingUI(recording) {
  btnStart.classList.toggle('hidden', recording);
  btnStop.classList.toggle('hidden', !recording);
  recordLabel.disabled = recording;
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

// Content script'ten gelen mesajları al (RECORDING_DONE, vs.)
chrome.runtime.onMessage.addListener((msg) => {
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

// Kayıt başlat — content script'e mesaj gönder
btnStart.addEventListener('click', async () => {
  if (!currentSong || !activeTabId) return;
  try {
    const response = await chrome.tabs.sendMessage(activeTabId, { type: 'START_RECORDING' });
    if (response && response.ok) {
      setRecordingUI(true);
    } else {
      showError(response?.error || 'Kayıt başlatılamadı.');
    }
  } catch (err) {
    showError('Sayfayla iletişim kurulamadı. Sayfayı yenileyin.');
  }
});

// Kayıt durdur — content script'e mesaj gönder
btnStop.addEventListener('click', async () => {
  if (!activeTabId) return;
  try {
    await chrome.tabs.sendMessage(activeTabId, { type: 'STOP_RECORDING' });
    // setRecordingUI(false) çağrısı RECORDING_DONE mesajı gelince yapılır
  } catch {
    setRecordingUI(false);
  }
});

async function init() {
  await initDB();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    noSong.classList.remove('hidden');
    recordSection.classList.add('hidden');
    recordingsSection.classList.add('hidden');
    return;
  }

  activeTabId = tab.id;
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
