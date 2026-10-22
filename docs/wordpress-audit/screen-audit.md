# Screen-by-screen WordPress audit

Reviewed 2026-10-22. **Partial.** Each row is authored from the rendered UI or explicitly scoped DOM field inspection. A verified screen means its recorded controls were inspected, not that every conditional state or write was tested. No screenshots retained; sensitive account, order, customer and integration context can be present. No raw admin screenshots or DOM dumps are included.

## Evidence and safe training contract

Open the named existing screen, read the control and its help, then exit without saving. Buttons that save, migrate, sync, send, export with marking, rebuild, backfill, publish, purchase or submit are described but were not executed. Intended effects are attributed to live help text, not claimed as observed outcomes. Unknown defaults and validation are explicitly unknown.

Beginner sequence: identify the workflow first; open the matching screen; read field purpose and required status; inspect choices; review the advanced note and effect; stop before an operational action. Practice writes only in a separately authorized nonproduction fixture.

## Advanced Free Shipping for WooCommerce

Installed 1.1.7.1; active; partial-live-review.

### Advanced Free Shipping

**Location:** WooCommerce > Settings > Shipping > Advanced Free Shipping

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Enable the Advanced Free Shipping rates / checkbox | Enable the extension rates. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Hide other shipping methods when free shipping is available / checkbox | Suppress paid alternatives when qualifying. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Free shipping rates / list | Inspect existing rate names. Workflow: WordPress administration | Not established by this inspection | Observed Spend $200 get free shipping!; condition editor not inspected. | Lists configured rules; eligibility not tested. Inspect only during training; do not save or submit in production. |
| Add Free Shipping rate / button | Create a conditional rate; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Save changes / button | Persist extension options; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## Partial Shipment for WooCommerce

Installed 3.8; active; partial-live-review.

### Partial Shipment settings

**Location:** WooCommerce > Settings > Partial Shipment

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Partially Shipped status / checkbox | Add the status used when only some units ship. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Auto-complete when fully shipped / checkbox | Advance an order to Completed when every item ships. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Hide until first shipment / checkbox | Delay customer badges until a shipment exists. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Orders list preview / checkbox | Show shipped badges in the Orders preview popup. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Partial shipment email / Manage email / link | Review notification setup. Workflow: WordPress administration | Not established by this inspection | Screen says email is sent using Partial shipment notification under Order actions, not simply by reading settings. | Link observed; email not sent. Inspect only during training; do not save or submit in production. |
| Order statuses / multi-select | Select historical order statuses for backfill. Workflow: WordPress administration | Not established by this inspection; Options: Pending payment, Processing, On hold, Completed, Cancelled, Refunded, Failed, Partially Shipped, In Production, Draft | Completed was selected. Backfill marks remaining eligible units shipped; excludes refunds and skips orders already having shipment records. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Backfill orders now / button | Create shipment history in batches of 50; prohibited. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Save changes / button | Persist settings; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## Skilled Crafting Artwork R2 Storage & Review Reliability

Installed 1.1.1; active; partial-live-review.

### R2 Storage

**Location:** Artwork System > R2 Storage

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Netlify R2 bridge / Bridge URL / R2 bucket / read-only | Inspect the storage bridge and bucket configuration. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Status labels observed; endpoint and bucket values omitted. Inspect only during training; do not save or submit in production. |
| Eligible artwork file fields / Tracked R2 files / Verified / Remaining / unresolved / Failed / read-only | Read migration and verification coverage. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Status categories observed; successful delivery not independently tested. Inspect only during training; do not save or submit in production. |
| Migrate existing artwork / section | Migration area for existing artwork. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Area inspected without running migration. Inspect only during training; do not save or submit in production. |
| Recent R2 file records / read-only | Read source, request, attachment, status, size, SHA-256, object and error columns. Workflow: WordPress administration | Not established by this inspection | Object paths, identifiers and record contents deliberately excluded. | Table structure observed; no files opened. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Review Health

**Location:** Artwork System > Review Health

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Configured slug / WordPress page exists / Contains [sc_artwork_review] / Review URL / read-only | Check that the review page is configured and contains its renderer. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Diagnostic headings observed; signed review URLs not copied. Inspect only during training; do not save or submit in production. |
| Workflow scan / Rows needing attention / read-only | Inspect problems with visibility, attachments and local/remote files. Workflow: WordPress administration | Not established by this inspection | Columns: Request, Mockup, Visibility, Attachment, Local file, URL, Action. Individual records excluded. | Diagnostic table structure observed; no repairs triggered. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## Skilled Crafting Artwork System

Installed 1.2.1; active; partial-live-review.

### Artwork System overview

**Location:** Artwork System > Requests

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Requests / Customers / Artwork Vault / Reorders / Sales Opportunities / navigation | Navigate between artwork work queues. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Menu destinations observed; customer records not copied. Inspect only during training; do not save or submit in production. |
| Create Manual Request / button | Open a blank intake form for email, phone or in-person briefs. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Blank manual intake screen inspected without submission. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Individual request review, revision, DTF readiness, approval, vault and reorder dialogs require a sanitized fixture.

### Blank manual request

**Location:** Artwork System > New Manual Request

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Existing customer (optional) / select | Link the request to an existing customer. Workflow: WordPress administration | False; Options: Dynamic existing customers; values intentionally omitted | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Client name / text | Name the client. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Organization / team / business / text | Name the group commissioning the work. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Email / email | Enter the client contact email. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Phone / text | Enter a contact phone number. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Project type / purpose * / text | Explain what the design is for. Workflow: WordPress administration | True | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Deadline / date | Record requested timing, subject to confirmation. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Printing canvas / item / text | Describe the garment or item and print placement. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Preferred garment color / text | Specify desired base color. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Audience / wearer / text | Describe who will use the item. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Main subject / mascot / symbol / text | Describe the main visual. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Project details * / textarea | Write the full brief. Workflow: WordPress administration | True | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Specific graphic elements / textarea | List required visual details. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Exact text requested / textarea | Record spelling and wording exactly. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Customer notes / messages / textarea | Record client instructions. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Internal designer notes / textarea | Record staff-only design instructions. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Client-Supplied Reference Files / file | Attach source reference material. Workflow: WordPress administration | False | Reference upload help lists JPG, PNG, WebP and PDF as internal references, not automatically customer-ready mockups. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Reference-file note / text | Explain the attached references. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Create the customer review link immediately / checkbox | Create a review link with intake. Workflow: WordPress administration | False | Rendered label and HTML required state inspected; no customer information entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Create Manual Request / button | Submit a new operational artwork request; prohibited during audit. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Artwork System Settings

**Location:** Artwork System > Settings

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Inventory App URL / url | Destination used for application handoff. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Inventory Webhook URL / url | Server endpoint receiving artwork events. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Webhook Secret / secret | Credential used to authenticate handoff. Workflow: WordPress administration | Not established by this inspection | Value deliberately not read or retained. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Auto-send Approved Artwork / checkbox | Send an event when customer artwork is approved. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Auto-send Reorders / checkbox | Send reorder requests to the webhook. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Review Page Slug / text | WordPress page used for artwork review. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Vault Page Slug / text | WordPress page used for the customer artwork vault. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Save Settings / button | Persist integration configuration; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Actual destination values, secret validity, event delivery, retries and role access not verified.

## Skilled Crafting Artwork System - Inventory Auto Sync

Installed 1.1.0; active; partial-live-review.

### Inventory Sync

