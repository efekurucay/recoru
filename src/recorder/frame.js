// src/recorder/frame.js
// Runs inside the extension-origin iframe to get extension-level mic permission
// and passes audio buffer back via postMessage.

let mediaRecorder = null;
let audioChunks = [];
let stream = null;

window.addEventListener('message', async (event) => {
  if (event.data?.type === 'START_RECORDING') {
    await startRecording();
  }
  if (event.data?.type === 'STOP_RECORDING') {
    stopRecording();
  }
});

async function startRecording() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    // WebM is well supported in Chrome
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
      // Critical fix for playback: We must send ArrayBuffer because Blob 
      // can't be cloned properly across window realms in some Chrome versions
      const buffer = await blob.arrayBuffer();
      window.parent.postMessage({ type: 'RECORDING_DONE', buffer, mimeType }, '*');
    };

    mediaRecorder.start();
    window.parent.postMessage({ type: 'RECORDING_STARTED' }, '*');
  } catch (err) {
    stream = null;
    let msg = 'Mikrofon açılamadı.';
    if (err.name === 'NotAllowedError') msg = 'Mikrofon izni reddedildi.';
    else if (err.name === 'NotFoundError') msg = 'Mikrofon bulunamadı.';
    window.parent.postMessage({ type: 'RECORDING_ERROR', error: msg }, '*');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}
