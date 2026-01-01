# DatabaseModule Auto-Healing Test Suite

## Overview

Comprehensive test suite for database auto-healing functionality in `/app/database/DatabaseModule.js`.

## Test File

**Location:** `/tests/database/DatabaseModule.test.js`

## Installation

Before running tests, ensure Jest is installed:

```bash
npm install --save-dev jest @jest/globals
```

## Running Tests

```bash
# Run all database tests
npm test -- tests/database/DatabaseModule.test.js

# Run with coverage
npm test -- tests/database/DatabaseModule.test.js --coverage

# Run in watch mode
npm test -- tests/database/DatabaseModule.test.js --watch

# Run specific test suite
npm test -- tests/database/DatabaseModule.test.js -t "Schema Validation"
```

## Test Coverage

### 1. Schema Validation (5 tests)
- ✅ Detects missing children table
- ✅ Detects all missing tables on fresh database
- ✅ Validates existing schema is correct
- ✅ Detects missing multiple tables
- ✅ Throws error when database not initialized

### 2. Schema Healing (9 tests)
- ✅ Creates missing children table
- ✅ Preserves existing data during healing
- ✅ Handles multiple missing tables
- ✅ Logs healing operations
- ✅ Skips healing when schema is healthy
- ✅ Creates indexes for healed tables
- ✅ Handles transaction rollback on error
- ✅ Throws error when database not initialized

### 3. Upgrade Mechanism (6 tests)
- ✅ Detects schema version changes
- ✅ Increments version after healing
- ✅ Sets initial schema version on fresh database
- ✅ Preserves schema version when already set
- ✅ Updates timestamp when setting version
- ✅ Handles partial upgrade failures with rollback

### 4. Integration Tests (3 tests)
- ✅ Full initialize with auto-healing on fresh database
- ✅ Initialize detects and heals missing table
- ✅ Data integrity across healing and queries

### 5. Edge Cases (5 tests)
- ✅ Handles empty database with no tables at all
- ✅ Handles corrupted schema_metadata table
- ✅ Handles concurrent healing attempts
- ✅ Validates foreign key constraints after healing

## Test Scenarios Covered

### Fresh Database Creation
Tests database initialization from scratch with no existing tables.

### Missing Single Table
Simulates the scenario where only the `children` table is missing and verifies healing creates it correctly.

### Missing Multiple Tables
Tests healing when several tables are missing from the schema.

### Corrupted Table Structure
Tests handling of corrupted or invalid table structures.

### Schema Version Upgrade
Simulates schema version changes and verifies proper migration handling.

### Data Preservation
Ensures existing data is not lost during healing operations.

## Key Features Tested

### Auto-Healing
- Missing table detection
- Automatic table creation
- Index creation for healed tables
- Transaction-based healing (all-or-nothing)
- Rollback on errors

### Schema Validation
- Complete schema validation
- Missing table identification
- Existing table verification
- Schema version tracking

### Data Integrity
- Foreign key constraint validation
- Data preservation during healing
- Transaction consistency
- Concurrent operation handling

## Test Database

All tests use **better-sqlite3 in-memory databases** (`:memory:`) for:
- Fast execution
- No filesystem dependencies
- Isolated test environment
- Automatic cleanup

## Expected Results

All 28 tests should pass with:
- No data loss during healing
- Proper transaction handling
- Correct schema version tracking
- Full coverage of edge cases

## Example Test Output

```
PASS  tests/database/DatabaseModule.test.js
  DatabaseModule Auto-Healing
    Schema Validation
      ✓ detects missing children table (15ms)
      ✓ detects all missing tables on fresh database (8ms)
      ✓ validates existing schema is correct (12ms)
      ✓ detects missing multiple tables (7ms)
      ✓ throws error when database not initialized (3ms)
    Schema Healing
      ✓ creates missing children table (18ms)
      ✓ preserves existing data during healing (22ms)
      ✓ handles multiple missing tables (45ms)
      ✓ logs healing operations (25ms)
      ✓ skips healing when schema is healthy (11ms)
      ✓ creates indexes for healed tables (35ms)
      ✓ handles transaction rollback on error (15ms)
      ✓ throws error when database not initialized (2ms)
    Upgrade Mechanism
      ✓ detects schema version changes (9ms)
      ✓ increments version after healing (28ms)
      ✓ sets initial schema version on fresh database (14ms)
      ✓ preserves schema version when already set (16ms)
      ✓ updates timestamp when setting version (8ms)
      ✓ handles partial upgrade failures with rollback (12ms)
    Integration Tests
      ✓ full initialize with auto-healing on fresh database (42ms)
      ✓ initialize detects and heals missing table (31ms)
      ✓ data integrity across healing and queries (25ms)
    Edge Cases
      ✓ handles empty database with no tables at all (6ms)
      ✓ handles corrupted schema_metadata table (11ms)
      ✓ handles concurrent healing attempts (38ms)
      ✓ validates foreign key constraints after healing (19ms)

Test Suites: 1 passed, 1 total
Tests:       28 passed, 28 total
```

## Troubleshooting

### Jest Not Found
```bash
npm install --save-dev jest
```

### Import Errors
Ensure package.json has `"type": "module"` for ES module support.

### Electron Mock Errors
The tests mock the Electron `app` module. If you encounter issues, verify the mock setup in the test file.

## Related Files

- Source: `/app/database/DatabaseModule.js`
- Config: `/jest.config.js`
- Setup: `/tests/setup.js`
