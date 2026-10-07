# Cloud-Based Campus Asset QR & Maintenance Management System
## Project Context — Claude Code Source of Truth

> **Document status:** Authoritative project context  
> **Implementation target:** Claude Code  
> **Important:** Claude Code is responsible for implementing the application code. The human developer will perform the initial Supabase project setup and configuration.

---

## 1. Project Overview

Build a cloud-based campus asset QR and maintenance management web application for a college/university.

The system gives every physical institutional asset a unique QR-based digital identity. Assets may include:

- Projectors
- Laptops
- Desktop PCs
- Arduino kits
- Raspberry Pi kits
- Oscilloscopes
- Cameras
- Networking equipment
- Printers
- Laboratory equipment
- Other institutional equipment

The application must support the complete operational lifecycle of an asset:

```text
Physical Asset
      ↓
QR Code
      ↓
Public Asset Page
      ↓
Authentication / User Action
      ↓
Asset Request / Assignment
      ↓
Usage Location
      ↓
Maintenance
      ↓
Maintenance History
      ↓
Audit Trail
```

The system is a 4th-year Cloud Computing PBL project. It must demonstrate practical cloud concepts while remaining simple enough for a student team to implement, deploy, understand and defend.

---

# 2. Core Architectural Principle

Use a **serverless / Backend-as-a-Service architecture**.

The application must NOT depend on a separately managed Express, Node.js, Django, Spring Boot, or similar backend server.

The architecture is:

```text
Users
  │
  ▼
Next.js Application
  │
  ├── Client-side UI
  ├── Server-side Next.js logic where required
  └── Supabase client/API access
          │
          ▼
      Supabase
       ├── PostgreSQL
       ├── Authentication
       ├── Row Level Security
       ├── Storage
       └── Edge Functions
```

Supabase is the managed backend platform.

Custom backend/server-side logic should be implemented only where it provides real value, primarily through:

- Next.js server-side functionality
- Supabase Edge Functions

Do not create a traditional standalone backend server.

---

# 3. Technology Stack

Use the following stack unless an implementation issue makes a change genuinely necessary.

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- React (provided by Next.js)

## Backend / Cloud Platform

- Supabase
- PostgreSQL
- Supabase Auth
- PostgreSQL Row Level Security (RLS)
- Supabase Storage
- Supabase Edge Functions

## Hosting

- Vercel

## Source Control

- Git
- GitHub

## QR

Use a stable, lightweight QR-code generation library compatible with Next.js/TypeScript.

The QR should encode a URL such as:

```text
https://<production-domain>/asset/<public-id>
```

---

# 4. Supabase Responsibility Boundary

### Human developer responsibility

The human developer will prepare the Supabase environment, including:

- Creating the Supabase project
- Obtaining the project URL and required keys
- Configuring authentication settings
- Creating/configuring storage buckets where appropriate
- Running or approving database migrations
- Configuring database/RLS settings where required
- Deploying/configuring Edge Functions where required
- Providing Claude Code with the required environment-variable names/values through local environment configuration

### Claude Code responsibility

Claude Code MUST:

- Generate the application code
- Generate Supabase SQL migrations/schema files
- Generate RLS SQL policies
- Generate Edge Function source code
- Generate database seed data where useful
- Generate Supabase-related application integration code
- Generate environment-variable templates
- Generate setup instructions
- Never hardcode secrets
- Never require the developer to manually write application code just to connect the UI to Supabase

Claude Code should assume that Supabase infrastructure will be prepared by the human developer, but must provide all code/configuration required to use it.

---

# 5. Free-Tier Constraint

The project must be designed to operate on free tiers wherever practical.

Do NOT introduce paid infrastructure unless explicitly approved.

Preferred services:

```text
Vercel Free
Supabase Free
GitHub Free
Open-source npm packages
```

Do not introduce:

- AWS paid infrastructure
- GCP paid infrastructure
- Azure paid infrastructure
- Paid notification providers
- Paid analytics platforms
- Paid authentication providers
- Paid databases
- Paid file storage

