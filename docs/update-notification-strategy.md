# Update Notification Strategy for Allow2 Automate

This document outlines strategies for rapidly pushing updates to users across all distribution platforms (Windows Store, Mac App Store, and Snap Store).

## Executive Summary

| Platform | Auto-Update Default | Can Force Update | Max User Delay | Detection API |
|----------|---------------------|------------------|----------------|---------------|
| **Windows Store** | ON | ✅ Yes (mandatory flag) | ~24h after detection | `Windows.Services.Store` |
| **Mac App Store** | User setting | ❌ No | Indefinite | iTunes Lookup API |
| **Snap Store** | ON (4x/day) | ❌ No | 60 days (hard limit) | `snapctl refresh --pending` |

**Key Insight:** No platform allows publishers to truly force immediate updates. The solution is a multi-layer approach combining store mechanisms, in-app version gating, and proactive notifications.

---

## Platform-Specific Mechanisms

### Windows Store (Microsoft Store)

#### Automatic Updates
- Updates download and install automatically by default
- Users cannot permanently disable automatic updates
- May be delayed on metered connections or power-saving mode

#### Mandatory Updates
Publishers can mark updates as mandatory in Partner Center:
1. Check **"Make this update mandatory"** when submitting
2. Use `StorePackageUpdate.Mandatory` property to detect in-app
3. Display blocking UI until update is installed

```javascript
// Using NodeRT to access Windows.Services.Store
const { StoreContext } = require('@aspect/windows.services.store');

async function checkForMandatoryUpdate() {
  const context = StoreContext.getDefault();
  const updates = await context.getAppAndOptionalStorePackageUpdatesAsync();

  for (const update of updates) {
    if (update.mandatory) {
      // Show blocking update dialog
      await context.requestDownloadAndInstallStorePackageUpdatesAsync(updates);
    }
  }
}
```

#### Staged Rollouts
- **Gradual rollout**: Distribute to percentage of users (10%, 50%, 100%)
- **Package flights**: Beta channels for designated user groups

#### Limitations
- ~24 hour latency between certification and API detection
- Users can delay updates by staying offline

---

### Mac App Store

#### Automatic Updates
User-controlled via System Settings:
- System Settings > General > Software Update > Automatic Updates
- Will not auto-update if Mac is not connected to AC power

#### No Forced Updates
**Apple explicitly does not allow forced updates.** Workarounds:

1. **Version Gating (Recommended)**
```javascript
async function checkMinimumVersion() {
  const config = await fetch('https://api.allow2.com/app-config');
  const { minimumVersion } = await config.json();

  if (semver.lt(app.getVersion(), minimumVersion)) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Update Required',
      message: 'A critical update is required to continue.',
      buttons: ['Update Now', 'Quit']
    }).then(result => {
      if (result.response === 0) {
        shell.openExternal(`macappstore://apps.apple.com/app/id${APP_ID}`);
      }
      app.quit();
    });
  }
}
```

2. **Feature Gating**: Disable specific features for outdated versions
3. **API Deprecation**: Return errors for old app versions

#### Phased Releases
Available in App Store Connect:
| Day | Percentage |
|-----|------------|
| 1 | 1% |
| 2 | 2% |
| 3 | 5% |
| 4 | 10% |
| 5 | 20% |
| 6 | 50% |
| 7 | 100% |

- Can pause rollout for up to 30 days
- Can release to all users immediately at any time
- Users can always manually update (bypasses phased rollout)

#### iTunes Lookup API for Version Detection
```javascript
async function checkAppStoreVersion() {
  const response = await fetch(
    `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}`
  );
  const data = await response.json();

  if (data.results?.length > 0) {
    return {
      version: data.results[0].version,
      releaseNotes: data.results[0].releaseNotes,
      storeUrl: data.results[0].trackViewUrl
    };
  }
}
```

#### Expedited Review
For security vulnerabilities, request expedited review at:
https://developer.apple.com/contact/app-store/?topic=expedite

Typically responds within 24-48 hours, review completes in 4-8 hours.

---

### Snap Store (Linux)

#### Automatic Updates
- **Default**: Checks for updates 4 times per day (~every 6 hours)
- Updates download and apply automatically
- If app is running, update applies when app closes (up to 14 days)

#### Refresh Schedule
```bash
# View current schedule
snap refresh --time

# Set specific time windows
sudo snap set system refresh.timer=4:00-7:00,19:00-22:10
```

#### User Holds (Publisher Cannot Override)
```bash
# User can hold updates
snap refresh --hold=24h firefox    # Hold for 24 hours
snap refresh --hold firefox        # Hold indefinitely (max 60 days)
```

**Hard limits (cannot be changed):**
- Maximum hold duration: **60 days**
- Running app deferral: **14 days**, then forced

#### Progressive Rollouts
```bash
# Release to 30% of users
snapcraft release my-app 356 stable --progressive 30

# Increase to 100%
snapcraft release my-app 356 stable --progressive 100

# For urgent security fixes - skip progressive
snapcraft release my-app 456 stable
```

#### In-Snap Update Detection
```bash
# Check for pending refresh (in hooks or scripts)
snapctl refresh --pending
# Returns: "none", "ready", or "inhibited"