**Location:** Artwork System > Inventory Sync

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Webhook URL / read-only | Inspect the configured receiving endpoint. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Configuration row observed; value omitted. Inspect only during training; do not save or submit in production. |
| Webhook Secret / secret | Authenticate outgoing events. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Credential row observed; no secret copied. Inspect only during training; do not save or submit in production. |
| Unsent / failed requests / read-only | Review request backlog. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Status section observed; records omitted. Inspect only during training; do not save or submit in production. |
| Unsent / failed reorders / read-only | Review reorder backlog. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Status section observed; records omitted. Inspect only during training; do not save or submit in production. |
| Sync All Unsent Artwork Requests / button | Retry pending artwork delivery; not clicked. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync All Unsent Reorders / button | Retry pending reorder delivery; not clicked. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## Skilled Crafting Client Storefronts

Installed 0.1.2; active; partial-live-review.

### Client Storefronts list

**Location:** WordPress Admin > Client Storefronts

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Search Posts / search | Find an existing storefront by its title. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Filters the list when Search Posts is used. Inspect only during training; do not save or submit in production. |
| Search Posts / button | Run the title search. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| All / Draft filters / links | Switch the list to all records or drafts. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Navigates to a filtered list; one existing QA draft observed. Inspect only during training; do not save or submit in production. |
| Edit / button | Open the existing storefront editor without changing fields. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Preview / button | View the existing draft without publishing. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | QA draft preview rendered the branded storefront. Inspect only during training; do not save or submit in production. |
| Add Post / button | Open creation; not used because this audit does not create storefronts. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Quick edit / button | Open inline post properties; not opened. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Bulk actions / select | Select a batch operation. Workflow: WordPress administration | Not established by this inspection; Options: Bulk edit, Move to Trash | Do not use Apply in this audit. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Apply / button | Execute selected bulk operation; prohibited during audit. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Existing QA draft editor

**Location:** Client Storefronts > existing Internal QA draft > Edit

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Add title / text | The storefront page title. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Edit permalink / button | Change the public address; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Content / textarea | Page content contains [sc_client_storefront]. Workflow: WordPress administration | Not established by this inspection | Observed existing shortcode, not edited. No branded-settings meta box was exposed in this editor. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Add Media / button | Insert media; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Add Form / button | Insert a WPForms form; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Add Contact Form / button | Insert a Jetpack form; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Visual / Code / tabs | Choose the content editing view. Workflow: WordPress administration | Not established by this inspection; Options: Visual, Code | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Save Draft / button | Persists changes to a draft; not clicked. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Preview / button | View the already-existing draft. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Direct existing preview URL rendered safely without saving. Inspect only during training; do not save or submit in production. |
| Edit status / button | Change publication status; not opened. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Edit visibility / button | Change public/private visibility; not opened. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Edit date and time / button | Change scheduling; not opened. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Set featured image / button | Choose media; not opened. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Publish / button | Makes a storefront public; prohibited. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Move to Trash / button | Removes storefront from normal use; prohibited. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Branded template/category/color fields were not exposed in this editor; determine intended application/REST ownership.; No publication, access-control, invalid-category or cross-category checkout tests.

### QA draft storefront preview

**Location:** Existing QA draft > Preview (token-free post preview)

**Conditions:** Signed-in administrator previewing existing unpublished QA draft

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Cart & checkout / View cart / links | Open the shared WooCommerce cart. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Navigation only; cart was not changed. Inspect only during training; do not save or submit in production. |
| Support the campaign / anchor | Jump to the collection. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Moves to #scs-shop. Inspect only during training; do not save or submit in production. |
| Select options & shop / link | Open a category product to choose its options. Workflow: WordPress administration | Not established by this inspection | Observed scs_store context query parameter on product links. | Navigates to selected product; no cart mutation. Inspect only during training; do not save or submit in production. |
| How to order / Delivery & pickup / read-only | Read campaign instructions and fulfillment expectations. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | No state change; QA-only messaging was visible. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Public access to an unpublished draft not tested.; Other templates, empty/invalid categories and checkout context isolation not tested.

## Skilled Crafting Global Size Upcharges

Installed 1.0.0; active; partial-live-review.

### Size Upcharges

**Location:** WooCommerce > Size Upcharges

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Enable global size upcharges / checkbox | Enable runtime increments. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Increment for each size / number | Set the surcharge for each exact size slug. Workflow: WordPress administration | Not established by this inspection | Observed rows: 12oz,15oz,A2XL,A3XL,AL,AM,AS,AXL,AXS,Large,Large/Extra Large,Medium,One Size,Small,Small/Medium,W2XL,W3XL,WL,WM,WS,WXL,WXS,XXS,YL,YM,YS,YXL,YXS. $20 examples show A2XL/W2XL at $22; A3XL/W3XL at $23; others $20. This is displayed configuration, not a checkout price test. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Woo slug / Example on $20 base / read-only | Check the size key and illustrative resulting price. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Read-only example. Inspect only during training; do not save or submit in production. |
| Save size upcharges / button | Save runtime pricing rules; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## Skilled Crafting Mockup Variation Selector

Installed 1.0.0; active; partial-live-review.

### Dependent product selectors

**Location:** /south-colby-bobcats/south-colby-gildan-tee/

**Conditions:** Variable product with Color, Size and Logo Selection

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Color / select | Choose the garment color before size and logo. Workflow: WordPress administration | Not established by this inspection; Options: Choose an option, Black, Dark Heather Grey, Royal Blue, White | Observed interface only. Installed settings are not necessarily vendor defaults. | Black selection was observed; no order created. Inspect only during training; do not save or submit in production. |
| Size / select | Choose the exact garment size. Workflow: WordPress administration | Not established by this inspection; Options: Choose an option, A2XL, A3XL, AL, AM, AS, AXL, YL, YM, YS, YXL, YXS | Observed interface only. Installed settings are not necessarily vendor defaults. | Selecting AM after Black enabled Logo Selection. Inspect only during training; do not save or submit in production. |
| Logo Selection / select | Choose the approved design for the garment. Workflow: WordPress administration | Not established by this inspection; Options: Choose an option, South Colby 70th- Blue, South Colby 70th- White, South Colby Bobcat Ears | Disabled after selecting only Color; enabled after Color and Size. | Unsaved product selection only. Inspect only during training; do not save or submit in production. |
| Clear options / link | Reset variation selections. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Control observed; not used. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Other combinations, reset behavior, unavailable pairs and price changes not fully tested.

## Skilled Crafting Print Documents

Installed 0.3.6; active; partial-live-review.

### Company identity

**Location:** WooCommerce > Print Documents > Company

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Company name / text | Business name printed on documents. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Address / textarea | Business address printed on documents. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Phone / text | Business contact phone printed on documents. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Logo / url | Image URL used on document headings. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Choose image / button | Open media selection; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Save Print Document Settings / button | Persist all document settings; not clicked. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Invoice layout

