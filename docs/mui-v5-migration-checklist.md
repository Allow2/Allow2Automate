# Material-UI v4 to v5 Migration Checklist

## Overview
This comprehensive checklist guides you through migrating from Material-UI v4 to MUI v5. The migration involves package renames, styling system changes (JSS → Emotion), and component-level breaking changes.

## Prerequisites

### ✅ Version Requirements
- [ ] React >= 17.0.0 (upgrade from 16.8.0 minimum in v4)
- [ ] TypeScript >= 3.5 (if using TypeScript)
- [ ] Node.js >= 12.0.0
- [ ] **Note**: IE 11 is no longer supported in v5

### ✅ Pre-Migration Preparation
- [ ] Create a new git branch for migration
- [ ] Ensure all tests are passing on v4
- [ ] Document any custom theme configurations
- [ ] Audit current usage of makeStyles/withStyles
- [ ] Review all Material-UI component usage

---

## Phase 1: Package Updates

### Step 1: Update Core Dependencies

```bash
# Remove v4 packages
npm uninstall @material-ui/core @material-ui/icons @material-ui/lab @material-ui/styles

# Install v5 packages
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled

# Optional: Keep @mui/styles if gradual migration needed
npm install @mui/styles
```

### Package Name Mapping
| v4 Package | v5 Package |
|------------|------------|
| `@material-ui/core` | `@mui/material` |
| `@material-ui/icons` | `@mui/icons-material` |
| `@material-ui/lab` | `@mui/lab` |
| `@material-ui/styles` | `@mui/styles` |
| `@material-ui/unstyled` | `@mui/base` |
| `@material-ui/system` | `@mui/system` |

### Step 2: Install Peer Dependencies

```bash
# Emotion styling engine (required)
npm install @emotion/react @emotion/styled

# If using styled-components instead of Emotion
npm install @mui/styled-engine-sc styled-components
```

---

## Phase 2: Automated Codemods

### Step 1: Run Preset-Safe Codemod (Primary)

This handles most breaking changes automatically:

```bash
npx @mui/codemod@latest v5.0.0/preset-safe ./src
```

**What it fixes:**
- ✅ Package imports (@material-ui → @mui)
- ✅ Theme API changes (createMuiTheme → createTheme)
- ✅ Component prop renames
- ✅ Deprecated component updates
- ✅ Icon import paths
- ✅ Color palette references

### Step 2: Run Variant Prop Codemod

Updates TextField, FormControl, and Select default variants:

```bash
npx @mui/codemod@latest v5.0.0/variant-prop ./src
```

**What it fixes:**
- ✅ Adds `variant="standard"` where no variant specified (v5 default is "outlined")

### Step 3: Run Link Underline Codemod

Updates Link component underline behavior:

```bash
npx @mui/codemod@latest v5.0.0/link-underline-hover ./src
```

**What it fixes:**
- ✅ Adds `underline="hover"` where no underline specified (v5 default is "always")

### Step 4: Additional Codemods (Run as Needed)

```bash
# Adapter updates (for date pickers)
npx @mui/codemod@latest v5.0.0/adapter-v4 ./src

# JSX component renames
npx @mui/codemod@latest v5.0.0/jss-to-styled ./src

# Top level imports
npx @mui/codemod@latest v5.0.0/top-level-imports ./src
```

---

## Phase 3: Styling System Migration

### Option A: Gradual Migration (Recommended)

Keep using `@mui/styles` temporarily while migrating to Emotion:

```bash
npm install @mui/styles
```

**Continue using makeStyles/withStyles:**
```jsx
import { makeStyles } from '@mui/styles';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor: theme.palette.primary.main,
  },
}));
```

### Option B: Full Emotion Migration

#### Replace makeStyles with styled API:

**Before (v4 with makeStyles):**
```jsx
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor: theme.palette.primary.main,
    padding: theme.spacing(2),
  },
}));

function MyComponent() {
  const classes = useStyles();
  return <div className={classes.root}>Content</div>;
}
```

**After (v5 with styled):**
```jsx
import { styled } from '@mui/material/styles';

const Root = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  padding: theme.spacing(2),
}));

function MyComponent() {
  return <Root>Content</Root>;
}
```

#### Or use the sx prop for inline styles:

**After (v5 with sx prop):**
```jsx
import { Box } from '@mui/material';

function MyComponent() {
  return (
    <Box sx={{
      backgroundColor: 'primary.main',
      padding: 2,
    }}>
      Content
    </Box>
  );
}
```

### Styling Migration Checklist
- [ ] Decide on migration strategy (gradual vs full)
- [ ] Update all `makeStyles` imports to `@mui/styles` (gradual) or convert to `styled`
- [ ] Replace `withStyles` HOCs with `styled` API
- [ ] Convert inline styles to `sx` prop where appropriate
- [ ] Update `createMuiTheme` to `createTheme`
- [ ] Review and update custom theme structure
- [ ] Test CSS injection order (use `StyledEngineProvider` if needed)

