# Child Detection System - Executive Summary

## Overview

A comprehensive three-tier child detection system has been designed for the Allow2 Automate platform, enabling granular per-child quota enforcement and monitoring across gaming platforms.

## Problem Statement

Current system enforces quotas at the device level, but multiple children may share the same device. Without knowing which specific child is using a gaming platform, accurate quota tracking and enforcement is impossible.

**Example Scenario:**
- Emma has 2 hours of gaming quota remaining
- Lucas has 0 hours (quota exhausted)
- Both use the same gaming PC
- Current system: Blocks/allows both children equally
- **Required**: Detect which child is playing and enforce their individual quota

## Solution: Three-Tier Detection

### Tier 1: Platform-Specific User Detection (Confidence: 95%)

Detect the actual logged-in user from the gaming platform itself:

**Steam:**
- Parse `loginusers.vdf` file
- Extract Steam username (e.g., "player123")
- Map to Allow2 child via parent configuration
- Cross-platform support (Windows, macOS, Linux)

**Epic Games:**
- Parse Epic config files
- Extract Epic account email/ID
- Hash email for privacy (SHA-256)
- Map to Allow2 child

**Battle.net:**
- Parse Battle.net.config JSON
- Extract BattleTag (e.g., "Player#1234")
- Map to Allow2 child

### Tier 2: OS-Level User Detection (Confidence: 75%)

Detect which OS user is running the process:

**Windows:**
- Use `tasklist /V` to get process owner
- Extract Windows username (e.g., "DESKTOP-PC\Emma" → "Emma")
- Map to Allow2 child

**macOS/Linux:**
- Use `ps aux` or `ps -o user=` to get process owner
- Map UNIX username to Allow2 child

### Tier 3: Device-Level Default (Confidence: 50%)

Fallback to pre-configured default child for the device:
- Parent sets "Default child for this device"
- Applied when Tier 1 and Tier 2 fail
- Useful for single-child households

## Architecture

```
Process Detected
       ↓
Tier 1: Platform-Specific Detection
  ↓ (if found)
Return Child (high confidence)
  ↓ (if NOT found)
Tier 2: OS-Level Detection
  ↓ (if found)
Return Child (medium confidence)
  ↓ (if NOT found)
Tier 3: Device Default
  ↓
Return Child (low confidence)
```

## Key Components

### Agent-Side (allow2automate-agent)

**ChildDetector Service:**
- Orchestrates three-tier detection
- Queries parent API for mappings
- Logs detection events

**Platform Detectors:**
- `SteamUserDetector.js` - Parse Steam VDF files
- `EpicUserDetector.js` - Parse Epic config files
- `BattlenetUserDetector.js` - Parse Battle.net JSON

**OS Detectors:**
- `WindowsOSDetector.js` - Use tasklist command
- `MacOSOSDetector.js` - Use ps command
- `LinuxOSDetector.js` - Use ps command

### Parent-Side (automate)

**ChildMappingService:**
- Create/update/delete child mappings
- Query mappings for agent
- Auto-suggest mappings based on username similarity
- Log detection events

**API Endpoints:**
- `POST /api/child-mappings` - Create mapping
- `GET /api/child-mappings/query` - Query mapping (used by agent)
- `POST /api/agents/:id/discover-users` - Auto-discover users
- `PUT /api/agents/:id/default-child` - Set device default

**UI Component:**
- Settings → Child Mapping
- Display discovered platform users
- Map users to children via dropdown
- Set device default child
- Visual confidence indicators (🟢 high, 🟡 medium, ⚪ low)

### Database Schema

**child_mappings table:**
```sql
id, agent_id, platform, username, username_hash, child_id,
confidence, auto_discovered, confirmed_by_parent,
created_at, last_used
```

**agents table (updated):**
```sql
default_child_id, child_detection_enabled, child_detection_method
```

