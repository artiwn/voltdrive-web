# VoltDrive Web — Stage 12

Added the Support module: searchable FAQ, quick help categories, support-ticket creation, ticket history and ticket details.

Open `index.html` through Live Server.


## Stage 13 — Settings & Profile
Added profile editing, regional preferences, notification channels, security options, active devices, password update, privacy controls, data export and local account deletion.

## Stage 14 — Reservations Management

Added `reservations.html` with upcoming, completed, cancelled and no-show reservations, search, details, access code, modify and cancel actions. New reservations are synchronised with `voltdrive_reservations` in localStorage.

## Stage 15 — Shared application state
Dashboard and major modules now use shared localStorage-backed state. Active vehicle, wallet balance, reservations, completed sessions, transactions and unread notifications are synchronized across pages. Completing a charge creates a session, payment transaction, wallet deduction and notification. Creating a reservation and topping up the wallet also create notifications.


## Final prototype polish 2
Added the post-charging parking flow with grace-period countdown, idle-fee simulation, parking extension, vehicle removal, wallet transaction and notifications.

## Final prototype polish — Charging error states
The Charging page includes prototype controls for offline chargers, incompatible connectors, failed preauthorization, lost communication, locked cables, interrupted sessions, and pending final meter values. These states are visual simulations and do not call external services.

## Demo Control Panel

Open `demo-controls.html` after signing in to switch prototype states for vehicle battery, wallet, reservations, charging, parking and charger condition. The panel only changes local browser data and does not call external services.

## Waiting List prototype

`waiting-list.html` demonstrates a live station queue, estimated wait, queue position, charger availability offer, five-minute acceptance window, leaving the queue, and converting an accepted offer into a reservation and Arrival flow.

## Final prototype addition: Access methods
- QR scanner mock and manual charger code
- RFID card management (add, default, block, remove)
- Plug & Charge enablement and certificate state
- Visual support for app, bank card terminal and VIN identification

## Final prototype polish — expanded payments

The Wallet & Payments section now includes visual payment-source priority, Apple Pay / Google Pay mock options, failed-payment recovery, partial refunds and payment disputes. All actions are simulated locally and do not call external payment services.


## Receipt / invoice prototype
A dedicated `receipt.html` page shows the complete charging price breakdown and supports browser Print / Save as PDF, email simulation and JSON receipt-data download.


## Final prototype additions
- Plans & Packages page with simulated subscriptions, prepaid kWh, renewals, cancellation and discount benefits.

## Final polish: Notification details
- Dedicated notification details screen with context, timeline, smart actions, read/unread, snooze, delete and support handoff.


## Charging Analytics

The prototype includes a local-only analytics dashboard for energy, charging cost, station ranking, usage habits, estimated sustainability impact, budget tracking and JSON export.

## Emergency assistance prototype
Includes visual emergency guidance, stuck-cable flow, roadside/tow requests, location sharing mock and assistance case tracking. No real calls or location transmissions are made.
