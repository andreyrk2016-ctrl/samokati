/* ============ PRO SCOOTER SHOP — аккаунты и «Мои товары» ============
   Два режима:
   - Firebase (если задан window.FIREBASE_CONFIG): настоящие аккаунты,
     вход через Google и email, избранное синхронизируется между устройствами.
   - Локальный (без настройки): аккаунт и избранное живут в этом браузере.
   Как включить Firebase — см. файл FIREBASE-НАСТРОЙКА.md в репозитории. */

(function () {
  "use strict";

  var listeners = [];
  var state = { mode: "local", user: null, favs: [] };

  function notify() {
    listeners.forEach(function (cb) { try { cb(state.user); } catch (e) {} });
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* ---------- Локальный режим ---------- */

  function favsKey() {
    return state.user ? "psshop-favs-" + state.user.email : "psshop-favs-guest";
  }

  function localLoadFavs() {
    state.favs = readJson(favsKey(), []);
  }

  var LocalAuth = {
    init: function () {
      var saved = readJson("psshop-session", null);
      if (saved && saved.email) state.user = saved;
      localLoadFavs();
      notify();
      return Promise.resolve();
    },
    register: function (email, password, name) {
      var users = readJson("psshop-users", {});
      if (users[email]) return Promise.reject(new Error("exists"));
      users[email] = { p: btoa(unescape(encodeURIComponent(password))), name: name || "" };
      writeJson("psshop-users", users);
      return LocalAuth.login(email, password);
    },
    login: function (email, password) {
      var users = readJson("psshop-users", {});
      var record = users[email];
      if (!record || record.p !== btoa(unescape(encodeURIComponent(password)))) {
        return Promise.reject(new Error("badcreds"));
      }
      var guestFavs = readJson("psshop-favs-guest", []);
      state.user = { email: email, name: record.name || "" };
      writeJson("psshop-session", state.user);
      localLoadFavs();
      guestFavs.forEach(function (id) {
        if (state.favs.indexOf(id) === -1) state.favs.push(id);
      });
      writeJson(favsKey(), state.favs);
      notify();
      return Promise.resolve();
    },
    loginGoogle: function () {
      return Promise.reject(new Error("needs-firebase"));
    },
    logout: function () {
      state.user = null;
      try { localStorage.removeItem("psshop-session"); } catch (e) {}
      localLoadFavs();
      notify();
      return Promise.resolve();
    },
    saveFavs: function () {
      writeJson(favsKey(), state.favs);
    }
  };

  /* ---------- Режим Firebase ---------- */

  var fb = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = reject;
      document.head.appendChild(el);
    });
  }

  var FirebaseAuth = {
    init: function () {
      var base = "https://www.gstatic.com/firebasejs/10.12.2/";
      return loadScript(base + "firebase-app-compat.js")
        .then(function () { return loadScript(base + "firebase-auth-compat.js"); })
        .then(function () { return loadScript(base + "firebase-firestore-compat.js"); })
        .then(function () {
          firebase.initializeApp(window.FIREBASE_CONFIG);
          fb = { auth: firebase.auth(), db: firebase.firestore() };
          state.mode = "firebase";
          return new Promise(function (resolve) {
            fb.auth.onAuthStateChanged(function (u) {
              state.user = u ? { email: u.email, name: u.displayName || "", uid: u.uid } : null;
              FirebaseAuth.loadFavs().then(function () { notify(); resolve(); });
            });
          });
        })
        .catch(function () {
          // Firebase не загрузился (нет сети/CSP) — работаем локально.
          state.mode = "local";
          return LocalAuth.init();
        });
    },
    register: function (email, password, name) {
      return fb.auth.createUserWithEmailAndPassword(email, password).then(function (cred) {
        // Письмо для подтверждения, что почта настоящая
        cred.user.sendEmailVerification().catch(function () {});
        if (name) return cred.user.updateProfile({ displayName: name });
      });
    },
    login: function (email, password) {
      return fb.auth.signInWithEmailAndPassword(email, password);
    },
    loginGoogle: function () {
      return fb.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    },
    logout: function () {
      return fb.auth.signOut();
    },
    loadFavs: function () {
      if (!state.user) { localLoadFavs(); return Promise.resolve(); }
      return fb.db.collection("favorites").doc(state.user.uid).get().then(function (doc) {
        state.favs = (doc.exists && doc.data().items) || [];
      }).catch(function () { state.favs = []; });
    },
    saveFavs: function () {
      if (!state.user) { LocalAuth.saveFavs(); return; }
      fb.db.collection("favorites").doc(state.user.uid).set({ items: state.favs }).catch(function () {});
    }
  };

  /* ---------- Общий интерфейс ---------- */

  var backend = window.FIREBASE_CONFIG ? FirebaseAuth : LocalAuth;
  if (!window.FIREBASE_CONFIG) state.mode = "local";

  window.AUTH = {
    ready: backend.init(),
    get mode() { return state.mode; },
    get user() { return state.user; },
    onChange: function (cb) { listeners.push(cb); },
    register: function (e, p, n) { return backend.register(e, p, n); },
    login: function (e, p) { return backend.login(e, p); },
    loginGoogle: function () { return backend.loginGoogle(); },
    logout: function () { return backend.logout(); },
    favs: function () { return state.favs.slice(); },
    isFav: function (key) { return state.favs.indexOf(key) !== -1; },
    toggleFav: function (key) {
      var i = state.favs.indexOf(key);
      if (i === -1) state.favs.push(key); else state.favs.splice(i, 1);
      backend.saveFavs();
      return i === -1;
    }
  };
})();
