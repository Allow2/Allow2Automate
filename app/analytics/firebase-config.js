/**
 * Firebase Configuration
 * This file should ONLY be imported in the renderer process
 * DO NOT import in main process - Firebase Analytics requires browser environment
 */

// Check if we're in renderer process
if (typeof window === 'undefined') {
  throw new Error('firebase-config.js should only be imported in renderer process');
}

// CRITICAL FIX: Use Firebase compat libraries for better Babel 6 compatibility
// Firebase 12.x with compat mode works with CommonJS transpilation
let firebase, initializeApp, getAnalytics, setUserId, setUserProperties, logEvent, isSupported;

try {
  // Use Firebase compat version for Babel 6 / CommonJS compatibility
  firebase = require('firebase/compat/app');
  require('firebase/compat/analytics');

  // Compat API provides firebase namespace
  if (firebase) {
    initializeApp = firebase.initializeApp.bind(firebase);
    getAnalytics = (app) => firebase.analytics(app);
    setUserId = (analytics, userId) => analytics.setUserId(userId);
    setUserProperties = (analytics, properties) => analytics.setUserProperties(properties);
    logEvent = (analytics, eventName, eventParams) => analytics.logEvent(eventName, eventParams);
    isSupported = () => Promise.resolve(true); // Compat assumes browser support
  }

  if (!initializeApp || !firebase.analytics) {
    console.error('[Firebase] Failed to load required Firebase compat modules');
  }
} catch (err) {
  console.error('[Firebase] Error loading Firebase compat modules:', err);
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

    // Initialize analytics using compat API (synchronous)
    if (firebase && firebase.analytics) {
      try {
        analytics = firebase.analytics(firebaseApp);
        console.log('[Firebase] Analytics initialized successfully with measurement ID:', firebaseConfig.measurementId);

        // Test analytics is working
        analytics.logEvent('firebase_initialized', {
          timestamp: new Date().toISOString(),
          environment: 'electron_renderer'
        });
        console.log('[Firebase] Test event logged to GA4');
      } catch (analyticsErr) {
        console.error('[Firebase] Analytics initialization error:', analyticsErr);
      }
    } else {
      console.warn('[Firebase] Analytics compat not loaded');
    }
  } catch (err) {
    console.error('[Firebase] Failed to initialize Firebase:', err);
  }
} else {
  console.error('[Firebase] initializeApp function not loaded');
}

export { analytics, firebaseApp, setUserId, setUserProperties, logEvent };