**Location:** WooCommerce > Print Documents > Invoice

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Title / text | Document heading. Workflow: WordPress administration | Not established by this inspection | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Paper / select | Choose invoice paper. Workflow: WordPress administration | Not established by this inspection; Options: US Letter, A4 | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Item layout / select | Choose the layout used for each order line. Workflow: WordPress administration | Not established by this inspection; Options: Automatic, Compact card, Column grid, Two-column details, Ultra compact, Production detail | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Field layout / select | Arrange line-item details. Workflow: WordPress administration | Not established by this inspection; Options: Automatic, Inline, Grid, Two-column grid, Stacked | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Field labels / select | Choose full labels, shorter labels or just values. Workflow: WordPress administration | Not established by this inspection; Options: Full labels, Compact labels, Values only | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Combine product attributes / select | Merge color/size/brand/style into a compact strip. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Separator / text | Choose punctuation between combined attributes. Workflow: WordPress administration | Not established by this inspection | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Suppress duplicate attributes / select | Hide generic attributes when specific fields are included. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Show prices/totals / select | Decide whether money values print. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Line price position / select | Place or hide each line price. Workflow: WordPress administration | Not established by this inspection; Options: Bottom right, Inline with item name, Hide line price | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Show product images / select | Include item pictures. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Image size / select | Set picture size. Workflow: WordPress administration | Not established by this inspection; Options: None, Small, Medium, Large | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Image position / select | Place pictures beside or above item details. Workflow: WordPress administration | Not established by this inspection; Options: Left of item, Right of item, Above details | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| SKU display / select | Choose how product identifiers print. Workflow: WordPress administration | Not established by this inspection; Options: Own line, Inline, Hidden | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Quantity position / select | Place the unit count. Workflow: WordPress administration | Not established by this inspection; Options: Top right, Inline with item name | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Show order notes / select | Include order notes on the printout. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| QC checklist / select | Include a quality-control checklist. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Order barcode / select | Include an order barcode. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Density / select | Choose compactness for the available paper area. Workflow: WordPress administration | Not established by this inspection; Options: Automatic, Comfortable, Compact, Extra compact | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Footer / textarea | Add closing document text. Workflow: WordPress administration | Not established by this inspection | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Packing Slip layout

**Location:** WooCommerce > Print Documents > Packing Slip

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Title / text | Document heading. Workflow: WordPress administration | Not established by this inspection | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Item layout / select | Choose the layout used for each order line. Workflow: WordPress administration | Not established by this inspection; Options: Automatic, Compact card, Column grid, Two-column details, Ultra compact, Production detail | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Field layout / select | Arrange line-item details. Workflow: WordPress administration | Not established by this inspection; Options: Automatic, Inline, Grid, Two-column grid, Stacked | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Field labels / select | Choose full labels, shorter labels or just values. Workflow: WordPress administration | Not established by this inspection; Options: Full labels, Compact labels, Values only | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Combine product attributes / select | Merge color/size/brand/style into a compact strip. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Separator / text | Choose punctuation between combined attributes. Workflow: WordPress administration | Not established by this inspection | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Suppress duplicate attributes / select | Hide generic attributes when specific fields are included. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Show prices/totals / select | Decide whether money values print. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Line price position / select | Place or hide each line price. Workflow: WordPress administration | Not established by this inspection; Options: Bottom right, Inline with item name, Hide line price | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Show product images / select | Include item pictures. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Image size / select | Set picture size. Workflow: WordPress administration | Not established by this inspection; Options: None, Small, Medium, Large | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Image position / select | Place pictures beside or above item details. Workflow: WordPress administration | Not established by this inspection; Options: Left of item, Right of item, Above details | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| SKU display / select | Choose how product identifiers print. Workflow: WordPress administration | Not established by this inspection; Options: Own line, Inline, Hidden | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Quantity position / select | Place the unit count. Workflow: WordPress administration | Not established by this inspection; Options: Top right, Inline with item name | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Show order notes / select | Include order notes on the printout. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| QC checklist / select | Include a quality-control checklist. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Order barcode / select | Include an order barcode. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Density / select | Choose compactness for the available paper area. Workflow: WordPress administration | Not established by this inspection; Options: Automatic, Comfortable, Compact, Extra compact | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Footer / textarea | Add closing document text. Workflow: WordPress administration | Not established by this inspection | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Customer name font size / number | Override this content size in points; blank uses automatic size. Workflow: WordPress administration | Not established by this inspection | Observed 9 pt. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Customer address font size / number | Override this content size in points; blank uses automatic size. Workflow: WordPress administration | Not established by this inspection | Observed blank/automatic. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Production attribute values font size / number | Override this content size in points; blank uses automatic size. Workflow: WordPress administration | Not established by this inspection | Observed 8 pt; per-field override takes precedence. Applies to values, not labels. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Production layout

**Location:** WooCommerce > Print Documents > Production

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Title / text | Document heading. Workflow: WordPress administration | Not established by this inspection | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Item layout / select | Choose the layout used for each order line. Workflow: WordPress administration | Not established by this inspection; Options: Automatic, Compact card, Column grid, Two-column details, Ultra compact, Production detail | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Field layout / select | Arrange line-item details. Workflow: WordPress administration | Not established by this inspection; Options: Automatic, Inline, Grid, Two-column grid, Stacked | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Field labels / select | Choose full labels, shorter labels or just values. Workflow: WordPress administration | Not established by this inspection; Options: Full labels, Compact labels, Values only | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Combine product attributes / select | Merge color/size/brand/style into a compact strip. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Separator / text | Choose punctuation between combined attributes. Workflow: WordPress administration | Not established by this inspection | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Suppress duplicate attributes / select | Hide generic attributes when specific fields are included. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Show prices/totals / select | Decide whether money values print. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Line price position / select | Place or hide each line price. Workflow: WordPress administration | Not established by this inspection; Options: Bottom right, Inline with item name, Hide line price | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Show product images / select | Include item pictures. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Image size / select | Set picture size. Workflow: WordPress administration | Not established by this inspection; Options: None, Small, Medium, Large | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Image position / select | Place pictures beside or above item details. Workflow: WordPress administration | Not established by this inspection; Options: Left of item, Right of item, Above details | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| SKU display / select | Choose how product identifiers print. Workflow: WordPress administration | Not established by this inspection; Options: Own line, Inline, Hidden | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Quantity position / select | Place the unit count. Workflow: WordPress administration | Not established by this inspection; Options: Top right, Inline with item name | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Show order notes / select | Include order notes on the printout. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| QC checklist / select | Include a quality-control checklist. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Order barcode / select | Include an order barcode. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Density / select | Choose compactness for the available paper area. Workflow: WordPress administration | Not established by this inspection; Options: Automatic, Comfortable, Compact, Extra compact | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Footer / textarea | Add closing document text. Workflow: WordPress administration | Not established by this inspection | Layout setting observed; render/physical print not tested. Quantity over one is described as bold red in every layout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Field Builder & Preview

**Location:** WooCommerce > Print Documents > Field Builder & Preview

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Sample order # / number | Choose an existing order for field discovery. Workflow: WordPress administration | Not established by this inspection | An existing order number was prefilled; not copied into this report. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Discover fields / button | Discover metadata on an order; not clicked. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Document / select | Choose which document configuration to inspect. Workflow: WordPress administration | Not established by this inspection; Options: Invoice, Packing, Production | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Refresh preview / button | Generate a layout preview; not clicked because generation may be logged and expose customer information. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Preview lines / checkboxes | Choose order lines included in preview. Workflow: WordPress administration | Not established by this inspection | Existing line descriptions were visible; customer values excluded. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Drag fields / drag handle | Reorder metadata for output. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Field enabled / checkbox | Include a discovered field for this document. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Label / Short label / text | Name a field in full and compact views. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Field layout / select | Choose display for an individual field. Workflow: WordPress administration | Not established by this inspection; Options: Auto, Inline, Grid cell, Own line, Value only, Badge | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Classification / select | Control audience of metadata. Workflow: WordPress administration | Not established by this inspection; Options: Customer, Production, Internal | Screen states Internal fields never print; no print output generated. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Value font size / number | Override only this field value in points. Workflow: WordPress administration | Not established by this inspection | Overrides the production-value font setting. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Live document preview / iframe | Display preview output. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Preview region observed; no customer document captured. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Workflow

