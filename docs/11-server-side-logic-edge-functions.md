# Server-Side Logic & Edge Functions
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready server-side specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` through `docs/10-frontend-architecture.md`
>
> **Important cost constraint:** The MVP should work without paid subscriptions. Do not introduce server infrastructure or Edge Functions merely because the architecture diagram can contain them. Use direct Supabase/RLS and Next.js server-side capabilities wherever sufficient.

---

# 1. Core Principle

There does NOT need to be a traditional always-running backend server for the MVP.

The architecture can be:

```text
Next.js Frontend
      ↓
Supabase Auth
      ↓
Supabase PostgreSQL + RLS
      ↓
Supabase Storage
```

with optional server-side logic:

```text
Next.js Server Actions / Route Handlers
```

and optional:

```text
Supabase Edge Functions
```

Only use an Edge Function when it provides a real benefit.

---

# 2. Why Server-Side Logic Exists

Some operations require more than a simple database read.

Examples:

```text
Request asset
Resolve maintenance
Assign technician
Generate sensitive signed URL
Send notification
Run scheduled reminder
```

These operations may require:

- Multiple database writes
- Transaction-like workflow
- Authorization
- Validation
- Audit logging
- External API calls

---

# 3. MVP Server-Side Strategy

Prefer this order:

```text
1. Supabase RLS + normal query
        ↓
2. Next.js Server Action / Route Handler
        ↓
3. Supabase database function/RPC
        ↓
4. Edge Function
```

Do not jump directly to Edge Functions.

---

# 4. Direct Supabase Queries

Use direct Supabase operations for simple operations.

Examples:

```text
Read buildings
Read rooms
Read public asset information
Read user's own assignments
Read authorized maintenance requests
```

These are primarily data-access operations.

RLS protects them.

---

# 5. Next.js Server Actions / Route Handlers

Use Next.js server-side code when:

- Client input needs stronger validation
- Multiple related operations occur
- Sensitive business logic should not live in the browser
- A server-only secret is required
- A workflow needs controlled execution

Examples:

```text
createAssignment()
resolveMaintenance()
retireAsset()
changeUserRole()
```

The exact implementation can use Server Actions or Route Handlers depending on the final Next.js structure.

---

# 6. Important Rule

Do not assume:

```text
Server-side = automatically secure
```

Server-side code must still:

- Verify authentication
- Verify active profile
- Verify role
- Validate input
- Respect RLS
- Avoid exposing secrets

---

# 7. Supabase RLS Remains the Final Boundary

Even if an operation is initiated through:

```text
Next.js Server Action
```

database permissions still matter.

The system should not use server-side code as an excuse to disable RLS.

Do not create:

```text
service role → unrestricted CRUD
```

for normal application operations.

---

# 8. When a Database Function/RPC Is Better

Use a PostgreSQL function/RPC when a workflow is strongly database-centric and must be atomic.

Good examples:

```text
request_asset()
return_asset()
resolve_maintenance()
```

A database function can:

```text
validate state
→ update related records
→ insert history
→ insert audit event
```

as one database operation.

This is particularly useful for concurrency-sensitive workflows.

---

# 9. Asset Request

Asset requests are concurrency-sensitive.

Two users could attempt:

```text
User A → Request Asset
User B → Request Asset
```

at nearly the same time.

The system must prevent two active assignments.

Possible architecture:

```text
Frontend
   ↓
Server Action / RPC
   ↓
Validate asset
   ↓
Check availability
   ↓
Create assignment
   ↓
Update asset state
   ↓
Audit
```

Use database constraints to provide final protection.

---

# 10. Active Assignment Constraint

The database should enforce:

```text
One active assignment per asset
```

Do not rely only on:

```text
SELECT → check → INSERT
```

because two requests can race.

Use an appropriate unique partial index/constraint or equivalent database mechanism.

---

# 11. Recommended Asset Request Flow

```text
User clicks Request
       ↓
Frontend validates
       ↓
Server workflow
       ↓
Authenticated user identified
       ↓
Profile checked
       ↓
Asset checked
       ↓
Building/room relationship checked
       ↓
