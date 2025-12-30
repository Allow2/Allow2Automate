# Child Detection System - Testing Guide

## Overview

Comprehensive testing strategy for the three-tier child detection system.

## Test Environment Setup

### Agent Test Environment

```bash
# Install test dependencies
cd /mnt/ai/automate/allow2automate-agent
npm install --save-dev jest @types/jest

# Create test directory structure
mkdir -p tests/detectors
mkdir -p tests/services
mkdir -p tests/fixtures
```

### Parent Test Environment

```bash
# Install test dependencies
cd /mnt/ai/automate/automate
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# Create test directory structure
mkdir -p tests/child-detection
mkdir -p tests/components
mkdir -p tests/api
```

## Test Data Fixtures

### Steam loginusers.vdf (Mock)

**File:** `/mnt/ai/automate/allow2automate-agent/tests/fixtures/loginusers.vdf`

```vdf
"users"
{
  "76561198012345678"
  {
    "AccountName"       "player123"
    "PersonaName"       "CoolGamer42"
    "RememberPassword"  "1"
    "MostRecent"        "1"
    "Timestamp"         "1735520400"
  }
  "76561198087654321"
  {
    "AccountName"       "emma_plays"
    "PersonaName"       "Emma"
    "RememberPassword"  "1"
    "MostRecent"        "0"
    "Timestamp"         "1735434000"
  }
}
```

### Epic GameUserSettings.ini (Mock)

**File:** `/mnt/ai/automate/allow2automate-agent/tests/fixtures/GameUserSettings.ini`

```ini
[/Script/UnrealEngine.GameUserSettings]
LastConfirmedUserEmail=emma@example.com
AccountId=a1b2c3d4e5f6g7h8i9j0
ResolutionSizeX=1920
ResolutionSizeY=1080
```

### Battle.net.config (Mock)

**File:** `/mnt/ai/automate/allow2automate-agent/tests/fixtures/Battle.net.config`

```json
{
  "Client": {
    "SavedAccountNames": [
      "CoolPlayer#1234",
      "EpicGamer#5678"
    ],
    "LastSelectedAccountName": "CoolPlayer#1234"
  },
  "Games": {
    "wow_enus": {
      "LastPlayed": "1735520400"
    }
  }
}
```

## Unit Tests - Platform Detectors

### Steam User Detector Tests

**File:** `/mnt/ai/automate/allow2automate-agent/tests/detectors/steam.test.js`

```javascript
const SteamUserDetector = require('../../src/detectors/SteamUserDetector');
const fs = require('fs').promises;
const path = require('path');

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectUser', () => {
    test('should detect user with MostRecent = 1', async () => {
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

    test('should detect user with highest timestamp when no MostRecent', async () => {
      const mockVDF = `
"users"
{
  "76561198012345678"
  {
    "AccountName"     "player123"
    "Timestamp"       "1735520400"
  }
  "76561198087654321"
  {
    "AccountName"     "emma_plays"
    "Timestamp"       "1735606800"
  }
}
      `;

      fs.readFile.mockResolvedValue(mockVDF);

      const result = await detector.detectUser();

      expect(result.username).toBe('emma_plays');
    });

    test('should handle missing file gracefully', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await detector.detectUser();

      expect(result.username).toBeNull();
    });

    test('should handle permission denied', async () => {
      fs.readFile.mockRejectedValue({ code: 'EACCES' });

      await expect(detector.detectUser()).rejects.toThrow();
    });

    test('should handle malformed VDF', async () => {
      fs.readFile.mockResolvedValue('invalid vdf content');

      const result = await detector.detectUser();

      expect(result.username).toBeNull();
    });
  });

  describe('getAllUsers', () => {
    test('should return all Steam users', async () => {
      const mockVDF = `
"users"
{
  "76561198012345678"
  {
    "AccountName"     "player123"
    "PersonaName"     "CoolGamer"
    "Timestamp"       "1735520400"
  }
  "76561198087654321"
  {
    "AccountName"     "emma_plays"
    "PersonaName"     "Emma"
    "Timestamp"       "1735434000"
  }
}
      `;

      fs.readFile.mockResolvedValue(mockVDF);

      const result = await detector.getAllUsers();

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('player123');
      expect(result[1].username).toBe('emma_plays');
    });

    test('should return empty array if file missing', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await detector.getAllUsers();

      expect(result).toEqual([]);
    });
  });

  describe('parseVDF', () => {
    test('should parse valid VDF correctly', () => {
      const vdf = `
