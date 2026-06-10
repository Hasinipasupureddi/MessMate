# MessMate Database Schema (ER Diagram)

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                       USERS                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  id (VARCHAR(64), PRIMARY KEY)                                                │
│  email (VARCHAR(255), UNIQUE, NOT NULL)                                       │
│  password_hash (VARCHAR(255), NOT NULL)                                       │
│  name (VARCHAR(255), NOT NULL)                                                 │
│  role (ENUM('student', 'staff', 'warden'), NOT NULL)                          │
│  hostel_id (VARCHAR(64), NOT NULL, DEFAULT 'A')                               │
│  created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)                             │
│  updated_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ 1:N
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   MEAL_OPTINS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  id (VARCHAR(64), PRIMARY KEY)                                                │
│  student_id (VARCHAR(64), NOT NULL)      ┌─────────────────────────────────────┐│
│  meal_date (DATE, NOT NULL)             │ FOREIGN KEY: student_id → users.id ││
│  meal_type (ENUM('breakfast', 'lunch',  └─────────────────────────────────────┘│
│  'dinner'), NOT NULL)                                                          │
│  optin_status (ENUM('attending', 'skip', 'takeaway'), NOT NULL)                │
│  portion_size (ENUM('small', 'medium', 'large'), NULL)                         │
│  created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)                             │
│  updated_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)  │
│                                                                                 │
│  UNIQUE KEY (student_id, meal_date, meal_type)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ 1:N
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    MEAL_VOTES                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  id (VARCHAR(64), PRIMARY KEY)                                                │
│  student_id (VARCHAR(64), NOT NULL)      ┌─────────────────────────────────────┐│
│  vote_date (DATE, NOT NULL)             │ FOREIGN KEY: student_id → users.id ││
│  meal_type (ENUM('breakfast', 'lunch'),  └─────────────────────────────────────┘│
│  NOT NULL)                                                                     │
│  dish_option_id (VARCHAR(128), NOT NULL)                                      │
│  dish_name (VARCHAR(255), NOT NULL)                                           │
│  created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)                             │
│  updated_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)  │
│                                                                                 │
│  UNIQUE KEY (student_id, vote_date, meal_type)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ 1:N
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   MEAL_RATINGS                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  id (VARCHAR(64), PRIMARY KEY)                                                │
│  student_id (VARCHAR(64), NOT NULL)      ┌─────────────────────────────────────┐│
│  rating_date (DATE, NOT NULL)           │ FOREIGN KEY: student_id → users.id ││
│  meal_type (ENUM('breakfast', 'lunch',  └─────────────────────────────────────┘│
│  'dinner'), NULL)                                                              │
│  rating (INT, NOT NULL)                                                        │
│  feedback (TEXT, NULL)                                                          │
│  leftover_feedback (BOOLEAN, DEFAULT FALSE)                                     │
│  created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)                             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    WASTE_LOGS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  id (VARCHAR(64), PRIMARY KEY)                                                │
│  staff_id (VARCHAR(64), NULL)          ┌─────────────────────────────────────┐│
│  log_date (DATE, NOT NULL)             │ FOREIGN KEY: staff_id → users.id   ││
│  meal_type (ENUM('breakfast', 'lunch',  └─────────────────────────────────────┘│
│  'dinner'), NULL)                                                              │
│  amount (DECIMAL(10,2), NOT NULL)                                            │
│  unit (ENUM('kg', 'litres', 'pcs'), NOT NULL)                                 │
│  reason (VARCHAR(255), NULL)                                                  │
│  created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)                             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 COOKING_TASKS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  id (VARCHAR(64), PRIMARY KEY)                                                │
│  task_date (DATE, NOT NULL)                                                    │
│  meal_type (ENUM('breakfast', 'lunch', 'dinner'), NOT NULL)                   │
│  task_name (VARCHAR(255), NOT NULL)                                            │
│  status (ENUM('pending', 'in_progress', 'done'), DEFAULT 'pending')           │
│  created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)                             │
│  updated_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                               LEFTOVER_ITEMS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  id (VARCHAR(64), PRIMARY KEY)                                                │
│  meal_date (DATE, NOT NULL)                                                    │
│  meal_type (ENUM('breakfast', 'lunch', 'dinner'), NOT NULL)                   │
│  dish_name (VARCHAR(255), NOT NULL)                                           │
│  emoji (VARCHAR(16), NULL)                                                     │
│  total_portions (INT, NOT NULL)                                                │
│  claimed_count (INT, DEFAULT 0)                                                │
│  available_until (DATETIME, NOT NULL)                                          │
│  is_active (BOOLEAN, DEFAULT TRUE)                                             │
│  created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)                             │
│  updated_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ 1:N
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               LEFTOVER_CLAIMS                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  id (VARCHAR(64), PRIMARY KEY)                                                │
│  leftover_id (VARCHAR(64), NOT NULL)   ┌─────────────────────────────────────┐│
│  user_id (VARCHAR(64), NOT NULL)      │ FOREIGN KEY: leftover_id →        ││
│  claimed_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)                             │  │
│                                       │ LEFTOVER_ITEMS.id                   ││
│  UNIQUE KEY (leftover_id, user_id)   │ FOREIGN KEY: user_id → users.id      ││
│                                       └─────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                             INGREDIENT_CATALOG                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  id (VARCHAR(64), PRIMARY KEY)                                                │
│  ingredient_name (VARCHAR(255), NOT NULL)                                      │
│  unit (ENUM('kg', 'litres', 'pcs'), NOT NULL)                                 │
│  per_person_qty (DECIMAL(10,4), DEFAULT 0)                                     │
│  created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)                             │
│  updated_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Schema Relationships Summary

