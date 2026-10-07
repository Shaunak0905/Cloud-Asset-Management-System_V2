# Storage & File Management
## Cloud-Based Campus Asset QR & Maintenance Management System

> **Status:** Implementation-ready storage specification  
> **Audience:** Claude Code / student development team  
> **Source of truth:** `docs/00-project-context.md` through `docs/08-maintenance-system.md`
>
> Supabase Storage is the file-storage layer. PostgreSQL stores file metadata and relationships; it does not store the actual binary files.

---

# 1. Storage Goal

The storage system must support:

- Asset images
- Maintenance photographs
- Repair evidence
- Service reports
- Maintenance documents
- Future asset-related documents

The system must keep files:

- Organized
- Secure
- Associated with the correct database record
- Accessible only to authorized users where appropriate
- Compatible with Supabase free-tier constraints

---

# 2. Storage Architecture

```text
Next.js Application
       ↓
Authentication
       ↓
Authorization / RLS / Storage Policies
       ↓
Supabase Storage
       ↓
File Object
```

Metadata:

```text
Supabase Storage
       ↓
storage path
       ↓
asset_documents
       ↓
PostgreSQL
```

The database stores the reference.

The Storage service stores the file.

---

# 3. Recommended Buckets

Use separate buckets based on privacy/access requirements.

Recommended:

```text
asset-images
maintenance-images
maintenance-documents
```

All should be private unless there is a specific reason for public access.

---

# 4. Bucket: `asset-images`

Purpose:

Store images associated with physical assets.

Examples:

```text
Projector P-104 photo
Laptop L-201 photo
Oscilloscope O-14 photo
```

Potential path:

```text
assets/<asset-id>/image/<generated-file-name>
```

Example:

```text
assets/8b.../image/asset-image-1.webp
```

Do not use the original filename as the authoritative storage path.

---

# 5. Bucket: `maintenance-images`

Purpose:

Store photographs related to maintenance.

Examples:

```text
Before repair
Damaged component
After repair
Testing result
```

Suggested path:

```text
maintenance/<maintenance-request-id>/images/<generated-file-name>
```

---

# 6. Bucket: `maintenance-documents`

Purpose:

Store documents related to maintenance.

Examples:

```text
Service report
Repair invoice
Replacement-part document
Inspection report
```

Suggested path:

```text
maintenance/<maintenance-request-id>/documents/<generated-file-name>
```

---

# 7. Why Private Buckets?

QR pages are public.

However, maintenance records and documents may contain:

- Technician information
- Internal repair notes
- Service documents
- Institutional information
- Images not intended for public access

Therefore:

```text
Public QR asset information
       ≠
Private storage
```

Keep private files protected.

---

# 8. Public Asset Images

There are two possible approaches.

## Option A — Private

Recommended initially.

Authorized users receive an authorized/signed URL when needed.

## Option B — Public

Only use this if the institution explicitly wants asset images to be public.

For the MVP:

> Prefer private storage unless the public QR page genuinely requires an image.

If the public page needs an image, create a deliberately public image path/bucket rather than making all maintenance storage public.

---

# 9. File Metadata Table

Use:

```text
asset_documents
```

for metadata.

Important fields:

```text
id
asset_id
maintenance_request_id
uploaded_by
bucket_name
storage_path
original_filename
mime_type
file_size_bytes
document_type
created_at
```

The database must not contain the binary file itself.

---

# 10. Asset vs Maintenance Attachment

A file may belong to:

### Asset

Example:

```text
Asset photo
```

Then:

```text
asset_id = asset
maintenance_request_id = NULL
```

### Maintenance request

Example:

```text
Repair photo
```

Then:

```text
asset_id = asset
maintenance_request_id = maintenance request
```

The maintenance file should normally have both relationships available so the asset history can find the document.

---

# 11. File Relationship Rules

For a maintenance document:

```text
maintenance_request_id
       ↓
maintenance_requests.asset_id
       ↓
asset_documents.asset_id
```

The metadata must not reference unrelated entities.

Example invalid state:

```text
asset_id = Projector P-104
maintenance_request_id = Laptop L-201's request
```

