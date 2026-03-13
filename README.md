# RentalBasic - Multi-Tenant Event Equipment Rental

A full-stack multi-tenant rental platform for chairs, tables, videoke, event tents, table cloths, and ornaments.

## Architecture

```
chair-rental/
├── api/          # NestJS backend (REST API, MySQL, TypeORM)
├── app/          # React Vite PWA (frontend, Flowbite-React, Zustand)
└── docker-compose.yml
```

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env with your Google OAuth credentials and secrets
```

### 2. Start with Docker Compose

```bash
docker compose up -d
```

### Services

| Service     | URL                            | Description              |
|-------------|--------------------------------|--------------------------|
| App (Customer) | http://127.0.0.1:43171      | Customer frontend        |
| App (Staff) | http://127.0.0.1:43172         | Admin/Vendor frontend    |
| API         | http://127.0.0.1:3000          | NestJS REST API          |
| API Docs    | http://127.0.0.1:3000/api/docs | Swagger UI               |
| phpMyAdmin  | http://127.0.0.1:8080          | Database management      |

## Roles

- **Administrator** – manages vendor accounts, item types/brands, tracks platform payments
- **Vendor** – manages inventory, bookings, pricing, delivery charges; has a custom `/shop/:slug` landing page
- **Customer** – browses vendors on a map by location, books equipment

## Features

- 🔐 Google OAuth login for all users
- 🗺️ Map-based vendor discovery (Leaflet, no API key required)
- 📦 Inventory management with real-time availability tracking
- 📅 Booking system with date conflict detection and pessimistic locking
- 💰 Platform commission (configurable, default 10% per booking)
- ⚠️ Vendor warning & suspension system (3 warnings → 7-day suspension)
- 🛒 Multi-step booking wizard (items → dates → delivery → confirm)
- 📱 PWA (installable on Android/iOS)
- 🏪 Custom vendor landing pages (`/shop/:slug`)
- 🐳 Fully Dockerized for VPS deployment

## Environment Variables

See `.env.example` for all required variables.

Key variables:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` – from Google Cloud Console
- `JWT_SECRET` – random secret string (min 32 chars)
- `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` / `MYSQL_USER`
- `FRONTEND_URL` – customer app URL (e.g. `http://yourdomain.com`)
- `STAFF_FRONTEND_URL` – admin/vendor app URL (e.g. `http://staff.yourdomain.com`)
- `GOOGLE_CALLBACK_URL` – e.g. `http://yourdomain.com/auth/google/callback`

## Development

```bash
# API
cd api && npm install && npm run start:dev

# App
cd app && npm install && npm run dev
```