**Location:** WooCommerce > Print Documents > Workflow

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Auto-open print dialog / select | Offer browser printing when documents open. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Observed Yes. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Generation logging / select | Record document generation/open events. Workflow: WordPress administration | Not established by this inspection; Options: Yes, No | Observed Yes. Does not establish physical printing. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Bulk sort / select | Choose document order for a selected batch. Workflow: WordPress administration | Not established by this inspection; Options: Order number, Customer, Shipping method, Order date | Observed Order number. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Copies per selected order / number | Set how many copies are generated. Workflow: WordPress administration | Not established by this inspection | Observed 1. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Save current settings as preset / button | Store a reusable configuration; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Save Print Document Settings / button | Save settings; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## Skilled Crafting Product Options

Installed 0.2.5; active; partial-live-review.

### Operating mode and migration audit

**Location:** WooCommerce > Product Options

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Operating mode / radio | Choose which option renderer owns shopper personalization. Workflow: WordPress administration | Not established by this inspection; Options: Shadow mode, Replacement mode | Observed Replacement mode selected; Shadow leaves legacy frontend in control when Product Add-Ons is active. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Read unmigrated legacy _product_addons data / checkbox | Retain access to options not yet migrated. Workflow: WordPress administration | Not established by this inspection | Observed checked. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| I have compared option pricing on representative live products / checkbox | Record administrator pricing signoff. Workflow: WordPress administration | Not established by this inspection | Observed checked; this audit does not independently certify that prior signoff. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| I have tested restrictions, required fields, cart, checkout, and order metadata / checkbox | Record frontend signoff. Workflow: WordPress administration | Not established by this inspection | Observed checked; not proof this audit tested those effects. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Administrator override: allow replacement mode even if checklist is incomplete / checkbox | Bypass readiness gating deliberately. Workflow: WordPress administration | Not established by this inspection | Observed unchecked; use only deliberate testing. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Debug logging / checkbox | Enable diagnostic logging. Workflow: WordPress administration | Not established by this inspection | Observed unchecked. Logs may contain sensitive context. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Save settings / button | Persist operating-mode choices; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Compatibility audit / Cutover readiness / read-only | Read configuration comparison counts and checklist. Workflow: WordPress administration | Not established by this inspection | Observed 153 scanned products; five legacy product fields, five native fields; four legacy/native groups; readiness YES; latest migration parity MATCH. | Reports existing audit state; does not establish transaction parity. Inspect only during training; do not save or submit in production. |
| Export legacy JSON backup / button | Download legacy configuration; not clicked because it records export history. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Preview migration & parity / button | Open parity comparison; link observed, not exercised. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Migrate legacy configuration to native SC format / button | Copy legacy options into native configuration; not executed. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Rollback last migration / button | Revert migration; prohibited during audit. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Edit Global Option Groups / Edit Reusable Templates / links | Navigate to native group/template editors. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Global group list and one existing group editor inspected; template editor unreviewed. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Existing global-group visual editor

**Location:** Global Option Groups > existing SKSD Spirit Wear group > Edit

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Priority / number | Order global groups relative to one another. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Apply to all products / checkbox | Apply a group without category restriction. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Product categories / multi-select | Choose which catalog categories receive the group. Workflow: Personalization → exact order metadata → packing | Not established by this inspection; Options: Dynamic WooCommerce product categories; full taxonomy not reproduced | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Option label / text | Name the question shown to the shopper. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Field type / select | Choose the input format. Workflow: Personalization → exact order metadata → packing | Not established by this inspection; Options: Short text, Long text, Multiple choice, Checkboxes, Customer-defined price, Quantity / multiplier, Heading, Date picker, File upload | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Display / select | Choose how multiple-choice answers appear. Workflow: Personalization → exact order metadata → packing | Not established by this inspection; Options: Dropdown, Radio buttons, Image choices | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Required / checkbox | Require an answer before the product can be ordered. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Description / textarea | Explain what the shopper should enter. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Placeholder / text | Show an example in an empty input. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Default value / text | Preselect or prefill an answer. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Minimum / number | Set the lower limit appropriate to the field type. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Maximum / number | Set the upper limit appropriate to the field type. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Restrict text input / checkbox | Enable a character restriction. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Restriction / select | Choose allowed characters. Workflow: Personalization → exact order metadata → packing | Not established by this inspection; Options: Any text, Numbers only, Letters only, Letters and numbers | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Price adjustment / number | Set an option price adjustment. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Price mode / select | Choose how an adjustment is calculated. Workflow: Personalization → exact order metadata → packing | Not established by this inspection; Options: Flat fee, Quantity based, Percentage | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Visible / checkbox | Make a choice available to the shopper. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Production label / text | Name this answer on production documents. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Production group / text | Group related answers for production. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Packing slip / checkbox | Include the answer in packing metadata. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Production sheet / checkbox | Include the answer in production metadata. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Invoice / checkbox | Include the answer in invoice metadata. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Artwork workflow / checkbox | Include the answer in artwork metadata. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Customer/cart/order display / checkbox | Show the answer to the customer. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Field ID / text | Reference another field in a visibility condition. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Operator / select | Choose the visibility comparison. Workflow: Personalization → exact order metadata → packing | Not established by this inspection; Options: Equals, Does not equal, Contains | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Value / text | Set the answer that the condition compares against. Workflow: Personalization → exact order metadata → packing | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| + Add option / button | Add a field in the unsaved editor. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Expand all / button | Show all field editors. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Collapse all / button | Fold all field editors. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Duplicate / button | Copy an option in the editor; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Delete / button | Remove an option; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| + Add choice / button | Add an answer choice; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Remove / button | Remove a choice; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Advanced JSON / button | Inspect the raw configuration view. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Apply JSON to visual editor / button | Replace editor content from JSON; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Update / button | Save group changes; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Conditional field-type visibility, uploads, visual/JSON round-trip, invalid JSON and saving were not exercised.; Existing group includes required Student Name and Grade; optional Teacher Name.

### Shopper personalization example

**Location:** /south-colby-bobcats/south-colby-gildan-tee/

**Conditions:** Product receives the SKSD Spirit Wear global group

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Student Name: * / text | Enter the student name to help deliver the order. Workflow: WordPress administration | True | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Teacher Name: / text | Enter the teacher name if known. Workflow: WordPress administration | False | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Student's Grade: * / select | Choose the grade for sorting and delivery. Workflow: WordPress administration | True; Options: Choose an option, Kindergarten, 1st Grade, 2nd Grade, 3rd Grade, 4th Grade, 5th Grade, N/A (staff, etc.) | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Quantity / number | Enter the number of this exact combination. Workflow: WordPress administration | Not established by this inspection | Observed minimum 1, initial value 1. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Clear options / link | Reset variation selections. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Control observed; not used. Inspect only during training; do not save or submit in production. |
| Add to cart / button | Adds the selected combination and personalization to cart; not clicked. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## Skilled Crafting Pull Sheet Due Dates

Installed 1.1.0; active; partial-live-review.

### Due-date staging empty state

**Location:** WooCommerce > SC Pull Sheet Due Dates

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Select WooCommerce orders first, then choose the SC bulk action. / read-only | Explains why the staging form is not visible. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Empty-state message observed; no orders selected. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Selected-order date fields, confirmation and generation results not viewed to avoid real operational records.

## Skilled Crafting Safe Batch Updates

