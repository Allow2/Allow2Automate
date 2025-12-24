# Material-UI v5 Component Migration Checklist

## Project: Allow2Automate
**Migration Date:** 2025-12-22
**Current Version:** @material-ui/core@4.11.3
**Target Version:** @mui/material@5.15.0

---

## Component Files Analysis (12 total)

### ✅ Priority 1: Critical Components (Must Fix First)

#### 1. app/app.js
- **Effort:** 15 minutes
- **Changes Required:**
  - [ ] Update ThemeProvider import
  - [ ] Change from `ThemeProvider as MuiThemeProvider` to `ThemeProvider`
  - [ ] Update import path: `@mui/material/styles`
- **Risk Level:** LOW
- **Dependencies:** None

#### 2. app/components/Login.js
- **Effort:** 45 minutes
- **Changes Required:**
  - [ ] Fix TextField props: `floatingLabelText` → `label`
  - [ ] Fix TextField props: `hintText` → `placeholder`
  - [ ] Restructure AppBar completely
  - [ ] Fix Person icon import (currently broken)
  - [ ] Convert to Toolbar composition pattern
  - [ ] Remove `label` prop from Button
- **Risk Level:** MEDIUM
- **Breaking Changes:** 6
- **Test Cases:**
  - Email input renders
  - Password input renders
  - Login button works
  - AppBar displays correctly

#### 3. app/components/LoggedIn.js
- **Effort:** 60 minutes
- **Changes Required:**
  - [ ] Update Table structure (TableHeader → TableHead)
  - [ ] Replace TableHeaderColumn with TableCell
  - [ ] Replace TableRowColumn with TableCell
  - [ ] Fix Tabs onChange handler signature
  - [ ] Remove `label` prop from Button
  - [ ] Fix Person icon import
  - [ ] Update AppBar to Toolbar pattern
- **Risk Level:** HIGH
- **Breaking Changes:** 7+
- **Test Cases:**
  - Main page renders
  - Tab switching works
  - User info displays
  - Logout button functions
  - Plugin tabs render

#### 4. app/components/Pair.js
- **Effort:** 60 minutes
- **Changes Required:**
  - [ ] Fix LinearProgress: `mode` → `variant`
  - [ ] Restructure AppBar completely
  - [ ] Remove `title`, `iconElementLeft`, `iconElementRight`
  - [ ] Add Toolbar composition
  - [ ] Add Typography for title
  - [ ] Remove Button `label` prop
  - [ ] Fix Table structure (already partially done)
- **Risk Level:** HIGH
- **Breaking Changes:** 6
- **Test Cases:**
  - Modal opens correctly
  - Progress indicator shows
  - Child selection works
  - Cancel button works
  - Device info displays

#### 5. app/components/PlugIns.js
- **Effort:** 45 minutes
- **Changes Required:**
  - [ ] Remove Button `label` prop (Reinstall button)
  - [ ] Verify Table structure (already updated)
  - [ ] Check IconButton color props
  - [ ] Verify Delete icon import
  - [ ] Test TextField component
- **Risk Level:** MEDIUM
- **Breaking Changes:** 2
- **Test Cases:**
  - Plugin table renders
  - Install plugin works
  - Delete plugin works
  - Enable/disable toggle works
  - Reinstall button functions

---

### ✅ Priority 2: Secondary Components

#### 6. app/components/AddPlugin.js
- **Effort:** 30 minutes
- **Changes Required:**
  - [ ] Review for any deprecated props
  - [ ] Check AppBar usage
  - [ ] Verify Button components
- **Risk Level:** LOW
- **Test Cases:**
  - Add plugin modal works
  - Form submission works

#### 7. app/components/Checkbox.js
- **Effort:** 15 minutes
- **Changes Required:**
  - [ ] Verify Checkbox compatibility
  - [ ] Check prop usage
- **Risk Level:** LOW
- **Test Cases:**
  - Checkbox toggles
  - State updates correctly

---

### ✅ Priority 3: Container Components

