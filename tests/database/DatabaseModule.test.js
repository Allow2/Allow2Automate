/**
 * DatabaseModule Auto-Healing Tests
 *
 * Comprehensive test suite for database auto-healing functionality:
 * - Fresh database creation
 * - Missing table detection and healing
 * - Schema validation
 * - Data preservation during healing
 * - Schema version upgrades
 * - Transaction rollback on errors
 */

import Database from 'better-sqlite3';
import { jest } from '@jest/globals';

// Mock electron app module
const mockApp = {
  getPath: jest.fn(() => ':memory:')
};

// Mock modules before importing DatabaseModule
jest.unstable_mockModule('electron', () => ({
  app: mockApp
}));

// Import DatabaseModule after mocking
const { default: DatabaseModule } = await import('../../app/database/DatabaseModule.js');

describe('DatabaseModule Auto-Healing', () => {
  let dbModule;
  let testDb;

  beforeEach(() => {
    // Create fresh DatabaseModule instance for each test
    dbModule = new DatabaseModule();
  });

  afterEach(async () => {
    // Clean up database connections
    if (dbModule && dbModule.db) {
      await dbModule.close();
    }
    if (testDb) {
      testDb.close();
    }
  });

  describe('Schema Validation', () => {
    test('detects missing children table', async () => {
      // Create in-memory database with some tables but not children
      testDb = new Database(':memory:');
      testDb.exec(`
        CREATE TABLE agents (
          id TEXT PRIMARY KEY,
          machine_id TEXT UNIQUE NOT NULL
        );
      `);

      // Manually assign the test db to module
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      const validation = await dbModule.validateSchema();

      expect(validation.isValid).toBe(false);
      expect(validation.missingTables).toContain('children');
      expect(validation.existingTables).toContain('agents');
      expect(validation.existingTables).not.toContain('children');
    });

    test('detects all missing tables on fresh database', async () => {
      // Create completely empty database
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      const validation = await dbModule.validateSchema();
      const schema = dbModule.getRequiredSchema();
      const requiredTables = Object.keys(schema);

      expect(validation.isValid).toBe(false);
      expect(validation.missingTables).toHaveLength(requiredTables.length);
      expect(validation.existingTables).toHaveLength(0);
      expect(validation.totalRequired).toBe(requiredTables.length);

      // Verify all required tables are in missing list
      for (const tableName of requiredTables) {
        expect(validation.missingTables).toContain(tableName);
      }
    });

    test('validates existing schema is correct', async () => {
      // Create database with all required tables
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      const schema = dbModule.getRequiredSchema();

      // Create all tables
      for (const tableName of Object.keys(schema)) {
        testDb.exec(schema[tableName].sql);
        for (const indexSql of schema[tableName].indexes) {
          testDb.exec(indexSql);
        }
      }

      const validation = await dbModule.validateSchema();

      expect(validation.isValid).toBe(true);
      expect(validation.missingTables).toHaveLength(0);
      expect(validation.existingTables).toHaveLength(Object.keys(schema).length);
    });

    test('detects missing multiple tables', async () => {
      // Create database with only some tables
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      testDb.exec(`
        CREATE TABLE children (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        );
        CREATE TABLE agents (
          id TEXT PRIMARY KEY,
          machine_id TEXT UNIQUE NOT NULL
        );
      `);

      const validation = await dbModule.validateSchema();

      expect(validation.isValid).toBe(false);
      expect(validation.existingTables).toContain('children');
      expect(validation.existingTables).toContain('agents');
      expect(validation.missingTables.length).toBeGreaterThan(0);

      // Should be missing: policies, violations, registration_codes, child_mappings, agent_settings
      expect(validation.missingTables).toContain('policies');
      expect(validation.missingTables).toContain('violations');
    });

    test('throws error when database not initialized', async () => {
      dbModule.db = null;

      await expect(dbModule.validateSchema()).rejects.toThrow('Database not initialized');
    });
  });

  describe('Schema Healing', () => {
    test('creates missing children table', async () => {
      // Setup: database without children table
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      const schema = dbModule.getRequiredSchema();

      // Create all tables except children
      for (const tableName of Object.keys(schema)) {
        if (tableName !== 'children') {
          testDb.exec(schema[tableName].sql);
          for (const indexSql of schema[tableName].indexes) {
            testDb.exec(indexSql);
          }
        }
      }

      // Create schema_metadata for version tracking
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '1');
      `);

      const result = await dbModule.healSchema();

      expect(result.healed).toBe(true);
      expect(result.tablesCreated).toContain('children');
      expect(result.tablesCreated).toHaveLength(1);
      expect(result.newVersion).toBe(2);

      // Verify table was actually created
      const tableCheck = testDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='children'"
      ).get();
      expect(tableCheck).toBeDefined();
      expect(tableCheck.name).toBe('children');
    });

    test('preserves existing data during healing', async () => {
      // Setup: database with agents table and data
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      const schema = dbModule.getRequiredSchema();

      // Create only agents table with data
      testDb.exec(schema.agents.sql);
      testDb.exec(`
        INSERT INTO agents (id, machine_id, hostname, platform)
        VALUES
          ('agent-1', 'machine-1', 'test-host-1', 'linux'),
          ('agent-2', 'machine-2', 'test-host-2', 'darwin'),
          ('agent-3', 'machine-3', 'test-host-3', 'win32');
      `);

      // Create schema_metadata
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '1');
      `);

      const result = await dbModule.healSchema();

      expect(result.healed).toBe(true);
      expect(result.tablesCreated.length).toBeGreaterThan(0);

      // Verify existing data is preserved
      const agents = testDb.prepare('SELECT * FROM agents ORDER BY id').all();
      expect(agents).toHaveLength(3);
      expect(agents[0].id).toBe('agent-1');
      expect(agents[0].machine_id).toBe('machine-1');
      expect(agents[0].hostname).toBe('test-host-1');
      expect(agents[1].id).toBe('agent-2');
      expect(agents[2].id).toBe('agent-3');
    });

    test('handles multiple missing tables', async () => {
      // Setup: fresh empty database
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Create only schema_metadata
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '0');
      `);

      const schema = dbModule.getRequiredSchema();
      const requiredTables = Object.keys(schema);

      const result = await dbModule.healSchema();

      expect(result.healed).toBe(true);
      expect(result.tablesCreated).toHaveLength(requiredTables.length);
      expect(result.newVersion).toBe(1);

      // Verify all tables were created
      for (const tableName of requiredTables) {
        expect(result.tablesCreated).toContain(tableName);

        const tableCheck = testDb.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        ).get(tableName);
        expect(tableCheck).toBeDefined();
      }
    });

    test('logs healing operations', async () => {
      // Mock console.log to capture logs
      const originalLog = console.log;
      const logs = [];
      console.log = jest.fn((...args) => logs.push(args.join(' ')));

      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Create schema_metadata
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '0');
      `);

      await dbModule.healSchema();

      // Verify logging occurred
      expect(logs.some(log => log.includes('Starting schema auto-healing'))).toBe(true);
      expect(logs.some(log => log.includes('Healing table:'))).toBe(true);
      expect(logs.some(log => log.includes('✓ Healed table:'))).toBe(true);
      expect(logs.some(log => log.includes('Schema healing completed'))).toBe(true);

      // Restore console.log
      console.log = originalLog;
    });

    test('skips healing when schema is healthy', async () => {
      // Setup: complete database
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      const schema = dbModule.getRequiredSchema();

      // Create all tables
      for (const tableName of Object.keys(schema)) {
        testDb.exec(schema[tableName].sql);
        for (const indexSql of schema[tableName].indexes) {
          testDb.exec(indexSql);
        }
      }

      const result = await dbModule.healSchema();

      expect(result.healed).toBe(false);
      expect(result.tablesCreated).toHaveLength(0);
    });

    test('creates indexes for healed tables', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Create schema_metadata
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '0');
      `);

      await dbModule.healSchema();

      // Verify indexes were created for agents table
      const indexes = testDb.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index'
        AND tbl_name='agents'
        AND name LIKE 'idx_%'
      `).all();

      expect(indexes.length).toBeGreaterThan(0);
      const indexNames = indexes.map(idx => idx.name);
      expect(indexNames).toContain('idx_agents_child_id');
      expect(indexNames).toContain('idx_agents_machine_id');
      expect(indexNames).toContain('idx_agents_last_heartbeat');
    });

    test('handles transaction rollback on error', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Create schema_metadata
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '0');
      `);

      // Mock getRequiredSchema to return invalid SQL
      const originalGetRequiredSchema = dbModule.getRequiredSchema.bind(dbModule);
      dbModule.getRequiredSchema = jest.fn(() => ({
        children: {
          sql: 'CREATE TABLE children (id TEXT PRIMARY KEY);',
          indexes: []
        },
        bad_table: {
          sql: 'INVALID SQL STATEMENT HERE;', // This will cause an error
          indexes: []
        }
      }));

      // Healing should throw error
      await expect(dbModule.healSchema()).rejects.toThrow();

      // Verify no tables were created (transaction was rolled back)
      const childrenCheck = testDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='children'"
      ).get();
      expect(childrenCheck).toBeUndefined();

      // Restore original method
      dbModule.getRequiredSchema = originalGetRequiredSchema;
    });

    test('throws error when database not initialized', async () => {
      dbModule.db = null;

      await expect(dbModule.healSchema()).rejects.toThrow('Database not initialized');
    });
  });

  describe('Upgrade Mechanism', () => {
    test('detects schema version changes', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Initially no version
      let version = dbModule.getSchemaVersion();
      expect(version).toBe(0);

      // Set version
      dbModule.setSchemaVersion(1);
      version = dbModule.getSchemaVersion();
      expect(version).toBe(1);

      // Update version
      dbModule.setSchemaVersion(2);
      version = dbModule.getSchemaVersion();
      expect(version).toBe(2);
    });

    test('increments version after healing', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Create schema_metadata with version 5
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '5');
      `);

      const initialVersion = dbModule.getSchemaVersion();
      expect(initialVersion).toBe(5);

      const result = await dbModule.healSchema();

      expect(result.healed).toBe(true);
      expect(result.newVersion).toBe(6);

      const newVersion = dbModule.getSchemaVersion();
      expect(newVersion).toBe(6);
    });

    test('sets initial schema version on fresh database', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Run migrations on fresh database
      await dbModule.runMigrations();

      const version = dbModule.getSchemaVersion();
      expect(version).toBe(1);
    });

    test('preserves schema version when already set', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Create all tables
      const schema = dbModule.getRequiredSchema();
      for (const tableName of Object.keys(schema)) {
        testDb.exec(schema[tableName].sql);
      }

      // Set version
      dbModule.setSchemaVersion(3);

      // Run migrations (should not reset version)
      await dbModule.runMigrations();

      const version = dbModule.getSchemaVersion();
      expect(version).toBe(3);
    });

    test('updates timestamp when setting version', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      dbModule.setSchemaVersion(1);

      const metadata = testDb.prepare(
        "SELECT key, value, updated_at FROM schema_metadata WHERE key = 'version'"
      ).get();

      expect(metadata.key).toBe('version');
      expect(metadata.value).toBe('1');
      expect(metadata.updated_at).toBeDefined();
      expect(metadata.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}/); // ISO date format
    });

    test('handles partial upgrade failures with rollback', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Create some tables
      testDb.exec(`
        CREATE TABLE children (id TEXT PRIMARY KEY);
        CREATE TABLE agents (id TEXT PRIMARY KEY);
      `);

      // Set version
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '1');
      `);

      const initialVersion = dbModule.getSchemaVersion();

      // Mock to cause failure during healing
      const originalGetRequiredSchema = dbModule.getRequiredSchema.bind(dbModule);
      dbModule.getRequiredSchema = jest.fn(() => ({
        policies: {
          sql: 'CREATE TABLE policies (id TEXT PRIMARY KEY);',
          indexes: []
        },
        violations: {
          sql: 'THIS IS INVALID SQL;',
          indexes: []
        }
      }));

      // Should fail and rollback
      await expect(dbModule.healSchema()).rejects.toThrow();

      // Version should not have changed
      const versionAfterFail = dbModule.getSchemaVersion();
      expect(versionAfterFail).toBe(initialVersion);

      // Policies table should not exist (rollback)
      const policiesCheck = testDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='policies'"
      ).get();
      expect(policiesCheck).toBeUndefined();

      // Restore original method
      dbModule.getRequiredSchema = originalGetRequiredSchema;
    });
  });

  describe('Integration Tests', () => {
    test('full initialize with auto-healing on fresh database', async () => {
      // Use real in-memory database through initialize
      mockApp.getPath.mockReturnValue(':memory:');

      const db = new DatabaseModule();
      await db.initialize();

      const schema = db.getRequiredSchema();
      const requiredTables = Object.keys(schema);

      // Verify all tables exist
      for (const tableName of requiredTables) {
        const tableCheck = db.db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        ).get(tableName);
        expect(tableCheck).toBeDefined();
      }

      // Verify schema version is set
      const version = db.getSchemaVersion();
      expect(version).toBeGreaterThan(0);

      await db.close();
    });

    test('initialize detects and heals missing table', async () => {
      // First create a partial database
      testDb = new Database(':memory:');

      const schema = new DatabaseModule().getRequiredSchema();

      // Create all tables except children
      for (const tableName of Object.keys(schema)) {
        if (tableName !== 'children') {
          testDb.exec(schema[tableName].sql);
        }
      }

      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '1');
      `);

      // Save to a temp file and verify children is missing
      const childrenCheck = testDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='children'"
      ).get();
      expect(childrenCheck).toBeUndefined();

      // Now simulate healing by creating and healing
      const db = new DatabaseModule();
      db.db = testDb;
      db.dbPath = ':memory:';

      await db.validateSchema();
      const healResult = await db.healSchema();

      expect(healResult.healed).toBe(true);
      expect(healResult.tablesCreated).toContain('children');

      // Verify children table now exists
      const childrenCheckAfter = testDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='children'"
      ).get();
      expect(childrenCheckAfter).toBeDefined();
    });

    test('data integrity across healing and queries', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Create schema_metadata
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '0');
      `);

      // Heal to create all tables
      await dbModule.healSchema();

      // Insert test data
      await dbModule.query(
        `INSERT INTO children (id, name) VALUES (?, ?)`,
        ['child-1', 'Test Child']
      );

      await dbModule.query(
        `INSERT INTO agents (id, machine_id, child_id, hostname, platform) VALUES (?, ?, ?, ?, ?)`,
        ['agent-1', 'machine-1', 'child-1', 'test-host', 'linux']
      );

      // Query data back
      const children = await dbModule.query('SELECT * FROM children WHERE id = ?', ['child-1']);
      expect(children).toHaveLength(1);
      expect(children[0].name).toBe('Test Child');

      const agents = await dbModule.query('SELECT * FROM agents WHERE id = ?', ['agent-1']);
      expect(agents).toHaveLength(1);
      expect(agents[0].machine_id).toBe('machine-1');
      expect(agents[0].child_id).toBe('child-1');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty database with no tables at all', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      const validation = await dbModule.validateSchema();

      expect(validation.isValid).toBe(false);
      expect(validation.existingTables).toHaveLength(0);
      expect(validation.missingTables.length).toBeGreaterThan(0);
    });

    test('handles corrupted schema_metadata table', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Create corrupted schema_metadata
      testDb.exec(`
        CREATE TABLE schema_metadata (
          wrong_column TEXT
        );
      `);

      // getSchemaVersion should handle this gracefully
      const version = dbModule.getSchemaVersion();
      expect(version).toBe(0);

      // setSchemaVersion should recreate properly
      dbModule.setSchemaVersion(1);
      const newVersion = dbModule.getSchemaVersion();
      expect(newVersion).toBe(1);
    });

    test('handles concurrent healing attempts', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '0');
      `);

      // Run healing twice - second should be a no-op
      const result1 = await dbModule.healSchema();
      const result2 = await dbModule.healSchema();

      expect(result1.healed).toBe(true);
      expect(result2.healed).toBe(false);
      expect(result2.tablesCreated).toHaveLength(0);
    });

    test('validates foreign key constraints after healing', async () => {
      testDb = new Database(':memory:');
      dbModule.db = testDb;
      dbModule.dbPath = ':memory:';

      // Enable foreign keys
      testDb.pragma('foreign_keys = ON');

      testDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO schema_metadata (key, value) VALUES ('version', '0');
      `);

      await dbModule.healSchema();

      // Insert parent record
      testDb.exec(`
        INSERT INTO agents (id, machine_id) VALUES ('agent-1', 'machine-1');
      `);

      // This should work (valid foreign key)
      testDb.exec(`
        INSERT INTO policies (id, agent_id, process_name, allowed)
        VALUES ('policy-1', 'agent-1', 'test.exe', 1);
      `);

      // This should fail (invalid foreign key)
      expect(() => {
        testDb.exec(`
          INSERT INTO policies (id, agent_id, process_name, allowed)
          VALUES ('policy-2', 'non-existent-agent', 'test.exe', 1);
        `);
      }).toThrow();
    });
  });
});
