# Material-UI v5 Migration - Quick Reference Guide

## 🚀 Quick Start

```bash
# Run the automated migration script
cd /mnt/ai/automate/automate
./scripts/mui-v5-migration.sh

# Then manually fix components following:
# scripts/mui-v5-manual-changes.md
# scripts/mui-v5-component-checklist.md
```

---

## 📦 Package Changes

### Remove:
```bash
npm uninstall @material-ui/core @material-ui/icons
```

### Install:
```bash
npm install @mui/material@^5.15.0 @mui/icons-material@^5.15.0 @emotion/react@^11.11.0 @emotion/styled@^11.11.0
```

---

## 🔄 Import Changes

### Global Find & Replace:
```javascript
// Find:    @material-ui/core
// Replace: @mui/material

// Find:    @material-ui/icons
// Replace: @mui/icons-material

// Find:    @material-ui/core/styles
// Replace: @mui/material/styles
```

---

## ⚠️ Breaking Changes - Quick Fix Guide

### 1. Button Label Prop
```javascript
// ❌ OLD (v4):
<Button label="Click Me" onClick={handleClick} />

// ✅ NEW (v5):
<Button onClick={handleClick}>Click Me</Button>
```

### 2. AppBar Structure
```javascript
// ❌ OLD (v4):
<AppBar
  title="My Title"
  iconElementLeft={<IconButton><MenuIcon /></IconButton>}
  iconElementRight={<Button label="Logout" />}
/>

// ✅ NEW (v5):
<AppBar position="static">
  <Toolbar>
    <IconButton edge="start" color="inherit">
      <MenuIcon />
    </IconButton>
    <Typography variant="h6" sx={{ flexGrow: 1 }}>
      My Title
    </Typography>
    <Button color="inherit">Logout</Button>
  </Toolbar>
</AppBar>
```

### 3. TextField Props
```javascript
// ❌ OLD (v4):
<TextField
  floatingLabelText="Email"
  hintText="Enter your email"
/>

// ✅ NEW (v5):
<TextField
  label="Email"
  placeholder="Enter your email"
/>
```

### 4. Table Components
```javascript
// ❌ OLD (v4):
<Table>
  <TableHeader>
    <TableRow>
      <TableHeaderColumn>Name</TableHeaderColumn>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableRowColumn>Value</TableRowColumn>
    </TableRow>
  </TableBody>
</Table>

// ✅ NEW (v5):
<TableContainer component={Paper}>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Name</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      <TableRow>
        <TableCell>Value</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</TableContainer>
```

### 5. LinearProgress
```javascript
// ❌ OLD (v4):
<LinearProgress mode="indeterminate" />
<LinearProgress mode="determinate" value={50} />

// ✅ NEW (v5):
<LinearProgress variant="indeterminate" />
<LinearProgress variant="determinate" value={50} />
```

### 6. Tabs onChange
```javascript
// ❌ OLD (v4):
handleTabChange = (el, value) => {
  this.setState({ currentTab: value });
}

// ✅ NEW (v5):
handleTabChange = (event, value) => {
  this.setState({ currentTab: value });
}
```

### 7. ThemeProvider
```javascript
// ❌ OLD (v4):
import { ThemeProvider as MuiThemeProvider } from '@material-ui/core/styles';

<MuiThemeProvider theme={theme}>
  <App />
</MuiThemeProvider>

// ✅ NEW (v5):
import { ThemeProvider } from '@mui/material/styles';

<ThemeProvider theme={theme}>
  <App />
</ThemeProvider>
```

---

## 🔧 Codemod Commands

Run these in order:

```bash
# 1. Preset safe (applies multiple safe transformations)
npx @mui/codemod@latest v5.0.0/preset-safe app/

# 2. Theme breakpoints
npx @mui/codemod@latest v5.0.0/theme-breakpoints app/

# 3. Table props
npx @mui/codemod@latest v5.0.0/table-props app/

# 4. Button props
npx @mui/codemod@latest v5.0.0/button-props app/

# 5. Link underline
npx @mui/codemod@latest v5.0.0/link-underline-hover app/
```

---

## 📋 File-by-File Priority

