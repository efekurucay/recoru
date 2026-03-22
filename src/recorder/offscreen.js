// src/recorder/offscreen.js
// Runs in the offscreen document to record audio

let mediaRecorder = null;
let audioChunks = [];
let stream = null;

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'OFFSCREEN_START_RECORDING') {
    await startRecording();
  }
  if (msg.type === 'OFFSCREEN_STOP_RECORDING') {
    stopRecording();
  }
});

async function startRecording() {
  try {
    // Attempt to get user media. If permission was never granted to the extension,
    // this will throw NotAllowedError immediately.
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
      // Send as ArrayBuffer to avoid cross-context clone errors
      const buffer = await blob.arrayBuffer();
      chrome.runtime.sendMessage({ type: 'RECORDING_DONE', buffer, mimeType });
    };

    mediaRecorder.start();
    chrome.runtime.sendMessage({ type: 'RECORDING_STARTED' });

  } catch (err) {
    stream = null;
    if (err.name === 'NotAllowedError') {
      // Permission not granted. We must ask the background to open a popup
      // so the user can grant permission to the extension itself.
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_NEED_PERMISSION' });
    } else {
      let msg = 'Mikrofon açılamadı.';
      if (err.name === 'NotFoundError') msg = 'Mikrofon bulunamadı.';
      chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: msg });
    }
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}
