# Deploy Playbook — Scorpius → scorpius.uz

> **One source of truth for shipping the website.** Every problem we hit during the hackathon
> + the exact fix. Read top to bottom before your first deploy. Keep this open while you
> run `vercel --prod`.

---

## 1. The happy path (when nothing is wrong)

```powershell
# 1. Make sure you're on main and synced
git status                      # working tree clean? if not, commit or stash
git pull --rebase               # get teammates' changes

# 2. Build locally first (catches errors before burning a Vercel slot)
npm run build                   # must exit 0
npx tsc --noEmit                # type-check (catches Next 16 async searchParams issues)

# 3. Deploy
vercel --prod                   # ~50-90 sec; watch for "Aliased: https://scorpius.uz"

# 4. Verify
curl.exe -sSI https://scorpius.uz | Select-Object -First 3
# expect: HTTP/1.1 200 OK
```

If all four steps work → done. If any breaks → see §3 below.

---

## 2. The 10 gotchas, in priority order

### 2.1 — `vercel.json` MUST exist with `framework: nextjs`

**Symptom:** every route returns `404 NOT_FOUND` even though `npm run build` succeeded on Vercel. Only `/public/*` static files serve.

**Why:** Without an explicit framework declaration, Vercel auto-detect treats the project as a static site, serves `/public` only, and ignores all App Router routes.

**Fix:** the file at `D:\GDG\vercel.json` exists with:
```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "npm install",
  "outputDirectory": ".next"
}
```
**Never delete it.** If a teammate's PR removes it, REJECT the PR.

### 2.2 — Firebase Admin must NOT initialize at module load

**Symptom:** `next build` crashes on Vercel with `Service account object must contain a string "project_id" property` during "Collecting page data" for `/api/generate-image`.

**Why:** Next.js 16 statically analyzes API routes at build time. If `lib/firebase/admin.ts` calls `cert()` at module top-level, the build runs that code without env vars and crashes.

**Fix:** `lib/firebase/admin.ts` uses a **lazy Proxy** (already in place). First call to any method initializes Firebase Admin at request time, not build time. Don't refactor it back to eager init.

### 2.3 — Env vars pushed via PowerShell get BOM + CRLF

**Symptom:** `/api/waitlist` returns 500 with `Metadata string value "projects/<BOM>scorpius-edu\r\n/databases/(default)" contains illegal characters`.

**Why:** `vercel env add` on Windows PowerShell injects a UTF-8 BOM (`﻿`) and CRLF newlines into the env var value. Firebase Admin rejects those.

**Two fixes (we have both):**