Installed 1.0.1; active; partial-live-review.

### Safe Batch Updates

**Location:** Products > Safe Batch Updates

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Recent jobs / read-only | Check job status, completed count and failure count. Workflow: WordPress administration | Not established by this inspection | Recent completed jobs were visible; completion is historical, not this audit exercising a queue. | Reads existing status. Inspect only during training; do not save or submit in production. |
| Queue Safe Update instructions / read-only | Select Products, Bulk actions > Edit, Apply, choose fields, then Queue Safe Update. Workflow: WordPress administration | Not established by this inspection | Instructions state trash, restore and permanent deletion are not intercepted. | Instructions read; no products selected or queued. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## Skilled Crafting Site Manager

Installed 0.2.0; active; partial-live-review.

### Site Content Dashboard

**Location:** Site Content > Dashboard

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Front-end Site Edit Mode / status | View managed content outlines and direct Edit buttons from the admin bar. Workflow: WordPress administration | Not established by this inspection | Observed OFF; not enabled. | Status read only. Inspect only during training; do not save or submit in production. |
| Images / Text / CTA blocks / Featured cards / navigation | Open the managed content collections. Workflow: WordPress administration | Not established by this inspection | Dashboard showed 2 images, 58 Text/CTA blocks and 0 featured cards. | Collection entry labels observed; editors not opened. Inspect only during training; do not save or submit in production. |
| Recommended workflow / read-only | Create a managed slot, place its shortcode once in Divi, then maintain it here. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Instructions read; no slot or page modified. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## Skilled Crafting Supabase Repair Tools

Installed 1.0.0; active; partial-live-review.

### Supabase Repair Tools

**Location:** WooCommerce > Supabase Repair Tools

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Exact SKU(s) / textarea | Narrow the repair to known failed items. Workflow: WordPress administration | Not established by this inspection | Preferred by the screen for a known batch or failed pull-sheet item. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| SKU pattern / text | Search using SQL-like patterns. Workflow: WordPress administration | Not established by this inspection | Screen examples include sksc-% and %under-armour%; broad matches require care. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Minimum Woo product ID / number | Set the lower product-ID bound. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Minimum Woo variation ID / number | Set the lower variation-ID bound. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Max rows / number | Limit the number of matching records. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Sync exact SKUs from WooCommerce before repair, when exact SKUs are provided / checkbox | Refresh selected catalog data before repairing. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Call existing Supabase relink RPC after patching each product / checkbox | Request downstream link resolution after each patch. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Allow broad search with no SKU/ID filter / checkbox | Permit an unbounded search; leave untouched during audit. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Preview Matching Rows / button | Inspect candidate rows; not run to avoid exposing customer/catalog-linked records. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Dry Run Repair / button | Assess intended repair; not executed because implementation side effects have not been independently reviewed. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Apply Repair / button | Create/reuse blank products and patch links; prohibited during audit. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## WC Brand Style Manager V3

Installed 3.0.0; active; partial-live-review.

### Brand & Style Manager V3

**Location:** WooCommerce > Brand & Style Manager V3

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Select Brand / select | Choose the manufacturer metadata to apply. Workflow: WordPress administration | Not established by this inspection; Options: Dynamic Brand taxonomy; 26 displayed entries including placeholder | No selection changed. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Style / select | Choose product style, or NA fallback. Workflow: WordPress administration | Not established by this inspection; Options: NA (auto), Dynamic style list; 55 displayed entries | Full choice list and batch action labels remain unreviewed. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Complete brand/style choices, filtering, row actions, save effects and hidden-style enforcement not verified.

## WC SKU Builder Manager

Installed 2.4.0-batched-no-save-timeout-fix; active; partial-live-review.

### SKU Builder Manager

**Location:** WooCommerce > SKU Builder

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Batch size / number | Limit rebuild work per request. Workflow: WordPress administration | Not established by this inspection | Screen recommends 10–25 for 504s; 50 only if host supports it. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Update Batch Size / button | Save batch size; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Start SKU Rebuild / button | Rewrite SKUs across catalog; prohibited. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Core format / read-only | Read how SKUs are assembled. Workflow: WordPress administration | Not established by this inspection | CUSTOMER-PRODUCT-BRAND-STYLE-COLOR-SIZE-{AUTO ATTRIBUTES}; missing core values become NA. Screen states this version does not sync Supabase during rebuild. | No change. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## WooCommerce

Installed 11.2.1; active; partial-live-review.

### General settings

**Location:** WooCommerce > Settings > General

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Store address / address fields | Set the business origin used by shop calculations. Workflow: WordPress administration | Not established by this inspection | Address, City, Country/State and Postcode fields were not exported to protect contact details; individual values unreviewed. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Selling location(s) / select | Restrict where orders can originate. Workflow: WordPress administration | Not established by this inspection; Options: Sell to all countries, Sell to all countries, except for…, Sell to specific countries | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Sell to all countries, except for… / Sell to specific countries / multi-select | Choose countries for the corresponding selling mode. Workflow: WordPress administration | Not established by this inspection; Options: WooCommerce country list; exhaustive list not retained | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Shipping location(s) / select | Restrict delivery destinations. Workflow: WordPress administration | Not established by this inspection; Options: Ship to all countries you sell to, Ship to all countries, Ship to specific countries only, Disable shipping & shipping calculations | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Ship to specific countries / multi-select | Choose allowed delivery countries. Workflow: WordPress administration | Not established by this inspection; Options: WooCommerce country list; exhaustive list not retained | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Default customer location / select | Choose how an initial customer location is determined. Workflow: WordPress administration | Not established by this inspection; Options: No location by default, Shop country/region, Geolocate, Geolocate (with page caching support) | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Enable taxes / checkbox | Turn on tax calculation. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Enable coupons / checkbox | Allow coupon use. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Currency / select | Choose the currency for prices. Workflow: WordPress administration | Not established by this inspection; Options: WooCommerce currency list; exhaustive list not retained | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Currency position / select | Choose where the currency sign appears. Workflow: WordPress administration | Not established by this inspection; Options: Left, Right, Left with space, Right with space | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Thousand separator / text | Choose digit-group punctuation. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Decimal separator / text | Choose decimal punctuation. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Number of decimals / number | Set currency decimal places. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Save changes / button | Save storewide calculation settings; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Full country/currency enumeration, current defaults, conditional visibility and validation not comprehensively checked.

### Tax options

**Location:** WooCommerce > Settings > Tax

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Prices entered with tax / radio | Describe whether catalog prices already include tax. Workflow: WordPress administration | Not established by this inspection; Options: Yes, I will enter prices inclusive of tax, No, I will enter prices exclusive of tax | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Calculate tax based on / select | Choose the address used to find tax rates. Workflow: WordPress administration | Not established by this inspection; Options: Customer shipping address, Customer billing address, Shop base address | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Shipping tax class / select | Choose how shipping tax is classified. Workflow: WordPress administration | Not established by this inspection; Options: Shipping tax class based on cart items, Standard, Reduced rate, Zero rate | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Rounding / checkbox | Round at subtotal rather than each line. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Additional tax classes / textarea | Define additional tax categories. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Display prices in the shop / select | Choose whether displayed prices include tax. Workflow: WordPress administration | Not established by this inspection; Options: Including tax, Excluding tax | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Display prices during cart and checkout / select | Choose checkout tax presentation. Workflow: WordPress administration | Not established by this inspection; Options: Including tax, Excluding tax | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Price display suffix / text | Add text beside a price. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Display tax totals / select | Combine tax totals or list components. Workflow: WordPress administration | Not established by this inspection; Options: As a single total, Itemized | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Standard rates / Reduced rate rates / Zero rate rates / links | Open the rate-table editors. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Tabs observed; rate records not audited. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Shipping zones and methods

