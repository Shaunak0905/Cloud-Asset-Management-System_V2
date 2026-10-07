# Authentication
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready authentication specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md`, `docs/01-product-requirements.md`, `docs/02-system-architecture.md`, `docs/03-database-schema.md`, `docs/04-rls-security-policies.md`
>
> **Responsibility boundary:** The human developer will create/configure the Supabase project and Auth settings. Claude Code must implement the application-side authentication integration, session handling, route protection, profile/role integration, validation, UI, and required SQL/functions/migrations.

---

# 1. Authentication Goal

Use **Supabase Auth** as the application's authentication provider.

Authentication must provide:

- Login
- Logout
- Persistent sessions
- Authenticated user identity
- Protected routes
- Role-aware navigation
- Profile retrieval
- Secure interaction with RLS
- Clear authentication errors

Do not build a custom password authentication system.

Do not store passwords in PostgreSQL application tables.

---

# 2. Authentication Architecture

```text
User
  ↓
Next.js Login UI
  ↓
Supabase Auth
  ↓
Authenticated Session
  ↓
Supabase User ID
  ↓
profiles table
  ↓
Application role
  ↓
Authorized UI + RLS
```

The Supabase Auth user ID is the authoritative identity.

The `profiles` row extends that identity with application-specific information.

---

# 3. Auth Identity vs Application Profile

Supabase maintains:

```text
auth.users
```

The application maintains:

```text
profiles
```

Relationship:

```text
auth.users.id
      │
      │ 1:1
      ▼
profiles.id
```

The profile must use the same UUID as the Auth user.

Do not create a separate unrelated user ID.

---

# 4. Profile Fields

The application profile contains:

```text
id
full_name
email
role
department
phone
is_active
created_at
updated_at
```

Authentication credentials remain managed by Supabase Auth.

Do not duplicate:

- Password hashes
- Password reset tokens
- Auth secrets
- Access tokens

inside `profiles`.

---

# 5. Supported Roles

Authenticated users may have:

```text
ADMIN
TECHNICIAN
STAFF
STUDENT
```

Public users are unauthenticated.

Role determines application permissions, but the database RLS policies remain the final authorization boundary.

---

# 6. Login Flow

Recommended flow:

```text
User opens /login
       ↓
Enters email/password
       ↓
Next.js form validation
       ↓
Supabase Auth sign-in
       ↓
Auth success
       ↓
Session established
       ↓
Application retrieves profile
       ↓
Check is_active
       ↓
Determine role
       ↓
Redirect to appropriate dashboard
```

Example redirects:

```text
ADMIN
  → /admin

TECHNICIAN
  → /technician

STUDENT/STAFF
  → /dashboard
```

The exact route may be simplified if the final application uses a shared dashboard.

---

# 7. Login Validation

Before submitting:

- Email must be valid.
- Password must not be empty.

After Supabase Auth responds:

### Success

Create/retain authenticated session.

### Failure

Show a safe user-facing message.

Do not expose raw Supabase/internal errors if they reveal unnecessary implementation information.

Example:

```text
Unable to sign in.
Please check your email and password.
```

---

# 8. Inactive User Handling

A user may exist in Supabase Auth but have:

```text
profiles.is_active = false
```

Inactive users must not be allowed to perform normal application actions.

Workflow:

```text
Auth succeeds
     ↓
Profile loaded
     ↓
is_active?
     ├── YES → Continue
     └── NO  → Block application access
```

Provide a clear message such as:

```text
Your account is currently inactive.
Please contact an administrator.
```

Do not delete the Auth account simply because the application profile is inactive.

---

# 9. Logout Flow

Logout should:

```text
User clicks Logout
      ↓
Supabase signOut()
      ↓
Session removed
      ↓
Protected state cleared
      ↓
