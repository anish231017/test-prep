# Vercel + Supabase Hosting Plan

This is the first hosted stage.

## What Runs Where

- Vercel serves the extractor and practice pages from `app/public`.
- Vercel serverless functions in `api/` handle questions, exams, auth checks, exports, papers, and MathJax assets.
- Supabase stores shared question rows, exam rows, editor/admin profiles, and uploaded question images.

## Required Vercel Environment Variables

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=question-assets
```

Never expose the service role key in browser code. Only serverless functions use it.

## Supabase Setup

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Create Supabase Auth users for each editor/admin.
3. Insert matching rows into `public.profiles`.

Example:

```sql
insert into public.profiles (id, email, role)
values
  ('AUTH_USER_UUID_HERE', 'admin@example.com', 'admin'),
  ('AUTH_USER_UUID_HERE', 'editor@example.com', 'editor');
```

Roles:

- `admin`: create exams, edit questions, delete questions, export all questions.
- `editor`: edit and delete questions, but cannot create exams or export all questions.

## Public vs Protected Data

- Public `/practice` calls `GET /api/questions` without a token.
- Unauthenticated question reads return only `status = 'published-ready'`.
- Authenticated editor/admin question reads return all statuses.
- Only admins can call `POST /api/exams`.

## Routes

- `/admin/extractor`: protected editor extractor UI.
- `/admin/exams`: admin exam management UI.
- `/practice`: public student practice UI.
- `/api/export/questions.json`: admin-only JSON export.
- `/api/export/questions.ndjson`: admin-only NDJSON export.

## Local Testing

Use Vercel's local runtime for this hosted stage:

```bash
npm run vercel:dev
```

The older `npm run dev` command still starts the legacy local JSON server.