"users"
{
  "76561198012345678"
  {
    "AccountName"     "player123"
    "PersonaName"     "CoolGamer"
  }
}
      `;

      const result = detector.parseVDF(vdf);

      expect(result['76561198012345678'].AccountName).toBe('player123');
      expect(result['76561198012345678'].PersonaName).toBe('CoolGamer');
    });

    test('should handle empty VDF', () => {
      const result = detector.parseVDF('');

      expect(result).toEqual({});
    });
  });
});
```

### Epic User Detector Tests

**File:** `/mnt/ai/automate/allow2automate-agent/tests/detectors/epic.test.js`

```javascript
const EpicUserDetector = require('../../src/detectors/EpicUserDetector');
const fs = require('fs').promises;

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

describe('EpicUserDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new EpicUserDetector({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectUser', () => {
    test('should detect Epic user from INI file', async () => {
      const mockINI = `
[/Script/UnrealEngine.GameUserSettings]
LastConfirmedUserEmail=emma@example.com
AccountId=abc123xyz
      `;

      fs.readFile.mockResolvedValue(mockINI);

      const result = await detector.detectUser();

      expect(result.email).toBe('emma@example.com');
      expect(result.accountId).toBe('abc123xyz');
      expect(result.emailHash).toBeTruthy();
    });

    test('should hash email correctly', async () => {
      const email = 'emma@example.com';
      const expectedHash = detector.hashEmail(email);

      const mockINI = `LastConfirmedUserEmail=${email}`;
      fs.readFile.mockResolvedValue(mockINI);

      const result = await detector.detectUser();

      expect(result.emailHash).toBe(expectedHash);
    });

    test('should handle missing file', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await detector.detectUser();

      expect(result.email).toBeNull();
    });
  });

  describe('hashEmail', () => {
    test('should generate consistent hash', () => {
      const hash1 = detector.hashEmail('test@example.com');
      const hash2 = detector.hashEmail('test@example.com');

      expect(hash1).toBe(hash2);
    });

    test('should be case-insensitive', () => {
      const hash1 = detector.hashEmail('TEST@EXAMPLE.COM');
      const hash2 = detector.hashEmail('test@example.com');

      expect(hash1).toBe(hash2);
    });

    test('should produce different hashes for different emails', () => {
      const hash1 = detector.hashEmail('alice@example.com');
      const hash2 = detector.hashEmail('bob@example.com');

      expect(hash1).not.toBe(hash2);
    });
  });
});
```

### Battle.net Detector Tests

**File:** `/mnt/ai/automate/allow2automate-agent/tests/detectors/battlenet.test.js`

```javascript
const BattlenetUserDetector = require('../../src/detectors/BattlenetUserDetector');
const fs = require('fs').promises;

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

describe('BattlenetUserDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new BattlenetUserDetector({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectUser', () => {
    test('should detect Battle.net user from config', async () => {
      const mockConfig = {
        Client: {
          SavedAccountNames: ['Player#1234', 'Gamer#5678'],
          LastSelectedAccountName: 'Player#1234'
        }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await detector.detectUser();

      expect(result.username).toBe('Player#1234');
      expect(result.savedAccounts).toEqual(['Player#1234', 'Gamer#5678']);
    });

    test('should handle missing config file', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await detector.detectUser();

      expect(result.username).toBeNull();
    });

    test('should handle invalid JSON', async () => {
      fs.readFile.mockResolvedValue('invalid json');

      const result = await detector.detectUser();

      expect(result.username).toBeNull();
    });

    test('should return null on Linux (unsupported)', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });

      const detector = new BattlenetUserDetector({});
      const result = await detector.detectUser();

      expect(result.username).toBeNull();
    });
  });

  describe('getAllUsers', () => {
    test('should return all saved accounts', async () => {
      const mockConfig = {
        Client: {
          SavedAccountNames: ['Player#1234', 'Gamer#5678']
        }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await detector.getAllUsers();

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('Player#1234');
      expect(result[1].username).toBe('Gamer#5678');
    });
  });
});
```

