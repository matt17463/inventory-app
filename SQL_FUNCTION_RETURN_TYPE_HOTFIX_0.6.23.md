# 0.6.23 SQL Function Return-Type Hotfix

The database already contained:

```text
sc_set_non_inventory_rule_active_v2(text, boolean)
```

with a different return type. PostgreSQL does not allow `CREATE OR REPLACE
FUNCTION` to change a return type.

The corrected migration now runs:

```sql
drop function if exists
  public.sc_set_non_inventory_rule_active_v2(text, boolean);
```

before recreating the function with the return type required by application
version 0.6.23.

Run `09_NON_INVENTORY_PURCHASING_TOGGLE_FUNCTION_REPAIR.sql` in a new Supabase
SQL Editor query. Do not run the earlier 07 or 08 files.
