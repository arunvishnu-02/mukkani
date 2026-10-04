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

Next.js 16 (App Router, server actions), TypeScript, Tailwind CSS 4, Prisma 7, MySQL / MariaDB. Login is username and password with a signed cookie. No paid services beyond hosting.
Design: Figma file "Mukkani CRM Dashboard".

## Run it on your computer

You need Node.js 22 and MySQL or MariaDB.

```
cp .env.example .env            # set DATABASE_URL and SESSION_SECRET
npm install
npx prisma migrate deploy
SEED_DEMO=1 npm run db:seed     # demo data and logins below
npm run dev
```

Demo logins (only with SEED_DEMO=1): admin / admin123, divya / sales123, karthik / sales123, kitchen / kitchen123.

## Put it on Hostinger (Node.js web app)

1. **Database.** In hPanel open Databases > MySQL Databases and create a database and user. Note the database name, user, password and host (often `localhost`; hPanel shows it).
2. **Web app.** In hPanel add a Node.js web app (Websites > Add website > Node.js app), connect GitHub and pick `arunvishnu-02/mukkani`, branch `main`.
3. **Build settings.** Framework Next.js, Node version 22, build command `npm run build`, start command `npm start`.
4. **Environment variables.**

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | `mysql://USER:PASSWORD@HOST:3306/DATABASE` |
   | `SESSION_SECRET` | a long random string (32+ characters) |
   | `APP_URL` | your address, e.g. `https://crm.mukkani.in` |
   | `ADMIN_PASSWORD` | the password you want for the `admin` login |
   | `COOKIE_SECURE` | `true` |

   If the database password has symbols such as `@`, `#` or `/`, write them URL-encoded in `DATABASE_URL` (for example `@` becomes `%40`).
5. **Deploy.** On every start the app creates or updates the database tables (`prisma migrate deploy`) and, the first time, the 5 regions and the `admin` user. Log in as `admin`, then add sales and kitchen users in Users + regions.
6. **HTTPS.** Turn on the free SSL certificate for the domain. Phones only share GPS location with https sites.

To update the live app, push to `main` and redeploy in hPanel. Hostinger's automatic database backups cover the data.

## Packages, slots and regions

Packages and prices (now: Monthly package, ₹3,430 a month) and delivery slots are in `src/lib/labels.ts`. Regions and their map centres are edited by the admin in Users + regions.
