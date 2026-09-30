# Cramview (PWA)

Plain HTML/CSS/JS. No build step.

Files: `index.html`, `style.css`, `app.js`, `config.js` (generated from `.env`), `scripts/make-config.js`, `manifest.json`, `service-worker.js`, `vercel.json`, `icons/`, `supabase/schema.sql`

## Run on your PC
1. Install VS Code, then the **Live Server** extension (Ritwick Dey).
2. File > Open Folder > this folder. Right-click `index.html` > **Open with Live Server**.
3. (Alternative) in a terminal here: `python -m http.server 8000`, then open http://localhost:8000
   (Opening index.html by double-click works, but offline/install features need http://localhost or https.)

## Set up cloud sync (Supabase) — optional
Without this the app works fully offline and keeps data on each device.

1. Create a free project at https://supabase.com (New project; save the database password somewhere).
2. **SQL Editor > New query**, paste all of `supabase/schema.sql`, click **Run**.
3. **Project Settings > API**: copy the **Project URL** and the **anon public** key into the `.env` file:
   ```
   SUPABASE_URL=https://your-ref.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```
   then run `node scripts/make-config.js` (needs Node.js). It writes `config.js`, which is what the app reads.
   `.env` is git-ignored. (The anon key is meant to be public. Row-level security in the SQL file keeps each
   account's data private. Never use the `service_role` key here.)
4. **Authentication > Providers > Email**: for the simplest setup turn **Confirm email** off.
   If you leave it on, "Create account" sends a confirmation link first; click it, then sign in.
5. Open the app > ☁️ (top right) > create an account. Sign in with the same account on your other device.
   Changes sync automatically when you're online; **Sync now** forces it.

How it behaves: the app always reads and writes the local copy, so it works offline. When online it pulls newer
changes, then pushes yours. If the same item was edited on two devices, the most recent edit wins.
Deleting something deletes it everywhere. Signing out keeps the data on that device.

## Deploy on Vercel
1. Push this folder to GitHub (your repo, e.g. `cramview`).
2. https://vercel.com > **Add New > Project** > import the repo.
3. Framework Preset: **Other** (`vercel.json` already sets the build command). Before deploying, add two
   **Environment Variables**: `SUPABASE_URL` and `SUPABASE_ANON_KEY` (same values as your `.env`). Click **Deploy**.
   (Changing them later needs a redeploy.)
4. Every `git push` to `main` redeploys. Your link looks like `https://cramview.vercel.app`.
5. (If you use Supabase) **Authentication > URL Configuration** in Supabase: set **Site URL** to your Vercel link.

## Install on iPhone
1. Open your Vercel link in **Safari** (must be Safari).
2. Tap **Share** > **Add to Home Screen** > **Add**.
3. Open it from the home screen icon. Open it once online; after that it works offline.

## Updating later
After changing any cached file, bump `CACHE_VERSION` in `service-worker.js` (e.g. `v1.1.1`) and push. The app shows an **Update** banner.

## Attaching files
On a reviewer's page tap **+ Add files** (PDF, PowerPoint, Word, anything up to 50 MB). Files are kept on the device you add them on: they are **not** included in cloud sync or the JSON export. PDFs and images open in the browser; everything can be downloaded. For `.docx`, `.pptx`, `.txt` and `.md` files, **Text → notes** copies the text into the reviewer's notes (old `.doc`/`.ppt` files, scanned PDFs and PDF text extraction are not supported).

## Random quizzes and auto-generated questions
**Quiz Mode and Exam Mode build a fresh random set each time.** On the setup screen choose where the questions come from (**Random**, **Saved**, or **Mixed**), pick one or more question types (multiple choice, true/false, identification, enumeration) and how many. Random questions are made on your device from the reviewer's notes plus any attached `.docx`, `.pptx`, `.txt`, `.md` files. **New random set** on the results screen makes another one.

To keep generated questions, tap **Auto-generate from notes & files** on a reviewer (also on the Questions and Flashcards pages), review the preview, untick what you don't want, and add them (optionally with flashcards).

It uses simple rules, not AI. It works best when notes are full sentences, `Term: meaning` lines, or a heading followed by bullet lists (for enumeration). Answers are picked automatically, so skim them before relying on them. Enumeration questions need every item listed, in any order.

## Moving data without an account
☁️ (top right) > **Export** on one device, send the file over, **Import** on the other.
