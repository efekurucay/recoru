// src/background/index.js
let offscreenCreating = null;
let currentTabId = null;

async function setupOffscreenDocument(path) {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(path)]
  });

  if (existingContexts.length > 0) return;

  if (offscreenCreating) {
    await offscreenCreating;
  } else {
    offscreenCreating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['USER_MEDIA'],
      justification: 'Recording audio for guitar chords playback'
    });
    await offscreenCreating;
    offscreenCreating = null;
  }
}

async function startRecording(tabId) {
  currentTabId = tabId;
  await setupOffscreenDocument('src/recorder/offscreen.html');
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_START_RECORDING' });
}

async function stopRecording() {
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP_RECORDING' });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_RECORDING') {
    startRecording(sender.tab.id).catch(err => console.error(err));
    return;
  }

  if (msg.type === 'STOP_RECORDING') {
    stopRecording().catch(err => console.error(err));
    return;
  }

  // Sent by offscreen if microphone permission is strictly denied (or not requested yet)
  if (msg.type === 'OFFSCREEN_NEED_PERMISSION') {
    // Open a popup window to ask for permission
    chrome.windows.create({
      url: chrome.runtime.getURL('src/recorder/permission.html'),
      type: 'popup',
      width: 400,
      height: 300
    });
    // Tell content script that we had an error so it resets its UI
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { type: 'RECORDING_ERROR', error: 'Lütfen açılan pencereden mikrofon izni ver.' });
    }
  }

  if (msg.type === 'PERMISSION_GRANTED') {
    // If permission granted successfully via popup, we can just optionally tell the user they can retry now.
    // Or automatically retry: 
    if (currentTabId) {
      startRecording(currentTabId).catch(console.error);
    }
  }

  // Forward recording events from offscreen to the specific content script tab
  if (msg.type === 'RECORDING_STARTED' || msg.type === 'RECORDING_DONE' || msg.type === 'RECORDING_ERROR') {
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, msg);
    }
  }
});
