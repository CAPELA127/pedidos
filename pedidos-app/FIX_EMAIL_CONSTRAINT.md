# Fix: Remove Email Unique Constraint

## Problem
The system still has the old `customers_email_key` unique constraint from before, which prevents the same email from being used in different locations.

## Solution
Run this SQL in your Supabase SQL Editor to remove the old email constraint and keep only the local_name + address_normalized constraint.

### Steps:

1. **Go to Supabase Dashboard**
   - URL: https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Create new query

3. **Copy and run this SQL:**

```sql
-- Remove old email unique constraint
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_email_key;

-- Drop old index if exists
DROP INDEX IF EXISTS idx_customers_local_address;

-- Create new unique constraint on local_name + address_normalized only
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_local_address
ON customers(local_name, address_normalized)
WHERE local_name IS NOT NULL AND address_normalized IS NOT NULL;
```

4. **Click "Run"** (Ctrl+Enter)

### Expected Result
✅ Query successful - no errors

### After Fix
- Same email can be used for multiple locations ✅
- Same local_name + address combination is prevented ✅
- Users can now register with same email in different cities/neighborhoods ✅

---

## Why This Change?

Previously: `UNIQUE(email)` - one email per customer (wrong for multi-location businesses)

Now: `UNIQUE(local_name, address_normalized)` - multiple emails allowed, but prevents duplicate local+address combos (correct for multi-location businesses)
