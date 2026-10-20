# Marketing release acceptance checklist

The only connected Supabase project is the production inventory project. Do not apply marketing migrations there for testing.

## Isolated database preparation

Provision a separate project or disposable local database with baseline schema and sanitized fixtures. Verify auth, sc_internal, and current marketing functions exist.

Apply pending migrations in ascending timestamp order:
- 20261019200000_marketing_document_drafts.sql
- 20261019210000_marketing_document_manager_approval.sql
- 20261019220000_marketing_sample_production_review.sql
- 20261019230000_marketing_external_reviews.sql
- 20261019231000_marketing_review_response_guard.sql
- 20261019232000_marketing_release_policy_fixes.sql

Run supabase/verification/970_marketing_release_readiness.sql before and after.

## Role and workflow tests

- Manager approval succeeds and updates approved_by and approved_at; stale timestamps fail.
- Operator, marketing, viewer and anonymous users cannot approve or tamper with approved versions.
- Review tokens are only available to the manager at creation; the stored value is hashed.
- Public documents expose only explicitly allowed fields and never internal pricing.
- Revoked, expired and previously answered links cannot submit again.
- Feedback is mandatory for changes requested; link can be revoked.
- Sample approval creates exactly one production review task, no production job or inventory movement.
- Rejected samples require a reason and cannot be approved afterwards.
- Training mode prevents mutations.
- Deploy preview functional checks verify all browser routes and authenticated Netlify functions.

Run CI on final commit, review database security advisors, take a production backup and obtain release approval before applying production migrations or merging.
