# Epic Games Store & Steam Integration Investigation
**Date**: 2025-12-29
**Purpose**: Complete investigation of methods to connect Epic Games Store and Steam for controlling/monitoring child usage in Allow2Automate

---

## Executive Summary

### Key Findings

| Platform | Official API | Parental Controls API | Recommended Approach | Feasibility |
|----------|--------------|----------------------|---------------------|-------------|
| **Epic Games** | ✅ Epic Online Services (EOS) | ❌ No public API | Process monitoring + Web scraping | **Medium** |
| **Steam** | ⚠️ Limited Web API | ❌ No public API | Local file monitoring + Process control | **Medium-High** |

### Quick Recommendations

1. **Steam**: Higher feasibility - Use local VDF file monitoring + process control (similar to existing approaches)
2. **Epic Games**: Lower feasibility - Requires browser automation for parental controls (similar to Battle.net approach)

---

## 1. Epic Games Store Analysis

### 1.1 Official APIs Available

#### Epic Online Services (EOS) API
- **Purpose**: Game developer SDK for multiplayer, matchmaking, friends, achievements
- **Authentication**: OAuth 2.0 with multiple login types
  - `EOS_LCT_Developer` - Development mode
  - `EOS_LCT_AccountPortal` - Long-lived refresh tokens
- **Documentation**: https://dev.epicgames.com/docs/web-api-ref/authentication
- **Limitation**: ❌ **No parental controls functionality exposed**

#### What EOS Provides:
```javascript
// Available EOS APIs
- Auth Interface (user login/logout)
- Connect Web APIs (cross-platform accounts)
- Ecom Web APIs (in-game purchases)
- Friends, Presence, Stats, Achievements
```

#### What EOS DOES NOT Provide:
```javascript
// NOT available in EOS
❌ Parental controls management
❌ Play time restrictions
❌ Content filtering
❌ Account activity monitoring
❌ Family management
```

### 1.2 Epic Games Parental Controls Features

#### Available Features (Web Portal Only):
1. **PIN-Based Content Restriction**
   - Control acquisition of mature game content by rating
   - Requires 6-digit PIN to modify settings

2. **Cabined Accounts** (Under-13 Users)
   - Automatically applied for users indicating age < 13
   - Limited features in Fortnite, Rocket League, Fall Guys
   - Tailored experience for younger players

3. **Social Controls** (In-Game)
   - Voice chat enable/disable
   - Text chat restrictions
   - Purchasing permissions

4. **Access Points**:
   - Epic Games Launcher (desktop)
   - Epic Account Portal (web): https://www.epicgames.com/account/parental-controls
   - In-game settings (Fortnite, etc.)

### 1.3 Epic Games - No Public API for Parental Controls

**Web Search Results**: No official API documentation found for programmatic parental control management.

**Available Community Solutions**:

#### Legendary - Epic Games Launcher Alternative
- **GitHub**: https://github.com/derrod/legendary
- **Type**: Open-source CLI alternative to Epic Games Launcher
- **Language**: Python
- **Features**:
  - Download/install games
  - Import/export from official launcher
  - Cross-platform (Linux, macOS, Windows)
- **Limitation**: ❌ No parental controls functionality
- **Use Case**: Could inspect how it authenticates, but won't help with parental controls

### 1.4 Potential Implementation Approaches for Epic Games

#### Option A: Process Monitoring (Recommended)
```javascript
// Monitor Epic Games launcher process
Approach:
1. Detect when Epic Games launcher starts
2. Monitor which games are launched via launcher
3. Track playtime by monitoring game process
4. Kill game process when quota exceeded

Pros:
✅ No API needed
✅ Works offline
✅ Reliable process detection
✅ Can enforce time limits

Cons:
❌ Cannot modify launcher's parental settings
❌ Cannot sync with Epic's parental controls
❌ Child could bypass by closing Allow2Automate
❌ No content filtering (just time limits)
```

