# Claude Code Master Build Instructions
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Purpose:** This document is the operational instruction sheet for Claude Code.
>
> Read this **after reading the numbered project documents**. The numbered documents remain the detailed source of truth; this document explains how Claude Code should behave while implementing them.

---

# 1. Mission

Build the Cloud-Based Campus Asset QR & Maintenance Management System described in the project documentation.

The system must provide:

- Authentication
- Role-based access
- Building/room management
- Asset management
- Stable QR identification
- Asset usage/assignment
- Temporary usage locations
- Maintenance reporting
- Technician workflows
- Evidence/file storage
- Maintenance history
- Audit logging
- Role-specific dashboards
- Secure database access
- Responsive UI
- Production deployment

---

# 2. Read Before Coding

Before changing code, read:

```text
00-project-context.md
01-system-requirements.md
02-architecture.md
03-database-schema.md
04-authentication-and-roles.md
05-asset-management.md
06-qr-and-location-workflow.md
07-maintenance-management.md
08-storage-and-files.md
09-api-and-data-access.md
10-frontend-architecture.md
11-server-side-logic-edge-functions.md
12-dashboard-and-analytics.md
13-audit-logging.md
14-testing-and-quality-assurance.md
15-deployment-and-environment.md
16-implementation-roadmap.md
```

If filenames differ in the repository, locate the corresponding documents by content.

---

# 3. Source-of-Truth Rule

The project documents are the primary specification.

When implementing:

```text
Project documentation
        ↓
Existing repository architecture
        ↓
Implementation
```

Do not silently replace documented requirements with generic best practices.

If two documents conflict:

1. Identify the conflict.
2. Determine which document is more specific/recent.
3. Preserve existing compatible implementation where possible.
4. Ask the developer only if the conflict prevents a safe implementation.

Do not invent major requirements.

---

# 4. Technology Direction

Preferred stack:

```text
Next.js
React
TypeScript
Tailwind CSS
Supabase Auth
Supabase PostgreSQL
Supabase Storage
PostgreSQL RLS
Next.js Server Actions / Route Handlers
PostgreSQL functions/RPC where atomicity is needed
Vercel
```

Optional future:

```text
Supabase Edge Functions
```

Do not add unnecessary infrastructure.

---

# 5. Cost Constraint

The MVP must not depend on paid infrastructure.

Do NOT introduce:

```text
Dedicated Express backend
Railway
Render
AWS EC2
Redis
Paid queue
Paid email API
Paid SMS
Paid analytics
External QR service
```

unless explicitly requested later.

The system should primarily use:

```text
Vercel
+
Supabase
```

within their available free-tier capabilities.

Provider limits can change, so do not hardcode assumptions about exact quotas.

---

# 6. No Traditional Backend Requirement

Do not create:

```text
React
   ↓
Express
   ↓
PostgreSQL
```

unless explicitly required.

Use:

```text
Next.js
   ↓
Supabase
```

with server-side Next.js workflows where required.

The application still has backend responsibilities through:

```text
Supabase
+
RLS
+
Server Actions/Route Handlers
+
Database functions
```

---

# 7. Credential Boundary

The developer will personally configure:

```text
Supabase project
Supabase credentials
Vercel project
Environment variables
```

Claude Code must NEVER request:

```text
Supabase password
Vercel password
GitHub password
Private API tokens
```

Do not commit secrets.

---

# 8. Environment Variables

Use:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
```

Only add:

```env
SUPABASE_SERVICE_ROLE_KEY=
```

if there is a demonstrated requirement.

Never expose a service-role key to browser code.

---

# 9. Repository First

Before coding:

```text
Inspect repository
```

Look at:

```text
package.json
src/
app/
components/
lib/
supabase/
public/
tests/
```

Determine:

```text
Existing framework
Existing routes
Existing components
Existing styling
Existing Supabase setup
Existing test setup
```

Do not replace a working application unnecessarily.

---

# 10. Incremental Development

Implement one phase at a time.

Required pattern:

```text
Read
 ↓
Plan
 ↓
Implement
 ↓
Type check
 ↓
Lint
 ↓