## Unit Tests - OS Detectors

### Windows OS Detector Tests

**File:** `/mnt/ai/automate/allow2automate-agent/tests/detectors/windows-os.test.js`

```javascript
const WindowsOSDetector = require('../../src/detectors/WindowsOSDetector');
const { exec } = require('child_process');

jest.mock('child_process');

describe('WindowsOSDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new WindowsOSDetector();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserForProcess', () => {
    test('should extract username from tasklist output', async () => {
      const mockOutput = '"Steam.exe","5432","Console","1","156,432 K","Running","DESKTOP-PC\\Emma","0:00:15","Steam"';

      exec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: mockOutput });
      });

      const result = await detector.getUserForProcess(5432);

      expect(result.username).toBe('Emma');
      expect(result.fullUsername).toBe('DESKTOP-PC\\Emma');
      expect(result.method).toBe('windows-tasklist');
    });

    test('should handle process not found', async () => {
      exec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: '' });
      });

      const result = await detector.getUserForProcess(9999);

      expect(result.username).toBeNull();
    });

    test('should handle command error', async () => {
      exec.mockImplementation((cmd, callback) => {
        callback(new Error('Command failed'));
      });

      const result = await detector.getUserForProcess(5432);

      expect(result.username).toBeNull();
    });
  });

  describe('getAllUsers', () => {
    test('should parse net user output', async () => {
      const mockOutput = `
User accounts for \\\\DESKTOP-PC

-------------------------------------------------------------------------------
Administrator            Emma                     Guest
Lucas
The command completed successfully.
      `;

      exec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: mockOutput });
      });

      const result = await detector.getAllUsers();

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(u => u.username === 'Emma')).toBe(true);
      expect(result.some(u => u.username === 'Lucas')).toBe(true);
    });
  });
});
```

## Unit Tests - Child Detector Service

**File:** `/mnt/ai/automate/allow2automate-agent/tests/services/child-detector.test.js`

```javascript
const ChildDetector = require('../../src/services/ChildDetector');

describe('ChildDetector', () => {
  let detector;
  let mockConfig;
  let mockApiClient;
  let mockSteamDetector;
  let mockOSDetector;

  beforeEach(() => {
    mockConfig = {
      agentId: 'agent-123',
      defaultChildId: 'child-default'
    };

    mockApiClient = {
      get: jest.fn(),
      post: jest.fn()
    };

    mockSteamDetector = {
      detectUser: jest.fn(),
      getAllUsers: jest.fn()
    };

    mockOSDetector = {
      getUserForProcess: jest.fn(),
      getAllUsers: jest.fn()
    };

    detector = new ChildDetector(mockConfig, mockApiClient);
    detector.platformDetectors.steam = mockSteamDetector;
    detector.osDetector = mockOSDetector;
  });

  describe('detectChild', () => {
    test('should use Tier 1 (platform-specific) when available', async () => {
      mockSteamDetector.detectUser.mockResolvedValue({
        username: 'player123'
      });

      mockApiClient.get.mockResolvedValue({
        data: {
          found: true,
          childId: 'child-emma',
          confidence: 0.95
        }
      });

      const result = await detector.detectChild({
        name: 'Steam.exe',
        pid: 1234
      });

      expect(result.childId).toBe('child-emma');
      expect(result.tier).toBe(1);
      expect(result.confidence).toBe(0.95);
      expect(result.method).toBe('steam-config');
    });

    test('should fallback to Tier 2 (OS-level) when Tier 1 fails', async () => {
      mockSteamDetector.detectUser.mockResolvedValue({
        username: null
      });

      mockOSDetector.getUserForProcess.mockResolvedValue({
        username: 'Emma',
        method: 'windows-tasklist'
      });

      mockApiClient.get.mockResolvedValue({
        data: {
          found: true,
          childId: 'child-emma',
          confidence: 0.75
        }
      });

      const result = await detector.detectChild({
        name: 'Steam.exe',
        pid: 1234
      });

      expect(result.childId).toBe('child-emma');
      expect(result.tier).toBe(2);
      expect(result.confidence).toBe(0.75);
    });

    test('should fallback to Tier 3 (device default) when all else fails', async () => {
      mockSteamDetector.detectUser.mockResolvedValue({ username: null });
      mockOSDetector.getUserForProcess.mockResolvedValue({ username: null });

      const result = await detector.detectChild({
        name: 'Steam.exe',
        pid: 1234
      });

      expect(result.childId).toBe('child-default');
      expect(result.tier).toBe(3);
      expect(result.confidence).toBe(0.50);
      expect(result.method).toBe('device-default');
    });

    test('should log detection event', async () => {
      mockSteamDetector.detectUser.mockResolvedValue({ username: null });
      mockOSDetector.getUserForProcess.mockResolvedValue({ username: null });

      await detector.detectChild({
        name: 'Steam.exe',
        pid: 1234
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/detection-logs',
        expect.objectContaining({
          agentId: 'agent-123',
          processName: 'Steam.exe',
          processPid: 1234
        })
      );
    });
  });

  describe('identifyPlatform', () => {
    test('should identify Steam', () => {
      expect(detector.identifyPlatform('Steam.exe')).toBe('steam');
      expect(detector.identifyPlatform('steamwebhelper.exe')).toBe('steam');
    });

    test('should identify Epic', () => {
      expect(detector.identifyPlatform('EpicGamesLauncher.exe')).toBe('epic');
    });

    test('should identify Battle.net', () => {
      expect(detector.identifyPlatform('Battle.net.exe')).toBe('battlenet');
    });

    test('should return null for unknown', () => {
      expect(detector.identifyPlatform('notepad.exe')).toBeNull();
    });
  });
});
```

