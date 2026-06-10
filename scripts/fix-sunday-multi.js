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
      "UPDATE vote_options SET category_key = CASE WHEN meal_type = 'snack' THEN 'snack' WHEN meal_type = 'dinner' THEN 'main' WHEN meal_type = 'lunch' THEN 'main' ELSE category_key END WHERE category_key = 'sunday_multi'"
    );
    console.log('result', result);
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
