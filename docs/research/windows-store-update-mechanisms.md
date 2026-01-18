# Windows Store / Microsoft Store Update Mechanisms for Electron Apps

## Research Summary

This document covers update mechanisms available for Electron applications distributed through the Microsoft Store, with focus on mechanisms that help push urgent security or feature updates to users quickly.

---

## 1. Automatic Updates

### How Windows Store Handles Automatic Updates

The Microsoft Store automatically handles app updates for published applications. Key behaviors:

- **Enabled by Default**: Microsoft no longer allows users to permanently disable automatic app updates. Updates download and install automatically when available.
- **Background Downloads**: Updates are downloaded in the background without user intervention.
- **Non-Disruptive**: Users never lose personal data or settings during an app update.

### Update Conditions

Updates may be delayed when:
- Device is on a **metered connection**
- Device is in **power-saving mode**
- Enterprise **Group Policy** controls are in place

### Windows Update Integration (2024-2025)

Microsoft has introduced a new **Windows Update orchestration platform** for third-party apps:

- Apps can register as update providers
- Updates can be scheduled and delivered through Windows Update
- New "App updates" section in Windows Settings (Windows 11 builds 26100.7309+)
- This is **separate from WinGet** and the traditional Store mechanism

**Source**: [Windows Update will include Microsoft Store app updates](https://4sysops.com/archives/windows-update-will-include-microsoft-store-app-updates/)

---

## 2. Mandatory Updates

### Overview

For critical fixes that cannot wait, developers can mark updates as **mandatory** in Partner Center.

### Configuring Mandatory Updates

1. **In Partner Center**: When submitting an update, check the **"Make this update mandatory"** checkbox on the Packages page
2. **In App Code**: Implement logic to detect and handle mandatory updates using the `StorePackageUpdate.Mandatory` property

### Important Requirements

- App must target **Windows 10 version 1607** or later
- Must use `Windows.Services.Store` APIs in your app
- The mandatory flag has a **latency of up to 1 day** after certification

### Handling Mandatory Updates in Code

```csharp
private async Task HandleMandatoryUpdates()
{
    StoreContext context = StoreContext.GetDefault();
    IReadOnlyList<StorePackageUpdate> updates =
        await context.GetAppAndOptionalStorePackageUpdatesAsync();

    bool hasMandatory = false;
    foreach (StorePackageUpdate update in updates)
    {
        if (update.Mandatory)
        {
            hasMandatory = true;
            break;
        }
    }

    if (hasMandatory)
    {
        // Show dialog - user cannot decline mandatory updates
        // Options:
        // 1. Degrade functionality until update
        // 2. Terminate the app completely
        // 3. Force the update
    }
}
```

### Developer Enforcement Options

When a user declines a mandatory update, the app can:
- **Degrade functionality** (e.g., disable online features)
- **Terminate completely** (e.g., for online-only applications)
- **Display blocking UI** until update is installed

**Source**: [Update Store-published apps from your code](https://learn.microsoft.com/en-us/windows/msix/store-developer-package-update)

---

## 3. Update Notifications

### Default Store Behavior

- The Microsoft Store shows update availability in the Store app
- Toast notifications may appear for available updates
- Users can view pending updates in `Microsoft Store > Library > Updates`

### Custom In-App Notifications

Developers can implement custom update notifications by:

1. Checking for updates programmatically
2. Displaying custom UI when updates are found
3. Allowing users to initiate the update from within the app

### Best Practice

Create a **non-intrusive but persistent** update notification:
- Show a banner or notification on app startup
- Allow dismissal for non-mandatory updates
- Provide clear update notes/benefits

---

## 4. Staged Rollouts

### Gradual Package Rollout

Microsoft Store supports **gradual/staged rollouts** for updates:

- Distribute packages to a **random percentage** of users
- Control the rollout percentage (e.g., 10%, 25%, 50%, 100%)
- Monitor feedback before expanding rollout

### Configuration

During submission in Partner Center:
1. Check **"Roll out update gradually after this submission is published"**
2. Select the initial rollout percentage
3. Applies to Windows 10/Windows 11 customers only

### Combining with Package Flights

You can combine staged rollouts with package flights:
- **Package Flights**: Specific packages to **specific users** you designate
- **Gradual Rollout**: Packages to a **random percentage** of all users
- Can use gradual rollout within a flight group

**Source**: [Gradual package rollout](https://learn.microsoft.com/en-us/windows/apps/publish/gradual-package-rollout)

---

## 5. Update Priority/Urgency

### Current Limitations

The Microsoft Store does **not have explicit priority levels** (e.g., critical, high, low) for updates. However, you can indicate urgency through:

1. **Mandatory Flag**: Forces users to update (strongest urgency signal)
2. **Custom In-App Messaging**: Show urgency in your update dialog
3. **Release Notes**: Highlight security fixes in Store listing

### Recommended Approach for Urgent Updates

```
Security Update -> Mark as Mandatory + Custom blocking UI
Critical Bug Fix -> Mark as Mandatory + Graceful degradation
Feature Update -> Optional with promotional messaging
```

---

## 6. In-App Update APIs

### Windows.Services.Store Namespace

The primary API for managing updates programmatically.

### Key Classes and Methods

| Class/Method | Purpose |
|--------------|---------|
| `StoreContext` | Main entry point for Store operations |
| `GetAppAndOptionalStorePackageUpdatesAsync()` | Check for available updates |
| `RequestDownloadStorePackageUpdatesAsync()` | Download updates only |
| `RequestDownloadAndInstallStorePackageUpdatesAsync()` | Download and install updates |
| `CanSilentlyDownloadStorePackageUpdates` | Check if silent download is possible |
| `TrySilentDownloadStorePackageUpdatesAsync()` | Download without UI |
| `TrySilentDownloadAndInstallStorePackageUpdatesAsync()` | Download and install without UI |

### Complete C# Example

```csharp
using Windows.Services.Store;
using System.Collections.Generic;
using System.Threading.Tasks;

public class StoreUpdateManager
{
    private StoreContext _context;

    public StoreUpdateManager()
    {
        _context = StoreContext.GetDefault();
    }

    /// <summary>
    /// Check for available updates
    /// </summary>
    public async Task<IReadOnlyList<StorePackageUpdate>> CheckForUpdatesAsync()
    {
        return await _context.GetAppAndOptionalStorePackageUpdatesAsync();
    }

    /// <summary>
    /// Check if any updates are mandatory
    /// </summary>
    public async Task<bool> HasMandatoryUpdatesAsync()
    {
        var updates = await CheckForUpdatesAsync();
        foreach (var update in updates)
        {
            if (update.Mandatory)
                return true;
        }
        return false;
    }

    /// <summary>
    /// Download updates silently (if allowed)
    /// </summary>
    public async Task<bool> TryDownloadSilentlyAsync()
    {
        if (!_context.CanSilentlyDownloadStorePackageUpdates)
            return false;

        var updates = await CheckForUpdatesAsync();
        if (updates.Count == 0)
            return false;

        var result = await _context.TrySilentDownloadStorePackageUpdatesAsync(updates);
        return result.OverallState == StorePackageUpdateState.Completed;
    }

    /// <summary>
    /// Download and install with user UI
    /// </summary>
    public async Task<StorePackageUpdateResult> DownloadAndInstallAsync()
    {
        var updates = await CheckForUpdatesAsync();
        if (updates.Count == 0)
            return null;

        // This shows system UI for download/install
        return await _context.RequestDownloadAndInstallStorePackageUpdatesAsync(updates);
    }

    /// <summary>
    /// Download with progress tracking
    /// </summary>
    public async Task DownloadWithProgressAsync(IProgress<double> progress)
    {
        var updates = await CheckForUpdatesAsync();
        if (updates.Count == 0)
            return;

        var operation = _context.RequestDownloadStorePackageUpdatesAsync(updates);

        operation.Progress = (asyncInfo, progressInfo) =>
        {
            double totalProgress = 0;
            foreach (var pkg in progressInfo.PackageDownloadProgress)
            {
                totalProgress += pkg.PackageDownloadProgress;
            }
            progress.Report(totalProgress / progressInfo.PackageDownloadProgress.Count);
        };

        await operation;
    }
}
```

### Electron/Node.js Integration via NodeRT

To use these APIs from Electron, you need **NodeRT** to bridge WinRT APIs to Node.js.

#### Installation

```bash
# Install NodeRT for Windows 11 SDK
npm install @aspect-enterprise/nodert-win11-22h2-windows.services.store

# Or generate your own bindings
npm install nodert
```

#### JavaScript/TypeScript Example

```typescript
// main.ts (Electron main process)
import { app } from 'electron';

// Only works when packaged as MSIX/AppX for Store
async function checkForStoreUpdates(): Promise<void> {
    if (process.platform !== 'win32') return;

    try {
        // Import NodeRT-generated module
        const { StoreContext } = require('@aspect-enterprise/nodert-win11-22h2-windows.services.store');

        const context = StoreContext.getDefault();
        const updates = await context.getAppAndOptionalStorePackageUpdatesAsync();

        if (updates.length > 0) {
            console.log(`${updates.length} updates available`);

            // Check for mandatory updates
            let hasMandatory = false;
            for (const update of updates) {
                if (update.mandatory) {
                    hasMandatory = true;
                    break;
                }
            }

            if (hasMandatory) {
                // Show blocking update dialog
                showMandatoryUpdateDialog();
            } else {
                // Show optional update notification
                showUpdateNotification(updates.length);
            }
        }
    } catch (error) {
        console.error('Store update check failed:', error);
        // App may not be packaged for Store, or API unavailable
    }
}

// Call on app ready
app.whenReady().then(() => {
    checkForStoreUpdates();

    // Check periodically (e.g., every 4 hours)
    setInterval(checkForStoreUpdates, 4 * 60 * 60 * 1000);
});
```

### Silent Download Conditions

Silent downloads are **NOT available** when:
- User has disabled "Update apps automatically" in Store settings
- Device is on a metered network
- Policy restrictions are in place

**Source**: [StoreContext Class](https://learn.microsoft.com/en-us/uwp/api/windows.services.store.storecontext)

---

## 7. Package Flights / Beta Channels

### Overview

Package flights allow distributing **different packages** to specific user groups while maintaining the same Store listing.

### Setting Up Package Flights

1. **Create Known User Groups** in Partner Center
   - Add users by Microsoft Account email
   - Groups can have up to 10,000 members

2. **Create Package Flight**
   - Navigate to App overview > Package flights
   - Click "New package flight"
   - Assign a name and link to user group(s)

3. **Upload Flight Packages**
   - Upload packages specific to the flight
   - These can have different version numbers/features

### Flight Ranking

If a user belongs to multiple flights:
- **Higher-ranked flights** take priority
- Drag and drop to reorder flights in Partner Center
- Users get packages from their highest-ranked eligible flight

### Certification for Flights

- Flights go through the **same certification process**
- Some WACK (Windows App Certification Kit) checks are **relaxed** for flights
- Helps with testing and preparation before public release

### Beta Channel Strategy

**Recommended approach for rapid iteration:**

```
1. Internal Testing Flight (employees only)
   - Immediate distribution
   - Quick iteration cycles

2. Beta Flight (engaged users, 100-1000 users)
   - Early feedback on stability
   - 1-2 week soak time

3. Preview Flight (10,000 users)
   - Broader compatibility testing
   - 1 week minimum before production

4. Production (all users)
   - Gradual rollout starting at 10%
   - Increase to 100% over 1-2 weeks
```

**Source**: [Package flights](https://learn.microsoft.com/en-us/windows/apps/publish/package-flights)

---

## 8. Best Practices for Rapid Update Adoption

### Technical Best Practices

1. **Check for Updates at Startup**
   ```typescript
   app.whenReady().then(async () => {
       await checkForStoreUpdates();
       // Continue with app initialization
   });
   ```

2. **Implement Background Update Downloads**
   - Download updates while app is running
   - Prompt for install when download completes
   - Apply updates on next restart

3. **Use Silent Downloads When Possible**
   ```csharp
   if (context.CanSilentlyDownloadStorePackageUpdates)
   {
       await context.TrySilentDownloadStorePackageUpdatesAsync(updates);
   }
   ```

4. **Handle Update Failures Gracefully**
   - Retry with exponential backoff
   - Fall back to opening Store page
   - Log failures for diagnostics

### UX Best Practices

1. **Clear Communication**
   - Explain what the update contains
   - Highlight security improvements
   - Show estimated download size/time

2. **Non-Blocking for Optional Updates**
   - Allow users to dismiss non-mandatory update prompts
   - Remember dismissal for session or time period
   - Show unobtrusive reminder after dismissal

3. **Blocking UI for Mandatory Updates**
   - Full-screen overlay
   - Progress indicator
   - Clear explanation of why update is required

4. **Respect User Time**
   - Offer "Update on Quit" option
   - Schedule updates during idle time
   - Minimize restart requirements

### Organizational Best Practices

1. **Use Package Flights for Testing**
   - Internal flight -> Beta flight -> Production
   - Catch issues before wide release

2. **Staged Rollouts for Production**
   - Start at 10-25%
   - Monitor crash reports and feedback
   - Expand or halt based on metrics

3. **Quick Response for Critical Issues**
   - Have expedited certification path ready
   - Pre-approved update templates
   - Clear escalation procedures

4. **Microsoft Store CLI for Automation**
   ```bash
   # Install Microsoft Store CLI
   npm install -g @electron/msstore-cli

   # Submit update programmatically
   msstore publish --app-id <your-app-id>
   ```

### Metrics to Monitor

| Metric | Target | Action if Below |
|--------|--------|-----------------|
| Update adoption (24h) | >25% | Check for Store delays |
| Update adoption (7d) | >75% | Improve update UX |
| Update failures | <5% | Debug common errors |
| Mandatory update compliance | 100% | Strengthen enforcement UI |

---

## 9. API Latency Considerations

### Update Detection Latency

- **Up to 24 hours** after certification before `GetAppAndOptionalStorePackageUpdatesAsync()` returns the new update
- This is a known Microsoft Store limitation
- For urgent updates, communicate through other channels (email, in-app messaging with version check against your server)

### Workaround for Urgent Updates

```typescript
interface UpdateInfo {
    version: string;
    mandatory: boolean;
    releaseNotes: string;
    storeUrl: string;
}

async function checkCustomUpdateEndpoint(): Promise<UpdateInfo | null> {
    try {
        const response = await fetch('https://your-api.com/app/latest-version');
        const latest = await response.json();

        const currentVersion = app.getVersion();
        if (semver.gt(latest.version, currentVersion)) {
            return latest;
        }
    } catch (error) {
        console.error('Version check failed:', error);
    }
    return null;
}

// Combine with Store API
async function checkForUpdates(): Promise<void> {
    // Fast path: check your own endpoint first
    const customUpdate = await checkCustomUpdateEndpoint();
    if (customUpdate?.mandatory) {
        showMandatoryUpdateDialog(customUpdate);
        return;
    }

    // Slow path: check Store API
    await checkForStoreUpdates();
}
```

---

## 10. Enterprise Considerations

### Group Policy Support

Organizations can control Store updates via Group Policy:
- Enable/disable automatic updates
- Restrict Store access entirely
- Configure update schedules

### Alternative: App Installer API

For enterprise-deployed MSIX packages (not through Store):

```csharp
using Windows.Management.Deployment;

var manager = new PackageManager();
var updates = await manager.FindPackageUpdatesAsync(currentPackage);
```

### LOB App Updates

For Line of Business apps:
- Use the new Windows Update orchestration platform
- Register as an update provider
- Leverage Windows Update for scheduling

---

## Summary: Fastest Path to User Update Adoption

| Urgency | Strategy |
|---------|----------|
| **Critical Security** | Mark mandatory + Custom blocking UI + Immediate rollout (100%) |
| **High Priority Bug** | Mark mandatory + In-app prompt + 10% -> 100% over 24h |
| **Feature Update** | Optional + In-app notification + 10% -> 50% -> 100% over 7 days |
| **Minor Fix** | Optional + Silent download + 25% -> 100% over 3 days |

### Key Actions

1. Implement `Windows.Services.Store` APIs via NodeRT
2. Add custom version check endpoint for immediate detection
3. Design compelling update UX
4. Use package flights for testing
5. Use staged rollouts for production
6. Monitor adoption metrics
7. Have expedited process for critical updates

---

## References

- [Update Store-published apps from your code - Microsoft Learn](https://learn.microsoft.com/en-us/windows/msix/store-developer-package-update)
- [StoreContext Class - Microsoft Learn](https://learn.microsoft.com/en-us/uwp/api/windows.services.store.storecontext)
- [Package flights - Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/publish/package-flights)
- [Gradual package rollout - Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/publish/gradual-package-rollout)
- [Windows Store Guide - Electron](https://www.electronjs.org/docs/latest/tutorial/windows-store-guide)
- [NodeRT - GitHub](https://github.com/NodeRT/NodeRT)
- [Microsoft Store CLI - GitHub](https://github.com/microsoft/msstore-cli)
- [Electron Auto Update](https://www.electronjs.org/docs/latest/tutorial/updates)
