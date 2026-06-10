const mysql = require('mysql2/promise');
(async () => {
  try {
    const c = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: 'Root@123', database: 'messmate' });
    const [cols] = await c.execute("SHOW COLUMNS FROM meal_votes LIKE 'meal_date'");
    console.log(JSON.stringify(cols, null, 2));
    await c.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
