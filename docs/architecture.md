# MessMate Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js 15)                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │   Student   │  │   Staff     │  │   Warden    │  │   Login/Signup      │    │
│  │ Dashboard   │  │ Dashboard   │  │ Dashboard   │  │   Page              │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ HTTP Requests
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           API LAYER (Next.js Routes)                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                           AUTHENTICATION                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐                                          │  │
│  │  │  /api/auth/ │  │  /api/auth/ │                                          │  │
│  │  │  signin     │  │  signup     │                                          │  │
│  │  └─────────────┘  └─────────────┘                                          │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                           MEAL MANAGEMENT                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │  │
│  │  │ /api/meal- │  │ /api/meal-  │  │ /api/live/  │                          │  │
│  │  │ optins      │  │ votes       │  │ votes       │                          │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                          │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                           ANALYTICS & ADMIN                                  │  │
│  │  ┌─────────────┐                                                            │  │
│  │  │ /api/warden/│                                                            │  │
│  │  │ kpis        │                                                            │  │
│  │  └─────────────┘                                                            │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ MySQL Queries
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (MySQL 8.0)                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │    USERS    │  │ MEAL_OPTINS │  │ MEAL_VOTES  │  │   WASTE_LOGS        │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘    │
│                                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │MEAL_RATINGS │  │COOKING_TASKS│  │LEFTOVER_ITEMS│  │   INGREDIENT_CATALOG│    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **React Hook Form** - Form handling
- **Recharts** - Data visualization

### Backend
- **Next.js API Routes** - RESTful API endpoints
- **MySQL 8.0** - Relational database
- **mysql2** - MySQL driver
- **bcryptjs** - Password hashing
- **TypeScript** - Type safety

### Key Features
- **Role-based Authentication** (Student, Staff, Warden)
- **Real-time Data Updates** (API polling)
- **Persistent Data Storage** (MySQL)
- **Automatic Schema Initialization**
- **Secure Password Handling** (bcrypt)

## Data Flow

1. **User Authentication**
   - Frontend → `/api/auth/signin` → MySQL users table
   - JWT-like session management (local)

2. **Meal Management**
   - Frontend → `/api/meal-optins` → MySQL meal_optins table
   - Frontend → `/api/meal-votes` → MySQL meal_votes table
   - Live updates via `/api/live/votes` endpoint

3. **Analytics**
   - Frontend → `/api/warden/kpis` → MySQL aggregated queries
   - Real-time KPI calculations

## Security Features

- **Password Hashing** using bcrypt
- **Input Validation** on all API endpoints
- **SQL Injection Prevention** with parameterized queries
- **Type Safety** with TypeScript
- **Environment Variable Protection**