#### 8. app/containers/LoginPage.js
- **Effort:** 15 minutes
- **Changes Required:**
  - [ ] Verify no direct MUI usage
  - [ ] Check if passes props to Login component
- **Risk Level:** LOW

#### 9. app/containers/LoggedInPage.js
- **Effort:** 15 minutes
- **Changes Required:**
  - [ ] Verify no direct MUI usage
  - [ ] Check if passes props to LoggedIn component
- **Risk Level:** LOW

#### 10. app/containers/PluginTab.js
- **Effort:** 20 minutes
- **Changes Required:**
  - [ ] Review for MUI component usage
  - [ ] Update any deprecated props
- **Risk Level:** LOW

#### 11. app/containers/PairModalPage.js
- **Effort:** 15 minutes
- **Changes Required:**
  - [ ] Verify no direct MUI usage
  - [ ] Check modal configuration
- **Risk Level:** LOW

#### 12. app/containers/AddPluginPage.js
- **Effort:** 15 minutes
- **Changes Required:**
  - [ ] Verify no direct MUI usage
  - [ ] Check component composition
- **Risk Level:** LOW

---

## Overall Migration Effort Estimate

### Time Breakdown
- **Automated Tasks:** 30 minutes
  - Package installation
  - Running codemods
  - Import updates

- **Manual Code Changes:** 4.5 hours
  - Priority 1 components: 3.5 hours
  - Priority 2 components: 0.5 hours
  - Priority 3 components: 0.5 hours

- **Testing:** 2 hours
  - Manual testing of all components
  - Integration testing
  - Regression testing

- **Bug Fixes & Refinements:** 1.5 hours
  - Unexpected issues
  - Styling adjustments
  - Edge cases

**Total Estimated Time:** 8-9 hours

---

## Breaking Changes by Component

### Most Impacted Components (by number of breaking changes)
1. **LoggedIn.js** - 7+ breaking changes
2. **Pair.js** - 6 breaking changes
3. **Login.js** - 6 breaking changes
4. **PlugIns.js** - 2 breaking changes

### Common Breaking Changes Across All Components

#### 1. Button Component
- **Old:** `<Button label="Text" />`
- **New:** `<Button>Text</Button>`
- **Files Affected:** Login.js, LoggedIn.js, Pair.js, PlugIns.js

#### 2. AppBar Component
- **Old:** `<AppBar title="Title" iconElementLeft={...} />`
- **New:**
  ```jsx
  <AppBar position="static">
    <Toolbar>
      <IconButton edge="start">...</IconButton>
      <Typography variant="h6">Title</Typography>
    </Toolbar>
  </AppBar>
  ```
- **Files Affected:** Login.js, LoggedIn.js, Pair.js

#### 3. TextField Component
- **Old:** `<TextField floatingLabelText="Label" hintText="Hint" />`
- **New:** `<TextField label="Label" placeholder="Hint" />`
- **Files Affected:** Login.js, PlugIns.js

#### 4. Table Components
- **Old:** `TableHeader`, `TableHeaderColumn`, `TableRowColumn`
- **New:** `TableHead`, `TableCell`, `TableCell`
- **Files Affected:** LoggedIn.js, PlugIns.js, Pair.js

#### 5. LinearProgress Component
- **Old:** `<LinearProgress mode="indeterminate" />`
- **New:** `<LinearProgress variant="indeterminate" />`
- **Files Affected:** Pair.js

---

## Testing Strategy

### Phase 1: Component-Level Testing
Test each component in isolation after migration:

1. **Login Component**
   - [ ] Renders without errors
   - [ ] Email field accepts input
   - [ ] Password field accepts input
   - [ ] Login button clickable
   - [ ] Validation works

2. **LoggedIn Component**
   - [ ] User info displays
   - [ ] Avatar renders
   - [ ] Tabs render and switch
   - [ ] Plugin tabs load
   - [ ] Settings tab works
   - [ ] Logout functions

3. **PlugIns Component**
   - [ ] Plugin table renders
   - [ ] Can add plugin
   - [ ] Can delete plugin
   - [ ] Can toggle enable/disable
   - [ ] Reinstall button works

