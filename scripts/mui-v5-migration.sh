#!/bin/bash
# Material-UI v4 to v5 Migration Script
# Allow2Automate Project
# Generated: 2025-12-22

set -e  # Exit on error

echo "=========================================="
echo "Material-UI v4 → v5 Migration Script"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup
print_step "Creating backup of current state..."
git stash push -m "Pre MUI v5 migration backup $(date +%Y%m%d_%H%M%S)"
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup 2>/dev/null || true

# Step 1: Update package.json dependencies
print_step "Step 1/8: Updating package.json dependencies..."

# Remove old Material-UI v4 packages
npm uninstall @material-ui/core @material-ui/icons

# Install new MUI v5 packages
npm install @mui/material@^5.15.0 @mui/icons-material@^5.15.0

# Install required peer dependencies
npm install @emotion/react@^11.11.0 @emotion/styled@^11.11.0

print_step "Dependencies updated successfully!"

# Step 2: Install codemod tools
print_step "Step 2/8: Installing codemod tools..."
npx @mui/codemod@latest --version || npm install -g @mui/codemod

# Step 3: Run automated codemods
print_step "Step 3/8: Running automated codemods..."

echo "  → Running preset-safe codemod..."
npx @mui/codemod@latest v5.0.0/preset-safe app/

echo "  → Running theme-breakpoints codemod..."
npx @mui/codemod@latest v5.0.0/theme-breakpoints app/

echo "  → Running table-props codemod..."
npx @mui/codemod@latest v5.0.0/table-props app/

echo "  → Running button-props codemod..."
npx @mui/codemod@latest v5.0.0/button-props app/

echo "  → Running link-underline-hover codemod..."
npx @mui/codemod@latest v5.0.0/link-underline-hover app/

# Step 4: Fix import statements
print_step "Step 4/8: Fixing import statements..."

# Fix @material-ui/core imports
find app/ -type f \( -name "*.js" -o -name "*.jsx" \) -exec sed -i "s/@material-ui\/core/@mui\/material/g" {} +

# Fix @material-ui/icons imports
find app/ -type f \( -name "*.js" -o -name "*.jsx" \) -exec sed -i "s/@material-ui\/icons/@mui\/icons-material/g" {} +

# Fix @material-ui/core/styles imports
find app/ -type f \( -name "*.js" -o -name "*.jsx" \) -exec sed -i "s/@material-ui\/core\/styles/@mui\/material\/styles/g" {} +

print_step "Import statements updated!"

# Step 5: Create manual migration checklist
print_step "Step 5/8: Creating manual migration checklist..."

cat > scripts/mui-v5-manual-changes.md << 'EOF'
# Material-UI v5 Manual Migration Checklist

## Files Requiring Manual Changes

### 1. app/app.js
- [ ] Replace `ThemeProvider as MuiThemeProvider` with `ThemeProvider`
- [ ] Import from `@mui/material/styles` instead of `@material-ui/core/styles`
- [ ] Update import: `import { ThemeProvider } from '@mui/material/styles';`

### 2. app/components/Login.js
**Breaking Changes:**
- [ ] TextField `floatingLabelText` prop removed → Use `label` prop
- [ ] TextField `hintText` prop removed → Use `placeholder` prop
- [ ] AppBar `title` prop removed → Use children with Typography
- [ ] AppBar `iconElementLeft` prop removed → Use Toolbar composition
- [ ] Import `Person` icon correctly (currently broken import)

**Required Changes:**
```javascript
// OLD:
<AppBar
    title="Login to Allow2"
    iconElementLeft={<Avatar icon={<Person />} />}
/>
<TextField
    floatingLabelText="Email"
    hintText=""
/>

// NEW:
<AppBar position="static">
    <Toolbar>
        <Avatar><Person /></Avatar>
        <Typography variant="h6">Login to Allow2</Typography>
    </Toolbar>
</AppBar>
<TextField
    label="Email"
    placeholder=""
/>
```

### 3. app/components/LoggedIn.js
**Breaking Changes:**
- [ ] Table components completely restructured
- [ ] Remove `TableHeader`, `TableHeaderColumn`, `TableRowColumn`
- [ ] Use `TableHead`, `TableCell` instead
- [ ] Button `label` prop removed → Use children
- [ ] Tabs `onChange` signature changed: `(event, value)` instead of `(element, value)`

**Required Changes:**
```javascript
// OLD:
<Button label="Log Off" onClick={this.handleLogout} />

// NEW:
<Button onClick={this.handleLogout}>Log Off</Button>

// OLD onChange:
handleTabChange = (el, tab) => { ... }

// NEW onChange:
handleTabChange = (event, tab) => { ... }
```

### 4. app/components/PlugIns.js
**Breaking Changes:**
- [ ] Table structure already partially updated - verify completeness
- [ ] Button `label` prop removed → Use children
- [ ] IconButton requires proper color values

