-- Migration: Add Agent Service Tables
-- Description: Create tables for network device monitoring agents
-- Version: 1.0.0

-- ========================================
-- Agents table
-- ========================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY,
  machine_id VARCHAR(255) UNIQUE NOT NULL,
  child_id UUID REFERENCES children(id),
  hostname VARCHAR(255),
  platform VARCHAR(50),
  version VARCHAR(50),
  auth_token TEXT,
  last_known_ip VARCHAR(45),
  last_heartbeat TIMESTAMP,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  default_child_id UUID REFERENCES children(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE agents IS 'Network monitoring agents installed on client devices';
COMMENT ON COLUMN agents.machine_id IS 'Unique hardware identifier for the device';
COMMENT ON COLUMN agents.child_id IS 'Default child associated with this agent';
COMMENT ON COLUMN agents.last_known_ip IS 'Last known IP address for connection fallback';
COMMENT ON COLUMN agents.last_heartbeat IS 'Last time agent checked in';

-- ========================================
-- Policies table
-- ========================================
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  process_name VARCHAR(255) NOT NULL,
  process_alternatives JSONB DEFAULT '[]'::jsonb,
  allowed BOOLEAN DEFAULT FALSE,
  check_interval INTEGER DEFAULT 30000,
  plugin_name VARCHAR(255),
  category VARCHAR(100) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE policies IS 'Process monitoring policies enforced by agents';
COMMENT ON COLUMN policies.process_name IS 'Primary process name to monitor (e.g., "fortnite.exe")';
COMMENT ON COLUMN policies.process_alternatives IS 'Alternative process names as JSON array';
COMMENT ON COLUMN policies.allowed IS 'Whether the process is currently allowed to run';
COMMENT ON COLUMN policies.check_interval IS 'How often to check in milliseconds';
COMMENT ON COLUMN policies.plugin_name IS 'Plugin that manages this policy (e.g., "fortnite")';

-- ========================================
-- Violations table
-- ========================================
CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
  child_id UUID REFERENCES children(id),
  process_name VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  action_taken VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE violations IS 'Policy violations detected by agents';
COMMENT ON COLUMN violations.action_taken IS 'Action taken (e.g., "process_killed", "notification_sent")';
COMMENT ON COLUMN violations.metadata IS 'Additional violation context as JSON';

-- ========================================
-- Registration codes table
-- ========================================
CREATE TABLE IF NOT EXISTS registration_codes (
  code VARCHAR(6) PRIMARY KEY,
  child_id UUID REFERENCES children(id),
  used BOOLEAN DEFAULT FALSE,
  agent_id UUID REFERENCES agents(id),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE registration_codes IS 'One-time codes for agent registration';
COMMENT ON COLUMN registration_codes.code IS '6-character alphanumeric code';
COMMENT ON COLUMN registration_codes.used IS 'Whether the code has been consumed';

-- ========================================
-- Child mappings table
-- ========================================
CREATE TABLE IF NOT EXISTS child_mappings (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  platform VARCHAR(50),
  username VARCHAR(255),
  child_id UUID REFERENCES children(id),
  confidence VARCHAR(20) DEFAULT 'low',
  auto_discovered BOOLEAN DEFAULT FALSE,
  confirmed_by_parent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE child_mappings IS 'Map OS usernames to children for granular detection';
COMMENT ON COLUMN child_mappings.confidence IS 'Detection confidence: low, medium, high';
COMMENT ON COLUMN child_mappings.auto_discovered IS 'Whether this was automatically detected';
COMMENT ON COLUMN child_mappings.confirmed_by_parent IS 'Whether parent confirmed the mapping';

-- ========================================
-- Agent settings table
-- ========================================
CREATE TABLE IF NOT EXISTS agent_settings (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  static_ip VARCHAR(45),
  auto_update_enabled BOOLEAN DEFAULT TRUE,
  check_interval_ms INTEGER DEFAULT 30000,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE agent_settings IS 'Per-agent configuration settings';
COMMENT ON COLUMN agent_settings.static_ip IS 'User-configured static IP for connection fallback';
COMMENT ON COLUMN agent_settings.settings IS 'Additional settings as JSON';

-- ========================================
-- Indexes for performance
-- ========================================
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

-- ========================================
-- Triggers for updated_at timestamps
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_settings_updated_at BEFORE UPDATE ON agent_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
