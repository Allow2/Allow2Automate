# Child Detection System - Implementation Plan

## Overview

This document provides a step-by-step implementation plan for the three-tier child detection system.

## Project Structure

```
/mnt/ai/automate/
├── automate/                           # Parent application
│   ├── app/
│   │   ├── components/
│   │   │   └── Settings/
│   │   │       └── ChildMapping.jsx    # UI component
│   │   ├── services/
│   │   │   └── ChildMappingService.js  # Business logic
│   │   └── api/
│   │       └── routes/
│   │           └── child-mappings.js   # API endpoints
│   ├── docs/
│   │   └── research/
│   │       ├── child-detection-architecture.md
│   │       └── child-detection-implementation-plan.md
│   └── tests/
│       └── child-detection/
│           ├── mapping-service.test.js
│           └── api.test.js
│
└── allow2automate-agent/              # Agent application
    ├── src/
    │   ├── services/
    │   │   └── ChildDetector.js        # Main detector service
    │   ├── detectors/
    │   │   ├── SteamUserDetector.js    # Steam platform
    │   │   ├── EpicUserDetector.js     # Epic Games platform
    │   │   ├── BattlenetUserDetector.js # Battle.net platform
    │   │   ├── WindowsOSDetector.js    # Windows OS
    │   │   ├── MacOSOSDetector.js      # macOS OS
    │   │   └── LinuxOSDetector.js      # Linux OS
    │   └── api/
    │       └── routes/
    │           └── platform-users.js    # Agent API endpoints
    └── tests/
        └── detectors/
            ├── steam.test.js
            ├── epic.test.js
            ├── battlenet.test.js
            └── os-detectors.test.js
```

## Phase 1: Database Schema (Week 1)

### Task 1.1: Create Migration Files

**File:** `/mnt/ai/automate/automate/app/migrations/20250130_add_child_mappings.js`

```javascript
exports.up = function(knex) {
  return knex.schema
    // Create child_mappings table
    .createTable('child_mappings', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('agent_id').references('id').inTable('agents').onDelete('CASCADE');
      table.string('platform', 50).notNullable();
      table.string('username', 255).notNullable();
      table.string('username_hash', 64);
      table.uuid('child_id').notNullable().references('id').inTable('children').onDelete('CASCADE');
      table.decimal('confidence', 3, 2);
      table.boolean('auto_discovered').defaultTo(false);
      table.boolean('confirmed_by_parent').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('last_used');

      // Indexes
      table.index(['platform', 'username'], 'idx_platform_username');
      table.index(['agent_id', 'platform'], 'idx_agent_platform');
      table.index('child_id', 'idx_child_id');

      // Unique constraint
      table.unique(['agent_id', 'platform', 'username']);
    })

    // Add columns to agents table
    .table('agents', function(table) {
      table.uuid('default_child_id').references('id').inTable('children');
      table.boolean('child_detection_enabled').defaultTo(true);
      table.string('child_detection_method', 50).defaultTo('auto');
    })

    // Create detection_logs table
    .createTable('detection_logs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('agent_id').notNullable().references('id').inTable('agents');
      table.string('process_name', 255);
      table.integer('process_pid');
      table.uuid('detected_child_id').references('id').inTable('children');
      table.string('detection_method', 50);
      table.decimal('confidence', 3, 2);
      table.string('platform_username', 255);
      table.string('os_username', 255);
      table.integer('tier_used');
      table.text('fallback_reason');
      table.timestamp('timestamp').defaultTo(knex.fn.now());

      // Indexes
      table.index(['agent_id', 'timestamp'], 'idx_agent_timestamp');
      table.index(['detected_child_id', 'timestamp'], 'idx_child_timestamp');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('detection_logs')
    .table('agents', function(table) {
      table.dropColumn('default_child_id');
      table.dropColumn('child_detection_enabled');
      table.dropColumn('child_detection_method');
    })
    .dropTableIfExists('child_mappings');
};
```

### Task 1.2: Run Migrations

```bash
cd /mnt/ai/automate/automate
npm run migrate
```

## Phase 2: Agent-Side Implementation (Week 2-3)

### Task 2.1: Implement Platform Detectors

**Priority Order:**
1. SteamUserDetector (most common)
2. WindowsOSDetector (most common OS)
3. EpicUserDetector
4. MacOSOSDetector
5. LinuxOSDetector
6. BattlenetUserDetector