## Unit Tests - Parent Side

### Child Mapping Service Tests

**File:** `/mnt/ai/automate/automate/tests/child-detection/mapping-service.test.js`

```javascript
const ChildMappingService = require('../../app/services/ChildMappingService');

describe('ChildMappingService', () => {
  let service;
  let mockDb;

  beforeEach(() => {
    mockDb = jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      merge: jest.fn().mockResolvedValue([{ id: 'mapping-1' }]),
      where: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([]),
      first: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1)
    }));

    service = new ChildMappingService(mockDb);
  });

  describe('createMapping', () => {
    test('should create mapping with correct confidence', async () => {
      await service.createMapping({
        agentId: 'agent-1',
        platform: 'steam',
        username: 'player123',
        childId: 'child-1',
        confirmedByParent: true
      });

      expect(mockDb().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'steam',
          username: 'player123',
          confidence: 1.0
        })
      );
    });

    test('should hash Epic emails', async () => {
      await service.createMapping({
        agentId: 'agent-1',
        platform: 'epic',
        username: 'emma@example.com',
        childId: 'child-1'
      });

      expect(mockDb().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          username_hash: expect.any(String)
        })
      );
    });
  });

  describe('queryMapping', () => {
    test('should find existing mapping', async () => {
      mockDb().first.mockResolvedValue({
        id: 'mapping-1',
        child_id: 'child-emma',
        confidence: 0.95,
        confirmed_by_parent: true
      });

      const result = await service.queryMapping('steam', 'player123', 'agent-1');

      expect(result.found).toBe(true);
      expect(result.childId).toBe('child-emma');
      expect(result.confidence).toBe(0.95);
    });

    test('should return not found for missing mapping', async () => {
      mockDb().first.mockResolvedValue(null);

      const result = await service.queryMapping('steam', 'unknown', 'agent-1');

      expect(result.found).toBe(false);
    });

    test('should update last_used timestamp', async () => {
      mockDb().first.mockResolvedValue({
        id: 'mapping-1',
        child_id: 'child-emma',
        confidence: 0.95
      });

      await service.queryMapping('steam', 'player123', 'agent-1');

      expect(mockDb().update).toHaveBeenCalledWith(
        expect.objectContaining({
          last_used: expect.any(Date)
        })
      );
    });
  });

  describe('suggestMappings', () => {
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
      expect(suggestions[0].platform).toBe('steam');
      expect(suggestions[0].suggestedChildId).toBe('child-1');
      expect(suggestions[1].platform).toBe('os');
      expect(suggestions[1].suggestedChildId).toBe('child-1');
    });

    test('should be case-insensitive', () => {
      const discovered = {
        steam: [{ username: 'EMMA_PLAYS' }]
      };

      const children = [
        { id: 'child-1', name: 'Emma' }
      ];

      const suggestions = service.suggestMappings(discovered, children);

      expect(suggestions).toHaveLength(1);
    });

    test('should not suggest if no match', () => {
      const discovered = {
        steam: [{ username: 'random_user' }]
      };

      const children = [
        { id: 'child-1', name: 'Emma' }
      ];

      const suggestions = service.suggestMappings(discovered, children);

      expect(suggestions).toHaveLength(0);
    });
  });

  describe('calculateConfidence', () => {
    test('should return 1.0 for confirmed Steam mapping', () => {
      const confidence = service.calculateConfidence('steam', true);
      expect(confidence).toBe(1.0);
    });

    test('should return 0.95 for unconfirmed Steam mapping', () => {
      const confidence = service.calculateConfidence('steam', false);
      expect(confidence).toBe(0.95);
    });

    test('should return 0.75 for unconfirmed OS mapping', () => {
      const confidence = service.calculateConfidence('os-user', false);
      expect(confidence).toBe(0.75);
    });
  });
});
```

