# Deploying Frontend to GitHub + Netlify

**Why Netlify and not Vercel?**
Vercel's free (Hobby) plan explicitly restricts usage to "non-commercial personal use only."
Netlify's free plan has no such restriction — commercial use is allowed on all tiers.

> **Note on Netlify's pricing (as of September 2025):**
> Netlify switched to a credit-based model. The free plan gives **300 credits/month**.
> Each production deploy costs 15 credits (~20 free deploys/month). Bandwidth and
> web requests also consume credits but at very low rates for a typical attendance app.
> If you exceed the limit, your site pauses until the next billing cycle — no surprise charges.

---

## Architecture after deployment

```
Browser
  │
  ├─► Netlify  (frontend — commercial use allowed ✓)
  │     ├── index.html        — main attendance app
  │     └── scanner.html      — QR scanner (camera works here ✓)
  │
  └─► Google Apps Script  (backend — unchanged)
        └── doPost endpoint   — processes QR scans, attendance, geofence
```

The QR scanner opens as a **separate page on Netlify** (`/scanner.html`), completely
outside Google's iframe restrictions. Camera permission works normally.

---

## Prerequisites

- A **GitHub** account — https://github.com
- A **Netlify** account — https://app.netlify.com (free, sign in with GitHub)
- Node.js 18+ installed locally
- Your GAS project already deployed as a Web App (Step 1)

---

## Step 1 — Get your GAS Web App URL

1. Open your GAS project at https://script.google.com
2. Click **Deploy → Manage deployments**
3. If no deployment exists yet, click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** ← required for the scanner's fetch() calls to work
4. Click **Deploy** and copy the URL:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

> **Important:** Every time you push new `.gs` code via `clasp push`, you must
> create a **new deployment** (not just save) for the changes to go live.

---

## Step 2 — Set your GAS backend URL in index.html

Open `index.html` in your editor. Near the top, find:

```html
<meta name="gas-backend-url" content="REPLACE_WITH_YOUR_GAS_WEB_APP_URL">
```

Replace the placeholder with your actual URL from Step 1:

```html
<meta name="gas-backend-url" content="https://script.google.com/macros/s/AKfycb.../exec">
```

Save the file.

---

## Step 3 — Push the project to GitHub

### 3a. Create a new GitHub repository

1. Go to https://github.com/new
2. Name it e.g. `attendance-system`
3. Visibility: **Private** (recommended — contains your app code)
4. Do **not** tick "Add README", ".gitignore", or "license" — the project already has these
5. Click **Create repository**
6. Copy the repository URL shown, e.g.:
   ```
   https://github.com/YOUR_USERNAME/attendance-system.git
   ```

### 3b. Commit and push

Open a terminal in your project folder and run these commands one at a time:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/attendance-system.git
git push -u origin main
```

> If a `.git` folder already exists (you've used git before in this project),
> skip `git init` and start from `git add .`

---

## Step 4 — Deploy to Netlify

### 4a. Import the GitHub repository

1. Go to https://app.netlify.com
2. Click **Add new site → Import an existing project**
3. Click **GitHub** and authorize Netlify if prompted
4. Find and select your `attendance-system` repository

### 4b. Confirm build settings

Netlify reads `netlify.toml` automatically. The settings should already be filled in:

| Setting | Value |
|---|---|
| Branch to deploy | `main` |
| Build command | `npm run build` |
| Publish directory | `dist` |

If anything is blank, fill it in manually.

### 4c. Deploy

Click **Deploy site**.

Netlify will:
1. Install dependencies (`npm install`)
2. Run the build (`npm run build`) — bundles the app and copies `scanner.html` to `dist/`
3. Publish the `dist/` folder to a global CDN

After ~1 minute you get a URL like:
```
https://attendance-system-abc123.netlify.app
```

---

## Step 5 — Test the deployment

1. Open your Netlify URL in a browser
2. Log in with your admin or employee credentials
3. On the login page, click **Open QR Scanner**
4. A new tab opens at:
   ```
   https://your-app.netlify.app/scanner.html
   ```
5. The browser asks for camera permission — click **Allow**
6. The QR scanner starts — point it at an employee QR code
7. Attendance is recorded in Google Sheets ✓

The scanner page on Netlify has no Google iframe restrictions, so camera permission
works exactly like any normal website.

---

## Step 6 — Set a custom domain (optional)

1. In Netlify dashboard → your site → **Domain management → Add custom domain**
2. Enter your domain e.g. `attendance.yourcompany.com`
3. Follow Netlify's DNS instructions (add a CNAME record at your domain registrar)
4. Netlify provisions HTTPS automatically via Let's Encrypt

---

## How future updates work

Whenever you make code changes:

```bash
git add .
git commit -m "describe your change"
git push
```

Netlify detects the push and redeploys automatically within ~1 minute.
Each deploy costs 15 credits (free plan has 300/month = ~20 deploys/month).

For backend (GAS) changes, use `clasp push` then create a new deployment in GAS editor.

---

## Troubleshooting

### Camera still blocked
- Confirm the address bar shows `https://your-app.netlify.app/scanner.html`
- It must **not** be a `script.google.com` URL
- On mobile: phone Settings → Apps → your browser → Permissions → Camera → Allow

### "No backend configured" or scan does nothing
- Check that `<meta name="gas-backend-url">` in `index.html` has the correct GAS URL
- Confirm the GAS Web App is deployed with access set to **Anyone**
- Open browser DevTools → Network tab → look for a failed POST request to the GAS URL

### CORS error in browser console
- In GAS editor: **Deploy → Manage deployments → New deployment** (not just save)
- Confirm `doPost` in `Code.gs` returns:
  ```javascript
  ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON)
  ```

### Build fails on Netlify
- Check the deploy log for the specific error
- Common fix: set Node.js version to 18
  - Netlify: Site → **Environment variables** → add `NODE_VERSION` = `18`

### Site paused / credits exhausted
- Free plan: 300 credits/month. Each deploy = 15 credits (~20 deploys/month)
- Bandwidth and web requests use very few credits for a typical attendance app
- If paused, the site resumes automatically at the start of the next billing cycle
- To avoid this, upgrade to the Personal plan ($9/month) for 1,000 credits/month

---

## Summary

| What | Where |
|---|---|
| Main app | `https://your-app.netlify.app` |
| **QR Scanner (camera works ✓)** | `https://your-app.netlify.app/scanner.html` |
| Backend (GAS — unchanged) | `https://script.google.com/macros/s/.../exec` |
| Commercial use | ✓ Allowed on Netlify free plan |
