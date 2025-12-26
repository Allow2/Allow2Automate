/**
 * Firebase Configuration
 * This file should ONLY be imported in the renderer process
 * DO NOT import in main process - Firebase Analytics requires browser environment
 */

// Check if we're in renderer process
if (typeof window === 'undefined') {
  throw new Error('firebase-config.js should only be imported in renderer process');
}

// CRITICAL FIX: Use dynamic import with null guards to prevent destructuring crashes
let initializeApp, getAnalytics, setUserId, setUserProperties, logEvent, isSupported;

try {
  // Use require instead of ES6 import to avoid hoisting issues
  const firebaseAppModule = require('firebase/app');
  const firebaseAnalyticsModule = require('firebase/analytics');

  // Safe destructuring with null guards
  if (firebaseAppModule) {
    initializeApp = firebaseAppModule.initializeApp;
  }

  if (firebaseAnalyticsModule) {
    getAnalytics = firebaseAnalyticsModule.getAnalytics;
    setUserId = firebaseAnalyticsModule.setUserId;
    setUserProperties = firebaseAnalyticsModule.setUserProperties;
    logEvent = firebaseAnalyticsModule.logEvent;
    isSupported = firebaseAnalyticsModule.isSupported;
  }

  if (!initializeApp || !getAnalytics) {
    console.error('[Firebase] Failed to load required Firebase modules');
  }
} catch (err) {
  console.error('[Firebase] Error loading Firebase modules:', err);
}

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

// Initialize Firebase (only in renderer) with null guards
let firebaseApp = null;
let analytics = null;

if (initializeApp) {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    console.log('[Firebase] App initialized successfully');

    // Initialize analytics only if supported
    if (isSupported && getAnalytics) {
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
    } else {
      console.warn('[Firebase] Analytics functions not loaded');
    }
  } catch (err) {
    console.error('[Firebase] Failed to initialize Firebase:', err);
  }
} else {
  console.error('[Firebase] initializeApp function not loaded');
}

export { analytics, firebaseApp, setUserId, setUserProperties, logEvent };
