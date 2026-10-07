# RLS & Security Policies
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready authorization specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md`, `docs/01-product-requirements.md`, `docs/02-system-architecture.md`, `docs/03-database-schema.md`
>
> **Important:** These policies are the database security boundary. Frontend role checks are for UX only and must never be treated as sufficient authorization.

---

# 1. Security Model

Use layered security:

```text
Browser
   ↓
Next.js
   ↓
Authentication
   ↓
Application authorization
   ↓
Supabase/PostgreSQL
   ↓
Row Level Security
   ↓
Data
```

The most important rule is:

> **If a malicious user bypasses the UI and calls Supabase directly, RLS must still prevent unauthorized access.**

---

# 2. Roles

Application roles:

```text
ADMIN
TECHNICIAN
STAFF
STUDENT
```

Public users are unauthenticated.

Role information is stored in:

```text
profiles.role
```

The authenticated identity comes from:

```text
auth.users.id
```

---

# 3. Authentication vs Authorization

Authentication answers:

> Who is this user?

Supabase Auth handles this.

Authorization answers:

> What may this user do?

Application logic + RLS handle this.

Never trust:

- client-side role values
- URL parameters
- hidden form fields
- arbitrary `user_id` supplied by the browser

The authenticated user identity must come from the Supabase session/database context.

---

# 4. RLS Must Be Enabled

Enable RLS on all application tables containing protected or user-generated data.

At minimum evaluate/enable RLS for:

```text
profiles
buildings
rooms
assets
asset_assignments
maintenance_requests
maintenance_history
asset_documents
notifications
audit_logs
```

Do not create broad policies such as:

```sql
USING (true)
```

for sensitive tables unless the table is genuinely intended to be public.

---

# 5. Security Helper Functions

Prefer small PostgreSQL helper functions for repeated authorization checks.

Conceptual helpers:

```text
is_admin()
is_technician()
is_staff_or_student()
is_active_user()
```

If helper functions are implemented, ensure they:

- Do not recursively trigger the same RLS policies.
- Are safe from privilege escalation.
- Do not expose sensitive data.
- Use the authenticated Supabase identity.

Do not duplicate complicated role logic across dozens of policies.

---

# 6. Public Asset Access

The public QR page must be able to retrieve safe asset information without authentication.

However, public users must NOT receive the entire `assets` row.

Preferred approach:

Create a controlled public read interface, such as:

- a database view containing only safe fields, or
- a carefully restricted query/API path.

Publicly exposed fields may include:

```text
public_id
asset_id
name
category
status
department
registered building/room where appropriate
public image reference where appropriate
```

Do NOT expose:

```text
serial_number
internal UUID
internal notes
private maintenance data
user assignments
private documents
audit logs
sensitive metadata
```

The exact public fields should be explicitly selected rather than using:

```text
SELECT *
```

---

# 7. Profiles Policies

## Public

No public access to profiles.

## Authenticated user

A user may read their own profile.

Example:

```text
auth.uid() = profiles.id
```

## Admin

Admins may read authorized profiles.

Admins may update role/profile fields according to the application rules.

## Student/Staff

Must not:

- Read arbitrary user profiles
- Change their own role
- Change another user's role

## Technician

Must not:

- Change roles
- Read unrelated private profile data unless required for assigned maintenance

---

# 8. Profile Role Security

The role field is highly sensitive.

Never allow:

```text
Student → UPDATE role = ADMIN
```

through a generic profile update.

Role changes must be restricted to authorized administrative operations.

Prefer a dedicated server-side/admin operation for role changes rather than exposing a generic profile update.

Every role change must create an audit record.

---

# 9. Buildings Policies

Buildings are generally reference data.

## Public

Public read access may be allowed if building information is not sensitive and is needed for public display.

If public access is not required, require authentication.

## Authenticated users

May read active buildings needed for normal workflows.

## Admin

May:

- Create
- Update
- Deactivate
- Manage

## Student/Staff/Technician

Should not modify buildings.

---

# 10. Rooms Policies

Rooms are reference data.

## Read

Authenticated users may read active rooms needed for asset/request workflows.

Public read may be allowed if the application intentionally displays public room information.

## Write

Only Admin may:

- Create rooms
- Update rooms
- Deactivate rooms

Students, staff and technicians must not modify rooms.

---

# 11. Building → Room Security

The database must ensure that:

```text
usage_room_id
```

belongs to:

```text
usage_building_id
```

and:

```text
registered_room_id
```

belongs to:

```text
registered_building_id
```

Do not rely only on the dependent dropdown.

A malicious client could attempt:

```text
Building = Vivekananda
Room = VY101
```

The backend/database must reject it.

---

# 12. Asset Read Policies

## Public

Public users may read only the intentionally exposed asset information through the public asset interface.

Do not grant public access to arbitrary full asset rows.

## Student/Staff

May read assets necessary for:

- Browsing
- Searching
- Requesting
- Reporting issues

Private/internal fields must remain protected.

## Technician

May read assets necessary for assigned maintenance work.

## Admin

May read all authorized asset data.

---

# 13. Asset Insert Policies

Only Admin may create assets.

Students, staff and technicians cannot create assets.

The creator identity should come from:

```text
auth.uid()
```

not from an arbitrary client-provided `created_by`.

---

# 14. Asset Update Policies

## Admin

May update normal asset fields and manage status according to workflow.

## Technician

Should not freely edit asset master data.

Technicians may update asset state only through permitted maintenance workflow operations if required.

## Student/Staff

Cannot directly update asset master records.

They may create permitted requests/reports.

---

# 15. Asset Delete/Archive Policies

Avoid hard deletion.

Prefer:

```text
status = RETIRED
archived_at = timestamp
```

Only Admin may archive/retire assets.

Normal users must never permanently delete an operational asset.

Historical assignments and maintenance history must remain accessible to authorized users.

---

# 16. Asset Status Security

Do not allow every authenticated user to send:

```text
status = RETIRED
```

or:

```text
status = AVAILABLE
```

through a generic update.

Status changes must be role/workflow controlled.

Examples:

```text
Student:
  Cannot change status directly.

