/* =========================================================
   QA Foundry — IndexedDB data layer
   All content (docs, code, tasks, bugs, api history) is kept
   locally in the browser's IndexedDB — nothing leaves the
   device unless the user explicitly exports it.
   ========================================================= */
(function () {
  const DB_NAME = "qa-foundry-db";
  const DB_VERSION = 4;
  let dbPromise = null;

  const STORES = {
    folders: "id",
    files: "id",
    codeFiles: "id",
    codeVersions: "id",
    codeFolders: "id",
    todos: "id",
    bugs: "id",
    apiHistory: "id",
    apiCollections: "id",
    testSuites: "id",
    timesheetEntries: "id",
  };

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        Object.keys(STORES).forEach((name) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: STORES[name] });
          }
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function uid() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  const DB = {
    uid,

    async put(store, value) {
      const os = await tx(store, "readwrite");
      return new Promise((resolve, reject) => {
        const r = os.put(value);
        r.onsuccess = () => resolve(value);
        r.onerror = () => reject(r.error);
      });
    },

    async get(store, id) {
      const os = await tx(store, "readonly");
      return new Promise((resolve, reject) => {
        const r = os.get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
    },

    async getAll(store) {
      const os = await tx(store, "readonly");
      return new Promise((resolve, reject) => {
        const r = os.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
    },

    async delete(store, id) {
      const os = await tx(store, "readwrite");
      return new Promise((resolve, reject) => {
        const r = os.delete(id);
        r.onsuccess = () => resolve(true);
        r.onerror = () => reject(r.error);
      });
    },

    async deleteWhere(store, predicate) {
      const all = await DB.getAll(store);
      const toDelete = all.filter(predicate);
      for (const item of toDelete) await DB.delete(store, item.id);
      return toDelete.length;
    },

    async clearAll() {
      const db = await openDB();
      return Promise.all(
        Object.keys(STORES).map(
          (name) =>
            new Promise((resolve, reject) => {
              const r = db.transaction(name, "readwrite").objectStore(name).clear();
              r.onsuccess = () => resolve();
              r.onerror = () => reject(r.error);
            })
        )
      );
    },

    async estimateUsage() {
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const { usage, quota } = await navigator.storage.estimate();
          return { usage, quota };
        } catch (e) {
          return null;
        }
      }
      return null;
    },
  };

  window.QAFDB = DB;
})();
