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
      'SELECT vote_date, meal_type, category_key, id, item_name FROM vote_options WHERE vote_date = ? ORDER BY meal_type, category_key, id',
      ['2026-06-07']
    );
    console.log(JSON.stringify(rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
