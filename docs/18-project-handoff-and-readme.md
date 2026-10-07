# Project Handoff & Developer README
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Final developer handoff document  
> **Audience:** Claude Code, student developers, evaluators, future maintainers  
> **Source of truth:** `docs/00-project-context.md` through `docs/17-claude-code-master-build-instructions.md`

---

# 1. What This Project Is

The system is a cloud-based campus asset management application.

Its core purpose is to allow an institution to:

```text
Register assets
Track assets
Identify assets through QR codes
Track temporary usage
Manage maintenance
Assign technicians
Store maintenance evidence
Maintain historical records
Audit important actions
```

The system is designed around a simple operational flow:

```text
Physical Asset
      ↓
QR Code
      ↓
Digital Asset Record
      ↓
Usage / Assignment
      ↓
Maintenance
      ↓
History + Audit
```

---

# 2. Main Users

The system supports:

```text
ADMIN
TECHNICIAN
STAFF
STUDENT
PUBLIC QR VISITOR
```

Each has different access.

---

# 3. Admin

Admin manages the system.

Typical responsibilities:

```text
Create assets
Edit assets
Manage buildings
Manage rooms
Manage users/roles
Assign technicians
Manage maintenance
View dashboards
View audit logs
Retire assets
```

---

# 4. Technician

Technician handles maintenance work.

Typical responsibilities:

```text
View assigned maintenance
Start work
Add diagnosis
Add repair notes
Upload evidence
Resolve maintenance
```

A technician should not automatically have administrative privileges.

---

# 5. Student/Staff

Normal users can:

```text
Scan QR
View safe asset information
Request/use an asset
Select usage location
Return an assigned asset
Report a problem
View their own assignments
View their own maintenance requests
```

---

# 6. Public QR Visitor

A QR scan may lead to a public-safe asset page.

The public page should not expose private application information.

Possible public information:

```text
Asset name
Asset identifier
Category
Registered location
Safe status
```

Private operations require authentication.

---

# 7. Core Location Concept

The system intentionally separates:

```text
Registered Location
```

from:

```text
Usage Location
```

Example:

```text
Asset:
Projector P-104

Registered location:
Vyas / VY001
```

A user can use it elsewhere:

```text
Usage location:
Vivekananda / VK404
```

The assignment records the temporary usage location.

The registered location remains:

```text
Vyas / VY001
```

unless an Admin explicitly changes the asset's registered location.

---

# 8. Building and Room Hierarchy

The location model is:

```text
Building
   ↓
Room
```

Example:

```text
Vyas
 ├── VY001
 ├── VY101
 └── VY201

Vivekananda
 ├── VK301
 ├── VK404
 └── VK405
```

The frontend uses dependent dropdowns.

```text
Select Building
       ↓
Load rooms belonging to building
       ↓
Select Room
```

Changing the building resets the room.

---

# 9. QR Concept

Each asset receives a stable public identifier.

Example:

```text
AST-PUB-00142
```

The QR resolves to:

```text
https://<production-domain>/asset/AST-PUB-00142
```

The QR does not directly contain the full asset database record.

---

# 10. Why Public IDs Exist

Do not expose internal database IDs unnecessarily.

The application separates:

```text
Internal database ID
```

from:

```text
Public asset ID
```

This also allows QR URLs to remain stable if internal implementation details change.

---

# 11. Asset Lifecycle

A simplified lifecycle:

```text
REGISTERED
     ↓
AVAILABLE
     ↓
ASSIGNED
     ↓
AVAILABLE
```

Maintenance may temporarily change the operational state:

```text
AVAILABLE
   ↓
IN_MAINTENANCE
   ↓
AVAILABLE
```

Other states may include:

```text
DAMAGED
LOST
RETIRED
```

The exact enum values must follow the database specification.

---

# 12. Assignment Lifecycle

Typical:

```text
User requests asset
       ↓
Active assignment created
       ↓
Asset becomes assigned
       ↓
User uses asset
       ↓
Asset returned
       ↓
Assignment marked returned
       ↓
Asset becomes available
```

The assignment contains the usage location.

---

# 13. Maintenance Lifecycle

Typical:

```text
OPEN
 ↓
ASSIGNED
 ↓
IN_PROGRESS
 ↓
RESOLVED
```

The exact valid transitions are defined in the maintenance specification.

---

# 14. Maintenance History

Maintenance history records technical work.

Example:

```text
14 Aug
Technician assigned

14 Aug
Diagnosis:
Power supply failure

14 Aug
Repair:
Power adapter replaced

14 Aug
Testing:
Device powered on successfully

14 Aug
Resolved
```

History is different from audit logging.

---

# 15. Audit Logging

Audit answers:

```text
Who performed an important action?
When?
What entity?
What action?
```

Example:

```text
Admin
ASSET_RETIRED
AST-PUB-00142
14 Aug 2026 15:22
```

Audit logs are append-only and protected.

---

# 16. Storage

Supabase Storage is used for files.

Potential buckets:

```text
asset-images
maintenance-images
maintenance-documents
```

Private maintenance evidence must not become publicly accessible merely because a file URL exists.

---

# 17. Authentication

Authentication is handled by:

```text
Supabase Auth
```

Application identity comes from:

```text
auth.uid()
```

The user's application profile/role is associated with that identity.

---

# 18. Authorization

Authorization uses multiple layers:

```text
Frontend route protection
+
Server-side authorization
+
PostgreSQL RLS
+
Storage policies
+
Database constraints
```

The frontend is not considered a security boundary by itself.

---

# 19. Database

The database is:

```text
Supabase PostgreSQL
```

Core conceptual entities:

```text
Profiles
Buildings
Rooms
Assets
Assignments
Maintenance Requests
Maintenance History
Documents
Audit Logs
```

Relationships are defined by the database schema document.

---

# 20. Backend Architecture

There is no requirement for a traditional standalone backend.

Instead:

```text
Next.js
   ↓
Supabase
```

with:

```text
Next.js Server Actions / Route Handlers
```

for application workflows where appropriate.

PostgreSQL functions/RPC may be used when atomic database operations are required.

---

# 21. Edge Functions

Edge Functions are optional.

Do not create one simply because:

```text
"backend code is needed."
```

They are appropriate for future functionality such as:

```text
External notifications
Webhooks
Scheduled processing
Third-party integrations
```

They are not required for core MVP CRUD/workflows.

---

# 22. Hosting

Preferred:

```text
Vercel
```

for the Next.js application.

Supabase provides:

```text
Auth
PostgreSQL
Storage
```

This keeps the infrastructure simple.

---

# 23. Cost Strategy

The MVP is designed to avoid paid infrastructure.

Preferred services:

```text
Vercel
Supabase
GitHub
```

Use their available free tiers within current limits.

Do not introduce paid services unless the requirements change.

---

# 24. Application Structure

A recommended conceptual structure:

```text
project/
│
├── src/
│   ├── app/
│   ├── components/
│   ├── actions/
│   ├── lib/
│   ├── types/
│   └── ...
│
├── supabase/
│   ├── migrations/
│   └── seed/
│
├── public/
│
├── tests/
│
├── docs/
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

The exact directory structure can adapt to the existing repository.

---

# 25. Domain Organization

Prefer organizing application logic around domains:

```text
assets
assignments
maintenance
users
locations
audit
```

rather than putting all business logic into one enormous file.

---

# 26. Important Shared Components

Potential reusable components:

```text
BuildingRoomSelector
AssetCard
AssetTable
AssetStatusBadge
PriorityBadge
MaintenanceCard
MaintenanceTimeline
FileUploader
QRDisplay
QRScanner
DataTable
ConfirmDialog
EmptyState
ErrorState
LoadingState
```

Reuse components rather than duplicating markup.

---

# 27. Route Organization

Conceptually:

```text
/
├── login
├── dashboard
│
├── asset/
│   └── [publicId]
│
├── assets
├── maintenance
│
└── admin/
    ├── assets
    ├── buildings
    ├── users
    ├── maintenance
    └── audit-logs