Redirect to /login
```

After logout, protected pages must no longer be accessible using the previous session.

---

# 10. Session Persistence

Use the standard Supabase Auth session mechanism.

Do not create a custom token storage system.

The application should preserve the authenticated session across normal page navigation/reloads according to Supabase's supported Next.js integration.

Do not manually store access tokens in:

```text
localStorage
```

unless the official integration explicitly requires a secure mechanism and there is a documented reason.

Prefer the standard Supabase/Next.js SSR/browser-client pattern.

---

# 11. Recommended Supabase Client Architecture

Use separate utilities for:

### Browser client

Used by client components for interactive Auth/data operations.

Example conceptual location:

```text
src/lib/supabase/client.ts
```

### Server client

Used by server components/actions/routes.

Example:

```text
src/lib/supabase/server.ts
```

### Middleware/session handling

If needed:

```text
src/lib/supabase/middleware.ts
middleware.ts
```

Use the current supported Supabase + Next.js integration pattern rather than inventing a custom session architecture.

---

# 12. Environment Variables

The application should use environment variables.

Expected public variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Do not hardcode values.

Do not commit actual credentials.

Provide:

```text
.env.example
```

with names only.

---

# 13. Service Role Key

A service-role key, if required for trusted server-side/Edge Function operations, must:

- Never use `NEXT_PUBLIC_`
- Never be placed in client components
- Never be committed to Git
- Never be exposed through API responses
- Never be included in QR codes
- Never be included in browser bundles

Prefer RLS-protected access using the user's session whenever possible.

---

# 14. Route Categories

Organize routes into three categories.

## Public

```text
/
 /login
 /asset/[publicId]
```

Potentially public informational routes may be added later.

## Authenticated

```text
/dashboard
/assets
/assets/[id]
/maintenance
/requests
/profile
```

## Admin

```text
/admin
/admin/assets
/admin/assets/new
/admin/users
/admin/maintenance
/admin/buildings
/admin/audit-logs
```

## Technician

```text
/technician
/technician/requests
/technician/requests/[id]
```

---

# 15. Route Protection

Do not rely only on hiding navigation links.

If a user manually enters:

```text
/admin/assets
```

the application must verify:

```text
Authenticated?
   ↓
Active?
   ↓
Role allowed?
```

Unauthorized users should be redirected or shown a proper 403/permission page.

---

# 16. Middleware vs Server-Side Protection

Use middleware/session refresh where appropriate for authentication state.

However, critical authorization should also happen server-side and in RLS.

Think of middleware as:

```text
Fast route/session gate
```

not:

```text
Final database security boundary
```

RLS remains the final data-access control.

---

# 17. Role Resolution

After authentication:

```text
auth.uid()
     ↓
profiles.id
     ↓
profiles.role
```

The application should retrieve the current profile through a centralized helper rather than duplicating profile queries throughout the application.

Example conceptual helper:

```text
getCurrentUserProfile()
```

It should return:

```text
id
full_name
email
role
department
is_active
```

only as needed.

---

# 18. Current User Context

Create a reusable current-user abstraction.

Example conceptual structure:

```text
CurrentUser
├── id
├── email
├── fullName
├── role
├── department
└── isActive
```

Do not expose unnecessary profile data to every client component.

---

# 19. Role-Based Navigation

Navigation should adapt to role.

### Admin

```text
Dashboard
Assets
Maintenance
Buildings
Users
Audit Logs
Profile
Logout
```

### Technician

```text
Dashboard
Assigned Maintenance
Assets
Profile
Logout
```

### Student/Staff

```text
Dashboard
My Requests
My Assignments
Report Problem
Profile
Logout
```

The navigation is a UX convenience.

Actual access is still controlled by route/server/RLS security.

---

# 20. Login UI Requirements

The login page should include:

- Application branding/name
- Email field
- Password field
- Login button
- Loading state
- Error message
- Link/route for appropriate future password recovery if implemented

Keep the login UI simple.

Do not add social login unless explicitly required.

---

# 21. Password Recovery

Password reset is optional for the initial MVP.

If implemented, use Supabase Auth's password reset functionality.

Do not build custom reset tokens.

Do not store reset tokens in the application's database.

Recommended flow:

```text
Forgot password
      ↓
Supabase password reset
      ↓
Email
      ↓
Recovery link
      ↓
