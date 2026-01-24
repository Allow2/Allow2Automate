/**
 * Database Module - SQLite database for agent management
 *
 * Uses better-sqlite3 for synchronous SQLite operations
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export default class DatabaseModule {
  constructor() {
    this.db = null;
    this.dbPath = null;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    try {
      // Get database path
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'allow2automate.db');

      // Ensure directory exists
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

      // Open database
      this.db = new Database(this.dbPath);

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      console.log(`[DatabaseModule] Opened database at ${this.dbPath}`);

      // Validate and heal schema before running migrations
      await this.validateSchema();
      await this.healSchema();

      // Run migrations
      await this.runMigrations();

      return this;
    } catch (error) {
      console.error('[DatabaseModule] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Get schema version from database
   */
  getSchemaVersion() {
    try {
      const result = this.db.prepare("SELECT value FROM schema_metadata WHERE key = 'version'").get();
      return result ? parseInt(result.value, 10) : 0;
    } catch (error) {
      // Table doesn't exist yet
      return 0;
    }
  }

  /**
   * Set schema version in database
   */
  setSchemaVersion(version) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO schema_metadata (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
    `);
    stmt.run('version', version.toString());
  }

  /**
   * Define all required tables with their schemas
   */
  getRequiredSchema() {
    return {
      children: {
        sql: `
          CREATE TABLE IF NOT EXISTS children (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
        `,
        indexes: []
      },
      agents: {
        sql: `
          CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            machine_id TEXT UNIQUE NOT NULL,
            child_id TEXT,
            hostname TEXT,
            platform TEXT,
            version TEXT,
            auth_token TEXT,
            last_known_ip TEXT,
            last_heartbeat TEXT,
            registered_at TEXT DEFAULT (datetime('now')),
            default_child_id TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
          );
        `,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_agents_child_id ON agents(child_id);',
          'CREATE INDEX IF NOT EXISTS idx_agents_machine_id ON agents(machine_id);',
          'CREATE INDEX IF NOT EXISTS idx_agents_last_heartbeat ON agents(last_heartbeat);'
        ]
      },
      policies: {
        sql: `
          CREATE TABLE IF NOT EXISTS policies (
            id TEXT PRIMARY KEY,
            agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
            process_name TEXT NOT NULL,
            process_alternatives TEXT DEFAULT '[]',
            allowed INTEGER DEFAULT 0,
            check_interval INTEGER DEFAULT 30000,
            plugin_name TEXT,
            category TEXT DEFAULT 'general',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
        `,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_policies_agent_id ON policies(agent_id);',
          'CREATE INDEX IF NOT EXISTS idx_policies_plugin_name ON policies(plugin_name);'
        ]
      },
      violations: {
        sql: `
          CREATE TABLE IF NOT EXISTS violations (
            id TEXT PRIMARY KEY,
            agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
            policy_id TEXT REFERENCES policies(id) ON DELETE SET NULL,
            child_id TEXT,
            process_name TEXT,
            timestamp TEXT DEFAULT (datetime('now')),
            action_taken TEXT,
            metadata TEXT DEFAULT '{}'
          );
        `,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_violations_agent_id ON violations(agent_id);',
          'CREATE INDEX IF NOT EXISTS idx_violations_child_id ON violations(child_id);',
          'CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp DESC);'
        ]
      },
      registration_codes: {
        sql: `
          CREATE TABLE IF NOT EXISTS registration_codes (
            code TEXT PRIMARY KEY,
            child_id TEXT,
            used INTEGER DEFAULT 0,
            agent_id TEXT REFERENCES agents(id),
            expires_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          );
        `,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_registration_codes_child_id ON registration_codes(child_id);',
          'CREATE INDEX IF NOT EXISTS idx_registration_codes_expires_at ON registration_codes(expires_at);'
        ]
      },
      child_mappings: {
        sql: `
          CREATE TABLE IF NOT EXISTS child_mappings (
            id TEXT PRIMARY KEY,
            agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
            platform TEXT,
            username TEXT,
            child_id TEXT,
            confidence TEXT DEFAULT 'low',
            auto_discovered INTEGER DEFAULT 0,
            confirmed_by_parent INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            last_used TEXT,
            metadata TEXT DEFAULT '{}'
          );
        `,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_child_mappings_agent_id ON child_mappings(agent_id);',
          'CREATE INDEX IF NOT EXISTS idx_child_mappings_child_id ON child_mappings(child_id);'
        ]
      },
      agent_settings: {
        sql: `
          CREATE TABLE IF NOT EXISTS agent_settings (
            agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
            static_ip TEXT,
            auto_update_enabled INTEGER DEFAULT 1,
            check_interval_ms INTEGER DEFAULT 30000,
            settings TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
        `,
        indexes: []
      },
      agent_user_sessions: {
        sql: `
          CREATE TABLE IF NOT EXISTS agent_user_sessions (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
            username TEXT NOT NULL,
            user_id TEXT,
            account_name TEXT,
            session_start TEXT,
            last_seen TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
        `,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_agent_user_sessions_agent_id ON agent_user_sessions(agent_id);',
          'CREATE INDEX IF NOT EXISTS idx_agent_user_sessions_is_active ON agent_user_sessions(is_active);',
          'CREATE INDEX IF NOT EXISTS idx_agent_user_sessions_last_seen ON agent_user_sessions(last_seen DESC);'
        ]
      },
      pending_agent_tokens: {
        sql: `
          CREATE TABLE IF NOT EXISTS pending_agent_tokens (
            id TEXT PRIMARY KEY,
            auth_token TEXT UNIQUE NOT NULL,
            child_id TEXT,
            platform TEXT,
            version TEXT,
            parent_api_url TEXT,
            expires_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          );
        `,
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_pending_agent_tokens_auth_token ON pending_agent_tokens(auth_token);',
          'CREATE INDEX IF NOT EXISTS idx_pending_agent_tokens_expires_at ON pending_agent_tokens(expires_at);'
        ]
      }
    };
  }

  /**
   * Validate that all required tables exist
   * Returns an object with validation results
   */
  async validateSchema() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const schema = this.getRequiredSchema();
    const missingTables = [];
    const existingTables = [];

    console.log('[DatabaseModule] Validating schema...');

    // Check each required table
    for (const tableName of Object.keys(schema)) {
      const result = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).get(tableName);

      if (result) {
        existingTables.push(tableName);
      } else {
        missingTables.push(tableName);
        console.warn(`[DatabaseModule] Missing table: ${tableName}`);
      }
    }

    const isValid = missingTables.length === 0;

    console.log(`[DatabaseModule] Schema validation: ${isValid ? 'PASSED' : 'FAILED'}`);
    console.log(`[DatabaseModule] Existing tables: ${existingTables.length}/${Object.keys(schema).length}`);

    if (missingTables.length > 0) {
      console.log(`[DatabaseModule] Missing tables: ${missingTables.join(', ')}`);
    }

    return {
      isValid,
      missingTables,
      existingTables,
      totalRequired: Object.keys(schema).length
    };
  }

  /**
   * Auto-heal missing tables without data loss
   * Creates missing tables and indexes
   */
  async healSchema() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const validation = await this.validateSchema();

    if (validation.isValid) {
      console.log('[DatabaseModule] Schema is healthy, no healing needed');
      return { healed: false, tablesCreated: [] };
    }

    console.log('[DatabaseModule] Starting schema auto-healing...');

    const schema = this.getRequiredSchema();
    const healedTables = [];

    // Begin transaction for atomic healing
    const transaction = this.db.transaction(() => {
      for (const tableName of validation.missingTables) {
        try {
          console.log(`[DatabaseModule] Healing table: ${tableName}`);

          // Create the table
          this.db.exec(schema[tableName].sql);

          // Create indexes for the table
          for (const indexSql of schema[tableName].indexes) {
            this.db.exec(indexSql);
          }

          healedTables.push(tableName);
          console.log(`[DatabaseModule] ✓ Healed table: ${tableName}`);
        } catch (error) {
          console.error(`[DatabaseModule] Failed to heal table ${tableName}:`, error);
          throw error; // Will trigger rollback
        }
      }
    });

    try {
      transaction();
      console.log(`[DatabaseModule] Schema healing completed. Healed ${healedTables.length} tables: ${healedTables.join(', ')}`);

      // Update schema version after successful healing
      const currentVersion = this.getSchemaVersion();
      this.setSchemaVersion(currentVersion + 1);

      return {
        healed: true,
        tablesCreated: healedTables,
        newVersion: currentVersion + 1
      };
    } catch (error) {
      console.error('[DatabaseModule] Schema healing failed, transaction rolled back:', error);
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    // For SQLite, we need to adapt the PostgreSQL migration
    // SQLite doesn't support some PostgreSQL features like UUID type, JSONB, etc.

    const schema = this.getRequiredSchema();

    // Create all tables (using IF NOT EXISTS for safety)
    for (const tableName of Object.keys(schema)) {
      this.db.exec(schema[tableName].sql);
    }

    // Create all indexes
    for (const tableName of Object.keys(schema)) {
      for (const indexSql of schema[tableName].indexes) {
        this.db.exec(indexSql);
      }
    }

    // Set initial schema version if not set
    const currentVersion = this.getSchemaVersion();
    if (currentVersion === 0) {
      this.setSchemaVersion(1);
      console.log('[DatabaseModule] Initial schema version set to 1');
    }

    console.log('[DatabaseModule] Migrations completed');
  }

  /**
   * Sanitize parameters for SQLite (convert Date objects to ISO strings)
   */
  sanitizeParams(params) {
    return params.map(param => {
      if (param instanceof Date) {
        return param.toISOString();
      }
      return param;
    });
  }

  /**
   * Execute a query with parameters
   * For INSERT, UPDATE, DELETE statements
   */
  async query(sql, params = []) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Sanitize parameters (convert Date objects to ISO strings)
      const sanitizedParams = this.sanitizeParams(params);

      // Convert PostgreSQL-style placeholders ($1, $2) to SQLite-style (?, ?)
      const sqliteSql = sql.replace(/\$\d+/g, '?');

      // Handle NOW() and CURRENT_TIMESTAMP for SQLite
      const finalSql = sqliteSql
        .replace(/NOW\(\)/gi, "datetime('now')")
        .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");

      if (finalSql.trim().toUpperCase().startsWith('SELECT')) {
        // For SELECT queries, return all rows
        const stmt = this.db.prepare(finalSql);
        return stmt.all(...sanitizedParams);
      } else {
        // For INSERT/UPDATE/DELETE, execute and return info
        const stmt = this.db.prepare(finalSql);
        const info = stmt.run(...sanitizedParams);
        return {
          rowCount: info.changes,
          lastInsertRowid: info.lastInsertRowid
        };
      }
    } catch (error) {
      console.error('[DatabaseModule] Query error:', error);
      console.error('[DatabaseModule] SQL:', sql);
      console.error('[DatabaseModule] Params:', params);
      throw error;
    }
  }

  /**
   * Query a single row
   */
  async queryOne(sql, params = []) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Sanitize parameters (convert Date objects to ISO strings)
      const sanitizedParams = this.sanitizeParams(params);

      // Convert PostgreSQL-style placeholders to SQLite-style
      const sqliteSql = sql.replace(/\$\d+/g, '?');

      // Handle NOW() and CURRENT_TIMESTAMP
      const finalSql = sqliteSql
        .replace(/NOW\(\)/gi, "datetime('now')")
        .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");

      const stmt = this.db.prepare(finalSql);
      return stmt.get(...sanitizedParams) || null;
    } catch (error) {
      console.error('[DatabaseModule] QueryOne error:', error);
      throw error;
    }
  }

  /**
   * Begin a transaction
   */
  async beginTransaction() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.exec('BEGIN TRANSACTION');

    return {
      commit: async () => {
        this.db.exec('COMMIT');
      },
      rollback: async () => {
        this.db.exec('ROLLBACK');
      }
    };
  }

  /**
   * Execute raw SQL (for migrations, etc.)
   */
  exec(sql) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db.exec(sql);
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[DatabaseModule] Database connection closed');
    }
  }
}
