# Mukkani CRM

CRM and daily dashboard for Mukkani, a healthy food box business in Trichy.
One path for every customer: Lead, Call register, Trial box (one date, Rs 200), Monthly pack (26 deliveries, Mon to Sat).
It replaces WhatsApp coordination between Sales and the Kitchen.

## Roles

| Role | Can do |
|---|---|
| Admin | Everything, from one menu grouped into Sales, Kitchen and Business: overview, reports and Excel (CSV) downloads, purchase + expenses with bill photos, team + regions, settings |
| Sales | Leads, call register, trials and feedback calls, customers and monthly packs, daily menu, delivery attendance (after 11 AM), end-date reminders, monthly reports |
| Kitchen manager | Today's boxes and the 3 AM attendance sheet (A4 per region), customer status (Active, Absent, Paused, Inactive), day 1/5/15/26 customer calls and renewals, alternative boxes, stock and wastage. Cannot delete. |

## What happens automatically

- Customers are in 4 categories: Follow up, Trial, Monthly pack, Not interested (with a reason).
- A monthly pack is 26 delivery days. Sunday is a holiday. Absent, paused and not-delivered days push the end date; the package calendar shows them in blue. After the 26th delivery the pack is completed and the monthly report can be printed.
- Tomorrow's menu is matched against each customer's foods to avoid, and the kitchen sees the swap counts.
- Day 26 is the renewal call: Yes sends the payment QR, Paid starts the next pack after the last day. No moves the customer to Not interested.
- WhatsApp messages (reminders 3 days before the end, renewal QR, review request, birthday wishes, reports) are tap-to-send. Their texts are in Settings.
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
5. **Deploy.** On every start the app creates or updates the database tables (`prisma migrate deploy`) and, the first time, the 4 regions and the `admin` user. Log in as `admin`, then add sales and kitchen users in Team + regions, and upload the payment QR in Settings.
6. **HTTPS.** Turn on the free SSL certificate for the domain. Phones only share GPS location with https sites.

To update the live app, push to `main` and redeploy in hPanel. Hostinger's automatic database backups cover the data.

## Prices, slots and regions

Prices (monthly pack Rs 3,430, trial Rs 200, buttermilk Rs 299 a bottle), delivery slots, fruits, message texts, the payment QR and the report details are edited by the admin in Settings. Regions and their map centres are edited in Team + regions. Bill photos and the QR are stored in the database, so a redeploy never loses them.
