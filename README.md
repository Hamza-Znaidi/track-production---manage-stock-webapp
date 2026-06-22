# Production Tracker Web Application

Production Tracker is a full-stack manufacturing operations platform for managing work orders, production stages, inventory, notifications, reports, and real-time collaboration between admins and workers.

## Purpose and Business Value

Production Tracker helps manufacturing teams replace fragmented spreadsheets and manual follow-up with a centralized, role-based workflow system.

Business outcomes:

- Faster production flow with stage-based execution and dependency enforcement.
- Better traceability through work-order history, stage notes, and QR-assisted lookup.
- Improved inventory control with reservations and low-stock alerts.
- Reduced communication lag with realtime chat and notifications.
- Better decision support through analytics and optional AI-generated insights.

## Features

- JWT authentication with role-based access control (ADMIN and WORKER).
- Worker sub-roles mapped to production stages (SALES, CAD, CAM, STORE, CNC, ASSEMBLY, QUALITY, DELIVERY).
- Work order lifecycle management:
  - Create, update, delete, and monitor progress.
  - Auto-create production stages per work order.
  - Generate and resolve QR payloads for work orders.
- Stage execution and note management:
  - Role and assignment-aware task visibility.
  - Stage dependency rules (previous stage completion required).
  - Stage notes with create/edit/delete and history.
- Inventory and reservations:
  - Category-based stock item management.
  - Auto-generated stock codes.
  - Reservation, consume, and cancel workflows.
  - Low-stock notification triggers.
- Realtime collaboration:
  - Socket.IO chat threads, typing indicators, read receipts.
  - Realtime work-order stage update events.
- Notification center:
  - List, unread count, mark read, clear flows.
- Reporting:
  - Aggregated operational metrics.
  - Optional Gemini-powered AI analysis.

## Tech Stack

### Frontend

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-20232A?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Socket.IO Client](https://img.shields.io/badge/Socket.IO-Client-010101?logo=socketdotio)

- Next.js (App Router), React, Tailwind CSS
- Axios, Socket.IO Client
- React Hook Form, Recharts, jsPDF, html5-qrcode

### Backend

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?logo=socketdotio)

- Node.js + Express REST API
- Prisma ORM + PostgreSQL
- JWT, bcryptjs, Multer, QRCode, Socket.IO
- Gemini API integration for AI-assisted reports

## Project Architecture

The repository is organized as a full-stack workspace with separate frontend and backend applications.

```text
PFE/
|- production-tracker/
|  |- backend/
|  |  |- prisma/                # Prisma schema, migrations, seed
|  |  |- src/
|  |  |  |- lib/                # Chat, notifications, reports, AI helpers
|  |  |  |- middleware/         # JWT auth and role checks
|  |  |  |- routes/             # REST route modules
|  |  |  |- server.js           # Express + Socket.IO bootstrap
|  |  |- uploads/               # Chat attachment uploads
|  |- frontend/
|  |  |- src/
|  |  |  |- app/                # Admin and worker pages
|  |  |  |- components/         # Reusable UI components
|  |  |  |- lib/                # Auth, API client, socket helpers
|  |  |- public/
|- report/                      # Report and image artifacts
```

## Installation and Setup

### Prerequisites

- Node.js 18+ (Node.js 20 recommended)
- npm 9+
- PostgreSQL 14+

### 1. Clone and install dependencies

```bash
git clone <YOUR_REPO_URL>
cd PFE

# Backend
cd production-tracker/backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure environment variables

Create these files:

- production-tracker/backend/.env
- production-tracker/frontend/.env.local

Use the templates in the Environment Variables section below.

### 3. Initialize database

```bash
cd production-tracker/backend
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

### 4. Start development servers

Terminal 1:

```bash
cd production-tracker/backend
npm run dev
```

Terminal 2:

```bash
cd production-tracker/frontend
npm run dev
```

Default local URLs:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- Health check: http://localhost:5000/api/health

## Environment Variables

Never commit real secrets. Use strong values for non-local environments.

### Backend (production-tracker/backend/.env)

```env
DATABASE_URL="postgresql://<db_user>:<db_password>@localhost:5432/production_tracker?schema=public"
PORT=5000
FRONTEND_URL="http://localhost:3000"

JWT_SECRET="<strong_random_secret>"
JWT_EXPIRES_IN="7d"

# Optional: required only for AI-generated report insights
GEMINI_API_KEY="<your_gemini_api_key>"

# Optional: used for public attachment URL generation
PUBLIC_BASE_URL="http://localhost:5000"
BACKEND_URL="http://localhost:5000"
```

### Frontend (production-tracker/frontend/.env.local)

```env
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
# Optional override for socket origin
NEXT_PUBLIC_SOCKET_URL="http://localhost:5000"
```

## Usage

1. Open the app at http://localhost:3000.
2. Sign in as admin or worker.
3. Admin can create users, create work orders, assign stages, manage stock, and generate reports.
4. Workers can view assigned tasks, update stages, add notes, reserve stock, and use chat.
5. Notifications and chat update in realtime via Socket.IO.

Seeded local credentials (from prisma/seed.js):

- Admin: admin / admin123
- Worker: worker1 / worker123

