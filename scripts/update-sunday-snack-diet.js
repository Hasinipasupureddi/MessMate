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

    const [result] = await pool.execute(
      "UPDATE vote_options SET diet_preference = 'both' WHERE vote_date = ? AND meal_type = 'snack' AND category_key = 'snack' AND id LIKE 'sun-sn-%'",
      ['2026-06-07']
    );

    console.log(result);
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
