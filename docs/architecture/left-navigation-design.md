# Architecture Design: Left Navigation Panel Migration

## Executive Summary

This document outlines the architecture for migrating from the current top tab navigation to a persistent left sidebar navigation panel in the Allow2Automate application.

## Current Architecture Analysis

### Current Structure (LoggedIn.js)
```
AppBar (Header)
├── Avatar + Name
└── Logout Button

Tabs (Horizontal)
├── Plugin Tab 1 (with status icon)
├── Plugin Tab 2 (with status icon)
├── ...
└── Settings Tab

TabPanel Content Area
├── Plugin Content (via PlugInTab)
└── Settings Content (via PlugIns)
```

### Current State Management
- **Component**: `LoggedIn.js` (lines 62-244)
- **State Shape**:
  ```javascript
  {
    currentTab: 'Allow2AutomateSettingsTab',  // Selected tab identifier
    toasts: []                                 // Toast notifications
  }
  ```
- **Tab Change**: `handleTabChange(el, tab)` updates `currentTab`
- **Tab Rendering**: Material-UI `<Tabs>` and `<Tab>` components
- **Content Display**: `<TabPanel>` conditionally renders based on `value === index`

### Current Dependencies
- Material-UI v4.11.3
- Available components: `Tabs`, `Tab`, `AppBar`, `Toolbar`, `Drawer`, `List`, `ListItem`, etc.
- React 16.12.0
- Redux for state management

## Target Architecture

### New Structure
```
┌─────────────────────────────────────────────┐
│ AppBar (Header)                             │
│ ├── Logo/Brand                              │
│ └── Settings Icon (cog) → Right aligned    │
└─────────────────────────────────────────────┘
┌─────────┬───────────────────────────────────┐
│         │                                   │
│ Drawer  │                                   │
│ (Left)  │   Main Content Area               │
│         │                                   │
│ List    │   TabPanel                        │
│ ├─ Icon │   ├─ PlugInTab Content           │
│ ├─ Name │   └─ Settings Content            │
│ └─ Icon │                                   │
│   (Status)                                  │
│         │                                   │
│ [Sorted │                                   │
│  Alpha] │                                   │
│         │                                   │
└─────────┴───────────────────────────────────┘
```

## Component Architecture

### 1. LoggedIn Component (Modified)

**File**: `/mnt/ai/automate/automate/app/components/LoggedIn.js`

#### Component Hierarchy
```
LoggedIn
├── AppBar (Header Bar - Redesigned)
│   ├── IconButton (Menu toggle - optional mobile)
│   ├── Typography (Brand/Title)
│   └── Box (Right-aligned actions)
│       └── IconButton (Settings cog)
│
├── Drawer (Persistent Left Sidebar - NEW)
│   └── List (Plugin Navigation)
│       ├── ListItem (Plugin 1)
│       │   ├── ListItemIcon (Plugin Icon)
│       │   ├── ListItemText (Plugin Name)
│       │   └── ListItemSecondaryAction (Status Icon)
│       ├── ListItem (Plugin 2)
│       ├── Divider
│       └── ...
│
└── Box (Main Content Area)
    ├── TabPanel (Plugin 1 Content)
    ├── TabPanel (Plugin 2 Content)
    └── TabPanel (Settings Content)
```

#### State Structure
```javascript
{
  currentTab: 'Allow2AutomateSettingsTab',  // Current selected plugin/view
  mobileOpen: false,                        // Mobile drawer state (future)
  toasts: []                                 // Toast notifications (existing)
}
```

#### Key Methods
```javascript
class LoggedIn extends Component {
  // Existing
  handleTabChange(pluginName) { ... }
  handleLogout() { ... }
  showToast(message, severity) { ... }
  handleCloseToast(id) { ... }

  // New
  handleDrawerToggle() { ... }              // Mobile drawer toggle
  handleNavigationClick(pluginName) { ... } // Left nav click handler
  renderPluginListItem(plugin) { ... }      // List item renderer
  renderStatusIcon(pluginStatus) { ... }    // Status icon renderer
}
```

### 2. NavigationDrawer Component (New)

**File**: `/mnt/ai/automate/automate/app/components/NavigationDrawer.js`

#### Purpose
Encapsulates left sidebar navigation logic for better separation of concerns.

#### Props Interface
```javascript
{
  plugins: Array<Plugin>,           // Sorted plugin list
  currentTab: string,               // Selected plugin name
  pluginStatuses: Object,           // Plugin status map
  onNavigate: Function,             // Navigation handler
  onSettingsClick: Function,        // Settings navigation (optional)
  width: number,                    // Drawer width (default: 240)
}
```

