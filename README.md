# Reviewer Maker (PWA)

Plain HTML/CSS/JS. No build step.

Files: `index.html`, `style.css`, `app.js`, `manifest.json`, `service-worker.js`, `icons/`

## Run on your PC
1. Install VS Code, then the **Live Server** extension (Ritwick Dey).
2. File > Open Folder > this folder. Right-click `index.html` > **Open with Live Server**.
3. (Alternative) in a terminal here: `python -m http.server 8000`, then open http://localhost:8000
   (Opening index.html by double-click works, but offline/install features need http://localhost or https.)

## Publish on GitHub Pages
1. Create a GitHub account, then **New repository** (public), e.g. `reviewer-maker`.
2. Upload ALL files and the `icons` folder (**Add file > Upload files**, drag them in, Commit). `index.html` must be at the top level.
3. **Settings > Pages > Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`, Save.
4. After ~1 minute your app is at `https://YOUR-USERNAME.github.io/reviewer-maker/`.

## Install on iPhone
1. Open that URL in **Safari** (must be Safari).
2. Tap **Share** > **Add to Home Screen** > **Add**.
3. Open it from the home screen icon. Open it once online; after that it works offline.

## Updating later
After changing files, bump `CACHE_VERSION` in `service-worker.js` (e.g. `v1.0.1`) and re-upload. The app shows an **Update** banner.

## Moving data between devices
💾 (top right) > **Export** on one device, send the file over, **Import** on the other.
