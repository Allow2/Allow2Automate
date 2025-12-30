# Agent Service Integration Documentation

## Overview

The Agent Service integration enables allow2automate to monitor and control applications on remote computers in the home network. This feature allows parents to enforce time limits and restrictions on applications running on children's devices, even if those devices are not directly running allow2automate.

## Architecture

### Core Components

1. **AgentService** (`app/services/AgentService.js`)
   - Central orchestrator for agent management
   - Handles agent registration, authentication, and policy distribution
   - Tracks violations and heartbeats
   - Event-driven architecture for real-time updates

2. **AgentDiscovery** (`app/services/AgentDiscovery.js`)
   - mDNS/Bonjour service discovery for local network agents
   - Automatic detection of agents on the network
   - Graceful fallback if mDNS is not available

3. **AgentConnection** (`app/services/AgentConnection.js`)
   - Manages HTTPS connections to individual agents
   - Multi-strategy connection fallback:
     - Last known IP from database
     - mDNS discovery
     - User-configured static IP

4. **AgentUpdateService** (`app/services/AgentUpdateService.js`)
   - Auto-update orchestration for agents
   - Downloads installers from GitHub releases
   - Serves installers to agents via HTTPS
   - Checksum verification

### Supporting Components

5. **Agent API Routes** (`app/routes/agent.js`)
   - Express.js REST API for agent communication
   - JWT authentication for agents
   - Endpoints for registration, policies, violations, heartbeats

6. **Database Schema** (`app/database/migrations/add-agent-tables.sql`)
   - PostgreSQL schema for agent data
   - Tables: agents, policies, violations, registration_codes, child_mappings, agent_settings

7. **UI Component** (`app/components/Settings/AgentManagement.jsx`)
   - Settings panel for agent management
   - Agent list with online/offline status
   - Installer downloads
   - Registration code generation

8. **Redux Integration**
   - Actions: `app/actions/agent.js`
   - Reducer: `app/reducers/agents.js`
   - State management for agent data

## Database Schema

### Tables

#### `agents`
Stores registered network monitoring agents.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| machine_id | VARCHAR(255) | Unique hardware identifier |
| child_id | UUID | Default child associated with agent |
| hostname | VARCHAR(255) | Device hostname |
| platform | VARCHAR(50) | OS platform (win32, darwin, linux) |
| version | VARCHAR(50) | Agent software version |
| auth_token | TEXT | JWT authentication token |
| last_known_ip | VARCHAR(45) | Last known IP for fallback |
| last_heartbeat | TIMESTAMP | Last check-in time |
| registered_at | TIMESTAMP | Registration timestamp |

#### `policies`
Process monitoring policies enforced by agents.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| agent_id | UUID | Foreign key to agents |
| process_name | VARCHAR(255) | Process to monitor |
| process_alternatives | JSONB | Alternative process names |
| allowed | BOOLEAN | Whether process is allowed |
| check_interval | INTEGER | Check interval in milliseconds |
| plugin_name | VARCHAR(255) | Plugin managing this policy |
| category | VARCHAR(100) | Policy category |

#### `violations`
Policy violations detected by agents.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| agent_id | UUID | Foreign key to agents |
| policy_id | UUID | Foreign key to policies |
| child_id | UUID | Foreign key to children |
| process_name | VARCHAR(255) | Violating process |
| timestamp | TIMESTAMP | When violation occurred |
| action_taken | VARCHAR(50) | Action (process_killed, etc.) |
| metadata | JSONB | Additional context |

#### `registration_codes`
One-time codes for agent registration.

| Column | Type | Description |
|--------|------|-------------|
| code | VARCHAR(6) | 6-character alphanumeric code |
| child_id | UUID | Foreign key to children |
| used | BOOLEAN | Whether code has been used |
| agent_id | UUID | Agent that used this code |
| expires_at | TIMESTAMP | Code expiration |

#### `child_mappings`
Maps OS usernames to children for granular detection.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| agent_id | UUID | Foreign key to agents |
| platform | VARCHAR(50) | OS platform |
| username | VARCHAR(255) | OS username |
| child_id | UUID | Foreign key to children |
| confidence | VARCHAR(20) | Detection confidence |
| auto_discovered | BOOLEAN | Auto-detected? |
| confirmed_by_parent | BOOLEAN | Parent confirmed? |