## Integration Tests

**File:** `/mnt/ai/automate/automate/tests/child-detection/integration.test.js`

```javascript
const request = require('supertest');
const app = require('../../app');

describe('Child Detection Integration', () => {
  let agentId;
  let childId;

  beforeAll(async () => {
    // Setup test data
    agentId = await createTestAgent();
    childId = await createTestChild('Emma');
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestData();
  });

  describe('End-to-End Detection Flow', () => {
    test('should create mapping and query it successfully', async () => {
      // 1. Create mapping
      const createResponse = await request(app)
        .post('/api/child-mappings')
        .send({
          agentId,
          platform: 'steam',
          username: 'player123',
          childId,
          confirmedByParent: true
        });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body.success).toBe(true);

      // 2. Query mapping (as agent would)
      const queryResponse = await request(app)
        .get('/api/child-mappings/query')
        .query({
          platform: 'steam',
          username: 'player123',
          agentId
        });

      expect(queryResponse.status).toBe(200);
      expect(queryResponse.body.found).toBe(true);
      expect(queryResponse.body.childId).toBe(childId);
      expect(queryResponse.body.confidence).toBeGreaterThan(0.9);
    });

    test('should auto-discover users from agent', async () => {
      // Mock agent response
      mockAgentDiscovery({
        steam: [{ username: 'emma_plays', personaName: 'Emma' }],
        os: [{ username: 'Emma' }]
      });

      const response = await request(app)
        .post(`/api/agents/${agentId}/discover-users`);

      expect(response.status).toBe(200);
      expect(response.body.discovered.steam).toHaveLength(1);
      expect(response.body.suggestedMappings).toHaveLength(2);
    });

    test('should set and retrieve device default', async () => {
      // Set default
      await request(app)
        .put(`/api/agents/${agentId}/default-child`)
        .send({ childId });

      // Get mappings (includes default)
      const response = await request(app)
        .get('/api/child-mappings')
        .query({ agentId });

      expect(response.body.deviceDefault.childId).toBe(childId);
    });
  });

  describe('Plugin Integration', () => {
    test('should detect child and enforce quota for Steam', async () => {
      // Create mapping
      await createMapping(agentId, 'steam', 'player123', childId);

      // Simulate Steam process detection
      const processEvent = {
        processName: 'Steam.exe',
        processPid: 1234,
        agentId
      };

      // Trigger plugin handler
      const result = await pluginHandler.onProcessDetected(processEvent);

      expect(result.detectedChild).toBe(childId);
      expect(result.action).toBe('allow');  // Assuming child has quota
    });
  });
});
```

## Manual Testing Checklist

### Steam Detection (Tier 1)

