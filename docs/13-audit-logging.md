# Audit Logging & Activity Trail
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready audit logging specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` through `docs/12-dashboard-and-analytics.md`
>
> The audit system provides a historical record of important security-sensitive and operational actions. It is not intended to capture every click or page view.

---

# 1. Audit Logging Goal

The audit system answers:

```text
Who did what?
When?
To which record?
What important change occurred?
```

Example:

```text
14 Aug 2026 14:05

Technician B
RESOLVED
Maintenance Request MR-2026-0017

Asset:
AST-2026-00142
```

Audit history should remain useful even after the current state of a record changes.

---

# 2. Why Audit Logging Exists

Audit logging provides:

- Accountability
- Operational history
- Security investigation
- Administrative traceability
- Asset lifecycle history
- Maintenance lifecycle history
- Role-change traceability

It should help answer questions such as:

```text
Who retired this asset?
Who assigned this maintenance request?
Who changed this user's role?
Who returned this asset?
When was this asset created?
```

---

# 3. What Audit Logging Is NOT

Do not use audit logs for:

```text
Every page view
Every mouse click
Every keystroke
Every search
Every button hover
```

This creates unnecessary database growth and noisy logs.

Audit important actions, not UI telemetry.

---

# 4. Audit Table

Use the project's `audit_logs` table defined in the database schema.

Conceptual fields:

```text
id
actor_id
action
entity_type
entity_id
metadata
created_at
```

The exact column names/types must match `03-database-schema.md`.

---

# 5. Actor Identity

The actor must come from the authenticated session:

```text
auth.uid()
```

Never accept:

```text
actor_id
```

as a trusted browser-provided value.

Correct:

```text
Authenticated request
      ↓
auth.uid()
      ↓
audit_logs.actor_id
```

---

# 6. System-Generated Events

Some operations may be initiated by a system workflow.

If a true system actor is required, use a clearly defined mechanism.

Do not pretend that an arbitrary user performed an action they did not perform.

For MVP, most operational events should have:

```text
actor_id = authenticated user
```

---

# 7. Core Audit Events

At minimum, support:

```text
ASSET_CREATED
ASSET_UPDATED
ASSET_REGISTERED_LOCATION_CHANGED
ASSET_ASSIGNED
ASSET_RETURNED
ASSET_TRANSFERRED
ASSET_STATUS_CHANGED
ASSET_RETIRED

MAINTENANCE_CREATED
MAINTENANCE_ASSIGNED
MAINTENANCE_STARTED
MAINTENANCE_STATUS_CHANGED
MAINTENANCE_HISTORY_ADDED
MAINTENANCE_RESOLVED
MAINTENANCE_CANCELLED
MAINTENANCE_EVIDENCE_UPLOADED

ROLE_CHANGED
ACCOUNT_ACTIVATED
ACCOUNT_DEACTIVATED

QR_GENERATED
```

The final enum/string strategy must match the database schema.

---

# 8. Asset Creation Event

When Admin creates an asset:

```text
ASSET_CREATED
```

Record:

```text
actor
asset
timestamp
```

Optional metadata:

```text
name
category
registered building
registered room
```

Do not duplicate huge asset objects in the audit record.

---

# 9. Asset Update Event

When an asset's important information changes:

```text
ASSET_UPDATED
```

Metadata can describe the changed fields.

Example:

```json
{
  "changed_fields": [
    "name",
    "department"
  ]
}
```

Do not store sensitive information unnecessarily.

---

# 10. Registered Location Change

This deserves a specific event:

```text
ASSET_REGISTERED_LOCATION_CHANGED
```

Example:

```json
{
  "old_building": "Vyas",
  "old_room": "VY001",
  "new_building": "Vyas",
  "new_room": "VY101"
}
```

This helps distinguish:

```text
Permanent/home location change
```

from:

```text
Temporary usage location
```

---

# 11. Asset Assignment Event

When an asset becomes assigned:

```text
ASSET_ASSIGNED
```

Metadata may include:

```text
assignment_id
usage_building
usage_room
expected_return
```

Do not unnecessarily store private user information in JSON metadata if the assignment record already contains it.

---

# 12. Asset Return Event

When an asset is returned:

```text
ASSET_RETURNED
```

Metadata:

```text
assignment_id
returned_at
```

The assignment record remains the authoritative source for detailed assignment history.

---

# 13. Asset Transfer Event

When responsibility changes:

```text
ASSET_TRANSFERRED
```

Record:

```text
old assignment
new assignment
```

where useful.

Do not delete the old assignment to simplify the transfer.

---

# 14. Asset Status Change

When status changes:

```text
ASSET_STATUS_CHANGED
```

Metadata:

```json
{
  "old_status": "AVAILABLE",
  "new_status": "IN_MAINTENANCE"
}
```

This provides a historical state transition.

---

# 15. Asset Retirement

Retirement should create:

```text
ASSET_RETIRED
```

Example:

```text
Admin
 ↓
