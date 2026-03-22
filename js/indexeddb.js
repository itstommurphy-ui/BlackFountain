// ══════════════════════════════════════════
// INDEXEDDB FOR LARGE FILES
// ══════════════════════════════════════════

/**
 * IndexedDB manager for storing large files (videos, images)
 * that exceed localStorage limits (~5MB)
 */

const FileStore = (function() {
  const DB_NAME = 'BlackFountain_Files';
  const DB_VERSION = 1;
  const STORE_NAME = 'files';
  let db = null;

  /**
   * Initialize the IndexedDB
   */
  async function init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[FileStore] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        db = request.result;
        console.log('[FileStore] Database opened successfully');
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        
        // Create files store with keyPath
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('projectId', 'projectId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  /**
   * Get the database instance
   */
  async function getDB() {
    if (!db) {
      await init();
    }
    return db;
  }

  /**
   * Store a file
   */
  async function storeFile(file) {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const fileData = {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        projectId: file.projectId,
        data: file.data, // Base64 or Blob
        createdAt: file.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const request = store.put(fileData);
      
      request.onsuccess = () => resolve(file.id);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a file by ID
   */
  async function getFile(id) {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all files for a project
   */
  async function getFilesByProject(projectId) {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('projectId');
      const request = index.getAll(projectId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all files
   */
  async function getAllFiles() {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a file
   */
  async function deleteFile(id) {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete all files for a project
   */
  async function deleteFilesByProject(projectId) {
    const files = await getFilesByProject(projectId);
    const database = await getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      files.forEach(file => {
        store.delete(file.id);
      });
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get total storage used
   */
  async function getStorageUsed() {
    const files = await getAllFiles();
    return files.reduce((total, file) => total + (file.size || 0), 0);
  }

  /**
   * Check if a file exists
   */
  async function fileExists(id) {
    const file = await getFile(id);
    return !!file;
  }

  /**
   * Migrate files from localStorage to IndexedDB
   * Call this once to migrate existing files
   */
  async function migrateFromLocalStorage() {
    if (!store.files || !store.files.length) return;
    
    console.log('[FileStore] Starting migration from localStorage...');
    let migrated = 0;
    
    for (const file of store.files) {
      // Only migrate files with large data (likely images/videos)
      if (file.data && file.data.length > 50000) { // >50KB
        try {
          await storeFile({
            id: file.id,
            name: file.name,
            type: file.type,
            size: file.size,
            projectId: file.projectId,
            data: file.data
          });
          // Clear data from localStorage to save space
          file.data = null;
          file._storedInIDB = true;
          migrated++;
        } catch (err) {
          console.error('[FileStore] Migration error for file:', file.name, err);
        }
      }
    }
    
    if (migrated > 0) {
      await saveStore();
      console.log(`[FileStore] Migrated ${migrated} files to IndexedDB`);
      showToast(`Migrated ${migrated} large files to IndexedDB`, 'success');
    }
  }

  /**
   * Get file data, falling back to localStorage if needed
   */
  async function getFileData(fileId) {
    // Try IndexedDB first
    try {
      const file = await getFile(fileId);
      if (file && file.data) {
        return file.data;
      }
    } catch (err) {
      console.warn('[FileStore] IndexedDB lookup failed, trying localStorage');
    }
    
    // Fallback to localStorage
    const localFile = store.files?.find(f => f.id === fileId);
    return localFile?.data || null;
  }

  return {
    init,
    storeFile,
    getFile,
    getFilesByProject,
    getAllFiles,
    deleteFile,
    deleteFilesByProject,
    getStorageUsed,
    fileExists,
    migrateFromLocalStorage,
    getFileData
  };
})();

// Export to global scope
window.FileStore = FileStore;