Technician:
  Can participate in maintenance-related state changes.

Admin:
  Can manage operational status.
```

The exact transitions are defined by the asset/maintenance workflow.

---

# 17. Asset Assignment Read Policies

## Student/Staff

May read their own assignments:

```text
asset_assignments.user_id = auth.uid()
```

## Technician

May read assignments required for maintenance operations where appropriate.

## Admin

May read all assignments.

Users must not be able to enumerate all campus assignments unless their role permits it.

---

# 18. Asset Assignment Insert Policies

Students/Staff may create an assignment/request only through the approved request workflow.

The authenticated identity must be used as:

```text
user_id = auth.uid()
```

The browser must not be trusted to assign an asset to another user.

Admin may create/manage assignments directly.

Technicians should not normally create arbitrary assignments unless explicitly required by the workflow.

---

# 19. Active Assignment Protection

The database/application must prevent multiple active assignments for the same asset.

Example invalid state:

```text
Asset P-104

ACTIVE → Student A
ACTIVE → Student B
```

Use an appropriate unique partial index/constraint.

This protects against race conditions and malicious repeated requests.

---

# 20. Assignment Update Policies

## Student/Staff

May be allowed to:

- View their assignment
- Request return where the workflow supports it

They must not change:

- Assigned user
- Asset
- Usage building
- Usage room
- Status to arbitrary values

## Admin

May modify/close/transfer assignments.

## Technician

Only modify assignment information if explicitly required by the maintenance workflow.

---

# 21. Assignment Location Security

The client may send:

```text
usage_building_id
usage_room_id
```

but the server/database must validate:

```text
room.building_id = usage_building_id
```

Never trust a client-generated room/building combination.

---

# 22. Maintenance Request Read Policies

## Reporter

A Student/Staff user may read their own maintenance requests:

```text
reported_by = auth.uid()
```

## Technician

A technician may read requests assigned to them:

```text
assigned_to = auth.uid()
```

They may also read necessary asset information associated with those requests.

## Admin

Admins may read all maintenance requests.

## Public

No access to maintenance requests.

---

# 23. Maintenance Request Insert Policies

Authenticated Student/Staff users may report a problem.

The system must derive:

```text
reported_by = auth.uid()
```

Do not trust:

```text
reported_by
```

from the client.

A user may report an issue against an asset but cannot create a request as another user.

Technicians may create maintenance records only if the workflow explicitly allows technician-created requests.

---

# 24. Maintenance Assignment Policies

Only Admin should assign a maintenance request to a technician.

The selected technician must have:

```text
profiles.role = TECHNICIAN
```

A student cannot assign a request to themselves or another user.

---

# 25. Maintenance Status Policies

Recommended:

### Student/Staff

May create the request.

Should not arbitrarily set:

```text
RESOLVED
```

or:

```text
IN_PROGRESS
```

### Technician

May update assigned requests through:

```text
ASSIGNED
→ IN_PROGRESS
→ RESOLVED
```

subject to workflow rules.

### Admin

May manage/override maintenance status where operationally required.

All important status changes should be auditable.

---

# 26. Maintenance History Policies

Maintenance history is historical operational data.

## Read

- Admin: all
- Technician: authorized relevant records
- Student/Staff: only information intentionally exposed to them
- Public: none

## Insert

Only authorized technicians/admin workflow operations.

## Update/Delete

Avoid allowing ordinary users to modify historical maintenance entries.

Prefer append-only behavior.

---

# 27. Asset Documents Policies

Documents are private by default unless intentionally marked public.

## Upload

Allowed for:

- Admin
- Authorized technician
- Other authenticated role only when explicitly required

## Download

Must require authorization.

Examples:

```text
Technician assigned to maintenance
Admin
```

Students should not automatically receive private service reports.

## Delete

Restrict to Admin/authorized workflow.

---

# 28. Storage Security

RLS on database metadata is not enough.

Storage bucket policies must also be configured.

Private buckets:

```text
maintenance-images
maintenance-documents
```

must not have anonymous read access.

Use authenticated/authorized access.

Do not expose service-role storage credentials to the browser.

---

# 29. Notifications Policies

If notifications are implemented:

Users may read their own notifications:

```text
notifications.user_id = auth.uid()
```

Users may mark their own notifications as read.

Users may not:

- Read another user's notifications
- Create notifications impersonating the system
- Modify another user's notification state

System/admin workflows create notifications.

---

# 30. Audit Log Policies

Audit logs are sensitive.

## Read

Only Admin should have broad audit-log access.

Technicians may receive limited audit information only if explicitly needed.

Students/Staff should not browse the global audit log.

## Insert

Audit records should be generated by trusted application/server/database workflows.

Do not allow ordinary users to arbitrarily write:

```text
actor_id = someone_else
```

## Update/Delete

No normal application role should update/delete historical audit logs.

---

# 31. Audit Actor Identity

The actor should be derived from the authenticated identity:

```text
auth.uid()
```

not from:

```text
request.body.actor_id
```

Example:

```text
User Shaunak performs action
        ↓
