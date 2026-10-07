# Implementation Roadmap
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Master implementation plan for Claude Code  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` through `docs/15-deployment-and-environment.md`
>
> **Critical instruction:** Build the application incrementally. Do not attempt to generate the entire project in one pass. After every phase, run the relevant checks and fix errors before continuing.

---

# 1. Implementation Goal

Build the application in controlled phases:

```text
Project Setup
    ↓
Database Foundation
    ↓
Authentication
    ↓
Core UI
    ↓
Asset Management
    ↓
QR
    ↓
Assignments
    ↓
Maintenance
    ↓
Storage
    ↓
Audit
    ↓
Dashboards
    ↓
Security/Testing
    ↓
Deployment
```

Each phase should leave the application in a runnable state.

---

# 2. Master Rule for Claude Code

Before writing code:

1. Read all project documents.
2. Inspect the existing repository.
3. Identify what already exists.
4. Do not overwrite working code unnecessarily.
5. Follow the existing architecture if it is compatible.
6. Ask only when a genuinely blocking ambiguity exists.
7. Make changes in small logical commits/steps.
8. Run tests/build/type checks after meaningful changes.
9. Report failures honestly.

---

# 3. Existing Project Inspection

First inspect:

```text
package.json
src/
app/
components/
lib/
supabase/
public/
README
.env.example
```

Determine:

```text
Framework
Package manager
Existing Supabase integration
Existing routes
Existing components
Existing styling
Existing tests
```

Do not recreate the application from scratch if a valid foundation already exists.

---

# 4. Phase 0 — Repository Preparation

Tasks:

```text
1. Inspect repository.
2. Confirm Next.js/React setup.
3. Confirm TypeScript.
4. Confirm Tailwind or existing styling system.
5. Configure ESLint.
6. Configure formatting if appropriate.
7. Create .env.example.
8. Update .gitignore.
9. Create docs/ reference structure.
10. Confirm npm/pnpm/yarn commands.
```

Expected result:

```text
Application starts locally.
```

---

# 5. Phase 0 Acceptance

Run:

```bash
npm install
npm run dev
```

Verify:

```text
Homepage opens
No blocking console errors
TypeScript works
Build can run
```

Do not proceed if the basic application cannot start.

---

# 6. Phase 1 — Supabase Integration Foundation

Claude Code prepares integration code.

Human developer supplies actual credentials.

Tasks:

```text
1. Create browser Supabase client.
2. Create server Supabase client.
3. Configure auth/session handling.
4. Add environment validation.
5. Add database type generation strategy.
6. Add basic connection test.
```

Do NOT require Claude Code to know the developer's secrets.

---

# 7. Phase 1 Acceptance

Verify:

```text
Supabase URL loads.
Authenticated session can be detected.
Database query can execute.
Unauthenticated state is handled.
```

If Supabase is not configured yet:

```text
Application should fail gracefully with a useful setup message.
```

---

# 8. Phase 2 — Database Schema

Use the database schema document as the source of truth.

Create migrations for:

```text
profiles
buildings
rooms
assets
assignments
maintenance_requests
maintenance_history
asset_documents
audit_logs
```

Add:

```text
enums/check constraints
foreign keys
indexes
timestamps
```

according to the schema specification.

---

# 9. Phase 2 — Location Model

Implement:

```text
Building
Room
```

Relationship:

```text
Building
   ↓
Rooms
```

Example:

```text
Vyas
 ├── VY001
 ├── VY101
 └── ...

Vivekananda
 ├── VK301
 ├── VK404
 └── ...
```

A room must belong to exactly one building.

---

# 10. Phase 2 — Asset Model

Implement asset fields according to the database schema.

At minimum conceptually:

```text
id
public_id
name
category
serial_number
department
registered_building_id
registered_room_id
status
created_at
updated_at
```

Do not use the assignment location as the registered location.

---

# 11. Phase 2 — Assignment Model

Assignment must distinguish:

```text
Asset registered location
```

from:

```text
Asset usage location
```

Conceptually:

```text
assignment
 ├── asset_id
 ├── user_id
 ├── usage_building_id
 ├── usage_room_id
 ├── expected_return
 └── status