The application must not depend on a paid third-party service for its core functionality.

---

# 6. User Roles

There are four roles.

## 6.1 ADMIN

Administrators can:

- Create assets
- Edit assets
- Archive assets
- Generate QR codes
- Download/print QR codes
- Assign assets
- Transfer assets
- Manage asset status
- View and manage maintenance requests
- Assign technicians
- Manage users/roles where authorized
- View analytics
- View audit logs
- Manage campus buildings and rooms
- Manage asset categories if implemented

Admin has the highest application permission level.

---

## 6.2 TECHNICIAN

Technicians can:

- View assigned maintenance requests
- View relevant asset information
- View maintenance history
- Accept/work on assigned requests
- Change maintenance status according to workflow rules
- Add repair notes
- Upload repair evidence
- Add maintenance history records
- Mark repairs as completed

Technicians must not gain unrestricted administrative access.

---

## 6.3 STAFF / STUDENT

Normal authenticated users can:

- Log in
- Scan QR codes
- View permitted asset information
- Request/use an available asset
- Select the intended usage location
- View their own asset requests/assignments
- Report asset problems
- View their own maintenance/problem reports where appropriate
- Return assigned assets where the workflow permits

They cannot manage arbitrary assets, users, RLS policies, or administrative records.

---

## 6.4 PUBLIC USER

A public user does not need an account.

A public user can scan a QR code and see safe public information such as:

- Asset name
- Public asset ID
- General status
- Registered location when appropriate
- Department when appropriate
- Public asset image when appropriate

A public user must never receive:

- Private maintenance notes
- Personal user information
- Internal audit logs
- Private documents
- Private storage URLs
- Sensitive asset information
- Administrative controls

---

# 7. Asset Model

Every asset has a stable identity.

Example:

```text
Asset ID: AST-2026-00142
Name: Epson Projector P-104
Category: Projector
Serial Number: EP-ABC-12345
Department: Computer Science
Registered Building: Vyas
Registered Room: VY001
Status: AVAILABLE
Purchase Date: 2025-01-15
Warranty Until: 2028-01-15
Description: Seminar hall projector
```

The asset's QR code identifies the asset but does not contain sensitive asset data.

---

# 8. Critical Location Design

Do NOT treat the asset's registered location as its only possible location.

An asset has:

### Registered/Home Location

Where the asset normally belongs.

Example:

```text
Vyas → VY001
```

### Current Usage Location

Where the asset is currently being used during an assignment/request.

Example:

```text
Vivekananda → VK404
```

These are separate concepts.

Moving an asset temporarily must NOT overwrite its registered/home location.

Example:

```text
Projector P-104

Registered Location:
Vyas → VY001

Current Assignment:
Student A

Current Usage Location:
Vivekananda → VK404
```

When the asset is returned, its registered location remains:

```text
Vyas → VY001
```

---

# 9. Building and Room Selection

Campus locations must use a hierarchical structure:

```text
Building
   ↓
Room
```

The UI must contain two dependent dropdowns.

Example:

```text
Building:
[Vyas ▼]

Room:
[VY001 ▼]
[VY101 ▼]
[VY201 ▼]
```

If the user changes the building:

```text
Building:
[Vivekananda ▼]
```

the room dropdown must automatically change to only rooms belonging to Vivekananda:

```text
Room:
[VK301 ▼]
[VK404 ▼]
[VK405 ▼]
```

The room dropdown must be disabled until a building is selected.

When the building changes, reset the room selection.

The frontend must not be the only source of validation. The server/database layer must verify that the selected room belongs to the selected building.

Buildings and rooms should be represented as database entities rather than hardcoded permanently in frontend code.

---

# 10. QR Workflow

Every asset receives a unique QR code.

The QR should contain a URL similar to:

```text
https://<app-domain>/asset/<public-id>
```

The QR is an identifier, not an authentication mechanism.

Workflow:

```text
Physical Asset
      ↓
QR Sticker
      ↓
Phone scans QR
      ↓
Public asset route
      ↓
Application retrieves asset
      ↓
Safe public information displayed
      ↓
Authenticated user may perform permitted actions
```

Scanning the QR does NOT automatically change the asset's location or assignment.

The user must explicitly request/use/assign the asset and select a usage location.

---

# 11. Asset Usage / Request Workflow

Example:

```text
User scans QR
      ↓
Asset page
      ↓
User selects "Request / Use Asset"
      ↓
Choose Building
      ↓
Choose Room
      ↓
Submit request
      ↓
Backend validates:
  - user is authenticated
  - asset is available/requestable
  - building exists
  - room exists
  - room belongs to building
      ↓
Create assignment/request
```

The system should record:

- Asset
- User
- Usage building
- Usage room
- Assignment/request time
- Expected return time where applicable
- Return time
- Assignment status

---

# 12. Asset Status Model

Use these primary asset statuses:

```text
AVAILABLE
ASSIGNED
IN_MAINTENANCE
LOST
DAMAGED
RETIRED
```

Implement controlled state transitions.

Typical lifecycle:

```text
AVAILABLE
    ↓
ASSIGNED
    ↓
IN_MAINTENANCE
    ↓
AVAILABLE
```

Additional valid transitions should be explicitly defined in the implementation documentation.

Do not allow arbitrary status changes from every UI.

The server/database logic must enforce important workflow restrictions.

---

# 13. Maintenance Workflow

A user can report a problem from the asset page.

Example:

```text
Projector P-104
Problem:
"Projector display is flickering."
```

Create a maintenance request.

Recommended statuses:

```text
OPEN
ASSIGNED
IN_PROGRESS
RESOLVED
CANCELLED
```

Recommended priorities:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Typical workflow:

```text
User reports issue
      ↓
OPEN
      ↓
Admin assigns technician
      ↓
ASSIGNED
      ↓
Technician starts work
      ↓
IN_PROGRESS
      ↓
Repair completed
      ↓
RESOLVED
```

A resolved request must preserve its history.

Technicians may add:

- Repair notes
- Photos
- Service documents
- Resolution description

---

# 14. Database Entities

The initial relational model should include:

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

The exact schema may be refined during implementation, but do not introduce unnecessary tables.

Important relationships include:

```text
Building
  └── Rooms

Profile
  └── Asset Assignments

Asset
  ├── Registered Building
  ├── Registered Room
  ├── Assignments
  ├── Maintenance Requests
  ├── Maintenance History
  └── Documents

Maintenance Request
  └── Technician/Profile

Audit Log
  └── Actor/Profile
```

---

# 15. Authentication and Authorization

Use Supabase Auth for authentication.

Use database RLS as a core authorization mechanism.

Do NOT rely solely on frontend role checks.

The frontend may hide unavailable controls for UX, but the database/server must still enforce authorization.

Examples:

```text
Public:
  safe asset information only

Student:
  own requests/assignments

Technician:
  assigned maintenance work

Admin:
  full authorized management
```

---

# 16. Storage

Use Supabase Storage for files.

Recommended logical buckets:

```text
asset-images
maintenance-images
maintenance-documents
```

Private maintenance material must not be publicly accessible.

Implement:

- MIME-type validation
- File-size limits
- Permission checks
- Safe file naming
- Secure access to private files

Do not store large binary files directly in PostgreSQL.

---

# 17. Audit Logging

Important operations must create audit records.

Examples:

```text
ASSET_CREATED
ASSET_UPDATED
ASSET_ARCHIVED
ASSET_ASSIGNED
ASSET_TRANSFERRED
MAINTENANCE_CREATED
MAINTENANCE_ASSIGNED
MAINTENANCE_RESOLVED
USER_ROLE_CHANGED
```

Audit records should capture enough information to answer:

- Who performed the action?
- What entity was affected?
- What action occurred?
- When did it occur?
- Relevant old/new values where appropriate?