```

Actual route structure should follow the frontend architecture document.

---

# 28. Public vs Protected Routes

Public:

```text
/
login
/asset/[publicId]
```

Protected:

```text
/dashboard
/assets
/maintenance
```

Admin:

```text
/admin/*
```

Technician-specific functionality should be role protected.

---

# 29. Data Flow Example — QR

```text
Physical QR
     ↓
Phone Camera
     ↓
Browser
     ↓
/asset/[publicId]
     ↓
Next.js
     ↓
Supabase query
     ↓
Public-safe asset information
```

---

# 30. Data Flow Example — Asset Request

```text
User
 ↓
Asset page
 ↓
Request button
 ↓
Building selector
 ↓
Room selector
 ↓
Submit
 ↓
Server workflow / database operation
 ↓
Validate auth
 ↓
Validate location
 ↓
Validate asset availability
 ↓
Create assignment
 ↓
Update asset state
 ↓
Audit
 ↓
Response
```

---

# 31. Data Flow Example — Maintenance

```text
User
 ↓
Report problem
 ↓
Maintenance request
 ↓
Admin/Technician
 ↓
Assignment
 ↓
Technician starts
 ↓
History/evidence
 ↓
Resolution
 ↓
Asset state update
 ↓
Audit
```

---

# 32. Data Flow Example — Storage

```text
User
 ↓
File selected
 ↓
Client validation
 ↓
Authorized upload
 ↓
Supabase Storage
 ↓
Document metadata
 ↓
Maintenance request
```

Private objects remain protected.

---

# 33. Important Integrity Rules

The application must preserve:

```text
Room belongs to Building
Assignment room belongs to Assignment building
Maintenance request belongs to Asset
Document belongs to valid entity
One active assignment per Asset
Audit actor is authenticated identity
Private files require authorization
```

---

# 34. Important Security Rules

Never trust browser values for:

```text
Role
Actor
Ownership
Reporter identity
Technician identity
```

The server/database must verify them.

---

# 35. Common Developer Mistakes to Avoid

Do not:

```text
Disable RLS
Expose service-role key
Make private storage public
Hardcode admin password
Trust client role
Trust client ownership
Overwrite registered location with usage location
Fetch entire tables
Use array index as asset ID
Create an Edge Function for every query
Create a second backend unnecessarily
```

---

# 36. Recommended Development Sequence

Use the implementation roadmap:

```text
Repository
 ↓
Supabase
 ↓
Database
 ↓
RLS
 ↓
Auth
 ↓
UI shell
 ↓
Locations
 ↓
Assets
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
Testing
 ↓
Deployment
```

---

# 37. Definition of MVP

The MVP is successful if an evaluator can perform this scenario:

```text
Admin creates asset
       ↓
QR generated
       ↓
QR printed/displayed
       ↓
Student scans QR
       ↓
Student selects usage building
       ↓
Student selects usage room
       ↓
Asset is assigned
       ↓
Student reports a problem
       ↓
Admin assigns technician
       ↓
Technician works on asset
       ↓
Technician uploads evidence
       ↓
Technician resolves request
       ↓
History recorded
       ↓
Audit recorded
```

---

# 38. What the MVP Does Not Need

Do not delay the MVP for:

```text
AI
IoT
GPS
Native Android/iOS app
Advanced BI
External ERP
SMS
Complex email automation
Realtime everywhere
Machine learning
Predictive maintenance
```

These can become future extensions.

---

# 39. Presentation Explanation

When explaining the project, use this simplified description:

> "It is a cloud-based asset management system where every physical asset gets a unique QR code. Scanning the QR code opens the asset's digital record. Users can use the asset at different locations by selecting the building and room, while the asset's registered location remains unchanged. The system manages assignments, returns, maintenance requests, technician workflows, evidence, history, and audit logs. Supabase provides authentication, PostgreSQL, storage, and row-level security, while Next.js provides the web application and necessary server-side workflows."

---

# 40. Architecture Explanation for Presentation

Use:

```text
                 USER
                  │
                  ▼
          ┌───────────────┐
          │    Next.js    │
          │ React/TypeScript
          └───────┬───────┘
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
      Auth     Database   Storage
        │      PostgreSQL    │
        │         │          │
        └─────────┼──────────┘
                  ▼
                 RLS
```

Explain:

```text
Next.js = application/interface
Supabase Auth = identity
PostgreSQL = application data
Storage = files
RLS = database security
Server Actions/RPC = secure business workflows
Vercel = hosting
```

---

# 41. Why Supabase?

For this project:

```text
Authentication
Database
Storage
RLS
```

are all available in one platform.

This reduces:

```text
Infrastructure
Code
Deployment complexity
Maintenance
```

and makes the system suitable for a student MVP.

---

# 42. Why Next.js?

Next.js provides:

```text
React UI
Routing
Server-side capabilities
Deployment compatibility
```

It can therefore handle both:

```text
Frontend
```

and selected:

```text
Server-side application logic
```

without requiring a separate Express server.

---

# 43. Why PostgreSQL?

PostgreSQL is useful because the system has relationships:

```text
Building → Room
Asset → Location
Asset → Assignment
Asset → Maintenance
Maintenance → Technician
Maintenance → Documents
```

A relational database is well suited to enforcing these relationships.

---

# 44. Why RLS?

RLS makes authorization part of the database.

Example:

```text
Student
→ own assignments

Technician
→ authorized maintenance

Admin
→ administrative data
```

Even if a user manipulates frontend requests, the database can reject unauthorized access.

---

# 45. Why QR?

QR provides a simple bridge:

```text
Physical world
       ↓
Digital system
```

Instead of asking:

```text
"What is this projector's database ID?"
```

a user scans the physical QR label.

---

# 46. Why Separate Registered and Usage Location?

Because assets move.

Example:

```text
Projector belongs to:
Vyas / VY001

Today it is used in:
Vivekananda / VK404
```

Changing the asset's registered location would incorrectly imply that the projector permanently belongs in VK404.

The assignment records temporary use.

---

# 47. Why Audit Logging?

Asset systems often need accountability.

Example:

```text
Who changed the asset status?
Who assigned it?
Who resolved the maintenance?
Who changed a user's role?
```

Audit logs preserve this history.

---

# 48. Why Maintenance History?

Audit tells:

```text
Who performed an action.
```

Maintenance history tells:

```text
What technical work was done.
```

These solve different problems.

---

# 49. Why Storage?

Maintenance often requires evidence:

```text
Photo of damaged component
Repair image
Invoice
Technical document
```

Storage keeps files separate from relational metadata.

---

# 50. Final Handoff Checklist

Before handing the project to another developer:

```text
[ ] README exists
[ ] Environment setup documented
[ ] Supabase setup documented
[ ] Database migrations included
[ ] RLS policies included
[ ] Storage policies documented
[ ] Test accounts documented safely
[ ] Build command documented
[ ] Test command documented
[ ] Deployment process documented
[ ] Architecture docs included
[ ] No secrets committed
```

---

# 51. Final Developer Principle

The system should remain:

```text
Simple
Secure
Relational
Maintainable
Low-cost
Incrementally extensible
```

The correct implementation is not the one with the most services.

It is the one that puts each responsibility in the simplest appropriate layer.

---

# 52. One-Sentence Architecture

> **Next.js provides the application, Supabase provides the backend infrastructure, PostgreSQL/RLS protects relational data, Storage protects files, QR connects physical assets to digital records, and server-side workflows enforce important business operations.**