**Implementation** (Similar to existing patterns):
```javascript
const { exec } = require('child_process');
const ps = require('ps-node');

class EpicGamesMonitor {
  async detectLauncherRunning() {
    // Windows: EpicGamesLauncher.exe
    // macOS: Epic Games Launcher.app
    // Linux: EpicGamesLauncher
  }

  async getRunningGames() {
    // Monitor child processes of launcher
    // Epic games typically run as separate processes
  }

  async killGame(processName) {
    // Terminate game process when quota exceeded
  }
}
```

#### Option B: Browser Automation (Like Battle.net)
```javascript
// Use Playwright to automate Epic Account Portal
Approach:
1. User provides Epic account credentials
2. Automate login to account.epicgames.com
3. Navigate to parental controls section
4. Scrape current settings
5. Submit form changes via browser automation

Pros:
✅ Can read/modify actual Epic parental settings
✅ Similar to proven Battle.net approach
✅ Could enforce content restrictions

Cons:
❌ Requires user credentials (security risk)
❌ Epic may implement CAPTCHA/2FA
❌ Fragile (breaks if Epic changes UI)
❌ Browser automation detectable
❌ No official support - violates TOS
```

**Implementation** (Based on Battle.net pattern):
```javascript
const { chromium } = require('playwright');

class EpicParentalControlsClient {
  async authenticate(email, password) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to Epic login
    await page.goto('https://www.epicgames.com/id/login');

    // Fill credentials
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Handle potential 2FA
    // ...
  }

  async getParentalSettings() {
    // Navigate to parental controls
    await page.goto('https://www.epicgames.com/account/parental-controls');

    // Scrape settings
    const settings = await page.evaluate(() => {
      // Extract PIN status, content ratings, etc.
    });

    return settings;
  }

  async updateContentRating(maxRating) {
    // Submit form to change content rating
    // Requires PIN if set
  }
}
```

#### Option C: Hybrid Approach (BEST)
```javascript
Approach:
1. Process monitoring for playtime tracking
2. Allow2Automate enforces time limits locally
3. Optional: Sync time limits to Epic account (manual or automated)

Implementation:
- Primary: Process monitoring (reliable, safe)
- Secondary: User manually configures Epic parental controls to match Allow2 settings
- Future: Browser automation as optional advanced feature (with warnings)
```

### 1.5 Epic Games - Technical Challenges

1. **No API Access**
   - Epic provides EOS SDK for game developers, not parental control management
   - Web portal is the only way to configure parental controls
   - No documented endpoints for parental settings

2. **Authentication Complexity**
   - EOS Auth requires OAuth client credentials (for game developers)
   - User account authentication separate from developer auth
   - 2FA/CAPTCHA protection on web portal

3. **Limited Parental Controls**
   - Epic's parental controls are less mature than Steam's
   - Focus on content ratings and social features
   - No built-in playtime limits or scheduling

4. **Launcher Architecture**
   - Games launch as separate processes
   - Difficult to detect which game is running without process monitoring
   - No central API to query running games

---

## 2. Steam Analysis

### 2.1 Official Steam APIs

#### Steam Web API (Public)
- **Documentation**: https://developer.valvesoftware.com/wiki/Steam_Web_API
- **Authentication**: API key required (from steamcommunity.com/dev/apikey)
- **Access Level**: Public data only

**Available Endpoints**:
```javascript
// ISteamUser
- GetPlayerSummaries - Basic player info
- GetFriendList - Friends list

// IPlayerService
- GetOwnedGames - Games owned by player
- GetRecentlyPlayedGames - Recently played games
- IsPlayingSharedGame - Check if game is shared

// Steam Web API LIMITATIONS:
❌ No parental controls management
❌ No playtime restriction endpoints
❌ Cannot modify Family View settings
❌ Cannot enforce time limits
✅ CAN get playtime data (for monitoring)
```

#### ISteamUser Interface (Steamworks SDK)
- **Purpose**: Client-side API for games
- **Access**: Requires Steamworks SDK integration
- **Parental Features**:

```cpp
// ISteamUser::GetDurationControl
// For China anti-indulgence regulations
struct DurationControl_t {
    bool m_bApplicable;              // Does duration control apply?
    int32 m_csecsLast5h;            // Playtime in last 5 hours
    EDurationControlProgress m_progress;  // Warning level
    int32 m_csecsToday;             // Playtime today
    int32 m_csecsRemaining;         // Time remaining
};
```

**Limitation**: This API is for **China regulations only**, not general parental controls.

### 2.2 Steam Families (New System - September 2024)

#### Steam Families Features
- **Launched**: September 11, 2024
- **Replaces**: Steam Family Sharing + Steam Family View
- **Family Size**: Up to 6 members (1 organizer + 5 family members)
- **Roles**: Adult or Child

#### Parental Control Features:
```javascript
Available Controls:
✅ Game access restrictions
✅ Store access limits
✅ Chat/community restrictions
✅ Activity monitoring
✅ Purchase approvals
⚠️ Screen time limits (INCOMPLETE)
❌ Real-time enforcement
```

**Critical Limitation**: "Steam does not offer real time-limit controls; the only reliable way to manage gaming hours is to combine Steam Families with system-level or third-party parental control apps."

### 2.3 Community Solutions for Steam

#### node-steam-user
- **GitHub**: https://github.com/DoctorMcKay/node-steam-user
- **Type**: Node.js library for Steam client protocol
- **Authentication**: Steam account credentials
- **Parental Controls Access**: ✅ YES!

```javascript
const SteamUser = require('steam-user');
const client = new SteamUser();

client.logOn({
    accountName: 'username',
    password: 'password'
});

client.on('loggedOn', () => {
    // Access parental controls settings
    console.log(client.parental);  // Parental settings object
});
```

**What's Available**:
```javascript
client.parental = {
    // Parental controls settings from Steam
    // Exact structure depends on account
}
```

#### steam-parental
- **Type**: Node.js package
- **Purpose**: Disable parental lock
- **Source**: Community package in awesome-steam list
- **Use Case**: Could be studied to understand lock mechanism

### 2.4 Steam Local Files (VDF Files)

#### Steam Configuration Files
```bash
# Windows
C:\Program Files (x86)\Steam\config\
C:\Program Files (x86)\Steam\userdata\{SteamID3}\

# macOS
~/Library/Application Support/Steam/config/
~/Library/Application Support/Steam/userdata/{SteamID3}/

# Linux
~/.steam/steam/config/
~/.steam/steam/userdata/{SteamID3}/
```

#### Key VDF Files:
```javascript
Files:
- localconfig.vdf     // User-specific configuration
- config.vdf          // Global Steam config
- sharedconfig.vdf    // Shared settings

Parental Controls:
- Stored in userdata/{SteamID3}/ somewhere
- Exact file location not well-documented
- VDF format is Valve's custom data format
```

**VDF Format Example**:
```vdf
"UserLocalConfigStore"
{
    "friends"
    {
        "PersonaName" "PlayerName"
    }
    "parental"
    {
        "enabled" "1"
        "pin" "encrypted_hash"
    }
}
```

### 2.5 Potential Implementation Approaches for Steam

#### Option A: Local File Monitoring (Recommended)
```javascript
// Monitor Steam VDF files for changes
Approach:
1. Parse localconfig.vdf on startup
2. Watch for file changes (fs.watch)
3. Read current parental settings
4. Detect when games launch (via VDF + process monitoring)
5. Enforce time limits by killing Steam process or game

Pros:
✅ No network required
✅ Works offline
✅ Fast response time
✅ Can read parental PIN status
✅ Native file access

Cons:
❌ VDF format parsing required
❌ File structure may change
❌ Cannot modify Steam's parental settings directly
❌ Requires finding correct VDF file
```

