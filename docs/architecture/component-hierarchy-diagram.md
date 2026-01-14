# Component Hierarchy Diagram

## Current Architecture (Top Tabs)

```
LoggedIn
├── AppBar (position: static)
│   └── Toolbar
│       ├── Avatar
│       ├── Typography (name)
│       └── Button (logout)
│
├── Tabs (horizontal, value: currentTab)
│   ├── Tab (plugin1) [label: {icon + name}]
│   ├── Tab (plugin2) [label: {icon + name}]
│   ├── ...
│   └── Tab (Settings) [label: "Settings"]
│
├── TabPanel (plugin1) [hidden: currentTab !== plugin1]
│   └── PlugInTab (plugin={...})
│       └── Plugin (TabContent)
│
├── TabPanel (plugin2) [hidden: currentTab !== plugin2]
│   └── PlugInTab (plugin={...})
│
├── ...
│
├── TabPanel (Settings) [hidden: currentTab !== 'Allow2AutomateSettingsTab']
│   └── PlugIns
│       ├── AgentManagement
│       ├── Header (Add Plugin button)
│       ├── TableContainer
│       │   └── Table (installed plugins)
│       └── MarketplacePage (modal overlay)
│
└── Snackbar[] (toast notifications)
```

## New Architecture (Left Navigation)

```
LoggedIn
├── AppBar (position: fixed, zIndex: drawer + 1)
│   └── Toolbar
│       ├── Box (left aligned)
│       │   ├── Avatar
│       │   └── Typography (name)
│       ├── Box (flex spacer)
│       └── Box (right aligned)
│           ├── IconButton (Settings)
│           │   └── SettingsIcon
│           └── IconButton (Logout)
│               └── ExitToAppIcon
│
├── Box (display: flex, main container)
│   │
│   ├── Drawer (permanent, left side, width: 240px)
│   │   └── List (navigation list)
│   │       ├── PluginListItem (plugin1)
│   │       │   ├── ListItemIcon
│   │       │   │   └── [PluginIcon | ExtensionIcon]
│   │       │   ├── ListItemText
│   │       │   │   └── primary: plugin.shortName
│   │       │   └── ListItemSecondaryAction
│   │       │       └── Tooltip (status message)
│   │       │           └── [StatusIcon]
│   │       │
│   │       ├── PluginListItem (plugin2)
│   │       │   ├── ListItemIcon
│   │       │   ├── ListItemText
│   │       │   └── ListItemSecondaryAction
│   │       │
│   │       ├── ...
│   │       │
│   │       ├── Divider (optional, if needed)
│   │       │
│   │       └── [Plugins sorted alphabetically]
│   │
│   └── Box (main content, marginLeft: 240px, marginTop: 64px)
│       │
│       ├── TabPanel (plugin1) [hidden: currentTab !== plugin1]
│       │   └── PlugInTab (plugin={...})
│       │       └── Plugin (TabContent)
│       │
│       ├── TabPanel (plugin2) [hidden: currentTab !== plugin2]
│       │   └── PlugInTab (plugin={...})
│       │
│       ├── ...
│       │
│       └── TabPanel (Settings) [hidden: currentTab !== 'Allow2AutomateSettingsTab']
│           └── PlugIns
│               ├── AgentManagement
│               ├── Header (Add Plugin button)
│               ├── TableContainer
│               │   └── Table (installed plugins)
│               └── MarketplacePage (modal overlay)
│
└── Snackbar[] (toast notifications, position: bottom-right)
```

## New Components Detail

### NavigationDrawer (Extracted Component)

```
NavigationDrawer (props: plugins, currentTab, pluginStatuses, onNavigate)
└── Drawer
    └── List
        └── {plugins.map(plugin =>
            PluginListItem
            ├── key: plugin.name
            ├── plugin: plugin
            ├── status: pluginStatuses[plugin.name]
            ├── selected: currentTab === plugin.name
            └── onClick: () => onNavigate(plugin.name)
        )}
```

### PluginListItem (New Component)

```
PluginListItem (props: plugin, status, selected, onClick)
└── ListItem (button, selected={selected})
    ├── ListItemIcon
    │   └── [getPluginIcon(plugin) || <ExtensionIcon />]
    │
    ├── ListItemText
    │   └── primary: plugin.shortName || plugin.name
    │       primaryTypographyProps:
    │         - fontSize: 14
    │         - fontWeight: selected ? 600 : 400
    │
    └── ListItemSecondaryAction
        └── Tooltip (title: status?.message || 'Status unknown')
            └── [getStatusIcon(status)]
                ├── <HelpOutline /> (unconfigured, color: #FFA500)
                ├── <Error /> (error, color: #F44336)
                ├── <Warning /> (warning/disconnected, color: #FF9800)
                └── <CheckCircle /> (connected/configured, color: #4CAF50)
```

