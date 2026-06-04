# Color Alias Review App Workflow

## What this adds

A new app page:

```text
/color-aliases
```

Navigation label:

```text
Color Aliases
```

The page lets you:

- See Woo color → possible blank color candidates
- Approve an alias
- Reject an alias
- Add review notes
- View saved decisions
- Run the Woo-to-blank relink from the app

## Critical rule

No color alias is used unless you approve it.

Examples:

```text
Navy → Navy Blue
```

can be approved if you decide they are equivalent.

```text
Columbia Blue → Carolina Blue
```

can be rejected if they are not the same.

Rejected and pending aliases are ignored by the matcher.

## Files changed

```text
App.jsx
Home.jsx
ColorAliasReview.jsx
inventoryApi.js
App.css
supabase_color_alias_app_workflow.sql
```

## Deploy

1. Run:

```text
supabase_color_alias_app_workflow.sql
```

in Supabase SQL Editor.

2. Deploy the app files.

3. Open:

```text
/color-aliases
```

4. Approve/reject candidates.

5. Click:

```text
Relink Products
```

## Useful SQL checks

```sql
select *
from public.color_alias_review_candidates
order by affected_woo_products desc;

select *
from public.color_alias_approvals
order by updated_at desc;

select match_diagnostic, count(*)
from public.woo_blank_match_diagnostics
group by 1
order by 2 desc;
```