Change default credentials immediately outside local development.

## API Endpoints

Base path: /api

### Health

- GET /health

### Authentication and Users

- POST /auth/login
- POST /auth/register (admin only)
- GET /auth/me
- GET /auth/users
- PUT /auth/users/:id (admin only)
- DELETE /auth/users/:id (admin only)
- GET /auth/chat-users

### Work Orders

- GET /workorders
- GET /workorders/:id
- POST /workorders (admin only)
- PUT /workorders/:id (admin only)
- DELETE /workorders/:id (admin only)
- GET /workorders/lookup/:scanValue

### Stages and Notes

- GET /stages/my-tasks
- GET /stages/my-completed
- PUT /stages/:id
- GET /stages/:id/notes
- POST /stages/:id/notes
- PUT /stages/:id/notes/:noteId
- DELETE /stages/:id/notes/:noteId

### Stock and Reservations

- GET /stock
- GET /stock/:id
- POST /stock (admin only)
- PUT /stock/:id (admin only)
- DELETE /stock/:id (admin only)
- PATCH /stock/:id/quantity (admin only)
- POST /stock/reserve
- GET /stock/reservations (admin only)
- GET /stock/reservations/my-reservations
- GET /stock/reservations/work-order/:workOrderId
- PATCH /stock/reservations/:id/status

### Notifications

- GET /notifications
- GET /notifications/unread-count
- PATCH /notifications/:id/read
- PATCH /notifications/read-all
- DELETE /notifications/:id
- DELETE /notifications

### Chat

- GET /chat/threads
- GET /chat/:threadId
- POST /chat/dm
- POST /chat/workorder/:workOrderId
- POST /chat/:threadId/participants
- GET /chat/:threadId/messages
- POST /chat/upload
- POST /chat/:threadId/messages
- POST /chat/:threadId/messages/:messageId/read
- DELETE /chat/:threadId (admin with constraints)

### Reports

- POST /reports/generate (admin only)

## Authentication and Authorization Flow

1. User logs in via POST /api/auth/login.
2. Backend validates credentials and returns JWT + user claims.
3. Frontend stores the token in localStorage and sends Authorization: Bearer <token> with requests.
4. Backend middleware validates JWT and populates request user context.
5. Role checks and assignment/ownership rules enforce access.
6. Socket.IO handshake also validates JWT through auth.token.

## Realtime Events

- Rooms:
  - thread:<threadId>
  - workorder:<workOrderId>
- Common events:
  - message:new
  - message:marked-read
  - typing:user-typing
  - typing:user-stopped
  - workorder:stage-updated

## Screenshots

Current project screenshots (from report/pictures):

![Analytics Dashboard](report/pictures/analytics%20Dashboard.png)
![Production Stages - Admin View](report/pictures/production%20stages%20admin%20view.png)
![Worker Tasks View](report/pictures/worker%20tasks%20view.png)
![Chat Messaging - Admin View](report/pictures/chat%20messaging%20admin%20view.png)
![Inventory - Admin View](report/pictures/inventory%20admin%20view.png)

Optional placeholders for future updates:

- docs/screenshots/login.png
- docs/screenshots/admin-dashboard.png
- docs/screenshots/worker-tasks.png
- docs/screenshots/stock-management.png
- docs/screenshots/chat-thread.png
- docs/screenshots/reports.png

## Deployment

Typical setup:

- Frontend on Vercel
- Backend on Railway/Render/Fly.io
- Managed PostgreSQL (Neon/Supabase/Railway/Render)

### Backend deployment

1. Provision PostgreSQL and set DATABASE_URL.
2. Configure backend env vars (JWT_SECRET, JWT_EXPIRES_IN, FRONTEND_URL, optional GEMINI_API_KEY).
3. Run:

```bash
npm install
npm run prisma:generate
npm run prisma:deploy
npm run start
```

4. Ensure uploads storage is persistent for your hosting provider.

### Frontend deployment

1. Configure NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SOCKET_URL.
2. Run:

```bash
npm install
npm run build
npm run start
```

### Production checklist

- Use HTTPS for frontend, backend, and socket endpoints.
- Set exact CORS origin in FRONTEND_URL.
- Rotate secrets and remove default credentials.
- Validate attachment URL generation with PUBLIC_BASE_URL.

## Troubleshooting

- Prisma generate fails on Windows with EPERM on query_engine-windows.dll.node:
  - Stop running Node processes using Prisma and retry npm run prisma:generate.
- Chat images do not render in some deployments:
  - Verify backend public URL generation and frontend image handling/config.
- 401 from frontend API calls:
  - Re-authenticate and verify NEXT_PUBLIC_API_URL.
- Socket connection issues:
  - Verify FRONTEND_URL, token validity, and NEXT_PUBLIC_SOCKET_URL.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Keep commits focused and descriptive.
4. Run lint/build checks.
5. Open a pull request with context and screenshots for UI changes.

Suggested checks:

```bash
# frontend
cd production-tracker/frontend
npm run lint
npm run build

# backend
cd ../backend
npm run prisma:generate
npm run dev
```

## License

No root LICENSE file is currently present.

For public distribution, add a LICENSE file (for example MIT or Apache-2.0) and update this section.
