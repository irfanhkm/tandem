# Database Migrations

This directory contains versioned database migration scripts for the Tandem application.

## Overview

Migrations are organized using a simple versioning system to track database schema changes over time. Each migration file is prefixed with a version number (V1, V2, V3, etc.) to ensure they are applied in the correct order.

## Naming Convention

```
V{version}_{description}.sql
```

- **Version**: Sequential number (V1, V2, V3, ...)
- **Description**: Snake_case description of the migration
- **Example**: `V2_add_soft_delete.sql`

## Migration Files

| Version | File | Description | Date | Dependencies |
|---------|------|-------------|------|--------------|
| V1 | `V1_initial_schema.sql` | Initial database schema setup | 2024-11-05 | None |
| V2 | `V2_add_soft_delete.sql` | Add soft delete functionality | 2024-11-05 | V1 |

## How to Apply Migrations

### For New Databases

If you're setting up a fresh database, run migrations in order:

```sql
-- 1. Run V1 - Initial Schema
-- Copy and paste contents of V1_initial_schema.sql into Supabase SQL Editor

-- 2. Run V2 - Add Soft Delete
-- Copy and paste contents of V2_add_soft_delete.sql into Supabase SQL Editor

-- Continue with subsequent migrations...
```

### For Existing Databases

If your database already exists and you need to apply new migrations:

1. **Check Current Version**: Determine which migrations have already been applied
2. **Apply Missing Migrations**: Run only the migrations you haven't applied yet
3. **Verify**: Check the verification queries included in each migration

**Example**: If your database was created with V1, you only need to run V2 and beyond:

```sql
-- Run V2_add_soft_delete.sql
-- Run V3_xxx.sql (when available)
-- etc.
```

## Migration Details

### V1 - Initial Schema

Creates the foundational database structure:

- **Tables**:
  - `resources` - QA environments and testing resources
  - `bookings` - Time-based resource reservations
  - `booking_history` - Audit trail for all booking actions

- **Features**:
  - UUID primary keys
  - Row-level security (RLS) policies
  - Automatic timestamp management
  - Unique constraint: one active booking per resource
  - Auto-release function for expired bookings

### V2 - Add Soft Delete

Implements soft delete to prevent permanent data loss:

- **Changes**:
  - Adds `deleted_at` column to `resources` table
  - Adds `deleted_at` column to `bookings` table
  - Creates indexes on `deleted_at` columns
  - Updates `booking_history` to accept 'DELETE' action

- **Impact**:
  - Delete operations set `deleted_at` timestamp instead of removing records
  - Queries must filter `WHERE deleted_at IS NULL` to exclude deleted items
  - Enables data recovery and audit trails

## Best Practices

### Creating New Migrations

1. **Increment Version**: Use the next sequential version number (V3, V4, etc.)
2. **Descriptive Name**: Use clear, concise descriptions in snake_case
3. **Add Header**: Include the migration header template (see existing files)
4. **Document Dependencies**: List which migrations must run before this one
5. **Include Verification**: Add queries to verify the migration succeeded
6. **Test First**: Always test migrations on a development database first

### Migration Template

```sql
-- ========================================
-- Migration: V{X} - {Description}
-- ========================================
-- Description: {Detailed description of what this migration does}
-- Author: {Your Name/Team}
-- Date: {YYYY-MM-DD}
-- Dependencies: {Previous migration files}
--
-- This migration adds/changes:
-- - {Change 1}
-- - {Change 2}
-- - {Change 3}
--
-- Impact: {Description of how this affects the application}
-- ========================================

-- Your SQL statements here...

-- Verification queries (optional)
SELECT 'Migration V{X} completed' AS status;
```

### Rollback Strategy

Currently, migrations don't include automated rollback scripts. If you need to rollback:

1. **Document Rollback**: Add a comment section with rollback SQL
2. **Manual Rollback**: Create reverse migrations if needed
3. **Backup First**: Always backup before applying migrations to production

**Example Rollback Documentation**:

```sql
-- ROLLBACK (if needed):
-- ALTER TABLE public.resources DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE public.bookings DROP COLUMN IF EXISTS deleted_at;
```

## Version Control

- All migration files are tracked in git
- Never modify existing migration files that have been applied to production
- Create new migrations for schema changes
- Update this README when adding new migrations

## Supabase SQL Editor

To run migrations in Supabase:

1. Open your Supabase project
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the migration file contents
5. Click **Run** to execute
6. Check the output for errors
7. Verify using the included verification queries

## FAQ

**Q: Can I modify a migration file after it's been run?**
A: No. Once a migration is applied to any database (especially production), treat it as immutable. Create a new migration instead.

**Q: What if I need to change something from a previous migration?**
A: Create a new migration with the changes. For example, if V2 added a column with the wrong type, create V3 to alter that column.

**Q: How do I know which migrations have been applied?**
A: Currently, you need to track this manually. Consider creating a `schema_migrations` table in a future migration to track applied migrations.

**Q: Should I run all migrations every time?**
A: No. Only run migrations that haven't been applied yet. Migrations use `IF NOT EXISTS` and `IF EXISTS` clauses to be somewhat idempotent, but it's better to track what's been applied.

## Future Improvements

Consider implementing:
- [ ] Automated migration tracking table (`schema_migrations`)
- [ ] Migration CLI tool for automated execution
- [ ] Rollback scripts for each migration
- [ ] Database seed data migrations
- [ ] Migration testing framework
- [ ] CI/CD integration for automated migration testing

## Support

For questions or issues with migrations:
- Check the migration file comments
- Review the Supabase documentation
- Open an issue in the repository
- Contact the Tandem development team
