# PhoneYa2 Agent Network — Complete Setup Guide

## What You Built

A full sales agent management system with 6 pages:

| Page | URL | Who uses it |
|---|---|---|
| `index.html` | `/agents/` | Public — anyone interested in applying |
| `apply.html` | `/agents/apply.html` | Applicants — 3-step form |
| `status.html` | `/agents/status.html` | Applicants — after submitting |
| `admin.html` | `/agents/admin.html` | You — manage everything |
| `agent.html` | `/agents/agent.html` | Approved agents — their dashboard |
| `verify.html` | `/agents/verify.html?id=PYA-0001` | Public — verify an agent is real |

---

## STEP 1 — Create Your Supabase Database (10 minutes)

Supabase is your free database. It stores all applications, agents, leads, and sales.

### 1a. Create account
1. Go to **supabase.com**
2. Click **Start your project** — sign up with GitHub or email
3. Click **New project**
4. Name: `phoneya2-agents`
5. Password: choose a strong one and save it
6. Region: pick any (closest to Zambia is West Europe or East US)
7. Click **Create new project** — wait 2 minutes

### 1b. Run the database setup
1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase-setup.sql` from this folder
4. Copy everything and paste it into the SQL editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned."

### 1c. Get your API keys
1. Click **Settings** (gear icon) in the left sidebar
2. Click **API**
3. Copy two things:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon public** key — long string starting with `eyJ...`

---

## STEP 2 — Connect Your Website to Supabase (2 minutes)

1. Open `config.js` in a text editor
2. Find these two lines near the top:

```javascript
const SB_URL  = 'YOUR_SUPABASE_URL';
const SB_KEY  = 'YOUR_SUPABASE_ANON_KEY';
```

3. Replace with your actual values:

```javascript
const SB_URL  = 'https://xxxxxxxxxxxx.supabase.co';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

4. Also change the admin password while you're there:

```javascript
const ADMIN_PASSWORD = 'your-new-secure-password';
```

Save the file.

---

## STEP 3 — Deploy to Vercel (5 minutes)

You have two options:

### Option A — As a subfolder of your existing PhoneYa2 site
1. In your GitHub repo (`BLESSTech-X/BlessTech-X-Accessories`), create a folder called `agents`
2. Upload all the files from this folder into `agents/`:
   - `index.html`
   - `apply.html`
   - `status.html`
   - `admin.html`
   - `agent.html`
   - `verify.html`
   - `config.js`
   - `shared.css`
3. Commit to GitHub
4. Vercel rebuilds automatically
5. Access at: `https://phoneya2-accessories.vercel.app/agents/`

### Option B — As a separate Vercel project (recommended)
1. Create a new GitHub repository: `PhoneYa2-Agent-Network`
2. Upload all files from this folder to the root of that repo
3. Go to **vercel.com** → **Add New Project**
4. Import the new repo
5. Click **Deploy** — no build settings needed (it's all HTML)
6. Access at: `https://your-project-name.vercel.app`

---

## STEP 4 — Test Everything (15 minutes)

### Test 1: Application flow
1. Go to your landing page (`index.html`)
2. Click **Apply Now**
3. Fill in the 3-step form with your own details
4. Submit
5. You should see your Application ID (e.g. `PY-2026-0001`)
6. Click **Download PDF** — a PDF should download
7. Click **Send via WhatsApp** — WhatsApp should open with a pre-written message

### Test 2: Admin panel
1. Go to `admin.html`
2. Enter your admin password
3. You should see your test application in the list
4. Click on it to open the detail view
5. Click **Approve**
6. Confirm — an agent account is created automatically
7. Go to the **Active Agents** tab — your agent should appear

### Test 3: Agent dashboard
1. Go to `agent.html`
2. Enter the Agent Code from the admin panel (e.g. `PY001`)
3. You should see your dashboard with your referral link
4. Click **Copy Link** — link copies to clipboard
5. Go to **Products** tab — all products with promo messages
6. Click **Copy Promo** on any product — message copies

### Test 4: Verification
1. Go to `verify.html?id=PYA-0001`
2. The agent's verified details should appear

---

## STEP 5 — Customise Your Products and Commission Rates

Open `config.js` and find the `CONFIG.products` array. Edit the products and commission amounts to match what you actually sell:

```javascript
products: [
  { name: 'Clear Slim Case',      price: 85,  commission: 15, category: 'Phone Case' },
  { name: '20W USB-C Charger',    price: 150, commission: 20, category: 'Charger' },
  // Add your actual products here
],
```

---

## How to Approve an Agent (Day-to-Day)

1. Go to `admin.html` and log in
2. Check the **Applications** tab (bookmark this page)
3. Click a pending application
4. Read their details — does this person seem genuine?
5. Click **Approve** → **Confirm Approval**
6. Their Agent ID and Code are created automatically
7. Click **Message Applicant** — WhatsApp opens with their details pre-filled
8. Send them their Agent Code so they can log into `agent.html`

---

## How to Record a Sale

When an agent refers a customer and PhoneYa2 confirms the sale:

1. Go to `admin.html` → **Sales** tab
2. Add the sale manually (or build a button — coming in V2)
3. The agent's commission automatically shows on their dashboard

In V2 this will be automated — agents will register the lead, you confirm the sale, commission calculates itself.

---

## What Each File Does

```
agents/
├── index.html          Landing page — hero, how it works, commission table
├── apply.html          3-step application form with validation
├── status.html         Post-submission: Application ID + PDF + WhatsApp
├── admin.html          Admin dashboard: applications, agents, leads, sales, leaderboard
├── agent.html          Agent dashboard: stats, referral link, products, leads, commission
├── verify.html         Public verification: confirm an agent is legitimate
├── config.js           Supabase keys, commission rates, products — edit this
├── shared.css          All shared styles (never need to edit this)
└── supabase-setup.sql  Run once in Supabase SQL editor
```

---

## V2 Features (Build Next)

- [ ] Email notifications on application received / approved
- [ ] Automatic commission calculation when admin confirms a sale
- [ ] Agent certificate PDF (downloadable from agent dashboard)
- [ ] WhatsApp API integration (automatic approval messages)
- [ ] Monthly leaderboard reset + top agent recognition post
- [ ] Referral tracking on the PhoneYa2 shop (read `?ref=PY001` from URL)
- [ ] Agent photo/avatar upload

---

## Referral Tracking (Add to PhoneYa2 Shop)

Add this snippet to your `index.html` on the PhoneYa2 shop to capture referral codes:

```html
<script>
// Capture agent referral code from URL
const ref = new URLSearchParams(window.location.search).get('ref');
if (ref) localStorage.setItem('py2_ref', ref.toUpperCase());
</script>
```

Then when a customer orders, you can read `localStorage.getItem('py2_ref')` to know which agent sent them.

---

## Security Notes

- The admin password is checked in JavaScript — it's simple but adequate for V1
- For V2, use Supabase Auth for proper admin login
- The Supabase anon key is public by design — it can only do what your RLS policies allow
- Never commit your `config.js` with real keys to a public GitHub repo — use Vercel environment variables instead

---

## Support

If something breaks, check:
1. **Supabase SQL ran correctly** — go to Table Editor and confirm you see the tables
2. **config.js has correct URL and key** — copy again from Supabase Settings → API
3. **Browser console** (F12 → Console) — error messages are shown there
4. **RLS policies** — if data won't save, the policies from the SQL setup may not have run

Contact Barack on WhatsApp: +260 979 603 741
