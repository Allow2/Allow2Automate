# Material-UI v4 → v5 Migration

## 📁 Migration Files

This directory contains the complete Material-UI v5 migration plan for Allow2Automate.

### Files:

1. **mui-v5-migration.sh** - Automated migration script (executable)
2. **mui-v5-manual-changes.md** - Detailed manual changes required
3. **mui-v5-component-checklist.md** - Component-by-component checklist  
4. **mui-v5-quick-reference.md** - Quick reference guide
5. **MIGRATION_README.md** - This file

## 🚀 Getting Started

### Step 1: Read the Plan
```bash
# Quick overview
cat scripts/mui-v5-quick-reference.md

# Detailed component analysis
cat scripts/mui-v5-component-checklist.md

# Manual changes list
cat scripts/mui-v5-manual-changes.md
```

### Step 2: Run Automated Script
```bash
# Make sure you're in project root
cd /mnt/ai/automate/automate

# Run the migration script
./scripts/mui-v5-migration.sh
```

### Step 3: Manual Changes
Follow the checklist in `mui-v5-manual-changes.md` to update components.

### Step 4: Test
```bash
npm run build
npm run test
npm run develop
```

## 📊 Migration Summary

- **Total Files:** 12 component files
- **Automated Time:** 30 minutes
- **Manual Time:** 4.5 hours
- **Testing Time:** 2 hours
- **Total Effort:** 8-9 hours

## 🎯 Key Changes

### Package Updates:
- Remove: `@material-ui/core`, `@material-ui/icons`
- Add: `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`

### Breaking Changes:
- Button `label` prop removed (use children)
- AppBar restructured (use Toolbar composition)
- TextField props renamed (`floatingLabelText` → `label`)
- Table components renamed (`TableHeader` → `TableHead`)
- LinearProgress `mode` → `variant`

## 📝 Checklist

- [ ] Read all migration documents
- [ ] Run automated script
- [ ] Fix Priority 1 components (app.js, Login, LoggedIn, Pair, PlugIns)
- [ ] Fix Priority 2 components (AddPlugin, Checkbox)
- [ ] Verify container components
- [ ] Run build
- [ ] Run tests
- [ ] Manual testing
- [ ] Code review
- [ ] Create PR

## 🔙 Rollback

If issues occur:
```bash
git reset --hard HEAD
git stash pop
cp package.json.backup package.json
npm install
```

## 📚 Documentation

- MUI v5 Docs: https://mui.com/material-ui/
- Migration Guide: https://mui.com/material-ui/migration/migration-v4/
- Breaking Changes: https://mui.com/material-ui/migration/migration-v4/#breaking-changes

## 🆘 Support

Migration plan stored in memory:
```bash
npx claude-flow@alpha hooks memory-get --key "swarm/mui-migration/execution-plan"
```

---

**Status:** Ready to execute
**Created:** 2025-12-22
**Estimated Completion:** 8-9 hours of focused work