Retire AST-2026-00142
 ↓
ASSET_RETIRED
```

The asset remains in the database.

---

# 16. Maintenance Creation

When a user reports a problem:

```text
MAINTENANCE_CREATED
```

Metadata may include:

```text
request_id
asset_id
priority
```

Do not put the full problem description into audit metadata if it already exists in the maintenance request.

---

# 17. Maintenance Assignment

When Admin assigns a technician:

```text
MAINTENANCE_ASSIGNED
```

Metadata:

```text
request_id
technician_id
```

The maintenance request remains the source of truth for the current assignment.

---

# 18. Maintenance Started

When technician starts work:

```text
MAINTENANCE_STARTED
```

Metadata:

```text
request_id
```

The request's status remains the authoritative current state.

---

# 19. Maintenance Status Change

When status changes:

```text
MAINTENANCE_STATUS_CHANGED
```

Example:

```json
{
  "old_status": "ASSIGNED",
  "new_status": "IN_PROGRESS"
}
```

This should be generated by the authorized workflow.

---

# 20. Maintenance History Added

When a technician adds an important repair-history entry:

```text
MAINTENANCE_HISTORY_ADDED
```

Metadata can include:

```text
maintenance_request_id
history_entry_id
history_type
```

Do not duplicate the complete notes in audit metadata.

---

# 21. Maintenance Resolution

When a request is resolved:

```text
MAINTENANCE_RESOLVED
```

Metadata may include:

```text
request_id
final_asset_status
resolved_at
```

The resolution notes belong to the maintenance record.

---

# 22. Maintenance Cancellation

When an authorized user cancels a request:

```text
MAINTENANCE_CANCELLED
```

Metadata may include:

```text
request_id
reason
```

Avoid storing sensitive free-form information in audit metadata unless needed.

---

# 23. Maintenance Evidence Upload

When a file is added:

```text
MAINTENANCE_EVIDENCE_UPLOADED
```

Metadata:

```text
document_id
maintenance_request_id
file_type
```

Do not store:

```text
signed URL
access token
```

in the audit record.

---

# 24. Role Change

Role changes are highly sensitive.

Event:

```text
ROLE_CHANGED
```

Metadata:

```json
{
  "old_role": "STUDENT",
  "new_role": "TECHNICIAN"
}
```

Actor:

```text
Admin who performed the change
```

Target:

```text
User whose role changed
```

The target user should be represented by:

```text
entity_type = PROFILE
entity_id = target_profile_id
```

or the schema's equivalent.

---

# 25. Account Activation

When an account becomes active:

```text
ACCOUNT_ACTIVATED
```

Record:

```text
actor
target profile
timestamp
```

---

# 26. Account Deactivation

When an account is disabled:

```text
ACCOUNT_DEACTIVATED
```

This is important for security investigations.

Do not delete historical user actions simply because an account becomes inactive.

---

# 27. QR Events

If QR issuance is audited:

```text
QR_GENERATED
```

Metadata:

```text
asset_id
public_id
```

Do not log the complete QR binary data.

The QR can always be regenerated from the public URL.

---

# 28. Audit Metadata Rules

Metadata should be:

- Small
- Structured
- Relevant
- Non-sensitive
- Useful for investigation

Good:

```json
{
  "old_status": "AVAILABLE",
  "new_status": "ASSIGNED"
}
```

Bad:

```json
{
  "entire_asset_record": "...huge object..."
}
```

---

# 29. Do Not Store Secrets

Never store:

```text
password
access_token
refresh_token
service_role_key
signed_url
API key
session cookie
```

in audit metadata.

---

# 30. Audit Immutability

Audit records should be append-only.

Normal users should not be able to:

```text
UPDATE audit log
DELETE audit log
```

The preferred model is:

```text
INSERT
```

only.

---

# 31. Who Can Read Audit Logs?

Recommended:

```text
ADMIN
```

only.

Technicians should not automatically receive full audit access.

Students/Staff should not access the audit-log table.

Public users must never access audit logs.

---

# 32. Audit RLS

RLS should enforce:

```text
ADMIN → SELECT
authorized system workflow → INSERT
others → DENY
```

Avoid granting normal client users the ability to insert arbitrary audit records.

Audit creation should happen through trusted workflows/database functions where practical.

---

# 33. Preventing Fake Audit Events

A student should not be able to call:

```text
INSERT audit_logs
{
  "actor_id": "admin-id",
  "action": "ASSET_RETIRED"
}
```

and create a fake administrative history entry.

The database/workflow must derive the actor from:

```text
auth.uid()
```

---

# 34. Audit Event Integrity

For important workflows, create the audit event in the same database transaction as the operation.

Example:

```text
Resolve maintenance
      ↓