# Signal refresh can proceed
snapctl refresh --proceed
```

#### Channels
| Channel | Purpose |
|---------|---------|
| `stable` | Production releases |
| `candidate` | Pre-release testing |
| `beta` | Feature preview |
| `edge` | Bleeding-edge/daily |

---

## In-App Update Strategy

### Urgency Levels

| Level | Behavior | UI Treatment |
|-------|----------|--------------|
| **Critical** | Block app, no dismiss | Red banner, modal, force quit |
| **High** | Persistent reminder | Orange banner, 24h reminder |
| **Normal** | Single notification | Blue banner, auto-dismiss |
| **Low** | Changelog only | No notification |

### Backend API Design
```javascript
// GET /api/app-versions/automate
{
  "latestVersion": "2.1.0",
  "minimumVersion": "1.8.0",      // Force update below this
  "urgency": "high",              // optional | normal | high | critical
  "urgencyMessage": "Security fix for authentication bypass",
  "releaseNotes": "- Fixed security vulnerability\n- Performance improvements",
  "storeUrls": {
    "darwin": "macappstore://apps.apple.com/app/id...",
    "win32": "ms-windows-store://pdp/?productid=...",
    "linux": "snap://allow2automate"
  }
}
```

### Cross-Platform Store URLs
```javascript
const STORE_URLS = {
  darwin: 'macappstore://apps.apple.com/app/id{APP_ID}',
  win32: 'ms-windows-store://pdp/?productid={PRODUCT_ID}',
  linux: 'snap://allow2automate'
};

function openStore() {
  const url = STORE_URLS[process.platform];
  if (url) shell.openExternal(url);
}
```

---

## Push Notification Options

### Firebase Cloud Messaging (Desktop)
```javascript
// Recommended: firebase-electron or @cuj1559/electron-push-receiver
const { setup } = require('firebase-electron');

mainWindow.webContents.on('did-finish-load', () => {
  setup(mainWindow.webContents);
});
```

### Apple Push Notifications (macOS)
```javascript
const { pushNotifications } = require('electron');

// Register for APNs
const token = await pushNotifications.registerForAPNSNotifications();

// Handle incoming notifications
pushNotifications.on('received-apns-notification', (event, userInfo) => {
  // Show update notification
});
```

### Server-Sent Events (All Platforms)
```javascript
// Client-side
const eventSource = new EventSource('https://api.allow2.com/updates/stream');

eventSource.addEventListener('update', (event) => {
  const updateInfo = JSON.parse(event.data);
  showUpdateNotification(updateInfo);
});
```

---

## Timeline Expectations

### Best Case (Auto-Update Enabled, App Not Running)
| Platform | Time to Update |
|----------|----------------|
| Windows | 0-24 hours |
| macOS | 0-24 hours |
| Linux (Snap) | 0-6 hours |

### Worst Case (User Actively Delaying)
| Platform | Maximum Delay |
|----------|---------------|
| Windows | ~24h after detection |
| macOS | Indefinite (no force) |
| Linux (Snap) | 60 days (hard limit) |

---

## Implementation Checklist

### Phase 1: In-App Version Checking (Immediate)
- [ ] Create `AppUpdateService` with version checking
- [ ] Implement urgency levels (critical/high/normal/low)
- [ ] Add force-update screen for minimum version enforcement
- [ ] Add update banner component
- [ ] Store platform-specific deep links

### Phase 2: Native Notifications (Short-term)
- [ ] Electron `Notification` API integration
- [ ] System tray update indicator
- [ ] Windows Store API via NodeRT
- [ ] macOS iTunes Lookup API integration
- [ ] Linux `snapctl` integration

### Phase 3: Push Notifications (Medium-term)
- [ ] Firebase Cloud Messaging setup
- [ ] APNs for macOS (requires provisioning)
- [ ] SSE backend for real-time notifications
- [ ] Token management and storage

### Phase 4: Communication (Long-term)
- [ ] Email notification system (SendGrid/Mailgun)
- [ ] In-app changelog/news feed
- [ ] Social media announcement automation

---

## Security Update Checklist

When releasing a critical security update:

1. **All Platforms**
   - [ ] Set `minimumVersion` in backend API
   - [ ] Prepare in-app blocking UI

2. **Windows Store**
   - [ ] Check "Make this update mandatory" in Partner Center
   - [ ] Skip staged rollout (release to 100%)

3. **Mac App Store**
   - [ ] Request expedited review
   - [ ] Skip phased release OR release to all immediately
   - [ ] Prepare email notification to users

4. **Snap Store**
   - [ ] Release directly to stable (skip progressive)
   - [ ] Post announcement on social media
   - [ ] Update in-app notification

5. **Communication**
   - [ ] Send email to all users (bypass unsubscribe for security)
   - [ ] Post on social media
   - [ ] Update website/blog

---

## References

- [Electron Auto-Updater](https://www.electronjs.org/docs/latest/tutorial/updates)
- [Windows Store API](https://learn.microsoft.com/en-us/windows/uwp/monetize/get-app-and-add-on-info)
- [Mac App Store Phased Releases](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/)
- [Snapcraft Managing Updates](https://snapcraft.io/docs/managing-updates)
- [iTunes Lookup API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/LookupExamples.html)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