### Primary Entities
- **USERS**: Central entity for all user types (students, staff, wardens)
- **MEAL_OPTINS**: Student meal opt-ins with unique constraint per student/date/meal
- **MEAL_VOTES**: Student voting for meal options
- **MEAL_RATINGS**: Student feedback and ratings for meals

### Supporting Entities
- **WASTE_LOGS**: Food waste tracking by staff
- **COOKING_TASKS**: Kitchen task management
- **LEFTOVER_ITEMS**: Available leftover food for claiming
- **LEFTOVER_CLAIMS**: User claims for leftover items
- **INGREDIENT_CATALOG**: Ingredient inventory and planning

### Key Relationships
1. **USERS** (1:N) → **MEAL_OPTINS** (student_id)
2. **USERS** (1:N) → **MEAL_VOTES** (student_id)
3. **USERS** (1:N) → **MEAL_RATINGS** (student_id)
4. **USERS** (1:N) → **WASTE_LOGS** (staff_id)
5. **LEFTOVER_ITEMS** (1:N) → **LEFTOVER_CLAIMS** (leftover_id)
6. **USERS** (1:N) → **LEFTOVER_CLAIMS** (user_id)

### Business Rules
- Each student can opt-in for exactly one option per meal type per day
- Each student can vote once per meal type per day
- Each user can claim each leftover item only once
- Staff (not students) can log waste entries
- All timestamps are automatically managed

## Data Integrity Constraints

### Unique Constraints
- `users.email` - No duplicate emails
- `meal_optins(student_id, meal_date, meal_type)` - One opt-in per meal per day
- `meal_votes(student_id, vote_date, meal_type)` - One vote per meal per day
- `leftover_claims(leftover_id, user_id)` - One claim per user per item

### Foreign Key Constraints
- All `student_id` fields reference `users.id`
- `staff_id` references `users.id` (staff role only)
- `leftover_id` references `leftover_items.id`
- `user_id` in claims references `users.id`

### Default Values
- `hostel_id` defaults to 'A' for users
- `created_at` defaults to current timestamp
- `updated_at` auto-updates on record changes
- `is_active` defaults to TRUE for leftover items

## Index Strategy

### Primary Keys
- All tables use VARCHAR(64) primary keys for UUID-like identifiers

### Foreign Key Indexes
- All foreign key columns are automatically indexed

### Unique Indexes
- Email uniqueness for users
- Composite unique constraints for meal opt-ins and votes

### Performance Considerations
- Date-based queries are optimized with proper indexing
- Enum fields provide efficient categorization
- Timestamp fields support time-based analytics
