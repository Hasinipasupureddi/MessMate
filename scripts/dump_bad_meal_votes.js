const mysql = require('mysql2/promise');
(async () => {
  try {
    const c = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: 'Root@123', database: 'messmate' });
    const [rows] = await c.execute("SELECT id, student_id, vote_date, meal_date, meal_type FROM meal_votes WHERE CAST(meal_date AS CHAR) = '0000-00-00' OR meal_date IS NULL");
    console.log(JSON.stringify(rows, null, 2));
    await c.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
