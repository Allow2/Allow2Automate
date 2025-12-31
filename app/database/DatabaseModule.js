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

      // Run migrations
      await this.runMigrations();

      return this;
    } catch (error) {
      console.error('[DatabaseModule] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    // For SQLite, we need to adapt the PostgreSQL migration
    // SQLite doesn't support some PostgreSQL features like UUID type, JSONB, etc.

    // Create agents table
    this.db.exec(`
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
    `);

    // Create policies table
    this.db.exec(`
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
    `);

    // Create violations table
    this.db.exec(`
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
    `);

    // Create registration_codes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS registration_codes (
        code TEXT PRIMARY KEY,
        child_id TEXT,
        used INTEGER DEFAULT 0,
        agent_id TEXT REFERENCES agents(id),
        expires_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Create child_mappings table
    this.db.exec(`
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
    `);

    // Create agent_settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_settings (
        agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
        static_ip TEXT,
        auto_update_enabled INTEGER DEFAULT 1,
        check_interval_ms INTEGER DEFAULT 30000,
        settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agents_child_id ON agents(child_id);
      CREATE INDEX IF NOT EXISTS idx_agents_machine_id ON agents(machine_id);
      CREATE INDEX IF NOT EXISTS idx_agents_last_heartbeat ON agents(last_heartbeat);

      CREATE INDEX IF NOT EXISTS idx_policies_agent_id ON policies(agent_id);
      CREATE INDEX IF NOT EXISTS idx_policies_plugin_name ON policies(plugin_name);

      CREATE INDEX IF NOT EXISTS idx_violations_agent_id ON violations(agent_id);
      CREATE INDEX IF NOT EXISTS idx_violations_child_id ON violations(child_id);
      CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_registration_codes_child_id ON registration_codes(child_id);
      CREATE INDEX IF NOT EXISTS idx_registration_codes_expires_at ON registration_codes(expires_at);

      CREATE INDEX IF NOT EXISTS idx_child_mappings_agent_id ON child_mappings(agent_id);
      CREATE INDEX IF NOT EXISTS idx_child_mappings_child_id ON child_mappings(child_id);
    `);

    console.log('[DatabaseModule] Migrations completed');
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
      // Convert PostgreSQL-style placeholders ($1, $2) to SQLite-style (?, ?)
      const sqliteSql = sql.replace(/\$\d+/g, '?');

      // Handle NOW() and CURRENT_TIMESTAMP for SQLite
      const finalSql = sqliteSql
        .replace(/NOW\(\)/gi, "datetime('now')")
        .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");

      if (finalSql.trim().toUpperCase().startsWith('SELECT')) {
        // For SELECT queries, return all rows
        const stmt = this.db.prepare(finalSql);
        return stmt.all(...params);
      } else {
        // For INSERT/UPDATE/DELETE, execute and return info
        const stmt = this.db.prepare(finalSql);
        const info = stmt.run(...params);
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
      // Convert PostgreSQL-style placeholders to SQLite-style
      const sqliteSql = sql.replace(/\$\d+/g, '?');

      // Handle NOW() and CURRENT_TIMESTAMP
      const finalSql = sqliteSql
        .replace(/NOW\(\)/gi, "datetime('now')")
        .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");

      const stmt = this.db.prepare(finalSql);
      return stmt.get(...params) || null;
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