#### Component Structure
```javascript
const NavigationDrawer = ({
  plugins,
  currentTab,
  pluginStatuses,
  onNavigate,
  width = 240
}) => {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: width,
          boxSizing: 'border-box',
          top: 64,  // AppBar height
        },
      }}
    >
      <List>
        {plugins.map(plugin => (
          <PluginListItem
            key={plugin.name}
            plugin={plugin}
            status={pluginStatuses[plugin.name]}
            selected={currentTab === plugin.name}
            onClick={() => onNavigate(plugin.name)}
          />
        ))}
      </List>
    </Drawer>
  );
};
```

### 3. PluginListItem Component (New)

**File**: `/mnt/ai/automate/automate/app/components/PluginListItem.js`

#### Purpose
Individual plugin navigation item with icon + name + status.

#### Props Interface
```javascript
{
  plugin: Object,              // Plugin object
  status: Object,              // Status object { status, message }
  selected: boolean,           // Is currently selected
  onClick: Function,           // Click handler
}
```

#### Component Structure
```javascript
const PluginListItem = ({ plugin, status, selected, onClick }) => {
  const statusIcon = getStatusIcon(status);
  const pluginIcon = getPluginIcon(plugin);

  return (
    <ListItem
      button
      selected={selected}
      onClick={onClick}
      sx={{
        '&.Mui-selected': {
          backgroundColor: 'action.selected',
          borderLeft: '4px solid primary.main',
        },
      }}
    >
      <ListItemIcon>
        {pluginIcon || <ExtensionIcon />}
      </ListItemIcon>

      <ListItemText
        primary={plugin.shortName || plugin.name}
        primaryTypographyProps={{
          fontSize: 14,
          fontWeight: selected ? 600 : 400,
        }}
      />

      <ListItemSecondaryAction>
        <Tooltip title={status?.message || 'Status unknown'}>
          {statusIcon}
        </Tooltip>
      </ListItemSecondaryAction>
    </ListItem>
  );
};
```

### 4. Header Component (Modified)

**File**: `/mnt/ai/automate/automate/app/components/LoggedIn.js` (integrated)

#### Current Header (lines 133-139)
```javascript
<AppBar position="static">
  <Toolbar>
    {avatar}
    {name}
    <Button label="Log Off" onClick={this.handleLogout} />
  </Toolbar>
</AppBar>
```

#### New Header Design
```javascript
<AppBar
  position="fixed"
  sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
>
  <Toolbar>
    {/* Left side - Logo/Brand */}
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {avatar}
      <Typography variant="h6" sx={{ ml: 2 }}>
        {name}
      </Typography>
    </Box>

    {/* Spacer */}
    <Box sx={{ flexGrow: 1 }} />

    {/* Right side - Settings */}
    <IconButton
      color="inherit"
      onClick={() => this.handleNavigationClick('Allow2AutomateSettingsTab')}
      aria-label="settings"
    >
      <SettingsIcon />
    </IconButton>

    {/* Logout can stay as menu or separate button */}
    <IconButton
      color="inherit"
      onClick={this.handleLogout}
      aria-label="logout"
    >
      <ExitToAppIcon />
    </IconButton>
  </Toolbar>
</AppBar>
```

## Data Flow Architecture

### Navigation Flow
```
User Click on Plugin List Item
       ↓
PluginListItem.onClick()
       ↓
NavigationDrawer.onNavigate(pluginName)
       ↓
LoggedIn.handleNavigationClick(pluginName)
       ↓
setState({ currentTab: pluginName })
       ↓
Re-render with updated TabPanel visibility
       ↓
Content area shows selected plugin
```

### Status Update Flow (Unchanged)
```
Plugin Component
       ↓
statusUpdate({ status, message })
       ↓
ipcRenderer.send('plugin.status.update', data)
       ↓
Redux Store Update
       ↓
Props propagate to LoggedIn
       ↓
Status icons update in NavigationDrawer
```

## State Management

### Redux Store (Unchanged)
```javascript
{
  plugins: {
    installedPlugins: { ... },
    configurations: { ... },
    pluginStatuses: { ... },  // Status map by plugin name
  },
  user: { ... },
  // ... other state
}
```

### Component State (LoggedIn)
```javascript
{
  currentTab: string,        // Selected plugin/view identifier
  mobileOpen: boolean,       // Mobile drawer open state (future)
  toasts: Array<Toast>,      // Toast notifications
}
```