**Required Changes:**
```javascript
// OLD:
<Button label="Reinstall" onClick={...} />

// NEW:
<Button onClick={...}>Reinstall</Button>
```

### 5. app/components/Pair.js
**Breaking Changes:**
- [ ] LinearProgress `mode` prop removed → Use `variant` prop
- [ ] AppBar structure completely changed
- [ ] Remove `iconElementLeft`, `iconElementRight`, `title` props
- [ ] Use Toolbar composition pattern
- [ ] Button `label` prop removed

**Required Changes:**
```javascript
// OLD:
<LinearProgress mode="indeterminate" />

// NEW:
<LinearProgress variant="indeterminate" />

// OLD:
<AppBar
    title={title}
    iconElementLeft={<IconButton>...</IconButton>}
    iconElementRight={<Button label="Cancel" />}
/>

// NEW:
<AppBar position="static">
    <Toolbar>
        <IconButton edge="start">...</IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>{title}</Typography>
        <Button>Cancel</Button>
    </Toolbar>
</AppBar>
```

### 6. app/components/AddPlugin.js
- [ ] Review for deprecated Table components
- [ ] Check for AppBar usage
- [ ] Update any Button label props

### 7. app/components/Checkbox.js
- [ ] Verify Checkbox component compatibility
- [ ] Check if using any deprecated props

## Breaking Changes Summary

### Component Props Removed:
1. **TextField**: `floatingLabelText`, `hintText`
2. **Button**: `label` (use children instead)
3. **AppBar**: `title`, `iconElementLeft`, `iconElementRight`
4. **LinearProgress**: `mode` (use `variant`)
5. **Tabs**: onChange signature changed

### Components Removed/Renamed:
1. **Table Components**:
   - `TableHeader` → `TableHead`
   - `TableHeaderColumn` → `TableCell`
   - `TableRowColumn` → `TableCell`

### Import Changes:
1. `@material-ui/core` → `@mui/material`
2. `@material-ui/icons` → `@mui/icons-material`
3. `@material-ui/core/styles` → `@mui/material/styles`

## Testing Checklist

- [ ] Login page renders correctly
- [ ] Email/password fields work
- [ ] Login button functions
- [ ] Main logged-in page renders
- [ ] Tab navigation works
- [ ] Plugin table displays
- [ ] Plugin installation works
- [ ] Plugin deletion works
- [ ] Pair modal opens
- [ ] Child selection works
- [ ] AppBar displays correctly on all pages
- [ ] Icons render properly
- [ ] Buttons are clickable
- [ ] No console errors related to MUI

## Performance Testing

- [ ] Check bundle size (should be similar or smaller)
- [ ] Verify load time
- [ ] Test with React DevTools Profiler

## Rollback Plan

If critical issues occur:
```bash
git reset --hard HEAD
git stash pop  # Restore pre-migration state
cp package.json.backup package.json
npm install
```
EOF

print_step "Manual migration checklist created at scripts/mui-v5-manual-changes.md"

# Step 6: Run build to check for immediate errors
print_step "Step 6/8: Running build to check for errors..."
print_warning "This may fail - that's expected. We'll fix errors in manual phase."

if npm run build 2>&1 | tee build-output.log; then
    print_step "Build succeeded! Checking for warnings..."
else
    print_warning "Build failed as expected. Check build-output.log for details."
fi

# Step 7: Run linter
print_step "Step 7/8: Running linter..."
npm run lint || print_warning "Linting found issues - will need manual fixes"

# Step 8: Summary
print_step "Step 8/8: Migration Summary"
echo ""
echo "=========================================="
echo "Automated Migration Complete!"
echo "=========================================="
echo ""
echo "Completed:"
echo "  ✓ Package dependencies updated"
echo "  ✓ Automated codemods applied"
echo "  ✓ Import statements updated"
echo "  ✓ Manual checklist created"
echo ""
echo "Next Steps:"
echo "  1. Review scripts/mui-v5-manual-changes.md"
echo "  2. Fix manual changes in each component file"
echo "  3. Run: npm run build"
echo "  4. Run: npm run test"
echo "  5. Test application manually"
echo ""
echo "Files to manually update:"
echo "  - app/app.js (ThemeProvider import)"
echo "  - app/components/Login.js (TextField, AppBar)"
echo "  - app/components/LoggedIn.js (Table, Button, Tabs)"
echo "  - app/components/PlugIns.js (Button props)"
echo "  - app/components/Pair.js (LinearProgress, AppBar)"
echo "  - app/components/AddPlugin.js (verify changes)"
echo ""
echo "Backup files created:"
echo "  - package.json.backup"
echo "  - Git stash created"
echo ""
echo "To rollback: git reset --hard HEAD && git stash pop"
echo "=========================================="
