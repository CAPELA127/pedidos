# Supabase Migrations

This folder contains SQL migrations for the pedidos-app database schema.

## Applying Migrations

Currently, migrations must be applied manually in the Supabase SQL Editor:

1. Go to [Supabase Dashboard](https://supabase.com) and select your project
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the content of the migration file (e.g., `001_add_customer_fields.sql`)
5. Paste it into the SQL Editor
6. Click **Run**

## Migration Files

- `001_add_customer_fields.sql` - Adds customer data fields (phone, local_name, city, neighborhood, address)

## Future: Automated Migrations

To automate migrations with Supabase CLI:
```bash
supabase db pull  # Pull current schema from Supabase
supabase db push  # Push migrations to Supabase
supabase migration new <name>  # Create new migration
```
