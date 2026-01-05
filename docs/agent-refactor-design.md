# Agent Architecture Refactor - Design Document

## Executive Summary

This document outlines the architectural redesign of the allow2automate agent system to eliminate registration codes, enable flexible device-child associations, and implement dynamic child detection. The new design prioritizes user experience, security, and flexibility while maintaining compatibility with the Allow2 platform.

---

## Table of Contents

1. [Requirements Overview](#requirements-overview)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [New Architecture Design](#new-architecture-design)
4. [Registration Flow](#registration-flow)
5. [Data Model](#data-model)
6. [Dynamic Child Detection Protocol](#dynamic-child-detection-protocol)
7. [API Endpoints](#api-endpoints)
8. [Security Model](#security-model)
9. [Migration Strategy](#migration-strategy)
10. [Implementation Phases](#implementation-phases)

---

## Requirements Overview

### Functional Requirements

1. **No Registration Codes**: Installers work immediately without requiring parents to generate codes
2. **Optional Child Association**: Agent-to-child association is optional and modifiable via UI
3. **Multi-Device Support**: Single installer can be used on multiple devices
4. **Independent Registration**: Each device registers independently and appears as a separate agent
5. **No Default Child**: Agents initially have no child assigned
6. **Dynamic Child Detection**:
   - Agents run scripts that MAY detect child account information
   - Detection results sent to allow2automate for matching
   - Priority: Script detection → Default child → No child (no enforcement)

### Non-Functional Requirements

1. **Security**: Prevent unauthorized agent registration without codes
2. **Scalability**: Support households with multiple devices and children
3. **Reliability**: Graceful handling of detection failures
4. **Backward Compatibility**: Smooth migration from current code-based system
5. **User Experience**: Simplified setup process

---

## Current Architecture Analysis

### Current Registration Flow

```
1. Parent generates 6-character registration code in UI
2. Code stored in `registration_codes` table with child_id and expiration
3. Parent downloads installer
4. Installer runs on child's device
5. Agent prompts for registration code
6. Agent sends code + device info to server
7. Server validates code, creates agent record, assigns child_id
8. Agent receives JWT token and policies
```

### Current Limitations

1. **Friction**: Requires parent to generate code before installation
2. **Inflexibility**: Child association locked at registration time
3. **Single Use**: One code per device creates management overhead
4. **Code Management**: Parents must track/manage codes
5. **No Multi-Device**: Each device needs a unique code

### Tables Affected

- `agents` - Stores registered agents with `child_id`
- `registration_codes` - Stores one-time codes
- `child_mappings` - Maps OS usernames to children
- `policies` - Process monitoring policies per agent

---

## New Architecture Design

### Core Principles

1. **Installer-First**: Installers work immediately, no pre-configuration required
2. **Parent-Controlled**: All child associations managed through parent UI
3. **Detection-Assisted**: Optional automated child detection to reduce manual work
4. **Security-Through-Auth**: Agent authentication via unique device identifiers + API keys
5. **Flexible Association**: Change child associations at any time

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    allow2automate Main App                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Agent Management UI                      │  │
│  │  • View all registered agents                        │  │
│  │  • Assign/change child associations                  │  │
│  │  • Review detection suggestions                      │  │
│  │  • Approve/reject auto-detected mappings            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            AgentService (Enhanced)                    │  │
│  │  • Registration without codes                        │  │
│  │  • Dynamic child association                         │  │
│  │  • Child detection result processing                 │  │
│  │  • Policy enforcement based on detected child        │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ▲                                   │
│                          │ HTTPS + JWT                       │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                  ┌────────┴─────────┐
                  │                  │
            ┌─────┴──────┐    ┌──────┴──────┐
            │  Agent 1   │    │  Agent 2    │
            │  (PC)      │    │  (Mac)      │
            │            │    │             │
            │  Runs      │    │  Runs       │
            │  Detection │    │  Detection  │
            │  Scripts   │    │  Scripts    │
            └────────────┘    └─────────────┘
```

---

## Registration Flow

### New Registration Flow (Without Codes)

```
┌─────────────┐
│   Parent    │
│  Downloads  │
│  Installer  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Installer  │
│  Runs on    │
│   Device    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Agent Auto-Registration (No User Input)        │
│  • Generates unique device ID (machine_id)      │
│  • Collects device info (hostname, platform)    │
│  • Sends registration request to server         │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Server Validates Registration                   │
│  • Checks if machine_id already exists          │
│  • Validates API key (embedded in installer)    │
│  • Creates agent record WITHOUT child_id        │
│  • Issues JWT token                             │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Agent Starts                                    │
│  • Receives policies (none initially)           │
│  • Begins heartbeat monitoring                  │
│  • Runs child detection scripts (optional)      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Detection Results Sent to Server (if detected) │
│  • OS username                                  │
│  • User profile path                            │
│  • Allow2 account identifier (if found)         │
│  • Confidence score                             │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Parent Reviews in UI                            │
│  • Sees new agent in "Unassigned Agents" list  │
│  • Reviews detection suggestions (if any)       │
│  • Manually assigns child OR approves detection │
│  • Sets as default child for agent (optional)   │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Policies Activated                              │
│  • Agent receives policies for assigned child   │
│  • Enforcement begins                           │
└─────────────────────────────────────────────────┘
```

### Key Changes from Current Flow

| Aspect | Current | New |
|--------|---------|-----|
| Registration Code | Required | Not used |
| Child Assignment | At registration | After registration via UI |
| User Input | Manual code entry | None (automatic) |
| Multi-Device | One code per device | Single installer, unlimited devices |
| Detection | Not supported | Optional, parent-reviewed |

---

## Data Model

### Database Schema Changes

#### 1. Enhanced `agents` Table

```sql
CREATE TABLE agents (
  -- Existing fields
  id TEXT PRIMARY KEY,
  machine_id TEXT UNIQUE NOT NULL,
  hostname TEXT,
  platform TEXT,
  version TEXT,
  auth_token TEXT,
  last_known_ip TEXT,
  last_heartbeat TEXT,
  registered_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  -- CHANGED: Make child_id optional and nullable
  child_id TEXT REFERENCES children(id) ON DELETE SET NULL,

  -- NEW: Track default child assignment separately
  default_child_id TEXT REFERENCES children(id) ON DELETE SET NULL,

  -- NEW: Installation metadata
  installer_version TEXT,
  installer_api_key_hash TEXT,  -- Hash of API key used for registration

  -- NEW: Status tracking
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'pending_approval')),

  -- NEW: Parent approval tracking
  approved_by_parent INTEGER DEFAULT 0,  -- Boolean: has parent reviewed this agent?
  approved_at TEXT,

  -- NEW: Detection metadata
  last_detection_run TEXT,
  detection_enabled INTEGER DEFAULT 1  -- Boolean: allow detection scripts to run
);

-- New indexes
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_default_child_id ON agents(default_child_id);
CREATE INDEX IF NOT EXISTS idx_agents_approved_by_parent ON agents(approved_by_parent);
```

#### 2. Enhanced `child_mappings` Table

```sql
CREATE TABLE child_mappings (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,

  -- Detection source
  platform TEXT,
  username TEXT,

  -- Child association
  child_id TEXT REFERENCES children(id) ON DELETE CASCADE,

  -- Detection confidence and validation
  confidence TEXT DEFAULT 'low' CHECK(confidence IN ('low', 'medium', 'high', 'verified')),
  confidence_score INTEGER DEFAULT 0 CHECK(confidence_score BETWEEN 0 AND 100),

  -- Detection source tracking
  detection_method TEXT,  -- e.g., 'script', 'allow2_api', 'manual', 'registry'
  auto_discovered INTEGER DEFAULT 0,  -- Boolean: automatically detected?

  -- Parent approval workflow
  confirmed_by_parent INTEGER DEFAULT 0,  -- Boolean: parent approved?
  rejected_by_parent INTEGER DEFAULT 0,   -- Boolean: parent rejected?
  reviewed_at TEXT,

  -- Metadata
  created_at TEXT DEFAULT (datetime('now')),
  last_used TEXT,
  metadata TEXT DEFAULT '{}',  -- JSON: detection details

  -- NEW: Allow2 account correlation
  allow2_account_id TEXT,  -- Allow2 child account ID if detected
  allow2_username TEXT     -- Allow2 username if detected
);

-- New indexes
CREATE INDEX IF NOT EXISTS idx_child_mappings_confidence ON child_mappings(confidence);
CREATE INDEX IF NOT EXISTS idx_child_mappings_confirmed ON child_mappings(confirmed_by_parent);
CREATE INDEX IF NOT EXISTS idx_child_mappings_allow2_account ON child_mappings(allow2_account_id);
```

#### 3. New `installer_api_keys` Table

```sql
CREATE TABLE installer_api_keys (
  id TEXT PRIMARY KEY,

  -- API key for installer authentication
  api_key_hash TEXT UNIQUE NOT NULL,  -- SHA256 hash of API key
  api_key_prefix TEXT NOT NULL,       -- First 8 chars for identification

  -- Metadata
  label TEXT,                          -- e.g., "Default Installer", "School District"
  created_by_user_id TEXT,            -- Parent who created this key
  created_at TEXT DEFAULT (datetime('now')),

  -- Status and security
  active INTEGER DEFAULT 1,            -- Boolean: is this key valid?
  expires_at TEXT,                     -- Optional expiration
  last_used_at TEXT,

  -- Usage tracking
  registration_count INTEGER DEFAULT 0,
  max_registrations INTEGER,           -- Optional limit

  -- Permissions
  permissions TEXT DEFAULT '{}',       -- JSON: what this key can do

  UNIQUE(api_key_hash)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_installer_api_keys_active ON installer_api_keys(active);
CREATE INDEX IF NOT EXISTS idx_installer_api_keys_hash ON installer_api_keys(api_key_hash);
```

#### 4. New `child_detection_results` Table

```sql
CREATE TABLE child_detection_results (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,

  -- Detection results
  os_username TEXT,
  user_profile_path TEXT,
  allow2_account_id TEXT,
  allow2_username TEXT,

  -- Confidence and scoring
  confidence_score INTEGER CHECK(confidence_score BETWEEN 0 AND 100),
  detection_method TEXT,

  -- Detection metadata
  detected_at TEXT DEFAULT (datetime('now')),
  detection_data TEXT DEFAULT '{}',  -- JSON: raw detection data

  -- Processing status
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'matched', 'rejected', 'expired')),
  processed_at TEXT,
  matched_child_id TEXT REFERENCES children(id) ON DELETE SET NULL,

  -- Parent review
  reviewed_by_parent INTEGER DEFAULT 0,
  review_action TEXT CHECK(review_action IN ('approved', 'rejected', 'ignored'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_detection_results_agent_id ON child_detection_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_detection_results_status ON child_detection_results(status);
CREATE INDEX IF NOT EXISTS idx_detection_results_allow2_account ON child_detection_results(allow2_account_id);
```

#### 5. Deprecate `registration_codes` Table

```sql
-- Mark table as deprecated but keep for backward compatibility during migration
-- Add deprecation flag to existing table
ALTER TABLE registration_codes ADD COLUMN deprecated INTEGER DEFAULT 0;

-- New registration_codes will have deprecated=1
-- Old registration flow can still work during transition period
```

### Entity Relationship Diagram

```
┌──────────────────┐         ┌──────────────────┐
│    children      │◄────────│     agents       │
│                  │ 1     * │                  │
│  • id            │         │  • id            │
│  • name          │         │  • machine_id    │
│  • allow2_id     │         │  • hostname      │
└──────────────────┘         │  • child_id      │
                             │  • default_child │
                             │  • status        │
                             │  • approved      │
                             └────────┬─────────┘
                                      │
                        ┌─────────────┼─────────────┐
                        │             │             │
                        │ *           │ *           │ *
         ┌──────────────▼──┐  ┌───────▼──────┐  ┌──▼──────────────┐
         │ child_mappings  │  │   policies   │  │  detection_     │
         │                 │  │              │  │  results        │
         │ • agent_id      │  │ • agent_id   │  │                 │
         │ • child_id      │  │ • process    │  │ • agent_id      │
         │ • confidence    │  │ • allowed    │  │ • allow2_id     │
         │ • confirmed     │  └──────────────┘  │ • status        │
         └─────────────────┘                    │ • confidence    │
                                                 └─────────────────┘

┌──────────────────────────┐
│  installer_api_keys      │
│                          │
│  • api_key_hash          │
│  • active                │
│  • registration_count    │
└──────────────────────────┘
```

---

## Dynamic Child Detection Protocol

### Overview

The dynamic child detection system allows agents to automatically identify which Allow2 child account is using a device. This reduces manual configuration while maintaining parent oversight.

### Detection Process

```
┌──────────────┐
│    Agent     │
│   Startup    │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Run Detection Scripts               │
│  • Check OS user profile             │
│  • Look for Allow2 cached data       │
│  • Check browser cookies/storage     │
│  • Analyze user patterns             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Calculate Confidence Score          │
│  • Direct Allow2 ID found: 90-100   │
│  • Username match: 60-80            │
│  • Pattern match: 30-60             │
│  • No match: 0-30                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Send Detection Result to Server     │
│  (if confidence > 30)                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Server Processes Result             │
│  • Match to existing children        │
│  • Store in detection_results        │
│  • Notify parent (UI + optional)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Parent Reviews in UI                │
│  • View detection suggestion         │
│  • Approve / Reject / Ignore         │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────┴───────┐
        │              │
        ▼              ▼
  ┌──────────┐   ┌──────────┐
  │ Approved │   │ Rejected │
  └────┬─────┘   └────┬─────┘
       │              │
       ▼              ▼
  ┌────────────┐  ┌────────────┐
  │ Set child  │  │ Mark as    │
  │ assignment │  │ invalid    │
  └────────────┘  └────────────┘
```

### Detection Request Format

**Agent → Server**

```json
POST /api/agent/detect-child
Headers:
  Authorization: Bearer <agent_jwt_token>
  Content-Type: application/json

Body:
{
  "detectionId": "uuid-v4",
  "timestamp": "2026-01-04T12:00:00.000Z",
  "detectionMethod": "allow2_cache_check",
  "confidenceScore": 85,
  "results": {
    "osUsername": "johnny_smith",
    "userProfilePath": "C:\\Users\\johnny_smith",
    "allow2AccountId": "allow2_child_12345",  // if found
    "allow2Username": "johnny@example.com",   // if found
    "additionalData": {
      "browserFingerprint": "...",
      "lastSeenApp": "fortnite",
      "detectionSource": "registry_key"
    }
  },
  "platform": "win32",
  "platformVersion": "10.0.19045"
}
```

### Detection Response Format

**Server → Agent**

```json
{
  "success": true,
  "detectionResultId": "uuid-v4",
  "status": "pending_review",
  "message": "Detection result received and will be reviewed by parent",
  "matchedChild": {
    "childId": "child-uuid",
    "name": "Johnny",
    "confidence": "high"
  },
  "requiresApproval": true,
  "estimatedReviewTime": "24h"
}
```

### Priority System

When multiple child detection sources exist, use this priority:

1. **Parent Manual Assignment** (100% confidence) - Always takes precedence
2. **Approved Detection Result** (90-100% confidence) - Parent reviewed and approved
3. **High Confidence Auto-Detection** (80-89% confidence) - Pending parent review
4. **Default Child Assignment** (70% confidence) - Agent's configured default
5. **Medium Confidence Detection** (50-79% confidence) - Requires review
6. **No Assignment** (0% confidence) - No enforcement

### Detection Script Examples

#### Windows - Registry Check
```javascript
// Example detection method for Windows
async function detectAllow2Child_Windows() {
  try {
    // Check Windows Registry for Allow2 cached data
    const registryPath = 'HKEY_CURRENT_USER\\Software\\Allow2\\Cache';
    const childId = await readRegistry(registryPath, 'childId');
    const username = await readRegistry(registryPath, 'username');

    if (childId && username) {
      return {
        allow2AccountId: childId,
        allow2Username: username,
        detectionMethod: 'windows_registry',
        confidenceScore: 95
      };
    }
  } catch (error) {
    console.error('Registry detection failed:', error);
  }
  return null;
}
```

#### macOS - Preferences Check
```javascript
// Example detection method for macOS
async function detectAllow2Child_macOS() {
  try {
    // Check macOS preferences/keychain for Allow2 data
    const prefsPath = '~/Library/Preferences/com.allow2.automate.plist';
    const prefs = await readPlist(prefsPath);

    if (prefs.childId) {
      return {
        allow2AccountId: prefs.childId,
        allow2Username: prefs.username,
        detectionMethod: 'macos_preferences',
        confidenceScore: 95
      };
    }
  } catch (error) {
    console.error('Preferences detection failed:', error);
  }
  return null;
}
```

#### Cross-Platform - Browser Storage Check
```javascript
// Example detection using browser local storage
async function detectAllow2Child_Browser() {
  try {
    // Check Chrome/Firefox local storage for Allow2 web app data
    const storageData = await readBrowserStorage('allow2.com');

    if (storageData.userId) {
      return {
        allow2AccountId: storageData.userId,
        allow2Username: storageData.email,
        detectionMethod: 'browser_storage',
        confidenceScore: 80
      };
    }
  } catch (error) {
    console.error('Browser detection failed:', error);
  }
  return null;
}
```

---

## API Endpoints

### New/Modified Endpoints

#### 1. Agent Registration (Modified)

**POST /api/agent/register**

```json
Request:
{
  "agentInfo": {
    "machineId": "unique-device-id-12345",
    "hostname": "Johnny-PC",
    "platform": "win32",
    "platformVersion": "10.0.19045",
    "version": "1.2.0",
    "ip": "192.168.1.100",
    "installerVersion": "1.2.0"
  },
  "apiKey": "installer_api_key_here"  // NEW: Instead of registrationCode
}

Response (Success):
{
  "success": true,
  "agentId": "agent-uuid-v4",
  "token": "jwt-token-here",
  "status": "registered",
  "childId": null,  // NEW: Initially no child assigned
  "defaultChildId": null,
  "policies": [],   // NEW: Empty policies until child assigned
  "message": "Agent registered successfully. Awaiting parent assignment."
}

Response (Error - Invalid API Key):
{
  "success": false,
  "error": "Invalid or expired API key",
  "code": "INVALID_API_KEY"
}

Response (Error - Already Registered):
{
  "success": true,
  "agentId": "existing-agent-uuid",
  "token": "jwt-token-here",
  "status": "already_registered",
  "childId": "child-uuid",  // If previously assigned
  "defaultChildId": "child-uuid",
  "policies": [...],
  "message": "Agent already registered. Welcome back!"
}
```

#### 2. Child Detection Result Submission (New)

**POST /api/agent/detect-child**

```json
Request:
Headers:
  Authorization: Bearer <agent_jwt>

Body:
{
  "detectionId": "uuid-v4",
  "timestamp": "2026-01-04T12:00:00Z",
  "detectionMethod": "allow2_cache_check",
  "confidenceScore": 85,
  "results": {
    "osUsername": "johnny_smith",
    "userProfilePath": "/Users/johnny_smith",
    "allow2AccountId": "allow2_child_12345",
    "allow2Username": "johnny@example.com",
    "additionalData": {}
  }
}

Response:
{
  "success": true,
  "detectionResultId": "result-uuid",
  "status": "pending_review",
  "matchedChild": {
    "childId": "child-uuid",
    "name": "Johnny",
    "confidence": "high"
  },
  "requiresApproval": true
}
```

#### 3. Get Agent Status (Enhanced)

**GET /api/agent/status**

```json
Request:
Headers:
  Authorization: Bearer <agent_jwt>

Response:
{
  "success": true,
  "agent": {
    "id": "agent-uuid",
    "hostname": "Johnny-PC",
    "status": "active",
    "childAssignment": {
      "assigned": true,
      "childId": "child-uuid",
      "childName": "Johnny",
      "assignmentMethod": "auto_detection",  // or "manual" or "default"
      "assignedAt": "2026-01-04T12:00:00Z",
      "approvedByParent": true
    },
    "defaultChild": {
      "childId": "child-uuid",
      "childName": "Johnny"
    },
    "detectionEnabled": true,
    "lastDetectionRun": "2026-01-04T11:00:00Z",
    "policies": [...],
    "policiesCount": 5,
    "enforcementActive": true
  }
}
```

#### 4. List Agents (Enhanced for Parents)

**GET /api/agents**

```json
Response:
{
  "success": true,
  "agents": [
    {
      "id": "agent-uuid-1",
      "hostname": "Johnny-PC",
      "platform": "win32",
      "status": "active",
      "online": true,
      "lastHeartbeat": "2026-01-04T12:00:00Z",
      "childAssignment": {
        "assigned": true,
        "childId": "child-uuid",
        "childName": "Johnny",
        "assignmentMethod": "manual"
      },
      "detectionSuggestions": [],  // NEW: Pending detection results
      "requiresReview": false,
      "registeredAt": "2026-01-01T10:00:00Z"
    },
    {
      "id": "agent-uuid-2",
      "hostname": "Living-Room-Mac",
      "platform": "darwin",
      "status": "active",
      "online": true,
      "lastHeartbeat": "2026-01-04T12:00:00Z",
      "childAssignment": {
        "assigned": false
      },
      "detectionSuggestions": [
        {
          "detectionResultId": "result-uuid",
          "suggestedChildId": "child-uuid",
          "suggestedChildName": "Sarah",
          "confidence": "high",
          "confidenceScore": 85,
          "detectionMethod": "allow2_cache_check",
          "detectedAt": "2026-01-04T11:30:00Z"
        }
      ],
      "requiresReview": true,  // NEW: Flag for UI
      "registeredAt": "2026-01-04T11:00:00Z"
    }
  ],
  "summary": {
    "total": 2,
    "assigned": 1,
    "unassigned": 1,
    "requiresReview": 1,
    "online": 2
  }
}
```

#### 5. Assign Child to Agent (New)

**POST /api/agent/:agentId/assign-child**

```json
Request:
{
  "childId": "child-uuid",
  "setAsDefault": true,  // Optional: also set as default child
  "source": "manual"     // "manual" | "detection_approved"
}

Response:
{
  "success": true,
  "agentId": "agent-uuid",
  "childId": "child-uuid",
  "defaultChildId": "child-uuid",
  "policiesApplied": 5,
  "message": "Child assigned successfully. Policies now active."
}
```

#### 6. Set Default Child for Agent (New)

**POST /api/agent/:agentId/set-default-child**

```json
Request:
{
  "childId": "child-uuid"
}

Response:
{
  "success": true,
  "agentId": "agent-uuid",
  "defaultChildId": "child-uuid",
  "message": "Default child set successfully."
}
```

#### 7. Review Detection Result (New)

**POST /api/agent/:agentId/review-detection/:resultId**

```json
Request:
{
  "action": "approve",  // "approve" | "reject" | "ignore"
  "setAsDefault": false // Optional: set as default child if approving
}

Response (Approved):
{
  "success": true,
  "action": "approve",
  "detectionResultId": "result-uuid",
  "agentId": "agent-uuid",
  "childId": "child-uuid",
  "defaultChildId": "child-uuid",  // If setAsDefault was true
  "policiesApplied": 5,
  "message": "Detection approved. Child assigned and policies activated."
}

Response (Rejected):
{
  "success": true,
  "action": "reject",
  "detectionResultId": "result-uuid",
  "message": "Detection result rejected."
}
```

#### 8. Generate Installer API Key (New)

**POST /api/installer-keys**

```json
Request:
{
  "label": "Home Installer",
  "maxRegistrations": null,  // Optional: limit number of registrations
  "expiresAt": null          // Optional: expiration date
}

Response:
{
  "success": true,
  "apiKey": "a2a_live_1234567890abcdef...",  // Full API key (show once!)
  "apiKeyId": "key-uuid",
  "label": "Home Installer",
  "createdAt": "2026-01-04T12:00:00Z",
  "message": "IMPORTANT: Save this API key now. It cannot be retrieved later."
}
```

#### 9. List Installer API Keys (New)

**GET /api/installer-keys**

```json
Response:
{
  "success": true,
  "keys": [
    {
      "id": "key-uuid",
      "prefix": "a2a_live_",
      "label": "Home Installer",
      "active": true,
      "createdAt": "2026-01-04T12:00:00Z",
      "lastUsedAt": "2026-01-04T12:30:00Z",
      "registrationCount": 3,
      "maxRegistrations": null,
      "expiresAt": null
    }
  ]
}
```

### Endpoint Summary Table

| Endpoint | Method | Auth | Purpose | New/Modified |
|----------|--------|------|---------|--------------|
| `/api/agent/register` | POST | API Key | Register agent without code | Modified |
| `/api/agent/detect-child` | POST | Agent JWT | Submit detection results | New |
| `/api/agent/status` | GET | Agent JWT | Get agent status | Enhanced |
| `/api/agents` | GET | Parent | List all agents | Enhanced |
| `/api/agent/:id/assign-child` | POST | Parent | Assign child to agent | New |
| `/api/agent/:id/set-default-child` | POST | Parent | Set default child | New |
| `/api/agent/:id/review-detection/:resultId` | POST | Parent | Review detection | New |
| `/api/installer-keys` | POST | Parent | Generate API key | New |
| `/api/installer-keys` | GET | Parent | List API keys | New |
| `/api/agent/policies` | GET | Agent JWT | Get policies | Existing |
| `/api/agent/heartbeat` | POST | Agent JWT | Update heartbeat | Existing |
| `/api/agent/violations` | POST | Agent JWT | Report violation | Existing |

---

## Security Model

### Challenge: Preventing Unauthorized Agent Registration

Without registration codes, we need alternative security measures to prevent unauthorized devices from registering as agents.

### Solution: Installer API Keys

#### Concept

1. **API Keys Embedded in Installers**: Each installer binary contains an embedded API key
2. **Key Management**: Parents can generate multiple API keys with different permissions
3. **Key Validation**: Server validates API key during registration
4. **Usage Tracking**: Monitor API key usage to detect abuse

#### API Key Format

```
a2a_live_1234567890abcdefghijklmnopqrstuvwxyz
│   │    │
│   │    └─ Random 32-character string (128 bits entropy)
│   └────── Environment (live/test/dev)
└────────── Prefix (allow2automate)
```

#### Security Properties

1. **High Entropy**: 128+ bits of randomness
2. **Rate Limited**: Prevent brute force attacks
3. **Revocable**: Parents can deactivate keys
4. **Auditable**: Track which devices used which keys
5. **Time-Limited**: Optional expiration dates
6. **Usage-Limited**: Optional registration count limits

### Security Layers

#### Layer 1: API Key Validation

```javascript
// Server-side validation
async function validateInstallerApiKey(apiKey) {
  // Hash the provided key
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Look up in database
  const keyRecord = await db.queryOne(
    'SELECT * FROM installer_api_keys WHERE api_key_hash = $1 AND active = 1',
    [keyHash]
  );

  if (!keyRecord) {
    throw new Error('Invalid API key');
  }

  // Check expiration
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    throw new Error('API key expired');
  }

  // Check usage limits
  if (keyRecord.max_registrations &&
      keyRecord.registration_count >= keyRecord.max_registrations) {
    throw new Error('API key registration limit reached');
  }

  return keyRecord;
}
```

#### Layer 2: Machine ID Uniqueness

```javascript
// Prevent duplicate registrations from same device
async function checkMachineIdUnique(machineId) {
  const existing = await db.queryOne(
    'SELECT id FROM agents WHERE machine_id = $1',
    [machineId]
  );

  if (existing) {
    // Device already registered - return existing agent
    return { alreadyRegistered: true, agentId: existing.id };
  }

  return { alreadyRegistered: false };
}
```

#### Layer 3: Rate Limiting

```javascript
// Limit registration attempts per IP address
const rateLimiter = {
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,  // 10 registrations per window
  message: 'Too many registration attempts. Please try again later.'
};
```

#### Layer 4: Parent Approval Workflow

```javascript
// Optional: Require parent approval for new agents
async function createAgent(agentInfo, apiKeyRecord) {
  const requiresApproval = apiKeyRecord.permissions.requireParentApproval;

  const agent = await db.query(`
    INSERT INTO agents (id, machine_id, status, ...)
    VALUES ($1, $2, $3, ...)
  `, [
    agentId,
    agentInfo.machineId,
    requiresApproval ? 'pending_approval' : 'active',
    // ...
  ]);

  if (requiresApproval) {
    // Notify parent to review new agent
    await notifyParent({
      type: 'new_agent_pending_approval',
      agentId: agent.id
    });
  }

  return agent;
}
```

### Attack Vectors & Mitigations

| Attack | Mitigation |
|--------|------------|
| **API Key Leaked** | - Revoke key in UI<br>- Generate new key<br>- Monitor usage patterns<br>- Set registration limits |
| **Replay Attack** | - Machine ID uniqueness check<br>- One device = one agent<br>- Re-registration returns existing agent |
| **Brute Force** | - Rate limiting (10 attempts per 15 min)<br>- CAPTCHA after failures<br>- IP-based blocking |
| **Man-in-the-Middle** | - HTTPS only<br>- Certificate pinning (optional)<br>- JWT token security |
| **Unauthorized Agent** | - Parent approval workflow<br>- Review new agents in UI<br>- Inactive agents timeout |

### Default Installer Key

For simplicity, the application ships with a default installer API key:

```javascript
// Default key embedded in installer
const DEFAULT_INSTALLER_KEY = process.env.DEFAULT_INSTALLER_KEY ||
  'a2a_live_default_key_change_in_production';

// Parents can:
// 1. Use default key (easiest, less secure)
// 2. Generate custom keys (more secure, more control)
// 3. Require approval for all new agents (most secure)
```

---

## Migration Strategy

### Phase 1: Backward Compatibility (Weeks 1-2)

**Goal**: New system works alongside old registration code system

1. **Database Changes**:
   - Add new tables (`installer_api_keys`, `child_detection_results`)
   - Modify `agents` table (add new columns with defaults)
   - Keep `registration_codes` table functional

2. **API Support**:
   - Support both old and new registration endpoints
   - Old: `/api/agent/register` with `registrationCode`
   - New: `/api/agent/register` with `apiKey`

3. **Installer Support**:
   - Build installers with both capabilities
   - Try new API key method first
   - Fallback to registration code if needed

### Phase 2: Migration Tools (Weeks 3-4)

**Goal**: Help users transition from old to new system

1. **Data Migration**:
   ```sql
   -- Migrate existing agents to new structure
   UPDATE agents
   SET default_child_id = child_id,
       approved_by_parent = 1,
       status = 'active'
   WHERE child_id IS NOT NULL;

   -- Mark agents with no child as needing review
   UPDATE agents
   SET status = 'pending_approval',
       approved_by_parent = 0
   WHERE child_id IS NULL;
   ```

2. **Generate Default API Key**:
   ```javascript
   // Create default installer key for existing users
   async function createDefaultInstallerKey() {
     const apiKey = crypto.randomBytes(16).toString('hex');
     const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

     await db.query(`
       INSERT INTO installer_api_keys
       (id, api_key_hash, api_key_prefix, label, active)
       VALUES ($1, $2, $3, $4, $5)
     `, [
       crypto.randomUUID(),
       keyHash,
       apiKey.substring(0, 8),
       'Default Installer Key',
       true
     ]);

     return apiKey;
   }
   ```

3. **UI Migration Notice**:
   - Show banner: "New simplified agent registration available!"
   - Guide: "Generate installer key to stop using registration codes"
   - Tutorial: Walk through new workflow

### Phase 3: Deprecation (Weeks 5-8)

**Goal**: Gradually phase out old system

1. **Week 5-6**:
   - Add deprecation warnings to registration code flow
   - Encourage users to migrate

2. **Week 7-8**:
   - Make registration codes optional (disabled by default)
   - Add toggle: "Use legacy registration codes" (off by default)

3. **Beyond Week 8**:
   - Remove registration code generation UI
   - Keep API endpoint for backward compatibility (1 year)
   - Eventually remove completely

### Migration Checklist

- [ ] Add new database tables and columns
- [ ] Create database migration scripts
- [ ] Update API endpoints (backward compatible)
- [ ] Build new installers with API key support
- [ ] Add fallback to old registration in installer
- [ ] Update UI with agent management features
- [ ] Create API key generation UI
- [ ] Add child detection review UI
- [ ] Migrate existing agent data
- [ ] Generate default API keys for existing users
- [ ] Test both registration flows
- [ ] Document new workflow
- [ ] Add deprecation warnings to old flow
- [ ] Monitor migration progress
- [ ] Remove old UI (after transition period)
- [ ] Remove old API endpoints (after 1 year)

---

## Implementation Phases

### Phase 1: Foundation (2 weeks)

**Database & Backend**

- [ ] Create database migration scripts
- [ ] Add new tables: `installer_api_keys`, `child_detection_results`
- [ ] Modify `agents` table schema
- [ ] Implement API key generation logic
- [ ] Create API key validation middleware

**API Endpoints**

- [ ] Implement `/api/agent/register` (new version with API key)
- [ ] Implement `/api/installer-keys` (POST, GET, DELETE)
- [ ] Implement `/api/agent/detect-child`
- [ ] Enhance `/api/agents` endpoint with new fields

### Phase 2: Agent Integration (2 weeks)

**Agent Software Updates**

- [ ] Modify agent registration to use API key
- [ ] Implement child detection scripts
- [ ] Add detection result submission logic
- [ ] Handle "no child assigned" state gracefully
- [ ] Build multi-platform installers with embedded keys

**Testing**

- [ ] Test registration without codes
- [ ] Test API key validation
- [ ] Test child detection on Windows/macOS/Linux
- [ ] Test multi-device registration with same key

### Phase 3: UI Development (2 weeks)

**Agent Management UI**

- [ ] List view with assigned/unassigned agents
- [ ] Child assignment interface
- [ ] Detection result review panel
- [ ] Default child configuration
- [ ] Agent status indicators

**API Key Management UI**

- [ ] Generate installer API keys
- [ ] List existing keys
- [ ] Revoke/deactivate keys
- [ ] Download installers with embedded keys

### Phase 4: Detection & Matching (2 weeks)

**Detection Logic**

- [ ] Implement Allow2 account ID matching
- [ ] Build confidence scoring algorithm
- [ ] Create detection method plugins
- [ ] Add parent notification system

**Testing**

- [ ] Test detection accuracy
- [ ] Test confidence scoring
- [ ] Test matching algorithm
- [ ] Test false positive handling

### Phase 5: Migration & Polish (1 week)

**Migration**

- [ ] Run data migration scripts
- [ ] Generate default API keys
- [ ] Migrate existing agents
- [ ] Test backward compatibility

**Documentation & Support**

- [ ] Update user documentation
- [ ] Create migration guide
- [ ] Add in-app tutorials
- [ ] Prepare support materials

---

## Success Metrics

### User Experience

- **Registration Time**: < 2 minutes (down from 5+ minutes with codes)
- **Setup Steps**: 2 steps (download, install) vs 4 steps (generate code, download, install, enter code)
- **Parent Review Time**: < 1 minute per agent
- **Detection Accuracy**: > 80% correct child matches

### Technical

- **API Key Security**: 0 leaked keys in first 6 months
- **Registration Success Rate**: > 95%
- **Detection Submission Rate**: > 60% of agents
- **Parent Approval Rate**: > 80% of detection results

### Adoption

- **Migration Rate**: > 80% of users migrated within 3 months
- **Multi-Device Usage**: > 30% of families use 2+ agents
- **Support Tickets**: < 5% increase during migration

---

## Open Questions & Future Enhancements

### Open Questions

1. **API Key Distribution**: Should we support multiple distribution methods (QR codes, email, URL)?
2. **Detection Frequency**: How often should agents re-run detection (daily, weekly, on login)?
3. **Offline Detection**: Should agents cache detection results for offline operation?
4. **Child Switching**: How to handle devices shared by multiple children?
5. **Enterprise Support**: Should we support organizational API keys for schools/businesses?

### Future Enhancements

1. **QR Code Registration**: Scan QR code to download installer with embedded key
2. **Mobile App Integration**: Manage agents from Allow2 mobile app
3. **Real-Time Switching**: Automatically switch child based on current OS user
4. **Geofencing**: Different policies based on device location
5. **Smart Recommendations**: ML-based child assignment suggestions
6. **Family Sharing**: Share agent management across multiple parent accounts
7. **Advanced Detection**: Use browser history, app usage patterns for better detection
8. **Bulk Operations**: Assign multiple agents to same child at once

---

## Appendix

### A. Example User Flows

#### Flow 1: New User - Single Child, Single Device

1. Parent installs allow2automate on their computer
2. Parent adds child "Johnny" to Allow2
3. Parent downloads agent installer
4. Parent runs installer on Johnny's computer
5. Agent auto-registers (no user input)
6. Agent attempts child detection
7. Agent finds Allow2 child ID in browser cache (85% confidence)
8. Agent sends detection result to server
9. Parent sees notification: "New device detected for Johnny"
10. Parent reviews and approves
11. Policies activate automatically

**Time**: ~3 minutes (vs ~7 minutes with registration codes)

#### Flow 2: Existing User - Multiple Children, Multiple Devices

1. Parent has 3 children: Johnny, Sarah, Emma
2. Parent downloads installer once
3. Parent runs installer on Johnny's PC (Device 1)
4. Parent runs installer on Sarah's Mac (Device 2)
5. Parent runs installer on Emma's PC (Device 3)
6. All 3 agents register automatically
7. Agent 1 detects Johnny (90% confidence)
8. Agent 2 detects Sarah (75% confidence)
9. Agent 3 detection fails (no data found)
10. Parent opens agent management UI
11. Parent sees:
    - Device 1: Suggested "Johnny" ✓ Approve
    - Device 2: Suggested "Sarah" ✓ Approve
    - Device 3: Unassigned → Manually select "Emma"
12. All policies activate

**Time**: ~5 minutes for 3 devices (vs ~15 minutes with codes)

### B. Database Migration SQL

```sql
-- Migration Script: Add Agent Refactor Tables
-- Version: 2.0.0
-- Date: 2026-01-04

BEGIN TRANSACTION;

-- 1. Create new tables
CREATE TABLE IF NOT EXISTS installer_api_keys (
  id TEXT PRIMARY KEY,
  api_key_hash TEXT UNIQUE NOT NULL,
  api_key_prefix TEXT NOT NULL,
  label TEXT,
  created_by_user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  active INTEGER DEFAULT 1,
  expires_at TEXT,
  last_used_at TEXT,
  registration_count INTEGER DEFAULT 0,
  max_registrations INTEGER,
  permissions TEXT DEFAULT '{}',
  UNIQUE(api_key_hash)
);

CREATE TABLE IF NOT EXISTS child_detection_results (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  os_username TEXT,
  user_profile_path TEXT,
  allow2_account_id TEXT,
  allow2_username TEXT,
  confidence_score INTEGER CHECK(confidence_score BETWEEN 0 AND 100),
  detection_method TEXT,
  detected_at TEXT DEFAULT (datetime('now')),
  detection_data TEXT DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'matched', 'rejected', 'expired')),
  processed_at TEXT,
  matched_child_id TEXT REFERENCES children(id) ON DELETE SET NULL,
  reviewed_by_parent INTEGER DEFAULT 0,
  review_action TEXT CHECK(review_action IN ('approved', 'rejected', 'ignored'))
);

-- 2. Add new columns to existing agents table
ALTER TABLE agents ADD COLUMN default_child_id TEXT REFERENCES children(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN installer_version TEXT;
ALTER TABLE agents ADD COLUMN installer_api_key_hash TEXT;
ALTER TABLE agents ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'pending_approval'));
ALTER TABLE agents ADD COLUMN approved_by_parent INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN approved_at TEXT;
ALTER TABLE agents ADD COLUMN last_detection_run TEXT;
ALTER TABLE agents ADD COLUMN detection_enabled INTEGER DEFAULT 1;

-- 3. Add new columns to child_mappings table
ALTER TABLE child_mappings ADD COLUMN confidence_score INTEGER DEFAULT 0 CHECK(confidence_score BETWEEN 0 AND 100);
ALTER TABLE child_mappings ADD COLUMN detection_method TEXT;
ALTER TABLE child_mappings ADD COLUMN rejected_by_parent INTEGER DEFAULT 0;
ALTER TABLE child_mappings ADD COLUMN reviewed_at TEXT;
ALTER TABLE child_mappings ADD COLUMN allow2_account_id TEXT;
ALTER TABLE child_mappings ADD COLUMN allow2_username TEXT;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_default_child_id ON agents(default_child_id);
CREATE INDEX IF NOT EXISTS idx_agents_approved_by_parent ON agents(approved_by_parent);

CREATE INDEX IF NOT EXISTS idx_installer_api_keys_active ON installer_api_keys(active);
CREATE INDEX IF NOT EXISTS idx_installer_api_keys_hash ON installer_api_keys(api_key_hash);

CREATE INDEX IF NOT EXISTS idx_detection_results_agent_id ON child_detection_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_detection_results_status ON child_detection_results(status);
CREATE INDEX IF NOT EXISTS idx_detection_results_allow2_account ON child_detection_results(allow2_account_id);

CREATE INDEX IF NOT EXISTS idx_child_mappings_confidence ON child_mappings(confidence);
CREATE INDEX IF NOT EXISTS idx_child_mappings_confirmed ON child_mappings(confirmed_by_parent);
CREATE INDEX IF NOT EXISTS idx_child_mappings_allow2_account ON child_mappings(allow2_account_id);

-- 5. Migrate existing data
UPDATE agents
SET default_child_id = child_id,
    approved_by_parent = 1,
    status = 'active',
    approved_at = datetime('now')
WHERE child_id IS NOT NULL;

UPDATE agents
SET status = 'pending_approval',
    approved_by_parent = 0
WHERE child_id IS NULL;

-- 6. Update schema version
INSERT OR REPLACE INTO schema_metadata (key, value, updated_at)
VALUES ('version', '2', datetime('now'));

COMMIT;
```

### C. API Key Generation Script

```javascript
/**
 * Generate secure installer API key
 * Usage: node scripts/generate-installer-key.js
 */

import crypto from 'crypto';

function generateInstallerApiKey(label = 'Default Installer') {
  // Generate random key (128 bits)
  const randomBytes = crypto.randomBytes(16);
  const keyString = randomBytes.toString('hex');

  // Format: a2a_live_{key}
  const apiKey = `a2a_live_${keyString}`;

  // Generate hash for storage
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Get prefix for display
  const prefix = apiKey.substring(0, 12);

  return {
    apiKey,        // Full key (show once, securely)
    keyHash,       // Store in database
    prefix,        // Display in UI
    label
  };
}

// Example usage
const key = generateInstallerApiKey('Home Installer');
console.log('Generated Installer API Key:');
console.log('API Key:', key.apiKey);
console.log('Hash (store this):', key.keyHash);
console.log('Prefix (display):', key.prefix);
console.log('\nIMPORTANT: Save the API Key securely. It cannot be retrieved later.');
```

---

## Document Version

- **Version**: 1.0.0
- **Date**: 2026-01-04
- **Author**: AI Architecture Team
- **Status**: Design Review
- **Next Review**: After stakeholder feedback

---

## Approval & Sign-Off

This design document requires review and approval before implementation begins.

**Stakeholders**:
- [ ] Product Owner
- [ ] Tech Lead
- [ ] Security Team
- [ ] UX/UI Team
- [ ] QA Team

**Implementation Start**: After all approvals received
**Target Completion**: 9 weeks from approval

---

*End of Design Document*
