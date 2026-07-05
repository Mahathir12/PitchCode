// firebase-init.js
// Paste the values Firebase gave you (Project settings → Your apps → Web app → SDK setup).
// databaseURL is required — it's specific to Realtime Database, not shown by default
// on every screen, so double check you copied it from the Realtime Database page itself
// if it's missing from the config snippet Firebase showed you.

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "PASTE_YOUR_PROJECT",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