**Implementation:**
- Create each detector in `/mnt/ai/automate/allow2automate-agent/src/detectors/`
- Write unit tests for each detector
- Test with mock config files

### Task 2.2: Implement ChildDetector Service

**File:** `/mnt/ai/automate/allow2automate-agent/src/services/ChildDetector.js`

**Key Methods:**
- `detectChild(processInfo)` - Main detection flow
- `queryMapping(platform, username)` - Query parent API
- `discoverUsers()` - Auto-discover all platform users

### Task 2.3: Add Agent API Endpoints

**File:** `/mnt/ai/automate/allow2automate-agent/src/api/routes/platform-users.js`

```javascript
const express = require('express');
const router = express.Router();

// Get discovered platform users
router.get('/platform-users', async (req, res) => {
  try {
    const childDetector = req.app.get('childDetector');
    const discovered = await childDetector.discoverUsers();

    res.json({
      success: true,
      discovered
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user for a specific process
router.get('/process/:pid/user', async (req, res) => {
  try {
    const childDetector = req.app.get('childDetector');
    const processInfo = await getProcessInfo(req.params.pid);
    const detection = await childDetector.detectChild(processInfo);

    res.json({
      success: true,
      detection
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

### Task 2.4: Integrate with Existing Agent

**File:** `/mnt/ai/automate/allow2automate-agent/src/index.js` (modify)

```javascript
const ChildDetector = require('./services/ChildDetector');
const platformUsersRoutes = require('./api/routes/platform-users');

// Initialize child detector
const childDetector = new ChildDetector(config, apiClient);
app.set('childDetector', childDetector);

// Add API routes
app.use('/api', platformUsersRoutes);

// Inject child detector into process monitoring
processMonitor.on('processDetected', async (processInfo) => {
  const detection = await childDetector.detectChild(processInfo);

  // Emit enhanced event with child detection
  eventEmitter.emit('processDetectedWithChild', {
    ...processInfo,
    childDetection: detection
  });
});
```

## Phase 3: Parent-Side API (Week 4)

### Task 3.1: Implement ChildMappingService

**File:** `/mnt/ai/automate/automate/app/services/ChildMappingService.js`

```javascript
const crypto = require('crypto');

class ChildMappingService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create or update a child mapping
   */
  async createMapping({ agentId, platform, username, childId, confirmedByParent = false }) {
    // Hash email if Epic platform
    const usernameHash = platform === 'epic'
      ? crypto.createHash('sha256').update(username.toLowerCase()).digest('hex')
      : null;

    const confidence = this.calculateConfidence(platform, confirmedByParent);

    return await this.db('child_mappings')
      .insert({
        agent_id: agentId,
        platform,
        username,
        username_hash: usernameHash,
        child_id: childId,
        confidence,
        confirmed_by_parent: confirmedByParent,
        last_used: new Date()
      })
      .onConflict(['agent_id', 'platform', 'username'])
      .merge(['child_id', 'confirmed_by_parent', 'confidence', 'last_used']);
  }

  /**
   * Get all mappings for an agent
   */
  async getMappings(agentId) {
    const mappings = await this.db('child_mappings')
      .leftJoin('children', 'child_mappings.child_id', 'children.id')
      .where('child_mappings.agent_id', agentId)
      .select(
        'child_mappings.*',
        'children.name as child_name'
      );

    return mappings;
  }

  /**
   * Query mapping for a specific platform/username
   */
  async queryMapping(platform, username, agentId) {
    const mapping = await this.db('child_mappings')
      .where({
        agent_id: agentId,
        platform,
        username
      })
      .first();

    if (mapping) {
      // Update last_used timestamp
      await this.db('child_mappings')
        .where('id', mapping.id)
        .update({ last_used: new Date() });

      return {
        found: true,
        childId: mapping.child_id,
        confidence: parseFloat(mapping.confidence),
        confirmedByParent: mapping.confirmed_by_parent
      };
    }

    return { found: false };
  }

  /**
   * Delete a mapping
   */
  async deleteMapping(mappingId) {
    return await this.db('child_mappings')
      .where('id', mappingId)
      .delete();
  }

  /**
   * Set device default child
   */
  async setDeviceDefault(agentId, childId) {
    return await this.db('agents')
      .where('id', agentId)
      .update({ default_child_id: childId });
  }

  /**
   * Get device default child
   */
  async getDeviceDefault(agentId) {
    const agent = await this.db('agents')
      .leftJoin('children', 'agents.default_child_id', 'children.id')
      .where('agents.id', agentId)
      .select('children.id', 'children.name')
      .first();

    return agent || null;
  }

  /**
   * Log a detection event
   */
  async logDetection(logData) {
    return await this.db('detection_logs').insert(logData);
  }

  /**
   * Calculate confidence based on platform and confirmation
   */
  calculateConfidence(platform, confirmedByParent) {
    const baseConfidence = {
      steam: 0.95,
      epic: 0.95,
      battlenet: 0.95,
      'os-user': 0.75
    };

    let confidence = baseConfidence[platform] || 0.50;

    if (confirmedByParent) {
      confidence = Math.min(1.0, confidence + 0.05);
    }

    return confidence;
  }

  /**
   * Auto-suggest mappings based on username similarity
   */
  suggestMappings(discoveredUsers, children) {
    const suggestions = [];

    for (const [platform, users] of Object.entries(discoveredUsers)) {
      for (const user of users) {
        const username = user.username || user.email || '';

        // Simple heuristic: check if username contains child's name
        for (const child of children) {
          if (username.toLowerCase().includes(child.name.toLowerCase())) {
            suggestions.push({
              platform,
              username,
              suggestedChildId: child.id,
              suggestedChildName: child.name,
              reason: `Username contains "${child.name}"`
            });
          }
        }
      }
    }

    return suggestions;
  }
}

