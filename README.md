# Mini HCM – Time Tracking System

A lightweight Human Capital Management (HCM) system that records employee time‑in/out, calculates regular hours, overtime, night differential, lateness, and undertime, and provides daily/weekly reports.

**Tech stack:** React (Vite) + Firebase (Auth, Firestore) + Express (Cloud Functions)

---

## What this project does

- Register/login with email/password (Firebase Auth)
- Punch In / Punch Out – stores timestamps in Firestore
- Automatically computes:
  - Regular hours (within shift)
  - Overtime (after shift end)
  - Night differential (22:00 – 06:00)
  - Late minutes (arrival after shift start)
  - Undertime minutes (departure before shift end)
- Dashboard shows today’s summary (KPI cards) and a history table of past days
- Admin panel (role‑based) – view weekly reports, manage punches, list users

---