**Location:** WooCommerce > Settings > Shipping

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Zone name / text | Name a geographic delivery rule. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Zone regions / Postcodes / region selector and textarea | Set matching regions and postcode patterns. Workflow: WordPress administration | Not established by this inspection | Existing Kitsap County zone and Rest of the world fallback both show Flat rate and Free shipping. Zone match order and address matter. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Add zone / button | Create a new shipping zone; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Edit / button | Open an existing zone or method without saving. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Existing zone and its two method dialogs inspected. Inspect only during training; do not save or submit in production. |
| Enabled / toggle | Toggle a method availability. Workflow: WordPress administration | Not established by this inspection | This can save immediately; not touched. Kitsap Free shipping and Flat rate showed Yes. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Add shipping method / button | Add a method; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Delete / button | Remove a zone/method; prohibited. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Save changes / button | Save zone edits; not clicked. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Set up free shipping dialog

**Location:** WooCommerce > Settings > Shipping > Kitsap County > Free shipping > Edit

**Conditions:** Existing enabled Free shipping method; Administrator opens Edit

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Name / text | Name shown to shoppers for this method. Workflow: WordPress administration | Not established by this inspection | Observed Free shipping. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Free shipping requires / select | Choose coupon and minimum-spend eligibility. Workflow: WordPress administration | Not established by this inspection; Options: No requirement, A valid free shipping coupon, A minimum order amount, A minimum order amount OR coupon, A minimum order amount AND coupon | Persisted setting observed: A minimum order amount OR coupon. Selecting No requirement only in the unsaved modal hid the minimum/coupon-discount controls; modal was closed without saving. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Minimum order amount / currency | Set the qualifying spend. Workflow: WordPress administration | Not established by this inspection | Observed 200.00 for this zone; visible with persisted OR requirement. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Apply minimum order rule before coupon discount / checkbox | Choose whether discount is ignored for spend qualification. Workflow: WordPress administration | Not established by this inspection | Observed unchecked; hidden under unsaved No requirement choice. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Save / button | Save shipping eligibility; not clicked. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Close modal panel / button | Discard the modal without saving. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Closed after inspection without saving. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** No backend validation or save tested; other zones and all requirement combinations not tested.

### Set up flat rate dialog

**Location:** WooCommerce > Settings > Shipping > Kitsap County > Flat rate > Edit

**Conditions:** Existing enabled Flat rate method; Administrator opens Edit

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Name / text | Name displayed at checkout. Workflow: WordPress administration | Not established by this inspection | Observed Flat rate. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Tax status / select | Choose if shipping itself is taxable. Workflow: WordPress administration | Not established by this inspection; Options: Taxable, None | Observed Taxable. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Cost / text | Base cost excluding tax; supports documented formulas. Workflow: WordPress administration | Not established by this inspection | Observed 0.00. Help describes [qty], [cost] and [fee percent="10" min_fee="20" max_fee=""]. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| "Clothing" shipping class cost / currency/formula | Set an added cost for products assigned this class. Workflow: WordPress administration | Not established by this inspection | Observed 7.50 in Kitsap County only; not a universal shipping price. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| "Drinkware" shipping class cost / currency/formula | Set an added cost for products assigned this class. Workflow: WordPress administration | Not established by this inspection | Observed 8.75 in Kitsap County only; not a universal shipping price. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| "Heavy" shipping class cost / currency/formula | Set an added cost for products assigned this class. Workflow: WordPress administration | Not established by this inspection | Observed 12.00 in Kitsap County only; not a universal shipping price. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| "Local Stock" shipping class cost / currency/formula | Set an added cost for products assigned this class. Workflow: WordPress administration | Not established by this inspection | Observed 2.00 in Kitsap County only; not a universal shipping price. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| "Spirit Wear Campaign" shipping class cost / currency/formula | Set an added cost for products assigned this class. Workflow: WordPress administration | Not established by this inspection | Observed 0.00 in Kitsap County only; not a universal shipping price. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| "Sublimated Uniforms" shipping class cost / currency/formula | Set an added cost for products assigned this class. Workflow: WordPress administration | Not established by this inspection | Observed 12.00 in Kitsap County only; not a universal shipping price. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| "Uniform Bulk Order" shipping class cost / currency/formula | Set an added cost for products assigned this class. Workflow: WordPress administration | Not established by this inspection | Observed 0.00 in Kitsap County only; not a universal shipping price. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| "USPS Mail" shipping class cost / currency/formula | Set an added cost for products assigned this class. Workflow: WordPress administration | Not established by this inspection | Observed 1.00 in Kitsap County only; not a universal shipping price. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| No shipping class cost / currency/formula | Set cost for products with no assigned class. Workflow: WordPress administration | Not established by this inspection | Observed 8.00. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Calculation type / select | Add each class cost or use the highest class cost. Workflow: WordPress administration | Not established by this inspection; Options: Per class: Charge shipping for each shipping class individually, Per order: Charge shipping for the most expensive shipping class | Observed Per order. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Save / button | Save shipping charges; not clicked. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Close modal panel / button | Exit without saving. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Modal closed without changes. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Classic checkout field structure

**Location:** /checkout/

**Conditions:** Existing browser session already had cart items; auditor did not add, remove or change quantities.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Coupon / Apply coupon / text and button | Enter and apply an eligible coupon. Workflow: WooCommerce shopper order → payment → fulfillment | False | No code entered or applied. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Billing first name / last name / text | Identify the purchaser. Workflow: WooCommerce shopper order → payment → fulfillment | True | Required asterisk in UI; native required attribute was false. Server validation untested. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Country / Region / select | Choose the billing country. Workflow: WooCommerce shopper order → payment → fulfillment | True; Options: United States (US) | Only US was offered in inspected checkout. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Street address / text | Enter the street delivery/billing location. Workflow: WooCommerce shopper order → payment → fulfillment | True | No values recorded. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Apartment, suite, unit, etc. / text | Provide optional secondary address. Workflow: WooCommerce shopper order → payment → fulfillment | False | Optional label observed. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Town / City / text | Name the city. Workflow: WooCommerce shopper order → payment → fulfillment | True | Required asterisk in UI. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| State / select | Choose the state. Workflow: WooCommerce shopper order → payment → fulfillment | True; Options: US state/territory list; exhaustive list not retained | Required asterisk in UI. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| ZIP Code / text | Enter postal code. Workflow: WooCommerce shopper order → payment → fulfillment | True | Required asterisk in UI. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Phone / tel | Enter a contact number. Workflow: WooCommerce shopper order → payment → fulfillment | True | Required asterisk in UI. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Email address / email | Enter order contact email. Workflow: WooCommerce shopper order → payment → fulfillment | True | Required asterisk in UI. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Ship to a different address? / checkbox | Reveal/use a separate shipping destination. Workflow: WooCommerce shopper order → payment → fulfillment | False | Shipping-name/address/country/state/ZIP/phone controls were present in DOM; visibility toggle not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Order notes / textarea | Add delivery or order instructions. Workflow: WooCommerce shopper order → payment → fulfillment | False | Optional. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Card / radio | Choose card payment. Workflow: WooCommerce shopper order → payment → fulfillment | False | Card method label observed; payment data never entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Save payment information to my account for future purchases. / checkbox | Retain a payment method for later use. Workflow: WooCommerce shopper order → payment → fulfillment | False | Not selected during audit. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| I have read and agree to the returns policy * / checkbox | Confirm shopper agreement before placing an order. Workflow: WooCommerce shopper order → payment → fulfillment | True | Not selected; no agreement accepted. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Apply store credit discounts? / Apply / control and button | Use eligible store credit. Workflow: WooCommerce shopper order → payment → fulfillment | False | Section heading and Apply observed; controls and balances not fully audited. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Place order / button | Submit the order and payment flow. Workflow: WooCommerce shopper order → payment → fulfillment | True | Prohibited and never clicked. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Guest/empty-cart/mobile states and shipping toggle untested.; No coupons, store credit, policy agreement, order submission, tax/rate calculation or validation tested.

