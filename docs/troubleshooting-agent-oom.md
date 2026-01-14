# Troubleshooting Agent OOM Errors

## Error Description

```
<--- Last few GCs --->
<--- JS stacktrace --->

# Fatal javascript OOM in MemoryChunk allocation failed during deserialization.
#
```

This error appears in `/var/log/allow2automate-agent-error.log` and indicates the agent ran out of memory while trying to deserialize data.

## Root Causes

### 1. Corrupt Configuration File

**Symptom**: Agent crashes on startup
**Location**: `/etc/allow2/agent/config.json` (Linux) or `/Library/Application Support/Allow2/agent/config.json` (macOS)

**Fix**:
```bash
# Check if config file is valid JSON
cat /etc/allow2/agent/config.json | jq .

# If invalid, regenerate from parent app
# Go to parent app → Agents → Download installer → Extract config
```

### 2. Corrupt State File

**Symptom**: Agent crashes after running for some time
**Location**: Agent state/cache directory

**Fix**:
```bash
# Linux
sudo rm -rf /var/lib/allow2/agent/*
sudo systemctl restart allow2automate-agent

# macOS
sudo rm -rf "/Library/Application Support/Allow2/agent/state"
sudo launchctl stop com.allow2.automate-agent
sudo launchctl start com.allow2.automate-agent
```

### 3. Large Process List

**Symptom**: Agent crashes during process scanning
**Cause**: System has thousands of processes

**Fix**: Increase Node.js memory limit

```bash
# Linux - Edit systemd service
sudo systemctl edit allow2automate-agent.service

# Add this:
[Service]
Environment="NODE_OPTIONS=--max-old-space-size=512"

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart allow2automate-agent
```

```bash
# macOS - Edit launchd plist
sudo nano /Library/LaunchDaemons/com.allow2.automate-agent.plist

# Add before </dict>:
<key>EnvironmentVariables</key>
<dict>
    <key>NODE_OPTIONS</key>
    <string>--max-old-space-size=512</string>
</dict>

# Reload and restart
sudo launchctl unload /Library/LaunchDaemons/com.allow2.automate-agent.plist
sudo launchctl load /Library/LaunchDaemons/com.allow2.automate-agent.plist
```

### 4. Network Response Deserialization

**Symptom**: Agent crashes when communicating with parent
**Cause**: Parent sends malformed or extremely large response

**Fix**: Check parent app logs and network connectivity

```bash
# Check agent can reach parent
curl -k https://PARENT_IP:PORT/health

# Check agent logs
journalctl -u allow2automate-agent -n 100  # Linux
log show --predicate 'process == "allow2automate-agent"' --last 10m  # macOS
```

## Diagnostic Steps

### 1. Check Agent Status

```bash
# Linux
sudo systemctl status allow2automate-agent
journalctl -u allow2automate-agent --since "1 hour ago"

# macOS
sudo launchctl list | grep allow2
tail -f /var/log/allow2automate-agent.log
```

### 2. Check Memory Usage

```bash
# Before crash, monitor memory
top -p $(pgrep -f allow2automate-agent)

# Or use htop
htop -p $(pgrep -f allow2automate-agent)
```

### 3. Test Configuration

```bash
# Validate config is valid JSON
jq . /etc/allow2/agent/config.json

# Check required fields
jq '.parentApiUrl, .apiPort, .enableMDNS' /etc/allow2/agent/config.json
```

### 4. Check for Core Dumps

```bash
# Linux
ls -la /var/crash/

# macOS
ls -la ~/Library/Logs/DiagnosticReports/
```

## Quick Fixes

### Option 1: Restart Agent

```bash
# Linux
sudo systemctl restart allow2automate-agent
sudo systemctl status allow2automate-agent

# macOS
sudo launchctl stop com.allow2.automate-agent
sudo launchctl start com.allow2.automate-agent
```

### Option 2: Clear State and Restart

```bash
# Linux
sudo systemctl stop allow2automate-agent
sudo rm -rf /var/lib/allow2/agent/*
sudo systemctl start allow2automate-agent

# macOS
sudo launchctl stop com.allow2.automate-agent
sudo rm -rf "/Library/Application Support/Allow2/agent/state"
sudo launchctl start com.allow2.automate-agent
```

### Option 3: Reinstall Agent

1. **Download fresh installer** from parent app
2. **Uninstall current agent**:
   ```bash
   # Linux
   sudo dpkg -r allow2automate-agent

   # macOS
   # Open installer PKG and choose "Remove"
   ```
3. **Install new agent** with fresh config

## Prevention

### 1. Monitor Memory Usage

Add monitoring to alert before OOM:

```bash
# Linux - Add to cron
*/5 * * * * /usr/local/bin/check-agent-memory.sh
```

```bash
# check-agent-memory.sh
#!/bin/bash
MEM_USAGE=$(ps -o rss= -p $(pgrep -f allow2automate-agent) | awk '{print $1}')
if [ "$MEM_USAGE" -gt 204800 ]; then  # 200MB
    echo "WARNING: Agent using ${MEM_USAGE}KB memory"
    systemctl restart allow2automate-agent
fi
```

### 2. Regular Log Rotation

```bash
# Linux - /etc/logrotate.d/allow2automate-agent
/var/log/allow2automate-agent*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    copytruncate
}
```

### 3. Update Regularly

Keep agent updated to latest version:

```bash
# Check current version
allow2automate-agent --version

# Update from parent app
# Go to parent app → Agents → Check for updates
```

## Code-Level Fixes (For Developers)

### 1. Add Memory Limits in Code

```javascript
// src/index.js
if (!process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS = '--max-old-space-size=512';
}
```

### 2. Stream Large Data

Instead of loading entire process list into memory:

```javascript
// Before (loads all at once)
const processes = await getAllProcesses();

// After (stream and filter)
const processStream = getProcessStream();
for await (const process of processStream) {
    if (shouldMonitor(process)) {
        monitor(process);
    }
}
```

### 3. Add Deserialization Error Handling

```javascript
// src/ApiServer.js or wherever deserialization happens
try {
    const data = JSON.parse(largeString);
    return data;
} catch (err) {
    if (err.message.includes('OOM') || err.message.includes('memory')) {
        logger.error('Out of memory during deserialization', {
            dataSize: largeString.length,
            error: err.message
        });
        // Fall back to streaming parser or chunked processing
        return parseInChunks(largeString);
    }
    throw err;
}
```

### 4. Implement Backpressure

```javascript
// Limit concurrent requests
const MAX_CONCURRENT = 5;
const queue = [];
let active = 0;

async function processWithBackpressure(item) {
    while (active >= MAX_CONCURRENT) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    active++;
    try {
        return await processItem(item);
    } finally {
        active--;
    }
}
```

## Reporting Issues

If none of these fixes work:

1. **Collect logs**:
   ```bash
   journalctl -u allow2automate-agent --since "1 hour ago" > agent-crash.log
   ```

2. **Check system resources**:
   ```bash
   free -h
   df -h
   top -b -n 1 > system-resources.txt
   ```

3. **Report to support** with:
   - Error log
   - System resources
   - Agent version
   - OS version
   - Config file (remove sensitive data)

## Related Documentation

- Agent installation: `/home/andrew/ai/automate/allow2automate-agent/README.md`
- Parent app integration: `/docs/agent-integration.md`
- Process monitoring: `/home/andrew/ai/automate/allow2automate-agent/src/ProcessMonitor.js`