**Implementation**:
```javascript
const fs = require('fs');
const vdf = require('simple-vdf'); // VDF parser library

class SteamLocalMonitor {
  constructor(steamPath) {
    this.configPath = `${steamPath}/config/localconfig.vdf`;
    this.watcher = null;
  }

  async loadConfig() {
    const content = fs.readFileSync(this.configPath, 'utf8');
    return vdf.parse(content);
  }

  watchConfig(callback) {
    this.watcher = fs.watch(this.configPath, (eventType) => {
      if (eventType === 'change') {
        const config = this.loadConfig();
        callback(config);
      }
    });
  }

  async getCurrentGame() {
    // Parse running_app from VDF
    // or monitor Steam process children
  }

  async enforceTimeLimit(exceeded) {
    if (exceeded) {
      // Kill Steam.exe or game process
      exec('taskkill /F /IM Steam.exe');
    }
  }
}
```

#### Option B: Steam Client Protocol (node-steam-user)
```javascript
// Use unofficial Steam client library
Approach:
1. Authenticate with Steam credentials
2. Access parental settings via client.parental
3. Monitor login events
4. Track game launches via client protocol
5. Can modify parental settings programmatically

Pros:
✅ Full access to Steam features
✅ Can read/modify parental settings
✅ Real-time event monitoring
✅ Proven library (node-steam-user)

Cons:
❌ Requires Steam credentials (security risk)
❌ Unofficial protocol (violates Steam ToS)
❌ Steam may block/ban accounts
❌ Protocol may change without notice
❌ Requires keeping connection open
```

**Implementation**:
```javascript
const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp'); // For 2FA

class SteamParentalClient {
  constructor() {
    this.client = new SteamUser();
  }

  async login(username, password, sharedSecret) {
    const twoFactorCode = SteamTotp.generateAuthCode(sharedSecret);

    this.client.logOn({
      accountName: username,
      password: password,
      twoFactorCode: twoFactorCode
    });

    return new Promise((resolve, reject) => {
      this.client.on('loggedOn', () => {
        console.log('Parental settings:', this.client.parental);
        resolve(this.client.parental);
      });

      this.client.on('error', reject);
    });
  }

  monitorGameLaunch() {
    this.client.on('playingState', (blocked, playingApp) => {
      console.log(`Playing app ID: ${playingApp}`);
      // Track game launch
    });
  }

  async setParentalPin(newPin) {
    // Modify parental settings via protocol
    // (requires deep knowledge of Steam protocol)
  }
}
```

#### Option C: Hybrid Approach (BEST FOR STEAM)
```javascript
Approach:
1. Process monitoring for playtime tracking
2. VDF file reading for parental settings state
3. Kill process when quota exceeded
4. Optional: Integrate with Steam Web API for game library info

Implementation:
- Primary: Process monitoring (Steam.exe, gameoverlayui.exe, game processes)
- Secondary: VDF file monitoring for configuration
- Tertiary: Steam Web API for game metadata (titles, icons, etc.)
- NO credential storage (safer)
```

**Architecture**:
```javascript
class SteamPlugin {
  constructor() {
    this.processMonitor = new ProcessMonitor();
    this.vdfMonitor = new VDFMonitor();
    this.webAPI = new SteamWebAPI(apiKey); // Public API only
  }

  async initialize() {
    // Find Steam installation
    const steamPath = await this.findSteamPath();

    // Start VDF monitoring
    await this.vdfMonitor.watch(steamPath);

    // Start process monitoring
    this.processMonitor.on('game-launched', (appId) => {
      this.handleGameLaunch(appId);
    });
  }

  async handleGameLaunch(appId) {
    // Get game details from Web API
    const gameInfo = await this.webAPI.getGameInfo(appId);

    // Check Allow2 quota
    const quota = await this.checkQuota(childId);

    if (quota.remaining <= 0) {
      // Kill game process
      await this.processMonitor.killGame(appId);
    }
  }

  async enforceTimeLimit(childId) {
    const quota = await this.checkQuota(childId);

    if (quota.remaining <= 0) {
      // Kill Steam entirely
      await this.processMonitor.killSteam();
    }
  }
}
```

### 2.6 Steam - Technical Challenges

1. **No Official Parental Controls API**
   - Steam Web API doesn't expose parental controls
   - Steamworks SDK only has China-specific duration control
   - Steam Families manage settings via Steam client only