## Layout Structure (Visual)

### Desktop Layout (>= 960px)

```
┌─────────────────────────────────────────────────────────────────┐
│ AppBar (64px height, fixed, z-index: 1201)                      │
│ ┌──────────────┐                            ┌─────────────────┐ │
│ │ Avatar + Name│                            │ Settings | Exit │ │
│ └──────────────┘                            └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
┌────────────────┬────────────────────────────────────────────────┐
│                │                                                │
│ Drawer         │ Main Content (flex-grow: 1)                   │
│ 240px width    │ margin-left: 240px                            │
│ fixed height   │ margin-top: 64px                              │
│ top: 64px      │ padding: 24px                                 │
│                │                                                │
│ ┌────────────┐ │ ┌─────────────────────────────────────────┐   │
│ │ Plugin 1   │ │ │                                         │   │
│ │  ✓         │ │ │                                         │   │
│ └────────────┘ │ │                                         │   │
│ ┌────────────┐ │ │        TabPanel Content                 │   │
│ │ Plugin 2   │ │ │        (Plugin or Settings)             │   │
│ │  ⚠         │ │ │                                         │   │
│ └────────────┘ │ │                                         │   │
│ ┌────────────┐ │ │                                         │   │
│ │ Plugin 3   │ │ │                                         │   │
│ │  ●         │ │ │                                         │   │
│ └────────────┘ │ └─────────────────────────────────────────┘   │
│ ┌────────────┐ │                                                │
│ │ ...        │ │                                                │
│ └────────────┘ │                                                │
│                │                                                │
│                │                                                │
└────────────────┴────────────────────────────────────────────────┘
                                                       ┌──────────┐
                                                       │ Toast    │
                                                       │ Notify   │
                                                       └──────────┘
```

### Mobile Layout (< 960px) - Future Phase 3

