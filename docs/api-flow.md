# MessMate API Flow Diagram

## Authentication Flow

```
Frontend (Login Page)
        │
        ▼ POST /api/auth/signin
        │ {email, password}
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Authentication API                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Validate input (email, password)                                          │
│  2. Check demo users first                                                    │
│  3. Query MySQL users table                                                   │
│  4. Compare password using bcrypt                                             │
│  5. Return user object with role                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ Response: {user: {id, email, name, role, hostelId}, session}
        │
        ▼
Frontend (Redirect to role-based dashboard)
```

## User Registration Flow

```
Frontend (Signup Page)
        │
        ▼ POST /api/auth/signup
        │ {email, password, name, role, hostelId}
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Registration API                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Validate input (email, password strength, role)                           │
│  2. Check if user already exists                                              │
│  3. Hash password using bcrypt                                                │
│  4. Generate unique user ID                                                    │
│  5. Insert into MySQL users table                                             │
│  6. Return user object                                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ Response: {user: {id, email, name, role, hostelId}, session}
        │
        ▼
Frontend (Auto-login and redirect)
```

## Meal Opt-in Flow

```
Frontend (Student Dashboard)
        │
        ▼ GET /api/meal-optins?studentId=xxx&date=yyyy-mm-dd
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Meal Opt-ins API                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Ensure MySQL schema exists                                                 │
│  2. Query meal_optins table                                                   │
│  3. Filter by student_id and date                                              │
│  4. Return opt-in records                                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ Response: {rows: [optin_records]}
        │
        ▼
Frontend (Display opt-in status)

---

Frontend (Student Dashboard - Opt-in Action)
        │
        ▼ PUT /api/meal-optins
        │ {studentId, mealDate, mealType, status}
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Meal Opt-ins API                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Validate input (studentId, mealDate, mealType, status)                   │
│  2. Normalize status ('will_eat' → 'attending')                               │
│  3. Generate unique opt-in ID                                                  │
│  4. Insert/Update meal_optins table                                           │
│  5. Return created/updated record                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ Response: {row: optin_record}
        │
        ▼
Frontend (Update UI with new status)
```

## Meal Voting Flow

```
Frontend (Student Dashboard - Voting)
        │
        ▼ GET /api/meal-votes?date=yyyy-mm-dd
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Meal Votes API                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Ensure MySQL schema exists                                                 │
│  2. Query meal_votes table                                                     │
│  3. Group by dish_option_id and count votes                                   │
│  4. Return aggregated vote counts                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ Response: {rows: [meal_type, dish_option_id, total_votes]}
        │
        ▼
Frontend (Display vote counts)

---

Frontend (Student Dashboard - Vote Action)
        │
        ▼ PUT /api/meal-votes
        │ {votes: [{studentId, voteDate, mealType, dishOptionId, dishName}]}
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Meal Votes API                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Validate each vote payload                                                 │
│  2. Ensure MySQL schema exists                                                 │
│  3. For each vote:                                                            │
│     a. Generate unique vote ID                                                 │
│     b. Insert/Update meal_votes table                                         │
│  4. Return success confirmation                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ Response: {success: true}
        │
        ▼
Frontend (Refresh vote counts)
```

## Live Data Updates Flow

```
Frontend (Live Display Screen)
        │
        ▼ GET /api/live/votes?date=yyyy-mm-dd (polling every 5 seconds)
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Live Votes API                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Query meal_votes table for current date                                   │
│  2. Group by dish_option_id and meal_type                                     │
│  3. Count votes for each dish                                                  │
│  4. Return real-time vote data                                                │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ Response: {rows: [meal_type, dish_option_id, total_votes]}
        │
        ▼
Frontend (Update live display)
```

## Analytics/KPIs Flow

```
Frontend (Warden Dashboard)
        │
        ▼ GET /api/warden/kpis?date=yyyy-mm-dd
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Warden KPIs API                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Count meal opt-ins for date (status = 'attending')                        │
│  2. Sum waste logs for date (unit = 'kg')                                     │
│  3. Calculate average meal ratings for date                                   │
│  4. Count total students                                                      │
│  5. Return KPI metrics                                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ Response: {totalWasteKg, avgRating, totalOptins, totalStudents}
        │
        ▼
Frontend (Display analytics dashboard)
```

## Error Handling Flow

```
Any API Endpoint
        │
        ▼ Error Occurs
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Error Handling                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Log error to console                                                      │
│  2. Return appropriate HTTP status code                                       │
│  3. Return error message in JSON format                                       │
│  4. Frontend displays user-friendly error message                             │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ Response: {message: "Error description"}
        │
        ▼
Frontend (Show error toast/notification)
```

## Database Connection Flow

```
Any API Endpoint
        │
        ▼ Database Operation Required
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Database Connection                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Get MySQL connection pool (singleton pattern)                              │
│  2. Ensure schema exists (auto-create if needed)                              │
│  3. Execute parameterized query                                               │
│  4. Handle MySQL errors                                                       │
│  5. Return results                                                            │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ Query Results
        │
        ▼
API Endpoint (Process results and return response)
```

## Security Flow

```
Any API Endpoint
        │
        ▼ Request Received
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Security Layer                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Input validation (required fields, data types)                           │
│  2. SQL injection prevention (parameterized queries)                         │
│  3. Password security (bcrypt hashing)                                        │
│  4. Rate limiting (implicit through connection pool)                           │
│  5. Error information sanitization                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼ Validated Request
        │
        ▼
Business Logic Processing
```

## API Response Format Standards

### Success Response
```json
{
  "data": { ... } | "rows": [ ... ] | "success": true
}
```

### Error Response
```json
{
  "message": "Human readable error description"
}
```

### Authentication Response
```json
{
  "user": {
    "id": "string",
    "email": "string", 
    "name": "string",
    "role": "student|staff|warden",
    "hostelId": "string"
  },
  "session": { "local": true }
}
```

## Performance Considerations

### Connection Pooling
- Single MySQL connection pool per application
- Automatic connection reuse
- Configured for 10 concurrent connections

### Query Optimization
- Indexed primary and foreign keys
- Date-based queries optimized
- Enum fields for efficient filtering

### Caching Strategy
- Schema initialization cached
- Connection pooling reduces overhead
- No application-level caching (real-time data priority)

### Rate Limiting
- Implicit rate limiting through connection pool
- No explicit rate limiting implemented
- Depends on MySQL connection availability
