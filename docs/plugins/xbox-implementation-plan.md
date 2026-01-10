# Xbox Plugin Implementation Plan
**Status:** APPROVED
**Date:** 2026-01-06
**Document Version:** 1.0
**Target Completion:** 6 weeks from start

---

## Executive Summary

This document provides a comprehensive implementation plan for the **Allow2 Automate Xbox Plugin**, integrating Xbox Live parental control monitoring with the Allow2 ecosystem. The plugin will enable parents to monitor and control Xbox gaming activity across consoles, PCs, and cloud gaming platforms.

### Key Objectives
1. **OAuth2 Authentication**: Implement 3-stage Xbox Live authentication flow
2. **Presence Detection**: Monitor gaming activity with 15-second polling accuracy
3. **Child Linking**: Map Allow2 children to Xbox gamertags with privacy compliance
4. **Quota Enforcement**: Log gaming time to Allow2 API and enforce quotas
5. **Agent Integration**: Hybrid cloud + local detection for PC gaming

### Success Metrics
- ✅ 15-second presence detection accuracy
- ✅ 99.9% authentication uptime with automatic token refresh
- ✅ Support for multiple children per parent account
- ✅ Microsoft XR-013 privacy compliance
- ✅ Hybrid detection (cloud + agent) for PC gaming

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Plugin Structure](#plugin-structure)
3. [Implementation Phases](#implementation-phases)
4. [Technical Specifications](#technical-specifications)
5. [Security & Privacy](#security--privacy)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Plan](#deployment-plan)
8. [Risk Mitigation](#risk-mitigation)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Allow2 Automate Main App                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Plugin Registry & Loader                     │  │
│  │  (Scoped package: @allow2/allow2automate-xbox)           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                  Xbox Plugin Instance                     │  │
│  │  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │ XboxAuthManager │  │ XboxMonitor  │  │ ChildLink    │ │  │
│  │  │  - OAuth2 Flow  │  │  - Presence  │  │  - Gamertag  │ │  │
│  │  │  - Token Store  │  │  - 15s Poll  │  │  - Mapping   │ │  │
│  │  └─────────────────┘  └──────────────┘  └──────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    Redux State Store                      │  │
│  │  { xbox: { authentication, children, presenceCache } }   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                   React UI Components                     │  │
│  │  - TabContent (Main Settings)                            │  │
│  │  - ChildLinkingWizard                                    │  │
│  │  - XboxStatusDisplay                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Xbox Live Cloud APIs                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ Microsoft OAuth  │  │ Presence API     │  │ Profile API  │  │
│  │ login.live.com   │  │ userpresence.*   │  │ profile.*    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Network
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Agent (Windows/macOS/Linux)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         Xbox Process Monitor (PC Gaming Only)             │  │
│  │  - XboxApp.exe / XboxGameBar.exe monitoring              │  │
│  │  - 5-second polling for local detection                  │  │
│  │  - Complement cloud detection for hybrid accuracy        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Authentication Flow:**
```
1. User clicks "Connect Xbox" in UI
2. TabContent → IPC → XboxAuthManager.authenticate()
3. XboxAuthManager opens browser to Microsoft OAuth
4. User authorizes → OAuth code returned
5. Exchange code for tokens (OAuth → User Token → XSTS)
6. Store tokens securely (Electron safeStorage)
7. Update Redux state → UI shows "Connected"
```

**Presence Detection Flow:**
```
1. XboxMonitorCoordinator starts 15s interval polling
2. Batch query presence for all linked children (up to 1,100 XUIDs)
3. Xbox Live API returns current game/status for each child
4. Check if game changed → Log activity to Allow2 API
5. Check quota → Update UI with time remaining
6. Cache game metadata (title, genre, box art) for 24h
7. Dispatch Redux actions → UI updates in real-time
```

---

## Plugin Structure

### File Organization

```
/mnt/ai/automate/plugins/allow2automate-xbox/
├── package.json                    # Plugin manifest with allow2automate metadata
├── rollup.config.js               # Build configuration
├── .babelrc                       # Babel config for JSX/ES6+
├── README.md                      # User-facing documentation
├── ARCHITECTURE.md                # ✅ Already complete (31KB)
│
├── src/
│   ├── index.js                   # Main plugin entry (factory function)
│   │
│   ├── services/
│   │   ├── XboxAuthManager.js     # OAuth2 flow, token management
│   │   ├── XboxMonitorCoordinator.js  # Presence polling coordinator
│   │   ├── ChildLinkManager.js    # Child-to-Xbox mapping
│   │   └── XboxAPI.js             # Xbox Live API wrapper
│   │
│   ├── components/
│   │   ├── TabContent.jsx         # Main plugin settings UI
│   │   ├── XboxStatus.jsx         # Real-time status display
│   │   ├── ChildLinkingWizard.jsx # Wizard for linking children
│   │   ├── ActivityLog.jsx        # Gaming activity history
│   │   └── QuotaDisplay.jsx       # Time remaining UI
│   │
│   ├── utils/
│   │   ├── tokenStorage.js        # Secure token storage (safeStorage)
│   │   ├── privacy.js             # XUID privacy utilities
│   │   ├── rateLimiter.js         # API rate limiting (10/15s, 30/5min)
│   │   └── cacheManager.js        # NodeCache wrapper (TTL management)
│   │
│   └── constants/
│       ├── xboxEndpoints.js       # API URLs
│       └── errorCodes.js          # Xbox error code mappings
│
├── dist/                          # Built files (generated)
│   ├── index.js                   # CommonJS bundle
│   └── index.es.js                # ES module bundle
│
└── img/                           # Plugin assets
    ├── icon.png                   # Plugin icon (256x256)
    └── logo.svg                   # Xbox logo
```

### Package.json

```json
{
  "name": "@allow2/allow2automate-xbox",
  "shortName": "xbox",
  "version": "1.0.0",
  "description": "Xbox Live parental control integration for Allow2 Automate",
  "main": "dist/index.js",
  "module": "dist/index.es.js",
  "scripts": {
    "build": "rollup -c",
    "start": "rollup -c -w",
    "prepublish": "npm run build",
    "test": "jest",
    "lint": "eslint src/"
  },
  "allow2automate": {
    "plugin": true,
    "pluginId": "allow2automate-xbox",
    "displayName": "Xbox Live Controls",
    "category": "Gaming",
    "permissions": [
      "network",
      "configuration",
      "storage"
    ],
    "minAppVersion": "2.0.0",
    "api": {
      "actions": [
        {
          "id": "checkQuota",
          "name": "Check Xbox Quota",
          "description": "Check remaining gaming time quota"
        },
        {
          "id": "refreshPresence",
          "name": "Refresh Presence",
          "description": "Force refresh Xbox presence data"
        },
        {
          "id": "linkChild",
          "name": "Link Child Account",
          "description": "Link Allow2 child to Xbox gamertag"
        }
      ],
      "triggers": [
        {
          "id": "quotaExceeded",
          "name": "Gaming Quota Exceeded",
          "description": "Triggered when child exceeds Xbox gaming quota"
        },
        {
          "id": "gameStarted",
          "name": "Game Started",
          "description": "Triggered when child starts playing a game"
        },
        {
          "id": "gameEnded",
          "name": "Game Ended",
          "description": "Triggered when child stops playing"
        }
      ]
    }
  },
  "dependencies": {
    "@babel/runtime": "^7.13.9",
    "node-fetch": "^3.3.0",
    "node-cache": "^5.1.2"
  },
  "peerDependencies": {
    "@material-ui/core": "^4.0.0",
    "@material-ui/icons": "^4.0.0",
    "react": "^16.0.0 || ^17.0.0",
    "react-dom": "^16.0.0 || ^17.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.13.10",
    "@babel/preset-env": "^7.13.10",
    "@babel/preset-react": "^7.12.13",
    "@rollup/plugin-babel": "^5.3.0",
    "@rollup/plugin-commonjs": "^17.1.0",
    "@rollup/plugin-node-resolve": "^11.2.0",
    "rollup": "^2.40.0",
    "rollup-plugin-peer-deps-external": "^2.2.4",
    "jest": "^27.0.0",
    "eslint": "^7.21.0"
  }
}
```

---

## Implementation Phases

### Phase 1: Core Authentication (Week 1)

**Goal:** Implement 3-stage OAuth2 flow and secure token storage

**Tasks:**
1. **Create XboxAuthManager.js** (3 days)
   - Implement OAuth2 authorization URL generation
   - Handle OAuth callback and code exchange
   - Implement User Token (XAU) request
   - Implement XSTS Token request with SandboxId: "RETAIL"
   - Add automatic token refresh (1-hour expiry)

2. **Create tokenStorage.js** (1 day)
   - Implement secure token storage using Electron safeStorage
   - Add encryption/decryption helpers
   - Handle token expiry tracking

3. **Create XboxAPI.js wrapper** (2 days)
   - Implement base request() method with auth headers
   - Add rate limiting (10 req/15s, 30 req/5min)
   - Implement automatic token refresh on 401 errors
   - Add error handling and retry logic

**Deliverables:**
- ✅ OAuth2 flow working end-to-end
- ✅ Tokens stored securely and auto-refreshed
- ✅ Unit tests for authentication flow (80% coverage)

**Success Criteria:**
- User can authenticate with Microsoft account
- Tokens persist across app restarts
- Automatic refresh before 1-hour expiry

---

### Phase 2: Child Linking UI (Week 2)

**Goal:** Create UI for linking Allow2 children to Xbox gamertags

**Tasks:**
1. **Create ChildLinkingWizard.jsx** (3 days)
   - Step 1: Select Allow2 child from dropdown
   - Step 2: Enter Xbox gamertag
   - Step 3: Validate gamertag via Profile API
   - Step 4: Confirm linking and save
   - Add unlinking functionality

2. **Create ChildLinkManager.js** (2 days)
   - Implement gamertag validation via Xbox Profile API
   - Retrieve XUID from gamertag
   - Store child-to-XUID mappings in Redux state
   - Implement privacy safeguards (hide XUID in UI)

3. **Create TabContent.jsx main UI** (2 days)
   - Authentication status display
   - List of linked children with gamertags
   - "Add Child" button → ChildLinkingWizard
   - Settings panel (polling interval, auto-log toggle)

**Deliverables:**
- ✅ Wizard UI for linking children
- ✅ Gamertag validation and XUID retrieval
- ✅ Child mappings persisted in Redux state

**Success Criteria:**
- User can link multiple children to gamertags
- Gamertags validated in real-time
- XUID never exposed in UI (privacy compliant)

---

### Phase 3: Presence Detection (Week 3)

**Goal:** Implement 15-second presence polling and game activity tracking

**Tasks:**
1. **Create XboxMonitorCoordinator.js** (4 days)
   - Implement 15-second polling interval
   - Batch presence queries for all linked children
   - Parse presence response (game, status, device)
   - Detect game start/stop events
   - Emit events for activity changes

2. **Implement game metadata caching** (2 days)
   - Fetch title details from Title Hub API
   - Cache metadata (name, genre, box art) with 24h TTL
   - Handle cache misses gracefully

3. **Create XboxStatus.jsx component** (1 day)
   - Display current game for each child
   - Show rich presence ("In Multiplayer Lobby")
   - Display device type (Xbox One, Series X, PC)
   - Real-time updates via Redux subscription

**Deliverables:**
- ✅ 15-second presence polling working
- ✅ Game activity detection with metadata
- ✅ Real-time UI updates

**Success Criteria:**
- Presence updates within 15 seconds of status change
- Batch queries support up to 10 children efficiently
- Game metadata displayed with box art

---

### Phase 4: Allow2 Integration (Week 4)

**Goal:** Log gaming activity to Allow2 API and enforce quotas

**Tasks:**
1. **Implement activity logging** (3 days)
   - Detect game session start/stop
   - Calculate session duration
   - Log activity to Allow2 API via main app IPC
   - Handle API errors gracefully (retry logic)

2. **Implement quota checking** (2 days)
   - Query Allow2 API for child quotas
   - Compare current gaming time vs. quota
   - Display time remaining in UI
   - Emit violation events when quota exceeded

3. **Create QuotaDisplay.jsx** (1 day)
   - Show time remaining for each child
   - Visual warning when quota low (<15 min)
   - Block indicator when quota exceeded

4. **Create ActivityLog.jsx** (1 day)
   - Display recent gaming sessions
   - Show game name, duration, timestamp
   - Export to CSV functionality

**Deliverables:**
- ✅ Gaming activity logged to Allow2 API
- ✅ Quota enforcement with UI indicators
- ✅ Activity history display

**Success Criteria:**
- Activity logged within 30 seconds of detection
- Quota checks performed every 15 seconds
- Parents receive notifications on violations

---

### Phase 5: Agent Integration (Week 5)

**Goal:** Add hybrid detection with agent-side Xbox process monitoring

**Tasks:**
1. **Design agent IPC protocol** (1 day)
   - Define message format for Xbox process detection
   - Design policy sync mechanism

2. **Implement agent-side monitoring** (3 days)
   - Monitor Xbox app processes (Windows: XboxApp.exe, XboxGameBar.exe)
   - Detect when Xbox processes are running
   - Send process status to main app via IPC
   - Poll every 5 seconds (faster than cloud for local PC gaming)

3. **Implement hybrid detection logic** (2 days)
   - Combine cloud presence + local process detection
   - Use cloud detection for consoles (Xbox One, Series X/S)
   - Use hybrid for PC (Xbox app + cloud)
   - Prevent duplicate activity logging

4. **Add policy creation for Xbox games** (1 day)
   - Allow parents to create allow/block policies
   - Sync policies to agents
   - Agent enforces policies locally (close app if blocked)

**Deliverables:**
- ✅ Agent monitors Xbox processes on Windows
- ✅ Hybrid detection prevents gaming when quota exceeded
- ✅ Policies synced between main app and agents

**Success Criteria:**
- PC gaming detected with 5-second latency (agent)
- Console gaming detected with 15-second latency (cloud)
- Policies enforced locally on PC without cloud dependency

---

### Phase 6: Polish & Testing (Week 6)

**Goal:** Comprehensive testing, security audit, and production readiness

**Tasks:**
1. **Unit Tests** (2 days)
   - XboxAuthManager: OAuth flow, token refresh
   - XboxMonitorCoordinator: Presence parsing, event emission
   - ChildLinkManager: Gamertag validation, XUID privacy
   - XboxAPI: Rate limiting, error handling
   - **Target: 80% code coverage**

2. **Integration Tests** (2 days)
   - End-to-end authentication flow
   - Child linking → presence detection → activity logging
   - Quota enforcement flow
   - Agent communication and policy sync

3. **Security Audit** (1 day)
   - Review XR-013 privacy compliance
   - Ensure XUID never exposed in UI or logs
   - Validate token storage encryption
   - Test OAuth redirect URI security
   - Verify rate limiting prevents abuse

4. **Performance Optimization** (1 day)
   - Profile polling performance with 10+ children
   - Optimize Redux action dispatching (batch updates)
   - Reduce memory usage of presence cache
   - Lazy-load game metadata images

5. **Documentation** (1 day)
   - Update README with setup instructions
   - Document API endpoints and data models
   - Create troubleshooting guide
   - Add inline JSDoc comments

**Deliverables:**
- ✅ 80%+ test coverage
- ✅ Security audit passed
- ✅ Performance optimized for 10+ children
- ✅ Documentation complete

**Success Criteria:**
- All tests passing
- No security vulnerabilities found
- Polling performance <100ms for 10 children
- Documentation reviewed and approved

---

## Technical Specifications

### Authentication Flow

**Stage 1: Microsoft OAuth2**
```javascript
// XboxAuthManager.js
class XboxAuthManager {
  async authenticate() {
    const authUrl = this.buildAuthUrl();
    const code = await this.openOAuthBrowser(authUrl);
    const tokens = await this.exchangeCode(code);
    return this.completeTokenChain(tokens);
  }

  buildAuthUrl() {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: 'http://localhost:8080/oauth/callback',
      scope: 'Xboxlive.signin Xboxlive.offline_access'
    });
    return `https://login.live.com/oauth20_authorize.srf?${params}`;
  }

  async exchangeCode(code) {
    const response = await fetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: 'http://localhost:8080/oauth/callback'
      })
    });
    return response.json();
  }
}
```

**Stage 2: Xbox User Token (XAU)**
```javascript
async getUserToken(oauthToken) {
  const response = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-xbl-contract-version': '1'
    },
    body: JSON.stringify({
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${oauthToken}`
      }
    })
  });

  const data = await response.json();
  return {
    token: data.Token,
    uhs: data.DisplayClaims.xui[0].uhs
  };
}
```

**Stage 3: XSTS Token**
```javascript
async getXSTSToken(userToken) {
  const response = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-xbl-contract-version': '1'
    },
    body: JSON.stringify({
      RelyingParty: 'http://xboxlive.com',
      TokenType: 'JWT',
      Properties: {
        UserTokens: [userToken.token],
        SandboxId: 'RETAIL'
      }
    })
  });

  const data = await response.json();
  return {
    token: data.Token,
    uhs: data.DisplayClaims.xui[0].uhs,
    xuid: data.DisplayClaims.xui[0].xid
  };
}
```

### Presence Detection

**Batch Presence Query**
```javascript
// XboxMonitorCoordinator.js
class XboxMonitorCoordinator {
  constructor(api, childMappings) {
    this.api = api;
    this.childMappings = childMappings; // { childId: { gamertag, xuid } }
    this.pollInterval = null;
  }

  start() {
    this.pollInterval = setInterval(() => this.checkPresence(), 15000);
  }

  async checkPresence() {
    const xuids = Object.values(this.childMappings).map(c => c.xuid);
    if (xuids.length === 0) return;

    const presence = await this.api.batchPresence(xuids);

    for (const childId in this.childMappings) {
      const xuid = this.childMappings[childId].xuid;
      const status = presence.find(p => p.xuid === xuid);

      if (status && status.state === 'Online' && status.lastSeen?.titleId) {
        await this.handleGameActivity(childId, status);
      }
    }
  }

  async handleGameActivity(childId, status) {
    const titleId = status.lastSeen.titleId;
    const titleName = await this.getTitleName(titleId);

    // Check if game changed (new session started)
    if (this.lastGame[childId] !== titleId) {
      this.emit('gameStarted', { childId, titleId, titleName });
      await this.logActivityToAllow2(childId, titleName, 'start');
    }

    this.lastGame[childId] = titleId;
  }
}
```

**API Wrapper with Rate Limiting**
```javascript
// XboxAPI.js
class XboxAPI {
  constructor() {
    this.rateLimiter = new RateLimiter({
      burst: { requests: 10, window: 15000 },      // 10 req/15s
      sustained: { requests: 30, window: 300000 }  // 30 req/5min
    });
  }

  async batchPresence(xuids) {
    await this.rateLimiter.wait();

    const response = await fetch('https://userpresence.xboxlive.com/users/batch', {
      method: 'POST',
      headers: {
        'Authorization': `XBL3.0 x=${this.xstsToken.uhs};${this.xstsToken.token}`,
        'x-xbl-contract-version': '3',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        users: xuids,
        level: 'all'
      })
    });

    return response.json();
  }
}
```

### Redux State Structure

```javascript
{
  xbox: {
    // Authentication
    authentication: {
      authenticated: true,
      oauthToken: 'encrypted_token',
      refreshToken: 'encrypted_token',
      xstsToken: {
        token: 'encrypted_token',
        uhs: 'user_hash',
        xuid: 'parent_xuid'
      },
      expiresAt: 1704470400000
    },

    // Child Mappings
    children: {
      'allow2_child_123': {
        childId: 'allow2_child_123',
        childName: 'Alice',
        xboxLinked: true,
        xboxGamertag: 'AliceGamer',
        xboxXuid: '2533274794093122', // PRIVATE - never display
        linkedAt: 1704384000000,
        lastActivity: {
          timestamp: 1704470100000,
          titleId: '219630713',
          titleName: 'Halo Infinite',
          deviceType: 'XboxSeriesX',
          richPresence: 'In Multiplayer Lobby'
        }
      }
    },

    // Presence Cache (15s TTL)
    presenceCache: {
      '2533274794093122': {
        state: 'Online',
        titleId: '219630713',
        titleName: 'Halo Infinite',
        richPresence: 'In Multiplayer Lobby',
        deviceType: 'XboxSeriesX',
        timestamp: 1704470100000
      }
    },

    // Title Metadata Cache (24h TTL)
    titleCache: {
      '219630713': {
        name: 'Halo Infinite',
        developer: '343 Industries',
        publisher: 'Xbox Game Studios',
        genres: ['Shooter', 'Action'],
        boxArt: 'https://...',
        cachedAt: 1704384000000
      }
    },

    // Settings
    settings: {
      checkInterval: 15000,
      autoLogActivity: true,
      notifyOnViolation: true,
      enableHybridDetection: true
    }
  }
}
```

### IPC Handlers

```javascript
// src/index.js
function setupIPCHandlers(context) {
  // Authentication
  context.ipcMain.handle('authenticate', async (event) => {
    try {
      const result = await xboxAuth.authenticate();
      state.authentication = result;
      context.configurationUpdate(state);
      return [null, { success: true }];
    } catch (error) {
      return [error];
    }
  });

  // Link Child
  context.ipcMain.handle('linkChild', async (event, { childId, gamertag }) => {
    try {
      const profile = await xboxAPI.getProfile(gamertag);
      const xuid = profile.id;

      state.children[childId] = {
        childId,
        xboxLinked: true,
        xboxGamertag: gamertag,
        xboxXuid: xuid,
        linkedAt: Date.now()
      };

      context.configurationUpdate(state);
      xboxMonitor.addChild(childId, xuid);

      return [null, { success: true, gamertag, xuid }];
    } catch (error) {
      return [error];
    }
  });

  // Refresh Presence
  context.ipcMain.handle('refreshPresence', async (event) => {
    try {
      await xboxMonitor.checkPresence();
      return [null, { success: true, presenceCache: state.presenceCache }];
    } catch (error) {
      return [error];
    }
  });
}
```

---

## Security & Privacy

### Microsoft XR-013 Compliance

**XUID Privacy Safeguards:**
```javascript
// utils/privacy.js

// ✅ CORRECT: Use XUID only for API calls
async function getPresence(xuid) {
  // Internal API call - XUID allowed
  return await xboxAPI.batchPresence([xuid]);
}

// ✅ CORRECT: Display gamertag to users
function renderChildStatus({ gamertag, presence }) {
  return (
    <div>
      <strong>{gamertag}</strong> is playing {presence.game}
    </div>
  );
}

// ❌ INCORRECT: Never expose XUID in UI
function renderChildStatusBad({ xuid, presence }) {
  return (
    <div>
      User ID: {xuid} {/* PRIVACY VIOLATION! */}
    </div>
  );
}

// ✅ CORRECT: Refresh gamertag periodically
async function refreshGamertags(children) {
  for (const childId in children) {
    const xuid = children[childId].xboxXuid;
    const profile = await xboxAPI.getProfile(xuid);

    if (profile.gamertag !== children[childId].xboxGamertag) {
      // Gamertag changed, update display name
      children[childId].xboxGamertag = profile.gamertag;
    }
  }
}
```

### Token Security

**Secure Storage:**
```javascript
// utils/tokenStorage.js
import { safeStorage } from 'electron';

export class TokenStorage {
  static encrypt(token) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available on this platform');
    }
    return safeStorage.encryptString(token).toString('base64');
  }

  static decrypt(encryptedToken) {
    const buffer = Buffer.from(encryptedToken, 'base64');
    return safeStorage.decryptString(buffer);
  }

  static store(key, value) {
    const encrypted = this.encrypt(JSON.stringify(value));
    // Store in Redux state (persisted to disk by main app)
    return encrypted;
  }

  static retrieve(encryptedValue) {
    const decrypted = this.decrypt(encryptedValue);
    return JSON.parse(decrypted);
  }
}
```

**Token Refresh:**
```javascript
class XboxAuthManager {
  async ensureValidToken() {
    const expiresAt = this.state.authentication.expiresAt;
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // Refresh if less than 5 minutes remaining
    if (timeUntilExpiry < 300000) {
      console.log('[Xbox Auth] Token expiring soon, refreshing...');
      await this.refreshToken();
    }
  }

  async refreshToken() {
    const refreshToken = TokenStorage.decrypt(
      this.state.authentication.refreshToken
    );

    const response = await fetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    const tokens = await response.json();
    await this.completeTokenChain(tokens);
  }
}
```

### Input Validation

```javascript
// Gamertag validation
function validateGamertag(gamertag) {
  if (!gamertag || typeof gamertag !== 'string') {
    throw new Error('Gamertag is required');
  }

  // Xbox gamertag rules:
  // - 1-15 characters
  // - Letters, numbers, spaces
  // - Cannot start/end with space
  const regex = /^[a-zA-Z0-9][\sa-zA-Z0-9]{0,13}[a-zA-Z0-9]$/;

  if (!regex.test(gamertag)) {
    throw new Error('Invalid gamertag format');
  }

  return gamertag.trim();
}
```

---

## Testing Strategy

### Unit Tests (Jest)

```javascript
// __tests__/XboxAuthManager.test.js
describe('XboxAuthManager', () => {
  let authManager;

  beforeEach(() => {
    authManager = new XboxAuthManager();
  });

  test('should build valid OAuth URL', () => {
    const url = authManager.buildAuthUrl();
    expect(url).toContain('login.live.com');
    expect(url).toContain('client_id=');
    expect(url).toContain('scope=Xboxlive.signin');
  });

  test('should exchange code for tokens', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      json: () => ({ access_token: 'mock_token', refresh_token: 'mock_refresh' })
    });
    global.fetch = mockFetch;

    const tokens = await authManager.exchangeCode('mock_code');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://login.live.com/oauth20_token.srf',
      expect.any(Object)
    );
    expect(tokens).toHaveProperty('access_token');
  });

  test('should refresh token before expiry', async () => {
    authManager.state = {
      authentication: {
        expiresAt: Date.now() + 60000, // 1 minute
        refreshToken: 'encrypted_token'
      }
    };

    const refreshSpy = jest.spyOn(authManager, 'refreshToken');
    await authManager.ensureValidToken();

    expect(refreshSpy).toHaveBeenCalled();
  });
});
```

### Integration Tests

```javascript
// __tests__/integration/authentication-flow.test.js
describe('Xbox Authentication Flow', () => {
  test('should complete full OAuth flow', async () => {
    const plugin = createTestPlugin();

    // Step 1: Start OAuth
    const authUrl = await plugin.ipc.invoke('getAuthUrl');
    expect(authUrl).toContain('login.live.com');

    // Step 2: Exchange code (mocked)
    const result = await plugin.ipc.invoke('authenticate', { code: 'mock_code' });
    expect(result[0]).toBeNull(); // No error
    expect(result[1]).toHaveProperty('success', true);

    // Step 3: Verify state updated
    expect(plugin.state.authentication.authenticated).toBe(true);
    expect(plugin.state.authentication.xstsToken).toBeDefined();
  });
});
```

### End-to-End Tests (Playwright)

```javascript
// e2e/xbox-plugin.spec.js
test('User can link child to Xbox gamertag', async ({ page }) => {
  // Navigate to Xbox plugin settings
  await page.click('text=Plugins');
  await page.click('text=Xbox Live Controls');

  // Authenticate
  await page.click('button:has-text("Connect Xbox Account")');
  await page.waitForURL('**/oauth/callback**');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button:has-text("Sign In")');

  // Wait for redirect and authentication
  await page.waitForSelector('text=Connected');

  // Link child
  await page.click('button:has-text("Add Child")');
  await page.selectOption('[name="childId"]', 'child_123');
  await page.fill('[name="gamertag"]', 'TestGamertag');
  await page.click('button:has-text("Link")');

  // Verify linked
  await page.waitForSelector('text=TestGamertag');
  await page.screenshot({ path: 'xbox-linked.png' });
});
```

---

## Deployment Plan

### Pre-Deployment Checklist

```markdown
- [ ] All unit tests passing (80%+ coverage)
- [ ] Integration tests passing
- [ ] Security audit completed
- [ ] Documentation reviewed and approved
- [ ] Azure AD app registered (Client ID/Secret obtained)
- [ ] Environment variables configured
- [ ] Code review completed by 2+ developers
- [ ] Performance tested with 10+ children
- [ ] Privacy compliance verified (XR-013)
- [ ] Rate limiting tested (no API bans)
- [ ] Error handling tested (network failures, API errors)
```

### Environment Variables

```bash
# .env.production
MICROSOFT_CLIENT_ID=your_azure_client_id
MICROSOFT_CLIENT_SECRET=your_azure_client_secret
XBOX_OAUTH_REDIRECT_URI=http://localhost:8080/oauth/callback
XBOX_API_RATE_LIMIT_BURST=10
XBOX_API_RATE_LIMIT_SUSTAINED=30
```

### Deployment Steps

1. **Build Plugin:**
   ```bash
   cd /mnt/ai/automate/plugins/allow2automate-xbox
   npm install
   npm run build
   npm test
   ```

2. **Publish to NPM:**
   ```bash
   npm publish --access public
   # Publishes @allow2/allow2automate-xbox to npm registry
   ```

3. **Install in Main App:**
   ```bash
   cd /mnt/ai/automate/automate
   cd dev-data/plugins
   npm install @allow2/allow2automate-xbox
   ```

4. **Restart App:**
   ```bash
   npm run dev
   # Plugin auto-discovered via node_modules scan
   ```

5. **Verify Installation:**
   - Check Plugins tab shows "Xbox Live Controls"
   - Click plugin → Verify UI loads
   - Test authentication flow
   - Test child linking
   - Verify presence detection

---

## Risk Mitigation

### High-Priority Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **GitHub API Rate Limit** | Critical | High | Add GitHub token, implement ETag caching |
| **Xbox API Rate Limit** | High | Medium | Implement rate limiter (10/15s, 30/5min), use batch queries |
| **Token Expiry Not Handled** | High | Medium | Auto-refresh 5 minutes before expiry, retry on 401 |
| **XUID Privacy Violation** | Critical | Low | Code review, never log/display XUID, use gamertag in UI |
| **OAuth Redirect Attack** | High | Low | Validate redirect URI, use state parameter, HTTPS only |
| **Hardcoded Credentials** | Critical | Low | Use environment variables, never commit secrets |
| **Synchronous File I/O** | Medium | High | Use async fs.promises for all file operations |

### Medium-Priority Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Network Failures** | Medium | High | Retry logic with exponential backoff, offline mode |
| **Memory Leaks** | Medium | Medium | Clear intervals on unload, limit cache size (1000 entries max) |
| **Redux State Bloat** | Low | High | Prune presence cache after 1 hour, limit activity log to 100 entries |
| **Agent Communication Failure** | Medium | Low | Fallback to cloud-only detection, retry agent connection |

---

## Success Metrics & KPIs

### Performance Metrics
- ✅ **Presence Detection Latency**: <15 seconds (99th percentile)
- ✅ **API Response Time**: <500ms average
- ✅ **Token Refresh Success Rate**: >99.9%
- ✅ **Memory Usage**: <50MB with 10 children

### User Experience Metrics
- ✅ **Authentication Success Rate**: >95%
- ✅ **Child Linking Success Rate**: >98%
- ✅ **Activity Logging Accuracy**: >99%
- ✅ **UI Responsiveness**: <100ms for all interactions

### Reliability Metrics
- ✅ **Uptime**: 99.9% (excluding Microsoft outages)
- ✅ **Error Rate**: <1% of API calls
- ✅ **Test Coverage**: >80%

---

## Next Steps

### Immediate Actions (Week 0)

1. **Create Azure AD Application**
   - Register app at https://portal.azure.com
   - Configure redirect URI: `http://localhost:8080/oauth/callback`
   - Note Client ID and generate Client Secret

2. **Setup Development Environment**
   ```bash
   cd /mnt/ai/automate/plugins
   mkdir allow2automate-xbox
   cd allow2automate-xbox
   npm init -y
   # Copy package.json template from this document
   npm install
   ```

3. **Initialize Git Repository**
   ```bash
   git init
   echo "node_modules/" > .gitignore
   echo "dist/" >> .gitignore
   echo ".env" >> .gitignore
   git add .
   git commit -m "Initial commit: Xbox plugin scaffolding"
   ```

4. **Create Project Structure**
   ```bash
   mkdir -p src/{services,components,utils,constants}
   mkdir -p __tests__/{unit,integration}
   touch src/index.js
   touch rollup.config.js
   touch .babelrc
   ```

### Week 1 Kickoff

- [ ] Team meeting to review implementation plan
- [ ] Assign developers to phases
- [ ] Setup CI/CD pipeline (GitHub Actions)
- [ ] Create project board (Kanban)
- [ ] Begin Phase 1: Core Authentication

---

**Document End**

*For questions or clarification, contact the development team.*