## Icon Integration Strategy

### Status Icons (Existing - lines 143-156)
```javascript
const getStatusIcon = (pluginStatus) => {
  if (!pluginStatus || pluginStatus.status === 'unconfigured') {
    return <HelpOutline style={{ color: '#FFA500' }} />;
  }
  if (pluginStatus.status === 'error') {
    return <Error style={{ color: '#F44336' }} />;
  }
  if (pluginStatus.status === 'warning' || pluginStatus.status === 'disconnected') {
    return <Warning style={{ color: '#FF9800' }} />;
  }
  if (pluginStatus.status === 'connected' || pluginStatus.status === 'configured') {
    return <CheckCircle style={{ color: '#4CAF50' }} />;
  }
  return null;
};
```

### Plugin Icons (New)
```javascript
const getPluginIcon = (plugin) => {
  // Strategy 1: Plugin provides icon in package.json
  if (plugin.packageJson?.icon) {
    return <img src={plugin.packageJson.icon} alt="" />;
  }

  // Strategy 2: Icon mapping by plugin name
  const iconMap = {
    'allow2automate-sonoff': <WifiIcon />,
    'allow2automate-tasmota': <DevicesOtherIcon />,
    'allow2automate-hue': <EmojiObjectsIcon />,
    // ... add mappings
  };

  if (iconMap[plugin.name]) {
    return iconMap[plugin.name];
  }

  // Strategy 3: Dev plugin indicator
  if (plugin.dev_plugin) {
    return <CodeIcon />;
  }

  // Default fallback
  return <ExtensionIcon />;
};
```

### Settings Icon (New - AppBar)
```javascript
import SettingsIcon from '@material-ui/icons/Settings';

<IconButton onClick={() => handleNavigationClick('Allow2AutomateSettingsTab')}>
  <SettingsIcon />
</IconButton>
```

## Layout & Styling

### Drawer Specifications
```javascript
const drawerWidth = 240;  // 240px is Material-UI standard

const drawerStyles = {
  width: drawerWidth,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    boxSizing: 'border-box',
    top: 64,              // AppBar height offset
    height: 'calc(100vh - 64px)',
    borderRight: '1px solid',
    borderColor: 'divider',
    backgroundColor: 'background.paper',
  },
};
```

### Main Content Area
```javascript
const mainContentStyles = {
  flexGrow: 1,
  marginLeft: `${drawerWidth}px`,
  marginTop: '64px',     // AppBar height
  padding: 3,
  minHeight: 'calc(100vh - 64px)',
  backgroundColor: 'background.default',
};
```

### Responsive Considerations (Future)
```javascript
// Mobile: Temporary drawer
const isDesktop = useMediaQuery(theme => theme.breakpoints.up('md'));

<Drawer
  variant={isDesktop ? 'permanent' : 'temporary'}
  open={isDesktop || mobileOpen}
  onClose={handleDrawerToggle}
  // ... other props
/>
```

## Migration Path

### Phase 1: Minimal Changes (Proof of Concept)
**Goal**: Replace tabs with left nav, minimal disruption
**Changes**:
1. Add `Drawer` component with basic `List`
2. Replace `Tabs` with drawer navigation
3. Move Settings to header cog icon
4. Keep existing state management
5. Maintain current TabPanel rendering

**Files Modified**:
- `/mnt/ai/automate/automate/app/components/LoggedIn.js`

**Estimated Effort**: 4-6 hours

### Phase 2: Refactor & Enhance
**Goal**: Extract components, add polish
**Changes**:
1. Create `NavigationDrawer.js` component
2. Create `PluginListItem.js` component
3. Add plugin icons via icon mapping
4. Improve styling and hover states
5. Add keyboard navigation

**Files Created**:
- `/mnt/ai/automate/automate/app/components/NavigationDrawer.js`
- `/mnt/ai/automate/automate/app/components/PluginListItem.js`

**Estimated Effort**: 6-8 hours

### Phase 3: Mobile Responsiveness (Optional)
**Goal**: Adaptive layout for mobile
**Changes**:
1. Add responsive drawer (temporary on mobile)
2. Add hamburger menu icon
3. Handle touch interactions
4. Optimize for smaller screens

**Estimated Effort**: 4-6 hours

## Component Props & State Reference

### LoggedIn Component