Asset availability checked
       ↓
Active assignment conflict checked
       ↓
Assignment created
       ↓
Asset status updated
       ↓
Audit event created
       ↓
Success returned
```

---

# 12. Return Asset

Returning an asset is also a controlled workflow.

Conceptual operation:

```text
returnAsset(assignmentId)
```

Must verify:

```text
Authenticated
+
Authorized
+
Assignment exists
+
Assignment is active
```

Then:

```text
assignment.status = RETURNED
assignment.returned_at = now()
asset.status = AVAILABLE
audit event
```

Do not allow arbitrary users to mark any assignment as returned.

---

# 13. Maintenance Resolution

Maintenance resolution is a multi-step workflow.

Conceptual:

```text
resolveMaintenance(requestId, resolutionData)
```

Validate:

```text
Authenticated
Active
Technician/Admin
Authorized for request
Request state is IN_PROGRESS/appropriate
Resolution notes present
```

Then:

```text
maintenance status = RESOLVED
resolved_at = now()
maintenance history inserted
asset state updated
audit event inserted
```

---

# 14. Technician Authorization

A technician should normally only modify requests assigned to them.

Example:

```text
Technician A
    ↓
MR-001
assigned_to = Technician A
```

Technician B should not be able to resolve MR-001.

Admin may override according to the defined permissions.

---

# 15. Role Change

Changing:

```text
STUDENT
→
ADMIN
```

is highly sensitive.

It should never be implemented as a generic client update.

Use:

```text
Admin-only server workflow
```

or a secure database function.

Validate:

```text
Current user = authorized admin
Target user exists
Target role is valid
```

Then:

```text
Update role
Audit event
```

---

# 16. Retiring an Asset

Retirement should be a controlled server operation.

Validate:

```text
Authenticated
+
ADMIN
+
Asset exists
+
Asset is not already retired
```

Then:

```text
asset.status = RETIRED
audit event
```

Do not delete the asset.

---

# 17. Signed URLs

Generating signed URLs for private files can be done server-side.

Conceptual:

```text
getMaintenanceFileUrl(documentId)
```

Workflow:

```text
Authenticated user
      ↓
Check permission for document
      ↓
Read storage path
      ↓
Generate short-lived signed URL
      ↓
Return URL
```

Never return storage access credentials.

---

# 18. QR Generation Does Not Need an Edge Function

Do NOT create an Edge Function just for QR generation.

The QR can be generated:

```text
Client-side
```

from:

```text
public asset URL
```

This is cheaper and simpler.

---

# 19. Building/Room Lookup Does Not Need an Edge Function

Do not create a function for:

```text
getRooms(buildingId)
```

A normal Supabase query is sufficient.

Example:

```text
SELECT rooms
WHERE building_id = selectedBuilding
AND is_active = true
```

RLS controls access.

---

# 20. Asset Search Does Not Need an Edge Function

Search/filter:

```text
assets?search=projector&status=AVAILABLE
```

should use normal database queries.

Do not proxy every search through an Edge Function.

---

# 21. Dashboard Metrics Do Not Need an Edge Function

Simple metrics can use:

- Database aggregation
- SQL views/functions
- Server-side queries

Examples:

```text
COUNT assets
COUNT available
COUNT assigned
COUNT maintenance
```

No external function required.

---

# 22. File Upload Does Not Need an Edge Function

Normal Supabase Storage upload is sufficient when:

- User is authenticated
- Storage policy is correct
- File validation exists

Do not proxy files through an Edge Function unless there is a real processing requirement.

---

# 23. Optional Edge Function #1 — Notifications

Potential future function:

```text
send-maintenance-notification
```

Purpose:

```text
Maintenance assigned
      ↓
Function
      ↓