Set new password
```

The exact email configuration is a Supabase setup responsibility for the human developer.

---

# 22. Email Verification

Whether email confirmation is enabled depends on the Supabase project configuration chosen by the human developer.

Claude Code must handle both possible states gracefully:

```text
Email confirmation required
```

or:

```text
Email confirmation not required
```

Do not assume a successful sign-up always means the user can immediately log in.

---

# 23. User Provisioning

For the initial PBL, user accounts may be created through:

- Supabase Auth dashboard
- Admin provisioning workflow if implemented

The application should not expose unrestricted public user registration if the project is intended for controlled campus users.

If registration is added later, new accounts should receive a safe default role such as:

```text
STUDENT
```

and should not be able to choose:

```text
ADMIN
TECHNICIAN
```

from the public registration form.

---

# 24. Admin Role Assignment

Admin/technician roles must be assigned through a controlled administrative workflow.

Never allow:

```text
POST /profile
{
  "role": "ADMIN"
}
```

from an ordinary client.

Role changes must be:

- Authorized
- Validated
- Audited

---

# 25. First-Time Profile Handling

If a valid Auth user exists but no `profiles` row exists:

The application should not silently invent elevated privileges.

Safe options:

### Option A — controlled provisioning

Admin creates the profile.

### Option B — safe default

Create a profile with:

```text
role = STUDENT
is_active = false/true
```

depending on the chosen onboarding model.

Do NOT default missing profiles to ADMIN.

The final implementation should choose one clear onboarding strategy.

---

# 26. QR + Authentication Interaction

QR scanning does not require authentication for viewing public asset information.

Example:

```text
Scan QR
   ↓
Public asset page
```

Authentication is required for protected actions:

```text
Request asset
Report problem
View private information
```

This creates a good public/private split.

---

# 27. Public Asset Flow

```text
Phone camera
    ↓
/asset/AST-2026-00142
    ↓
Public asset query
    ↓
Safe asset data
    ↓
Asset page
```

If user is logged in:

```text
Request Asset
Report Problem
```

may appear according to their role.

---

# 28. Session-Aware QR Page

The asset page may determine:

```text
Public visitor
```

versus:

```text
Authenticated user
```

and display appropriate actions.

Do not expose private data merely because the user is logged in.

Role/RLS still applies.

---

# 29. Authentication Error States

Handle at least:

```text
Invalid credentials
Inactive account
Session expired
Network error
Supabase unavailable
Unauthorized route
Profile missing
```

Use clear user-facing messages.

Example:

```text
Your session has expired. Please sign in again.
```

---

# 30. Session Expiry

If the session expires:

```text
Protected request
      ↓
Auth/session failure
      ↓
Refresh if supported
      ↓
If still invalid:
      ↓
Redirect to login
```

Do not loop infinitely between login and protected routes.

---

# 31. Unauthorized vs Unauthenticated

Distinguish:

### Unauthenticated

User has no valid session.

Response:

```text
Redirect to /login
```

### Unauthorized

User is logged in but lacks the required role.

Response:

```text
403 / Access denied
```

Do not redirect every authorization failure to login.

---

# 32. Data Fetching After Login

After authentication:

```text
Session
 ↓
Current user ID
 ↓
Profile
 ↓
Role
 ↓
Dashboard data
```

Avoid fetching every possible dataset immediately.

Fetch data needed by the current route.

---

# 33. Auth Loading States

During session initialization, do not flash:

```text
Login page
```

and then immediately:

```text
Dashboard
```

if the session is still being resolved.

Use a minimal loading/skeleton state where needed.

---

# 34. Authenticated Forms

For any form that creates a user-owned record:

Do NOT send user identity as a trusted field.

Bad:

```json
{
  "reported_by": "user-selected-id"
}
```

Correct concept:

```text
authenticated session
      ↓
auth.uid()
      ↓
reported_by
```

The same applies to:

- Assignments
- Maintenance reports
- Uploaded documents
- Audit actor

---

# 35. Security with RLS

Authentication and RLS work together.

Example:

```text
Student logs in
      ↓
auth.uid() = Student A
      ↓
RLS policy
      ↓
Student can read own assignments
      ↓
