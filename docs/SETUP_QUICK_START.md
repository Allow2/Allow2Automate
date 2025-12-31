# Quick Start - Developer Setup

## Prerequisites

- Node.js >= 18.0.0
- Platform-specific build tools:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: Visual Studio Build Tools or windows-build-tools
  - **Linux**: build-essential (`sudo apt-get install build-essential`)

## Setup Steps

### 1. Clone and Install

```bash
git clone <repository-url>
cd automate
npm install
```

**Important**: The `postinstall` script automatically rebuilds native modules for your platform. If you see database errors, the rebuild may have failed.

### 2. Rebuild Native Modules (If Needed)

If you encounter this error:
```
Error: dlopen(...better_sqlite3.node...) slice is not valid mach-o file
```

Run:
```bash
npm run rebuild:native
```

### 3. Start Development

```bash
npm run develop
```

The app will compile and start in development mode with hot-reload.

## Common Issues

### Database Initialization Fails

**Symptoms**:
- Console error: `[DatabaseModule] Initialization error`
- Error about `better_sqlite3.node`
- IPC error: `No handler registered for 'agents:list'`

**Solution**:
```bash
# Clean rebuild
rm -rf node_modules
npm install

# Or just rebuild native modules
npm run rebuild:native
```

### Wrong Platform Binary

**Cause**: You're on macOS but have Linux binaries (or vice versa)

**Solution**: Always run `npm install` or `npm run rebuild:native` on the target platform

## CI/CD Notes

For continuous integration:

1. **Each platform builds separately** - Don't share `node_modules` between platforms
2. **postinstall handles rebuilding** - No manual intervention needed in CI
3. **GitHub Actions example** - See `docs/NATIVE_MODULES_SETUP.md`

## Database Verification

After successful setup, check the console for:

```
[AgentIntegration] Initializing agent services...
[DatabaseModule] Opened database at /Users/.../allow2automate.db
[AgentIntegration] Agent API server listening on port 8080
[Main] ✅ Agent services initialized successfully
```

If you see these messages, the database is working correctly!

## Next Steps

- See `docs/AGENT_SERVICE_INTEGRATION.md` for agent architecture
- See `docs/NATIVE_MODULES_SETUP.md` for detailed native module documentation
- Settings tab → "Network Device Monitoring" to manage agents
