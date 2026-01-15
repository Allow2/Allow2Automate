# Allow2automate Plugin System - Implementation Roadmap

**Version:** 1.0
**Date:** 2026-01-15
**Total Duration:** 30 weeks (7.5 months)
**Team Size Estimate:** 2-3 developers

---

## Table of Contents

1. [Overview](#overview)
2. [Dependencies](#dependencies)
3. [Phase Breakdown](#phase-breakdown)
4. [Milestones](#milestones)
5. [Risk Management](#risk-management)
6. [Success Criteria](#success-criteria)

---

## Overview

This roadmap outlines the implementation plan for the allow2automate plugin system, including:

- **Process Auditing System** - Agent-supplied process monitoring
- **Plugin Infrastructure** - Data monitors, action scripts, queuing, sandboxing
- **OS Plugin** - Operating system-level parental controls
- **Home Assistant Plugin** - Home automation integration
- **Web Browsers Plugin** - Browser activity tracking

### Strategic Approach

The implementation follows a **phased, incremental approach**:
1. Build foundation first (process auditing + plugin infrastructure)
2. Implement plugins in order of complexity (OS → HA → Browsers)
3. Start with basic features, add advanced features later
4. Continuous testing and iteration throughout

---

## Dependencies

### External Dependencies
- **Allow2 Platform API** - Must be available for quota checking and classification
- **Trust Establishment** - Already implemented (Phase 2 completed)
- **Agent Sync System** - Already implemented
- **mDNS Discovery** - Already implemented

### Internal Dependencies
```
Phase 1 (Foundation)
  ├── Phase 2 (OS Plugin Basic)
  │     ├── Phase 3 (OS Plugin Advanced)
  │     │     └── Phase 6 (Browser Plugin Basic)
  │     │           └── Phase 7 (Browser Plugin Enhanced)
  │     └── Phase 4 (HA Plugin Basic)
  │           └── Phase 5 (HA Plugin Advanced)
  └── Documentation and Testing (Continuous)
```

---

## Phase Breakdown

### Phase 1: Foundation (Weeks 1-4)

**Goal:** Build the core infrastructure required by all plugins

#### Week 1-2: Process Auditing System

**Tasks:**
1. Platform-specific process enumeration
   - Windows: WMI/tasklist implementation
   - macOS: ps/BSD implementation
   - Linux: /proc filesystem implementation
2. Process fingerprinting (SHA-256 hash of name + path)
3. Delta calculator (process started/stopped events)
4. Local SQLite registry (process_registry, running_processes tables)

**Deliverables:**
- `src/core/process-auditor/ProcessAuditingService.js`
- `src/core/process-auditor/platform/WindowsProcessMonitor.js`
- `src/core/process-auditor/platform/MacOSProcessMonitor.js`
- `src/core/process-auditor/platform/LinuxProcessMonitor.js`
- `src/core/process-auditor/ProcessFingerprintEngine.js`
- `src/core/process-auditor/DeltaCalculator.js`
- Unit tests for all components

**Success Criteria:**
- Process auditing running on all 3 platforms
- Delta events firing correctly (started/stopped)
- Database persisting process registry
- < 2% CPU usage on average

#### Week 3: Allow2 Platform Integration

**Tasks:**
1. Allow2 API client implementation
   - Classification endpoint (`POST /api/v2/classify-processes`)
   - Check activity endpoint (`POST /api/v3/check-activity`)
   - Sync classifications endpoint (`GET /api/v2/classifications/sync`)
2. Classification manager
   - Queue unknown processes for classification
   - Batch API requests (max 50 processes per request)
   - Update local registry with classifications
3. Dynamic quota manager base class
   - `checkAllowance(childId, activityType)` - no logging
   - `logUsage(childId, activityType, duration)` - with logging
   - 5-second cache implementation

**Deliverables:**
- `src/core/allow2/Allow2ApiClient.js`
- `src/core/allow2/ClassificationManager.js`
- `src/core/allow2/DynamicQuotaManager.js`
- Integration tests with mock API

**Success Criteria:**
- API client handles retries, rate limiting, errors
- Classifications update in local database
- Quota checks return accurate allowances
- `log_usage` flag working correctly

#### Week 4: Plugin Infrastructure

**Tasks:**
1. Plugin loading and deployment system
   - Deploy monitor scripts to agents
   - Verify checksums
   - Store in `/var/lib/allow2/plugins/{pluginId}/`
2. Sandboxed script execution
   - VM2 or isolated-vm implementation
   - Restricted API surface (fs, network, process)
3. Data queuing and batching
   - Queue plugin data to disk (survives restarts)
   - Debounced batching (2-second window)
   - Sync to parent on heartbeat
4. Action script execution
   - Trigger actions with arguments
   - Return code capture
   - Error handling

**Deliverables:**
- `src/core/plugin/PluginExtensionManager.js`
- `src/core/plugin/SandboxExecutor.js`
- `src/core/plugin/DataQueue.js`
- `src/core/plugin/ActionExecutor.js`
- Plugin API documentation

**Success Criteria:**
- Plugins can deploy to agents
- Scripts execute in sandbox safely
- Data queues and syncs correctly
- Actions trigger and return results

---

### Phase 2: OS Plugin - Basic Mode (Weeks 5-8)

**Goal:** Implement core OS-level parental controls (user detection, time tracking, basic enforcement)

#### Week 5-6: Session Monitoring & Quota Manager

**Tasks:**
1. SessionMonitor implementation
   - Windows: WMI Win32_ComputerSystem.UserName
   - macOS: `stat -f%Su /dev/console`
   - Linux: loginctl / `who` command
   - Auto-detect child account from Allow2 mapping
2. QuotaManager implementation
   - Track active time per child
   - Persist state every 30 seconds
   - Query Allow2 for remaining quota
   - Calculate shutdown times

**Deliverables:**
- `plugins/allow2automate-os/agent/monitors/SessionMonitor.js`
- `plugins/allow2automate-os/parent/QuotaManager.js`
- Database schema (os_plugin_sessions, os_plugin_usage)

**Success Criteria:**
- Correctly detects logged-in user on all platforms
- Time tracking accurate to within 30 seconds
- Quota queries happen every check interval (30s default)

#### Week 7: Basic Actions

**Tasks:**
1. ActionExecutor implementation
   - Logout action (Windows: shutdown /l, macOS: osascript logout, Linux: loginctl terminate-user)
   - Notify action (toast notifications via node-notifier)
2. Parent-side monitor logic
   - Receive session data
   - Calculate remaining time
   - Send shutdown time updates
   - Trigger logout when quota exhausted

**Deliverables:**
- `plugins/allow2automate-os/agent/actions/LogoutAction.js`
- `plugins/allow2automate-os/agent/actions/NotifyAction.js`
- `plugins/allow2automate-os/parent/OSPluginMonitor.js`

**Success Criteria:**
- Logout works on all platforms
- Notifications display correctly
- Shutdown countdown accurate

#### Week 8: Testing & Refinement

**Tasks:**
1. Cross-platform testing
2. Edge case handling (rapid user switching, network failures)
3. Performance optimization
4. Documentation updates

**Deliverables:**
- Test suite (unit + integration)
- Bug fixes
- Performance report

**Success Criteria:**
- All tests passing
- No critical bugs
- < 1% CPU usage

---

### Phase 3: OS Plugin - Advanced Mode (Weeks 9-12)

**Goal:** Add process control, browser detection, advanced enforcement

#### Week 9-10: Process Control

**Tasks:**
1. Process kill action
   - Windows: taskkill /F /PID
   - macOS: kill -9 (requires permissions discussion)
   - Linux: kill -9
2. Process block action
   - Windows: Group Policy / AppLocker
   - macOS: Parental Controls API
   - Linux: AppArmor / SELinux policies
3. Integration with Process Auditing System
   - Use classifications for "game" detection
   - Monitor for banned processes
   - Kill on quota exhaustion

**Deliverables:**
- `plugins/allow2automate-os/agent/actions/KillProcessAction.js`
- `plugins/allow2automate-os/agent/actions/BlockProcessAction.js`
- Integration with ProcessAuditingService

**Success Criteria:**
- Can kill processes on all platforms
- Process blocking prevents launch
- Game detection working via classifications

#### Week 11: Browser Detection & Internet Time

**Tasks:**
1. Browser detection using process classifications
   - Query process auditing for "browser" classification
   - Detect multiple browser instances
   - Track per-browser time
2. Internet quota enforcement
   - Separate quota for "internet" activity
   - Kill browsers when internet time exhausted
   - Warnings before enforcement

**Deliverables:**
- `plugins/allow2automate-os/parent/BrowserTracker.js`
- Internet time tracking
- Browser kill actions

**Success Criteria:**
- Detects all common browsers (Chrome, Firefox, Safari, Edge)
- Internet time tracked separately from general usage
- Browser kills work reliably

#### Week 12: Linux Support & Refinement

**Tasks:**
1. Linux desktop environment support
   - GNOME, KDE, XFCE
   - Lock screen actions
   - Session management
2. Testing across all platforms
3. Documentation completion

**Deliverables:**
- Linux platform implementation
- Complete test suite
- OS Plugin documentation

**Success Criteria:**
- Full Linux support (3 major DEs)
- All platforms tested and working
- Documentation complete

---

### Phase 4: Home Assistant Plugin - Basic Mode (Weeks 13-17)

**Goal:** Connect to Home Assistant and track basic device usage (Xbox, PlayStation)

#### Week 13-14: Home Assistant Connection

**Tasks:**
1. HAConnectionManager implementation
   - REST API client (fetch API wrapper)
   - Authentication (long-lived access token)
   - Entity discovery
   - State polling
2. Device discovery service
   - Classify entities (media_player, switch, sensor)
   - Xbox integration (media_player.xbox_*)
   - PlayStation integration (media_player.playstation_*)
   - Smart plug detection (switch.* with power monitoring)

**Deliverables:**
- `plugins/allow2automate-homeassistant/agent/HAConnectionManager.js`
- `plugins/allow2automate-homeassistant/agent/DeviceDiscoveryService.js`
- Configuration wizard for HA token

**Success Criteria:**
- Successfully connects to Home Assistant
- Discovers all relevant entities
- Polls states correctly (5-second interval)

#### Week 15-16: Device Linking & Basic Tracking

**Tasks:**
1. DeviceLinkingManager implementation
   - Database schema (device_links table)
   - Link types: exclusive, power_control
   - Parent UI for linking child ↔ device
2. ActivityTracker implementation
   - Track device "on" time per child
   - Log usage to Allow2 platform
   - Quota enforcement
3. Action executor
   - Turn off device (call service: switch.turn_off, media_player.turn_off)

**Deliverables:**
- `plugins/allow2automate-homeassistant/parent/DeviceLinkingManager.js`
- `plugins/allow2automate-homeassistant/parent/ActivityTracker.js`
- `plugins/allow2automate-homeassistant/agent/actions/TurnOffDeviceAction.js`
- Parent UI for device linking

**Success Criteria:**
- Parents can link children to devices
- Xbox/PlayStation time tracked accurately
- Devices turn off when quota exhausted

#### Week 17: Testing & Refinement

**Tasks:**
1. Integration testing with real Home Assistant instance
2. Edge case handling (HA offline, device unavailable)
3. Documentation

**Deliverables:**
- Test suite
- Bug fixes
- HA Plugin basic mode documentation

**Success Criteria:**
- All basic features working
- Handles HA offline gracefully
- Documentation complete

---

### Phase 5: Home Assistant Advanced (Weeks 18-22)

**Goal:** WebSocket real-time tracking, shared devices, energy monitoring

#### Week 18-19: WebSocket Real-Time Tracking

**Tasks:**
1. WebSocket client implementation
   - Connect to HA WebSocket API
   - Subscribe to state changes
   - Auto-reconnect on disconnect
   - Heartbeat/ping mechanism
2. Real-time state change handling
   - Instant detection of device on/off
   - More accurate time tracking
   - Immediate quota enforcement

**Deliverables:**
- `plugins/allow2automate-homeassistant/agent/HAWebSocketClient.js`
- Real-time event handling
- Subscription management

**Success Criteria:**
- WebSocket stays connected reliably
- State changes detected within 1 second
- Auto-reconnect works

#### Week 20: Shared Device Attribution

**Tasks:**
1. Shared device linking
   - Link multiple children to one device
   - Time-based attribution rules (Bobby 3-5 PM, Sarah 7-9 PM)
   - Default attribution (first child if no rule matches)
2. Attribution manager
   - Calculate which child to attribute time to
   - Handle overlapping time windows
   - "Ask parent" fallback (future enhancement)

**Deliverables:**
- `plugins/allow2automate-homeassistant/parent/AttributionManager.js`
- Shared device rules UI
- Attribution algorithm

**Success Criteria:**
- Time-based rules work correctly
- Edge cases handled (overlaps, no rule)
- Parents can configure rules easily

#### Week 21: Energy Monitoring

**Tasks:**
1. Smart plug power monitoring
   - Detect switches with power sensors
   - Track kWh usage per child
   - Calculate cost ($/kWh configuration)
2. Energy quota enforcement
   - Set energy limits (e.g., 5 kWh/day)
   - Warnings before limit reached
   - Turn off devices at limit

**Deliverables:**
- `plugins/allow2automate-homeassistant/parent/EnergyMonitor.js`
- Energy tracking database schema
- Cost calculation logic

**Success Criteria:**
- Energy usage tracked accurately
- Cost calculated correctly
- Quota enforcement working

#### Week 22: Smart TV Integration & Refinement

**Tasks:**
1. Smart TV integrations
   - Samsung TV (samsungtv integration)
   - LG TV (webostv integration)
   - Sony TV (braviatv integration)
2. Testing and refinement
3. Documentation completion

**Deliverables:**
- Smart TV support
- Complete test suite
- HA Plugin advanced documentation

**Success Criteria:**
- TV tracking working on all 3 brands
- All advanced features tested
- Documentation complete

---

### Phase 6: Web Browsers Plugin - Basic Mode (Weeks 23-26)

**Goal:** Process-level browser detection and internet time tracking

#### Week 23-24: Browser Process Detection

**Tasks:**
1. Browser detection using Process Auditing System
   - Query for "browser" classification
   - Support 20+ browsers (Chrome, Firefox, Safari, Edge, Brave, Opera, Vivaldi, etc.)
2. Browser time tracker
   - Track active browser time per child
   - Log to Allow2 as "internet" activity
   - Quota enforcement (kill browser processes)
3. Integration with OS Plugin
   - Share internet quota if both plugins installed
   - Coordinate enforcement actions

**Deliverables:**
- `plugins/allow2automate-webbrowsers/parent/BrowserTimeTracker.js`
- `plugins/allow2automate-webbrowsers/agent/actions/KillBrowserAction.js`

**Success Criteria:**
- All common browsers detected
- Time tracked accurately (process-level)
- Quota enforcement working

#### Week 25: Domain Classification (Basic)

**Tasks:**
1. Allow2 domain classification integration
   - Send list of domains to Allow2 API
   - Receive classifications (social_media, gaming, education, etc.)
   - Store in local database
2. Basic reporting
   - Report browser usage with "unknown" domains
   - Future enhancement: per-domain tracking (requires extension)

**Deliverables:**
- Domain classification client
- Usage reporting with domain metadata

**Success Criteria:**
- Domains classified correctly
- Metadata included in usage logs

#### Week 26: Testing & Refinement

**Tasks:**
1. Cross-platform testing
2. Browser compatibility testing
3. Documentation

**Deliverables:**
- Test suite
- Browser compatibility matrix
- Basic mode documentation

**Success Criteria:**
- All platforms tested
- Common browsers working
- Documentation complete

---

### Phase 7: Web Browsers Plugin - Enhanced Mode (Weeks 27-30)

**Goal:** Browser extension for per-site tracking and detailed activity

#### Week 27-28: Browser Extension Development

**Tasks:**
1. Chrome extension
   - manifest.json (V3)
   - background.js service worker
   - Active tab tracking
   - Native messaging setup
2. Firefox extension
   - Manifest.json (V2/V3 hybrid)
   - Background script
   - Active tab tracking
   - Native messaging setup
3. Edge extension (Chromium-based, similar to Chrome)

**Deliverables:**
- Chrome extension (full implementation)
- Firefox extension (full implementation)
- Edge extension (minimal, based on Chrome)
- Extension store submission (optional)

**Success Criteria:**
- Extensions install and run on all 3 browsers
- Active tab detection working
- No performance impact on browsing

#### Week 29: Native Messaging Integration

**Tasks:**
1. Native messaging host
   - Install native host manifest
   - Communication protocol (JSON messages)
   - Agent integration
2. Extension ↔ Agent communication
   - Extension sends active tab data
   - Agent processes and queues data
   - Per-site time tracking
3. Privacy controls
   - User consent flow
   - Data retention policies
   - Opt-out mechanism

**Deliverables:**
- `plugins/allow2automate-webbrowsers/agent/NativeMessagingHost.js`
- Native host manifests (Chrome, Firefox, Edge)
- Privacy consent UI

**Success Criteria:**
- Extension communicates with agent
- Per-site time tracked accurately
- Privacy controls working

#### Week 30: Advanced Features & Final Testing

**Tasks:**
1. Per-site quota enforcement
   - Set limits per domain (e.g., 30 min/day on social media)
   - Block specific sites
   - Warnings before blocking
2. Incognito/private mode handling
   - Fallback to process-level tracking
   - Optional: request incognito permissions
3. Final testing and documentation

**Deliverables:**
- Per-site quotas
- Complete test suite
- Enhanced mode documentation
- PRIVACY.md compliance documentation

**Success Criteria:**
- Per-site quotas working
- All browsers tested
- Privacy compliant (COPPA/GDPR)
- Documentation complete

---

## Milestones

| Milestone | Week | Deliverable | Success Criteria |
|-----------|------|-------------|------------------|
| **M1: Foundation Complete** | 4 | Process auditing + plugin infrastructure | Process auditing running, plugins can deploy |
| **M2: OS Plugin Basic** | 8 | Session tracking + basic enforcement | User detection, time tracking, logout working |
| **M3: OS Plugin Advanced** | 12 | Process control + browser detection | Game/browser killing, full platform support |
| **M4: HA Plugin Basic** | 17 | Xbox/PS tracking + basic enforcement | Device linking, turn off working |
| **M5: HA Plugin Advanced** | 22 | WebSocket + shared devices + energy | Real-time tracking, smart TVs, energy monitoring |
| **M6: Browser Plugin Basic** | 26 | Process-level browser tracking | Browser detection, internet time tracking |
| **M7: Browser Plugin Enhanced** | 30 | Extension + per-site tracking | Extensions working, per-site quotas |

---

## Risk Management

### Technical Risks

#### Risk 1: macOS Elevated Permissions
**Probability:** High
**Impact:** High
**Mitigation:**
- Research macOS helper tools with setuid
- Explore launch daemons approach
- Have fallback to Parental Controls API
- Document limitations clearly

#### Risk 2: Home Assistant API Changes
**Probability:** Medium
**Impact:** Medium
**Mitigation:**
- Use stable REST API endpoints
- Version API client
- Add comprehensive error handling
- Monitor HA release notes

#### Risk 3: Browser Extension Store Approval
**Probability:** Medium
**Impact:** Medium
**Mitigation:**
- Start submission process early (Week 28)
- Have developer mode installation as fallback
- Explore enterprise deployment options
- Document manual installation clearly

#### Risk 4: Performance Impact
**Probability:** Medium
**Impact:** High
**Mitigation:**
- Continuous performance monitoring
- Configurable polling intervals
- Adaptive polling (battery vs AC)
- Optimize database queries

### Schedule Risks

#### Risk 5: Feature Creep
**Probability:** High
**Impact:** Medium
**Mitigation:**
- Strict adherence to roadmap phases
- "Nice to have" features deferred to Phase 8+
- Regular stakeholder reviews
- Clear scope documentation

#### Risk 6: Integration Complexity
**Probability:** Medium
**Impact:** High
**Mitigation:**
- Early integration testing (Week 4, 8, 12, etc.)
- Continuous integration (CI/CD)
- Comprehensive integration tests
- Staging environment for testing

---

## Success Criteria

### Phase 1 Success Criteria
✅ Process auditing runs on Windows, macOS, Linux
✅ Plugins can deploy and execute safely
✅ Allow2 API integration working
✅ < 2% CPU usage on average

### Phase 2 Success Criteria
✅ OS Plugin detects logged-in user
✅ Time tracking accurate to 30 seconds
✅ Logout enforcement working
✅ Toast notifications display

### Phase 3 Success Criteria
✅ Process killing works on all platforms
✅ Browser detection via classifications
✅ Internet time tracked separately
✅ Full Linux support (3 DEs)

### Phase 4 Success Criteria
✅ Connects to Home Assistant
✅ Xbox/PlayStation tracking working
✅ Device turn-off enforcement
✅ Parent UI for device linking

### Phase 5 Success Criteria
✅ WebSocket real-time tracking
✅ Shared device attribution
✅ Energy monitoring and cost calculation
✅ Smart TV tracking (3 brands)

### Phase 6 Success Criteria
✅ Browser detection (20+ browsers)
✅ Internet time tracking (process-level)
✅ Domain classification integration
✅ Cross-platform compatibility

### Phase 7 Success Criteria
✅ Browser extensions (Chrome, Firefox, Edge)
✅ Native messaging working
✅ Per-site time tracking
✅ Privacy compliance (COPPA/GDPR)

---

## Post-Implementation (Phase 8+)

### Enhancements for Future Consideration

**Phase 8: Advanced Analytics (Weeks 31-34)**
- Usage analytics dashboard
- Trend analysis
- Recommendations for parents
- Child progress reports

**Phase 9: Mobile App Integration (Weeks 35-40)**
- iOS/Android app tracking
- Screen time integration
- App-level quotas
- Notification controls

**Phase 10: Advanced Enforcement (Weeks 41-45)**
- Scheduled restrictions (bedtime, homework time)
- Location-based rules
- Reward systems (earn extra time)
- Temporary overrides (sick day, holiday)

**Phase 11: Platform Expansion (Weeks 46-50)**
- Chromebook support
- Raspberry Pi support
- Docker/containerized environments
- Cloud gaming platforms (GeForce Now, Stadia, etc.)

---

## Team Structure

### Recommended Team Composition

**Core Development Team:**
- 1x Lead Developer (full-stack, architecture decisions)
- 1x Backend Developer (plugins, API integration)
- 1x Frontend Developer (parent UI, configuration)
- 0.5x QA Engineer (testing, automation)

**Supporting Roles:**
- 1x Product Manager (roadmap, prioritization)
- 0.5x Technical Writer (documentation)
- 0.25x DevOps Engineer (CI/CD, deployment)

### Skills Required
- **Languages:** JavaScript/Node.js, Python (for some scripts)
- **Platforms:** Windows, macOS, Linux
- **APIs:** REST, WebSocket, Native Messaging
- **Databases:** SQLite
- **Security:** Sandboxing, code signing, permissions
- **Testing:** Jest, integration testing, e2e testing

---

## Budget Estimate

### Development Costs (30 weeks)

| Resource | Cost/Week | Weeks | Total |
|----------|-----------|-------|-------|
| Lead Developer | $3,000 | 30 | $90,000 |
| Backend Developer | $2,500 | 30 | $75,000 |
| Frontend Developer | $2,500 | 30 | $75,000 |
| QA Engineer (0.5) | $1,000 | 30 | $30,000 |
| Product Manager | $2,000 | 30 | $60,000 |
| Tech Writer (0.5) | $750 | 30 | $22,500 |
| DevOps (0.25) | $500 | 30 | $15,000 |
| **Total Labor** | | | **$367,500** |

### Infrastructure & Tools

| Item | Cost |
|------|------|
| CI/CD (GitHub Actions) | $500/month × 7.5 months = $3,750 |
| Test devices (Windows, Mac, Linux) | $5,000 (one-time) |
| Home Assistant test setup | $500 |
| Browser extension developer accounts | $25 (Chrome) + $0 (Firefox) = $25 |
| Allow2 API development credits | $1,000 |
| **Total Infrastructure** | **$10,275** |

### **Total Estimated Budget: $377,775**

---

## Conclusion

This implementation roadmap provides a **clear, phased approach** to building the allow2automate plugin system over 30 weeks.

### Key Takeaways

1. **Foundation First** - Build robust infrastructure before plugins
2. **Incremental Delivery** - Each phase delivers working functionality
3. **Risk Mitigation** - Identified risks with clear mitigation strategies
4. **Realistic Timeline** - 7.5 months for 3 complex plugins
5. **Budget Transparency** - Clear cost breakdown

### Next Steps

1. **Review and approve roadmap** with stakeholders
2. **Address HIGH priority items** from design review
3. **Assemble development team** (2-3 developers)
4. **Set up development environment** (CI/CD, test devices)
5. **Begin Phase 1 implementation** (Process Auditing System)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-15
**Approved By:** [Pending]
