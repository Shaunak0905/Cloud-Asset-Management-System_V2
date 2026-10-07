# Campus Asset QR & Maintenance Management System

A cloud-based web application that gives every physical campus asset (projectors,
laptops, lab kits, …) a QR-based digital identity, and manages its assignments,
usage locations, maintenance, files, and audit trail.

- **Frontend / app:** Next.js (App Router) + TypeScript + Tailwind CSS, hosted on Vercel
- **Backend-as-a-Service:** Supabase — PostgreSQL, Auth, Row Level Security, Storage
- **No separate backend server** and no paid services required

The full specification is in [`docs/`](docs/). Start with
[`docs/00-project-context.md`](docs/00-project-context.md) and the build plan in
[`docs/16-implementation-roadmap.md`](docs/16-implementation-roadmap.md).

## Prerequisites

- Node.js 20.9 or newer
- npm (the project uses npm; don't mix package managers)
- A Supabase project (free tier)

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000. If Supabase is not configured yet, the app shows a
"Setup required" page listing what is missing instead of crashing.

### Environment variables

| Variable                        | Scope       | Purpose                                                               |
| ------------------------------- | ----------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | public      | Supabase project URL                                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public      | Supabase anon / publishable key (RLS-protected)                       |
| `NEXT_PUBLIC_APP_URL`           | public      | App origin used to build QR URLs                                      |
| `SUPABASE_SERVICE_ROLE_KEY`     | server only | Only if a feature genuinely requires it — never expose to the browser |

Never commit `.env.local` or any real credentials.

## Supabase setup (done by the developer)

These steps are performed by you in the Supabase dashboard — the code never needs
your Supabase password or access tokens.

1. Create a new project at [supabase.com](https://supabase.com) (free tier).
2. In the project's dashboard, open **Project Settings → API Keys** and copy the
   **anon** (or **publishable**) key, and copy the **Project URL**.
3. Put them in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Do **not** use the `service_role`/secret key here.
4. Restart `npm run dev`.
5. Verify the connection: open http://localhost:3000/api/health.
6. **Disable public sign-ups:** in **Authentication → Sign In / Providers**, turn
   off **Allow new users to sign up**. The anon key is public, so otherwise anyone
   could register through the Auth API and get a STUDENT account. Administrators
   still create accounts from **Authentication → Users → Add user** (tick
   **Auto Confirm User**).

## Authentication

Email + password sign-in through Supabase Auth, with sessions kept in cookies by
`@supabase/ssr`. There is no public registration.

- `/login` signs in and redirects by role: **Admin → `/admin`**,
  **Technician → `/technician`**, **Staff/Student → `/dashboard`**, or back to
  the page that required sign-in (`?next=`, same-site paths only).
- `src/proxy.ts` refreshes the session on every request and redirects anonymous
  visitors from protected paths to `/login`.
- Every protected page calls `requireUser()` or `requireRole([...])`
  (`src/lib/auth/current-user.ts`). The role is read from `profiles` on the
  server, never trusted from the browser. Wrong role → `/forbidden`; inactive
  account → `/account-inactive`. A test fails if a page forgets its guard.
- Sign-out ends the session on this device and returns to `/login`.
- These checks decide navigation only — RLS still protects every query.

### Test accounts

Create one account per role in **Authentication → Users → Add user**, then set
the roles in the SQL Editor (users start as STUDENT):

```sql
update public.profiles set role = 'TECHNICIAN' where email = 'tech@example.com';
update public.profiles set role = 'STAFF'      where email = 'staff@example.com';
```

Use `public.change_user_role()` (or the admin UI once built) for later changes
so they are audited; SQL Editor updates bypass the audit trail.

### Health check

`GET /api/health` reports connectivity without exposing any secrets:

| `status`         | Meaning                                                         |
| ---------------- | --------------------------------------------------------------- |
| `not_configured` | Environment variables are missing or invalid (HTTP 503)         |
| `ok`             | Supabase Auth and the database API are reachable (HTTP 200)     |
| `degraded`       | Auth or the database could not be reached — check URL/key (503) |

`checks.database` is `schema_missing` until the database migrations (Phase 2)
are applied, and `ok` afterwards. `session.authenticated` shows whether the
request carries a valid login session.

## Database

The schema lives in versioned SQL migrations under
[`supabase/migrations/`](supabase/migrations/), applied in filename order either
through the dashboard's SQL Editor or with the Supabase CLI.

| Migration        | Contents                                                          |
| ---------------- | ----------------------------------------------------------------- |
| `…_foundation`   | `private` schema, enums, shared trigger functions                 |
| `…_profiles`     | `profiles` + automatic STUDENT profile for every new auth user    |
| `…_locations`    | `buildings`, `rooms`                                              |
| `…_assets`       | `assets`, generated `AST-YYYY-NNNNN` IDs, status transition rules |
| `…_assignments`  | `asset_assignments` with usage location, one ACTIVE per asset     |
| `…_maintenance`  | `maintenance_requests` (`MR-YYYY-NNNN`), `maintenance_history`    |
| `…_documents`    | `asset_documents` (Storage file metadata)                         |
| `…_audit_logs`   | append-only `audit_logs`                                          |
| `…_rls_policies` | grants, RLS policies, public QR function, admin role functions    |

Later migrations add each workflow's database functions (asset requests,
returns and transfers, maintenance reporting, technician workflow,
maintenance resolution, storage, dashboards, notifications) and tighten
the grants they replace.

Integrity rules are enforced by the database itself: a room must belong to the
building it is paired with, an asset can have only one ACTIVE assignment, status
changes must follow the documented workflows, asset/QR identifiers never change,
history and audit records are append-only, and user identity columns
(`reported_by`, `created_by`, `uploaded_by`, `actor_id`) come from the session.

### Access control

Every table has RLS enabled, and the API roles only receive the table/column
privileges they need (e.g. no client can write `profiles.role`,
`assets.asset_id` or `reported_by`). Summary:

| Data                             | Public (anon)          | Student / Staff             | Technician                         | Admin               |
| -------------------------------- | ---------------------- | --------------------------- | ---------------------------------- | ------------------- |
| Asset by QR (`get_public_asset`) | one asset, safe fields | yes                         | yes                                | yes                 |
| Buildings, rooms, assets         | —                      | read                        | read                               | read / write        |
| Assignments                      | —                      | own (read)                  | —                                  | all                 |
| Maintenance requests             | —                      | report; read own            | read assigned                      | all                 |
| Maintenance history              | —                      | —                           | read / add notes on assigned       | all                 |
| Documents                        | —                      | asset images                | + evidence on assigned requests    | all, delete         |
| Profiles                         | —                      | own (+ assigned technician) | own (+ reporters of assigned work) | all                 |
| Audit logs                       | —                      | —                           | —                                  | read                |
| Roles / account status           | —                      | —                           | —                                  | via admin functions |

Inactive accounts can read only their own profile. Workflow actions (requesting
and returning assets, assigning, starting, resolving and cancelling
maintenance, role and account changes) go through dedicated database functions
that check the caller and write the audit log. See [Security](#security) for
how this is verified.

### Applying migrations

**Dashboard (current workflow):** open **SQL Editor → New query**, paste a
migration file (or a combined file covering several), and run it. Apply files in
filename order; each is applied once.

**CLI (alternative):** run once per machine (opens a browser to log in, then asks
for the database password you chose when creating the project — type it only into
your terminal):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

Then apply the migrations, including the demo seed data the first time:

```bash
npx supabase db push --include-seed
```

Later schema changes only need `npm run db:push`. The project ref is the
`<ref>` in `https://<ref>.supabase.co`. If migrations were already applied through
the dashboard, first mark them as applied so the CLI skips them:
`npx supabase migration repair --status applied <version> …` (the version is the
timestamp prefix of each file).

### Creating the first admin

1. In the Supabase dashboard, open **Authentication → Users → Add user** and
   create your account (a STUDENT profile is created automatically).
2. In the **SQL Editor**, promote it:

   ```sql
   update public.profiles set role = 'ADMIN' where email = 'you@example.com';
   ```

Never grant roles from user metadata or a public form — only admins change roles.

### Database types

`src/types/database.ts` holds the TypeScript types for the schema, maintained by
hand in the Supabase CLI's generated format and updated with every migration. A
test (`tests/db/types.test.ts`) fails if its tables, columns, enums or database
functions drift from the migrations. With the CLI linked, `npm run db:types` regenerates it.

### Database tests

`npm run test` runs the migrations against an in-process PostgreSQL
([PGlite](https://pglite.dev)) with a minimal stub of Supabase's `auth` schema, and
checks the constraints, triggers and RLS policies — including acting as
anonymous, student, staff, technician, admin and inactive users exactly as API
requests would. No Docker or cloud project needed.

## Security

Each layer checks for itself; none relies on the one in front of it:

1. **Proxy** (`src/proxy.ts`) — signed-out requests to app pages go to the
   login page.
2. **Page guards** — every signed-in page calls `requireUser()` or
   `requireRole()`; admin and technician pages require that role.
3. **Server actions** — each one checks the user before touching the
   database and validates every argument (IDs bound in a page still arrive
   from the browser).
4. **Database** — RLS on every table, column-level grants, and workflow
   functions that check the caller themselves. Anonymous visitors can only
   call the public QR lookup. History and audit logs are append-only, even
   for the database owner.
5. **Storage** — private buckets with size and file-type limits; files are
   opened through one-minute signed URLs after an RLS check.

The service role key is never used by the app (only by the reminders Edge
Function, as a Supabase secret), and `.env.local` is ignored by git.

**Browser headers** (`next.config.ts`): a Content Security Policy (no
framing, no plugins, images and connections limited to the app and its
Supabase project), `X-Frame-Options: DENY`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy`, `Permissions-Policy` (no camera, microphone or
location), `Cross-Origin-Opener-Policy` and HSTS. `X-Powered-By` is off.

**Automated checks** (part of `npm run check`):

- `tests/db/security.test.ts` — reads the database catalog: RLS on every
  table, the exact table, column and function grants, an empty
  `search_path` on every function, private buckets with limits, and policies
  for signed-in users only. It then has every non-admin role (including a
  deactivated admin) try every admin workflow, and every role try direct
  writes that would bypass the workflows (promoting themselves, forging or
  deleting audit entries, deleting records). All must be refused.
- `tests/app-security.test.ts` — every server action checks the user first;
  no service key in app code; only the three `NEXT_PUBLIC_` variables; env
  files ignored; no raw HTML rendering; the UI gallery is development-only;
  the security headers.
- `tests/route-protection.test.ts` — every signed-in page has a guard and is
  behind the proxy.

**Checking the live project:** run `supabase/setup/security-check.sql` in the
SQL Editor (read-only) after any migration or dashboard change. It lists
problems, so "No rows returned" means every check passed. Keep these Auth
settings as they are (checked on the live project in Phase 19) under
**Authentication → Sign In / Providers**: "Allow new users to sign up" off
(accounts are created by admins), email confirmation on, anonymous sign-ins
off. Supabase's own **Database → Advisors → Security Advisor** is a useful
second opinion.

**Accepted by design:**

- QR IDs are sequential (`AST-2026-00001`, …), so anyone can look assets up
  one by one, but only the public fields (name, category, status,
  department, home location). Printed labels depend on them.
- Signed-in users can read every asset's full record (including serial
  number and warranty), which browsing and requesting need. Assignments,
  maintenance, documents and the audit log stay restricted.
- The CSP allows inline scripts: a nonce-based policy would force every page
  to render per request. React escapes all text, and the app renders no raw
  HTML (tested).
- No app-level rate limiting (docs/04 §38): Supabase Auth limits sign-in
  attempts, and every write needs an active account.

## Testing

| Layer                   | Where                                    | Runs with       |
| ----------------------- | ---------------------------------------- | --------------- |
| Unit and component      | `src/**/*.test.ts(x)` (Vitest, jsdom)    | `npm run check` |
| Database, RLS, storage  | `tests/db/` (Vitest, PGlite)             | `npm run check` |
| Security and bundle     | `tests/*.test.ts`                        | `npm run check` |
| Critical workflow (DB)  | `tests/db/critical-path.test.ts`         | `npm run check` |
| Browser (public pages)  | `e2e/public.spec.ts` (Playwright)        | `npm run e2e`   |
| Browser (full workflow) | `e2e/critical-path.spec.ts` (Playwright) | `npm run e2e`   |

- **`npm run check`** needs no network or accounts: the database tests run
  every migration in an in-process PostgreSQL and act as each role.
  `tests/db/critical-path.test.ts` walks the whole scenario of docs/14 §58:
  an admin creates an asset, anyone scans it, a student requests it for
  Vivekananda / VK404 (its home stays Vyas / VY001), reports a problem and
  returns it, the admin assigns a technician, who starts, uploads evidence,
  logs the repair and resolves it. Then it checks the history and that every
  audit event names the right person. It also covers two people requesting
  the same asset and the cross-role security checks (§59–60).
- **`npm run e2e`** runs the browser tests against the production build:
  run `npm run build` first; it starts `npm run start` itself. It uses your
  installed Chrome (`E2E_BROWSER_CHANNEL=msedge` for Edge), so there is
  nothing to download. Every public test runs on a desktop and a phone-sized
  screen, including an accessibility scan (axe) and a check that no page
  scrolls sideways.
- **The full browser workflow** signs in as three test accounts and does the
  same journey through the real pages, then checks the main signed-in pages
  on a phone-sized screen. It is skipped unless the accounts are set in a
  git-ignored `.env.e2e.local`:

  ```text
  E2E_ADMIN_EMAIL=...
  E2E_ADMIN_PASSWORD=...
  E2E_TECHNICIAN_EMAIL=...
  E2E_TECHNICIAN_PASSWORD=...
  E2E_STUDENT_EMAIL=...
  E2E_STUDENT_PASSWORD=...
  # optional: test a deployed site instead of the local build
  # E2E_BASE_URL=https://<preview>.vercel.app
  # optional: an asset that exists in your project (default AST-2026-00001)
  # E2E_PUBLIC_ASSET_ID=AST-2026-00001
  ```

  Use test accounts only (see Test accounts), never real people's. The run
  writes real records to the project the app points at: an asset named
  "E2E Projector …", one assignment and one maintenance request. It returns
  and retires the asset at the end, but the history and audit entries stay
  (they cannot be deleted). Use a separate free Supabase project if you do
  not want them in your main one.

### Manual acceptance check

Before a release, someone who did not build the app should manage these
without help (docs/14 §65–71), on a phone where it says so:

1. Scan a printed QR code with a phone camera: the right asset opens.
2. Sign in from that page and request the asset, choosing a building and
   then a room in it. The asset keeps its home location.
3. Report a problem with the asset.
4. As admin, assign a technician. As the technician, start work, upload a
   photo, add a note and resolve it.
5. As admin, find each step in the Audit log with the right person.
6. As a student, open an `/admin` page and someone else's request by URL:
   both are refused.

## UI development

With `npm run dev` running, open http://localhost:3000/dev/ui for a gallery of
the app shell (switch role navigation with `?role=`) and every UI component with
sample data. It needs no sign-in and returns 404 in production builds.

### Assets

- `/assets` (everyone signed in) and `/admin/assets` (admins) list assets with
  search (asset ID, name, serial, category), filters (status, category,
  building, department) and pagination, all kept in the URL.
- `/assets/AST-2026-00001` shows an asset; admins also get **Edit** and a
  **Status** control that offers only allowed transitions (retiring asks for
  confirmation). `/admin/assets/new` creates an asset; the asset ID / QR
  identity is generated by the database.
- The database records `ASSET_CREATED`, `ASSET_UPDATED` (with the changed
  fields), `ASSET_STATUS_CHANGED`, `ASSET_RETIRED` and
  `ASSET_REGISTERED_LOCATION_CHANGED` audit events automatically.
- **Assigned** status can only be set or cleared by the assignment workflow.
- Forms that contain the building → room selector submit through
  `useActionForm` (`src/lib/use-action-form.ts`): React's automatic form reset
  would otherwise clear the selected building and room after a validation error.

### Requesting assets

- **Request / use asset** (asset page, or the QR page when signed in) asks
  _where will you use it?_ — building → room — plus an optional expected
  return time (campus time) and notes.
- `request_asset` (database function) does everything in one transaction: it
  locks the asset, checks it is AVAILABLE and that the room is an active room
  of the chosen building, creates the ACTIVE assignment for the signed-in user
  (never a user ID from the browser), marks the asset ASSIGNED and records
  `ASSET_ASSIGNED`. Two simultaneous requests: one succeeds, the other gets
  "This asset is no longer available." The registered location is never
  changed; the usage location lives on the assignment.
- **My Assignments** (`/assignments`) lists your assignments, active first,
  with an **Overdue** badge. Asset pages show a **Current use** card (details
  only to the holder and admins).

### Returns and transfers

- **Return asset** (on the asset's **Current use** card and in **My
  Assignments**) asks for confirmation, then `return_asset` closes the
  assignment as RETURNED with the return time, makes the asset AVAILABLE and
  records `ASSET_RETURNED`. Only the person using the asset — or an admin —
  can return it; a second return is refused.
- Admins can **Assign to someone** (available assets) or **Transfer** (assigned
  assets) at `/admin/assets/<asset-id>/assign`: the recipient's sign-in email,
  the usage building → room, and an optional return time. `assign_asset` and
  `transfer_asset` check the recipient is an active user. A transfer keeps the
  old assignment as TRANSFERRED and opens a new ACTIVE one (`ASSET_TRANSFERRED`
  records both), so history is never overwritten. If the asset was returned or
  transferred meanwhile, the transfer is refused instead of overriding it.
- Assignments can only be created or changed through these database functions
  (`request_asset`, `return_asset`, `assign_asset`, `transfer_asset`) — not by
  direct table writes, not even by admins — so an assignment and its asset's
  status can never disagree.
- Admins see each asset's **Assignment history** (latest 10) on its page.

### Reporting problems

- **Report a problem** (asset page, or the QR page when signed in) asks what is
  wrong and how serious it is (Low / Medium / High / Critical, each explained).
  `report_problem` records the signed-in user as the reporter, gives the
  request a number (`MR-2026-0017`), starts it as OPEN, adds a REPORTED history
  entry and a `MAINTENANCE_CREATED` audit event.
- **High and Critical** problems take an available asset out of service
  (IN_MAINTENANCE), so nobody requests a broken asset. An asset someone is
  using stays with them; when it is returned it goes to maintenance instead of
  back into use. Low and Medium leave the asset usable.
- The report page and asset page show the asset's open reports (number and
  status only, via `list_open_maintenance`) so people can avoid duplicates
  without seeing others' reports.
- **My Requests** (`/maintenance`) lists your reports; `/maintenance/<number>`
  shows one (to its reporter, its technician and admins only). Admins get
  `/admin/maintenance` with search (request number, asset ID or name), status
  and priority filters, and pagination.
- Reports can only be created through `report_problem` — direct table inserts
  are refused.

### Technician workflow

- On a request's page (`/maintenance/<number>`) admins **Assign technician**
  from a list of active technicians, or **Reassign** an unfinished request to
  someone else. `assign_technician` checks the choice is an active
  technician, moves an OPEN request to ASSIGNED (a reassigned request keeps
  its step), and records history and a `MAINTENANCE_ASSIGNED` audit event.
  Assigning the same technician twice changes nothing.
- The assigned technician sees **Start work**: `start_maintenance` moves
  ASSIGNED to IN_PROGRESS (`MAINTENANCE_STARTED`). Only the assigned
  technician or an admin can start it; another technician is refused.
- The **Work log** shows the request's history (reported, assigned, started
  and work notes) to admins and the assigned technician only — reporters see
  the status, not internal notes. While a request is assigned or in progress
  they can **Add a note** (inspection, diagnosis, repair, part replaced,
  testing or note); the author comes from the session, notes must say
  something, and each one is audited (`MAINTENANCE_HISTORY_ADDED`, without
  copying the text).
- **My Maintenance** (`/technician/maintenance`) lists a technician's open
  work, most urgent first, with each asset's home location; the status filter
  reaches resolved and cancelled requests. The technician dashboard shows the
  top of the same queue.
- Requests change only through these database functions — direct `UPDATE`s
  are refused, even for admins — so every step has its history entry and
  audit event. Starting work does not change the asset's status: serious
  problems already took it out of service when reported, and resolution
  decides the state it returns to.

### Resolving and cancelling

- Once work has started, the assigned technician (or an admin) **Resolves**
  the request: what was done — the reporter sees this — and the asset's
  final state. `resolve_maintenance` closes the request, records history and
  `MAINTENANCE_RESOLVED` (with the final asset status, not the notes), and
  updates the asset:
  - **Repaired** — back to Available, or it stays In maintenance while
    another High/Critical problem on it is still open.
  - **Still damaged** — Damaged.
  - **Beyond repair** — Retired, after a confirmation. Admins only:
    retirement cannot be undone, so a technician marks it damaged and an
    admin retires it.
  - An asset someone is using stays with them (it goes back into use when
    returned), and a lost or retired asset keeps its status; no choice is
    offered for these. The database refuses any other choice.
- Admins can **Cancel request** while it is open or assigned (e.g. a
  duplicate), with a reason the reporter can read. `cancel_maintenance` keeps
  the request and its history, records `MAINTENANCE_CANCELLED`, and puts an
  asset that a High/Critical report took out of service back into use
  unless another serious problem is still open. Requests in progress are
  resolved instead.
- The reporter sees the result on the request page: the resolution or the
  cancellation reason.

### Files

Files live in three **private** Supabase Storage buckets; the
`asset_documents` table holds their metadata. The storage migration creates
the buckets (10 MB per file, fixed file types) and their access policies, so
nothing is set up by hand in the dashboard.

| Bucket                  | Holds                         | Upload                            | Read                           |
| ----------------------- | ----------------------------- | --------------------------------- | ------------------------------ |
| `asset-images`          | asset photos (JPG, PNG, WebP) | admins                            | every signed-in, active user   |
| `maintenance-images`    | repair photos                 | admins; the assigned technician\* | admins and assigned technician |
| `maintenance-documents` | service reports etc. (PDF)    | admins; the assigned technician\* | admins and assigned technician |

\* while the request is assigned or in progress. Reporters and anonymous
visitors cannot read maintenance files; nothing is public.

- **Asset photo** (asset page): admins upload, replace or remove it. The old
  photo is removed only after the new one is safely saved.
- **Evidence** (request page): the assigned technician and admins attach
  photos and PDFs (service report, receipt, other). Evidence stays after the
  request is resolved or the asset retired; only an admin can delete a file,
  after a confirmation.
- **Upload path:** the browser sends the file straight to Supabase Storage
  (so 10 MB files never pass through the app server), then a Server Action
  registers it. Large photos are shrunk in the browser first (longest edge
  2000 px), which keeps phone photos to a few hundred KB.
- **Checks, at every layer:** the uploader checks type, size and the file's
  first bytes (a renamed `.exe` is not a JPG); the bucket enforces size and
  MIME type; storage policies enforce who may write where, and that the path
  is `assets/<asset id>/<random>.<ext>` or `maintenance/<request id>/…` —
  original file names are kept only as a label. When registering, the server
  re-reads the stored file's first bytes, and the database takes the type and
  size from the stored object (not from the browser) and refuses a path that
  belongs to another record. A refused upload is removed again.
- **Opening files:** pages link to `/api/files/<document id>`, which checks
  access as the signed-in user (RLS) and redirects to a signed URL that
  expires after a minute. Missing files show "Image unavailable" rather than
  breaking the page.
- Uploads and deletions are audited (`ASSET_IMAGE_UPLOADED`,
  `MAINTENANCE_EVIDENCE_UPLOADED`, `DOCUMENT_DELETED`) without paths or URLs.
- No service-role key is used anywhere: every storage call runs as the
  signed-in user.

### Maintenance history

- Every request page shows its **progress** — Reported → Technician assigned
  → In progress → Resolved (or Cancelled) — with times, to everyone who can
  open the request, including the reporter.
- Admins and the assigned technician also see the request's **timeline**:
  every `maintenance_history` entry (workflow steps and work notes), oldest
  first, with who did it. Nothing in it is generated by the app.
- The asset page lists the asset's **maintenance history**: each problem, its
  status, dates and what was done. Admins see every request; other users only
  the ones they reported or are assigned to (RLS decides).

### Audit log

- Every important action writes an append-only `audit_logs` row in the same
  database transaction as the change, with the actor taken from the session:
  asset changes, assignments, maintenance steps, files, roles and account
  status. There is no client-side "record audit event" call — clients cannot
  write audit rows at all, so an event cannot be faked or attributed to
  someone else. `src/lib/audit/events.ts` is the single list of event names;
  a test fails if a migration writes an event that is not in it (or the
  reverse), and another runs every workflow and checks each event names the
  signed-in user.
- **Audit Logs** (`/admin/audit-logs`, admins only) lists events newest
  first, 20 per page, filterable by action, record type, who did it (name or
  email), asset ID / request number (an asset ID also finds its maintenance
  events) and campus-time date range — all kept in the URL. Each row shows
  what changed in words (e.g. _Status: Open → Assigned_, _Technician: Ravi
  Kumar_) and links to the asset or request; internal ids, storage paths and
  file contents are never shown. Non-admins get the access-denied page, and
  RLS returns them no audit rows even through the API.

### Search, filters and sorting

Every list keeps its search, filters, sort and page in the URL, so views can
be bookmarked, shared and navigated with Back/Forward; all filtering and
sorting happens in the database, one page at a time.

- **Assets:** search (ID, name, serial, category); status, category,
  building, department; sort by newest, name, asset ID, recently updated or
  warranty ending first.
- **Maintenance (admin):** search (request number, asset ID or name);
  status, priority, technician (including "not assigned yet") and
  reported-date range (campus time); sort by newest, oldest, most urgent or
  recently updated. The technician queue has the same search, status,
  priority, dates and sort.
- **Audit log:** action, record type, who, asset/request reference and dates.
- **Users** (`/admin/users`): search by name or email, role, active/inactive.

### Users

Admins manage people at `/admin/users`: change a role (with a confirmation
that says what the new role allows) and deactivate or reactivate accounts.
Both go through the audited database functions (`change_user_role`,
`set_user_active`), which refuse changes to your own account and to a
technician who still has open maintenance requests. Nothing is deleted: a
deactivated user keeps their history and sees an "account inactive" page.
Accounts themselves are created in the Supabase dashboard (Authentication →
Users → Add user); they start as Students.

### Dashboards

Each role lands on its own dashboard after sign-in. The numbers come from one
database function per dashboard that counts with `COUNT … GROUP BY` as the
signed-in user (so RLS still applies) — rows are never downloaded to be
counted. "This month" means the current campus-time calendar month.

- **Admin** (`/admin`): asset counts by status (total, available, assigned,
  in maintenance, damaged, lost, retired, overdue returns) and maintenance
  counts (waiting for a technician, assigned, in progress, critical not
  resolved, resolved this month) — each card opens the matching filtered
  list. **Attention required** lists critical requests, serious requests with
  no technician and overdue returns (with who has each asset), or says
  nothing needs attention. Also: technician workload (a guide for assigning
  work, not a score), assets by category and by building (retired excluded),
  recent maintenance and recent audit activity. Sections load independently.
- **Technician** (`/technician`): assigned / in progress / high-or-critical /
  resolved this month, and the top of the priority queue.
- **Student / staff** (`/dashboard`): assets in use, overdue returns and open
  reports; the assets they are using with where they are using them (the
  assignment's location, not the asset's home), due dates and a Return
  button; and their latest reports.

### Notifications and reminders

- **Notifications** (`/notifications`, every role) lists in-app reminders,
  newest first; the navigation shows an unread badge (and a bell in the
  mobile top bar). Choosing a notification marks it read and opens the asset;
  **Mark all as read** clears the badge. Users see only their own, can only
  mark them read, and cannot create or delete any (RLS + column grants).
- **Reminders** are written once a day by the `send-reminders` **Supabase
  Edge Function** (`supabase/functions/send-reminders/`), started by
  **Supabase Cron** — the project's serverless, scheduled-job component:
  - _Overdue return_ → the person holding the asset (one per day at most,
    and none while the previous one is still unread).
  - _Warranty ending within 30 days_ → every active admin, once per asset and
    warranty date.
  - Notifications read more than 90 days ago are deleted.
- The function refuses requests without the shared secret
  (`x-reminders-secret`), and uses the service-role key that Supabase
  provides in the Edge Function's own environment — it never reaches the app
  or the browser. Running it twice in a day sends nothing twice (unique
  reminder keys). No email or SMS: notifications stay in the app.

#### Setting up the reminders (once)

1. Run the notifications migration (as with the others).
2. Make a long random secret, e.g.
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Deploy the function — either way works:
   - **CLI:** `npx supabase login`, `npx supabase link --project-ref <ref>`
     (asks for your database password — type it only in your terminal), then
     `npx supabase functions deploy send-reminders --no-verify-jwt` and
     `npx supabase secrets set REMINDERS_SECRET=<the secret>`.
   - **Dashboard:** Edge Functions → Deploy a new function → Via editor, name
     it `send-reminders`, create the two files `index.ts` and `reminders.ts`
     with the contents from `supabase/functions/send-reminders/`, deploy;
     then in the function's settings turn **Verify JWT** off, and under Edge
     Functions → Secrets add `REMINDERS_SECRET`.
   - If the function's log shows `JWT issued at future` (the key Supabase
     injects was minted by a clock slightly ahead of the database's), also add
     the secret `REMINDERS_SERVICE_KEY` with the project's legacy
     **service_role** key (Project Settings → API Keys); the function then
     uses that key instead. It stays server-side like the injected one.
4. Open `supabase/setup/schedule-reminders.sql`, replace the project ref and
   the secret, and run it in the SQL Editor (it enables pg_cron and pg_net,
   stores the secret in Vault and schedules the job for 07:00 campus time).
5. Try it now instead of waiting for the night:
   `curl.exe -X POST https://<ref>.supabase.co/functions/v1/send-reminders -H "x-reminders-secret: <the secret>"`
   answers with a summary such as `{"overdue":1,"warranty":0,"created":1,"removed":0}`.

The app works without these steps — the Notifications page simply stays
empty until the job runs.

### QR codes

- Each asset's QR code encodes only `NEXT_PUBLIC_APP_URL/asset/<public_id>` —
  no private data. It is generated in the browser (no QR service, nothing
  stored), so reprinting always produces the identical code.
- Admins see a **QR code** panel on the asset page with PNG/SVG download and a
  printable label (`/admin/assets/<asset-id>/label`). It warns when the URL is
  a local/development address: print physical labels from the production site.
- `/asset/<public_id>` is the public page a phone opens: no sign-in needed,
  safe fields only (via `get_public_asset`), a proper "Asset not found" page for
  unknown codes, and a sign-in button that returns to the asset afterwards.
  Scanning never changes anything.
- Set `NEXT_PUBLIC_APP_URL` to the production domain before printing labels.

### Locations

Admins manage buildings and rooms at `/admin/buildings` (create, edit,
activate/deactivate; nothing is deleted, so history keeps its locations).
Forms that need a location use `BuildingRoomSelector`
(`src/components/locations/`): pick a building, then one of its active rooms;
changing the building clears the room. The database independently rejects a
room that does not belong to the chosen building.

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the dev server                          |
| `npm run build`     | Production build                              |
| `npm run start`     | Serve the production build                    |
| `npm run lint`      | ESLint                                        |
| `npm run typecheck` | Generate route types, then TypeScript check   |
| `npm run test`      | Unit + database tests (Vitest, PGlite)        |
| `npm run format`    | Format with Prettier                          |
| `npm run check`     | Lint + typecheck + format check + tests       |
| `npm run e2e`       | Browser tests (Playwright, after a build)     |
| `npm run db:push`   | Apply new migrations to the linked project    |
| `npm run db:types`  | Regenerate database types from linked project |

## Project structure

```text
src/
├── app/                  # Routes (App Router)
│   ├── (app)/            # Signed-in pages (shared shell, one guard per page)
│   ├── dev/ui/           # Dev-only UI gallery (404 in production)
│   ├── login/            # Sign-in page
│   └── api/              # health check; files/<id> → signed URL redirect
├── components/
│   ├── audit/            # Audit log filters and table
│   ├── dashboard/        # Stat cards, bar lists, workload, activity
│   ├── notifications/    # Notification list, mark-all-read
│   ├── users/            # User filters, table, role and status controls
│   ├── ui/               # Button, inputs, Badge, Card, Table, Dialog, Toast…
│   ├── auth/             # Login form, sign-out button
│   ├── layout/           # App shell: sidebar, mobile drawer, page frames
│   ├── assets/           # Asset list, filters, form, status control
│   ├── assignments/      # Request/assign form, return button
│   ├── locations/        # BuildingRoomSelector, building/room forms
│   ├── maintenance/      # Report form, request table, technician workflow
│   ├── files/            # Uploader, evidence list, stored image
│   └── status-badges.tsx # Asset/maintenance/priority badges
├── lib/
│   ├── auth/             # Session/profile, guards, route rules, actions
│   ├── assets/           # Asset queries, validation, status rules, actions
│   ├── assignments/      # Request/return/assign/transfer actions and queries
│   ├── locations/        # Building/room queries, validation, admin actions
│   ├── maintenance/      # Problem reports: validation, queries, actions
│   ├── storage/          # File rules, browser upload, registration actions
│   ├── audit/            # Event names, filters, readable formatting, queries
│   ├── dashboard/        # Dashboard queries and result parsing
│   ├── notifications/    # Notification queries and actions
│   ├── users/            # User list filters, queries, role/status actions
│   ├── env.ts            # Environment validation
│   └── supabase/         # Browser, server and proxy Supabase clients
├── proxy.ts              # Session refresh + login gate on each request
└── types/database.ts     # Database types
supabase/
├── functions/            # Edge Functions (send-reminders)
├── setup/                # SQL run by hand (reminder schedule, security check)
├── migrations/           # Versioned SQL schema
├── seed.sql              # Demo buildings, rooms and assets
└── config.toml           # Supabase CLI config
tests/
├── db/                   # Database, RLS, security, critical workflow (PGlite)
├── app-security.test.ts  # Server action guards, secrets, headers
├── client-bundle.test.ts # Keeps zod (and supabase-js on login) out of the browser
└── route-protection.test.ts
e2e/                      # Browser tests (Playwright): public pages, full workflow
```

## Project status

Built incrementally following the roadmap. Completed phases:

- [x] Phase 0 — Repository preparation
- [x] Phase 1 — Supabase integration foundation
- [x] Phase 2 — Database schema
- [x] Phase 3 — Row Level Security
- [x] Phase 4 — Authentication
- [x] Phase 5 — Application shell & UI kit
- [x] Phase 6 — Buildings & rooms, building → room selector
- [x] Phase 7 — Asset management (list, search, filters, detail, create/edit, status)
- [x] Phase 8 — QR codes (generate, download, print; public asset page)
- [x] Phase 9 — Asset requests with usage location
- [x] Phase 10 — Returns, admin assign and transfer, assignment history
- [x] Phase 11 — Maintenance reporting (report, my requests, admin list)
- [x] Phase 12 — Technician workflow (assign/reassign, start work, work log,
      technician queue)
- [x] Phase 13 — Maintenance resolution (resolve with the asset's final
      state, cancel)
- [x] Phase 14 — Storage (asset photos, maintenance evidence, signed URLs)
- [x] Phases 15–16 — Maintenance history (progress, timeline, asset history);
      audit log viewer with filters
- [x] Phase 17 — Role dashboards (admin, technician, student/staff)
- [x] Reminders Edge Function — nightly Supabase Edge Function + Cron
      writing in-app notifications (overdue returns, warranties ending)
- [x] Phase 18 — Search, filters and sorting; admin user management
- [x] Phase 19 — Security hardening (review, grant fixes, security headers,
      automated security checks, live-project check script)
- [x] Phase 20 — Testing (critical workflow tests, browser tests on desktop
      and phone, accessibility scan, error page inside the app, mobile table
      fix, lighter client bundle)

Planned:

- [ ] Phases 21–22 — Deployment to Vercel, production smoke test