- [ ] Install Steam on Windows
- [ ] Login with test account
- [ ] Verify `loginusers.vdf` file exists
- [ ] Run detector, verify username extracted
- [ ] Create mapping in UI
- [ ] Start Steam, verify detection log shows correct child
- [ ] Switch Steam account, verify new child detected

### Epic Detection (Tier 1)

- [ ] Install Epic Games Launcher
- [ ] Login with test account
- [ ] Verify config file exists
- [ ] Run detector, verify email extracted (or hashed)
- [ ] Create mapping
- [ ] Start Epic, verify correct child detected

### OS-Level Detection (Tier 2)

**Windows:**
- [ ] Login as different Windows user
- [ ] Start gaming process
- [ ] Verify OS username detected via tasklist
- [ ] Create OS-user mapping
- [ ] Verify correct child detected

**macOS:**
- [ ] Login as different macOS user
- [ ] Start gaming process
- [ ] Verify username detected via ps
- [ ] Create mapping and test

**Linux:**
- [ ] Login as different Linux user
- [ ] Start Steam or other process
- [ ] Verify username detected via ps
- [ ] Create mapping and test

### Device Default (Tier 3)

- [ ] Remove all platform and OS mappings
- [ ] Set device default child
- [ ] Start any process
- [ ] Verify device default child is used
- [ ] Verify confidence score is 0.50

### UI Testing

- [ ] Navigate to Settings → Child Mapping
- [ ] Click "Scan for Users"
- [ ] Verify discovered users displayed
- [ ] Map username to child via dropdown
- [ ] Verify mapping appears in list with green checkmark
- [ ] Delete mapping, verify removed
- [ ] Set device default, verify saved
- [ ] Check confidence indicators (🟢🟡⚪)

### Performance Testing

- [ ] Measure detection time (should be < 300ms)
- [ ] Test with 100+ mappings in database
- [ ] Verify no memory leaks during continuous detection
- [ ] Test concurrent detections (multiple processes)

## Automated Test Execution

### Run All Tests

```bash
# Agent-side tests
cd /mnt/ai/automate/allow2automate-agent
npm test

# Parent-side tests
cd /mnt/ai/automate/automate
npm test

# Integration tests
npm run test:integration
```

### Test Coverage

```bash
# Generate coverage report
npm test -- --coverage

# Coverage targets:
# - Statements: > 80%
# - Branches: > 75%
# - Functions: > 80%
# - Lines: > 80%
```

### Continuous Integration

**GitHub Actions Workflow:**

```yaml
name: Child Detection Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [16, 18, 20]

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node }}

      - name: Install dependencies (agent)
        working-directory: ./allow2automate-agent
        run: npm ci

      - name: Run agent tests
        working-directory: ./allow2automate-agent
        run: npm test

      - name: Install dependencies (parent)
        working-directory: ./automate
        run: npm ci

      - name: Run parent tests
        working-directory: ./automate
        run: npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Troubleshooting Test Failures

### Common Issues

**Issue:** Steam detector can't find config file
**Solution:**
- Mock the file path in tests
- Use test fixtures
- Check platform-specific paths

**Issue:** OS detector fails on CI
**Solution:**
- Mock child_process.exec
- Use platform-specific mocks
- Skip platform-specific tests on wrong OS

**Issue:** Integration tests timeout
**Solution:**
- Increase timeout: `jest.setTimeout(10000)`
- Mock external API calls
- Use test database with minimal data

## Test Metrics & Goals

### Code Coverage Goals

- **Unit Tests:** > 85% coverage
- **Integration Tests:** > 70% coverage
- **Critical Paths:** 100% coverage (detection flow, mapping CRUD)

### Performance Benchmarks

- Detection: < 300ms (95th percentile)
- API response: < 200ms (95th percentile)
- UI render: < 100ms (child mapping component)

### Quality Metrics

- Zero critical bugs in production
- < 5% false positive rate (wrong child detected)
- > 90% detection success rate (child identified)

## Conclusion

This comprehensive testing guide ensures the child detection system is robust, reliable, and performs well across all supported platforms. Follow the test execution plan systematically, and maintain high code coverage to catch regressions early.
