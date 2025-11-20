# Scheduler Microservice (integrated) - Link Mágico

This scheduler is designed to be integrated into the main `server.js` as a lightweight, tenant-aware module.

Features:
- Hybrid persistence: Redis (fast) + JSON files (durable backup)
- Tenant-scoped data
- Simple API endpoints
- No external paid services required

How to use:
1. Install dependencies: `npm install redis nanoid`
2. Place `scheduler/` inside your project root.
3. The assistant includes an integration snippet that will be injected into your `server.js` automatically (backed up as `server.js.backup_assistant`).

API quick examples:
- GET /api/schedule/health
- POST /api/schedule/availability
- POST /api/schedule/book
- GET  /api/schedule/bookings
- POST /api/schedule/cancel