2. **Protocol Complexity**
   - Steam client protocol is undocumented
   - Changes frequently
   - Reverse engineering required

3. **Process Architecture**
   - Steam uses multiple processes (Steam.exe, steamwebhelper.exe, gameoverlayui.exe, game .exe)
   - Difficult to determine which process is the "main" game
   - Overlay and web helper complicate detection

4. **VDF File Format**
   - Custom Valve data format
   - Not well-documented
   - Structure changes between Steam updates
   - Parental controls file location unclear

---

## 3. Implementation Comparison

### 3.1 Feasibility Matrix

| Approach | Epic Games | Steam | Complexity | Security Risk | Reliability |
|----------|------------|-------|------------|---------------|-------------|
| **Process Monitoring** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Low | Low | High |
| **Browser Automation** | ⭐⭐⭐ | ⭐ | Medium | Medium | Low |
| **Local File Monitoring** | ⭐ | ⭐⭐⭐⭐ | Medium | Low | Medium |
| **Unofficial Protocol** | ❌ | ⭐⭐⭐ | High | High | Low |
| **Official API** | ❌ | ⭐⭐ | Low | Low | High |

### 3.2 Recommended Implementation Priority

#### Phase 1: Steam Plugin (Higher Priority)
**Approach**: Process Monitoring + Local VDF Reading + Steam Web API

```javascript
Priority: HIGH
Feasibility: ⭐⭐⭐⭐⭐
Effort: Medium (2-3 weeks)

Components:
1. Process monitor for Steam.exe and child processes
2. VDF file parser for reading parental settings
3. Steam Web API integration for game metadata
4. Kill process enforcement

Benefits:
✅ No credentials needed (safer)
✅ Works offline
✅ Reliable process detection
✅ Can integrate with existing Steam parental controls

Limitations:
❌ Cannot modify Steam's parental settings
❌ VDF parsing may break on Steam updates
```

#### Phase 2: Epic Games Plugin (Lower Priority)
**Approach**: Process Monitoring Only (Initially)

```javascript
Priority: MEDIUM
Feasibility: ⭐⭐⭐⭐
Effort: Low (1 week for basic version)

Components:
1. Process monitor for EpicGamesLauncher.exe
2. Child process detection for launched games
3. Kill process enforcement

Benefits:
✅ Simple implementation
✅ No credentials needed
✅ Reliable for time limits

Limitations:
❌ Cannot read/modify Epic parental settings
❌ No integration with Epic's parental controls
❌ Child could bypass by closing Allow2Automate
```

**Phase 2b (Optional)**: Add browser automation for Epic parental controls sync
- Use Playwright to scrape Epic Account Portal
- Similar to Battle.net plugin approach
- Optional advanced feature with security warnings

---

## 4. Technical Specifications

### 4.1 Steam Plugin Architecture

```
SteamPlugin (@allow2/allow2automate-steam)
│
├── src/
│   ├── index.js                    # Plugin factory
│   ├── Components/
│   │   └── TabContent.jsx          # UI configuration
│   ├── services/
│   │   ├── ProcessMonitor.js       # Monitor Steam processes
│   │   ├── VDFParser.js            # Parse Steam VDF files
│   │   ├── SteamWebAPI.js          # Public Web API client
│   │   └── PathDetector.js         # Find Steam installation
│   └── utils/
│       ├── processKiller.js        # Kill Steam/game processes
│       └── quotaChecker.js         # Check Allow2 quotas
│
└── package.json
    peerDependencies:
      - react
      - react-dom
      - @material-ui/core
      - @material-ui/icons
    dependencies:
      - simple-vdf (VDF parser)
      - ps-node (process monitoring)
```

### 4.2 Epic Games Plugin Architecture