module.exports = ChildMappingService;
```

### Task 3.2: Create API Routes

**File:** `/mnt/ai/automate/automate/app/api/routes/child-mappings.js`

```javascript
const express = require('express');
const router = express.Router();
const ChildMappingService = require('../../services/ChildMappingService');

const mappingService = new ChildMappingService(req.app.get('db'));

// Get mappings for an agent
router.get('/', async (req, res) => {
  try {
    const { agentId } = req.query;
    const mappings = await mappingService.getMappings(agentId);
    const deviceDefault = await mappingService.getDeviceDefault(agentId);

    res.json({
      success: true,
      mappings,
      deviceDefault
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Query specific mapping (used by agent)
router.get('/query', async (req, res) => {
  try {
    const { platform, username, agentId } = req.query;
    const result = await mappingService.queryMapping(platform, username, agentId);

    res.json(result);
  } catch (error) {
    res.status(500).json({ found: false, error: error.message });
  }
});

// Create/update mapping
router.post('/', async (req, res) => {
  try {
    const mapping = await mappingService.createMapping(req.body);

    res.json({
      success: true,
      mapping
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete mapping
router.delete('/:id', async (req, res) => {
  try {
    await mappingService.deleteMapping(req.params.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set device default child
router.put('/agents/:agentId/default-child', async (req, res) => {
  try {
    await mappingService.setDeviceDefault(req.params.agentId, req.body.childId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Auto-discover users on agent
router.post('/agents/:agentId/discover-users', async (req, res) => {
  try {
    // Call agent API to discover users
    const agentClient = req.app.get('agentClient');
    const discovered = await agentClient.get(`/api/platform-users`, {
      agentId: req.params.agentId
    });

    // Get children for suggestions
    const children = await req.app.get('db')('children')
      .where('parent_id', req.user.id)
      .select('id', 'name');

    const suggestions = mappingService.suggestMappings(discovered.data.discovered, children);

    res.json({
      success: true,
      discovered: discovered.data.discovered,
      suggestedMappings: suggestions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Log detection event (called by agent)
router.post('/detection-logs', async (req, res) => {
  try {
    await mappingService.logDetection(req.body);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

## Phase 4: Parent UI (Week 5)

### Task 4.1: Create ChildMapping Component

**File:** `/mnt/ai/automate/automate/app/components/Settings/ChildMapping.jsx`

(See architecture document for full implementation)

### Task 4.2: Integrate into Settings Page

**File:** `/mnt/ai/automate/automate/app/components/Settings/index.jsx` (modify)

```javascript
import ChildMapping from './ChildMapping';

// Add tab or section for child mapping
<Tabs>
  <Tab label="Devices" />
  <Tab label="Child Mapping" />
</Tabs>

<TabPanel value={activeTab} index={1}>
  <ChildMapping agentId={selectedAgent.id} children={children} />
</TabPanel>
```

## Phase 5: Plugin Integration (Week 6)

### Task 5.1: Update Steam Plugin

**File:** `/mnt/ai/automate/automate/dev-plugins/steam/src/index.js`

See architecture document for implementation.

### Task 5.2: Update Epic Games Plugin (if exists)

Similar pattern to Steam plugin.

### Task 5.3: Update Battle.net Plugin (if exists)

Similar pattern to Steam plugin.

## Phase 6: Testing (Week 7)

### Task 6.1: Unit Tests - Agent Side

**File:** `/mnt/ai/automate/allow2automate-agent/tests/detectors/steam.test.js`

```javascript
const SteamUserDetector = require('../../src/detectors/SteamUserDetector');
const fs = require('fs').promises;

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

describe('SteamUserDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new SteamUserDetector({});
  });

  test('should detect most recent Steam user', async () => {
    const mockVDF = `
"users"
{
  "76561198012345678"
  {
    "AccountName"     "player123"
    "PersonaName"     "CoolGamer"
    "MostRecent"      "1"
    "Timestamp"       "1735520400"
  }
}
    `;

    fs.readFile.mockResolvedValue(mockVDF);

    const result = await detector.detectUser();

    expect(result.username).toBe('player123');
    expect(result.personaName).toBe('CoolGamer');
  });

  test('should handle missing file gracefully', async () => {
    fs.readFile.mockRejectedValue({ code: 'ENOENT' });

    const result = await detector.detectUser();

    expect(result.username).toBeNull();
  });
});
```

### Task 6.2: Unit Tests - Parent Side

**File:** `/mnt/ai/automate/automate/tests/child-detection/mapping-service.test.js`

```javascript
const ChildMappingService = require('../../app/services/ChildMappingService');

describe('ChildMappingService', () => {
  let service;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      merge: jest.fn().mockResolvedValue([{ id: 'mapping-1' }]),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([]),
      first: jest.fn().mockResolvedValue(null)
    };

    service = new ChildMappingService(mockDb);
  });

  test('should create mapping with correct confidence', async () => {
    await service.createMapping({
      agentId: 'agent-1',
      platform: 'steam',
      username: 'player123',
      childId: 'child-1',
      confirmedByParent: true
    });

    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'steam',
        username: 'player123',
        confidence: 1.0  // 0.95 base + 0.05 confirmed
      })
    );
  });

  test('should suggest mappings based on username similarity', () => {
    const discovered = {
      steam: [{ username: 'emma_plays' }],
      os: [{ username: 'Emma' }]
    };

    const children = [
      { id: 'child-1', name: 'Emma' },
      { id: 'child-2', name: 'Lucas' }
    ];

    const suggestions = service.suggestMappings(discovered, children);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].suggestedChildId).toBe('child-1');
  });
});
```

### Task 6.3: Integration Tests

**File:** `/mnt/ai/automate/automate/tests/child-detection/integration.test.js`

```javascript
describe('Child Detection Integration', () => {
  test('should detect child from Steam and enforce quota', async () => {
    // 1. Create mock mapping
    await createMapping({
      platform: 'steam',
      username: 'player123',
      childId: 'emma'
    });

    // 2. Simulate Steam process start
    const processEvent = {
      processName: 'Steam.exe',
      processPid: 1234,
      agentId: 'agent-1'
    };

    // 3. Trigger detection
    const detection = await childDetector.detectChild(processEvent);

    // 4. Verify correct child detected
    expect(detection.childId).toBe('emma');
    expect(detection.tier).toBe(1);
    expect(detection.confidence).toBeGreaterThan(0.9);

    // 5. Verify quota check
    const quotaResult = await enforceQuota(detection.childId);
    expect(quotaResult.action).toBe('allow');  // assuming Emma has quota
  });
});
```

## Phase 7: Documentation (Week 8)

### Task 7.1: User Guide

Create `/mnt/ai/automate/automate/docs/user-guide/child-mapping.md`:

```markdown
# Child Mapping User Guide

## Setting Up Child Detection

1. Go to Settings → Child Mapping
2. Select the device (agent)
3. Click "Scan for Users"
4. Map discovered usernames to your children
5. Set a device default as fallback

## Best Practices

- Use platform-specific mappings (Steam, Epic) for highest accuracy
- Confirm auto-discovered mappings
- Set device defaults for single-child households
- Check detection logs if child is detected incorrectly
```

### Task 7.2: Developer Guide

Create `/mnt/ai/automate/automate/docs/developer-guide/child-detection.md`:

```markdown
# Child Detection Developer Guide

## Adding a New Platform Detector

1. Create detector class in `agent/src/detectors/`
2. Implement `detectUser()` and `getAllUsers()` methods
3. Register in `ChildDetector.platformDetectors`
4. Add platform to `identifyPlatform()` method
5. Write unit tests

## Example:

```javascript
class OriginUserDetector {
  async detectUser() {
    // Parse Origin config files
    return { username: '...' };
  }
}
```
```

## Testing Checklist

### Agent-Side Testing

- [ ] Steam detector works on Windows
- [ ] Steam detector works on macOS
- [ ] Steam detector works on Linux
- [ ] Epic detector works on Windows
- [ ] Battle.net detector works on Windows
- [ ] Windows OS detector works
- [ ] macOS OS detector works
- [ ] Linux OS detector works
- [ ] Fallback to Tier 2 when Tier 1 fails
- [ ] Fallback to Tier 3 when Tier 2 fails
- [ ] Detection logging works
- [ ] Agent API endpoints work

### Parent-Side Testing

- [ ] Create mapping API works
- [ ] Query mapping API works
- [ ] Delete mapping API works
- [ ] Set device default API works
- [ ] Auto-discovery API works
- [ ] Detection log API works
- [ ] UI displays mappings correctly
- [ ] UI allows creating mappings
- [ ] UI allows deleting mappings
- [ ] UI allows setting device default

### Integration Testing

- [ ] Steam plugin uses child detection
- [ ] Epic plugin uses child detection (if exists)
- [ ] Quota enforcement works per-child
- [ ] Notifications sent to correct child
- [ ] Time tracking logs correct child
- [ ] Multiple children on same device work
- [ ] Child switching detected correctly

## Deployment Plan

### Pre-Deployment

1. Backup existing database
2. Test migrations on staging environment
3. Verify agent compatibility (all platforms)

### Deployment Steps

1. Deploy parent-side changes:
   - Run database migrations
   - Deploy API changes
   - Deploy UI changes
2. Deploy agent-side changes:
   - Update agent package
   - Test on one device first
   - Roll out to all devices
3. Enable child detection:
   - Gradual rollout (10% → 50% → 100%)
   - Monitor error rates

### Post-Deployment

1. Monitor detection logs for errors
2. Collect user feedback
3. Adjust confidence scoring if needed
4. Add new platforms based on demand

## Rollback Plan

If issues occur:

1. Disable child detection via feature flag:
   ```javascript
   agents.child_detection_enabled = false
   ```
2. Revert to device-level quota enforcement
3. Rollback database migrations (run `.down()`)
4. Investigate and fix issues
5. Re-deploy when ready

## Success Metrics

### Week 1-2 (Initial Rollout)

- Detection success rate > 80%
- API response time < 300ms
- Zero database errors

### Month 1

- 50%+ of users have configured mappings
- 90%+ detection success rate
- < 1% false positive rate (wrong child detected)

### Month 3

- 80%+ of users have configured mappings
- 95%+ detection success rate
- User satisfaction score > 4.0/5.0

## Support Plan

### Common Issues

**Issue:** "Child detection not working"
**Solution:**
1. Check agent version (must be >= 2.0.0)
2. Verify mappings exist
3. Check detection logs for errors
4. Ensure agent has file read permissions

**Issue:** "Wrong child detected"
**Solution:**
1. Check which tier was used (logs)
2. Verify mapping is correct
3. Update mapping if needed
4. Consider using higher-tier detection

**Issue:** "Steam user not found"
**Solution:**
1. Verify Steam is installed
2. Check Steam config path
3. Ensure user has logged into Steam
4. Manually create mapping

## Future Enhancements (Backlog)

- [ ] GOG Galaxy support
- [ ] Ubisoft Connect support
- [ ] Origin support
- [ ] Xbox app support
- [ ] Behavioral learning (ML)
- [ ] Biometric detection
- [ ] Active challenge verification
- [ ] Multi-device correlation
- [ ] Auto-mapping based on play history

## Conclusion

This implementation plan provides a structured approach to building the child detection system. Follow the phases sequentially, testing thoroughly at each stage. Prioritize Steam and Windows support first (most common), then expand to other platforms.

Estimated total development time: 8 weeks
Estimated testing time: 2 weeks
Total: 10 weeks (2.5 months)
