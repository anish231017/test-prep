# Collaborative Question Database

The app supports two backends:

- Local JSON: default, saves to `data/questions.json`.
- Supabase: shared database and storage for multiple editors.

## Setup Supabase

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `supabase/schema.sql`.
4. Copy `.env.example` to `.env`.
5. Fill:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET=question-assets`
6. Restart the app with `npm start`.

Check the active backend:

```text
http://localhost:5173/api/backend
```

## Migrate Existing Local Data

After adding `.env`, run:

```bash
npm run migrate:supabase
```

This reads `data/questions.json`, uploads local `/assets/...` files to Supabase Storage, rewrites their URLs to public Supabase URLs, and upserts all question rows into `public.questions`.

## How Multiple Editors Work

Each editor runs the app with the same `.env` values. When they save a question, the server writes to Supabase instead of local JSON. Everyone sees the same records from `/api/questions`.

For production, do not give editors the service role key directly. Deploy the server/admin app centrally and add user login/roles.
