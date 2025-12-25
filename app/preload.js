const { ipcRenderer } = require('electron');
const path = require('path');

// Expose ipcRenderer to renderer process
window.ipcRenderer = ipcRenderer;

// Expose path to renderer process
window.getPath = (name) => {
    return ipcRenderer.sendSync('getPath', name);
};

//
// Configure shared module paths for plugins in renderer process
// This ensures plugins loaded in the renderer can access host dependencies
//
const Module = require('module');

// Get paths to shared dependencies
try {
    const reactPath = path.dirname(require.resolve('react'));
    const reactDomPath = path.dirname(require.resolve('react-dom'));
    const muiCorePath = path.dirname(require.resolve('@material-ui/core'));
    const muiIconsPath = path.dirname(require.resolve('@material-ui/icons'));
    const reduxPath = path.dirname(require.resolve('redux'));
    const reactReduxPath = path.dirname(require.resolve('react-redux'));

    // Add shared module paths to Node's resolution paths
    const sharedModulePaths = [
        path.join(reactPath, '..'),        // node_modules/react
        path.join(reactDomPath, '..'),     // node_modules/react-dom
        path.join(muiCorePath, '..', '..'), // node_modules/@material-ui (parent of 'core')
        path.join(reduxPath, '..'),        // node_modules/redux
        path.join(reactReduxPath, '..')    // node_modules/react-redux
    ];

    // Inject shared paths into module resolution
    sharedModulePaths.forEach(modulePath => {
        if (!Module.globalPaths.includes(modulePath)) {
            Module.globalPaths.push(modulePath);
        }
    });

    console.log('[Preload] Configured shared module paths for plugins:', sharedModulePaths);
} catch (error) {
    console.error('[Preload] Error configuring shared module paths:', error);
}

// Setup electron-redux bridge for state synchronization
const IPCEvents = {
    INIT_STATE: '@@ELECTRON_REDUX/INIT_STATE',
    INIT_STATE_ASYNC: '@@ELECTRON_REDUX/INIT_STATE_ASYNC',
    ACTION: '@@ELECTRON_REDUX/ACTION'
};

// Create the bridge object that electron-redux expects
const bridge = {
  getInitialState: () => {
    return new Promise((resolve) => {
      ipcRenderer.invoke(IPCEvents.INIT_STATE_ASYNC)
        .then((state) => resolve(JSON.parse(state)))
        .catch(() => {
          // Fallback to sync if async fails
          const syncState = ipcRenderer.sendSync(IPCEvents.INIT_STATE);
          resolve(JSON.parse(syncState));
        });
    });
  },
  subscribeToMainStore: (callback) => {
    ipcRenderer.on(IPCEvents.ACTION, (event, action) => {
      callback(action);
    });
  },
  forwardToMain: (action) => {
    ipcRenderer.send(IPCEvents.ACTION, action);
  }
};

// The stateSyncEnhancer function that electron-redux/renderer expects
bridge.stateSyncEnhancer = () => {
  return (createStore) => {
    return (reducer, preloadedState) => {
      // Create store normally
      const store = createStore(reducer, preloadedState);

      // Subscribe to actions from main process
      bridge.subscribeToMainStore((action) => {
        store.dispatch(action);
      });

      // Wrap dispatch to forward actions to main
      const originalDispatch = store.dispatch;
      store.dispatch = (action) => {
        const result = originalDispatch(action);
        bridge.forwardToMain(action);
        return result;
      };

      return store;
    };
  };
};

window.__ElectronReduxBridge = bridge;
