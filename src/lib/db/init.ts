import bcrypt from 'bcryptjs';
import { getMysqlPool } from '@/lib/db/mysql';
import { runMealSchemaMigrations } from '@/lib/db/mealMigrations';

let schemaPromise: Promise<void> | null = null;

export async function ensureMysqlSchema(): Promise<void> {
  if (process.env.MESSMATE_SKIP_SCHEMA_INIT === '1') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[messmate] MESSMATE_SKIP_SCHEMA_INIT=1 — skipping ensureMysqlSchema (APIs that need MySQL will error until disabled).'
      );
    }
    return;
  }

  if (schemaPromise) {
    return schemaPromise;
  }

  const schemaInitTimeoutMs = Math.min(
    Math.max(Number(process.env.MESSMATE_SCHEMA_INIT_TIMEOUT_MS || 120_000), 10_000),
    600_000
  );

  const runSchema = async () => {
    const pool = getMysqlPool();
    const today = new Date().toISOString().slice(0, 10);

    // Ensure session SQL mode doesn't reject zero-dates during schema migrations
    // Some MySQL servers use NO_ZERO_DATE / NO_ZERO_IN_DATE which cause errors
    // when legacy or placeholder dates like '0000-00-00' are encountered.
    try {
      await pool.query(
        `SET SESSION sql_mode = (SELECT REPLACE(REPLACE(@@sql_mode, 'NO_ZERO_DATE', ''), 'NO_ZERO_IN_DATE', ''))`
      );
    } catch (e) {
      // Non-fatal: if the server doesn't support setting sql_mode this way,
      // continue and let later queries surface their own errors.
      // eslint-disable-next-line no-console
      console.warn('[messmate] could not adjust sql_mode for session:', (e as Error).message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_master (
        roll_no VARCHAR(30) PRIMARY KEY,
        student_name VARCHAR(100),
        branch VARCHAR(50),
        year INT,
        hostel_block VARCHAR(20)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        roll_no VARCHAR(30) UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('student', 'staff', 'warden') NOT NULL DEFAULT 'student',
        hostel_id VARCHAR(64) NOT NULL DEFAULT 'A',
        food_preference ENUM('veg', 'non_veg') NOT NULL DEFAULT 'non_veg',
        account_status ENUM('pending', 'approved', 'rejected', 'disabled') NOT NULL DEFAULT 'pending',
        email_verified BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const [[rollNoColumn]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'roll_no'`
    )) as any;
    if (Number(rollNoColumn?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE users ADD COLUMN roll_no VARCHAR(30) UNIQUE AFTER id`);
    }

    const [[emailVerifiedColumn]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified'`
    )) as any;
    if (Number(emailVerifiedColumn?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE AFTER account_status`);
    } else {
      await pool.query(`ALTER TABLE users MODIFY COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE`);
      await pool.query(`UPDATE users SET email_verified = TRUE`);
    }

    const [[accountStatusColumn]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'account_status'`
    )) as any;
    if (Number(accountStatusColumn?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE users ADD COLUMN account_status ENUM('pending', 'approved', 'rejected', 'disabled') NOT NULL DEFAULT 'pending' AFTER food_preference`);
    } else {
      await pool.query(`ALTER TABLE users MODIFY COLUMN account_status ENUM('pending', 'approved', 'rejected', 'disabled') NOT NULL DEFAULT 'pending'`);
    }

    const [[foodPrefColumn]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'food_preference'`
    )) as any;
    if (Number(foodPrefColumn?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE users ADD COLUMN food_preference ENUM('veg', 'non_veg') NOT NULL DEFAULT 'non_veg' AFTER hostel_id`);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_password_reset_token_hash (token_hash),
        KEY idx_password_reset_user (user_id),
        KEY idx_password_reset_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS meals (
        id VARCHAR(72) NOT NULL PRIMARY KEY,
        meal_date DATE NOT NULL,
        name ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_meals_slot (meal_date, name),
        KEY idx_meals_date (meal_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS meal_optins (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        student_id VARCHAR(64) NOT NULL,
        meal_date DATE NOT NULL,
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
        optin_status ENUM('attending', 'skip', 'takeaway') NOT NULL,
        portion_size ENUM('small', 'medium', 'large') NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_meal_optin (student_id, meal_date, meal_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      ALTER TABLE meals
      MODIFY COLUMN name ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL
    `);

    await pool.query(`
      ALTER TABLE meal_optins
      MODIFY COLUMN meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL
    `);

    await runMealSchemaMigrations(pool);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS meal_votes (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        student_id VARCHAR(64) NOT NULL,
        vote_date DATE NOT NULL,
        meal_date DATE NOT NULL,
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
        category_key VARCHAR(128) NOT NULL DEFAULT 'main',
        menu_option VARCHAR(255) NOT NULL,
        dish_option_id VARCHAR(128) NOT NULL,
        dish_name VARCHAR(255) NOT NULL,
        voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_meal_vote (student_id, vote_date, meal_type, category_key, menu_option)
      )
    `);

    // Add category_key to meal_votes if it doesn't exist
    const [[categoryKeyRow]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meal_votes' AND COLUMN_NAME = 'category_key'`
    )) as any;
    if (Number(categoryKeyRow?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE meal_votes ADD COLUMN category_key VARCHAR(128) NOT NULL DEFAULT 'main' AFTER meal_type`);
    }

    // Update meal_type enum for meal_votes
    await pool.query(`ALTER TABLE meal_votes MODIFY COLUMN meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL`);

    // Update unique key of meal_votes
    try {
      await pool.query(`ALTER TABLE meal_votes DROP INDEX uk_meal_vote`);
    } catch (e) {}
    try {
      await pool.query(`ALTER TABLE meal_votes ADD UNIQUE KEY uk_meal_vote (student_id, vote_date, meal_type, category_key, menu_option)`);
    } catch (e) {
      // Index might already be correct or drop failed
    }

    // Update menu_rotation table with stats
    try {
      const [[timesShownCol]] = (await pool.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_rotation' AND COLUMN_NAME = 'times_shown'`
      )) as any;
      if (Number(timesShownCol?.cnt ?? 0) === 0) {
        await pool.query(`ALTER TABLE menu_rotation 
          ADD COLUMN times_shown INT NOT NULL DEFAULT 0,
          ADD COLUMN times_won INT NOT NULL DEFAULT 0,
          ADD COLUMN last_offered_date DATE NULL AFTER last_served_date`);
      }
    } catch (err) {
      // menu_rotation may not exist yet, or the columns may already be present.
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vote_options (
        id VARCHAR(128) NOT NULL,
        vote_date DATE NOT NULL,
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
        category_key VARCHAR(128) NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        item_emoji VARCHAR(16) NULL,
        item_group JSON NULL,
        cooldown_weeks INT NOT NULL DEFAULT 3,
        diet_preference ENUM('veg', 'non_veg', 'both') DEFAULT 'both',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (vote_date, meal_type, id),
        KEY idx_vote_options_date (vote_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Migration: If id was the only primary key, we need to drop it and add the composite one.
    // However, in a production-like dev environment, it's safer to just check and modify.
    const [[pkRow]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'vote_options' AND CONSTRAINT_TYPE = 'PRIMARY KEY'`
    )) as any;
    
    // Check if the PK is just 'id'
    const [pkColumns] = (await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vote_options' AND CONSTRAINT_NAME = 'PRIMARY KEY'`
    )) as any[];
    
    if (pkColumns.length === 1 && pkColumns[0].COLUMN_NAME === 'id') {
      await pool.query(`ALTER TABLE vote_options DROP PRIMARY KEY, ADD PRIMARY KEY (vote_date, meal_type, id)`);
    }

    // Add diet_preference if it doesn't exist
    const [[dietPrefCol]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vote_options' AND COLUMN_NAME = 'diet_preference'`
    )) as any;
    if (Number(dietPrefCol?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE vote_options ADD COLUMN diet_preference ENUM('veg', 'non_veg', 'both') DEFAULT 'both'`);
    }

    // Add original_catalog_id if it doesn't exist
    const [[origIdCol]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vote_options' AND COLUMN_NAME = 'original_catalog_id'`
    )) as any;
    if (Number(origIdCol?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE vote_options ADD COLUMN original_catalog_id VARCHAR(128) NULL AFTER id`);
    }

    // Update meal_type enum for vote_options
    await pool.query(`ALTER TABLE vote_options MODIFY COLUMN meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS final_menu (
        menu_date DATE NOT NULL,
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
        category_key VARCHAR(128) NOT NULL,
        winning_item_id VARCHAR(128) NOT NULL,
        winning_item_name VARCHAR(255) NOT NULL,
        winning_items_json JSON NOT NULL,
        status ENUM('awaiting_approval', 'approved') NOT NULL DEFAULT 'awaiting_approval',
        winner_source ENUM('votes', 'staff_override') NOT NULL DEFAULT 'votes',
        override_reason TEXT NULL,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (menu_date, meal_type),
        KEY idx_final_menu_meal (meal_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS warden_menu_feedback (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        menu_date DATE NOT NULL,
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NULL,
        warden_id VARCHAR(64) NOT NULL,
        action ENUM('approve', 'request_changes') NOT NULL DEFAULT 'request_changes',
        comment TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_warden_menu_feedback_date (menu_date),
        KEY idx_warden_menu_feedback_warden (warden_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`ALTER TABLE warden_menu_feedback MODIFY COLUMN meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NULL`);

    // Add status if it doesn't exist
    const [[statusCol]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'final_menu' AND COLUMN_NAME = 'status'`
    )) as any;
    if (Number(statusCol?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE final_menu ADD COLUMN status ENUM('awaiting_approval', 'approved') NOT NULL DEFAULT 'awaiting_approval' AFTER winning_items_json`);
    }

    const [[winnerSourceCol]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'final_menu' AND COLUMN_NAME = 'winner_source'`
    )) as any;
    if (Number(winnerSourceCol?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE final_menu ADD COLUMN winner_source ENUM('votes', 'staff_override') NOT NULL DEFAULT 'votes' AFTER status`);
    }

    const [[overrideReasonCol]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'final_menu' AND COLUMN_NAME = 'override_reason'`
    )) as any;
    if (Number(overrideReasonCol?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE final_menu ADD COLUMN override_reason TEXT NULL AFTER winner_source`);
    }

    // Update meal_type enum for final_menu
    await pool.query(`ALTER TABLE final_menu MODIFY COLUMN meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_rotation (
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
        option_id VARCHAR(128) NOT NULL,
        last_served_date DATE NULL,
        last_offered_date DATE NULL,
        times_shown INT NOT NULL DEFAULT 0,
        times_won INT NOT NULL DEFAULT 0,
        served_in_cycle BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (meal_type, option_id),
        KEY idx_menu_rotation_last_served (last_served_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Update meal_type enum for menu_rotation
    await pool.query(`ALTER TABLE menu_rotation MODIFY COLUMN meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS meal_ratings (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        student_id VARCHAR(64) NOT NULL,
        rating_date DATE NOT NULL,
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NULL,
        dish_name VARCHAR(255) NULL,
        rating INT NOT NULL,
        waste_amount VARCHAR(32) NOT NULL DEFAULT 'none',
        feedback TEXT NULL,
        leftover_feedback BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_meal_rating (student_id, rating_date, meal_type)
      )
    `);

    await pool.query(`ALTER TABLE meal_ratings MODIFY COLUMN meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NULL`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS waste_logs (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        staff_id VARCHAR(64) NULL,
        log_date DATE NOT NULL,
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NULL,
        dish_name VARCHAR(255) NULL,
        amount DECIMAL(10, 2) NOT NULL,
        unit ENUM('kg', 'litres', 'pcs') NOT NULL,
        reason VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [[wasteDishRow]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'waste_logs' AND COLUMN_NAME = 'dish_name'`
    )) as any;
    if (Number(wasteDishRow?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE waste_logs ADD COLUMN dish_name VARCHAR(255) NULL AFTER meal_type`);
    }

    await pool.query(`ALTER TABLE waste_logs MODIFY COLUMN meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NULL`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS leftover_items (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        meal_date DATE NOT NULL,
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
        dish_name VARCHAR(255) NOT NULL,
        emoji VARCHAR(16) NULL,
        total_portions INT NOT NULL,
        claimed_count INT NOT NULL DEFAULT 0,
        available_until DATETIME NOT NULL,
        status ENUM('available', 'claimed', 'expired', 'cancelled') NOT NULL DEFAULT 'available',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const [[leftoverStatusRow]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leftover_items' AND COLUMN_NAME = 'status'`
    )) as any;
    if (Number(leftoverStatusRow?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE leftover_items ADD COLUMN status ENUM('available', 'claimed', 'expired', 'cancelled') NOT NULL DEFAULT 'available' AFTER available_until`);
    }

    await pool.query(`ALTER TABLE leftover_items MODIFY COLUMN meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS leftover_claims (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        leftover_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_leftover_claim (leftover_id, user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS leftover_declarations (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        meal_date DATE NOT NULL,
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
        status ENUM('pending', 'declared', 'none') NOT NULL DEFAULT 'pending',
        declared_by VARCHAR(64) NULL,
        note VARCHAR(255) NULL,
        dish_name VARCHAR(255) NULL,
        emoji VARCHAR(16) NULL,
        total_portions INT NULL,
        available_until DATETIME NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_leftover_declaration (meal_date, meal_type)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS leftover_checklist (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        checklist_date DATE NOT NULL,
        item_key VARCHAR(64) NOT NULL,
        label VARCHAR(255) NOT NULL,
        is_done BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_leftover_checklist (checklist_date, item_key),
        KEY idx_leftover_checklist_date (checklist_date)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        student_id VARCHAR(64) NOT NULL,
        category VARCHAR(64) NOT NULL,
        complaint_text TEXT NOT NULL,
        description TEXT NULL,
        status ENUM('open', 'in-progress', 'resolved') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_complaints_student (student_id),
        KEY idx_complaints_status (status)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('info', 'success', 'warning', 'error') NOT NULL DEFAULT 'info',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_notifications_user (user_id),
        KEY idx_notifications_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [[complaintsDescRow]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints' AND COLUMN_NAME = 'description'`
    )) as any;
    if (Number(complaintsDescRow?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE complaints ADD COLUMN description TEXT NULL AFTER complaint_text`);
    }
    await pool.query(`UPDATE complaints SET status = 'in-progress' WHERE status = 'reviewing'`);
    await pool.query(`ALTER TABLE complaints MODIFY COLUMN status ENUM('open', 'in-progress', 'resolved') NOT NULL DEFAULT 'open'`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cooking_tasks (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        task_date DATE NOT NULL,
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
        task_name VARCHAR(255) NOT NULL,
        status ENUM('pending', 'in_progress', 'done') NOT NULL DEFAULT 'pending',
        assigned_to VARCHAR(128) NULL,
        portions INT NOT NULL DEFAULT 0,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Add columns if they don't exist
    const [[assignedToCol]] = (await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cooking_tasks' AND COLUMN_NAME = 'assigned_to'`
    )) as any;
    if (Number(assignedToCol?.cnt ?? 0) === 0) {
      await pool.query(`ALTER TABLE cooking_tasks ADD COLUMN assigned_to VARCHAR(128) NULL AFTER status`);
      await pool.query(`ALTER TABLE cooking_tasks ADD COLUMN portions INT NOT NULL DEFAULT 0 AFTER assigned_to`);
      await pool.query(`ALTER TABLE cooking_tasks ADD COLUMN notes TEXT NULL AFTER portions`);
    }

    await pool.query(`ALTER TABLE cooking_tasks MODIFY COLUMN meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingredient_catalog (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        ingredient_name VARCHAR(255) NOT NULL,
        unit ENUM('kg', 'litres', 'pcs') NOT NULL,
        per_person_qty DECIMAL(10, 4) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingredient_stock (
        ingredient_id VARCHAR(64) NOT NULL PRIMARY KEY,
        current_stock DECIMAL(10, 2) NOT NULL DEFAULT 0,
        reorder_threshold DECIMAL(10, 2) NOT NULL DEFAULT 0,
        unit ENUM('kg', 'litres', 'pcs') NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (ingredient_id) REFERENCES ingredient_catalog(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        ingredient_id VARCHAR(64) NOT NULL,
        requested_qty DECIMAL(10, 2) NOT NULL,
        unit ENUM('kg', 'litres', 'pcs') NOT NULL,
        status ENUM('requested', 'ordered', 'received', 'cancelled') NOT NULL DEFAULT 'requested',
        requested_by VARCHAR(128) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (ingredient_id) REFERENCES ingredient_catalog(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_ingredient_plan (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        plan_date DATE NOT NULL,
        ingredient_id VARCHAR(64) NULL,
        ingredient_name VARCHAR(255) NOT NULL,
        planned_qty DECIMAL(10, 2) NOT NULL DEFAULT 0,
        actual_qty DECIMAL(10, 2) NULL,
        added_by VARCHAR(128) NULL,
        is_custom BOOLEAN NOT NULL DEFAULT FALSE,
        is_removed BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (ingredient_id) REFERENCES ingredient_catalog(id) ON DELETE CASCADE
      )
    `);

    // Seed student master data
    await pool.query(
      `INSERT INTO student_master (roll_no, student_name, branch, year, hostel_block)
       VALUES
         ('2023CS001', 'Arjun Mehta', 'Computer Science', 3, 'A')
       ON DUPLICATE KEY UPDATE
         student_name = VALUES(student_name),
         branch = VALUES(branch),
         year = VALUES(year),
         hostel_block = VALUES(hostel_block)`
    );

    const [studentHash, staffHash, wardenHash] = await Promise.all([
      bcrypt.hash('Student@2026', 10),
      bcrypt.hash('Cook@2026', 10),
      bcrypt.hash('Warden@2026', 10),
    ]);

    await pool.query(
      `INSERT INTO users (id, roll_no, email, password_hash, name, role, hostel_id, food_preference, account_status, email_verified)
       VALUES
         ('demo-student-1', '2023CS001', 'arjun.mehta@messmate.in', ?, 'Arjun Mehta', 'student', 'A', 'veg', 'approved', TRUE),
         ('demo-staff-1',   NULL,        'raju.cook@messmate.in',   ?, 'Raju Cook',   'staff',   'A', 'non_veg', 'approved', TRUE),
         ('demo-warden-1',  NULL,        'dr.sharma@messmate.in',   ?, 'Dr Sharma',   'warden',  'A', 'non_veg', 'approved', TRUE)
       ON DUPLICATE KEY UPDATE
         roll_no = VALUES(roll_no),
         password_hash = VALUES(password_hash),
         name = VALUES(name),
         role = VALUES(role),
         hostel_id = VALUES(hostel_id),
         food_preference = VALUES(food_preference),
         account_status = VALUES(account_status),
         email_verified = TRUE`,
      [studentHash, staffHash, wardenHash]
    );

    // Seed ingredient catalog entries if missing
    await pool.query(
      `INSERT INTO ingredient_catalog (id, ingredient_name, unit, per_person_qty)
       VALUES
         ('ing-rice', 'Rice', 'kg', 0.3),
         ('ing-dal', 'Toor Dal', 'kg', 0.12),
         ('ing-tomato', 'Tomatoes', 'kg', 0.08),
         ('ing-onion', 'Onions', 'kg', 0.06),
         ('ing-potato', 'Potatoes', 'kg', 0.1),
         ('ing-oil', 'Cooking Oil', 'litres', 0.015),
         ('ing-curd', 'Curd', 'litres', 0.15),
         ('ing-tamarind', 'Tamarind', 'kg', 0.005),
         ('ing-idly-batter', 'Idly Batter', 'kg', 0.18),
         ('ing-coconut', 'Coconut', 'pcs', 0.02),
         ('ing-wheat-flour', 'Wheat Flour', 'kg', 0.12)
       ON DUPLICATE KEY UPDATE
         ingredient_name = VALUES(ingredient_name),
         unit = VALUES(unit),
         per_person_qty = VALUES(per_person_qty)`,
      []
    );

    await pool.query(
      `INSERT INTO ingredient_stock (ingredient_id, current_stock, reorder_threshold, unit)
       VALUES
         ('ing-rice', 85, 22, 'kg'),
         ('ing-dal', 32, 12, 'kg'),
         ('ing-tomato', 18, 6, 'kg'),
         ('ing-onion', 22, 8, 'kg'),
         ('ing-potato', 28, 10, 'kg'),
         ('ing-oil', 12, 3, 'litres'),
         ('ing-curd', 35, 10, 'litres'),
         ('ing-tamarind', 3.5, 1, 'kg'),
         ('ing-idly-batter', 0, 8, 'kg'),
         ('ing-coconut', 24, 6, 'pcs'),
         ('ing-wheat-flour', 15, 8, 'kg')
       ON DUPLICATE KEY UPDATE
         current_stock = VALUES(current_stock),
         reorder_threshold = VALUES(reorder_threshold),
         unit = VALUES(unit)`,
      []
    );

    await pool.query(`
      CREATE TABLE IF NOT EXISTS budget_settings (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        hostel_id VARCHAR(64) NOT NULL,
        monthly_budget DECIMAL(12, 2) NOT NULL,
        expected_cost_per_student DECIMAL(10, 2) NOT NULL,
        effective_from DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_hostel_budget (hostel_id, effective_from)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        contact_person VARCHAR(255) NULL,
        phone VARCHAR(20) NULL,
        address TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS procurement_purchases (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        vendor_id VARCHAR(64) NOT NULL,
        ingredient_id VARCHAR(64) NULL,
        item_name VARCHAR(255) NOT NULL,
        category ENUM('grains', 'vegetables', 'dairy', 'oil', 'pulses', 'misc') NOT NULL DEFAULT 'misc',
        quantity DECIMAL(10, 2) NOT NULL,
        unit ENUM('kg', 'litres', 'pcs') NOT NULL,
        total_cost DECIMAL(12, 2) NOT NULL,
        invoice_no VARCHAR(100) NULL,
        purchase_date DATE NOT NULL,
        staff_id VARCHAR(64) NOT NULL,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
        FOREIGN KEY (ingredient_id) REFERENCES ingredient_catalog(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS meal_cost_config (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL,
        base_cost_per_portion DECIMAL(10, 2) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_meal_cost (meal_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Seed default vendors if empty
    const [[vendorCount]] = (await pool.query(`SELECT COUNT(*) as cnt FROM vendors`)) as any;
    if (Number(vendorCount?.cnt ?? 0) === 0) {
      await pool.query(`
        INSERT INTO vendors (id, name, category) VALUES
        ('v-1', 'Sri Lakshmi Traders', 'grains'),
        ('v-2', 'Fresh Veg Market', 'vegetables'),
        ('v-3', 'Dairy Fresh Co', 'dairy'),
        ('v-4', 'Quality Oils Ltd', 'oil')
      `);
    }

    // Seed default meal costs if empty
    const [[mealCostCount]] = (await pool.query(`SELECT COUNT(*) as cnt FROM meal_cost_config`)) as any;
    if (Number(mealCostCount?.cnt ?? 0) === 0) {
      await pool.query(`
        INSERT INTO meal_cost_config (id, meal_type, base_cost_per_portion) VALUES
        ('mc-b', 'breakfast', 25.00),
        ('mc-l', 'lunch', 55.00),
        ('mc-s', 'snack', 15.00),
        ('mc-d', 'dinner', 45.00)
      `);
    }

    // Seed default budget for Hostel A
    const [[budgetCount]] = (await pool.query(`SELECT COUNT(*) as cnt FROM budget_settings WHERE hostel_id = 'A'`)) as any;
    if (Number(budgetCount?.cnt ?? 0) === 0) {
      await pool.query(`
        INSERT INTO budget_settings (id, hostel_id, monthly_budget, expected_cost_per_student, effective_from)
        VALUES ('b-default', 'A', 52000.00, 115.00, ?)
      `, [today.slice(0, 7) + '-01']);
    }

    // Seed some initial purchases for analytics demo
    const [[purchaseCount]] = (await pool.query(`SELECT COUNT(*) as cnt FROM procurement_purchases`)) as any;
    if (Number(purchaseCount?.cnt ?? 0) === 0) {
       await pool.query(`
        INSERT INTO procurement_purchases (id, vendor_id, item_name, category, quantity, unit, total_cost, purchase_date, staff_id)
        VALUES 
        ('p-1', 'v-1', 'Sona Masoori Rice', 'grains', 100, 'kg', 5400.00, ?, 'demo-staff-1'),
        ('p-2', 'v-2', 'Mixed Vegetables', 'vegetables', 40, 'kg', 2200.00, ?, 'demo-staff-1'),
        ('p-3', 'v-3', 'Fresh Curd', 'dairy', 20, 'litres', 1200.00, ?, 'demo-staff-1')
      `, [today, today, today]);
    }

    // No default leftovers seeded. Leftovers must be declared by staff.

    // Seed cooking tasks for today
    await pool.query(
      `INSERT INTO cooking_tasks (id, task_date, meal_type, task_name, status)
       VALUES
         ('task-001', ?, 'breakfast', 'Idly', 'done'),
         ('task-002', ?, 'breakfast', 'Sambar', 'done'),
         ('task-003', ?, 'lunch', 'Rice', 'in_progress'),
         ('task-004', ?, 'lunch', 'Dal', 'in_progress'),
         ('task-005', ?, 'lunch', 'Rasam', 'in_progress'),
         ('task-006', ?, 'lunch', 'Potato Curry', 'done'),
         ('task-007', ?, 'lunch', 'Pachadi + Curd', 'pending'),
         ('task-008', ?, 'dinner', 'Rice', 'pending'),
         ('task-009', ?, 'dinner', 'Sambar', 'pending'),
         ('task-010', ?, 'dinner', 'Vankaya Curry', 'pending')
       ON DUPLICATE KEY UPDATE
         status = VALUES(status)`,
      Array(10).fill(today)
    );
  };

  schemaPromise = new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Schema initialization timed out after ${schemaInitTimeoutMs}ms. Check MySQL is running and MYSQL_* env vars are correct.`
        )
      );
    }, schemaInitTimeoutMs);

    void runSchema()
      .then(() => {
        clearTimeout(timeoutId);
        resolve();
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });

  try {
    await schemaPromise;
  } catch (error) {
    schemaPromise = null;
    throw error;
  }
}
