# Allow2 API Response Structure Documentation

This document provides comprehensive documentation of the Allow2 API response structure, including all fields, nested objects, and example responses.

## Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Check Response Structure](#check-response-structure)
4. [Activity Object](#activity-object)
5. [Day Types Object](#day-types-object)
6. [Children Object](#children-object)
7. [Complete Response Examples](#complete-response-examples)
8. [Request Payload Format](#request-payload-format)

---

## Overview

The Allow2 API provides parental control services including activity checking, time quota management, and ban enforcement. When making a check request, the API returns a comprehensive JSON response containing permission status, activity-specific data, day type information, and child profile details.

**Base URLs:**
- API: `https://api.allow2.com`
- Service: `https://service.allow2.com`

**Primary Check Endpoint:** `POST /serviceapi/check`

---

## API Endpoints

### Device Pairing

**Endpoint:** `POST https://api.allow2.com/api/pairDevice`

**Request:**
```json
{
  "user": "parent@example.com",
  "pass": "password",
  "deviceToken": "unique-device-identifier",
  "name": "Home Assistant"
}
```

**Response:**
```json
{
  "userId": 12345,
  "pairId": "ABC123",
  "pairToken": "token_xyz789",
  "children": [
    {
      "id": 1,
      "name": "Emma",
      "pin": "1234"
    },
    {
      "id": 2,
      "name": "Lucas",
      "pin": "5678"
    }
  ]
}
```

### Activity Check

**Endpoint:** `POST https://service.allow2.com/serviceapi/check`

**Request:**
```json
{
  "userId": 12345,
  "pairId": "ABC123",
  "pairToken": "token_xyz789",
  "deviceToken": "unique-device-identifier",
  "tz": "America/New_York",
  "childId": 1,
  "activities": [
    { "id": 3, "log": true }
  ]
}
```

---

## Check Response Structure

The main response structure from the `/serviceapi/check` endpoint:

```json
{
  "result": 0,
  "allowed": true,
  "activities": { ... },
  "dayTypes": { ... },
  "allDayTypes": [ ... ],
  "children": [ ... ],
  "subscription": { ... }
}
```

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `result` | number | Result code (0 = success) |
| `allowed` | boolean | Overall permission status - true if activity is permitted |
| `activities` | object | Activity-specific outcomes keyed by activity ID |
| `dayTypes` | object | Current and next-day type information |
| `allDayTypes` | array | Complete list of day type definitions in the account |
| `children` | array | Array of child profiles |
| `subscription` | object | Account subscription status and limits |

---

## Activity Object

Each activity in the `activities` object is keyed by its numeric ID and contains detailed restriction information.

### Structure

```json
{
  "activities": {
    "3": {
      "id": 3,
      "name": "Gaming",
      "timed": true,
      "units": "minutes",
      "banned": false,
      "remaining": 3600,
      "cached": false,
      "expires": 1547351040,
      "timeBlock": {
        "allowed": true,
        "remaining": 437
      }
    }
  }
}
```

### Activity Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Activity identifier |
| `name` | string | Human-readable activity name |
| `timed` | boolean | Whether activity uses time quotas |
| `units` | string | Measurement unit (typically "minutes") |
| `banned` | boolean | If true, activity is completely blocked |
| `remaining` | number | Remaining time quota in seconds (0 when exhausted) |
| `cached` | boolean | Whether response came from cache |
| `expires` | number | Unix timestamp when cached result expires |
| `timeBlock` | object | Time window restriction details |

### TimeBlock Object

| Field | Type | Description |
|-------|------|-------------|
| `allowed` | boolean | Whether current time window permits activity |
| `remaining` | number | Seconds remaining in current allowed time window |

### Standard Activity IDs

| ID | Activity | Description |
|----|----------|-------------|
| 1 | Internet | General internet access |
| 2 | Computer | Computer usage time |
| 3 | Gaming | Gaming console/PC gaming |
| 7 | Electricity | Power quotas for devices |
| 8 | Screen Time | General screen usage |
| 9 | Social | Social media access |
| 10 | Phone Time | Mobile phone usage |

---

## Day Types Object

The `dayTypes` object provides classification data for temporal restrictions.

### Structure

```json
{
  "dayTypes": {
    "today": {
      "id": 23,
      "name": "Weekend"
    },
    "tomorrow": {
      "id": 86,
      "name": "School Day"
    }
  }
}
```

### Day Type Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Day type identifier |
| `name` | string | Day type name (e.g., "School Day", "Weekend", "Holiday") |

### All Day Types Array

The `allDayTypes` array contains the complete catalog of day type definitions:

```json
{
  "allDayTypes": [
    { "id": 1, "name": "School Day" },
    { "id": 2, "name": "Weekend" },
    { "id": 3, "name": "Holiday" },
    { "id": 4, "name": "Vacation" },
    { "id": 5, "name": "Sick Day" }
  ]
}
```

---

## Children Object

The `children` array contains profiles for all children associated with the account.

### Structure

```json
{
  "children": [
    {
      "id": 1,
      "name": "Emma",
      "pin": "1234",
      "timezone": "America/New_York"
    },
    {
      "id": 2,
      "name": "Lucas",
      "pin": "5678",
      "timezone": "America/New_York"
    }
  ]
}
```

### Child Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Child identifier |
| `name` | string | Child's display name |
| `pin` | string | Child's PIN code |
| `timezone` | string | Child's timezone (IANA format) |

---

## Complete Response Examples

### Example 1: Activity Allowed with Time Remaining

```json
{
  "result": 0,
  "allowed": true,
  "activities": {
    "3": {
      "id": 3,
      "name": "Gaming",
      "timed": true,
      "units": "minutes",
      "banned": false,
      "remaining": 7200,
      "cached": false,
      "expires": 1705934400,
      "timeBlock": {
        "allowed": true,
        "remaining": 3600
      }
    }
  },
  "dayTypes": {
    "today": {
      "id": 2,
      "name": "Weekend"
    },
    "tomorrow": {
      "id": 1,
      "name": "School Day"
    }
  },
  "allDayTypes": [
    { "id": 1, "name": "School Day" },
    { "id": 2, "name": "Weekend" },
    { "id": 3, "name": "Holiday" }
  ],
  "children": [
    {
      "id": 1,
      "name": "Emma",
      "pin": "1234",
      "timezone": "America/New_York"
    }
  ],
  "subscription": {
    "active": true,
    "childLimit": 5,
    "deviceLimit": 10
  }
}
```

**Interpretation:**
- `allowed: true` - The gaming activity is permitted
- `remaining: 7200` - 2 hours (7200 seconds) of gaming quota remaining
- `timeBlock.allowed: true` - Currently within an allowed time window
- `timeBlock.remaining: 3600` - 1 hour until the current time window ends
- Today is a Weekend, tomorrow is a School Day

### Example 2: Activity Denied - Quota Exhausted

```json
{
  "result": 0,
  "allowed": false,
  "activities": {
    "3": {
      "id": 3,
      "name": "Gaming",
      "timed": true,
      "units": "minutes",
      "banned": false,
      "remaining": 0,
      "cached": false,
      "expires": 1705934400,
      "timeBlock": {
        "allowed": true,
        "remaining": 437
      }
    }
  },
  "dayTypes": {
    "today": {
      "id": 1,
      "name": "School Day"
    },
    "tomorrow": {
      "id": 1,
      "name": "School Day"
    }
  },
  "allDayTypes": [
    { "id": 1, "name": "School Day" },
    { "id": 2, "name": "Weekend" }
  ],
  "children": [
    {
      "id": 1,
      "name": "Emma",
      "pin": "1234",
      "timezone": "America/New_York"
    }
  ]
}
```

**Interpretation:**
- `allowed: false` - The activity is NOT permitted
- `remaining: 0` - No quota remaining (time is exhausted)
- `banned: false` - Not specifically banned, just out of time
- `timeBlock.allowed: true` - The time window allows gaming (but quota is exhausted)

### Example 3: Activity Banned

```json
{
  "result": 0,
  "allowed": false,
  "activities": {
    "9": {
      "id": 9,
      "name": "Social",
      "timed": false,
      "units": "minutes",
      "banned": true,
      "remaining": 0,
      "cached": false,
      "expires": 1705934400,
      "timeBlock": {
        "allowed": false,
        "remaining": 0
      }
    }
  },
  "dayTypes": {
    "today": {
      "id": 1,
      "name": "School Day"
    },
    "tomorrow": {
      "id": 2,
      "name": "Weekend"
    }
  }
}
```

**Interpretation:**
- `allowed: false` - The activity is NOT permitted
- `banned: true` - Social media is explicitly banned (not just out of time)
- `timed: false` - This activity is not time-based (it's either allowed or banned)
- `timeBlock.allowed: false` - Activity not allowed in current time window

### Example 4: Outside Allowed Time Window

```json
{
  "result": 0,
  "allowed": false,
  "activities": {
    "3": {
      "id": 3,
      "name": "Gaming",
      "timed": true,
      "units": "minutes",
      "banned": false,
      "remaining": 3600,
      "cached": false,
      "expires": 1705934400,
      "timeBlock": {
        "allowed": false,
        "remaining": 0
      }
    }
  },
  "dayTypes": {
    "today": {
      "id": 1,
      "name": "School Day"
    },
    "tomorrow": {
      "id": 1,
      "name": "School Day"
    }
  }
}
```

**Interpretation:**
- `allowed: false` - The activity is NOT permitted
- `remaining: 3600` - Child HAS quota remaining (1 hour)
- `banned: false` - Not banned
- `timeBlock.allowed: false` - BUT current time is outside allowed hours
- This means the child has time remaining but cannot use it now (e.g., it's before/after allowed gaming hours)

### Example 5: Multiple Activities Check

```json
{
  "result": 0,
  "allowed": true,
  "activities": {
    "1": {
      "id": 1,
      "name": "Internet",
      "timed": true,
      "units": "minutes",
      "banned": false,
      "remaining": 7200,
      "cached": false,
      "expires": 1705934400,
      "timeBlock": {
        "allowed": true,
        "remaining": 7200
      }
    },
    "2": {
      "id": 2,
      "name": "Computer",
      "timed": true,
      "units": "minutes",
      "banned": false,
      "remaining": 10800,
      "cached": false,
      "expires": 1705934400,
      "timeBlock": {
        "allowed": true,
        "remaining": 10800
      }
    },
    "3": {
      "id": 3,
      "name": "Gaming",
      "timed": true,
      "units": "minutes",
      "banned": false,
      "remaining": 3600,
      "cached": false,
      "expires": 1705934400,
      "timeBlock": {
        "allowed": true,
        "remaining": 3600
      }
    }
  },
  "dayTypes": {
    "today": {
      "id": 2,
      "name": "Weekend"
    },
    "tomorrow": {
      "id": 1,
      "name": "School Day"
    }
  },
  "allDayTypes": [
    { "id": 1, "name": "School Day" },
    { "id": 2, "name": "Weekend" },
    { "id": 3, "name": "Holiday" },
    { "id": 4, "name": "Vacation" }
  ],
  "children": [
    {
      "id": 1,
      "name": "Emma",
      "pin": "1234",
      "timezone": "America/New_York"
    },
    {
      "id": 2,
      "name": "Lucas",
      "pin": "5678",
      "timezone": "America/New_York"
    }
  ],
  "subscription": {
    "active": true,
    "childLimit": 5,
    "deviceLimit": 10
  }
}
```

---

## Request Payload Format

### Basic Check Request

```json
{
  "userId": 12345,
  "pairId": "ABC123",
  "pairToken": "token_xyz789",
  "deviceToken": "unique-device-identifier",
  "tz": "America/New_York",
  "childId": 1,
  "activities": [
    { "id": 3, "log": true }
  ]
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | number | Yes | User/parent account identifier |
| `pairId` | string | Yes | Device pairing identifier |
| `pairToken` | string | Yes | Device pairing token |
| `deviceToken` | string | Yes | Unique device identifier |
| `tz` | string | Yes | Timezone (IANA format, e.g., "America/New_York") |
| `childId` | number | Yes | Child identifier to check |
| `activities` | array | Yes | Array of activities to check |
| `log` | boolean | No | Whether to log this activity usage (default: true) |

### Activity Request Options

```json
{
  "activities": [
    {
      "id": 3,
      "log": true
    }
  ],
  "timer": "start",
  "autostop": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Activity ID to check |
| `log` | boolean | Whether to log this activity (accumulates time) |
| `timer` | string | Timer control: "start", "stop", or omit |
| `autostop` | boolean | Automatically stop when `allowed` becomes false |

### Continuous Monitoring Mode

For real-time monitoring, use the timer feature:

```json
{
  "userId": 12345,
  "pairId": "ABC123",
  "pairToken": "token_xyz789",
  "deviceToken": "unique-device-identifier",
  "tz": "America/New_York",
  "childId": 1,
  "activities": [
    { "id": 3, "log": true }
  ],
  "timer": "start",
  "autostop": true
}
```

This enables continuous checking that automatically stops when `allowed` becomes false.

---

## Usage in allow2automate

The allow2automate application uses this response structure in several ways:

### Plugin Child State

Plugins access child state via the `allow2.getChildState()` method:

```javascript
// From app/plugins.js
allow2: {
  getChildState: async (childId) => {
    const state = store.getState();
    const child = state.user && state.user.children &&
                  state.user.children.find(c => c.id === childId);
    return child ? {
      paused: child.paused || false,
      quota: child.timeToday || 0
    } : { paused: true, quota: 0 };
  }
}
```

### Device Check Response

The `checkDeviceUsage` function returns:

```javascript
{
  success: true,
  allowed: result.allowed,
  result: result  // Full Allow2 response
}
```

### Decision Logic

Plugins and agents use this data to:
1. Check if `allowed` is true/false
2. Check `activities[id].remaining` for quota
3. Check `activities[id].banned` for explicit bans
4. Check `activities[id].timeBlock.allowed` for time window restrictions
5. Use `dayTypes` to understand schedule context

---

## Error Responses

### Invalid Credentials

```json
{
  "result": 1,
  "error": "Invalid credentials"
}
```

### Invalid Pairing

```json
{
  "result": 2,
  "error": "Device not paired or pairing expired"
}
```

### Rate Limited

```json
{
  "result": 3,
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## References

- [Allow2 Node SDK](https://github.com/Allow2/Allow2node)
- [Allow2 Node-RED](https://github.com/Allow2/allow2nodered)
- [Allow2 Developer Documentation](https://developer.allow2.com)
- [Home Assistant Integration Research](./HA_INTEGRATION_RESEARCH.md)

---

**Document Version:** 1.0
**Last Updated:** January 24, 2026
**Author:** Research Agent
