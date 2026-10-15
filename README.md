# RESERVANCE

Academic activity management and performance analytics platform with **hotel front-desk reservation simulations** for student training and assessment.

Faculty and super admins create simulation scenarios in Activity Factory; students complete book → check-in → check-out workflows in a PMS-style interface with automatic grading.

**Stack:** Laravel 12 API · React 19 SPA · Node.js Socket.io · MySQL

All system changes are recorded in [`docs/SYSTEM_CHANGELOG.md`](docs/SYSTEM_CHANGELOG.md).

## Quick start (any PC)

1. Copy the whole `RESERVANCECAPSTONE` folder onto the other computer (usually under `xampp\htdocs\`).
2. Install **XAMPP** and **Node.js LTS** on that computer if they are not installed.
3. Double-click **`create-reservance-shortcut.bat` once** so the Desktop **RESERVANCE** shortcut points to that PC’s folder and keeps the logo. Use that shortcut. A copied `start-reservance.bat` on the Desktop shows a blank icon.
4. Double-click **RESERVANCE** (or `start-reservance.bat`).

A setup tutorial popup opens and **automatically checks** the folder path and required downloads. You cannot tick the boxes yourself — red items show what is still missing. When everything is OK, **Don’t show again** appears. The popup uses the RESERVANCE logo and purple/gold look.

The launcher then starts **classroom capacity mode** (API gateway + 4 PHP workers, LAN bind, realtime tuned for 100+ students), finds XAMPP/PHP/Node, starts MySQL, installs missing packages if needed, and opens the Program Chair dashboard at `http://TEACHER-IP:5173/program-chair/dashboard`. All of those servers stay in the one window you opened: it shows which ones are running, **1–7** restarts a server, and **S** at the bottom stops them. Students on other lab PCs use the shown `http://TEACHER-IP:5173` address.

Manual setup is in [`docs/SETUP.md`](docs/SETUP.md).

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Program Chair | programchair@reservance.local | password |
| Superadmin | superadmin@reservance.local | password |
| Faculty | faculty@reservance.local | password |
| Student | student@reservance.local | password |