The application/database must reject inconsistent relationships.

---

# 12. Upload Workflow

Recommended:

```text
User selects file
       ↓
Client-side validation
       ↓
Authenticated request
       ↓
Server/storage authorization
       ↓
Validate file type
       ↓
Validate file size
       ↓
Generate safe storage path
       ↓
Upload to Supabase Storage
       ↓
Confirm upload succeeded
       ↓
Insert metadata row
       ↓
Return success
```

Do not create the metadata row before confirming the file upload unless the implementation has a deliberate cleanup/transaction strategy.

---

# 13. File Upload Failure

If Storage upload fails:

```text
No successful metadata record
```

should remain for the failed upload.

Show:

```text
Upload failed.
Please try again.
```

Do not expose raw Storage errors.

---

# 14. File Size Limits

Recommended MVP limit:

```text
10 MB per file
```

The exact limit can be changed according to:

- Supabase plan limits
- Campus requirements
- Expected file types

The application must enforce a maximum rather than accepting arbitrary large files.

---

# 15. Allowed MIME Types

Recommended:

## Images

```text
image/jpeg
image/png
image/webp
```

## Documents

```text
application/pdf
```

Do not allow arbitrary executable files.

Additional formats should only be enabled when there is a demonstrated requirement.

---

# 16. Client-Side File Validation

Before upload, validate:

```text
File exists
↓
MIME type allowed
↓
Size <= configured maximum
```

Display:

```text
Accepted:
JPG, PNG, WEBP, PDF

Maximum:
10 MB
```

Client validation improves UX.

It does not replace server/storage validation.

---

# 17. Server-Side File Validation

The server-side/storage boundary must independently verify:

- Authenticated user
- Authorized role
- Target entity
- File size
- File type
- Storage path
- Ownership/relationship

Do not trust:

```text
filename
mime type
user_id
asset_id
maintenance_request_id
```

from the browser without validation.

---

# 18. Safe File Names

Do not use:

```text
../../../something
```

or arbitrary user-provided filenames as storage paths.

Prefer generated names.

Example:

```text
<uuid>.<safe-extension>
```

Example:

```text
7a5c...91.webp
```

The original filename may be retained only as metadata:

```text
original_filename
```

---

# 19. Storage Path Design

Use predictable entity-scoped paths.

Example:

```text
asset-images/
  assets/
    <asset-id>/
      <uuid>.webp
```

Maintenance:

```text
maintenance-images/
  maintenance/
    <request-id>/
      <uuid>.jpg
```

Documents:

```text
maintenance-documents/
  maintenance/
    <request-id>/
      <uuid>.pdf
```

This makes organization and cleanup easier.

---

# 20. Do Not Use User IDs as the Only Security Boundary

Storage paths should help organize files.

They must not be treated as the sole authorization mechanism.

Security must come from:

```text
Authentication
+
Storage policies
+
Database relationships
+
Application authorization
```

---

# 21. Storage Policies

Supabase Storage has its own access-policy mechanism.

Do not assume PostgreSQL table RLS automatically makes Storage objects secure.

Configure Storage object policies separately.

Private buckets should require authorized access.

---

# 22. Asset Image Read Policy

For private asset images:

Authorized users may read images associated with assets they are allowed to access.

Examples:

```text
Admin → yes
Authorized technician → yes where needed
Student → allowed only if product policy permits
Public → no unless deliberately exposed
```

If public asset images are required, use a clearly public image strategy.

---

# 23. Maintenance Image Read Policy

Only authorized users should read maintenance images.

Recommended:

```text
Admin
Assigned technician
Authorized maintenance participants
```

Student/Staff reporters may see selected evidence if the product requires it, but should not automatically receive every internal repair file.

---

# 24. Maintenance Document Read Policy

More restrictive than images.

Recommended:

```text
Admin
Authorized technician
```

Other users should not automatically access:

```text
service reports
repair invoices
internal documents
```

---

# 25. Upload Permissions

Recommended:

### Asset images

```text
ADMIN
```

### Maintenance images

```text
Assigned TECHNICIAN
ADMIN
```

### Maintenance documents