Notification service
```

This may call an external email provider.

For the free MVP:

> Prefer in-app status updates instead of paid email/SMS services.

---

# 24. Optional Edge Function #2 — Scheduled Reminders

Potential future:

```text
maintenance-reminder
```

Examples:

```text
Request open for too long
Warranty expiring
Asset overdue for return
```

This requires scheduled execution.

Do not implement unless the project explicitly needs automated reminders.

---

# 25. Optional Edge Function #3 — External Integrations

Future examples:

```text
Email
SMS
Teams
Slack
Institutional ERP
```

Edge Functions are useful as a secure integration layer.

But these are outside MVP scope.

---

# 26. Free-Tier MVP Architecture

The preferred free-tier architecture is:

```text
                    ┌──────────────────┐
                    │     Browser      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │     Next.js      │
                    │  Vercel Hosting  │
                    └────────┬─────────┘
                             │
                ┌────────────┼─────────────┐
                ▼            ▼             ▼
          ┌──────────┐ ┌──────────┐ ┌──────────┐
          │ Supabase │ │ Supabase │ │ Supabase │
          │   Auth   │ │ Postgres │ │ Storage  │
          └──────────┘ └──────────┘ └──────────┘
```

No dedicated:

```text
EC2
Railway
Render
Express server
Node server
```

is required for the MVP.

---

# 27. Important Clarification About "Backend"

The application still has backend behavior.

It simply does not require a traditional standalone backend server.

Backend responsibilities are distributed across:

```text
Supabase
+
Next.js server-side code
+
Database functions/RLS
```

So the architecture is:

```text
Frontend
+
Backend-as-a-Service
+
Serverless application logic
```

rather than:

```text
React
+
Express backend
+
PostgreSQL
```

---

# 28. Why This Is Acceptable

Supabase provides backend infrastructure:

```text
Authentication
Database
Storage
Row-Level Security
Realtime
Edge Functions
```

Therefore, building a second CRUD backend on top of Supabase would often duplicate functionality.

The goal is not:

> "Have backend code because every project must have backend code."

The goal is:

> "Put each responsibility in the simplest secure layer."

---

# 29. Server Action vs Edge Function

Use a Next.js Server Action when:

```text
Logic is primarily application-specific
+
Called by this Next.js application
+
No external runtime requirement
```

Use an Edge Function when:

```text
Logic should run independently
OR
Webhook/event-driven
OR
Scheduled
OR
External integration
OR
Needs a server-side environment outside the page request
```

---

# 30. Server Action vs Database Function

Use a database function when:

```text
The operation is database-heavy
+
Must be atomic
+
Needs multiple related SQL changes
```

Use a Server Action when:

```text
The operation involves application-level validation
+
UI-driven workflow
+
Server-side orchestration
```

A workflow may use both.

---

# 31. Recommended MVP Workflow Architecture

### Create asset

```text
Admin UI
 ↓
Server action/direct authorized mutation
 ↓
Supabase Postgres
 ↓
Audit
```

### Request asset

```text
User UI
 ↓
Server workflow/RPC
 ↓
Postgres transaction/constraints
 ↓
Assignment
 ↓
Asset state
 ↓
Audit
```

### Report maintenance

```text
User UI
 ↓
Authorized insert
 ↓
Maintenance request
 ↓
Asset state
 ↓
Audit
```

### Resolve maintenance

```text
Technician UI
 ↓
Server workflow/RPC
 ↓
Maintenance update
 ↓
History
 ↓
Asset state
 ↓
Audit
```

---

# 32. Error Handling

Server-side operations should return structured errors.

Conceptually:

```text
{
  success: false,
  code: "ASSET_UNAVAILABLE",
  message: "This asset is no longer available."
}
```

Do not expose:

```text
SQL statements
Database stack traces
Service-role credentials
Internal infrastructure details
```

---

# 33. Validation

Server-side validation is mandatory.

Validate:

```text
UUIDs
Asset IDs
Building IDs
Room IDs
Status values
Priority values
Role values
Dates
Text lengths
File metadata
```

Never assume the browser validation was enough.

---

# 34. Authorization Sequence

For sensitive server operations:

```text
Request received
      ↓
Is user authenticated?
      ↓
Is profile active?
      ↓
What is user's role?
      ↓
Is role allowed?
      ↓
Does target resource exist?
      ↓
Does user have access to target resource?
      ↓
Is requested state transition valid?
      ↓
Perform operation
      ↓