```

This is one of the core product requirements.

---

# 12. Phase 2 — Database Constraints

Implement constraints for:

```text
Room belongs to building
Assignment room belongs to assignment building
Maintenance request references valid asset
Documents reference valid entities
```

Most importantly:

```text
Only one active assignment per asset
```

Use a database-level constraint/index where appropriate.

---

# 13. Phase 3 — RLS

Enable RLS on all private tables.

Create policies based on the role/ownership matrix.

At minimum verify:

```text
Admin
Technician
Staff
Student
Unauthenticated
```

Do not postpone RLS until after the application is finished.

---

# 14. Phase 3 — RLS Acceptance

Test:

```text
Student cannot create asset.
Student cannot modify another user's data.
Technician cannot modify arbitrary maintenance.
Admin can manage authorized records.
Public can only access intended QR data.
```

If RLS is not correct:

```text
STOP.
Fix RLS before continuing.
```

---

# 15. Phase 4 — Authentication

Implement:

```text
Login
Logout
Session persistence
Protected routes
Role-aware access
```

Recommended route behavior:

```text
Public
→ QR page

Authenticated
→ Dashboard

Admin
→ Admin dashboard

Technician
→ Technician dashboard

Student/Staff
→ User dashboard
```

---

# 16. Phase 4 — Profile/Role Handling

After authentication:

```text
auth.uid()
 ↓
profiles
 ↓
role
```

Do not store the role only in browser state.

The database remains authoritative.

---

# 17. Phase 5 — Application Shell

Build:

```text
Global layout
Navigation
Sidebar
Mobile navigation
Header
User menu
Logout
```

Create reusable UI primitives:

```text
Button
Input
Select
Dialog
Badge
Card
Table
Toast
Loading
```

Reuse existing design-system components if already present.

---

# 18. Phase 5 Acceptance

Verify:

```text
Admin sees admin navigation.
Technician sees technician navigation.
Student/Staff sees user navigation.
Unauthorized routes are blocked.
Mobile navigation works.
```

---

# 19. Phase 6 — Building/Room Management

Admin page:

```text
/admin/buildings
```

Implement:

```text
List buildings
List rooms
Create building
Create room
Edit building
Edit room
Deactivate if supported
```

Keep the model simple.

---

# 20. Phase 6 — BuildingRoomSelector

Create reusable:

```text
BuildingRoomSelector
```

Behavior:

```text
Building selected
 ↓
Room options filtered
```

Example:

```text
Vyas
→ VY001
→ VY101

Vivekananda
→ VK301
→ VK404
```

When building changes:

```text
Room selection resets.
```

---

# 21. Phase 7 — Asset CRUD

Implement:

```text
Asset list
Asset search
Asset filters
Asset detail
Create asset
Edit asset
Asset status
```

Admin-only creation/editing.

Use pagination.

---

# 22. Phase 7 — Asset Form

Fields:

```text
Name
Category
Serial Number
Department
Registered Building
Registered Room
Purchase Date
Warranty Until
Description
Image
```

Validate:

```text
Required fields
Valid building/room
Valid dates
Valid file
```

---

# 23. Phase 7 — Asset Acceptance

Admin can:

```text
Create asset
View asset
Edit asset
Search asset
Filter asset
```

Asset receives:

```text
stable internal ID
stable public ID
```

Registered location displays correctly.

---

# 24. Phase 8 — QR System

Implement:

```text
Public ID URL
QR generation
QR display
Download
Print
Public asset page
```

Do not create a QR backend service.

Generate QR from:

```text
NEXT_PUBLIC_APP_URL
+
public_id
```

---

# 25. Phase 8 — QR Acceptance

Test:

```text
Generate QR
 ↓
Scan with phone
 ↓
