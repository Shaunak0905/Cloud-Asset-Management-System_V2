# Deployment & Environment Configuration
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready deployment specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` through `docs/14-testing-and-quality-assurance.md`
>
> **Cost constraint:** The MVP should be deployable using free-tier services. Do not add paid infrastructure unless requirements explicitly change.
>
> **Credential rule:** Claude Code must never receive or commit the user's private Supabase/Vercel credentials.

---

# 1. Deployment Goal

The application should be deployable with:

```text
GitHub
   ↓
Vercel
   ↓
Next.js application
   ↓
Supabase
 ├── Auth
 ├── PostgreSQL
 └── Storage
```

Optional future:

```text
Supabase Edge Functions
```

The MVP does not require a separately hosted backend server.

---

# 2. Production Architecture

```text
                         INTERNET
                            │
                            ▼
                    ┌──────────────┐
                    │    Vercel    │
                    │   Next.js    │
                    └──────┬───────┘
                           │
              ┌────────────┼─────────────┐
              ▼            ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Supabase │ │ Supabase │ │ Supabase │
        │   Auth   │ │ Postgres │ │ Storage  │
        └──────────┘ └──────────┘ └──────────┘
```

Security:

```text
Authentication
      +
RLS
      +
Storage policies
      +
Server-side validation
```

---

# 3. Repository

Recommended:

```text
GitHub repository
```

Example:

```text
campus-asset-management/
```

Branches:

```text
main
```

Optionally:

```text
develop
feature/*
```

For a student MVP, a simple:

```text
main
feature/*
```

strategy is sufficient.

---

# 4. Git Requirements

Never commit:

```text
.env
.env.local
.env.production
Supabase service-role keys
API keys
Passwords
Private certificates
```

Add:

```text
.env*
```

to `.gitignore`, while providing a safe example file.

---

# 5. Environment Example

Create:

```text
.env.example
```

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only, only if genuinely required:
SUPABASE_SERVICE_ROLE_KEY=
```

Do not place actual credentials in this file.

---

# 6. Public vs Secret Variables

Public browser-safe variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

These are designed for Supabase's client-side integration.

Server-only:

```text
SUPABASE_SERVICE_ROLE_KEY
```

if the project actually requires it.

Never expose the service-role key.

---

# 7. Supabase URL

The developer will copy the project URL from the Supabase dashboard.

Example format:

```text
https://<project-ref>.supabase.co
```

Do not hardcode a real project URL in source code.

---

# 8. Supabase Client Configuration

The application should have separate concepts for:

```text
Browser Supabase client
Server Supabase client
```

The implementation should follow the current official Supabase/Next.js SSR approach.

Do not invent custom cookie/session handling when the official integration already provides the required mechanism.

---

# 9. Local Development

Recommended workflow:

```text
1. Clone repository.
2. Install dependencies.
3. Copy .env.example → .env.local.
4. Add developer's Supabase credentials.
5. Run database migrations.
6. Start Next.js development server.
```

Typical command:

```bash
npm install
npm run dev
```

The exact package manager may be:

```text
npm
pnpm
yarn
```

Use one consistently.

---

# 10. Local URL

Development:

```text
http://localhost:3000
```

The QR URL generator must use an environment-configurable application origin rather than hardcoding localhost.

---

# 11. Application URL Configuration

Define a concept such as:

```text
NEXT_PUBLIC_APP_URL
```

Development:

```text
http://localhost:3000
```

Production:

```text
https://<production-domain>
```

Use this when generating:

```text
QR URLs
public asset links
share links
```

Do not hardcode production URLs into components.

---

# 12. QR Environment Rule

This is important.

Development QR:

```text
http://localhost:3000/asset/<public-id>
```

Production QR:

```text
https://<production-domain>/asset/<public-id>
```

However:

> Printed production QR codes should always use the production domain.

Do not generate permanent physical QR labels from localhost.

---

# 13. Supabase Setup Responsibility

The developer/user should personally configure:

```text
Supabase project
Auth
Database
Storage
RLS
Environment credentials
```

Claude Code should provide:

```text
SQL migrations
RLS policies
seed scripts
configuration documentation
```

Claude Code should not require access to the user's Supabase password or private account.

---

# 14. Database Deployment

Database changes should be version-controlled.

Recommended:

```text
supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_rls.sql
    ├── 003_storage.sql
    └── ...
```

Exact numbering depends on the final schema.

---

# 15. Migration Principle

Never manually modify production schema without recording the change.

Correct:

```text
Create migration
 ↓
Test locally/preview
 ↓
Apply
 ↓
Commit migration
```

This keeps environments reproducible.

---

# 16. Supabase CLI

If using the Supabase CLI, Claude Code can prepare:

```text
migration files
seed files
configuration
```

The developer performs authenticated linking/deployment.

Do not commit personal Supabase access tokens.

---

# 17. Seed Data

Optional development seed:

```text
Buildings
Rooms
Asset categories
Test assets
Test profiles
```

Production seed must be handled carefully.

Never seed fake users with insecure passwords into production.

---

# 18. Initial Admin Account

The initial Admin should be created through a controlled process.

Recommended:

```text
Create user through Supabase Auth
       ↓
Create/update profile
       ↓
Assign ADMIN role
```

Do not create an application-wide hardcoded admin password.

---

# 19. Authentication Redirects

Configure Supabase Auth redirect URLs for:

```text
Local development
Preview deployment
Production deployment
```

Examples conceptually:

```text
http://localhost:3000/*
https://<preview-domain>/*
https://<production-domain>/*
```

Use the exact redirect URL configuration supported by the final auth flow.

---

# 20. Vercel Deployment

Recommended flow:

```text
GitHub
 ↓
Vercel import repository
 ↓
Configure framework
 ↓
Configure environment variables
 ↓
Deploy
```

Vercel should detect Next.js automatically.

---

# 21. Vercel Environment Variables

Configure:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
```

And only if required:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Scope variables appropriately:

```text
Development
Preview
Production
```

Do not use production credentials in local development unless necessary.

---

# 22. Preview Deployments

Vercel preview deployments are useful for testing pull requests/features.

However, be careful with:

```text
Supabase Auth redirect URLs
Database writes
Storage uploads
```

A preview application should not accidentally modify production data.

---

# 23. Recommended Preview Strategy

For a simple student MVP:

```text
Development
    ↓
Preview
    ↓
Production
```

If a separate Supabase staging project is available, use it.

If not, be extremely cautious about destructive preview operations.

---

# 24. Production Domain

The app may initially use:

```text
<project>.vercel.app
```

A custom domain can be added later.

The QR system must use the actual production URL.

If the domain changes after QR labels have been printed, old QR codes should continue to work where possible.

Therefore:

> Prefer a stable production domain before printing a large batch of physical QR labels.

---

# 25. QR URL Stability

The stable identifier is:

```text
public_id
```

not:

```text
database row position
```

and not:

```text
temporary deployment URL
```

Example:

```text
https://assets.example.com/asset/AST-PUB-00142
```

If the frontend deployment changes, the stable production URL should continue resolving.

---

# 26. Build Process

Expected:

```text
npm run build
```

must succeed before production deployment.

The CI/build environment should catch:

```text
TypeScript errors
Import errors
Build errors
```

---

# 27. Type Checking

Before deployment:

```text
TypeScript check
```

must pass.

Do not suppress errors using:

```text
@ts-ignore
```

merely to make deployment succeed.

---

# 28. Linting

If ESLint is configured:

```bash
npm run lint
```

should pass or have only explicitly accepted warnings.

Do not disable lint rules globally just to hide implementation problems.

---

# 29. Test Pipeline

Recommended:

```text
Install
 ↓
Lint
 ↓
Type check
 ↓
Unit/component tests
 ↓
Build
 ↓
Deploy preview
 ↓
E2E/smoke tests
```

For a small MVP, this can be simplified, but the logical order should remain.

---

# 30. Deployment Checklist

Before production:

```text
[ ] Build passes
[ ] TypeScript passes
[ ] Tests pass
[ ] Environment variables configured
[ ] Supabase URL correct
[ ] Supabase anon key correct
[ ] RLS enabled
[ ] Storage policies configured
[ ] Auth redirect URLs configured
[ ] Production app URL configured
[ ] QR generation uses production URL
[ ] Admin account created
[ ] Database migrations applied
[ ] Storage buckets created
```

---

# 31. Production Security Checklist

Before exposing the app publicly:

```text
[ ] No .env committed
[ ] No secrets in Git
[ ] No service-role key in browser
[ ] RLS enabled
[ ] Storage buckets not accidentally public
[ ] Admin routes protected
[ ] Server-side authorization implemented
[ ] Audit logs protected
[ ] Private maintenance files protected
[ ] Error messages do not expose internals
```

---

# 32. Supabase Storage Production Setup

Create required buckets:

```text
asset-images
maintenance-images
maintenance-documents
```

Apply the Storage policies defined by the storage specification.

Verify manually:

```text
Public user → private file → denied
Authorized user → file → allowed
```

---

# 33. Supabase Auth Production Setup

Configure:

```text
Email authentication
```

or the exact authentication mechanism selected for the project.

Set:

```text
Site URL
Redirect URLs
```

according to the deployed application.

Do not leave development-only localhost URLs as the sole production configuration.

---

# 34. Auth Email Consideration

Supabase authentication may have email-delivery limitations depending on the project's plan/configuration.

For the MVP:

- Test the actual login flow early.
- Do not assume unlimited production email delivery.
- If email confirmation is enabled, verify the configured email behavior before presentation/deployment.

Do not add a paid email provider unless required.

---

# 35. Free-Tier Cost Controls

The MVP should minimize:

```text
Database traffic
Storage usage
Function invocations
Realtime subscriptions
Build usage
Large image uploads
```

Practical rules:

```text
10 MB max file
Pagination
No aggressive polling
No unnecessary Realtime
No large dashboard queries
No duplicate file storage
```

---

# 36. Vercel Free-Tier Considerations

The application should be designed to fit within the current Vercel free-tier limits.

Do not design around:

```text
Long-running server processes
Persistent background workers
Unlimited compute
```

Next.js serverless/server-side requests should be short-lived.

Check current provider limits before final deployment because free-tier quotas can change.

---

# 37. Supabase Free-Tier Considerations

The same principle applies.

Check current limits for:

```text
Database size
Storage
Bandwidth
Auth usage
Edge Function usage
Realtime
```

before production use.

Do not hardcode assumptions about provider quotas into application logic.

---

# 38. No Paid Backend Requirement

The MVP does NOT require:

```text
Railway
Render
AWS EC2
DigitalOcean
Firebase paid plan
```

A separate backend server is unnecessary.

Recommended:

```text
Vercel
+
Supabase
```

subject to current free-tier limits.

---

# 39. Deployment Architecture for Presentation

Use this simplified diagram:

```text
                 ┌───────────────┐
                 │     Users     │
                 │ Student/Staff │
                 │ Technician   │
                 │ Admin         │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │    Vercel     │
                 │    Next.js    │
                 │ React/TS      │
                 └───────┬───────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │   Auth   │   │ Postgres │   │ Storage  │
    │ Supabase │   │ Supabase │   │ Supabase │
    └──────────┘   └──────────┘   └──────────┘
                         │
                         ▼
                       RLS
```

Optional:

```text
Server Actions / RPC
```

between Next.js and Supabase for sensitive workflows.

---

# 40. Deployment Responsibility Split

## Developer / Claude Code

Claude Code prepares:

```text
Application source
Components
Pages
Server workflows
SQL migrations
RLS SQL
Storage policy SQL/config
Environment example
Tests
Build configuration
Documentation
```

## Human Developer

You perform:

```text
Create accounts
Create Supabase project
Set credentials
Apply migrations
Configure Storage
Configure Auth
Configure Vercel
Set environment variables
Deploy
Test production
```

This keeps private credentials under your control.

---

# 41. Secret Handling

Never send Claude Code:

```text
Supabase password
Vercel password
Service-role secret
GitHub token
Database password
```

If Claude Code needs configuration, give it:

```text
.env.example
```

with empty values.

---

# 42. Local `.env.local`

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

If service-role functionality is genuinely required:

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

Keep this file local.

---

# 43. Production `.env`

Do not create a production `.env` file and commit it.

Use Vercel's environment-variable interface.

Production:

```text
NEXT_PUBLIC_APP_URL=https://your-production-domain
```

---

# 44. GitHub Secrets

If CI requires secrets:

```text
GitHub Actions Secrets
```

may be used.

Do not put secrets directly in:

```text
.github/workflows/*.yml
```

---

# 45. Rollback Strategy

If a deployment breaks:

```text
Vercel
 ↓
Previous known-good deployment
```

can be restored.

Database migrations are separate.

Do not roll back application code while forgetting that a database migration may already have changed production.

---

# 46. Database Migration Safety

Before applying destructive schema changes:

```text
Backup / verify recovery strategy
```

Avoid migrations that:

```text
drop production data
```

without explicit confirmation.

Prefer additive migrations.

---

# 47. Example Additive Migration

Good:

```text
ADD COLUMN warranty_until
```

Then update application.

Riskier:

```text
DROP COLUMN old_data
```

without verifying no code depends on it.

---

# 48. Deployment Failure Diagnosis

If deployment fails:

### Build failure

Check:

```text
TypeScript
imports
dependencies
Next.js configuration
```

### Runtime failure

Check:

```text
environment variables
Supabase URL/key
server/client boundary
```

### Database failure

Check:

```text
migration
RLS
schema
permissions
```

### Storage failure

Check:

```text
bucket
path
Storage policy
signed URL
```

---

# 49. Production Smoke Test

After deployment:

```text
1. Open production URL.
2. Login.
3. Open dashboard.
4. Scan a test QR.
5. Open asset page.
6. Request/use test asset.
7. Verify location dropdown.
8. Report maintenance.
9. Login as technician.
10. Resolve maintenance.
11. Check audit log as admin.
12. Upload/download test evidence.
13. Logout.
```

Use test assets/accounts.

---

# 50. QR Production Test

Use a real phone camera.

Test:

```text
Printed/displayed QR
 ↓
Phone camera
 ↓
Browser
 ↓
Production URL
 ↓
Correct asset
```

Do not test only by clicking the URL on a desktop.

---

# 51. Production Monitoring

For MVP, use basic provider/application logs.

Monitor:

```text
Build failures
Runtime errors
Database errors
Storage errors
Authentication failures
```

A paid observability platform is not required.

---

# 52. Logging

Application logs must not contain:

```text
Passwords
Access tokens
Service-role keys
Signed URLs
Sensitive user information
```

Log useful technical information without exposing secrets.

---

# 53. Maintenance of Deployment

Future changes should follow:

```text
Feature branch
 ↓
Local testing
 ↓
Commit
 ↓
Preview deployment
 ↓
QA
 ↓
Merge main
 ↓
Production deployment
```

---

# 54. Versioning

Tag stable releases when useful:

```text
v0.1.0
v0.2.0
v1.0.0
```

This helps correlate:

```text
Application version
Database migration
Deployment
```

---

# 55. Production Configuration Checklist

```text
Application
[ ] Next.js build succeeds
[ ] Production URL configured
[ ] Environment variables configured

Supabase
[ ] Auth configured
[ ] Database migrations applied
[ ] RLS enabled
[ ] Storage buckets created
[ ] Storage policies configured

Security
[ ] No secrets in Git
[ ] No service-role key client-side
[ ] Admin protected
[ ] Audit protected
[ ] Private files protected

QR
[ ] Production URL used
[ ] Public IDs stable
[ ] Test QR scanned from phone

Testing
[ ] Critical E2E passed
[ ] Smoke test passed
[ ] Mobile test passed
```

---

# 56. Definition of Done

Deployment is complete when:

- Repository builds successfully.
- Application runs locally.
- Supabase connection works.
- Auth works.
- Database migrations are reproducible.
- RLS policies are active.
- Storage policies are active.
- Vercel deployment works.
- Production environment variables are configured.
- Production Auth redirects work.
- Production QR URLs work.
- Critical E2E workflow passes.
- No credentials are committed.
- No paid dedicated backend is required.
- Free-tier usage is intentionally controlled.
- Rollback/deployment procedures are documented.