Test
 ↓
Build
 ↓
Review
 ↓
Continue
```

Do not make hundreds of unrelated changes in one pass.

---

# 11. Phase Order

Follow:

```text
1. Repository setup
2. Supabase integration
3. Database schema
4. RLS
5. Authentication
6. Application shell
7. Buildings/rooms
8. Assets
9. QR
10. Assignments
11. Returns
12. Maintenance
13. Technician workflow
14. Storage
15. Maintenance history
16. Audit
17. Dashboards
18. Search/filters
19. Security hardening
20. Testing
21. Deployment
22. Production smoke test
```

---

# 12. Database First

Do not build large UI workflows against an undefined schema.

Establish:

```text
Tables
Relationships
Enums/check constraints
Foreign keys
Indexes
RLS
```

before implementing dependent workflows.

---

# 13. Location Model

There are TWO different concepts.

## Registered location

Where the asset normally belongs.

Example:

```text
Projector P-104
Registered:
Vyas / VY001
```

## Usage location

Where the asset is currently being used.

Example:

```text
Current assignment:
Vivekananda / VK404
```

These are NOT the same field.

---

# 14. Building → Room Dependency

The UI must implement:

```text
Building dropdown
        ↓
Room dropdown
```

Example:

```text
Vyas
→ VY001
→ VY101
```

Change building:

```text
Vivekananda
→ VK301
→ VK404
```

When building changes:

```text
Reset room selection.
```

Never allow:

```text
Vyas + VK404
```

---

# 15. Asset Registration

An asset must have a stable identity.

Use:

```text
Internal database ID
```

and:

```text
Stable public ID
```

QR codes should resolve through the public ID.

Do not use:

```text
Array index
Temporary deployment ID
Database row position
```

as asset identity.

---

# 16. QR Principle

QR generation should be client-side.

Conceptually:

```text
APP_URL + public_id
```

Example:

```text
https://example.com/asset/AST-PUB-00142
```

The QR should not contain:

```text
Database password
Private metadata
Service-role key
Internal credentials
```

---

# 17. QR Public Page

The QR page must expose only safe information.

May show:

```text
Asset name
Asset ID/public ID
Category
Registered location
Safe status
```

Do not expose:

```text
Private maintenance notes
Audit logs
Private documents
Other users' assignments
Sensitive personal information
```

---

# 18. Assignment Workflow

The user scans the QR and can initiate usage.

Workflow:

```text
Scan QR
 ↓
Authenticate if required
 ↓
Request/use asset
 ↓
Choose Building
 ↓
Choose Room
 ↓
Submit
```

The selected location is stored on the assignment.

---

# 19. Asset Availability

Do not rely only on UI state.

Before creating an assignment:

```text
Check current asset state
+
Check active assignment
```

The database must also prevent conflicting active assignments.

---

# 20. Concurrency

This is mandatory.

Scenario:

```text
User A → Request
User B → Request
```

for the same asset simultaneously.

Expected:

```text
Exactly one active assignment.
```

Use a database constraint/index or atomic database workflow.

Do not solve this only with:

```text
if (asset.status === AVAILABLE)
```

in React.

---

# 21. Asset Return

Valid workflow:

```text
ACTIVE assignment
 ↓
RETURN
 ↓
RETURNED
```

Then asset becomes appropriately available.

Do not allow arbitrary users to return someone else's asset.

---

# 22. Maintenance Workflow

Primary flow:

```text
OPEN
 ↓
ASSIGNED
 ↓
IN_PROGRESS
 ↓