```text
Assigned TECHNICIAN
ADMIN
```

These can be expanded later.

---

# 26. Delete Permissions

Avoid normal user deletion of operational evidence.

Recommended:

```text
ADMIN
```

may delete inappropriate files.

Technicians should generally not delete historical evidence after it becomes part of a resolved maintenance record.

If deletion is required, audit it.

---

# 27. File Replacement

For asset images:

```text
Old image
 ↓
New image uploaded
 ↓
Database points to new image
 ↓
Old image removed if appropriate
```

Do not delete the old file before confirming the new upload succeeded.

For maintenance evidence, prefer keeping historical files rather than replacing them.

---

# 28. Signed URLs

Private files can be accessed using temporary authorized URLs.

Conceptual flow:

```text
User requests file
      ↓
Authorization check
      ↓
Generate temporary access URL
      ↓
Browser downloads/displays file
```

Do not store a temporary signed URL permanently as the canonical database file reference.

Store:

```text
bucket_name
storage_path
```

---

# 29. Signed URL Expiration

Use a reasonably short expiration appropriate to the operation.

For example:

```text
5–15 minutes
```

for sensitive documents.

The exact value can be adjusted.

The application should generate access URLs when needed.

---

# 30. File Preview

For images:

```text
Preview inline
```

For PDFs:

```text
Open/download
```

Do not force the browser to render unsupported formats.

---

# 31. Asset Image UX

Asset admin page:

```text
Asset Image

[Current Image]

[Upload New Image]
```

If no image:

```text
No asset image uploaded.
```

After successful upload:

```text
Image uploaded successfully.
```

---

# 32. Maintenance Evidence UX

Maintenance request page:

```text
Evidence

Before repair
[image]

After repair
[image]

Service report
[PDF]

[Upload Evidence]
```

Display only files the current user is authorized to access.

---

# 33. File Metadata Display

Useful metadata:

```text
Original filename
Type
Size
Uploaded by
Uploaded at
```

Do not expose storage paths to normal users.

---

# 34. Storage Cleanup

Avoid orphaned files.

Potential orphan scenarios:

```text
File upload succeeds
↓
Database metadata insertion fails
```

The application should have a cleanup/recovery strategy.

For MVP, robust upload ordering plus administrative cleanup is acceptable.

Do not implement a complex distributed transaction system.

---

# 35. Orphan Metadata

Potential inverse scenario:

```text
Metadata exists
↓
File was deleted unexpectedly
```

The UI should handle missing files gracefully:

```text
File unavailable.
```

Do not crash the maintenance page.

---

# 36. Storage and Asset Retirement

Retiring an asset should NOT automatically delete its files.

Example:

```text
Asset retired
       ↓
Asset image retained
Maintenance documents retained
History retained
```

This preserves institutional history.

---

# 37. Storage and Maintenance Resolution

Resolving a maintenance request should not delete repair evidence.

Evidence becomes part of historical maintenance information.

---

# 38. Storage Quotas

Because the project targets free-tier services:

- Avoid unlimited uploads.
- Enforce file size.
- Restrict formats.
- Do not automatically duplicate files.
- Avoid storing generated copies unnecessarily.
- Optimize large images.

A future production deployment should monitor storage usage.

---

# 39. Image Optimization

For asset/maintenance images:

- Prefer compressed formats.
- Resize oversized images when practical.
- Avoid storing 20–50 MB original camera images.
- Keep sufficient resolution for identification/evidence.

A simple MVP may rely on client-side image compression before upload.

Do not introduce a dedicated image-processing service.

---

# 40. Storage Naming Strategy

Use generated object names.

Example:

```text
<uuid>.jpg
```

Metadata:

```text
original_filename = projector-front.jpg
```

This prevents collisions such as:

```text
image.jpg
image.jpg
image.jpg
```

---

# 41. Content Type Verification

Do not rely only on the filename extension.

Example:

```text
malicious.exe
```

renamed:

```text
photo.jpg
```

must not automatically be considered safe.

Use MIME/content validation appropriate to the implementation and platform capabilities.

---

# 42. Storage Security Anti-Patterns

Do NOT:

### Anti-pattern 1