Audit
```

---

# 35. No Service-Role Key in Client

This is non-negotiable.

Never put:

```text
SUPABASE_SERVICE_ROLE_KEY
```

into:

```text
NEXT_PUBLIC_*
```

Never import a service-role client into a client component.

Never send the service-role key to the browser.

---

# 36. Environment Variables

Public:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Server-only, only if genuinely needed:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Server-only secrets must be configured in Vercel/server environment variables.

If the architecture can operate without the service-role key, prefer not to use it.

---

# 37. Avoiding Paid Services

The MVP should avoid dependencies on:

```text
Paid email API
Paid SMS
Paid notification service
Paid image-processing service
Paid backend server
Paid Redis
Paid queue
Paid analytics platform
```

Use:

```text
Vercel free tier
Supabase free tier
Browser APIs
Open-source npm packages
```

subject to the current free-tier limits of each provider.

---

# 38. Free-Tier Design Rules

To keep usage low:

- Paginate database queries.
- Limit file sizes.
- Avoid unnecessary Realtime subscriptions.
- Avoid polling every few seconds.
- Optimize images.
- Avoid storing duplicate files.
- Avoid unnecessary Edge Function invocations.
- Avoid huge database queries.
- Avoid unnecessary serverless requests.
- Keep QR generation client-side.

---

# 39. No Continuous Backend Process

Do not design:

```text
while(true)
```

or a continuously running server for the MVP.

The application is request-driven:

```text
User action
 ↓
Server/database operation
 ↓
Response
```

---

# 40. Scheduled Work

If a future feature needs:

```text
Every morning
Check overdue assets
```

that is a separate scheduled-job requirement.

Do not build it into the normal request/response application.

It can later use:

```text
Supabase scheduled infrastructure
```

or another scheduler if required.

---

# 41. Webhooks

Webhooks are future/integration functionality.

Examples:

```text
Maintenance resolved
 ↓
External system notification
```

Do not build generic webhook infrastructure for MVP.

---

# 42. Edge Function Security

If an Edge Function is eventually created:

It must:

- Validate request
- Authenticate where required
- Authorize operation
- Validate payload
- Avoid leaking secrets
- Use server-side secrets only
- Return safe errors

Do not treat an Edge Function endpoint as automatically private.

---

# 43. Edge Function Example

Future:

```text
supabase/functions/notify-maintenance/
```

Input:

```text
maintenance_request_id
```

Function:

```text
Authenticate trusted caller
 ↓
Fetch request
 ↓
Fetch technician
 ↓
Call notification provider
 ↓
Return result
```

This is an example only and is not required for MVP.

---

# 44. Recommended MVP Server-Side Files

Potential Next.js structure:

```text
src/
├── app/
│   └── ...
├── actions/
│   ├── assets.ts
│   ├── assignments.ts
│   ├── maintenance.ts
│   └── users.ts
│
└── lib/
    ├── supabase/
    ├── auth/
    ├── data/
    └── validation/
```

Alternatively, keep server actions close to their route/domain.

Choose one consistent pattern.

---

# 45. Server Actions Must Not Become a Generic CRUD API

Avoid creating dozens of wrappers such as:

```text
getAssetByIdAction
getAssetNameAction
getAssetStatusAction
getAssetLocationAction
...
```

Group meaningful business operations.

Good:

```text
requestAsset
returnAsset
resolveMaintenance
retireAsset
assignTechnician
```

---

# 46. Database Constraints vs Application Checks

Use both.

Application:

```text
User-friendly validation
```

Database:

```text
Final integrity enforcement
```

Example:

```text
Frontend:
"This asset is unavailable."

Database:
Unique active-assignment constraint
```

The database wins if a race occurs.

---

# 47. Audit Logging

Sensitive server operations should create audit records.

Examples:

```text
ASSET_CREATED
ASSET_RETIRED
ASSET_ASSIGNED
ASSET_RETURNED
MAINTENANCE_ASSIGNED
MAINTENANCE_RESOLVED
ROLE_CHANGED
```

The audit actor comes from:

```text
auth.uid()
```

not from the request body.

---

# 48. Transactional Thinking

Whenever multiple records must remain consistent:

```text
Operation
  ├── Record A
  ├── Record B
  └── Audit
