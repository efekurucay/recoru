// src/storage/db.js
const DB_NAME = 'recoru';
const DB_VERSION = 2; // Incremented version to allow smooth upgrades if necessary
const STORE_NAME = 'recordings';

window.recoruDB = (() => {
  let _db = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('songKey', 'songKey', { unique: false });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  return {
    async initDB() {
      if (!_db) {
        _db = await openDB();
      }
      return _db;
    },

    async saveRecording(songKey, audioBlob, label, mimeType, duration) {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record = { 
          songKey, 
          audioBlob, 
          label, 
          mimeType,
          duration,
          createdAt: new Date().toISOString() 
        };
        const request = store.add(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
      });
    },

    async getRecordings(songKey) {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('songKey');
        const request = index.getAll(songKey);
        
        request.onsuccess = () => {
          // Sort explicitly by createdAt (newest first)
          const sorted = request.result.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
          resolve(sorted);
        };
        request.onerror = (e) => reject(e.target.error);
      });
    },

    async deleteRecording(id) {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
      });
    },

    async getAllSongs() {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('songKey');
        const keys = new Set();
        
        index.openKeyCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            keys.add(cursor.key);
            cursor.continue();
          } else {
            resolve([...keys]);
          }
        };
        index.openKeyCursor().onerror = (e) => reject(e.target.error);
      });
    }
  };
})();
