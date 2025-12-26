/**
 * Firebase Configuration
 * This file should ONLY be imported in the renderer process
 * DO NOT import in main process - Firebase Analytics requires browser environment
 */

// Check if we're in renderer process
if (typeof window === 'undefined') {
  throw new Error('firebase-config.js should only be imported in renderer process');
}

import * as firebaseAppModule from 'firebase/app';
import * as firebaseAnalytics from 'firebase/analytics';

const { initializeApp } = firebaseAppModule;
const { getAnalytics, setUserId, setUserProperties, logEvent, isSupported } = firebaseAnalytics;

const firebaseConfig = {
  apiKey: "AIzaSyBi41Bd-5rwZaVbzuXwCDBu9pB-TcIatYo",
  authDomain: "allow2-1179.firebaseapp.com",
  databaseURL: "https://allow2-1179.firebaseio.com",
  projectId: "allow2-1179",
  storageBucket: "allow2-1179.firebasestorage.app",
  messagingSenderId: "689480143843",
  appId: "1:689480143843:web:5121e3cf2d3c66ff1a86d6",
  measurementId: "G-QN8ZM81FHJ"
};

// Initialize Firebase (only in renderer)
const firebaseApp = initializeApp(firebaseConfig);
let analytics = null;

// Initialize analytics only if supported
isSupported().then(supported => {
  if (supported) {
    analytics = getAnalytics(firebaseApp);
    console.log('[Firebase] Analytics initialized successfully');
  } else {
    console.warn('[Firebase] Analytics not supported in this environment');
  }
}).catch(err => {
  console.error('[Firebase] Analytics initialization error:', err);
});

export { analytics, firebaseApp, setUserId, setUserProperties, logEvent };