### Find Your Store (site content)

**Location:** /shop-new/

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Schools / Teams & clubs / Businesses / anchors | Jump to organization categories. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Navigation controls observed. Inspect only during training; do not save or submit in production. |
| Find a store by name / search | Filter the visible organization cards. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | A deliberately unmatched query showed: No matching store found. Try a shorter name, or contact us for help. Clearing restored all cards. Inspect only during training; do not save or submit in production. |
| Shop organization cards / links | Open a WooCommerce product category. Workflow: WordPress administration | Not established by this inspection | Observed 6 school, 6 team/club and 1 business links; category destinations, not new client-store CPT pages. | Navigates to the selected collection. Inspect only during training; do not save or submit in production. |
| Team order forms / Bulk order template / New customer information / Request artwork or store help / links | Choose the matching ordering/help workflow. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Navigation only. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Team Orders workflow explanation

**Location:** /team-orders/

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Find your school or team store / link | Open the recurring-store directory. Workflow: WordPress administration | Not established by this inspection | This page points to /find-your-store/; homepage uses /shop-new/. Alias consistency needs review. | Link observed; alias destination not independently tested. Inspect only during training; do not save or submit in production. |
| Start an Online Group Order / link | Open the occasional team-order form. Workflow: WordPress administration | Not established by this inspection | Observed destination https://app.skilledcrafting.com/team-order; public text explains review, artwork approval, QuickBooks invoice/payment and scheduled production. Form itself not submitted or audited. | Navigation only. Inspect only during training; do not save or submit in production. |
| Start an artwork request / link | Open design intake when artwork help is needed. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Public artwork form inspected separately. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

### Organization category example

**Location:** /product-category/south-colby-bobcats/

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Product card / product title / link | Open a product within this organization. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | South Colby Gildan Tee product page inspected without ordering. Inspect only during training; do not save or submit in production. |
| Cart totals area / read-only | Review existing cart summary. Workflow: WordPress administration | Not established by this inspection | Cart summary was present in category DOM; no customer/order/cart values retained. | No cart change. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## WooCommerce Shipping

Installed 2.4.3; active; partial-live-review.

### WooCommerce Shipping settings

**Location:** WooCommerce > Settings > Shipping > WooCommerce Shipping

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Paper size / select | Choose label printing paper. Workflow: WordPress administration | Not established by this inspection; Options: Select an Option, Label (4"x6"), Letter (8.5"x11") | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Email label purchase receipts / checkbox | Send postage receipts when labels are purchased. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Remember service selection / checkbox | Reuse prior carrier service. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Remember package selection / checkbox | Reuse prior package. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Enable address validation at checkout / checkbox | Check shipping addresses during checkout. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Open print dialog after successful label purchase / checkbox | Open printing after postage is bought. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Remember last shipping date / checkbox | Reuse the last shipping date. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Enable automatic returns of undeliverable international shipments / checkbox | Request returns for undeliverable international shipments. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Enable USPS® SCAN Form feature / checkbox | Enable USPS scan-form workflow. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Import One-Stop Shop (IOSS) / configuration | Configure international tax identification handling. Workflow: WordPress administration | Not established by this inspection | Only control labels inspected; account values omitted. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Norwegian VAT On E-Commerce (VOEC) / configuration | Configure international tax identification handling. Workflow: WordPress administration | Not established by this inspection | Only control labels inspected; account values omitted. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Postponed VAT Accounting (PVA) / configuration | Configure international tax identification handling. Workflow: WordPress administration | Not established by this inspection | Only control labels inspected; account values omitted. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Edit / button | Edit an origin address; not opened. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Delete / button | Remove an origin; prohibited. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Add new address / button | Create an origin; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Save changes / button | Persist shipping preferences; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Carrier/package/service/label purchase dialogs, charges, address validation and print outputs require a nonproduction fixture.

## WooCommerce Square

Installed 5.5.2; active; partial-live-review.

### Square settings (partial labels)

**Location:** WooCommerce > Settings > Square

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Environment / select | Choose the Square service environment. Workflow: WordPress administration | Not established by this inspection; Options: Please choose an environment, Production, Sandbox | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Location / select | Choose a Square business location. Workflow: WordPress administration | Not established by this inspection; Options: Please choose a location, Configured business locations omitted | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Synchronization source selector (label not captured) / select | Select which system supplies catalog data. Workflow: WordPress administration | Not established by this inspection; Options: Disabled, Square, WooCommerce | Choices observed; exact label and selected value not established. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Sync interval selector (label not captured) / select | Choose how often synchronization runs. Workflow: WordPress administration | Not established by this inspection; Options: 15 minutes, 30 minutes, 45 minutes, 1 hour, 2 hours, 3 hours, 6 hours, 8 hours, 12 hours, 24 hours | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Diagnostic output selector (label not captured) / select | Choose how payment/nonpayment errors are displayed or logged. Workflow: WordPress administration | Not established by this inspection; Options: Off, Payment Errors — Show on Checkout Page, Payment Errors — Save to Log, Payment Errors — Show on Checkout and Save to Log, Payment Errors — Show on Checkout, Non-Payment Errors — Save to Log, (Payment + Non-payment) Errors — Save to Log, Non-Payment Errors — Save to Log | Observed interface only. Installed settings are not necessarily vendor defaults. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Disconnect from Square / button | Disconnect integration; prohibited. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Import all Products from Square / button | Write catalog data; prohibited. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Save changes / button | Persist Square configuration; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Current environment, sync direction, connection health and exact labels for custom controls require further sanitized review.; No import, synchronization, inventory or payment tests.

## WooCommerce to Supabase Product Sync

Installed 2.9.1-brand-normalized-rpc-fix; active; partial-live-review.

### Supabase Sync

**Location:** WooCommerce > Supabase Sync

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| True batch size / number | Limit how many records sync per request. Workflow: WordPress administration | Not established by this inspection | Screen recommends 25–100 with linking unchecked; 10–25 if hosting times out. Current value not recorded. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Link each SKU during sync / checkbox | Combine catalog syncing with blank linking. Workflow: WordPress administration | Not established by this inspection | Screen recommends leaving unchecked to reduce timeouts; current checked state not recorded. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Save Sync Settings / button | Persist batch/linking configuration; not used. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync Published Variations / button | Sync published variation records incrementally. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync Published Simple Products / button | Sync simple published products. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Run Supabase Batch Relink / button | Link synced products to blank master records. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync Customer Attribute Terms / button | Copy global Customer attribute terms. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync Order Customers / button | Copy billing customers from Woo orders. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync Logo Attribute Terms / button | Copy logo terms. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync Customers / button | Copy Customer lookup data. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync Logos / button | Copy Logo Type lookup data. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync Brands / button | Copy Brand lookup data. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync Styles / button | Copy Style lookup data. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync Colors / button | Copy Color lookup data. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync Sizes / button | Copy Size lookup data. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Sync All Attributes / button | Copy all supported attribute lookups. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Rebuild Brand + Style IDs from WooCommerce / button | Repair historical brand/style mappings from WooCommerce. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Rebuild Brand IDs Only / button | Repair brand mappings. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |
| Rebuild Style IDs Only / button | Repair style mappings. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Post-save outcomes, validation failures and other role/device states remain unverified.