#### Props (from Redux)
```javascript
{
  user: Object,                    // User data
  installedPlugins: Object,        // Plugin map
  configurations: Object,          // Plugin configurations
  pluginStatuses: Object,          // Plugin status map
  dispatch: Function,              // Redux dispatch
  onLogout: Function,              // Logout handler
  onUpdateConfiguration: Function, // Configuration update handler
  onPluginInstalled: Function,     // Plugin install handler
  onPluginRemoved: Function,       // Plugin remove handler
  onSetPluginEnabled: Function,    // Plugin enable/disable handler
}
```

#### State
```javascript
{
  currentTab: string,              // 'plugin-name' or 'Allow2AutomateSettingsTab'
  mobileOpen: boolean,             // Mobile drawer state
  toasts: Array<{                  // Toast notifications
    id: number,
    message: string,
    severity: 'info'|'success'|'warning'|'error'
  }>
}
```

### NavigationDrawer Component

#### Props
```javascript
{
  plugins: Array<{                 // Sorted active plugins
    name: string,
    shortName: string,
    version: string,
    packageJson: Object,
    disabled: boolean,
    dev_plugin: boolean,
  }>,
  currentTab: string,              // Selected tab
  pluginStatuses: Object<{         // Status by plugin name
    status: 'unconfigured'|'error'|'warning'|'disconnected'|'connected'|'configured',
    message: string,
  }>,
  onNavigate: Function,            // (pluginName: string) => void
  width?: number,                  // Drawer width (default: 240)
}
```

### PluginListItem Component

#### Props
```javascript
{
  plugin: Object,                  // Plugin object
  status: {                        // Plugin status
    status: string,
    message: string,
  },
  selected: boolean,               // Is currently selected
  onClick: Function,               // () => void
}
```

## Material-UI Components Used

### Existing (Available)
- `AppBar` - Header bar
- `Toolbar` - AppBar content wrapper
- `Avatar` - User avatar
- `Button` - Action buttons
- `IconButton` - Icon-only buttons
- `Typography` - Text elements
- `Box` - Layout container
- `Snackbar` - Toast notifications
- `Tooltip` - Status tooltips

### New Additions
- `Drawer` - Left sidebar container
- `List` - Navigation list container
- `ListItem` - Individual navigation item
- `ListItemIcon` - Icon on left side of item
- `ListItemText` - Text content of item
- `ListItemSecondaryAction` - Status icon on right
- `Divider` - Visual separator

### Icons (from @material-ui/icons)
**Existing**:
- `HelpOutline` - Unconfigured status
- `Error` - Error status
- `Warning` - Warning/disconnected status
- `CheckCircle` - Success/connected status
- `SocialPerson` - User avatar fallback

**New**:
- `Settings` - Settings navigation
- `ExitToApp` - Logout button
- `Extension` - Default plugin icon
- `Code` - Dev plugin icon
- `Menu` - Mobile menu toggle (future)
- Plugin-specific icons (Wifi, DevicesOther, EmojiObjects, etc.)

## Sorting Algorithm

### Current Implementation
Plugins are sorted via `sortedActivePluginSelector` (from selectors)

### Required: Alphabetical Sorting
```javascript
// In selectors.js or NavigationDrawer.js
const sortPluginsAlphabetically = (plugins) => {
  return [...plugins].sort((a, b) => {
    const nameA = (a.shortName || a.name).toLowerCase();
    const nameB = (b.shortName || b.name).toLowerCase();
    return nameA.localeCompare(nameB);
  });
};
```

### Application
```javascript
// In LoggedIn.render() or NavigationDrawer
const sortedPlugins = sortPluginsAlphabetically(
  sortedActivePluginSelector(this.props)
);
```

## Testing Considerations

### Unit Tests
1. **NavigationDrawer Component**
   - Renders correct number of list items
   - Applies selected state correctly
   - Calls onNavigate with correct plugin name
   - Renders status icons correctly

2. **PluginListItem Component**
   - Renders plugin name/shortName
   - Shows correct status icon based on status
   - Handles click events
   - Applies selected styling

3. **LoggedIn Component**
   - handleNavigationClick updates state
   - Drawer renders with correct props
   - Settings button navigates correctly
   - Toast notifications still work

### Integration Tests
1. Click navigation item changes content area
2. Plugin status updates reflect in navigation
3. Settings button shows settings panel
4. Logout functionality preserved

### Visual Regression Tests
1. Drawer width and positioning
2. List item hover states
3. Selected item highlighting
4. Status icon colors
5. Mobile responsiveness (future)

## Performance Considerations

