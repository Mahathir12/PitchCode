/* ==========================================================================
   db.js — Firebase Realtime Database backend, same API as the localStorage
   version it replaces (DB.get/set/update/push/remove/on/off/once).

   HOW IT STAYS "SYNCHRONOUS" LIKE BEFORE:
   A single listener on the database root mirrors the *entire* tree into an
   in-memory `cache` object. DB.get() reads that cache synchronously — no
   page code needs to change to `await` anything. Writes update the cache
   immediately (optimistic) AND fire off the real Firebase write in the
   background, so your own UI feels instant while other devices catch up
   a moment later via the same root listener.

   Two pages (tournament.html, scorer.html) do a one-time synchronous read
   with no ongoing DB.on() refresh, so they need to wait for the first
   snapshot before that read — use `DB.ready().then(() => { ... })` there.
   Everything else (bidder.html, owner.html, viewer.html) already re-renders
   via DB.on() whenever the cache updates, so it self-corrects automatically
   once the first snapshot arrives — no change needed on those pages.
   ========================================================================== */

const DB = (() => {
  let cache = {};
  let listeners = []; // { path, callback }
  let readyResolve;
  const readyPromise = new Promise((res) => { readyResolve = res; });

  const rootRef = firebase.database().ref('/');

  function splitPath(path) { return path.split('/').filter(Boolean); }

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
    if (value === null || value === undefined) delete node[parts[parts.length - 1]];
    else node[parts[parts.length - 1]] = value;
    return root;
  }

  function notifyListeners(changedPath) {
    for (const l of listeners) {
      if (changedPath === '' || changedPath.startsWith(l.path) || l.path.startsWith(changedPath)) {
        l.callback(getByPath(cache, l.path));
      }
    }
  }

  rootRef.on('value', (snapshot) => {
    cache = snapshot.val() || {};
    readyResolve();
    notifyListeners('');
  }, (err) => console.error('Firebase root listener error (check your rules/config):', err));

  return {
    /** Resolves once the first real snapshot has arrived from Firebase. */
    ready() { return readyPromise; },

    get(path) {
      return getByPath(cache, path);
    },

    set(path, value) {
      setByPath(cache, path, value);
      notifyListeners(path);
      firebase.database().ref(path).set(value).catch((e) => console.error('DB.set failed:', e));
      return value;
    },

    update(path, obj) {
      const current = getByPath(cache, path) || {};
      const merged = { ...current, ...obj };
      setByPath(cache, path, merged);
      notifyListeners(path);
      firebase.database().ref(path).update(obj).catch((e) => console.error('DB.update failed:', e));
      return merged;
    },

    push(path, value) {
      const id = Utils.generateId();
      setByPath(cache, `${path}/${id}`, value);
      notifyListeners(path);
      firebase.database().ref(`${path}/${id}`).set(value).catch((e) => console.error('DB.push failed:', e));
      return id;
    },

    remove(path) {
      setByPath(cache, path, null);
      notifyListeners(path);
      firebase.database().ref(path).remove().catch((e) => console.error('DB.remove failed:', e));
    },

    on(path, callback) {
      listeners.push({ path, callback });
      callback(getByPath(cache, path));
      return callback;
    },

    off(path, callback) {
      listeners = listeners.filter((l) => !(l.path === path && l.callback === callback));
    },

    once(path) { return Promise.resolve(this.get(path)); }
  };
})();
