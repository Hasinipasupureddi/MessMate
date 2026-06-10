-- MessMate bootstrap schema
-- Canonical mappings:
--   meal_votes  = menu voting storage
--   waste_logs  = food waste analytics storage

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('student', 'staff', 'warden') NOT NULL DEFAULT 'student',
  hostel_id VARCHAR(64) NOT NULL DEFAULT 'A',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meals (
  id VARCHAR(72) NOT NULL PRIMARY KEY,
  meal_date DATE NOT NULL,
  name ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_meals_slot (meal_date, name),
  KEY idx_meals_date (meal_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_optins (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  meal_id VARCHAR(72) NULL,
  meal_date DATE NOT NULL,
  meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
  optin_status ENUM('attending', 'skip', 'takeaway') NOT NULL,
  portion_size ENUM('small', 'medium', 'large') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_meal_optin_student_meal (student_id, meal_id),
  KEY idx_meal_optins_student_date (student_id, meal_date),
  KEY idx_meal_optins_meal_date (meal_date),
  CONSTRAINT fk_meal_optins_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_meal_optins_meal FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_votes (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  vote_date DATE NOT NULL,
  meal_date DATE NOT NULL,
  meal_type ENUM('breakfast', 'lunch') NOT NULL,
  menu_option VARCHAR(255) NOT NULL,
  dish_option_id VARCHAR(128) NOT NULL,
  dish_name VARCHAR(255) NOT NULL,
  voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_meal_vote (student_id, vote_date, meal_type),
  KEY idx_meal_votes_date (vote_date),
  KEY idx_meal_votes_meal_type (meal_type),
  KEY idx_meal_votes_student (student_id),
  CONSTRAINT fk_meal_votes_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_ratings (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  rating_date DATE NOT NULL,
  meal_type ENUM('breakfast', 'lunch', 'dinner') NULL,
  dish_name VARCHAR(255) NULL,
  rating INT NOT NULL,
  waste_amount VARCHAR(32) NOT NULL DEFAULT 'none',
  feedback TEXT NULL,
  leftover_feedback BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_meal_rating (student_id, rating_date, meal_type),
  KEY idx_meal_ratings_date (rating_date),
  KEY idx_meal_ratings_student (student_id),
  CONSTRAINT fk_meal_ratings_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  meal_id VARCHAR(72) NULL,
  meal_date DATE NOT NULL,
  meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
  status ENUM('present', 'absent', 'late', 'excused') NOT NULL DEFAULT 'present',
  marked_by VARCHAR(64) NULL,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  UNIQUE KEY uk_attendance_student_meal (student_id, meal_date, meal_type),
  KEY idx_attendance_date (meal_date),
  KEY idx_attendance_status (status),
  KEY idx_attendance_student (student_id),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_attendance_meal FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_attendance_marked_by FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  entity_type VARCHAR(64) NULL,
  entity_id VARCHAR(64) NULL,
  payload JSON NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_notifications_user_read (user_id, is_read),
  KEY idx_notifications_created_at (created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feedback (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  meal_id VARCHAR(72) NULL,
  meal_date DATE NULL,
  meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NULL,
  category VARCHAR(64) NOT NULL,
  rating INT NULL,
  message TEXT NOT NULL,
  sentiment ENUM('positive', 'neutral', 'negative') NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_feedback_user (user_id),
  KEY idx_feedback_category (category),
  KEY idx_feedback_meal_date (meal_date),
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_feedback_meal FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS waste_logs (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  staff_id VARCHAR(64) NULL,
  log_date DATE NOT NULL,
  meal_type ENUM('breakfast', 'lunch', 'dinner') NULL,
  amount DECIMAL(10, 2) NOT NULL,
  unit ENUM('kg', 'litres', 'pcs') NOT NULL,
  reason VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_waste_logs_date (log_date),
  KEY idx_waste_logs_staff (staff_id),
  KEY idx_waste_logs_meal_type (meal_type),
  CONSTRAINT fk_waste_logs_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS complaints (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  assigned_to VARCHAR(64) NULL,
  category VARCHAR(64) NOT NULL,
  complaint_text TEXT NOT NULL,
  description TEXT NULL,
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  status ENUM('open', 'in-progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_complaints_student (student_id),
  KEY idx_complaints_status (status),
  KEY idx_complaints_created_at (created_at),
  KEY idx_complaints_assigned_to (assigned_to),
  CONSTRAINT fk_complaints_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_complaints_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leftover_items (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  meal_date DATE NOT NULL,
  meal_type ENUM('breakfast', 'lunch', 'dinner') NOT NULL,
  dish_name VARCHAR(255) NOT NULL,
  emoji VARCHAR(16) NULL,
  total_portions INT NOT NULL,
  claimed_count INT NOT NULL DEFAULT 0,
  available_until DATETIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_leftover_items_date (meal_date),
  KEY idx_leftover_items_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leftover_claims (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  leftover_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_leftover_claim (leftover_id, user_id),
  KEY idx_leftover_claims_user (user_id),
  CONSTRAINT fk_leftover_claims_leftover FOREIGN KEY (leftover_id) REFERENCES leftover_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_leftover_claims_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cooking_tasks (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  task_date DATE NOT NULL,
  meal_type ENUM('breakfast', 'lunch', 'dinner') NOT NULL,
  task_name VARCHAR(255) NOT NULL,
  status ENUM('pending', 'in_progress', 'done') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_cooking_tasks_date (task_date),
  KEY idx_cooking_tasks_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingredient_catalog (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  ingredient_name VARCHAR(255) NOT NULL,
  unit ENUM('kg', 'litres', 'pcs') NOT NULL,
  per_person_qty DECIMAL(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ingredient_catalog_name (ingredient_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
