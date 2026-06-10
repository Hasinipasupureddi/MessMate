import type { Pool } from 'mysql2/promise';

async function columnExists(pool: Pool, table: string, column: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number((rows as { c: number }[])[0]?.c ?? 0) > 0;
}

async function indexExists(pool: Pool, table: string, indexName: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return Number((rows as { c: number }[])[0]?.c ?? 0) > 0;
}

async function fkExists(pool: Pool, table: string, constraintName: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [table, constraintName]
  );
  return Number((rows as { c: number }[])[0]?.c ?? 0) > 0;
}

/**
 * Idempotent upgrades: adds `meals`, links `meal_optins.meal_id`, FK, and widens opt-in PKs
 * so deterministic ids stay within column limits.
 */
export async function runMealSchemaMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE meals
    MODIFY COLUMN name ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL
  `);

  await pool.query(`
    ALTER TABLE meal_optins
    MODIFY COLUMN meal_type ENUM('breakfast', 'lunch', 'snack', 'dinner') NOT NULL
  `);

  const hasMealId = await columnExists(pool, 'meal_optins', 'meal_id');

  if (!hasMealId) {
    await pool.query(
      `ALTER TABLE meal_optins MODIFY COLUMN id VARCHAR(128) NOT NULL`
    );

    await pool.query(
      `ALTER TABLE meal_optins ADD COLUMN meal_id VARCHAR(72) NULL AFTER student_id`
    );

    await pool.query(`
      INSERT IGNORE INTO meals (id, meal_date, name, created_at)
      SELECT DISTINCT CONCAT('meal-', meal_date, '-', meal_type), meal_date, meal_type, NOW()
      FROM meal_optins
    `);

    await pool.query(`
      UPDATE meal_optins
      SET meal_id = CONCAT('meal-', meal_date, '-', meal_type)
      WHERE meal_id IS NULL
    `);

    await pool.query(`ALTER TABLE meal_optins MODIFY COLUMN meal_id VARCHAR(72) NOT NULL`);

    if (await indexExists(pool, 'meal_optins', 'uk_meal_optin')) {
      await pool.query(`ALTER TABLE meal_optins DROP INDEX uk_meal_optin`);
    }

    if (!(await indexExists(pool, 'meal_optins', 'uk_meal_optin_student_meal'))) {
      await pool.query(
        `ALTER TABLE meal_optins ADD UNIQUE KEY uk_meal_optin_student_meal (student_id, meal_id)`
      );
    }
  }

  if (!(await fkExists(pool, 'meal_optins', 'fk_meal_optins_meal'))) {
    await pool.query(`ALTER TABLE meal_optins ENGINE=InnoDB`);
    await pool.query(`
      ALTER TABLE meal_optins
      ADD CONSTRAINT fk_meal_optins_meal
      FOREIGN KEY (meal_id) REFERENCES meals(id)
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  }

  if (!(await columnExists(pool, 'meal_ratings', 'meal_type'))) {
    await pool.query(`ALTER TABLE meal_ratings ADD COLUMN meal_type ENUM('breakfast', 'lunch', 'dinner') NULL AFTER rating_date`);
  }

  if (!(await columnExists(pool, 'meal_ratings', 'dish_name'))) {
    await pool.query(`ALTER TABLE meal_ratings ADD COLUMN dish_name VARCHAR(255) NULL AFTER meal_type`);
  }

  if (!(await columnExists(pool, 'meal_ratings', 'waste_amount'))) {
    await pool.query(`ALTER TABLE meal_ratings ADD COLUMN waste_amount VARCHAR(32) NOT NULL DEFAULT 'none' AFTER rating`);
  }

  if (!(await columnExists(pool, 'meal_ratings', 'updated_at'))) {
    await pool.query(`ALTER TABLE meal_ratings ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);
  }

  if (!(await indexExists(pool, 'meal_ratings', 'uk_meal_rating'))) {
    await pool.query(`ALTER TABLE meal_ratings ADD UNIQUE KEY uk_meal_rating (student_id, rating_date, meal_type)`);
  }
}