Correct asset page
```

Regenerate:

```text
Same public ID
Same asset
```

Invalid public ID:

```text
Asset not found
```

---

# 26. Phase 9 — Asset Assignment

Implement:

```text
Request asset
Select building
Select room
Expected return
Notes
```

Workflow:

```text
AVAILABLE
 ↓
Request
 ↓
ACTIVE assignment
 ↓
ASSIGNED asset
```

The usage location is stored in the assignment.

---

# 27. Phase 9 — Location Acceptance

Critical test:

Asset:

```text
Registered:
Vyas / VY001
```

User selects:

```text
Usage:
Vivekananda / VK404
```

Expected:

```text
Asset registered location:
Vyas / VY001

Assignment usage location:
Vivekananda / VK404
```

Never overwrite the registered location.

---

# 28. Phase 9 — Concurrency

Implement database-level protection against:

```text
User A requests asset
User B requests same asset
```

Expected:

```text
One succeeds.
One fails cleanly.
```

This must not depend only on frontend availability checks.

---

# 29. Phase 10 — Return Workflow

Implement:

```text
Return asset
```

Validate:

```text
Authorized user
Active assignment
Correct assignment
```

Then:

```text
Assignment → RETURNED
Asset → AVAILABLE
Audit → ASSET_RETURNED
```

---

# 30. Phase 11 — Maintenance Reporting

Implement:

```text
Report Problem
```

Fields:

```text
Asset
Description
Priority
Optional photo
```

Workflow:

```text
OPEN
```

Reporter:

```text
auth.uid()
```

not browser input.

---

# 31. Phase 11 — Maintenance Acceptance

Test:

```text
Student reports issue
→ request created

Staff reports issue
→ request created

Public reports issue
→ login required
```

Asset relationship must be correct.

---

# 32. Phase 12 — Technician Workflow

Implement:

```text
Technician dashboard
Assigned requests
Start work
Add notes
Upload evidence
Resolve
```

Valid flow:

```text
OPEN
→ ASSIGNED
→ IN_PROGRESS
→ RESOLVED
```

---

# 33. Phase 12 — Technician Authorization

Technician A:

```text
Can modify assigned request.
```

Technician B:

```text
Cannot modify A's request.
```

Admin:

```text
Can manage requests according to policy.
```

---

# 34. Phase 13 — Maintenance Resolution

Implement secure resolution workflow.

Conceptually:

```text
Resolve maintenance
 ↓
Validate technician/admin
 ↓
Validate current status
 ↓
Save resolution notes
 ↓
Create maintenance history
 ↓
Update asset state
 ↓
Create audit event
```

Where atomicity is important, use:

```text
PostgreSQL RPC/function
```

or an equivalent secure server workflow.

---

# 35. Phase 14 — Storage

Create/configure:

```text
asset-images
maintenance-images
maintenance-documents
```

Implement:

```text
FileUploader
FilePreview
Signed URL access
Metadata creation
```

Validate:

```text
MIME type
Size
Authorization
```

---

# 36. Phase 14 — Storage Acceptance

Test:

```text
Authorized upload → success
Unauthorized upload → denied
Invalid type → rejected
Oversized file → rejected
Private file → inaccessible publicly
```

---

# 37. Phase 15 — Maintenance History

Implement timeline:

```text
Reported
Assigned
Started
Diagnosis
Repair
Testing
Resolved
```

History should come from actual database records.

Do not hardcode fake timeline entries.

---

# 38. Phase 16 — Audit Logging

Implement:

```text
recordAuditEvent()
```

Important events:

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
MAINTENANCE_CANCELLED

ROLE_CHANGED
```

Actor comes from:

```text
auth.uid()
```

---

# 39. Phase 16 — Audit Acceptance

Verify:

```text
Important operation
→ audit event
```

Verify unauthorized users cannot:

```text
Insert fake audit
Update audit
Delete audit
```

Admin can:

```text
View
Filter
Paginate
```

---

# 40. Phase 17 — Dashboards

Build in this order:

```text
Admin dashboard
Technician dashboard
User dashboard
```

Start with:

```text
Numbers
Lists
Links
```

Add charts later.

---

# 41. Admin Dashboard

Implement:

```text
Total assets
Available
Assigned
Maintenance
Damaged
Lost
Retired
```

Maintenance:

```text
Open
Critical
In Progress
Resolved this month
```

Recent activity:

```text
Recent maintenance
Recent audit events
```

---

# 42. Technician Dashboard

Implement:

```text
Assigned
In Progress
High/Critical
Resolved
```

Main content:

```text
Priority queue
```

Only assigned/authorized requests.

---

# 43. User Dashboard

Implement:

```text
Active assets
Open reports
Overdue returns
```

Sections:

```text
My assignments
My maintenance requests
```

---

# 44. Phase 18 — Search & Filters

Implement database-backed filtering.

Assets:

```text
Search
Status
Category
Building
Department
```

Maintenance:

```text
Search
Status
Priority
Technician
Date
```

Use URL query parameters where practical.

---

# 45. Phase 19 — UX States

Every async feature needs:

```text
Loading
Success
Empty
Error
```

Forms need:

```text
Validation
Disabled submit
Error messages
Success feedback
```

---

# 46. Phase 20 — Responsive Design

Prioritize:

### Mobile

```text
QR
Asset details
Request
Maintenance report
```

### Desktop

```text
Admin
Technician
Tables
Audit
Dashboards
```

Test actual mobile width.

---

# 47. Phase 21 — Security Hardening

Review:

```text
RLS
Storage policies
Route protection
Server authorization
Input validation
Secrets
Audit integrity
```

Attempt unauthorized operations manually.

---

# 48. Phase 22 — Testing

Run:

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
Create asset
→ QR
→ Scan
→ Request
→ Location
→ Maintenance
→ Technician
→ Resolve
→ Audit
```

---

# 49. Phase 23 — Performance

Check:

```text
Dashboard query size
Asset pagination
Maintenance pagination
Audit pagination
Image sizes
Client bundle
```

Remove:

```text
unnecessary queries
duplicate requests
aggressive polling
```

---

# 50. Phase 24 — Deployment

Configure:

```text
GitHub
Vercel
Supabase
Environment variables
Auth redirects
Storage
RLS
```

Deploy:

```text
Preview
 ↓
Test
 ↓
Production
```

---

# 51. Phase 25 — Production Smoke Test

Use a test asset/account.

Run:

```text
Login
 ↓
Dashboard
 ↓
QR
 ↓
Request
 ↓
Maintenance
 ↓
Technician
 ↓
Resolution
 ↓
Audit
```

Verify phone QR scanning.

---

# 52. Claude Code Working Method

For each phase:

```text
READ
 ↓
PLAN
 ↓
IMPLEMENT
 ↓
RUN TESTS
 ↓
FIX
 ↓
VERIFY
 ↓
SUMMARIZE
```

Do not continue while a blocking build/type/security error remains.

---

# 53. Claude Code Response Format

After each implementation phase, report:

```text
## Implemented

- ...
- ...

## Files Changed

- ...
- ...

## Tests Run

- ...
- ...

## Result

PASS / FAIL

## Remaining Issues