BEGIN
      ↓
Update maintenance
Insert history
Update asset
Insert audit
      ↓
COMMIT
```

If the transaction fails:

```text
ROLLBACK
```

This prevents:

```text
Asset says AVAILABLE
but no audit event exists
```

when audit integrity is required.

---

# 35. Audit vs History

Do not confuse:

```text
Audit log
```

with:

```text
Maintenance history
```

### Audit log

Security/operational accountability:

```text
Who performed the action?
When?
What entity?
What action?
```

### Maintenance history

Repair-specific information:

```text
What was diagnosed?
What was repaired?
What parts were replaced?
What testing occurred?
```

Both are useful.

---

# 36. Audit vs Assignment History

Assignment records answer:

```text
Who had the asset?
Where was it being used?
When?
```

Audit records answer:

```text
Who performed the assignment operation?
```

Do not duplicate the entire assignment history inside audit metadata.

---

# 37. Audit Log UI

Admin route:

```text
/admin/audit-logs
```

Suggested layout:

```text
Audit Logs

Filter:
Action [▼]
Entity [▼]
Actor [▼]
Date [▼]

┌──────────────────────────────────────────────┐
│ Time │ Actor │ Action │ Entity │ Details     │
├──────────────────────────────────────────────┤
│14:05 │ Tech B│ RESOLVE│ MR-017 │ Projector   │
│13:40 │ Admin │ ASSIGN │ MR-017 │ Tech B      │
│12:20 │ Admin │ CREATE │ AST-142│ Projector   │
└──────────────────────────────────────────────┘
```

---

# 38. Audit Detail

Clicking an audit record may show:

```text
Action:
ASSET_STATUS_CHANGED

Actor:
Admin User

Entity:
AST-2026-00142

Time:
14 Aug 2026 14:05

Metadata:
Old status: AVAILABLE
New status: IN_MAINTENANCE
```

Do not expose database internals unnecessarily.

---

# 39. Audit Search

Search/filter by:

```text
Action
Entity type
Entity ID
Actor
Date range
```

For MVP, these are sufficient.

---

# 40. Audit Pagination

Audit logs can grow quickly.

Always paginate.

Example:

```text
20 records/page
```

Never load the entire audit table.

---

# 41. Audit Sorting

Default:

```text
Newest first
```

This makes the latest operational activity immediately visible.

---

# 42. Audit Date Handling

Store timestamps consistently in the database.

Prefer:

```text
UTC
```

for persisted timestamps.

Display in the user's/local institutional timezone.

Do not store ambiguous local-time strings as the primary timestamp.

---

# 43. Audit Metadata JSON

If the schema uses PostgreSQL JSON/JSONB:

Use structured JSON.

Example:

```json
{
  "old_status": "ASSIGNED",
  "new_status": "IN_PROGRESS"
}
```

Avoid:

```text
"Technician started work at 14:05 because..."
```

when structured fields are sufficient.

---

# 44. Audit Retention

For the MVP:

> Retain audit records for the lifetime of the relevant system/data unless institutional policy requires another retention period.

Do not automatically purge audit history.

If a retention policy is later required, implement it explicitly.

---

# 45. Audit Growth

Audit records are smaller than files but can still grow.

To control growth:

- Log meaningful events only.
- Do not log page views.
- Do not log repeated filter changes.
- Keep metadata compact.
- Paginate reads.

---

# 46. Audit Indexes

Useful database indexes may include:

```text
created_at
actor_id
entity_type
entity_id
action
```

The exact indexes should be based on the database schema and expected query patterns.

Do not create unnecessary indexes everywhere.

---

# 47. Audit Event Helper

Create a reusable server-side mechanism.

Conceptual:

```text
recordAuditEvent({
  action,
  entityType,
  entityId,
  metadata
})
```

The helper should derive:

```text
actor_id = auth.uid()
```

rather than accepting an arbitrary actor ID.

---

# 48. Audit Event Constants

Avoid scattered strings.

Use a centralized definition:

```text
AUDIT_ACTIONS = {
  ASSET_CREATED,
  ASSET_UPDATED,
  ...
}
```

The exact implementation can use TypeScript constants/enums compatible with the database schema.

---

# 49. Audit Workflow Example

Asset retirement:

```text
Admin clicks Retire
       ↓
