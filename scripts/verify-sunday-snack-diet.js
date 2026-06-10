const mysql = require('mysql2/promise');
(async () => {
  try {
    const pool = await mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'messmate',
    });

    const [rows] = await pool.execute(
      "SELECT id, meal_type, category_key, item_name, diet_preference FROM vote_options WHERE vote_date = ? AND meal_type = ? ORDER BY id",
      ['2026-06-07', 'snack']
    );

    console.log(JSON.stringify(rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
