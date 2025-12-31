# Native Modules Setup Guide

This project uses `better-sqlite3`, a native Node.js module that requires compilation for each platform.

## Quick Start (For Developers)

### First Time Setup

After cloning the repository, run:

```bash
npm install
```

This will automatically:
1. Install all dependencies
2. Run `electron-builder install-app-deps`
3. Run `electron-rebuild -f -w better-sqlite3` (rebuilds for your platform)

### Manual Rebuild (If Needed)

If you encounter database errors after updating Electron or Node versions:

```bash
npm run rebuild:native
```

Or manually:

```bash
npx electron-rebuild -f -w better-sqlite3
```

## Platform-Specific Instructions

### macOS

```bash
# Install dependencies (Xcode Command Line Tools required)
xcode-select --install  # If not already installed
npm install
```

### Windows

```bash
# Install dependencies (Visual Studio Build Tools required)
npm install --global windows-build-tools  # If not already installed
npm install
```

### Linux

```bash
# Install dependencies (build-essential required)
sudo apt-get install build-essential  # Ubuntu/Debian
# OR
sudo yum groupinstall "Development Tools"  # RHEL/CentOS
npm install
```

## CI/CD Pipeline

For automated builds across platforms, the `postinstall` script handles native module rebuilding automatically.

### GitHub Actions Example

```yaml
name: Build

on: [push, pull_request]

jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install  # Automatically rebuilds for macOS
      - run: npm run pack:mac

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install  # Automatically rebuilds for Windows
      - run: npm run pack:win

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install  # Automatically rebuilds for Linux
      - run: npm run pack:linux
```

## Electron Builder Integration

The `electron-builder` configuration in `package.json` ensures that:

1. **Development**: Native modules are rebuilt after `npm install`
2. **Packaging**: `electron-builder install-app-deps` recompiles for target platform
3. **Cross-Platform**: Each platform gets correctly compiled binaries

## Troubleshooting

### Error: "slice is not valid mach-o file"

**Cause**: Native module was compiled for wrong platform (e.g., Linux binary on macOS)

**Solution**: Rebuild for your platform
```bash
npm run rebuild:native
```

### Error: "MODULE_NOT_FOUND better-sqlite3"

**Cause**: Module not installed or rebuild failed

**Solution**: Reinstall and rebuild
```bash
rm -rf node_modules package-lock.json
npm install
```

### Error: "No handler registered for 'agents:list'"

**Cause**: Database initialization failed, preventing IPC handlers from registering

**Solution**:
1. Check console for database errors
2. Rebuild native modules: `npm run rebuild:native`
3. Restart the app

### Electron Version Updates

When updating Electron version in `package.json`:

```bash
npm install  # Updates Electron
npm run rebuild:native  # Rebuilds native modules for new Electron version
```

## How It Works

1. **postinstall script** runs after `npm install`
2. **electron-builder install-app-deps** installs platform-specific dependencies
3. **electron-rebuild** recompiles better-sqlite3 for current Electron version
4. During **packaging**, electron-builder ensures native modules match target platform

## Database Location

Persistent SQLite database is stored at:

- **macOS**: `~/Library/Application Support/Allow2Automate/allow2automate.db`
- **Windows**: `%APPDATA%\Allow2Automate\allow2automate.db`
- **Linux**: `~/.config/Allow2Automate/allow2automate.db`

This location persists across app updates and restarts.
