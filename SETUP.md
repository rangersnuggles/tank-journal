# Tank Journal — Setup Guide

---

## 1. Check Node.js

Open Terminal (Mac: Spotlight → "Terminal") and run:

```bash
node -v
```

If you see `v18.x.x` or higher, you're good.
If not, install from https://nodejs.org (grab the LTS version).

---

## 2. Scaffold the Next.js project

```bash
npx create-next-app@14 tank-journal --no-typescript --no-tailwind --no-eslint --app
cd tank-journal
npm install @supabase/supabase-js
```

---

## 3. Copy in project files

Replace / create the following files in your `tank-journal` folder:

```
tank-journal/
├── app/
│   ├── layout.jsx              ← replace generated file
│   ├── page.jsx                ← replace generated file
│   └── api/
│       ├── entries/
│       │   ├── route.js
│       │   └── [id]/route.js
│       └── inhabitants/
│           ├── route.js
│           └── [id]/route.js
├── lib/
│   └── supabase.js             ← create lib/ folder
├── .gitignore                  ← provided
└── schema.sql                  ← for Supabase only, not deployed
```

---

## 4. Set up Supabase

1. Go to https://supabase.com → your project → **SQL Editor**
2. Paste the full contents of `schema.sql` and click **Run**
3. Go to **Settings → API**
4. Copy your **Project URL** and **anon/public key**

---

## 5. Add environment variables locally

Create `.env.local` in the project root (this file is git-ignored — never commit it):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 6. Test locally

```bash
npm run dev
```

Open http://localhost:3000 and confirm entries are saving to Supabase.

---

## 7. Push to GitHub

### First time — create the repo

1. Go to https://github.com/new
2. Name it `tank-journal`, set it to **Private**, click **Create repository**
3. Back in Terminal, from inside your `tank-journal` folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tank-journal.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## 8. Deploy to Vercel via GitHub

1. Go to https://vercel.com → **Add New Project**
2. Click **Import** next to your `tank-journal` repo
3. Vercel will auto-detect Next.js — leave defaults as-is
4. Before clicking Deploy, go to **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your anon key
5. Click **Deploy**

Your app will be live at `https://tank-journal-xxx.vercel.app`.

---

## 9. Future updates (the ongoing workflow)

Whenever you make changes to any file:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

That's it — Vercel detects the push and automatically redeploys. Usually live within 30 seconds.

---

## Troubleshooting

**"Failed to load data"** — double-check `.env.local` values match Supabase exactly. No trailing spaces.

**Blank page on Vercel** — confirm env vars are set in Vercel dashboard under Settings → Environment Variables, then trigger a redeploy.

**"Cannot find module @supabase/supabase-js"** — run `npm install` again.

**Git asks for a password** — GitHub no longer accepts passwords via CLI. Generate a Personal Access Token: GitHub → Settings → Developer Settings → Personal Access Tokens → Generate new token (classic), give it `repo` scope, use that as your password.