### Priority 1 (Fix First):
1. ✅ **app/app.js** (15 min)
2. ✅ **app/components/Login.js** (45 min)
3. ✅ **app/components/LoggedIn.js** (60 min)
4. ✅ **app/components/Pair.js** (60 min)
5. ✅ **app/components/PlugIns.js** (45 min)

### Priority 2 (Fix After P1):
6. ✅ **app/components/AddPlugin.js** (30 min)
7. ✅ **app/components/Checkbox.js** (15 min)

### Priority 3 (Verify Only):
8-12. Container files (15 min each)

**Total Manual Time: ~4.5 hours**

---

## 🧪 Testing Commands

```bash
# Build the project
npm run build

# Run linter
npm run lint

# Run tests
npm run test

# Manual testing
npm run develop
```

---

## 🔙 Rollback Commands

```bash
# Full rollback
git reset --hard HEAD
git stash pop
cp package.json.backup package.json
npm install

# Package rollback only
cp package.json.backup package.json
npm install
```

---

## ✅ Success Checklist

- [ ] All automated steps completed
- [ ] All Priority 1 files updated
- [ ] All Priority 2 files updated
- [ ] Build succeeds without errors
- [ ] No console warnings
- [ ] Login page works
- [ ] Main page loads
- [ ] Tabs switch correctly
- [ ] Plugin installation works
- [ ] Device pairing works
- [ ] Visual appearance matches v4
- [ ] No performance regressions

---

## 🆘 Common Errors & Fixes

### Error: "Module not found: @material-ui/core"
**Fix:** Import path not updated. Change to `@mui/material`

### Error: "Invalid prop 'label' supplied to Button"
**Fix:** Remove `label` prop, use children instead

### Error: "Unknown prop 'floatingLabelText'"
**Fix:** Change to `label` prop on TextField

### Error: "TableHeader is not exported"
**Fix:** Use `TableHead` instead

### Error: "Cannot read property 'spacing' of undefined"
**Fix:** Theme provider not properly configured

### Warning: "Deprecated prop 'mode' on LinearProgress"
**Fix:** Use `variant` instead of `mode`

---

## 📊 Migration Progress Tracking

Use this to track your progress:

```
AUTOMATED (30 min):
[ ] Dependencies updated
[ ] Codemods run
[ ] Imports updated

MANUAL - PRIORITY 1 (3.5 hrs):
[ ] app.js
[ ] Login.js
[ ] LoggedIn.js
[ ] Pair.js
[ ] PlugIns.js

MANUAL - PRIORITY 2 (45 min):
[ ] AddPlugin.js
[ ] Checkbox.js

VERIFICATION (30 min):
[ ] All container files checked

TESTING (2 hrs):
[ ] Component tests
[ ] Integration tests
[ ] Manual testing
[ ] Regression testing

FINALIZATION (1 hr):
[ ] Bug fixes
[ ] Code review
[ ] Documentation
[ ] Git commit
```

---

## 📚 Additional Resources

- **MUI v5 Migration Guide:** https://mui.com/material-ui/migration/migration-v4/
- **Breaking Changes List:** https://mui.com/material-ui/migration/migration-v4/#breaking-changes
- **Component API Changes:** https://mui.com/material-ui/api/
- **Codemods Documentation:** https://github.com/mui/material-ui/tree/master/packages/mui-codemod

---

## 💡 Pro Tips

1. **Run codemods first** - They handle ~60% of the work automatically
2. **Fix one component at a time** - Test as you go
3. **Keep the old docs open** - Compare v4 vs v5 APIs
4. **Use TypeScript if possible** - Catches prop errors immediately
5. **Test in dev mode** - React warnings are helpful
6. **Create a migration branch** - Easy rollback if needed
7. **Take breaks** - 8-9 hours is a lot of focused work

---

## 🎯 Migration Script Location

**Main Script:** `/mnt/ai/automate/automate/scripts/mui-v5-migration.sh`

**Documentation:**
- `/mnt/ai/automate/automate/scripts/mui-v5-manual-changes.md`
- `/mnt/ai/automate/automate/scripts/mui-v5-component-checklist.md`
- `/mnt/ai/automate/automate/scripts/mui-v5-quick-reference.md` (this file)

**Backups Created:**
- `package.json.backup`
- `package-lock.json.backup`
- Git stash (automatic)

---

**Good luck with the migration!** 🚀
