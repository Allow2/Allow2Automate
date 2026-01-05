# User Session Tracking - Design Document

**Date**: January 5, 2026
**Status**: Design Complete → Implementation In Progress

---

## Overview

The agent will automatically detect and report the currently logged-in user on the monitored device. This information is enriched into all agent responses, stored as history in the parent app, displayed in the UI, and made available to plugins for intelligent child detection.

---

## Requirements

1. **Agent Side**:
   - Detect currently logged-in OS user (username, user ID, account name)
   - Detect if user session is active (screen unlocked) or inactive
   - Track session start time and last activity time
   - Include user context in ALL agent responses

2. **Parent App Side**:
   - Store user session history for each agent
   - Display current user in agent settings UI
   - Display last user with time since last seen when inactive
   - Make user data available to plugins

3. **Plugin Integration**:
   - Plugins receive enriched responses with:
     - System user info (from OS)
     - Plugin's own detected users (from script/checks)
     - Default child (from agent assignment)
   - Priority: Plugin detection → System user → Default child

---

## Architecture

### Response Enrichment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Plugin/Script Query                       │
│                                                               │
│  1. Plugin runs check (e.g., Steam lock file, processes)    │
│  2. Plugin MAY detect user(s) from game files/logs          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agent Enrichment Layer                    │
│                                                               │
│  3. Agent adds OS-level user detection:                     │
│     - Username (from OS)                                     │
│     - User ID (UID/SID)                                      │
│     - Account name (display name)                            │
│     - Active status (screen locked/unlocked)                 │
│  4. Agent adds default child (if configured)                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Enriched Response                         │
│                                                               │
│  {                                                            │
│    "data": { ...plugin response... },                       │
│    "userContext": {                                          │
│      "systemUser": { username, userId, ... },               │
│      "detectedUsers": [ ...from plugin... ],                │
│      "defaultChild": { childId, name }                      │
│    }                                                          │
│  }                                                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Parent App Processing                     │
│                                                               │
│  5. Store user session in agent_user_sessions table         │
│  6. Update UI to show current/last user                     │
│  7. Pass to plugin for child matching                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### Agent Response Structure

All agent API responses will include a `userContext` field:

```javascript
{
  // Original response data (process list, status, etc.)
  "data": {
    "processes": [...],
    "status": "running"
  },

  // NEW: User context (automatically enriched)
  "userContext": {
    // OS-detected user (from agent platform module)
    "systemUser": {
      "username": "mike",              // OS login username
      "userId": "501",                 // UID (Unix) or SID (Windows)
      "accountName": "Mike Smith",     // Display name / full name
      "isActive": true,                // Is screen unlocked for this user?
      "sessionStartTime": "2026-01-05T01:30:00Z",  // When user logged in
      "lastActivityTime": "2026-01-05T02:15:00Z"   // Last user activity
    },

    // Users detected by plugin/script (if any)
    "detectedUsers": [
      {
        "username": "mike.smith",
        "source": "steam_config",      // Where detected from
        "confidence": "high",          // Detection confidence
        "detectedAt": "2026-01-05T02:15:00Z"
      }
    ],

    // Default child assigned to agent (if any)
    "defaultChild": {
      "childId": "abc-123-def-456",
      "name": "Mike"
    }
  }
}
```

### Database Schema

**New Table: `agent_user_sessions`**

```sql
CREATE TABLE IF NOT EXISTS agent_user_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- User identification
  username TEXT NOT NULL,
  user_id TEXT,                    -- UID/SID
  account_name TEXT,               -- Display name

  -- Session tracking
  session_start TEXT,              -- When user logged in
  last_seen TEXT,                  -- Last time we saw this user active
  is_active INTEGER DEFAULT 1,     -- Currently active (0=inactive, 1=active)

  -- Metadata
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_user_sessions_agent_id ON agent_user_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_user_sessions_is_active ON agent_user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_user_sessions_last_seen ON agent_user_sessions(last_seen DESC);
```

**Session Management Logic**:
- One row per agent per unique username
- When user detected: update `last_seen`, set `is_active = 1`
- When user goes inactive: set `is_active = 0`
- When different user logs in: mark old sessions inactive, create/update new one

---

## Platform-Specific User Detection

### macOS (`darwin.js`)