```
EpicGamesPlugin (@allow2/allow2automate-epic)
│
├── src/
│   ├── index.js                    # Plugin factory
│   ├── Components/
│   │   └── TabContent.jsx          # UI configuration
│   ├── services/
│   │   ├── ProcessMonitor.js       # Monitor Epic launcher
│   │   ├── GameDetector.js         # Detect running games
│   │   └── EpicWebPortal.js        # (Optional) Browser automation
│   └── utils/
│       ├── processKiller.js        # Kill launcher/game processes
│       └── quotaChecker.js         # Check Allow2 quotas
│
└── package.json
    peerDependencies:
      - react
      - react-dom
      - @material-ui/core
      - @material-ui/icons
      - playwright (optional, for web automation)
    dependencies:
      - ps-node (process monitoring)
```

### 4.3 Common Features

Both plugins should implement:

```javascript
// Plugin lifecycle
plugin.onLoad(loadState)           // Initialize
plugin.newState(newState)          // Handle config updates
plugin.onSetEnabled(enabled)       // Enable/disable monitoring
plugin.onUnload()                  // Cleanup

// Core functionality
detectPlatformRunning()            // Is launcher running?
detectGamesRunning()               // What games are active?
getPlaytime(gameId)                // How long has game been running?
enforceQuota(childId)              // Kill process if quota exceeded
syncParentalSettings()             // (Optional) Read/write parental controls

// IPC Handlers
platform.authenticate()            // (If needed) Authenticate with platform
platform.getChildren()             // Get child accounts
platform.linkChild()               // Link platform child to Allow2 child
platform.getCurrentActivity()      // Get current game/playtime
platform.forceStop()               // Immediately stop gaming
```

---

## 5. Risk Assessment

### 5.1 Legal & Terms of Service

| Risk | Epic Games | Steam | Mitigation |
|------|------------|-------|------------|
| **TOS Violation** | High (if using automation) | Medium (if using client protocol) | Use process monitoring only |
| **Account Ban** | Low (monitoring only) | Low (monitoring only) | Don't store credentials |
| **API Changes** | N/A (no API) | Low (stable Web API) | Graceful degradation |

### 5.2 Security Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Credential Storage** | HIGH | Never store passwords; use process monitoring |
| **Man-in-the-Middle** | MEDIUM | Only use HTTPS for API calls |
| **Local File Access** | LOW | Read-only VDF access; validate paths |
| **Process Injection** | LOW | Use OS-level process APIs only |

### 5.3 Reliability Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Platform UI Changes** | HIGH (browser automation) | Use process monitoring as primary |
| **Process Name Changes** | MEDIUM | Allow configuration of process names |
| **VDF Format Changes** | MEDIUM | Graceful degradation; log parsing errors |
| **Multi-Account Detection** | LOW | Support multiple child profiles |

---

## 6. Development Roadmap

### Steam Plugin (8-12 weeks total)

#### Sprint 1-2: Core Process Monitoring (2 weeks)
- [ ] Steam installation path detection (Windows/Mac/Linux)
- [ ] Process monitoring (Steam.exe, child processes)
- [ ] Game launch detection
- [ ] Playtime tracking
- [ ] Process termination

#### Sprint 3-4: VDF Integration (2 weeks)
- [ ] VDF file parser implementation
- [ ] Locate parental controls VDF file
- [ ] Read parental settings
- [ ] Monitor VDF changes
- [ ] Handle Steam updates gracefully

#### Sprint 5-6: Steam Web API Integration (2 weeks)
- [ ] API key configuration
- [ ] Get owned games
- [ ] Get game metadata (icons, titles)
- [ ] Get playtime statistics
- [ ] Cache game data

#### Sprint 7-8: UI & Polish (2 weeks)
- [ ] Configuration UI (Material-UI)
- [ ] Child account linking
- [ ] Activity dashboard
- [ ] Status indicators
- [ ] Error handling & logging

### Epic Games Plugin (4-6 weeks total)

#### Sprint 1-2: Core Process Monitoring (2 weeks)
- [ ] Epic launcher path detection
- [ ] Process monitoring
- [ ] Game launch detection
- [ ] Playtime tracking
- [ ] Process termination

#### Sprint 3-4: UI & Basic Features (2 weeks)
- [ ] Configuration UI
- [ ] Child account setup (manual)
- [ ] Activity tracking
- [ ] Status display

