// The team guide page (plain HTML with its own styles). Edit the text here.
export const GUIDE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Mukkani Team Guide</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&display=swap">
<style>
/* Layout: one reading column with a sticky role switcher; each role is a run of time-of-day steps. */
:root {
  --bg: #fbf9fd;
  --surface: #ffffff;
  --ink: #23182e;
  --muted: #6b5f78;
  --line: #e7e0ee;
  --brand: #6a2c91;
  --brand-soft: #f1e8f8;
  --leaf: #2f7d32;
  --leaf-soft: #e6f3e6;
  --warn: #a35a00;
  --warn-soft: #fbefdc;
  --red: #b3261e;
  --red-soft: #fbe7e5;
  --display: "Bricolage Grotesque", "Lexend", system-ui, sans-serif;
  --body: "Lexend", system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #17111d; --surface: #211a29; --ink: #f1eaf6; --muted: #b3a6c0; --line: #3a2f45;
    --brand: #c99bea; --brand-soft: #34244a; --leaf: #8fd193; --leaf-soft: #1e3320;
    --warn: #f0b860; --warn-soft: #3b2b14; --red: #f2a49d; --red-soft: #3d1f1d; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #17111d; --surface: #211a29; --ink: #f1eaf6; --muted: #b3a6c0; --line: #3a2f45;
  --brand: #c99bea; --brand-soft: #34244a; --leaf: #8fd193; --leaf-soft: #1e3320;
  --warn: #f0b860; --warn-soft: #3b2b14; --red: #f2a49d; --red-soft: #3d1f1d; color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 16px; line-height: 1.6; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--surface); }
.wrap { max-width: 760px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
header.top { padding-block: 40px 20px; }
.eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--brand); }
h1 { font-family: var(--display); font-weight: 800; font-size: clamp(32px, 7vw, 46px); line-height: 1.05; margin: 6px 0 12px; text-wrap: balance; }
.lead { color: var(--muted); max-width: 60ch; margin: 0; }
.site { text-decoration: none; display: inline-flex; gap: 8px; align-items: center; margin-top: 16px; padding: 8px 12px; border-radius: 10px; background: var(--brand-soft); color: var(--ink); font-weight: 500; font-size: 15px; overflow-wrap: anywhere; }
nav.roles { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--surface); border-bottom: 1px solid var(--line); }
nav.roles .wrap { display: flex; gap: 6px; padding-block: 10px; overflow-x: auto; }
nav.roles a { flex: none; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink); text-decoration: none; font-weight: 500; font-size: 14px; }
nav.roles a:hover, nav.roles a:focus-visible { border-color: var(--brand); color: var(--brand); outline: none; }
main { padding-block: 8px 64px; }
section.role { padding-top: 36px; scroll-margin-top: 64px; }
h2 { font-family: var(--display); font-weight: 800; font-size: 28px; margin: 0 0 4px; text-wrap: balance; }
.who { color: var(--muted); margin: 0 0 20px; }
.step { display: grid; grid-template-columns: 76px 1fr; gap: 16px; padding-block: 18px; border-top: 1px solid var(--line); }
.step:first-of-type { border-top: 0; }
.when { font-weight: 600; font-size: 13px; color: var(--brand); padding-top: 3px; font-variant-numeric: tabular-nums; }
.step > div { min-width: 0; }
h3 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
.path { display: inline-block; font-size: 13px; font-weight: 500; color: var(--muted); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 1px 8px; margin-bottom: 8px; }
ol, ul { margin: 6px 0 0; padding-left: 20px; }
li { margin: 3px 0; }
b { font-weight: 600; }
.btn { display: inline-block; font-size: 14px; font-weight: 600; padding: 0 7px; border-radius: 6px; background: var(--brand); color: var(--surface); white-space: nowrap; }
.btn.g { background: var(--leaf); }
.note { margin-top: 10px; padding: 10px 12px; border-radius: 10px; font-size: 14px; background: var(--warn-soft); color: var(--ink); }
.note b { color: var(--warn); }
.rules { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.rule { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
.rule h3 { font-size: 16px; }
.rule p { margin: 0; font-size: 14px; color: var(--muted); }
.num { font-family: var(--display); font-weight: 800; font-size: 26px; color: var(--leaf); line-height: 1; }
.tbl { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 9px 12px; border-top: 1px solid var(--line); vertical-align: top; }
th { border-top: 0; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-weight: 600; background: var(--bg); }
.dot { display: inline-flex; min-width: 22px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--red); color: var(--surface); font-size: 11px; font-weight: 700; align-items: center; justify-content: center; }
footer { color: var(--muted); font-size: 13px; padding-block: 24px 40px; border-top: 1px solid var(--line); }
@media (max-width: 560px) {
  .step { grid-template-columns: 1fr; gap: 4px; }
  .rules { grid-template-columns: 1fr; }
}
</style>
<style>body{margin:0}</style>
</head>
<body>


<header class="top">
  <div class="wrap">
    <div class="eyebrow">Mukkani · fruit and salad boxes, Trichy</div>
    <h1>How we use the app, every day</h1>
    <p class="lead">One page for the whole team. Find your role, follow your day from top to bottom. When every red number in your menu is gone, your day's work is done.</p>
    <a class="site" href="/">Open the app</a>
  </div>
</header>

<nav class="roles" aria-label="Roles">
  <div class="wrap">
    <a href="#rules">Rules for everyone</a>
    <a href="#sales">Sales</a>
    <a href="#kitchen">Kitchen manager</a>
    <a href="#admin">Admin</a>
    <a href="#red">Red numbers</a>
  </div>
</nav>

<main class="wrap">

  <section class="role" id="rules">
    <h2>Rules for everyone</h2>
    <p class="who">How the monthly pack works. The app counts all of this for you.</p>
    <div class="rules">
      <div class="rule"><div class="num">26</div><h3>boxes in a monthly pack</h3><p>Monday to Saturday. Rs 3,430.</p></div>
      <div class="rule"><div class="num">Sun</div><h3>No delivery on Sunday</h3><p>Office holidays on the Calendar are the same: nobody gets a box, nobody loses a box.</p></div>
      <div class="rule"><div class="num">+1</div><h3>Leave moves the last day</h3><p>Every leave or holiday pushes the customer's end date one day later.</p></div>
      <div class="rule"><div class="num">2</div><h3>Two boxes count as two</h3><p>A 2-box day uses 2 of the 26, so the pack ends sooner.</p></div>
      <div class="rule"><div class="num">M W F</div><h3>Add-on drink days</h3><p>Monday, Wednesday and Friday only, for customers who took it.</p></div>
      <div class="rule"><div class="num">Today</div><h3>Old days are locked</h3><p>You can change today freely. For an older day, ask admin; admin opens it for 24 hours.</p></div>
    </div>
  </section>

  <section class="role" id="sales">
    <h2>Sales</h2>
    <p class="who">Attendance, leads, renewals, payments and the menu.</p>

    <div class="step"><div class="when">9:00 AM</div><div>
      <h3>Enter today's attendance</h3>
      <span class="path">Delivery attendance</span>
      <ol>
        <li>The table at the top shows every region and how many are still to enter.</li>
        <li>Pick a region tab. Copy the kitchen's paper sheet: tap <b>Delivered</b>, <b>Absent</b> or <b>Not delivered</b> on each row. Each row saves by itself.</li>
        <li>If most were delivered, tap <span class="btn">Mark the other … delivered</span>, then fix the few that were not.</li>
        <li>For a customer who took 2 boxes, change <b>1 box</b> to <b>2 boxes</b> next to Delivered.</li>
        <li>Fill <b>Alt box no.</b>, <b>Empty box back</b> and <b>Remarks</b> from the paper.</li>
        <li>Do every region until the red number on Delivery attendance is gone.</li>
      </ol>
      <div class="note"><b>Wrong entry?</b> Tap <b>Clear</b> on that row and enter it again. Admin is told when an entry is cleared.</div>
    </div></div>

    <div class="step"><div class="when">When told</div><div>
      <h3>Leave in advance</h3>
      <span class="path">Delivery attendance › Mark leave</span>
      <ol>
        <li>Pick the customer and the day (or from and until, up to 14 days).</li>
        <li>They come off the 3 AM sheet for those days. Their end date moves later by itself.</li>
        <li>For a long break, open the customer and use <b>Set status › Paused</b>.</li>
      </ol>
    </div></div>

    <div class="step"><div class="when">Morning</div><div>
      <h3>New leads and calls</h3>
      <span class="path">Leads · Call register · Trials</span>
      <ul>
        <li><b>Leads › Add lead</b>: name, phone, region. Under <b>Start as</b> pick Follow up, Trial or Monthly pack. For Monthly, tick <b>Paid</b> if they paid.</li>
        <li><b>Customer form link</b>: type the phone, send the link on WhatsApp; the customer fills their own address and home location.</li>
        <li><b>Call register</b>: call everyone due today. Write what they said.</li>
        <li><b>Trials</b>: take feedback on trial boxes after 10 AM.</li>
      </ul>
    </div></div>

    <div class="step"><div class="when">Afternoon</div><div>
      <h3>Renewals and reminders</h3>
      <span class="path">Renewals · Reminders</span>
      <ol>
        <li><b>Renewals › Month over</b>: customers who finished 26 boxes. Tap <span class="btn g">Ask</span> to send the WhatsApp message.</li>
        <li>If they say yes, tap <b>Continue · start month 2</b>. The start date is filled in. Tick Paid if paid, then <b>Start</b>.</li>
        <li>If they say no, tap <b>Not continuing</b> and pick the reason.</li>
        <li><b>Ending in 3 days</b>: tap <span class="btn g">Remind</span>. <b>Reminders</b> has the same end-date messages.</li>
      </ol>
    </div></div>

    <div class="step"><div class="when">When paid</div><div>
      <h3>Mark a payment</h3>
      <span class="path">Customers › the customer › Mark paid</span>
      <ol>
        <li>Open the customer. In the package box, tap <span class="btn">Mark paid</span>.</li>
        <li>Add the GPay / PhonePe screenshot and a short note (for example "GPay, ref 4521").</li>
        <li>Tap <b>Mark paid</b>. It shows "Paid" with the date and the screenshot.</li>
      </ol>
    </div></div>

    <div class="step"><div class="when">Before night</div><div>
      <h3>Tomorrow's menu</h3>
      <span class="path">Daily menu</span>
      <ol>
        <li>Tomorrow is already selected. Do not change the date.</li>
        <li><b>1.</b> Tick the fruits. <b>2.</b> Type the salad. <b>3.</b> Tick 1 or 2 fruits to give instead (not the ones in step 1).</li>
        <li>Tap <b>Save menu</b>. The right side shows who gets a changed fruit.</li>
      </ol>
      <div class="note"><b>Holiday tomorrow?</b> No menu is needed. Holidays are on the Calendar.</div>
    </div></div>

    <div class="step"><div class="when">Every day</div><div>
      <h3>Close the day (compulsory)</h3>
      <span class="path">Dashboard › checklist</span>
      <ol>
        <li>Before you leave, every item on your dashboard checklist must be green: attendance, next day menu, reminders, renewal answers, follow-up calls, trial feedback.</li>
        <li>Tap an orange item to go straight to it.</li>
      </ol>
      <div class="note"><b>Not finished?</b> Next morning, today's attendance stays locked and shows what is missing. Admin is told. A missed attendance day needs admin to open it.</div>
    </div></div>

    <div class="step"><div class="when">Day 25</div><div>
      <h3>Monthly report one day early</h3>
      <span class="path">Monthly reports › Day 25 · last box next</span>
      <ol>
        <li>The tab lists every customer with one box left, and the date of that last box.</li>
        <li>Tap <b>Preview</b> to see the report. Tap <span class="btn">Make report now</span>.</li>
        <li>The last box is saved as Delivered for its day. The customer moves to the <b>Ready</b> tab.</li>
        <li>On <b>Ready</b>, tap <span class="btn g">Send PDF</span> and send it on WhatsApp, or Print it to go with the last box.</li>
      </ol>
      <div class="note"><b>Customer missed the last box?</b> On that day in Delivery attendance, change them to <b>Absent</b>. The month goes back to running and the last day moves one day later.</div>
    </div></div>

    <div class="step"><div class="when">Any time</div><div>
      <h3>Also in your menu</h3>
      <ul>
        <li><b>Monthly reports</b>: after 26 boxes, tap <span class="btn g">Send PDF</span>. On a phone, pick WhatsApp and the PDF goes attached.</li>
        <li><b>Arrange order</b> (Delivery attendance): drag customers into the delivery route order, then save.</li>
        <li><b>A customer who sometimes takes 2 boxes</b> (like Sowmiya): open the customer, in the package box find "Takes more than the usual boxes on a day?", pick the day and 2 boxes, tap Add. That day's sheet and attendance show "2 boxes", and the extra box counts in the 26.</li>
        <li><b>Salad to avoid</b>: collected on the customer form link and in Add lead. When the day's salad has an item the customer avoids, the sheet shows "No peanut in salad" and the menu page lists them. Add the salad given instead in Daily menu, step 3.</li>
        <li><b>Calendar</b>: add an office holiday with a reason.</li>
        <li><b>Daily issues</b>: write any problem with the department and who will fix it.</li>
        <li><b>Customers › Missing details</b>: fill phones and addresses.</li>
      </ul>
    </div></div>
  </section>

  <section class="role" id="kitchen">
    <h2>Kitchen manager</h2>
    <p class="who">The 3 AM sheet, boxes, customer calls, stock and staff.</p>

    <div class="step"><div class="when">Before night</div><div>
      <h3>Close the day (compulsory)</h3>
      <span class="path">Stock · Wastage · Staff tracking</span>
      <ol>
        <li><b>Stock</b>: add the fruit that came in. If no fruit came in, tap <span class="btn">No stock came in today</span>.</li>
        <li><b>Wastage</b>: fill the waste for each fruit. If nothing was wasted, tap <span class="btn">No wastage today</span>.</li>
        <li><b>Staff tracking</b>: for every person choose <b>Present</b> or <b>Absent</b>. For those present fill everything. ID card and uniform (or dress code): Yes, No or Don't have. Kitchen staff: in and out of shift 1 (3 to 7 AM), and shift 2 (11 AM to 2 PM) only for the people marked for it in Add or remove staff. Delivery persons: on-time pick-up, in time (due 5:30), time the deliveries were complete, and starting and ending km. The total km shows by itself. Save works only when all are filled.</li>
        <li>Do all three <b>by 11:30 AM</b>. Sales cannot add tomorrow's menu until they are entered, and after 11:30 admin is told they are late.</li>
        <li>Sales then adds tomorrow's menu.</li>
      </ol>
      <div class="note"><b>The next day's sheet will not print</b> until all four are done. The dashboard and the print page show what is missing, and admin is told.</div>
    </div></div>

    <div class="step"><div class="when">3:00 AM</div><div>
      <h3>Print the attendance sheet</h3>
      <span class="path">Delivery attendance › Print all regions</span>
      <ol>
        <li>Check the orange note at the top: on an office holiday no boxes go out.</li>
        <li>Tap <span class="btn">Print all regions</span>. Each region prints on its own A4 page in route order.</li>
        <li>The sheet shows the add-on drinks, customizations (for example "No papaya → Apple"), <b>2 boxes</b> tags and the people on leave.</li>
        <li>To change the route order first: <b>Arrange order</b>, drag, save, then print.</li>
      </ol>
    </div></div>

    <div class="step"><div class="when">Packing</div><div>
      <h3>Today's boxes</h3>
      <span class="path">Today's boxes · Daily menu</span>
      <ul>
        <li>How many boxes, which fruit to give instead and how many of each.</li>
        <li>A red number on Today's boxes means a trial or pack was added after 2 PM. Check it.</li>
      </ul>
    </div></div>

    <div class="step"><div class="when">After delivery</div><div>
      <h3>Write the paper, then check</h3>
      <ul>
        <li>On the paper, write delivered, absent, alternative box number and box returned. Sales enters it after 9 AM.</li>
        <li>Later, <b>Print entered attendance</b> shows what sales entered, to check against the paper.</li>
      </ul>
    </div></div>

    <div class="step"><div class="when">Morning</div><div>
      <h3>Customer calls</h3>
      <span class="path">Customer calls</span>
      <ol>
        <li>Use the filters: <b>Today</b>, <b>Overdue</b>, <b>Renewal · day 26</b>, and a region.</li>
        <li>Call, then tap <span class="btn">Log call</span>: Happy, Has an issue or No answer, and a note.</li>
        <li>Day 26 is the renewal call. If yes: send the payment QR on WhatsApp; when the screenshot comes, tick <b>Paid</b> and the next month starts by itself.</li>
        <li>If no: pick the reason. The customer moves to Not interested.</li>
      </ol>
    </div></div>

    <div class="step"><div class="when">Every day</div><div>
      <h3>Boxes, stock and staff</h3>
      <ul>
        <li><b>Alternative boxes</b>: 25 in all. Note who has each one and when it comes back.</li>
        <li><b>Stock</b> and <b>Wastage</b>: fruit in, cut, waste in kg with the reason.</li>
        <li><b>Staff tracking</b>: ID card, uniform, in and out time, on-time pickup; for delivery staff, start and end km.</li>
        <li><b>Renewals</b> and <b>Mark leave</b> work the same as for sales.</li>
      </ul>
    </div></div>
  </section>

  <section class="role" id="admin">
    <h2>Admin</h2>
    <p class="who">Sees everything. Checks the team, the money and the backups.</p>

    <div class="step"><div class="when">Daily</div><div>
      <h3>Check the red numbers</h3>
      <ul>
        <li><b>Overview</b>: the day's boxes, money and KPIs, with filters.</li>
        <li><b>Deleted by team</b>: everything sales or the kitchen deleted, with what it was. Tap <b>Mark all as seen</b>.</li>
        <li><b>Past-day requests</b>: allow or refuse. Allowing opens that one day for that person for 24 hours.</li>
        <li><b>Dues</b>: rent, salary and bank dues show from the day before they are due.</li>
      </ul>
    </div></div>

    <div class="step"><div class="when">Weekly</div><div>
      <h3>Money, reports and backups</h3>
      <ul>
        <li><b>Purchase + expenses</b>: every bill with its photos.</li>
        <li><b>Staff attendance</b>: a month table of present and absent for every person, and the list of people. Only admin adds or removes people (and sets who works shift 2). The kitchen manager fills each day in Staff tracking.</li>
        <li><b>Office staff</b> (your own team, not kitchen and not delivery): add them in Staff attendance with Work set to Office staff. You enter their present or absent, in and out time at the top of that page. The kitchen manager does not see them.</li>
        <li><b>Reports</b> and <b>All reports</b>: sort and filter any column.</li>
        <li><b>Change any day of a customer</b>: open the customer, and in the calendar tap the day. Choose Delivered (with boxes), Leave, Not delivered (box carried forward) or Remove the entry, add the reason, and Save. The month, last day and report update by themselves, and the change is written in the customer's History.</li>
        <li><b>Backups</b>: a full copy is made every night after 1 AM; the last 30 are kept. Once a week, tap <b>Download</b> on the newest one and keep it in Google Drive or on a pen drive.</li>
      </ul>
    </div></div>

    <div class="step"><div class="when">As needed</div><div>
      <h3>Team and settings</h3>
      <ul>
        <li><b>Team + regions</b>: one login for each person. Never share the admin login.</li>
        <li><b>Settings</b>: prices, payment QR, WhatsApp messages, number of alternative boxes.</li>
      </ul>
      <div class="note"><b>Keep the data private.</b> Customer phones and addresses stay inside the app. Do not copy the customer list to other apps or groups.</div>
    </div></div>
  </section>

  <section class="role" id="red">
    <h2>What the red numbers mean</h2>
    <p class="who">A red number next to a menu item means work is waiting there. Hover or press on it to see what it counts.</p>
    <div class="tbl">
      <table>
        <thead><tr><th>Menu</th><th>Red number counts</th><th>Who</th></tr></thead>
        <tbody>
          <tr><td>Leads</td><td>New leads today</td><td>Sales</td></tr>
          <tr><td>Call register</td><td>Follow-up calls due today or overdue</td><td>Sales</td></tr>
          <tr><td>Trials</td><td>Trial feedback to take</td><td>Sales</td></tr>
          <tr><td>Daily menu</td><td><span class="dot">!</span> tomorrow's menu is not added</td><td>Sales</td></tr>
          <tr><td>Delivery attendance</td><td>Customers not entered today (after 9 AM)</td><td>Sales</td></tr>
          <tr><td>Reminders</td><td>End-date reminders to send today</td><td>Sales</td></tr>
          <tr><td>Renewals</td><td>Month over, no answer yet</td><td>Sales, kitchen</td></tr>
          <tr><td>Daily issues</td><td>Open issues</td><td>Everyone</td></tr>
          <tr><td>Today's boxes</td><td>Trials or packs added after 2 PM</td><td>Kitchen</td></tr>
          <tr><td>Customer calls</td><td>Calls to make</td><td>Kitchen</td></tr>
          <tr><td>Dues</td><td>Due by tomorrow or overdue</td><td>Admin</td></tr>
          <tr><td>Past-day requests</td><td>Waiting for your answer</td><td>Admin</td></tr>
          <tr><td>Deleted by team</td><td>Not seen yet</td><td>Admin</td></tr>
        </tbody>
      </table>
    </div>
  </section>

</main>

<footer>
  <div class="wrap">Mukkani · Fresh fruit and salad boxes · Trichy. Questions about the app: ask admin.</div>
</footer>

</body>
</html>
`
