// src/content/ui.js
window.recoruUI = (() => {
  let container = null;
  let currentAudio = null;
  let currentPlayBtn = null;
  let callbacks = {};

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yy} ${hh}:${min}`;
  }

  function formatDuration(sec) {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `   • ${m}:${s.toString().padStart(2, '0')}`;
  }

  function injectStyles() {
    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('type', 'text/css');
    link.setAttribute('href', chrome.runtime.getURL('src/content/style.css'));
    document.head.appendChild(link);
  }

  return {
    initUI(songInfo, actions) {
      callbacks = actions;
      injectStyles();
      
      container = document.createElement('div');
      container.id = 'recoru-widget';
      
      container.innerHTML = `
        <div class="recoru-header" id="recoru-toggle">
          <div class="recoru-logo">🎙️</div>
          <div class="recoru-title">
            <div class="recoru-site">${escapeHtml(songInfo.site)}</div>
            <div class="recoru-song">${escapeHtml(songInfo.songTitle)}</div>
          </div>
          <div class="recoru-chevron">▼</div>
        </div>
        
        <div class="recoru-body" id="recoru-body">
          <div class="recoru-list-header">
            <span id="recoru-count">Kayıtlar (0)</span>
          </div>
          <div id="recoru-error" class="recoru-error recoru-hidden"></div>
          
          <ul id="recoru-list" class="recoru-list">
            <li class="recoru-empty">Henüz hiç kayıt yok.</li>
          </ul>
          
          <div class="recoru-controls">
            <input type="text" id="recoru-record-label" placeholder="Kaydın adı (ör: Nakarat 1)" maxlength="60" />
            <button id="recoru-btn-start" class="recoru-btn recoru-btn-primary">Kayıt Başlat</button>
            <button id="recoru-btn-stop" class="recoru-btn recoru-btn-danger recoru-hidden">
              <span class="recoru-blink">●</span> Durdur
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(container);

      const toggleBtn = container.querySelector('#recoru-toggle');
      toggleBtn.addEventListener('click', () => {
        container.classList.toggle('recoru-collapsed');
        const chevron = container.querySelector('.recoru-chevron');
        chevron.textContent = container.classList.contains('recoru-collapsed') ? '▲' : '▼';
      });

      const btnStart = container.querySelector('#recoru-btn-start');
      const btnStop = container.querySelector('#recoru-btn-stop');
      
      btnStart.addEventListener('click', () => callbacks.onStartRecord());
      btnStop.addEventListener('click', () => callbacks.onStopRecord());
    },

    setRecordingState(isRecording) {
      if (!container) return;
      const btnStart = container.querySelector('#recoru-btn-start');
      const btnStop = container.querySelector('#recoru-btn-stop');
      const labelInput = container.querySelector('#recoru-record-label');
      
      if (isRecording) {
        btnStart.classList.add('recoru-hidden');
        btnStop.classList.remove('recoru-hidden');
        labelInput.disabled = true;
      } else {
        btnStart.classList.remove('recoru-hidden');
        btnStop.classList.add('recoru-hidden');
        labelInput.disabled = false;
      }
    },

    showError(msg) {
      if (!container) return;
      const errEl = container.querySelector('#recoru-error');
      errEl.textContent = msg;
      errEl.classList.remove('recoru-hidden');
      setTimeout(() => errEl.classList.add('recoru-hidden'), 4000);
    },

    updateRecordings(recordings) {
      if (!container) return;
      const listEl = container.querySelector('#recoru-list');
      const countEl = container.querySelector('#recoru-count');
      
      listEl.innerHTML = '';
      countEl.textContent = `Kayıtlar (${recordings.length})`;
      
      if (recordings.length === 0) {
        listEl.innerHTML = '<li class="recoru-empty">Henüz hiç kayıt yok.</li>';
        return;
      }

      recordings.forEach(rec => {
        const li = document.createElement('li');
        li.className = 'recoru-item';
        
        li.innerHTML = `
          <div class="recoru-item-info">
            <div class="recoru-item-label" title="${escapeHtml(rec.label || 'İsimsiz kayıt')}">${escapeHtml(rec.label || 'İsimsiz kayıt')}</div>
            <div class="recoru-item-date">${formatDate(rec.createdAt)}${formatDuration(rec.duration)}</div>
          </div>
          <div class="recoru-item-actions">
            <button class="recoru-icon-btn play-btn" title="Dinle">▶</button>
            <button class="recoru-icon-btn delete-btn" title="Sil">🗑</button>
          </div>
        `;

        const playBtn = li.querySelector('.play-btn');
        const deleteBtn = li.querySelector('.delete-btn');

        playBtn.addEventListener('click', async () => {
          try {
            if (currentPlayBtn && currentPlayBtn !== playBtn) {
              if (currentAudio && currentAudio.state === 'running') {
                await currentAudio.suspend();
              }
              currentPlayBtn.textContent = '▶';
              currentPlayBtn.classList.remove('recoru-playing');
            }

            if (currentAudio && currentPlayBtn === playBtn) {
              if (currentAudio.state === 'running') {
                await currentAudio.suspend();
                playBtn.textContent = '▶';
                playBtn.classList.remove('recoru-playing');
              } else if (currentAudio.state === 'suspended') {
                await currentAudio.resume();
                playBtn.textContent = '⏸';
                playBtn.classList.add('recoru-playing');
              }
              return;
            }

            // Start new playback utilizing Web Audio API to bypass strict CSP restrictions
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const arrayBuffer = await rec.audioBlob.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtx.destination);
            
            currentAudio = audioCtx;
            currentPlayBtn = playBtn;
            playBtn.textContent = '⏸';
            playBtn.classList.add('recoru-playing');
            
            source.onended = () => {
              playBtn.textContent = '▶';
              playBtn.classList.remove('recoru-playing');
              currentAudio.close();
              if (currentPlayBtn === playBtn) {
                currentAudio = null;
                currentPlayBtn = null;
              }
            };
            
            source.start();
            
          } catch (e) {
            console.error('Audio Playback Error:', e);
            this.showError('Oynatılamadı (Tarayıcı formatı desteklemiyor olabilir)');
            playBtn.textContent = '▶';
            playBtn.classList.remove('recoru-playing');
          }
        });

        deleteBtn.addEventListener('click', () => {
          callbacks.onDeleteRecord(rec.id);
        });

        listEl.appendChild(li);
      });
    }
  };
})();