#### (Optional) Sprint 5-6: Web Automation (2 weeks)
- [ ] Playwright integration
- [ ] Epic Account Portal login
- [ ] Parental settings scraping
- [ ] Settings synchronization
- [ ] 2FA handling

---

## 7. Alternative Approaches Considered

### 7.1 Windows Parental Controls Integration
- **Approach**: Use Windows Family Safety instead of platform-specific
- **Pros**: Single solution for all applications
- **Cons**: Only works on Windows; doesn't integrate with Steam/Epic accounts

### 7.2 Network Traffic Monitoring
- **Approach**: Monitor network packets to/from Steam/Epic servers
- **Pros**: Can detect game launches via network activity
- **Cons**: Requires admin permissions; fragile; privacy concerns

### 7.3 OS-Level Screen Time APIs
- **Approach**: Use macOS Screen Time or Windows Screen Time APIs
- **Pros**: Native OS integration
- **Cons**: Not platform-specific; requires OS-level permissions

### 7.4 Game-Specific Hooks
- **Approach**: Inject into game processes to track playtime
- **Pros**: Very accurate playtime tracking
- **Cons**: Extremely complex; anti-cheat detection; crashes

---

## 8. Conclusion & Recommendations

### 8.1 Final Recommendations

**Recommended Implementation Order**:
1. ✅ **Steam Plugin** (Process Monitoring + VDF + Web API) - **Start immediately**
2. ⏳ **Epic Games Plugin** (Process Monitoring only) - **Start after Steam v1.0**
3. 🔮 **Epic Games Web Automation** (Optional enhancement) - **Future consideration**

### 8.2 Why This Order?

**Steam First**:
- Larger market share (120M+ active users vs Epic's 31M)
- Better technical foundation (Web API, VDF files, community tools)
- Existing parental controls to integrate with
- Less risk of breaking changes

**Epic Second**:
- Simpler initial implementation (process monitoring only)
- Can learn from Steam plugin development
- Lower user demand initially

### 8.3 Success Criteria

**Steam Plugin v1.0**:
- ✅ Detect Steam running
- ✅ Track game playtime
- ✅ Enforce time limits via process termination
- ✅ Read Steam parental settings (VDF)
- ✅ Display game info (Web API)
- ✅ Link Steam accounts to Allow2 children

**Epic Plugin v1.0**:
- ✅ Detect Epic launcher running
- ✅ Track game playtime
- ✅ Enforce time limits via process termination
- ✅ Manual child account setup

### 8.4 Next Steps

1. **Create Steam plugin scaffold**
   - Use Battle.net plugin as template
   - Set up project structure
   - Configure build process

2. **Research VDF file locations**
   - Test on Windows/Mac/Linux
   - Document file paths
   - Identify parental controls storage

3. **Implement process monitoring**
   - Cross-platform process detection
   - Game launch identification
   - Playtime tracking

4. **Build prototype**
   - Basic Steam integration
   - Test with real Steam account
   - Validate process monitoring

---

## 9. References

### Documentation
- Epic Online Services: https://dev.epicgames.com/docs
- Steam Web API: https://developer.valvesoftware.com/wiki/Steam_Web_API
- Steamworks SDK: https://partner.steamgames.com/doc/sdk/api
- Steam Families: https://help.steampowered.com/en/faqs/view/6B1A-66BE-E911-3D98

### Community Tools
- Legendary (Epic): https://github.com/derrod/legendary
- node-steam-user: https://github.com/DoctorMcKay/node-steam-user
- simple-vdf: https://www.npmjs.com/package/simple-vdf
- ps-node: https://www.npmjs.com/package/ps-node

### Battle.net Plugin Reference
- `/mnt/ai/automate/plugins/allow2automate-battle.net/src/`
- Demonstrates Playwright-based browser automation
- Shows plugin lifecycle implementation
- Process monitoring patterns

---

**Investigation Completed**: 2025-12-29
**Status**: Ready for implementation planning
**Next Action**: Create Steam plugin project structure