---

## Phase 4: Theme Configuration Updates

### Update createMuiTheme → createTheme

**Before (v4):**
```jsx
import { createMuiTheme } from '@material-ui/core/styles';

const theme = createMuiTheme({
  palette: {
    type: 'dark',
    primary: {
      main: '#1976d2',
    },
  },
});
```

**After (v5):**
```jsx
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark', // Changed from 'type'
    primary: {
      main: '#1976d2',
    },
  },
});
```

### Use adaptV4Theme for Gradual Migration

If you have a complex theme, use the adapter:

```jsx
import { createTheme, adaptV4Theme } from '@mui/material/styles';

const theme = createTheme(adaptV4Theme({
  // v4 theme structure
  palette: {
    type: 'dark',
  },
}));
```

### Theme Changes Checklist
- [ ] Replace `createMuiTheme` with `createTheme`
- [ ] Change `palette.type` to `palette.mode`
- [ ] Update theme overrides syntax (if customizing components)
- [ ] Review spacing function usage (should work the same)
- [ ] Test breakpoint values (unchanged but verify)
- [ ] Update custom theme properties

---

## Phase 5: Component-Specific Breaking Changes

### Button Component
- [ ] **Removed default color**: Add explicit `color` prop if relying on default
- [ ] **Removed wrapper elements**: Update selectors targeting `span` or `label`

```jsx
// v4: <Button>Text</Button> rendered <span>Text</span> wrapper
// v5: <Button>Text</Button> has no wrapper

// Add explicit color if needed:
<Button color="primary">Click</Button>
```

### TextField / FormControl / Select
- [ ] **Default variant changed**: `standard` → `outlined`
- [ ] **Run variant-prop codemod** or manually add `variant="standard"` if needed
- [ ] **Prop rename**: `rowsMax` → `minRows` for multiline TextFields
- [ ] **Ref forwarding**: Use `ref` instead of `inputRef`

```jsx
// Before (v4)
<TextField inputRef={ref} rowsMax={4} />

// After (v5)
<TextField ref={ref} minRows={4} variant="standard" />
```

### Grid Component
- [ ] **Prop renamed**: `justify` → `justifyContent`
- [ ] **Negative margins**: Behavior may differ slightly

```jsx
// Before (v4)
<Grid container justify="center" />

// After (v5)
<Grid container justifyContent="center" />
```

### Link Component
- [ ] **Default underline changed**: `hover` → `always`
- [ ] **Run link-underline-hover codemod** or add `underline="hover"`

```jsx
// Add explicit underline if needed:
<Link underline="hover">Click</Link>
```

### Dialog Component
- [ ] **Removed**: `disableBackdropClick` prop
- [ ] **Use**: `onClose` with reason checking instead

```jsx
// Before (v4)
<Dialog disableBackdropClick />

// After (v5)
<Dialog onClose={(event, reason) => {
  if (reason !== 'backdropClick') {
    handleClose();
  }
}} />
```

- [ ] **Removed**: `withMobileDialog` HOC
- [ ] **Use**: `useMediaQuery` hook instead

### Autocomplete Component
- [ ] **Moved from lab to core**: Update imports
- [ ] **Prop rename**: `getOptionSelected` → `isOptionEqualToValue`
- [ ] **Prop rename**: `closeIcon` → `clearIcon`
- [ ] **Removed**: `debug` prop

```jsx
// Before (v4)
import Autocomplete from '@material-ui/lab/Autocomplete';

<Autocomplete
  getOptionSelected={(option, value) => option.id === value.id}
/>

// After (v5)
import Autocomplete from '@mui/material/Autocomplete';

<Autocomplete
  isOptionEqualToValue={(option, value) => option.id === value.id}
/>
```

### Avatar / Badge Components
- [ ] **Prop value rename**: `circle` → `circular`
- [ ] **Prop value rename**: `rectangle` → `rectangular`

```jsx
// Before (v4)
<Avatar variant="circle" />
<Badge variant="rectangle" />

// After (v5)
<Avatar variant="circular" />
<Badge variant="rectangular" />
```

### Chip Component
- [ ] **Default size changed**: May appear slightly different
- [ ] **Deleted icons**: No longer have wrapper `span`

### Pagination Component
- [ ] **Moved from lab to core**: Update imports
- [ ] **Shape prop**: Defaults changed

```jsx
// Before (v4)
import Pagination from '@material-ui/lab/Pagination';

// After (v5)
import Pagination from '@mui/material/Pagination';
```

### Slider Component
- [ ] **ValueLabel**: Now uses Tooltip internally
- [ ] **Events**: `onChange` and `onChangeCommitted` signatures changed slightly

### Skeleton Component
- [ ] **Moved from lab to core**: Update imports
- [ ] **Variant renames**: `circle` → `circular`, `rect` → `rectangular`

### Speed Dial Component
- [ ] **Moved from lab to core**: Update imports

### Rating Component
- [ ] **Moved from lab to core**: Update imports