4. **Pair Component**
   - [ ] Modal opens
   - [ ] Device info shows
   - [ ] Child list renders
   - [ ] Selection works
   - [ ] Progress indicators work
   - [ ] Cancel button works

### Phase 2: Integration Testing
- [ ] Login flow end-to-end
- [ ] Navigation between pages
- [ ] Plugin installation flow
- [ ] Device pairing flow
- [ ] State management works
- [ ] Redux integration intact

### Phase 3: Regression Testing
- [ ] All existing functionality works
- [ ] No console errors
- [ ] No styling regressions
- [ ] Performance is acceptable
- [ ] Electron integration works

### Phase 4: Cross-Platform Testing
- [ ] Test on macOS
- [ ] Test on Windows
- [ ] Test on Linux

---

## Rollback Plan

### Pre-Migration Backup
- Git stash created automatically
- package.json.backup created
- package-lock.json.backup created

### Rollback Procedure
```bash
# Option 1: Full rollback
git reset --hard HEAD
git stash pop
cp package.json.backup package.json
npm install

# Option 2: Keep code changes, rollback packages only
cp package.json.backup package.json
npm install

# Option 3: Cherry-pick specific files
git checkout HEAD -- app/components/Login.js
```

### Rollback Triggers
Consider rollback if:
- Critical functionality is broken
- More than 25% of tests fail
- Build process fails completely
- Migration takes >16 hours
- Critical bugs discovered in production path

---

## Dependencies Update Summary

### Removed Packages
```json
"@material-ui/core": "^4.11.3"  ❌ Remove
"@material-ui/icons": "^4.11.2" ❌ Remove
```

### Added Packages
```json
"@mui/material": "^5.15.0"           ✅ Add
"@mui/icons-material": "^5.15.0"     ✅ Add
"@emotion/react": "^11.11.0"         ✅ Add (peer dependency)
"@emotion/styled": "^11.11.0"        ✅ Add (peer dependency)
```

### Why Emotion?
MUI v5 uses Emotion as its default styling solution (replacing JSS from v4).
Both libraries are required peer dependencies.

---

## Post-Migration Checklist

### Code Quality
- [ ] All ESLint errors resolved
- [ ] No console warnings in dev mode
- [ ] No deprecation warnings
- [ ] Code formatted consistently

### Documentation
- [ ] Update README if needed
- [ ] Document any new patterns used
- [ ] Update component documentation

### Performance
- [ ] Bundle size checked (should be similar or smaller)
- [ ] Initial load time measured
- [ ] No memory leaks detected
- [ ] React DevTools profiling done

### Git
- [ ] Create migration branch
- [ ] Commit automated changes
- [ ] Commit manual changes separately
- [ ] Update CHANGELOG.md
- [ ] Create PR with detailed description

---

## Known Issues & Gotchas

### 1. Icon Imports
**Issue:** Some icon imports may be broken (e.g., `SocialPerson` in Login.js)
**Fix:** Update to correct icon names from @mui/icons-material

### 2. Table Selection
**Issue:** Table row selection works differently in v5
**Fix:** May need to implement custom selection logic

### 3. Theme Provider
**Issue:** ThemeProvider location changed
**Fix:** Import from @mui/material/styles, not from core

### 4. Tabs onChange
**Issue:** Signature changed from (element, value) to (event, value)
**Fix:** Update all onChange handlers to use event parameter

### 5. Button Labels
**Issue:** Label prop removed completely
**Fix:** Use children instead (most common breaking change)

---

## Success Criteria

Migration is complete when:
- [ ] ✅ All components render without errors
- [ ] ✅ All manual tests pass
- [ ] ✅ No MUI-related console errors
- [ ] ✅ Build process succeeds
- [ ] ✅ Linter passes
- [ ] ✅ Application functions normally
- [ ] ✅ No visual regressions
- [ ] ✅ Performance is acceptable
- [ ] ✅ Code review approved
- [ ] ✅ Documentation updated
