// recorder.js — Extension origin iframe içinde çalışır
// getUserMedia bu bağlamda extension iznini kullanır,
// site izninden bağımsızdır.

let mediaRecorder = null;
let audioChunks = [];
let stream = null;

// Parent content.js'den gelen mesajları dinle
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
      // content.js'e geri bildir
      window.parent.postMessage({ type: 'RECORDING_DONE', buffer, mimeType }, '*');
    };

    mediaRecorder.start();
    window.parent.postMessage({ type: 'RECORDING_STARTED' }, '*');
  } catch (err) {
    stream = null;
    let msg = 'Mikrofon açılamadı.';
    if (err.name === 'NotAllowedError') {
      msg = 'Mikrofon izni reddedildi.';
    } else if (err.name === 'NotFoundError') {
      msg = 'Mikrofon bulunamadı.';
    }
    window.parent.postMessage({ type: 'RECORDING_ERROR', error: msg }, '*');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}