Frontend confirmation
       ↓
Server workflow
       ↓
Authenticate admin
       ↓
Validate asset
       ↓
Update asset status
       ↓
Insert ASSET_RETIRED
       ↓
Commit
       ↓
Return success
```

---

# 50. Audit Workflow Example — Maintenance

Resolve:

```text
Technician clicks Resolve
       ↓
Server workflow
       ↓
Authenticate
       ↓
Check technician assignment
       ↓
Validate request state
       ↓
Update request
       ↓
Insert maintenance history
       ↓
Update asset status
       ↓
Insert MAINTENANCE_RESOLVED
       ↓
Commit
```

---

# 51. Audit Workflow Example — Role Change

```text
Admin
 ↓
Select user
 ↓
Change role
 ↓
Server authorization
 ↓
Read old role
 ↓
Update new role
 ↓
Insert ROLE_CHANGED
 ↓
Commit
```

---

# 52. Audit Error Handling

If an important operation requires an audit event:

```text
Business operation fails
OR
Audit fails
```

the transaction should fail together where practical.

Do not silently continue if the audit record is a mandatory part of the workflow.

---

# 53. Audit UI Security

Even if:

```text
/admin/audit-logs
```

is hidden from navigation:

a Student entering the URL directly must still receive:

```text
403 / Unauthorized
```

or an equivalent protected response.

---

# 54. Audit Dashboard Integration

Admin dashboard may show:

```text
Recent Activity
```

but only a small subset.

Example:

```text
Recent Activity

Admin created AST-142
Technician B started MR-017
Admin assigned MR-018
```

Link:

```text
[View All]
```

to the audit page.

---

# 55. Audit Testing

Claude Code must test:

### Creation

```text
Create asset
→ ASSET_CREATED
```

### Assignment

```text
Assign asset
→ ASSET_ASSIGNED
```

### Return

```text
Return asset
→ ASSET_RETURNED
```

### Maintenance

```text
Create
Assign
Start
Resolve
```

creates expected events.

### Role

```text
Admin changes role
→ ROLE_CHANGED
```

### Security

```text
Student reads audit logs
→ denied

Student inserts audit event
→ denied

Student impersonates admin actor
→ impossible
```

---

# 56. Audit Consistency Tests

Test that:

```text
Asset state
+
Assignment state
+
Maintenance state
+
Audit state
```

remain consistent after successful workflows.

Example:

```text
Maintenance resolved
```

should result in:

```text
maintenance.status = RESOLVED
maintenance_history exists
asset status = appropriate final state
audit event exists
```

---

# 57. Audit Performance

Audit queries should:

- Use indexed fields
- Paginate
- Select only required columns
- Avoid huge metadata payloads

Do not load the entire history for every page.

---

# 58. Audit Export

Optional future feature:

```text
Export filtered audit logs
```

If implemented, export should be:

- Admin-only
- Server-side
- Filter-aware
- Rate-limited if necessary

Do not implement for MVP unless required.

---

# 59. Audit Definition of Done

The audit subsystem is complete when:

- Important asset operations are logged.
- Important assignment operations are logged.
- Important maintenance operations are logged.
- Role/account security changes are logged.
- Actor comes from authenticated identity.
- Audit records are append-only.
- Students/Staff cannot access audit logs.
- Technicians cannot access full audit logs unless explicitly authorized.
- Admin can view audit logs.
- Audit records are paginated.
- Audit records can be filtered.
- Sensitive secrets are never logged.
- Important workflows create audit records atomically where practical.
- Audit metadata remains compact and structured.
- Historical audit records survive normal asset/user lifecycle changes.
- Audit tests verify actor integrity and event creation.