Student cannot read Student B's assignments
```

The application must not bypass this security model.

---

# 36. Testing Authentication

Claude Code must create/test scenarios for:

## Anonymous

- Cannot access admin dashboard
- Cannot access private maintenance
- Can access public asset page
- Cannot create assignment
- Cannot report protected maintenance request

## Student

- Can log in
- Can access own dashboard
- Can request available asset
- Can report problem
- Cannot access admin routes
- Cannot change role
- Cannot view another user's private requests

## Staff

- Same baseline protections as Student unless additional permissions are defined

## Technician

- Can access technician dashboard
- Can access assigned maintenance
- Can update authorized maintenance
- Cannot manage users/roles

## Admin

- Can access admin routes
- Can manage assets
- Can manage buildings/rooms
- Can assign technicians
- Can view audit logs

---

# 37. Authentication Audit Events

Log important authentication/application events where practical:

```text
LOGIN_SUCCESS
LOGIN_FAILURE
LOGOUT
ROLE_CHANGED
ACCOUNT_DEACTIVATED
```

Do not log passwords or access tokens.

If login-failure logging is implemented, avoid storing sensitive authentication details.

---

# 38. Auth Logging Privacy

Never log:

```text
password
access_token
refresh_token
service_role_key
```

Do not log full authentication headers.

Keep logs operationally useful but privacy-conscious.

---

# 39. Authentication Implementation Structure

Suggested structure:

```text
src/
├── app/
│   ├── login/
│   │   └── page.tsx
│   ├── dashboard/
│   ├── admin/
│   └── technician/
│
├── components/
│   └── auth/
│       ├── LoginForm.tsx
│       ├── LogoutButton.tsx
│       └── AuthGuard.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   └── auth/
│       ├── current-user.ts
│       ├── permissions.ts
│       └── redirects.ts
│
└── middleware.ts
```

This is a suggested organization, not a rigid requirement.

---

# 40. Permission Helpers

Create centralized helpers where useful.

Examples:

```text
isAdmin(user)
isTechnician(user)
canManageAssets(user)
canManageMaintenance(user)
canViewAuditLogs(user)
```

These helpers simplify UI/server code.

They do not replace RLS.

---

# 41. Route Protection Examples

### `/admin/assets`

Required:

```text
authenticated
AND
active
AND
role = ADMIN
```

### `/technician/requests`

Required:

```text
authenticated
AND
active
AND
role = TECHNICIAN
```

### `/dashboard`

Required:

```text
authenticated
AND
active
```

### `/asset/[publicId]`

Required:

```text
none
```

for public safe information.

---

# 42. Auth + Vercel Deployment

Production deployment must configure the Supabase public environment variables in Vercel.

Do not commit production environment files.

The human developer will provide/configure the values.

Claude Code must ensure the application reads them correctly.

---

# 43. Supabase Auth Configuration — Human Responsibility

The human developer should handle:

- Creating the Supabase project
- Enabling/configuring Auth
- Selecting authentication providers
- Configuring email confirmation behavior
- Configuring redirect URLs
- Configuring email provider settings if required
- Creating initial admin account through a secure method

Claude Code must document these setup steps but does not need to perform them.

---

# 44. Claude Code Responsibilities

Claude Code must implement:

- Login page
- Logout
- Session integration
- Current user/profile helper
- Role-aware navigation
- Route protection
- Auth-aware QR page
- Permission helpers
- Auth error handling
- Inactive user handling
- Protected server-side operations
- Auth-related tests
- `.env.example`
- Documentation for required Supabase Auth configuration

---

# 45. Human Responsibilities

The human developer will:

- Create Supabase project
- Configure Auth provider
- Configure email/redirect settings
- Create initial privileged account securely
- Add environment variables
- Apply migrations
- Verify Auth configuration
- Deploy/configure Edge Functions where required

---

# 46. Definition of Done

Authentication is complete when:

- Users can sign in.
- Users can sign out.
- Sessions persist correctly.
- Protected routes require authentication.
- Admin routes require ADMIN role.
- Technician routes require TECHNICIAN role.
- Inactive users are blocked.
- Current profile/role is resolved correctly.
- QR public pages work without login.
- Protected QR actions require login.
- RLS works with authenticated identities.
- Role escalation is prevented.
- User identity is derived from auth context.
- No secrets are exposed client-side.
- Auth errors are handled gracefully.
- Anonymous/student/technician/admin scenarios are tested.
- Production environment variables can be configured on Vercel.