Make every bucket public.

### Anti-pattern 2

Store service-role credentials in browser code.

### Anti-pattern 3

Use original filenames as security-sensitive object paths.

### Anti-pattern 4

Store signed URLs permanently as file identity.

### Anti-pattern 5

Allow arbitrary file types.

### Anti-pattern 6

Trust client-provided `uploaded_by`.

### Anti-pattern 7

Delete repair evidence when maintenance is resolved.

---

# 43. Storage Components

Suggested reusable components:

```text
FileUploader
FilePreview
FileList
AssetImageUploader
MaintenanceEvidenceUploader
DocumentViewer
DownloadFileButton
```

Suggested utilities:

```text
validateFile()
generateStoragePath()
getSignedFileUrl()
```

Names may be adapted to the final codebase.

---

# 44. Suggested Storage Utility Layer

Conceptually:

```text
src/lib/storage/
├── validation.ts
├── paths.ts
├── uploads.ts
└── urls.ts
```

Responsibilities:

### validation.ts

File type/size validation.

### paths.ts

Safe storage path generation.

### uploads.ts

Upload/delete operations.

### urls.ts

Authorized URL generation.

---

# 45. Database/Storage Transaction Boundary

A file upload and PostgreSQL metadata insert are separate operations.

Recommended sequence:

```text
1. Validate request.
2. Upload file.
3. Confirm upload.
4. Insert metadata.
5. If metadata insertion fails:
      cleanup uploaded file.
```

If cleanup fails, log it for administrative recovery.

---

# 46. Storage + RLS

The application has two related security systems:

```text
PostgreSQL RLS
       +
Supabase Storage policies
```

Both must be configured.

Example:

```text
maintenance_requests
    ↓
RLS determines user may access request
    ↓
Storage policy determines user may access evidence
```

Do not assume permission to the request automatically grants permission to the file unless the Storage policy explicitly implements the same relationship.

---

# 47. Storage Testing

Claude Code must test:

### Upload

- Authorized user can upload.
- Unauthorized user cannot.
- Unsupported type rejected.
- Oversized file rejected.

### Read

- Authorized user can view.
- Unauthorized user cannot.
- Public cannot access private maintenance files.

### Delete

- Admin can perform permitted cleanup.
- Normal users cannot delete historical evidence.

### Relationships

- Asset image belongs to correct asset.
- Maintenance evidence belongs to correct request.
- Invalid request/asset combination is rejected.

### Failure

- Upload failure does not create fake metadata.
- Missing file does not crash UI.

---

# 48. Example End-to-End Asset Image Flow

```text
Admin opens:
Projector P-104

↓
Clicks Upload Image

↓
Selects:
projector-front.jpg

↓
Client validates:
JPG
2.1 MB

↓
Supabase Storage:
asset-images/assets/<asset-id>/<uuid>.jpg

↓
Upload succeeds

↓
asset_documents row created

↓
Asset page displays image
```

---

# 49. Example End-to-End Maintenance Evidence Flow

```text
Technician opens:
MR-2026-0017

↓
Clicks Upload Evidence

↓
Selects:
repair-result.jpg

↓
Authorization:
Technician is assigned to request

↓
Validation:
JPG
3.2 MB

↓
Upload:
maintenance-images/maintenance/<request-id>/<uuid>.jpg

↓
Metadata saved

↓
Technician sees evidence

↓
Admin can access evidence

↓
Evidence remains after resolution
```

---

# 50. Storage Definition of Done

The storage subsystem is complete when:

- Required buckets are configured.
- Buckets are private unless intentionally public.
- Asset images can be uploaded.
- Maintenance images can be uploaded.
- Maintenance documents can be uploaded.
- File metadata is stored in PostgreSQL.
- Files are referenced by bucket/path.
- File size is validated.
- File type is validated.
- Storage paths are generated safely.
- Unauthorized users cannot access private files.
- Signed URLs are used where appropriate.
- Historical evidence is retained.
- Asset retirement does not delete historical files.
- Upload failures are handled.
- Orphan-file scenarios are considered.
- Storage policies are tested.
- No service-role secret reaches the browser.