**detection_logs table:**
```sql
id, agent_id, process_name, process_pid, detected_child_id,
detection_method, confidence, platform_username, os_username,
tier_used, fallback_reason, timestamp
```

## User Workflow

### Initial Setup (Parent)

1. Navigate to Settings → Child Mapping
2. Select device (agent)
3. Click "Scan for Users"
4. System auto-discovers:
   - Steam usernames
   - Epic accounts
   - Battle.net BattleTags
   - OS usernames
5. Parent maps each username to a child
6. System auto-suggests mappings (e.g., "emma_plays" → Emma)
7. Parent confirms or adjusts suggestions
8. Parent sets device default child (optional)

### Runtime Detection (Agent)

1. Agent detects Steam.exe process starts (PID: 1234)
2. ChildDetector identifies platform: "steam"
3. **Tier 1 Attempt:**
   - Parse `loginusers.vdf`
   - Extract username: "player123"
   - Query parent API: `/api/child-mappings/query?platform=steam&username=player123`
   - Response: `{ found: true, childId: "child-emma", confidence: 0.95 }`
4. Detection successful: Emma is playing
5. Check Emma's quota: 2 hours remaining
6. **Action: Allow Steam to run**
7. Log detection event

### Plugin Integration

**Steam Plugin (Updated):**
```javascript
agentService.on('processDetected', async (event) => {
  if (!event.processName.includes('steam')) return;

  // Detect which child is using Steam
  const detection = await childDetector.detectChild(event);

  // Check quota for THIS specific child
  const allow2State = await allow2Service.getChildState(detection.childId);

  if (allow2State.paused || allow2State.quota <= 0) {
    // Block Steam for this child
    await agentService.killProcess(event.agentId, event.processName);
  } else {
    // Allow and start tracking time for this child
    await timeTracker.startTracking({
      childId: detection.childId,
      activity: 'Steam',
      processName: event.processName
    });
  }
});
```

## Security & Privacy

### File Access
- Agent needs read access to platform config files
- Graceful fallback if permission denied
- No password or token storage

### PII Protection
- Steam usernames: Public, safe to store
- Epic emails: Hash with SHA-256 before storing
- BattleTags: Public, safe to store
- OS usernames: Local, safe to store

### Validation
- Sanitize usernames before storing
- Validate platform types
- Prevent SQL injection

## Performance

**Detection Speed:**
- Tier 1: 10-50ms (file parse)
- Tier 2: 50-200ms (OS command)
- Tier 3: 5-10ms (database query)
- **Total: < 300ms** worst case

**Resource Usage:**
- Memory: ~5MB for all detectors
- CPU: Negligible (only on process start)
- Disk I/O: ~2KB read per detection

**Accuracy:**
- Tier 1: 95%+ (when mapping exists)
- Tier 2: 75%+ (when mapping exists)
- Tier 3: 50% (assumption-based)
- **Overall: 85%+** with proper configuration

## Implementation Plan

### Phase 1: Database Schema (Week 1)
- Create migration files
- Add tables: child_mappings, detection_logs
- Update agents table

### Phase 2: Agent-Side (Weeks 2-3)
- Implement platform detectors (Steam, Epic, Battle.net)
- Implement OS detectors (Windows, macOS, Linux)
- Implement ChildDetector service
- Add agent API endpoints

### Phase 3: Parent-Side API (Week 4)
- Implement ChildMappingService
- Create API routes
- Add detection logging

### Phase 4: Parent UI (Week 5)
- Create ChildMapping component
- Integrate into Settings page
- Add auto-discovery UI

### Phase 5: Plugin Integration (Week 6)
- Update Steam plugin
- Update Epic plugin (if exists)
- Update Battle.net plugin (if exists)

### Phase 6: Testing (Week 7)
- Unit tests (platform detectors, OS detectors, services)
- Integration tests (API, UI, plugins)
- Manual testing (all platforms)

### Phase 7: Documentation (Week 8)
- User guide
- Developer guide
- Troubleshooting guide