RESOLVED
```

Implement only documented transitions.

Do not allow arbitrary status changes from the client.

---

# 23. Maintenance Reporter

The reporter identity must come from:

```text
auth.uid()
```

Never trust:

```text
reported_by
```

from browser input.

---

# 24. Technician Authorization

Technicians should only modify requests they are authorized to handle.

Example:

```text
Request assigned to Technician A
```

Technician B must not be able to resolve it.

Admin permissions may override according to the documented role model.

---

# 25. Maintenance Resolution

Resolution may involve:

```text
Status
Resolution notes
History
Asset state
Audit
```

If these records must change together, use:

```text
PostgreSQL RPC/function
```

or an equivalent secure server-side transaction.

---

# 26. File Storage

Use Supabase Storage.

Potential buckets:

```text
asset-images
maintenance-images
maintenance-documents
```

Keep private maintenance evidence private.

Use authorized/signed access where required.

---

# 27. File Validation

Validate server-side:

```text
File type
File size
User authorization
Target entity
```

Do not rely only on the HTML file input's `accept` attribute.

---

# 28. Audit Logging

Important actions must be logged.

Examples:

```text
ASSET_CREATED
ASSET_UPDATED
ASSET_ASSIGNED
ASSET_RETURNED
ASSET_RETIRED

MAINTENANCE_CREATED
MAINTENANCE_ASSIGNED
MAINTENANCE_STARTED
MAINTENANCE_RESOLVED

ROLE_CHANGED
```

Actor:

```text
auth.uid()
```

---

# 29. Audit Security

Audit logs are append-only.

Normal users must not be able to:

```text
Insert arbitrary audit events
Update audit events
Delete audit events
Impersonate another actor
```

Admin can read audit logs according to the documented policy.

---

# 30. RLS

RLS is mandatory.

Do not disable RLS because it makes development easier.

If a feature fails due to RLS:

```text
Understand the policy
 ↓
Fix policy/authorization
 ↓
Retest
```

Do NOT use:

```text
RLS disabled
```

as the solution.

---

# 31. Service Role

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
```

to:

```text
Client Components
Browser JavaScript
NEXT_PUBLIC_*
```

If used, it must remain server-side.

Prefer normal authenticated Supabase access + RLS whenever possible.

---

# 32. Server Actions

Use server-side workflows for meaningful business operations such as:

```text
requestAsset
returnAsset
resolveMaintenance
assignTechnician
retireAsset
changeUserRole
```

Do not create a server action for every trivial read.

---

# 33. Direct Supabase Queries

Use direct queries for simple operations:

```text
Read buildings
Read rooms
Read safe asset information
Read authorized lists
```

Use pagination.

Do not download entire tables unnecessarily.

---

# 34. Edge Functions

Do not create Edge Functions merely to say:

```text
We have a backend.
```

Use them only if there is a genuine need such as:

```text
External notifications
Webhooks
Scheduled processing
Independent integrations
```

These are not required for the core MVP.

---

# 35. Dashboard Data

Use database aggregation.

Do NOT:

```text
SELECT every asset
→ JavaScript count()
```

when SQL can perform:

```text
COUNT
GROUP BY
```

Use selective queries.

---

# 36. Admin Dashboard

Show:

```text
Total assets
Available
Assigned
Maintenance
Damaged
Lost
Retired
```

and:

```text
Open maintenance
Critical
In progress
Resolved
```

plus:

```text
Recent activity
Attention required
```

---

# 37. Technician Dashboard

Show:

```text
Assigned
In Progress
High/Critical
Resolved
```

Primary content:

```text
Priority queue
```

---

# 38. User Dashboard

Show:

```text
Active assets
Open reports
Overdue returns
```

and:

```text
My assignments
My maintenance requests
```

---

# 39. Testing Requirement

Every meaningful phase must be tested.

At minimum:

```text
Unit
Component
Integration
RLS
Storage
E2E
```

Critical E2E:

```text
Admin creates asset
 ↓
QR generated
 ↓
User scans
 ↓
User selects usage location
 ↓
Assignment
 ↓
Maintenance report
 ↓
Technician assignment
 ↓
Resolution
 ↓
Audit
```

---

# 40. Security Testing

Test both:

```text
What the user CAN do
```

and:

```text
What the user CANNOT do
```

Examples:

```text
Student → create asset → DENIED
Student → audit logs → DENIED
Technician → another technician's request → DENIED
Public → private document → DENIED
```

---

# 41. Error Handling

Never show:

```text
SQL error
stack trace
service-role key
internal secrets
```

to users.

Return friendly errors such as:

```text
This asset is no longer available.
```

---

# 42. Loading/Empty/Error States

Every major async UI needs:

```text
Loading
Success
Empty
Error
```

Do not leave users staring at a blank screen.

---

# 43. Mobile Priority

The most important mobile workflow is:

```text
Scan QR
 ↓
Asset page
 ↓
Choose location
 ↓
Request
 ↓
Report problem
```

Test this on a real phone.

---

# 44. Performance

Avoid:

```text
Aggressive polling
Huge queries
Unpaginated tables
Large images
Unnecessary Realtime subscriptions
```

MVP should remain lightweight.

---

# 45. Deployment

Preferred:

```text
GitHub
 ↓
Vercel
 ↓
Next.js
 ↓
Supabase
```

The developer manually configures external services.

---

# 46. Supabase Setup Boundary

Claude Code prepares:

```text
SQL migrations
RLS SQL
Storage policy SQL
Seed scripts
Type definitions
```

The developer personally:

```text
Creates Supabase project
Applies migrations
Creates buckets
Configures Auth
Sets credentials
```

---

# 47. No Credential Sharing

Claude Code must never ask for:

```text
Supabase password
Vercel password
GitHub password
Personal access tokens
```

Use environment variables locally.

---

# 48. Coding Style

Prefer:

```text
Small reusable components
Typed functions
Meaningful names
Domain-based organization
Clear server/client boundaries
```

Avoid:

```text
Huge components
Any everywhere
Duplicated business logic
Hardcoded database IDs
Hardcoded URLs
Magic strings
```

---

# 49. TypeScript

Do not solve type errors with:

```text
any
@ts-ignore
```

unless there is a documented, justified exception.

Use generated/database types where practical.

---

# 50. Data Validation

Use a validation library such as:

```text
Zod
```

for server/client schemas where appropriate.

Validate:

```text
Forms
IDs
Enums
Dates
Files
Workflow inputs
```

---

# 51. UI/UX

The interface should feel:

```text
Modern
Clean
Professional
Simple
Responsive
```

Prioritize usability over decorative animation.

---

# 52. Do Not Overbuild

Do not add:

```text
AI chatbot
IoT
GPS
Complex notifications
Native mobile app
Advanced BI
ERP integration
```

unless explicitly requested.

---

# 53. Handling Ambiguity

If a requirement is unclear but a safe interpretation exists:

```text
Choose the documented/simple interpretation
```

and continue.

If the ambiguity affects:

```text
Database structure
Security
Data ownership
Major architecture
```

stop and ask before implementing.

---

# 54. Handling Errors

When an implementation fails:

```text
Read actual error
 ↓
Identify root cause
 ↓
Fix root cause
 ↓
Run test again
```

Do not:

```text
Disable feature
Remove security
Suppress error
```

just to make the build green.

---

# 55. Do Not Claim Completion Early

Never say:

```text
Everything works
```

unless:

```text
Build passed
Relevant tests passed
Critical workflow verified
```

If something is not tested, say:

```text
Not verified
```

---

# 56. Implementation Output

After each phase provide:

```text
## Phase
<name>

## Implemented
- ...

## Files Changed
- ...

## Database Changes
- ...

## Tests Run
- ...

## Result
PASS / FAIL

## Remaining Issues
- ...
```

---

# 57. Final Verification

Before declaring MVP complete:

```text
Authentication
✓

RLS
✓

Assets
✓

Buildings/Rooms
✓

QR
✓

Assignments
✓

Usage locations
✓

Returns
✓

Maintenance
✓

Technician workflow
✓

Storage
✓

Audit
✓

Dashboards
✓

Testing
✓

Deployment
✓
```

---

# 58. Final Instruction

Build the system as a secure, maintainable MVP.

The most important architecture principles are:

```text
Supabase handles backend infrastructure.
Next.js handles application UI and necessary server workflows.
PostgreSQL/RLS protects data.
Storage protects files.
QR identifies assets.
Assignments store temporary usage locations.
Registered locations remain unchanged unless an administrator changes them.
Audit logs record important actions.
```

Do not introduce unnecessary services.

Do not disable security.

Do not expose secrets.

Do not overbuild.

Implement incrementally and verify every phase.
