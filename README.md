# Coffee memories — coffee journal

A mobile-first coffee journal built with React, TypeScript, Vite, and optional Supabase sync.

## Run locally

```sh
npm install
npm run dev
```

Without Supabase settings, the app works in preview mode and stores its entries in this browser's local storage. This mode is not shared between devices.

## Connect Supabase

1. Create a Supabase project.
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable (or legacy anon) key from the Supabase project settings.
4. Restart the Vite dev server.

The SQL configures public read, insert, update, and delete access for the `anon` role, along with a public photo bucket. **Anyone who finds the app URL can view, change, or delete all diary entries and photos.** Do not store private information or reuse the project for sensitive data. Never put the Supabase service-role key in the frontend.

## Build and deploy to GitHub Pages

```sh
npm run build
```

The GitHub Actions workflow builds the site and publishes `dist/` to GitHub Pages when changes are pushed to `main`. The repository should be named `coffee-memories`; the site will be available at `https://<username>.github.io/coffee-memories/`. In the repository settings, choose **Settings → Pages → GitHub Actions** as the publishing source.

If Supabase is connected, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository Actions variables before building.

## Backup

Use **Export** in My Collection to download a ZIP with `coffee-memories.json` and the available coffee photos. Keep the archive somewhere separate from the hosted project. Importing an archive is not part of this first version.