```

consider a database function/RPC so the operation can be atomic.

Example:

```text
Resolve maintenance

Request → RESOLVED
History → INSERT
Asset → AVAILABLE
Audit → INSERT
```

If one part fails, the database should avoid a partially completed state.

---

# 49. MVP Architecture Summary

```text
                         USERS
                           │
                           ▼
                    ┌─────────────┐
                    │   Next.js   │
                    │ React + TS  │
                    └──────┬──────┘
                           │
             ┌─────────────┼──────────────┐
             │             │              │
             ▼             ▼              ▼
        ┌─────────┐   ┌──────────┐   ┌─────────┐
        │  Auth   │   │ Postgres │   │ Storage │
        │Supabase │   │ Supabase │   │Supabase │
        └─────────┘   └────┬─────┘   └─────────┘
                            │
                           RLS
                            │
                            ▼
                    Secure application data
```

Optional:

```text
Next.js Server Actions
        │
        ▼
Supabase RPC / secure operations
```

Future:

```text
Supabase Edge Functions
        ↓
Notifications / Integrations / Scheduled workflows
```

---

# 50. Recommended Technology Stack

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
```

## Authentication

```text
Supabase Auth
```

## Database

```text
Supabase PostgreSQL
```

## Security

```text
PostgreSQL RLS
Supabase Storage Policies
```

## File Storage

```text
Supabase Storage
```

## Server-side application logic

```text
Next.js Server Actions / Route Handlers
```

## Database workflows

```text
PostgreSQL functions/RPC where atomicity is needed
```

## Optional future serverless logic

```text
Supabase Edge Functions
```

## Hosting

```text
Vercel
```

## QR

```text
Client-side QR generation library
```

## Validation

```text
Zod
```

and optionally:

```text
React Hook Form
```

---

# 51. What Claude Code Must NOT Build

Do not build:

```text
Express backend
Custom authentication
Custom password database
Custom JWT system
Separate PostgreSQL server
Dedicated backend VM
Redis
Message queue
Paid notification provider
QR backend service
Image processing server
```

unless the requirements later explicitly change.

---

# 52. What Claude Code Should Build

Claude Code should implement:

```text
Next.js application
        ↓
Supabase integration
        ↓
Auth
        ↓
RLS-compatible data access
        ↓
Server-side workflows
        ↓
Asset management
        ↓
Assignments
        ↓
Maintenance
        ↓
Storage
        ↓
QR
        ↓
Dashboards
```

---

# 53. Human Setup Responsibilities

The human developer will:

- Create Supabase project.
- Configure Supabase Auth.
- Create/configure Storage buckets.
- Apply SQL schema/migrations.
- Apply RLS policies.
- Configure environment variables.
- Create initial admin account.
- Deploy to Vercel.
- Verify free-tier quotas.
- Test production configuration.

Claude Code should provide the necessary SQL/code/configuration but should not assume it can create or configure the developer's external accounts.

---

# 54. Final Architecture Decision

For the MVP:

> **No traditional standalone backend is required.**

Use:

```text
Next.js
+
Supabase Auth
+
Supabase PostgreSQL
+
Supabase Storage
+
RLS
+
Next.js Server Actions where required
```

Use Edge Functions only when a future requirement actually needs them.

This gives the project:

- Lower cost
- Lower infrastructure complexity
- Fewer moving parts
- Strong database security
- Simple deployment
- Good free-tier compatibility
- Clear separation of responsibilities

---

# 55. Definition of Done

Server-side architecture is complete when:

- Simple CRUD uses appropriate Supabase access.
- Sensitive workflows use secure server-side/database logic.
- RLS remains enabled.
- Authentication is verified server-side.
- Roles are verified server-side.
- Asset assignment is concurrency-safe.
- Maintenance resolution is consistent.
- Audit events are generated for sensitive operations.
- Private files use authorized access.
- No service-role key reaches the browser.
- No unnecessary Edge Functions exist.
- The MVP does not require a paid dedicated backend.
- All required environment variables are documented.
- Free-tier resource usage is intentionally minimized.