## WooPayments

Installed 11.2.0; active; partial-live-review.

### Card payment surface

**Location:** /checkout/

**Conditions:** Classic checkout loaded in existing session

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Card / radio | Choose card payment. Workflow: WooCommerce shopper order → payment → fulfillment | False | Card method label observed; payment data never entered. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Save payment information to my account for future purchases. / checkbox | Retain a payment method for later use. Workflow: WooCommerce shopper order → payment → fulfillment | False | Not selected during audit. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Gateway settings, failed/3DS/express-payment dialogs, account status and processing untested.

## WPForms Lite

Installed 2.0.2.2; active; partial-live-review.

### Public artwork request

**Location:** /custom-logo-and-graphic-helper/

**Conditions:** Authorized screen access; other roles not tested.

**Evidence scope:** Rendered labels, choices and explanatory text only unless explicitly stated; no save or transactional outcome verification.

| Control / type | Novice instruction and workflow | Required / options | Advanced operating note | Effect and safety |
|---|---|---|---|---|
| Your Name * / text | Identify the requester. Workflow: WordPress administration | True | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Organization / Team Name * / text | Identify the requesting organization. Workflow: WordPress administration | True | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Email * / email | Provide the reply address. Workflow: WordPress administration | True | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Project Type / text | Describe the project. Workflow: WordPress administration | False | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Who is wearing this? / checkboxes | Describe the audience. Workflow: WordPress administration | False; Options: Elementary students, Middle school students, High school students, Adult sports team, Trades / labor crew, Fans / supporters, General public, Other | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| If Other, please describe (audience) / text | Clarify the Other audience. Workflow: WordPress administration | False | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Printing Canvas / checkboxes | Choose print placements or item types. Workflow: WordPress administration | False; Options: Left-chest print, Full front, Full back, Sleeve print, Hat / patch, Hoodie front, Hoodie back, Other | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| If Other, please describe (canvas) / text | Clarify another placement. Workflow: WordPress administration | False | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Your Brand's Attitude / radio | Choose the intended character of the brand. Workflow: WordPress administration | False; Options: Aggressive & Powerful, Clean and sophisticated, Playful and friendly, Edgy and alternative, Rustic and outdoorsy, Modern and minimalist | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Your Brand's Visual Era / radio | Choose a visual period. Workflow: WordPress administration | False; Options: VIntage heritage, Retro (1950’s-1980’s), Modern / minimalist, Futuristic / tech, 1930’s rubber hose, 1970’s athletic, 1990’s neon / Memphis, Y2K chrome, Americana | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Ink Color / radio | Choose one-color or full-color artwork. Workflow: WordPress administration | False; Options: Single color design, Full-color design | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Line Edge Quality / checkboxes | Describe line style. Workflow: WordPress administration | False; Options: Monoline, Thick-inked, Razor-sharp, Geometric, Calligraphic, Heavy-gauge, Continuous-line | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Color Style / checkboxes | Describe palette. Workflow: WordPress administration | False; Options: Duotone, Muted, Earthy, Neon, Pastel, High-contrast, Monochromatic | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| subject / Preferred / text | Ambiguous visible form label; purpose needs owner clarification. Workflow: WordPress administration | False | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Attitude (Visual Tone) / checkboxes | Choose visual tone. Workflow: WordPress administration | False; Options: Fierce, Sophisticated, Playful, Dynamic, Rustic, Elegant, Edgy | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Texture / Finish / checkboxes | Choose surface appearance. Workflow: WordPress administration | False; Options: Distressed, Halftone, Stippled, Cracked-ink, Weathered, Matte, Glossy, Chrome | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Style Direction Alignment / radio | Choose banner/label treatment. Workflow: WordPress administration | False; Options: VIntage / Distressed Americana Patch, Sleek / Minimalist Monoline Crest, Not sure yet | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Main subject (mascot or symbol) to feature / text | Describe the central subject. Workflow: WordPress administration | False | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Specific elements in the graphic / textarea | List required graphic elements. Workflow: WordPress administration | False | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Text to add in the graphic / textarea | Provide exact wording. Workflow: WordPress administration | False | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Final Notes / textarea | Add remaining instructions. Workflow: WordPress administration | False | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Preferred garment color / text | Specify the garment base. Workflow: WordPress administration | False | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Preferred design shape: / radio | Choose design geometry. Workflow: WordPress administration | False; Options: Crest, Badge, Mascot, Text only, Circular, Horizontal, Vertical | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| What emotion should people feel when they see this design? / radio | Choose desired emotional response. Workflow: WordPress administration | False; Options: Trust, Pride, Strength, Tradtion, Excitement, Humor, Luxury, Professionalism, Patriotism, Community, Other | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Deadline / text | Describe requested timing. Workflow: WordPress administration | False | Rendered field labels/options inspected. Conditional Other visibility and submission errors not exercised. | Edits the unsaved form; persistence and downstream effects were not exercised. Inspect only during training; do not save or submit in production. |
| Submit / button | Send a real artwork request; prohibited during audit. Workflow: WordPress administration | Not established by this inspection | Observed interface only. Installed settings are not necessarily vendor defaults. | Operational action shown but not executed; intended effect comes from the live screen text. Inspect only during training; do not save or submit in production. |

**Validation / troubleshooting:** No production submission was used to provoke server errors. If the control is missing, verify the exact menu, prerequisite record selection, activation and authorized role before changing anything. If a saved outcome is wrong, use the integration-specific checks in operations-integrity.md; do not repeatedly run repair or sync.

**Remaining:** Form builder mapping, notification recipients, spam controls, conditional Other visibility and successful intake not verified.; Unlabeled inputs were excluded from novice instructions; owner should review ambiguous labels.

## Unreviewed plugin screens

- Additional Variation Images Gallery for WooCommerce: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Advanced Coupons for WooCommerce Free: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Advanced Order Export For WooCommerce: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- AI Agent by SiteGround: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Akismet Anti-spam: Spam Protection: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Classic Editor: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Code Snippets: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Custom Order Status Manager for WooCommerce: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Extra Product Options For WooCommerce | Custom Product Addons and Fields: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Google for WooCommerce: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Jetpack: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Ninjalytics: Sales Reports & Order Export for WooCommerce and EDD: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Order Export for WooCommerce: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Permalink Manager Lite: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Product SKU Generator for WooCommerce: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Reno Product Slider (formerly Product Slider for WooCommerce): settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Skilled Crafting - Woo Bulk Brand & Style Editor: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Skilled Crafting Manual Pull Sheet Generator: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- SKU Generator for WooCommerce: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Spectra Legacy: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Speed Optimizer: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- Starter Templates: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- UpdraftPlus - Backup/Restore: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- WC Attribute Export Tool: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- WooCommerce Filter Orders by Coupon: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- WooCommerce Legacy REST API: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- WooCommerce Product Add-Ons: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- WooCommerce Variation Batch Updater: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
- WooCommerce.com Update Manager: settings, meaningful conditional states, validation, defaults and role/device coverage remain open.
