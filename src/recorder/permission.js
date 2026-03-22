document.getElementById('btn-allow').addEventListener('click', async () => {
  try {
    // Prompt the user for permission.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Stop tracks right away since we just needed the permission dialog
    stream.getTracks().forEach(t => t.stop());
    
    // Tell background script we got permission
    chrome.runtime.sendMessage({ type: 'PERMISSION_GRANTED' });
    
    // Auto close the popup and return to current page
    setTimeout(() => {
      window.close();
    }, 500);

  } catch (err) {
    alert('Mikrofon izni verilmedi. Adres çubuğundaki kilit (veya mikrofon) ikonuna tıklayıp izin vermelisiniz.');
  }
});