```
┌─────────────────────────────────────────────┐
│ AppBar (fixed)                              │
│ ┌───┐ Brand        Settings | Exit          │
│ │ ☰ │                                       │
│ └───┘                                       │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│        Main Content (full width)           │
│        margin-top: 64px                    │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │                                    │    │
│  │                                    │    │
│  │    TabPanel Content                │    │
│  │    (Plugin or Settings)            │    │
│  │                                    │    │
│  │                                    │    │
│  └────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘

(Drawer temporary, slides in from left when ☰ clicked)
```

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    LoggedIn Component State                  │
│                                                              │
│  {                                                           │
│    currentTab: 'plugin-name' | 'Allow2AutomateSettingsTab', │
│    mobileOpen: false,                                        │
│    toasts: []                                                │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
    ┌───────────────────────────────────────────────┐
    │                                               │
    ↓                                               ↓
┌─────────────────────┐                  ┌──────────────────────┐
│ NavigationDrawer    │                  │ TabPanel (Content)   │
│                     │                  │                      │
│ currentTab prop     │                  │ value === currentTab │
│   ↓                 │                  │   ↓                  │
│ Highlights selected │                  │ Show/hide content    │
│ plugin in list      │                  │                      │
└─────────────────────┘                  └──────────────────────┘
         ↓
    User clicks plugin
         ↓
    onNavigate(pluginName)
         ↓
    handleNavigationClick(pluginName)
         ↓
    setState({ currentTab: pluginName })
         ↓
    Re-render both components
```

## Plugin Status Flow

```
┌────────────────────────────────────────────────────────┐
│                   Redux Store                          │
│                                                        │
│  {                                                     │
│    plugins: {                                          │
│      pluginStatuses: {                                 │
│        'allow2automate-plugin1': {                     │
│          status: 'connected',                          │
│          message: 'All systems operational'            │
│        },                                              │
│        'allow2automate-plugin2': {                     │
│          status: 'error',                              │
│          message: 'Connection failed'                  │
│        }                                               │
│      }                                                 │
│    }                                                   │
│  }                                                     │
└────────────────────────────────────────────────────────┘
                        │
                        │ mapStateToProps
                        ↓
┌────────────────────────────────────────────────────────┐
│              LoggedIn (props.pluginStatuses)           │
└────────────────────────────────────────────────────────┘
                        │
                        │ pass as prop
                        ↓
┌────────────────────────────────────────────────────────┐
│         NavigationDrawer (pluginStatuses prop)         │
└────────────────────────────────────────────────────────┘
                        │
                        │ map over plugins
                        ↓
┌────────────────────────────────────────────────────────┐
│   PluginListItem (status={pluginStatuses[plugin.name]})│
│                                                        │
│   getStatusIcon(status) renders:                       │
│   ├── <CheckCircle /> (connected/configured) - Green  │
│   ├── <Warning /> (warning/disconnected) - Orange     │
│   ├── <Error /> (error) - Red                         │
│   └── <HelpOutline /> (unconfigured) - Orange         │
└────────────────────────────────────────────────────────┘
```

## Icon Strategy

### Plugin Icon Resolution

```
getPluginIcon(plugin)
    │
    ├── Check: plugin.packageJson?.icon exists?
    │   └── Yes → <img src={plugin.packageJson.icon} />
    │
    ├── Check: iconMap[plugin.name] exists?
    │   └── Yes → iconMap[plugin.name]
    │       ├── 'allow2automate-sonoff' → <WifiIcon />
    │       ├── 'allow2automate-tasmota' → <DevicesOtherIcon />
    │       ├── 'allow2automate-hue' → <EmojiObjectsIcon />
    │       └── ...
    │
    ├── Check: plugin.dev_plugin === true?
    │   └── Yes → <CodeIcon />
    │
    └── Default → <ExtensionIcon />
```

### Status Icon Resolution

```
getStatusIcon(pluginStatus)
    │
    ├── status === 'unconfigured' or status is null
    │   └── <HelpOutline color="#FFA500" /> (orange question mark)
    │
    ├── status === 'error'
    │   └── <Error color="#F44336" /> (red X)
    │
    ├── status === 'warning' or status === 'disconnected'
    │   └── <Warning color="#FF9800" /> (orange warning)
    │
    ├── status === 'connected' or status === 'configured'
    │   └── <CheckCircle color="#4CAF50" /> (green checkmark)
    │
    └── Default
        └── null (no icon)
```

## Event Flow

### Navigation Click Event

```
User clicks "Plugin 2" in NavigationDrawer
         ↓
PluginListItem onClick fires
         ↓
NavigationDrawer onNavigate('allow2automate-plugin2')
         ↓
LoggedIn handleNavigationClick('allow2automate-plugin2')
         ↓
LoggedIn setState({ currentTab: 'allow2automate-plugin2' })
         ↓
React re-render triggered
         ↓
┌────────────────────────────────────────────────┐
│ NavigationDrawer receives new currentTab prop  │
│   - Plugin 2 ListItem gets selected=true       │
│   - Plugin 2 ListItem applies selected styling │
│   - Other ListItems get selected=false         │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ TabPanel components re-evaluate visibility     │
│   - Plugin 2 TabPanel: hidden=false (visible)  │
│   - Other TabPanels: hidden=true (hidden)      │
└────────────────────────────────────────────────┘
         ↓
User sees Plugin 2 content
```

### Settings Click Event

```
User clicks Settings icon in AppBar
         ↓
IconButton onClick fires
         ↓
LoggedIn handleNavigationClick('Allow2AutomateSettingsTab')
         ↓
LoggedIn setState({ currentTab: 'Allow2AutomateSettingsTab' })
         ↓
React re-render triggered
         ↓
┌────────────────────────────────────────────────┐
│ NavigationDrawer receives new currentTab prop  │
│   - All plugin ListItems get selected=false    │
│   - (Settings not in drawer, so no highlight)  │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ TabPanel components re-evaluate visibility     │
│   - Settings TabPanel: hidden=false (visible)  │
│   - Plugin TabPanels: hidden=true (hidden)     │
└────────────────────────────────────────────────┘
         ↓
User sees Settings content (PlugIns component)
```

## Component Interaction Matrix

```
┌───────────────┬────────────┬───────────────┬──────────────┬──────────┐
│   Component   │  Parent    │    Children   │   Props In   │Props Out │
├───────────────┼────────────┼───────────────┼──────────────┼──────────┤
│ LoggedIn      │ Container  │ AppBar        │ Redux state  │ N/A      │
│               │            │ NavigationDr. │ dispatch     │          │
│               │            │ TabPanel[]    │ callbacks    │          │
│               │            │ Snackbar[]    │              │          │
├───────────────┼────────────┼───────────────┼──────────────┼──────────┤
│ NavigationDr. │ LoggedIn   │ List          │ plugins      │onNavigate│
│               │            │ PluginListI[] │ currentTab   │          │
│               │            │               │pluginStatuses│          │
├───────────────┼────────────┼───────────────┼──────────────┼──────────┤
│ PluginListI.  │ NavigationDr│ ListItemIcon │ plugin       │ onClick  │
│               │            │ ListItemText  │ status       │          │
│               │            │ ListItemSecA. │ selected     │          │
├───────────────┼────────────┼───────────────┼──────────────┼──────────┤
│ TabPanel      │ LoggedIn   │ PlugInTab or  │ value        │ N/A      │
│               │            │ PlugIns       │ index        │          │
│               │            │               │ children     │          │
├───────────────┼────────────┼───────────────┼──────────────┼──────────┤
│ PlugInTab     │ TabPanel   │ Plugin        │ plugin       │onUpdate  │
│               │            │               │ data         │Config    │
│               │            │               │ user/children│          │
├───────────────┼────────────┼───────────────┼──────────────┼──────────┤
│ PlugIns       │ TabPanel   │ AgentMgmt     │ Redux state  │ callbacks│
│               │            │ Table         │ callbacks    │          │
│               │            │ Marketplace   │              │          │
└───────────────┴────────────┴───────────────┴──────────────┴──────────┘
```

## Styling Hierarchy

```
LoggedIn
│
├── AppBar
│   └── sx: { zIndex: (theme) => theme.zIndex.drawer + 1 }
│
├── Drawer
│   └── sx: {
│         width: 240,
│         flexShrink: 0,
│         '& .MuiDrawer-paper': {
│           width: 240,
│           boxSizing: 'border-box',
│           top: 64,
│           height: 'calc(100vh - 64px)',
│           borderRight: '1px solid',
│           borderColor: 'divider',
│           backgroundColor: 'background.paper'
│         }
│       }
│
├── Box (main content)
│   └── sx: {
│         flexGrow: 1,
│         marginLeft: '240px',
│         marginTop: '64px',
│         padding: 3,
│         minHeight: 'calc(100vh - 64px)',
│         backgroundColor: 'background.default'
│       }
│
└── ListItem (selected)
    └── sx: {
          '&.Mui-selected': {
            backgroundColor: 'action.selected',
            borderLeft: '4px solid',
            borderColor: 'primary.main'
          },
          '&:hover': {
            backgroundColor: 'action.hover'
          }
        }
```

## Render Performance Tree

```
LoggedIn (renders on state.currentTab change)
│
├── AppBar (static, doesn't re-render)
│   ├── Avatar (static)
│   ├── Typography (static)
│   └── IconButtons (static)
│
├── NavigationDrawer (re-renders on currentTab change)
│   └── List
│       └── PluginListItem[] (each memoized)
│           ├── Re-renders only if:
│           │   - selected prop changes
│           │   - status.status changes
│           │   - plugin.name changes
│           └── Memoization prevents unnecessary re-renders
│
├── TabPanel[] (all evaluate visibility, but only one renders content)
│   ├── TabPanel (plugin1)
│   │   └── {currentTab === plugin1 ? <PlugInTab /> : null}
│   ├── TabPanel (plugin2)
│   │   └── {currentTab === plugin2 ? <PlugInTab /> : null}
│   └── TabPanel (Settings)
│       └── {currentTab === 'Settings' ? <PlugIns /> : null}
│
└── Snackbar[] (independent, render on toasts state change)
```

## Comparison: Before vs After

### Before (Current)

```
Advantages:
+ Familiar horizontal tab pattern
+ Visible plugin status at a glance
+ Easy to switch between plugins
+ All plugins visible without scrolling (if few plugins)

Disadvantages:
- Horizontal space limited (6-8 tabs max comfortably)
- Status icons small and cramped
- Settings tab mixed with plugins
- Doesn't scale well with many plugins
- Mobile unfriendly
```

### After (New Design)

```
Advantages:
+ Unlimited vertical space for plugins
+ Clear visual hierarchy (plugins in sidebar, settings in header)
+ Larger status icons with tooltips
+ Alphabetical sorting easy to scan
+ More content area space
+ Better mobile adaptation potential
+ Modern application layout pattern
+ Status icons more prominent

Disadvantages:
- Requires horizontal screen space (240px drawer)
- Less immediate visibility of all plugins (scrolling may be needed)
- Slightly more clicks (sidebar click vs tab click - similar)
- Learning curve for users accustomed to tabs
```

## Summary

The new left navigation architecture provides:
1. **Better scalability**: Unlimited vertical space vs limited horizontal space
2. **Clearer information hierarchy**: Plugins in sidebar, settings in header
3. **Improved usability**: Larger click targets, better status visibility
4. **Modern UX pattern**: Matches contemporary application design
5. **Future extensibility**: Easy to add search, categories, favorites, etc.

The component structure maintains backward compatibility with existing plugin rendering while providing a modern, maintainable navigation system.