## API Endpoints

### Agent Endpoints (for agent software)

- `POST /api/agent/register` - Register new agent
- `GET /api/agent/policies` - Get policies for authenticated agent
- `POST /api/agent/violations` - Report policy violation
- `POST /api/agent/heartbeat` - Update heartbeat timestamp
- `GET /api/agent/installer/:version/:platform` - Download installer

### Internal Endpoints (for main app)

- `GET /api/agents` - List all registered agents
- `POST /api/agent/policies` - Create policy for agent
- `PATCH /api/agent/policies/:policyId` - Update policy
- `DELETE /api/agent/policies/:policyId` - Delete policy
- `POST /api/agent/registration-code` - Generate registration code

## IPC Handlers

Renderer process can invoke these handlers:

- `agents:list` - Get all agents
- `agents:get` - Get single agent
- `agents:generate-code` - Generate registration code
- `agents:delete` - Delete agent
- `agents:create-policy` - Create policy
- `agents:update-policy` - Update policy
- `agents:delete-policy` - Delete policy
- `agents:get-policies` - Get policies for agent
- `agents:download-installer` - Download installer to Downloads folder
- `agents:installer-versions` - Get available installer versions

## Redux State

### State Shape

```javascript
{
  agents: {
    agents: {
      'agent-id-1': {
        id: 'agent-id-1',
        hostname: 'gaming-pc',
        platform: 'win32',
        version: '1.0.0',
        online: true,
        lastHeartbeat: 1234567890,
        // ...
      }
    },
    policies: {
      'policy-id-1': {
        id: 'policy-id-1',
        agentId: 'agent-id-1',
        processName: 'fortnite.exe',
        allowed: false,
        // ...
      }
    },
    violations: [
      {
        violationId: 'violation-id-1',
        agentId: 'agent-id-1',
        processName: 'fortnite.exe',
        timestamp: 1234567890
      }
    ],
    registrationCodes: {
      'ABC123': {
        childId: 'child-id-1',
        code: 'ABC123',
        used: false,
        expiresAt: 1234567890
      }
    },
    loading: false,
    error: null,
    lastUpdated: 1234567890
  }
}
```

### Actions

- `agentListRequest()` - Start fetching agents
- `agentListSuccess(agents)` - Agents fetched successfully
- `agentListFailure(error)` - Error fetching agents
- `agentRegister(agentInfo)` - Agent registered
- `agentDelete(agentId)` - Agent deleted
- `agentUpdate(agentId, updates)` - Agent updated
- `agentPolicyCreate(agentId, policyConfig)` - Policy created
- `agentPolicyUpdate(policyId, updates)` - Policy updated
- `agentPolicyDelete(policyId)` - Policy deleted
- `agentViolationReceived(violationData)` - Violation received
- `agentHeartbeatUpdate(agentId, metadata)` - Heartbeat updated

## Connection Strategies

The AgentConnection class uses a multi-layered fallback approach:

### Strategy 1: Last Known IP
- Fastest reconnection method
- Uses IP address cached in database from last successful connection
- Updated automatically on each successful connection

### Strategy 2: mDNS Discovery
- Discovers agents via Bonjour/mDNS on local network
- Agents broadcast their presence as `_allow2automate._tcp` services
- Automatic discovery without configuration
- Only works on local network

### Strategy 3: Static IP
- User-configured static IP address
- Stored in `agent_settings` table
- Useful for agents on different subnets or VLANs
- Manual configuration required

## Security

### Authentication
- Agents authenticate using JWT tokens
- Tokens issued during registration and stored securely
- Tokens included in `Authorization: Bearer <token>` header
- 365-day token expiration

### Registration Codes
- 6-character alphanumeric codes
- Single-use only
- 24-hour expiration
- Linked to specific child during generation

### HTTPS
- All agent communication over HTTPS
- Self-signed certificates accepted (local network)
- Certificate pinning could be added for enhanced security

## Event Flow