Audit logs are not editable by normal users.

---

# 18. Serverless Functions

Use Supabase Edge Functions only for meaningful server-side workflows.

Potential functions:

- Maintenance notification workflow
- Warranty reminder workflow
- Scheduled maintenance reminder
- Other privileged/custom operations that should not run directly in the browser

Do NOT create an Edge Function for every CRUD operation.

Do NOT use Edge Functions simply to make the architecture appear more complicated.

---

# 19. Frontend Route Structure

Use a simple route structure.

Suggested routes:

```text
Public:
/
 /login
 /asset/[publicId]

Authenticated:
 /dashboard
 /assets
 /assets/[id]
 /maintenance
 /requests
 /profile

Admin:
 /admin
 /admin/assets
 /admin/assets/new
 /admin/users
 /admin/maintenance
 /admin/buildings
 /admin/audit-logs
 /admin/reports

Technician:
 /technician
 /technician/requests
 /technician/requests/[id]
```

Routes may be simplified if implementation can remain clear without losing functionality.

---

# 20. UX Requirements

The application must be:

- Clean
- Professional
- Responsive
- Mobile-friendly
- Easy to navigate
- Suitable for a college environment

The QR asset page is especially important on mobile.

Include:

- Loading states
- Empty states
- Error states
- Form validation
- Confirmation dialogs for destructive actions
- Toast/success feedback
- Clear permission errors

Avoid unnecessary animation and visual complexity.

---

# 21. Dashboard Requirements

The dashboard should show useful operational metrics:

```text
Total Assets
Available Assets
Assigned Assets
Assets in Maintenance
Lost/Damaged Assets
Retired Assets
Open Maintenance Requests
Recently Added Assets
Recently Resolved Issues
```

Optional analytics:

- Most frequently repaired assets
- Most problematic categories
- Department-wise asset distribution
- Asset utilization
- Maintenance frequency

Do not build a complex analytics platform.

---

# 22. Security Requirements

Implement practical security controls:

- Supabase Auth
- RLS
- Role-based authorization
- HTTPS through deployment platform
- Environment variables
- No secrets in Git
- Private storage buckets
- Signed/authorized file access where required
- Input validation
- File validation
- File size limits
- Safe error handling
- Audit logs

Never expose Supabase service-role credentials to the browser.

Never hardcode secrets.

---

# 23. Coding Principles

Claude Code must follow these principles:

### Keep it simple

Prefer the simplest solution that satisfies the requirement.

### Avoid over-engineering

Do not introduce:

- Kubernetes
- Docker orchestration
- Microservices
- Kafka
- Redis
- Service mesh
- Separate API gateway
- Separate backend server
- AI/ML
- Blockchain

unless explicitly requested later.

### Type safety

Use TypeScript consistently.

Avoid unnecessary `any`.

### Reusable components

Create reusable UI components for repeated patterns.

### Feature-oriented organization

Keep asset, maintenance, QR, authentication and user functionality logically separated.

### Validation

Validate at the UI and server/database boundary where appropriate.

### Error handling

Do not silently swallow errors.

### Security by default

Assume client input is untrusted.

---

# 24. What NOT to Implement

Do NOT implement:

- AI/ML features
- Face recognition
- GPS-based automatic asset location
- Blockchain
- Real-time location tracking
- Complex notification infrastructure
- Paid external APIs
- Payment systems
- Chat systems
- Social features
- Complex IoT integrations
- Microservices
- Kubernetes
- Custom infrastructure servers

The current project is an asset management and maintenance system, not an IoT tracking platform.

---

# 25. Important Location Rule

Do NOT automatically infer usage location from the user's GPS.

The project intentionally uses:

```text
QR identifies asset
+
User selects intended usage location
+
Database records assignment
```

Location selection must use:

```text
Building dropdown
      ↓
Room dropdown filtered by building
```

The asset's registered location remains unchanged when it is temporarily used elsewhere.

---

