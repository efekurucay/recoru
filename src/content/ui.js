// src/content/ui.js
window.recoruUI = (() => {
  let container = null;
  let currentAudio = null;
  let currentSource = null;
  let currentBuffer = null;
  let currentOffset = 0;
  let lastStartTime = 0;
  let currentPlayBtn = null;
  let currentProgressBar = null;
  let currentAudioDuration = 0;
  let progressAnimId = null;
  let callbacks = {};
  let recTimer = null;
  let recSeconds = 0;

  const ICONS = {
    mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="recoru-svg"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" class="recoru-svg" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" class="recoru-svg" width="16" height="16"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="recoru-svg" width="16" height="16"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="recoru-svg" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="recoru-svg" width="16" height="16"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="recoru-svg" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="recoru-svg" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="recoru-svg" width="20" height="20"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    chevronUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="recoru-svg" width="20" height="20"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
  };

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
    if (sec === undefined || sec === null) return '';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
          <div class="recoru-logo">
            <img src="${chrome.runtime.getURL('assets/logo.png')}" alt="Logo" />
          </div>
          <div class="recoru-title">
            <div class="recoru-site">${escapeHtml(songInfo.site)}</div>
            <div class="recoru-song">${escapeHtml(songInfo.songTitle)}</div>
          </div>
          <div class="recoru-chevron">${ICONS.chevronDown}</div>
        </div>
        
        <div class="recoru-body" id="recoru-body">
          <div id="recoru-timer-bar" class="recoru-hidden">
            <div class="recoru-pulse"></div>
            <span id="recoru-timer-text">0:00</span>
          </div>

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
        chevron.innerHTML = container.classList.contains('recoru-collapsed') ? ICONS.chevronUp : ICONS.chevronDown;
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
      const timerBar = container.querySelector('#recoru-timer-bar');
      const timerText = container.querySelector('#recoru-timer-text');
      
      if (isRecording) {
        btnStart.classList.add('recoru-hidden');
        btnStop.classList.remove('recoru-hidden');
        labelInput.disabled = true;
        timerBar.classList.remove('recoru-hidden');
        
        recSeconds = 0;
        timerText.textContent = '0:00';
        clearInterval(recTimer);
        recTimer = setInterval(() => {
          recSeconds++;
          timerText.textContent = formatDuration(recSeconds);
        }, 1000);

      } else {
        btnStart.classList.remove('recoru-hidden');
        btnStop.classList.add('recoru-hidden');
        labelInput.disabled = false;
        timerBar.classList.add('recoru-hidden');
        clearInterval(recTimer);
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
        
        const finalBlob = new Blob([rec.audioBlob], { type: rec.mimeType || 'audio/webm' });
        const blobUrl = URL.createObjectURL(finalBlob);
        
        li.innerHTML = `
          <div class="recoru-item-info">
            <div class="recoru-item-label-container">
              <span class="recoru-item-label" title="${escapeHtml(rec.label || 'İsimsiz kayıt')}">${escapeHtml(rec.label || 'İsimsiz kayıt')}</span>
              <input type="text" class="recoru-edit-input recoru-hidden" value="${escapeHtml(rec.label || '')}" maxlength="60" />
            </div>
            <div class="recoru-item-date">${formatDate(rec.createdAt)}${formatDuration(rec.duration)}</div>
            <div class="recoru-progress-container recoru-hidden">
               <div class="recoru-progress-bar"></div>
            </div>
          </div>
          <div class="recoru-item-actions">
            <div class="recoru-action-group recoru-main-actions">
              <button class="recoru-icon-btn play-btn" title="Dinle">${ICONS.play}</button>
              <button class="recoru-icon-btn edit-btn" title="Yeniden Adlandır">${ICONS.edit}</button>
              <button class="recoru-icon-btn download-btn" title="İndir">${ICONS.download}</button>
              <button class="recoru-icon-btn delete-btn" title="Sil">${ICONS.trash}</button>
            </div>
            <div class="recoru-action-group recoru-confirm-delete recoru-hidden">
              <span class="recoru-confirm-text">Silinsin mi?</span>
              <button class="recoru-icon-btn confirm-yes-btn" title="Evet">${ICONS.check}</button>
              <button class="recoru-icon-btn confirm-no-btn" title="Hayır">${ICONS.x}</button>
            </div>
            <div class="recoru-action-group recoru-confirm-edit recoru-hidden">
              <button class="recoru-icon-btn edit-yes-btn" title="Kaydet">${ICONS.check}</button>
              <button class="recoru-icon-btn edit-no-btn" title="İptal">${ICONS.x}</button>
            </div>
          </div>
        `;

        const playBtn = li.querySelector('.play-btn');
        const editBtn = li.querySelector('.edit-btn');
        const downloadBtn = li.querySelector('.download-btn');
        const deleteBtn = li.querySelector('.delete-btn');
        const progContainer = li.querySelector('.recoru-progress-container');
        const progBar = li.querySelector('.recoru-progress-bar');
        
        const mainActions = li.querySelector('.recoru-main-actions');
        
        // --- Edit Logic ---
        const labelText = li.querySelector('.recoru-item-label');
        const editInput = li.querySelector('.recoru-edit-input');
        const confirmEditGroup = li.querySelector('.recoru-confirm-edit');
        const editYes = li.querySelector('.edit-yes-btn');
        const editNo = li.querySelector('.edit-no-btn');

        const toggleEditMode = (show) => {
          if (show) {
            labelText.classList.add('recoru-hidden');
            editInput.classList.remove('recoru-hidden');
            mainActions.classList.add('recoru-hidden');
            confirmEditGroup.classList.remove('recoru-hidden');
            editInput.focus();
          } else {
            labelText.classList.remove('recoru-hidden');
            editInput.classList.add('recoru-hidden');
            mainActions.classList.remove('recoru-hidden');
            confirmEditGroup.classList.add('recoru-hidden');
          }
        };

        editBtn.addEventListener('click', () => toggleEditMode(true));
        editNo.addEventListener('click', () => toggleEditMode(false));
        editYes.addEventListener('click', () => {
          const newLabel = editInput.value.trim();
          if (newLabel && newLabel !== rec.label) {
            if (callbacks.onRenameRecord) callbacks.onRenameRecord(rec.id, newLabel);
          }
          toggleEditMode(false);
        });

        // --- Delete Confirmation Logic ---
        const confirmDeleteGroup = li.querySelector('.recoru-confirm-delete');
        const confirmYes = li.querySelector('.confirm-yes-btn');
        const confirmNo = li.querySelector('.confirm-no-btn');

        const toggleDeleteMode = (show) => {
          if (show) {
            mainActions.classList.add('recoru-hidden');
            confirmDeleteGroup.classList.remove('recoru-hidden');
          } else {
            mainActions.classList.remove('recoru-hidden');
            confirmDeleteGroup.classList.add('recoru-hidden');
          }
        };

        deleteBtn.addEventListener('click', () => toggleDeleteMode(true));
        confirmNo.addEventListener('click', () => toggleDeleteMode(false));
        confirmYes.addEventListener('click', () => callbacks.onDeleteRecord(rec.id));

        // --- Download Logic ---
        downloadBtn.addEventListener('click', () => {
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = blobUrl;
          a.download = `${rec.label || 'Kayıt'}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        });

        // --- Playback Logic Hub ---
        const resetPlaybackUI = () => {
          playBtn.innerHTML = ICONS.play;
          playBtn.classList.remove('recoru-playing');
          progContainer.classList.add('recoru-hidden');
          progBar.style.width = '0%';
        };

        const stopCurrentSource = () => {
          if (currentSource) {
            currentSource.onended = null; 
            try { currentSource.stop(); } catch(e) {}
            currentSource = null;
          }
          cancelAnimationFrame(progressAnimId);
        };

        const startSourceAt = (offset) => {
          stopCurrentSource();
          
          const source = currentAudio.createBufferSource();
          source.buffer = currentBuffer;
          source.connect(currentAudio.destination);
          
          currentSource = source;
          currentOffset = offset;
          lastStartTime = currentAudio.currentTime;
          
          source.onended = () => {
            if (currentPlayBtn === playBtn) {
              currentOffset = 0;
              resetPlaybackUI();
              stopCurrentSource();
            }
          };

          source.start(0, offset);
          
          const animate = () => {
            if (!currentAudio || currentAudio.state !== 'running') return;
            const elapsed = currentAudio.currentTime - lastStartTime;
            const totalElapsed = currentOffset + elapsed;
            const pct = Math.min(100, (totalElapsed / currentAudioDuration) * 100);
            progBar.style.width = pct + '%';
            if (pct < 100) {
              progressAnimId = requestAnimationFrame(animate);
            }
          };
          progressAnimId = requestAnimationFrame(animate);
        };

        progContainer.addEventListener('click', (e) => {
          if (!currentBuffer || currentPlayBtn !== playBtn) return;
          
          const rect = progContainer.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const pct = Math.max(0, Math.min(1, x / rect.width));
          const newOffset = pct * currentAudioDuration;
          
          if (currentAudio.state === 'suspended') {
            currentAudio.resume().then(() => {
              startSourceAt(newOffset);
              playBtn.innerHTML = ICONS.pause;
              playBtn.classList.add('recoru-playing');
            });
          } else {
            startSourceAt(newOffset);
          }
        });

        playBtn.addEventListener('click', async () => {
          try {
            // 1. If clicking a DIFFERENT play button
            if (currentPlayBtn && currentPlayBtn !== playBtn) {
              if (currentAudio) {
                stopCurrentSource();
                await currentAudio.close();
              }
              // Reset the other button's UI if still in DOM
              if (document.body.contains(currentPlayBtn)) {
                currentPlayBtn.innerHTML = ICONS.play;
                currentPlayBtn.classList.remove('recoru-playing');
                currentPlayBtn.closest('.recoru-item').querySelector('.recoru-progress-container').classList.add('recoru-hidden');
              }
              currentAudio = null;
              currentBuffer = null;
            }

            // 2. Play / Pause toggle for CURRENT session
            if (currentAudio && currentPlayBtn === playBtn) {
              if (currentAudio.state === 'running') {
                // Pause: Suspend context and stop the source to preserve position
                await currentAudio.suspend();
                const elapsedSinceStart = currentAudio.currentTime - lastStartTime;
                currentOffset += elapsedSinceStart;
                stopCurrentSource();
                
                playBtn.innerHTML = ICONS.play;
                playBtn.classList.remove('recoru-playing');
              } else {
                // Resume: Re-create source from currentOffset
                await currentAudio.resume();
                startSourceAt(currentOffset);
                playBtn.innerHTML = ICONS.pause;
                playBtn.classList.add('recoru-playing');
              }
              return;
            }

            // 3. New Playback Session
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const arrayBuffer = await rec.audioBlob.arrayBuffer();
            currentBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            currentAudio = audioCtx;
            currentAudioDuration = currentBuffer.duration;
            currentPlayBtn = playBtn;
            currentProgressBar = progBar;
            
            progContainer.classList.remove('recoru-hidden');
            playBtn.innerHTML = ICONS.pause;
            playBtn.classList.add('recoru-playing');
            
            startSourceAt(0);

          } catch (e) {
            console.error('Playback Error:', e);
            this.showError('Başlatılamadı.');
            resetPlaybackUI();
          }
        });

        listEl.appendChild(li);
      });
    }
  };
})();