### Re-render Optimization
```javascript
// Memoize plugin list items
const PluginListItem = React.memo(({ plugin, status, selected, onClick }) => {
  // ... component
}, (prevProps, nextProps) => {
  return (
    prevProps.selected === nextProps.selected &&
    prevProps.status?.status === nextProps.status?.status &&
    prevProps.plugin.name === nextProps.plugin.name
  );
});
```

### Avoid Unnecessary Re-renders
- Use `React.memo` for list items
- Memoize sorted plugin list with `useMemo` or `reselect`
- Only re-render status icons when status actually changes

## Accessibility (a11y)

### ARIA Labels
```javascript
<Drawer aria-label="Plugin navigation">
  <List role="navigation">
    <ListItem
      button
      role="button"
      aria-label={`Navigate to ${plugin.name}`}
      aria-current={selected ? 'page' : undefined}
    >
      {/* ... */}
    </ListItem>
  </List>
</Drawer>
```

### Keyboard Navigation
- Tab key moves between list items
- Enter/Space activates selected item
- Arrow keys navigate list (Material-UI default)
- Escape closes mobile drawer (future)

### Screen Reader Support
- Announce current selection
- Announce status changes
- Provide meaningful labels for icons

## Risk Assessment

### High Risk
1. **Breaking plugin rendering**: Changing LoggedIn structure could affect plugin display
   - **Mitigation**: Keep TabPanel logic identical, only change navigation UI

2. **State management issues**: Incorrectly updating currentTab state
   - **Mitigation**: Thorough testing of navigation flow

### Medium Risk
1. **Performance degradation**: Many plugins cause slow list rendering
   - **Mitigation**: Implement memoization and virtualization (if needed)

2. **Style conflicts**: Drawer overlaps content or creates layout issues
   - **Mitigation**: Use Material-UI layout best practices, thorough CSS testing

### Low Risk
1. **Icon loading failures**: Missing plugin icons
   - **Mitigation**: Always provide fallback icon

2. **Mobile layout issues**: Drawer doesn't work on small screens
   - **Mitigation**: Phase 3 handles mobile, desktop-first approach

## Success Metrics

### Functional
- [ ] All plugins accessible via left navigation
- [ ] Settings accessible via header cog icon
- [ ] Plugin status icons display correctly
- [ ] Selected plugin highlights in navigation
- [ ] Content area displays correct plugin
- [ ] Toast notifications still work
- [ ] Logout functionality preserved

### Non-Functional
- [ ] No performance degradation
- [ ] Navigation feels responsive (< 100ms)
- [ ] Visual design matches mockups
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] Mobile layout works (Phase 3)

## Open Questions

1. **Plugin icon specification**: Should plugins provide their own icons in package.json?
   - **Recommendation**: Add optional `icon` field to package.json, use icon mapping as fallback

2. **Settings location**: Header right corner or bottom of plugin list?
   - **Recommendation**: Header right corner (cog icon) for accessibility

3. **Mobile strategy**: Temporary drawer or hide sidebar?
   - **Recommendation**: Temporary drawer with hamburger menu (Phase 3)

4. **Avatar/user info**: Keep in header or move to sidebar?
   - **Recommendation**: Keep in header left side for consistency

5. **Logout button**: Header or dropdown menu?
   - **Recommendation**: Icon button in header right (ExitToApp icon)

## File Structure

```
app/
├── components/
│   ├── LoggedIn.js                 (MODIFIED - main layout)
│   ├── NavigationDrawer.js         (NEW - left sidebar)
│   ├── PluginListItem.js           (NEW - nav list item)
│   ├── PlugIns.js                  (UNCHANGED - settings content)
│   └── Plugin.js                   (UNCHANGED - plugin content)
├── containers/
│   └── PluginTab.js                (UNCHANGED)
├── selectors/
│   └── index.js                    (MODIFIED - add alphabetical sorting)
└── styles/
    └── navigation.css              (NEW - drawer styles if needed)
```

## Dependencies

### Required (Already Available)
- @material-ui/core@4.11.3
- @material-ui/icons@4.11.2
- react@16.12.0
- react-redux@5.1.2

### No New Dependencies Required

## Conclusion

This architecture provides a clear migration path from horizontal tabs to a vertical left navigation panel while maintaining backward compatibility with existing plugins and state management. The phased approach allows for incremental implementation and testing, reducing risk.

The design leverages Material-UI's Drawer component with proper layout considerations, maintains existing plugin status functionality, and provides extensibility for future enhancements like custom plugin icons and mobile responsiveness.