```javascript
/**
 * Get current logged-in user information
 */
async getCurrentUser() {
  // Get console user (GUI session owner)
  const username = execSync('stat -f%Su /dev/console').toString().trim();

  // Get user ID
  const userId = execSync(`id -u ${username}`).toString().trim();

  // Get full name
  const accountName = execSync(`dscl . -read /Users/${username} RealName | tail -1`).toString().trim();

  // Check if screen is locked
  const locked = execSync('python3 -c "import Quartz; print(Quartz.CGSessionCopyCurrentDictionary())"').toString();
  const isActive = !locked.includes('CGSSessionScreenIsLocked');

  return {
    username,
    userId,
    accountName,
    isActive,
    sessionStartTime: this.getLoginTime(username),
    lastActivityTime: new Date().toISOString()
  };
}
```

### Windows (`windows.js`)

```javascript
/**
 * Get current logged-in user information
 */
async getCurrentUser() {
  // Get current user
  const username = process.env.USERNAME;
  const userDomain = process.env.USERDOMAIN;

  // Get SID (Security Identifier)
  const sidResult = execSync(`wmic useraccount where name="${username}" get sid`).toString();
  const userId = sidResult.split('\n')[1].trim();

  // Get full name
  const fullNameResult = execSync(`wmic useraccount where name="${username}" get fullname`).toString();
  const accountName = fullNameResult.split('\n')[1].trim();

  // Check if screen is locked (query session state)
  const sessionState = execSync('powershell -command "(Get-Process logonui -ErrorAction SilentlyContinue) -ne $null"').toString().trim();
  const isActive = sessionState === 'False';

  return {
    username: `${userDomain}\\${username}`,
    userId,
    accountName,
    isActive,
    sessionStartTime: this.getLoginTime(),
    lastActivityTime: new Date().toISOString()
  };
}
```

### Linux (`linux.js`)

```javascript
/**
 * Get current logged-in user information
 */
async getCurrentUser() {
  // Get current desktop session user
  const username = execSync('who | grep ":0" | awk \'{print $1}\' | head -1').toString().trim();

  if (!username) {
    return null; // No GUI user logged in
  }

  // Get UID
  const userId = execSync(`id -u ${username}`).toString().trim();

  // Get full name from /etc/passwd
  const passwdEntry = execSync(`getent passwd ${username}`).toString();
  const accountName = passwdEntry.split(':')[4].split(',')[0];

  // Check if screen is locked (check for screensaver process or loginctl)
  const lockedCheck = execSync(`loginctl show-session $(loginctl list-sessions | grep ${username} | awk '{print $1}') -p LockedHint`).toString();
  const isActive = !lockedCheck.includes('yes');

  return {
    username,
    userId,
    accountName,
    isActive,
    sessionStartTime: this.getLoginTime(username),
    lastActivityTime: new Date().toISOString()
  };
}
```

---

## API Changes

### Agent Heartbeat Endpoint

**POST `/api/agent/heartbeat`**

Request (from agent):
```javascript
{
  "agentId": "agent-123",
  "status": "running",
  "userContext": {
    "systemUser": {
      "username": "mike",
      "userId": "501",
      "accountName": "Mike Smith",
      "isActive": true,
      "sessionStartTime": "2026-01-05T01:30:00Z",
      "lastActivityTime": "2026-01-05T02:15:00Z"
    }
  }
}
```

Response:
```javascript
{
  "success": true,
  "policies": [...],
  "defaultChild": {
    "childId": "abc-123",
    "name": "Mike"
  }
}
```

### Get Agent User Sessions

**GET `/api/agents/:agentId/user-sessions`**

Response:
```javascript
{
  "success": true,
  "currentUser": {
    "username": "mike",
    "accountName": "Mike Smith",
    "isActive": true,
    "sessionStartTime": "2026-01-05T01:30:00Z",
    "lastSeen": "2026-01-05T02:15:00Z"
  },
  "sessionHistory": [
    {
      "username": "mike",
      "sessionStart": "2026-01-05T01:30:00Z",
      "sessionEnd": "2026-01-05T02:15:00Z",
      "duration": "45 minutes"
    },
    {
      "username": "sarah",
      "sessionStart": "2026-01-04T14:00:00Z",
      "sessionEnd": "2026-01-04T18:30:00Z",
      "duration": "4 hours 30 minutes"
    }
  ]
}
```

