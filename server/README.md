Server scaffold for MessMate (Phase 2 initial backend)

Quick start:

1. Copy `.env.example` to `.env` and set database credentials and JWT_SECRET.

Required env vars:

- DB_HOST
- DB_USER
- DB_PASSWORD
- DB_NAME
- DB_PORT (optional)
- JWT_SECRET
- PORT (optional)

Install and run:

```bash
cd server
npm install
npm run dev
# in another terminal, run seed once after creating the database:
npm run seed
```

The server exposes basic auth endpoints:

- `POST /api/auth/signup` { name, email, password, role }
- `POST /api/auth/login` { email, password }

These return `{ token, user }` on success.