A) **Code-side sanitizer** in `lib/firebase/admin.ts` strips BOM + CR + LF + whitespace from `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. This is a workaround that always works.

B) **Permanent fix** — re-push env vars from a non-Windows shell (macOS, Linux, WSL, or git-bash) so they're clean. The sanitizer becomes a belt-and-suspenders fallback. To re-push from WSL/git-bash:
```bash
cat .env.local | while IFS='=' read -r k v; do
  [ -z "$k" ] || [[ "$k" == \#* ]] && continue
  echo "$v" | vercel env add "$k" production
done
```

### 2.4 — Deployment Protection must be OFF

**Symptom:** direct deployment URLs return **401 + SSO login page**; aliased custom domain (scorpius.uz) returns **404 NOT_FOUND** (Vercel edge refuses to route protected projects).

**Why:** "Vercel Authentication" / "Password Protection" / "Trusted IPs" — any of these on the project blocks public access.

**Fix:** https://vercel.com/ghosts-projects-0d9af52d/scorpius/settings/deployment-protection → set **Vercel Authentication = Disabled** → Save. Check the other protection toggles too.

### 2.5 — `.vercelignore` to keep uploads under 50 MB

**Symptom:** `vercel --prod` upload size = 191 MB → network ECONNRESET halfway through → deploy stuck in "UNKNOWN" status.

**Why:** Without `.vercelignore`, Vercel uploads everything except `node_modules`. Big things that sneak in: `.tpl-stage/`, `.survey-stage/`, `.deck-check/`, `.zipstage/`, the 49 MB BWAI template PPTX, etc.

**Fix:** `D:\GDG\.vercelignore` already exists:
```
.tpl-stage/
.survey-stage/
.deck-check/
.zipstage/
BWAI 2026 Master Deck - Template.pptx
Scorpius-Day2.zip
Scorpius-Checkpoint-2.zip
*.local.md
data/
```
**Add to it** whenever you create a new big throwaway dir.

### 2.6 — DNS at EKSIZ must point to Vercel

**Symptom:** scorpius.uz returns connection refused or the old hosting page.

**Why:** EKSIZ DNS A record points to a different IP than Vercel.

**Fix:** In EKSIZ DNS panel:
- `scorpius.uz` A → `76.76.21.21` (or the newer `216.198.79.1` if Vercel recommends it)
- `www.scorpius.uz` CNAME → `cname.vercel-dns.com.` (or leave alias of `scorpius.uz.`)
- **Keep** `mail.`, `ftp.`, `webmail.` A records pointing to `45.138.159.4` (email infra — don't touch)
- **Keep** MX, SPF (TXT), DMARC (TXT) records

Propagation: 5–30 min for `.uz` domains. Verify with:
```powershell
Resolve-DnsName scorpius.uz -Type A -Server 8.8.8.8
```

### 2.7 — Domain must be in the team scope, not personal scope

**Symptom:** `vercel domains add scorpius.uz` says "Success" but `vercel alias set` says "You don't have access to the domain".

**Why:** The domain got attached to your personal Vercel account (`murodjontolipovdev-9211`) instead of the team scope (`ghosts-projects-0d9af52d`) where the project lives.

**Fix (dashboard only):**
1. https://vercel.com/account/domains → find `scorpius.uz`
2. Click → **"Move to a different team"** → choose `ghosts-projects-0d9af52d`
3. Go to https://vercel.com/ghosts-projects-0d9af52d/scorpius/settings/domains → click **"Add"** → enter `scorpius.uz` → confirm

### 2.8 — Local `.next` cache after pulling teammate's branch

**Symptom:** `/learn` returns 404 in local dev right after `git pull`. Other routes work.

**Why:** Next.js dev caches old route handlers. After a merge brings in new routes, the cache can give stale 404s.

**Fix:**
```powershell
# Stop dev server (Ctrl+C), then:
Remove-Item .next -Recurse -Force
npm run dev
```

### 2.9 — Network ECONNRESET mid-deploy

**Symptom:** `vercel --prod` aborts with `Error: request to api.vercel.com ... failed, reason: read ECONNRESET`.

**Why:** Vercel API connection drops, especially on large uploads or slow networks (Tashkent latency).

**Fix:** Just retry. If it keeps failing:
1. Check `.vercelignore` — keep upload < 30 MB (§2.5)
2. Try `--force` to invalidate build cache and rebuild fresh
3. Wait 60 seconds and retry — Vercel API blips happen

### 2.10 — Browser cache after deploy

**Symptom:** you visit scorpius.uz right after deploy, but old version still shows.

**Why:** Browser cached HTML + JS from the previous build.

**Fix:** **Ctrl + Shift + R** (hard refresh) or open in incognito. For demo day, open incognito tabs from the start.

---

## 3. Decision tree — "deploy looks wrong, what do I do?"

```
Did `vercel --prod` complete?
├─ No → see §2.9 (ECONNRESET) — retry
└─ Yes → curl.exe https://scorpius.uz returns?
         ├─ 401 → §2.4 Deployment Protection
         ├─ 404 on every route → §2.1 vercel.json OR §2.4 protection still on
         ├─ 404 on some routes only → stale prod alias, redeploy with --force
         ├─ 500 on /api/* routes → §2.2 Firebase Admin init OR §2.3 BOM in env vars
         ├─ 200 but old content → §2.10 browser cache
         └─ 200 with new content → DONE
```

---

## 4. Pre-deploy checklist (60 seconds)

Run these BEFORE `vercel --prod`:

- [ ] `git status` → clean (or you know exactly what's uncommitted)
- [ ] `git pull --rebase` → no merge conflicts
- [ ] `npm run build` → exits 0 locally
- [ ] `npx tsc --noEmit` → no type errors
- [ ] `git log --oneline -3` → confirm the commit you expect to ship is the top one
- [ ] No staging dirs in repo root: `ls -d .tpl-stage .survey-stage .deck-check 2>/dev/null` should print nothing
- [ ] `.env.local` exists locally (not committed)
- [ ] Vercel CLI logged in: `vercel whoami` returns `murodjontolipovdev-9211`

---

## 5. Post-deploy checklist (60 seconds)

After `vercel --prod` finishes with `Aliased: https://scorpius.uz`:

```powershell
# 1. Hit the key routes
foreach ($p in '/', '/learn', '/learn?subject=physics', '/learn/lesson?topic=brachistochrone', '/learn/lesson?topic=broun', '/gdg', '/api/waitlist') {
  $r = curl.exe -sSI ('https://scorpius.uz' + $p) 2>&1
  Write-Host "$p -> $($r -split [char]10)[0]"
}
```

All should return `HTTP/1.1 200 OK`.

- [ ] `https://scorpius.uz` loads in incognito Chrome
- [ ] Hard-refresh (Ctrl+Shift+R) shows newest title
- [ ] `/gdg` form submits a test entry — counter increments
- [ ] `/learn?subject=physics` shows Fizika constellation
- [ ] `/learn/lesson?topic=broun` shows the Broun lesson (not 404)
- [ ] Scan the QR on phone → opens scorpius.uz/gdg → form works

---

## 6. Rollback (if a deploy ships a broken feature)

Find the last known-good deployment:
```powershell
vercel ls
```

Find the row before the bad one, copy its URL (e.g. `scorpius-rbs3pt0va-...`):
```powershell
vercel rollback scorpius-rbs3pt0va-ghosts-projects-0d9af52d.vercel.app
```

This points `scorpius.uz` back to the previous deployment in ~5 seconds. **Then** debug the broken commit locally before re-deploying.

---

## 7. Recurring task — "I just changed code, ship it"

```powershell
# 1. Commit
git add <files>
git commit -m "feat: …"
git push                                # optional but recommended

# 2. Deploy
vercel --prod

# 3. Sanity-check
curl.exe -sSI https://scorpius.uz | Select-Object -First 1
```

If it's just a content/docs change (no code), `git push` alone is enough — Vercel auto-deploys from `main` IF you've connected the GitHub repo to the project. We haven't yet (Settings → Git → Connect). Manual `vercel --prod` is the source of truth today.

---

## 8. Known issues we have NOT yet fixed (for after the hackathon)

- **Env vars carry BOM** — masked by code sanitizer (§2.3). Re-push clean from WSL/macOS.
- **`/api/health` returns 500** — uses Gemini (blocked in UZ). Switch to OpenAI or remove the health check.
- **No GitHub → Vercel auto-deploy** — every deploy is manual `vercel --prod`. Connect the repo in Vercel project settings to enable preview branches + auto-deploy on merge to main.
- **No staging environment** — we deploy straight to prod every time. Tomorrow: split into `main` → prod and `staging` branch → preview deploys.

---

## 9. Helpful commands

```powershell
# Show last 10 deployments + their status
vercel ls

# See full build log of the most recent deploy
vercel logs scorpius-<latest-hash>-ghosts-projects-0d9af52d.vercel.app

# List + edit env vars
vercel env ls production
vercel env add <NAME> production
vercel env rm <NAME> production

# Re-trigger a previous deployment (no rebuild)
vercel redeploy scorpius-<hash>-ghosts-projects-0d9af52d.vercel.app

# Verify domain is healthy from outside (no Vercel CLI)
curl.exe -sSI https://scorpius.uz
Resolve-DnsName scorpius.uz -Type A -Server 1.1.1.1
```

---

**Bookmark this file. Every deploy problem is in §2 with the fix.**
