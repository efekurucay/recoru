// offscreen.js — Ses kaydı bu context'te yapılır
// Offscreen document içinden getUserMedia çalışır

let mediaRecorder = null;
let audioChunks = [];
let stream = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OFFSCREEN_START') {
    startRecording();
    return;
  }
  if (msg.type === 'OFFSCREEN_STOP') {
    stopRecording();
    return;
  }
});

async function startRecording() {
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
      const blob = new Blob(audioChunks, { type: mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      // ArrayBuffer olarak popup'a gönder (Blob mesajla gönderilemez)
      chrome.runtime.sendMessage({
        type: 'RECORDING_DONE',
        buffer: arrayBuffer,
        mimeType
      });
    };

    mediaRecorder.start();
    chrome.runtime.sendMessage({ type: 'RECORDING_STARTED' });
  } catch (err) {
    chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: err.message });
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}