# 26. Important QR Rule

Scanning a QR code alone must never:

- Assign the asset
- Move the asset
- Change the asset status
- Grant permissions
- Reveal private information

A scan only identifies and displays the asset.

State changes occur only after an authorized action.

---

# 27. Expected Application Flow

The final application should support this end-to-end flow:

```text
ADMIN CREATES ASSET
       ↓
ASSET STORED IN DATABASE
       ↓
QR GENERATED
       ↓
QR ATTACHED TO PHYSICAL ASSET
       ↓
USER SCANS QR
       ↓
PUBLIC ASSET PAGE
       ↓
USER AUTHENTICATES IF ACTION REQUIRED
       ↓
REQUEST / USE ASSET
       ↓
SELECT BUILDING
       ↓
SELECT ROOM
       ↓
CREATE ASSIGNMENT
       ↓
ASSET STATUS = ASSIGNED
       ↓
USER REPORTS PROBLEM IF NECESSARY
       ↓
MAINTENANCE REQUEST
       ↓
TECHNICIAN ASSIGNED
       ↓
IN_PROGRESS
       ↓
RESOLVED
       ↓
MAINTENANCE HISTORY CREATED
       ↓
ASSET RETURNS TO AVAILABLE
```

---

# 28. Environment Variables

Create an `.env.example` file.

Never commit real credentials.

The exact environment variables should follow the Supabase/Next.js integration being implemented.

At minimum, expect public client configuration similar to:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Any privileged server-only credentials must:

- Never use the `NEXT_PUBLIC_` prefix
- Never be sent to client components
- Never be committed to Git

---

# 29. Development Assumptions

Claude Code should be able to develop the application locally after the human developer provides a prepared Supabase project and environment variables.

The application must:

- Run locally
- Build successfully
- Pass lint/type checks
- Connect to Supabase
- Work without paid services
- Be deployable to Vercel
- Use production-safe environment variables

---

# 30. Definition of Done

The application is considered functionally complete when:

- Users can authenticate
- Roles are enforced
- Admins can create/manage assets
- Assets have registered locations
- Buildings and rooms are selectable hierarchically
- QR codes can be generated
- QR codes open public asset pages
- Public pages expose only safe information
- Authenticated users can request/use assets
- Usage locations are recorded separately from registered locations
- Assets can be assigned/transferred
- Users can report problems
- Technicians can process maintenance requests
- Maintenance history is preserved
- Files can be uploaded securely
- Important actions are audited
- RLS protects database records
- Application errors are handled
- The project builds successfully
- The application can be deployed to Vercel

---

# 31. Implementation Philosophy for Claude Code

Claude Code should implement the project incrementally.

Do not generate the entire application as one uncontrolled change.

Follow the implementation roadmap in:

```text
docs/18-implementation-roadmap.md
```

Before implementing a feature:

1. Read this document.
2. Read the relevant feature documentation.
3. Check existing code.
4. Preserve established architecture.
5. Implement the smallest complete solution.
6. Run type/lint/build checks.
7. Verify acceptance criteria.
8. Do not invent architectural decisions that contradict these documents.

If a requirement is genuinely ambiguous, prefer the simplest implementation consistent with this source of truth.

---

# 32. Final Architectural Summary

The final application architecture is:

```text
                         USERS
                           │
                           ▼
                    ┌─────────────┐
                    │   VERCEL    │
                    │             │
                    │   Next.js   │
                    │ TypeScript  │
                    │   Tailwind  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  SUPABASE   │
                    │             │
             ┌──────┼──────┬──────┤
             │      │      │      │
             ▼      ▼      ▼      ▼
          Postgres Auth  Storage  RLS
             │
             ▼
       Edge Functions
```

The core concept is:

> **QR connects the physical campus asset to its cloud-based digital identity. Supabase provides the managed backend infrastructure, while Next.js provides the application and user experience.**

The architecture must remain simple, secure, free-tier friendly, and understandable to a 4th-year student team.