### Agent Registration
1. Parent generates registration code for child
2. Parent downloads installer for child's platform
3. Installer runs on child's computer
4. Agent prompts for registration code
5. Agent calls `POST /api/agent/register` with code
6. Server validates code, creates agent record, issues JWT
7. Server returns initial policies for the agent
8. Agent starts monitoring processes

### Policy Enforcement
1. Plugin creates policy via `agents:create-policy` IPC
2. AgentService stores policy in database
3. AgentService sends policy to agent via HTTPS
4. Agent monitors process according to policy
5. If process violates policy:
   - Agent kills process
   - Agent reports violation via `POST /api/agent/violations`
   - Server logs violation
   - Server emits event to plugins
   - Parent receives notification

### Heartbeat Monitoring
1. Agent sends heartbeat every 60 seconds
2. Server updates `last_heartbeat` timestamp
3. Server checks for stale agents every 2 minutes
4. Agents with heartbeat > 5 minutes old marked as offline
5. Offline event emitted to plugins

## Plugin Integration

Plugins can interact with agent services through the global context:

```javascript
// In plugin's main process code
const agentService = global.services.agent;

// Create a policy for an agent
await agentService.createPolicy(agentId, {
  processName: 'fortnite.exe',
  alternatives: ['fortniteclient.exe'],
  allowed: false,
  checkInterval: 30000,
  pluginName: 'fortnite',
  category: 'gaming'
});

// Listen for violations
agentService.on('violation', (violationData) => {
  console.log('Violation:', violationData);
  // Take action (log usage, send notification, etc.)
});
```

## Build Process

The build script `scripts/fetch-agent-installers.js` runs before each build:

1. Fetches latest release from GitHub
2. Downloads installers for Windows, macOS, Linux
3. Stores in `resources/agents/` directory
4. Updates `package.json` with bundled version
5. Installers bundled with main application

During runtime:
- AgentUpdateService monitors for new releases
- Downloads installers automatically
- Serves installers to agents on request
- Verifies checksums before serving

## Testing

### Manual Testing
1. Start allow2automate application
2. Navigate to Settings > Agent Management
3. Download installer for your platform
4. Generate registration code
5. Install agent on test machine
6. Enter registration code during installation
7. Verify agent appears in agent list
8. Create test policy
9. Verify agent enforces policy

### Integration Testing
- Test agent registration flow
- Test policy creation and distribution
- Test violation reporting
- Test heartbeat monitoring
- Test connection fallback strategies
- Test installer download and serving

## Troubleshooting

### Agent Not Discovered
- Check mDNS is working on network
- Verify firewall allows mDNS (port 5353 UDP)
- Try static IP configuration
- Check agent logs for errors

### Agent Offline
- Check agent is running
- Verify network connectivity
- Check last heartbeat timestamp
- Verify agent has valid auth token

### Policy Not Enforced
- Verify policy was sent to agent
- Check agent logs for policy reception
- Verify process name is correct
- Check check_interval is reasonable

### Connection Issues
- Verify HTTPS port 8443 is accessible
- Check firewall rules
- Verify SSL certificate acceptance
- Try static IP if mDNS fails

## Future Enhancements

### Planned Features
- [ ] Real-time process list from agents
- [ ] Remote desktop control integration
- [ ] Screenshot capture on violations
- [ ] Application whitelisting/blacklisting
- [ ] Time-based policies (only allow at certain times)
- [ ] Network traffic monitoring
- [ ] Parental notification system
- [ ] Multi-child support per agent
- [ ] Agent health dashboard
- [ ] Policy templates library

### Scalability
- [ ] Database migration to SQLite/PostgreSQL
- [ ] Agent clustering for large deployments
- [ ] Cloud sync for policies
- [ ] Mobile app for remote management
- [ ] WebSocket for real-time updates

## Contributing

When contributing to agent services:

1. Follow existing code patterns
2. Add comprehensive error handling
3. Log important events with `[AgentService]` prefix
4. Update this documentation for new features
5. Add database migrations for schema changes
6. Test with multiple platforms (Windows, macOS, Linux)
7. Consider backwards compatibility with older agents

## License

Same license as allow2automate main application.
