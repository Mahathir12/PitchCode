/* ==========================================================================
   db.js — Local persistence layer shaped like the Firebase Realtime DB API.

   WHY IT'S SHAPED THIS WAY:
   Every read/write in this app goes through DB.get / DB.set / DB.push /
   DB.update / DB.on / DB.off using slash-paths, exactly like the Firebase
   Realtime Database client SDK. Right now it's backed by localStorage
   (single device). Later, swap the *body* of these functions to call
   `firebase.database()` and every page in the app keeps working unchanged,
   because nothing outside this file knows or cares where the data lives.

   Cross-tab updates on the same device also work today via the native
   `storage` event, which approximates what remote listeners will do later.
   ========================================================================== */

const DB = (() => {
  const STORAGE_KEY = 'pitchcodeDB';
  let listeners = []; // { path, callback }

  function loadRoot() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      console.error('DB load error', e);
      return {};
    }
  }

  function saveRoot(root) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  }

  function splitPath(path) {
    return path.split('/').filter(Boolean);
  }

  function getByPath(root, path) {
    const parts = splitPath(path);
    let node = root;
    for (const p of parts) {
      if (node == null) return undefined;
      node = node[p];
    }
    return node;
  }

  function setByPath(root, path, value) {
    const parts = splitPath(path);
    if (parts.length === 0) return value;
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
      node = node[p];
    }
    if (value === null || value === undefined) {
      delete node[parts[parts.length - 1]];
    } else {
      node[parts[parts.length - 1]] = value;
    }
    return root;
  }

  function notifyListeners(changedPath) {
    for (const l of listeners) {
      // Notify a listener if its path is an ancestor of, equal to, or a
      // descendant of the changed path (simple, generous matching).
      if (changedPath.startsWith(l.path) || l.path.startsWith(changedPath) || l.path === '' ) {
        const root = loadRoot();
        l.callback(getByPath(root, l.path));
      }
    }
  }

  // Cross-tab sync
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) notifyListeners('');
  });

  return {
    get(path) {
      const root = loadRoot();
      return getByPath(root, path);
    },

    set(path, value) {
      const root = loadRoot();
      setByPath(root, path, value);
      saveRoot(root);
      notifyListeners(path);
      return value;
    },

    update(path, obj) {
      const root = loadRoot();
      const current = getByPath(root, path) || {};
      const merged = { ...current, ...obj };
      setByPath(root, path, merged);
      saveRoot(root);
      notifyListeners(path);
      return merged;
    },

    push(path, value) {
      const id = Utils.generateId();
      const root = loadRoot();
      setByPath(root, `${path}/${id}`, value);
      saveRoot(root);
      notifyListeners(path);
      return id;
    },

    remove(path) {
      const root = loadRoot();
      setByPath(root, path, null);
      saveRoot(root);
      notifyListeners(path);
    },

    /** Subscribe to a path. Callback fires immediately with current value,
     *  then again on every future change (Firebase's onValue semantics). */
    on(path, callback) {
      const entry = { path, callback };
      listeners.push(entry);
      callback(this.get(path)); // fire immediately
      return callback; // return handle for off()
    },

    off(path, callback) {
      listeners = listeners.filter(l => !(l.path === path && l.callback === callback));
    },

    /** One-shot read, mirrors Firebase's .once('value') pattern. */
    once(path) {
      return Promise.resolve(this.get(path));
    }
  };
})();