### Typography Component
- [ ] **Removed variants**: `body2` removed some default styles
- [ ] **Removed**: `display4`, `display3`, `display2`, `display1` variants (use `h1`-`h6`)

---

## Phase 6: TypeScript Updates (If Applicable)

### Event Type Changes
- [ ] Update `React.ChangeEvent` to `React.SyntheticEvent` for many components
- [ ] Review component prop types (some have changed)
- [ ] Update custom theme typing

```typescript
// Before (v4)
const handleChange = (event: React.ChangeEvent<{}>) => {};

// After (v5)
const handleChange = (event: React.SyntheticEvent) => {};
```

### Theme Typing
- [ ] Update custom theme augmentation syntax
- [ ] Review `DefaultTheme` usage

```typescript
// Augment theme
declare module '@mui/material/styles' {
  interface Theme {
    customProperty: string;
  }
  interface ThemeOptions {
    customProperty?: string;
  }
}
```

---

## Phase 7: Testing & Validation

### Visual Testing
- [ ] Test all pages/routes visually in browser
- [ ] Check responsive behavior (Grid, breakpoints)
- [ ] Verify theme switching (light/dark mode)
- [ ] Test form components (TextField, Select, Autocomplete)
- [ ] Verify button styles and variants
- [ ] Check dialog and modal behaviors

### Unit Testing Updates
- [ ] Update component snapshots
- [ ] Fix tests relying on internal class names
- [ ] Update tests using `data-testid` or role queries (preferred)
- [ ] Verify form validation tests
- [ ] Test theme provider in tests

### Common Test Issues
```jsx
// Wrapper elements removed from Button
// Before: container.querySelector('button span')
// After: container.querySelector('button')

// Class names changed
// Before: .MuiButton-label
// After: .MuiButton-root (or use data-testid)
```

### Performance Testing
- [ ] Check bundle size (should be similar or smaller)
- [ ] Verify no console warnings/errors
- [ ] Test render performance of complex lists
- [ ] Monitor for memory leaks

---

## Phase 8: Cleanup & Optimization

### Remove Deprecated Code
- [ ] Remove `adaptV4Theme` once theme fully migrated
- [ ] Remove `@mui/styles` once fully on Emotion
- [ ] Remove any v4 workarounds
- [ ] Clean up commented code

### Optimize Imports
- [ ] Use named imports for tree-shaking
- [ ] Review and optimize bundle size

```jsx
// Prefer named imports
import { Button, TextField } from '@mui/material';

// Over default imports
import Button from '@mui/material/Button';
```

### Update Documentation
- [ ] Update internal component documentation
- [ ] Document custom theme structure
- [ ] Note any migration caveats for team
- [ ] Update style guide if applicable

---

## Quick Reference: Common Migrations

### Import Changes
```jsx
// Before (v4)
import { Button } from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import { makeStyles } from '@material-ui/core/styles';

// After (v5)
import { Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { makeStyles } from '@mui/styles'; // or use styled/sx
```

### Theme Provider
```jsx
// Before (v4)
import { ThemeProvider } from '@material-ui/core/styles';

// After (v5)
import { ThemeProvider } from '@mui/material/styles';
```

### Styling
```jsx
// makeStyles (keep with @mui/styles)
import { makeStyles } from '@mui/styles';

// Or migrate to styled
import { styled } from '@mui/material/styles';

// Or use sx prop
import { Box } from '@mui/material';
<Box sx={{ m: 2, p: 1 }} />
```

---

## Troubleshooting

### Issue: Styles not applying
**Solution**: Check CSS injection order, use `StyledEngineProvider`:
```jsx
import { StyledEngineProvider } from '@mui/material/styles';

<StyledEngineProvider injectFirst>
  <App />
</StyledEngineProvider>
```

### Issue: Theme not working
**Solution**: Ensure `ThemeProvider` wraps entire app and `createTheme` is used correctly

### Issue: TypeScript errors
**Solution**: Update `@types/react` and ensure TypeScript >= 3.5

### Issue: Bundle size increased
**Solution**: Check for duplicate dependencies, use named imports

### Issue: Tests failing
**Solution**: Update snapshots, use `data-testid` instead of class names

---

## Resources

- [Official Migration Guide](https://mui.com/material-ui/migration/migration-v4/)
- [Styling Changes](https://mui.com/material-ui/migration/v5-style-changes/)
- [Component Changes](https://mui.com/material-ui/migration/v5-component-changes/)
- [GitHub Migration Source](https://github.com/mui/material-ui/blob/master/docs/data/material/migration/migration-v4/migration-v4.md)
- [MUI v5 Release Blog](https://mui.com/blog/mui-core-v5/)

---

## Estimated Timeline

- **Small Project** (< 50 components): 1-2 days
- **Medium Project** (50-200 components): 3-5 days
- **Large Project** (200+ components): 1-2 weeks

**Tip**: Migrate incrementally, test frequently, and commit often for easier rollback if needed.
