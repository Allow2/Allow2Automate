# Allow2Automate Ecosystem Brief

## Overview

This project is the main app - an Electron desktop application that allows users to link Allow2 parental control service with other services and machines.

## Project Structure (Relative Paths)

```
../ (parent directory)
├── automate/              # THIS PROJECT - Main Electron app
├── allow2automate-agent/  # Remote process monitoring service
├── plugins/               # Plugin repositories (each is separate git repo)
│   ├── allow2automate-steam/
│   ├── allow2automate-epic/
│   ├── allow2automate-xbox/
│   ├── allow2automate-wemo/
│   └── ... (13+ plugins)
├── registry/              # Plugin marketplace registry
└── docs/                  # Shared documentation
```

## Important project concepts

### 1. This is an optional app that users of the Allow2 platform can download and run on a machine in their network to extend the reach and capability of Allow2.
### 2. Although it is essential "Parental Controls" we avoid the name "Control" in favour of terms like "Parental Freedom" and teaching kids responsibility.
### 3. This allow2automate app (and any of the plugins) do NOT implement changes to calendar controls, quotas, etc. It exclusively uses plugins to integrate external systems with the Allow2 platform with the barest minimal configuration possible. Plugins largely ONLY need to understand:
- the Allow2 child account (if any) that is being used (mapping from the device account or game app account),
- the type of activity that is being undertaken (internet, computer, gaming...)
- sending usage to the Allow2 platform based on those parameters (if relevant)
- forwarding information about the current status of the activity type, bans, remaining quota, etc to the agent side component.
- agents are optional, the plugin may not need one (such as if the plugin just connects to an internet service) but when present, the agent side component of a plugin makes the decision, based on last known quota, bans, etc for any child account to run scripts to perform actions like providing a countdown warning, logging a user out, blocking a port or app, etc.
- the agent can have 1 or 2 parts, a mandatory configuration component, which is allow2automate app side and should only provide Allow2 child account mapping capabilities (using a standard interface) and provide the conduit for comms between the agent (or directly - if no agent is required), and provide some plugin-specific controls like default values, etc.
- if there is an agent component to a plugin, it makes more sense for plugin programmers to put the logic on the agent end so it can run as autonomously (offline) as possible.
For instance: The allow2automate agent by default returns information like the current logged in user(s) with active sessions, and the list of known users on that device. The plugin configuration for allow2automate-operating-system can therefore do minimal work, all it needs to do is map the accounts that are child accounts on the device to Allow2 "child" accounts, use those to monitor and log usage to the Allow2 platform, provide the right actions on the plugin agent side scripts to perform actions like locking screen or logging out and preventing login or displaying warnings, and use changes in quota or bans in the Allow2 platform to trigger those actions in the agent side scripts.

### 4. As much of the capability should be in the main app and agent as possible. For instance:
- there shold be a standard account mapping component that can be reused by all plugins, so they can simply provide a list of "things" and the main allow2automate app should do the work to put that in a standard interface (table?) and when the user changes the child assignment, it returns that to the plugin, so it knows which child to map to that "thing".
- The current remaining quotas for all activities and children should be pull-through cached and rate limited by the allw2automate process and also pull cached as they update (incremental) to any agent(s) - so plugins make a check or log activity, that flows through the app and the app makes calls to Allow2. The returned updated quotas/bans/etc are cached on the app and used from there. If an agent plugin component has asked for that, or needs it, it is pull cached (and rate limited) to the agent for ANY and ALL plugins to use as well.

## Key Projects

### 1. Main App (this directory)
- **Tech**: Electron, React, Redux, Material-UI v5, Node.js
- **Purpose**: Parent-facing desktop app for managing parental controls
- **Key dirs**: `app/` (source), `docs/` (extensive documentation)
- **Dev plugins**: `dev-plugins/` symlinked from `../plugins/`
- **Discovery by agents**: mDNS service type `_allow2._tcp`

### 2. Agent (`../allow2automate-agent`)
- **Tech**: Node.js, Express, JWT, mDNS/Bonjour
- **Purpose**: System service installed on children's devices
- **Features**: Process monitoring (30s interval), policy enforcement, REST API (port 8443)
- **Platforms**: Windows (tasklist/taskkill), macOS/Linux (pgrep/pkill)
- **Auth**: JWT tokens issued during registration

