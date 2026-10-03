# Mukkani CRM

CRM and daily dashboard for Mukkani, a healthy food box business in Trichy.
One path for every customer: Lead, Follow-up, Trial box, Trial result, Monthly package (regular box).
It replaces WhatsApp coordination between Sales and the Kitchen.

## Roles

| Role | Can do |
|---|---|
| Admin | Everything: overview and reports, users, regions, plus all sales screens and the kitchen view |
| Sales | Leads, follow-ups, customers, trial and regular boxes, location links |
| Kitchen manager | View only. Count tiles, today's boxes (each marked Trial box or Regular box), monthly customers. No buttons. |

## What happens automatically

- A lead set to **Trial Box Requested** (from the lead panel or a logged call) creates a trial box, assigns it to the kitchen manager and shows on the kitchen screens.
- Sales moves a trial along. Delivered or Trial active sets the lead to Trial Box Active. Completed asks sales to record the result.
- **Converted** creates a monthly package (regular box). Kitchen counts and reports update on the next page load.
- **Location link**: sales sends a link on WhatsApp or SMS. The customer taps "Share my location", and the phone's GPS pin, the address (from OpenStreetMap) and the nearest region are saved to their profile.

## Stack

Next.js 16 (App Router, server actions), TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL. Login is username and password with a signed cookie. No paid services.
Design: Figma file "Mukkani CRM Dashboard".

## Run it on your computer

You need Node.js 22 and PostgreSQL.

```
cp .env.example .env            # set DATABASE_URL and SESSION_SECRET
npm install
npx prisma migrate deploy
SEED_DEMO=1 npm run db:seed     # demo data and logins below
npm run dev
```

Demo logins (only with SEED_DEMO=1): admin / admin123, divya / sales123, karthik / sales123, kitchen / kitchen123.

## Put it on a server

Any Ubuntu VPS (for example Hostinger KVM 1) with a domain or subdomain pointed at it:

```
git clone https://github.com/arunvishnu-02/mukkani-crm.git /opt/mukkani-crm
cd /opt/mukkani-crm
bash deploy/install.sh crm.yourdomain.com
```

The script installs Docker if needed, creates `.env` with random passwords, starts PostgreSQL, the app and Caddy (automatic HTTPS), and prints the admin password.
HTTPS is required: phones only share GPS location with https sites.

- Update: `bash deploy/update.sh`
- Daily backup: `bash deploy/backup.sh` (add it to cron)

## Placeholders to replace

Package names and delivery slots are in `src/lib/labels.ts`. Regions and their map centres are edited by the admin in Users + regions.