- ...
```

Do not claim tests were run if they were not.

---

# 54. Commit Strategy

Prefer logical commits such as:

```text
feat: initialize application
feat: add database schema
feat: add authentication
feat: add asset management
feat: add QR workflow
feat: add assignments
feat: add maintenance workflow
feat: add storage
feat: add audit logging
feat: add dashboards
test: add security coverage
chore: configure deployment
```

Exact commit usage depends on the developer workflow.

---

# 55. Human Supabase Preparation

The developer will manually perform the Supabase setup.

Claude Code should provide:

```text
SQL migrations
RLS SQL
Storage policy SQL
Seed SQL
```

The developer applies them using:

```text
Supabase SQL Editor
```

or:

```text
Supabase CLI
```

according to their chosen workflow.

---

# 56. Human Credential Preparation

The developer provides locally:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

and only adds server-only secrets if truly required.

Claude Code should never request:

```text
Supabase password
Vercel password
GitHub token
```

---

# 57. MVP Scope

The MVP includes:

```text
Authentication
Roles
Buildings
Rooms
Assets
Registered location
QR
Asset requests
Usage location
Maintenance
Technicians
Storage
Audit
Dashboards
RLS
Deployment
```

---

# 58. Explicitly Out of MVP

Unless separately requested:

```text
Paid notifications
SMS
Advanced AI
Computer vision
IoT sensors
Offline-first mode
Mobile native app
Complex ERP integration
Advanced analytics warehouse
Complex workflow engine
Automatic physical asset tracking
GPS asset tracking
```

---

# 59. Recommended Build Priority

If time becomes limited:

```text
P0
Auth
Database
RLS
Assets
QR
Assignments
Maintenance

P1
Storage
Audit
Dashboards

P2
Advanced charts
Realtime
Notifications
Exports
```

Never sacrifice:

```text
Security
Data integrity
Authentication
RLS
```

to add visual features.

---

# 60. Final System Build Order

The complete sequence is:

```text
01. Repository
       ↓
02. Supabase connection
       ↓
03. Database schema
       ↓
04. RLS
       ↓
05. Authentication
       ↓
06. UI shell
       ↓
07. Buildings/Rooms
       ↓
08. Assets
       ↓
09. QR
       ↓
10. Asset Requests
       ↓
11. Returns
       ↓
12. Maintenance
       ↓
13. Technician Workflow
       ↓
14. Storage
       ↓
15. Maintenance History
       ↓
16. Audit
       ↓
17. Dashboards
       ↓
18. Search/Filters
       ↓
19. Security Hardening
       ↓
20. Testing
       ↓
21. Deployment
       ↓
22. Production Smoke Test
```

---

# 61. Final Architecture

The finished application should look conceptually like:

```text
                           USERS
                             │
             ┌───────────────┼────────────────┐
             │               │                │
          Student         Technician        Admin
             │               │                │
             └───────────────┼────────────────┘
                             ▼
                      ┌──────────────┐
                      │   Next.js    │
                      │ React/TS/UI  │
                      └──────┬───────┘
                             │
                  ┌──────────┼──────────┐
                  │          │          │
                  ▼          ▼          ▼
              Supabase    Supabase   Supabase
                Auth      Postgres   Storage
                             │
                             ▼
                            RLS
                             │
                             ▼
                  Secure application data

Optional:
Next.js Server Actions / RPC
        ↓
Atomic business workflows

Future:
Supabase Edge Functions
        ↓
Notifications / integrations / scheduled jobs
```

---

# 62. Final Definition of Done

The project is ready for MVP demonstration when:

```text
[ ] User can log in
[ ] Roles work
[ ] Admin can create asset
[ ] Building/room hierarchy works
[ ] Asset has registered location
[ ] QR works
[ ] User can scan QR
[ ] User can choose temporary usage location
[ ] Usage location does not overwrite registered location
[ ] Asset request works
[ ] Return works
[ ] Problem report works
[ ] Technician workflow works
[ ] Maintenance resolution works
[ ] Evidence upload works
[ ] Maintenance history works
[ ] Audit works
[ ] Dashboards work
[ ] RLS/security tests pass
[ ] Critical E2E test passes
[ ] Application deploys
[ ] Production QR works
```

---

# 63. Final Instruction to Claude Code

> Build this system incrementally according to this roadmap and the preceding project documents.
>
> Do not invent a different architecture without identifying the conflict.
>
> Do not add paid infrastructure.
>
> Do not create a traditional standalone backend unless explicitly required.
>
> Do not disable RLS to make functionality work.
>
> Do not expose secrets.
>
> Do not skip tests.
>
> Do not overwrite existing working code unnecessarily.
>
> When a phase is complete, verify it before moving to the next phase.