### 3. Registry (`../registry`)
- **Purpose**: Plugin marketplace with GitHub as single source of truth
- **Key file**: `build-registry.js` - auto-builds `plugins.json` from GitHub releases
- **Design**: Minimal plugin JSON (3 fields) + package.json metadata

### 4. Plugins (`../plugins/`)
- **Available**: Steam, Epic, Xbox, PlayStation, Nintendo Switch, Battle.net, Wemo, Home Assistant, CMD, OS, Web Browsers, Microsoft Family, Google Family Link
- **Execution**: Renderer process (UI) or Main process (system ops)
- **Main process flag**: `requiresMainProcess: true` in exports

## Architecture Flow

```
┌──────────────────┐      REST API       ┌──────────────────┐
│   Main App       │◄────────────────────│     Agent        │
│   (Parent PC)    │     (JWT auth)      │   (Child PC)     │
│                  │                     │                  │
│ • Plugin host    │     mDNS discovery  │ • ProcessMonitor │
│ • Agent mgmt     │◄────────────────────│ • PolicyEngine   │
│ • Allow2 sync    │    _allow2._tcp     │ • AutoUpdater    │
└──────────────────┘                     └──────────────────┘
```

## Plugin Development Essentials

```javascript
// Minimal plugin structure
module.exports = {
    plugin,                    // Factory function
    TabContent,                // React UI component
    requiresMainProcess: true  // For device discovery, OAuth, IPC
};

// package.json must include:
{
  "allow2automate": {
    "plugin": true,
    "pluginId": "plugin-name",
    "displayName": "Display Name",
    "category": "gaming|iot|streaming|productivity",
    "permissions": ["network", "configuration", "agent"]
  }
}
```

## Agent API Quick Reference

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | No | Health check |
| `POST /api/heartbeat` | No | Keep-alive |
| `GET /api/platform-users` | No | Local user discovery |
| `POST /api/policies` | JWT | Create policy |
| `GET /api/policies` | JWT | List policies |
| `POST /api/sync` | JWT | Sync with parent |
| `POST /api/violations` | JWT | Report violation |

## Important Notes

**Environment**: You are using a shared folder in a different machine image. Paths appear different to the user. You cannot run the app or check the user's file system directly. Do all work relative to this directory and parent directory. When the user tests he runs the allw2automate main app usually from the commandline, and he will normally use the main app to download tag-released binaries of the agent from the github repo. So any errors shown from the agent are from the latest "production" build. Always assume the agent errors are from the latest checked-in code. When fixing anything to do with the agent, the user will commit and have the github flow build the new executables and installers.

**ES Modules Limitations**:
- **Main App**: Uses CommonJS (`require`/`module.exports`) - Electron + Webpack bundle. DO NOT convert to ES modules.
- **Agent**: Uses ES modules (`import`/`export`) with `"type": "module"` in package.json. Built to single CJS bundle via esbuild for pkg packaging.
- **Plugins**: MUST use CommonJS (`require`/`module.exports`) for compatibility with the main app's plugin loader. DO NOT use ES module syntax in plugins.
- **Jest Tests**: Agent tests require `NODE_OPTIONS='--experimental-vm-modules'` for ES module support.

**Testing**: Target 80%+ coverage. Tests in `tests/` directories.

**Key Documentation**:
- `docs/AGENT_SERVICE_INTEGRATION.md` - Agent architecture details
- `docs/PLUGIN_ARCHITECTURE_ANALYSIS.md` - Plugin system deep dive
- `docs/research/simplified-registry-design.md` - Registry design
- `../allow2automate-agent/README.md` - Agent setup
- `../plugins/MAIN_PROCESS_PLUGINS.md` - Main process plugin guide

## Common Tasks

| Task | Key Files |
|------|-----------|
| Add new plugin | `../plugins/allow2automate-plugin/` (template) |
| Agent policy changes | `app/services/AgentService.js`, `app/routes/agent.js` |
| UI components | `app/components/` (React + MUI v5) |
| Redux state | `app/actions/`, `app/reducers/` |
| Database schema | `app/database/migrations/` |
| Build agent installer | `scripts/fetch-agent-installers.js` |

## Git Branches
- Main branch: `master`
- Current work typically on `main` or feature branches