auth.uid()
        ↓
audit_logs.actor_id
```

---

# 32. Service Role Key

The Supabase service-role key bypasses normal RLS behavior.

Therefore:

- Never expose it in client-side code.
- Never prefix it with `NEXT_PUBLIC_`.
- Never commit it to Git.
- Use it only in trusted server-side/Edge Function contexts when genuinely required.
- Prefer normal RLS-protected operations whenever possible.

The application should minimize use of service-role credentials.

---

# 33. Client-Side Security

Client-side checks are useful for UX:

```text
if user.role === ADMIN:
    show Admin button
```

But this is NOT security.

A malicious user can alter browser JavaScript.

Therefore:

```text
UI checks
   +
server-side checks
   +
RLS
```

must work together.

---

# 34. Input Validation

Validate:

- Required fields
- String lengths
- Dates
- Enum values
- UUID/public IDs
- Building/room relationship
- Asset existence
- Assignment eligibility
- Maintenance status transitions
- File MIME types
- File sizes

Never trust raw browser input.

---

# 35. File Upload Security

For file uploads:

1. Authenticate user.
2. Check authorization.
3. Validate MIME type.
4. Validate file size.
5. Generate safe storage path.
6. Upload to the correct private bucket.
7. Store metadata only after successful upload.
8. Do not trust the original filename for access control.
9. Do not allow executable file types for image/document workflows.

---

# 36. QR Security

The QR code is not a secret.

Anyone may scan it.

Therefore, public QR pages must only expose safe information.

Do not put:

- Passwords
- API keys
- Auth tokens
- Private URLs
- Private database fields

inside the QR.

Changing the URL manually must not grant permissions.

---

# 37. Public Asset Security

The public route:

```text
/asset/[publicId]
```

must not simply return:

```text
SELECT * FROM assets
```

Instead, explicitly select safe fields or query a controlled public view.

Example safe response:

```text
asset_id
name
category
status
department
registered building
registered room
public image
```

Private information remains protected.

---

# 38. Rate Limiting

Do not introduce a complex external rate-limiting system for the MVP.

Use:

- Supabase/Vercel platform protections where available
- Sensible application validation
- Avoid expensive unbounded operations
- Restrict privileged operations through Auth/RLS

If abuse becomes a demonstrated issue, add a targeted solution later.

---

# 39. XSS Protection

React/Next.js escapes normal rendered text.

Do not use raw HTML rendering unless necessary.

If rich text is introduced later, sanitize it before rendering.

Do not inject user-provided maintenance descriptions into raw HTML.

---

# 40. SQL Injection Protection

Use Supabase/PostgreSQL parameterized APIs and query mechanisms.

Do not construct SQL strings by concatenating raw user input.

For raw SQL migrations/functions, use explicit parameters and validation.

---

# 41. CSRF Considerations

Use standard Next.js/Supabase authentication patterns.

Do not create custom cookie/session mechanisms unnecessarily.

For state-changing server-side operations, use the framework's secure request/session handling and verify the authenticated identity.

Do not trust an arbitrary user ID from a form.

---

# 42. Authorization Matrix

| Resource | Public | Student/Staff | Technician | Admin |
|---|---:|---:|---:|---:|
| Public asset info | Read | Read | Read | Read |
| Full asset data | No | Limited | Limited | Full |
| Create asset | No | No | No | Yes |
| Edit asset | No | No | Limited workflow only | Yes |
| Archive asset | No | No | No | Yes |
| Buildings | Read if public | Read | Read | CRUD |
| Rooms | Read if public | Read | Read | CRUD |
| Own assignments | No | Read | As authorized | Full |
| Create own request | No | Yes | As authorized | Yes |
| All assignments | No | No | Limited | Yes |
| Report maintenance | No | Yes | Yes if allowed | Yes |
| Assigned maintenance | No | No | Yes | Yes |
| All maintenance | No | No | No | Yes |
| Private documents | No | Limited/No | Authorized | Yes |
| Notifications | No | Own | Own | Own/admin |
| Audit logs | No | No | Limited/No | Yes |
| Role changes | No | No | No | Yes |

This matrix is a baseline. More restrictive behavior is acceptable if it does not break required workflows.

---

# 43. Security-Critical Workflow: Request Asset

When a user requests an asset:

```text
1. Verify authenticated session.
2. Determine user from auth.uid().
3. Load asset.
4. Verify asset can be requested.
5. Validate building.
6. Validate room.
7. Verify room belongs to building.
8. Verify no conflicting active assignment.
9. Create assignment.
10. Update asset status if workflow requires it.
11. Create audit event.
```

Do not trust:

```text
user_id
asset owner
status
building-room relationship
```

from the client.

---

# 44. Security-Critical Workflow: Resolve Maintenance

```text
1. Verify authenticated session.
2. Verify user is assigned technician or admin.
3. Load maintenance request.
4. Verify current status permits resolution.
5. Save resolution notes.
6. Save authorized evidence.
7. Set resolved timestamp.
8. Create maintenance history entry.
9. Update asset state if required.
10. Create audit event.
```

---

# 45. Security-Critical Workflow: Role Change

Only Admin:

```text
1. Verify authenticated admin.
2. Verify target profile exists.
3. Validate target role.
4. Change role.
5. Create audit log.
```

Never allow a generic user profile update endpoint to modify roles.

---

# 46. RLS Implementation Guidance

Claude Code must generate actual SQL policies rather than only documenting them.

Policies should use:

```text
auth.uid()
```

and appropriate role checks.

Policies must be tested with different roles.

At minimum test:

```text
Anonymous
Student
Staff
Technician
Admin
```

---

# 47. RLS Testing Scenarios

### Student tries to read another student's request

Expected:

```text
DENIED
```

### Student tries to update asset status

Expected:

```text
DENIED
```

### Student requests available asset

Expected:

```text
ALLOWED
```

### Technician reads assigned maintenance

Expected:

```text
ALLOWED
```

### Technician reads unrelated sensitive maintenance

Expected:

```text
DENIED unless explicitly authorized
```

### Admin reads audit logs

Expected:

```text
ALLOWED
```

### Public reads asset public information

Expected:

```text
ALLOWED
```

### Public reads maintenance notes

Expected:

```text
DENIED
```

---

# 48. Security Anti-Patterns

Claude Code must NOT implement:

### Anti-pattern 1

```text
if (role === "ADMIN") {
   show delete button
}
```

with no backend/RLS protection.

### Anti-pattern 2

Accepting:

```text
user_id
```

from the browser and assuming it is trustworthy.

### Anti-pattern 3

Making all Supabase tables publicly readable.

### Anti-pattern 4

Using service-role credentials in client components.

### Anti-pattern 5

Making maintenance document buckets public.

### Anti-pattern 6

Allowing arbitrary status changes from a generic update endpoint.

### Anti-pattern 7

Returning entire database records on public QR pages.

---

# 49. Security Logging

Do not log:

- Passwords
- Access tokens
- Service-role keys
- Sensitive file URLs
- Private user data unnecessarily

Application errors should contain enough context to debug without leaking secrets.

---

# 50. Security Definition of Done

Security is considered implemented when:

- Auth is required for protected actions.
- Public QR access exposes only safe data.
- RLS is enabled on protected tables.
- Student/Staff users cannot access other users' private records.
- Technicians cannot perform admin operations.
- Only admins can manage roles.
- Only authorized users can manage maintenance.
- Private storage is protected.
- Service-role credentials never reach the browser.
- Building/room relationships are validated server-side.
- Active assignment conflicts are prevented.
- Important state changes are auditable.
- Input/file validation exists.
- Security tests cover all roles.