---

## UI Display

### Agent Settings Page

```
┌─────────────────────────────────────────────────────────┐
│ Agent: Mike's Gaming PC (192.168.1.150)                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Status: ● Online                                         │
│ Current User: Mike (active now)                         │
│ Default Child: Mike                                      │
│                                                          │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Session History                                     │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ Mike        Today 1:30 PM - Now (active)           │ │
│ │ Sarah       Yesterday 2:00 PM - 6:30 PM (4h 30m)   │ │
│ │ Mike        Yesterday 10:00 AM - 12:00 PM (2h)     │ │
│ └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

When no active user:
```
Current User: None
Last User: Mike (2 hours ago)
```

---

## Plugin Integration

Plugins receive enriched responses automatically. Example from Steam plugin:

```javascript
// Plugin checks for Steam process and config
const steamUser = await this.detectSteamUser();  // Returns "mike.smith" from config

// Send to agent for process check
const response = await agent.checkProcesses(['steam.exe']);

// Response is automatically enriched:
{
  "data": {
    "processes": [{ "name": "steam.exe", "pid": 12345 }]
  },
  "userContext": {
    "systemUser": {
      "username": "mike",         // OS user
      "accountName": "Mike Smith",
      "isActive": true
    },
    "detectedUsers": [
      {
        "username": "mike.smith",  // Plugin detected from Steam config
        "source": "steam_config",
        "confidence": "high"
      }
    ],
    "defaultChild": {
      "childId": "abc-123",
      "name": "Mike"
    }
  }
}

// Plugin can now correlate:
// - Steam user "mike.smith" matches OS user "mike"
// - Default child is "Mike"
// - High confidence this is Mike playing
```

### Priority System

1. **Plugin detection** (highest confidence): User identified by plugin from game files/logs
2. **System user** (medium confidence): OS-reported logged-in user
3. **Default child** (fallback): Parent-assigned default for this agent

---

## Implementation Plan

### Phase 1: Agent Side (allow2automate-agent)

1. Add `getCurrentUser()` to platform modules:
   - `src/platform/darwin.js`
   - `src/platform/windows.js`
   - `src/platform/linux.js`

2. Create `src/UserDetector.js` module:
   - Wrapper around platform-specific user detection
   - Caching to avoid excessive OS queries
   - Graceful error handling

3. Update `src/ApiServer.js`:
   - Enrich all responses with `userContext`
   - Include in heartbeat, process checks, status queries

### Phase 2: Parent App Side (allow2automate)

1. Database:
   - Add `agent_user_sessions` table to DatabaseModule
   - Migration script

2. Backend:
   - Update `app/services/AgentService.js` to store user sessions
   - Add method `recordUserSession(agentId, userContext)`
   - Add method `getCurrentUser(agentId)`
   - Add method `getUserSessionHistory(agentId)`

3. API Routes:
   - Update heartbeat handler to store user data
   - Add `GET /api/agents/:agentId/user-sessions` endpoint

4. IPC Handlers:
   - Add `agents:get-user-sessions` handler

### Phase 3: UI Updates

1. Agent Management UI:
   - Display current/last user
   - Show session history
   - Link to child assignment

### Phase 4: Plugin Integration

1. Update plugin API to include `userContext` in all responses
2. Document for plugin developers
3. Update Steam plugin as reference implementation

---

## Testing Strategy

1. **Unit Tests**:
   - Platform user detection modules
   - User session storage logic
   - Response enrichment

2. **Integration Tests**:
   - End-to-end user detection flow
   - Session history accuracy
   - Plugin receives enriched data

3. **Manual Tests**:
   - Lock/unlock screen, verify active status
   - Switch users, verify session tracking
   - Check UI display accuracy

---

## Security & Privacy Considerations

1. **Privacy**: User session data is only stored on parent's device
2. **Permissions**: Agent needs appropriate OS permissions to query user info
3. **Data Retention**: Consider purging old session history (>30 days)
4. **Sensitive Data**: Don't log passwords, only usernames

---

## Success Criteria

✅ Agent detects current OS user on all platforms
✅ User session history stored and displayed
✅ Plugins receive enriched responses with user context
✅ UI shows "Current User" and "Last User" accurately
✅ Priority system works (plugin → system → default)

---

**Status**: Ready for implementation