**Total Timeline:** 8 weeks development + 2 weeks testing = **10 weeks (2.5 months)**

## Success Metrics

### Technical Metrics
- Detection success rate > 90%
- API response time < 300ms
- Zero database errors
- Code coverage > 85%

### User Metrics
- 50%+ users configure mappings (Month 1)
- 80%+ users configure mappings (Month 3)
- User satisfaction > 4.0/5.0
- < 1% false positive rate (wrong child detected)

## Future Enhancements

### Phase 2: Biometric Detection
- Facial recognition (webcam)
- Fingerprint authentication
- Windows Hello / macOS Face ID integration
- Confidence: 98%+

### Phase 3: Behavioral Learning
- Machine learning model
- Learn play patterns (time of day, game preferences)
- Predict child based on behavior
- Confidence: 70-85%

### Phase 4: Active Challenge
- Parent-triggered verification
- Send notification to child's device: "Are you Emma or Lucas?"
- Child confirms identity
- Store confirmation for future

### Phase 5: Multi-Device Correlation
- Detect child's phone/tablet on WiFi
- Combine device presence with process detection
- Confidence boost: +10%

## Benefits

### For Parents
- Accurate per-child quota tracking
- Confidence in enforcement (know which child is playing)
- Visibility into who's using what (detection logs)
- Easy setup (auto-discovery + mapping)

### For Children
- Fair quota enforcement (brother's quota doesn't affect sister)
- Clear understanding of remaining time
- Consistent experience across devices

### For Developers
- Extensible architecture (easy to add new platforms)
- Well-tested codebase (85%+ coverage)
- Clear documentation
- Maintainable code structure

## Risk Mitigation

### Risk: Detection fails (Tier 1 & 2)
**Mitigation:** Device default (Tier 3) ensures detection always succeeds

### Risk: Wrong child detected
**Mitigation:**
- High confidence thresholds (95% for platform-specific)
- Parent confirmation of mappings
- Detection logs for troubleshooting
- Manual override capability

### Risk: Performance impact
**Mitigation:**
- Detection only on process start (not continuous)
- Cached mappings (query once, cache result)
- Optimized database indexes
- < 300ms detection time

### Risk: Privacy concerns
**Mitigation:**
- Hash PII (Epic emails)
- No password/token storage
- Local-only data (not shared)
- Clear privacy policy

## Conclusion

The three-tier child detection system provides robust, privacy-respecting granular child identification for gaming platform control. By combining platform-specific detection, OS-level user detection, and device defaults, the system ensures accurate quota enforcement while gracefully handling edge cases.

The system is:
- **Extensible**: Easy to add new platforms
- **Privacy-First**: Hash PII, no password storage
- **User-Friendly**: Auto-discovery + simple UI
- **Reliable**: Three-tier fallback ensures detection always succeeds
- **Auditable**: Complete logging for troubleshooting
- **Performant**: < 300ms detection, minimal resource usage

**Next Steps:** Begin Phase 1 implementation (database schema) and proceed through the 10-week development plan.

## Documentation Files

All comprehensive documentation has been created in `/mnt/ai/automate/automate/docs/research/`:

1. **child-detection-architecture.md** (50KB)
   - Complete technical architecture
   - Platform-specific detection methods
   - Database schema
   - API specifications
   - Security considerations

2. **child-detection-implementation-plan.md** (24KB)
   - 8-week phased implementation plan
   - File structure and organization
   - Code examples for all components
   - Testing checklist
   - Deployment plan

3. **child-detection-testing-guide.md** (28KB)
   - Comprehensive testing strategy
   - Unit test examples (all detectors)
   - Integration test examples
   - Manual testing checklist
   - Performance benchmarks

4. **child-detection-summary.md** (This document)
   - Executive summary
   - Quick reference guide

All architecture decisions have been stored in coordination memory for reference by other tasks.
