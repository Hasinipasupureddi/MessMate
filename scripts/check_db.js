const mysql = require('mysql2/promise');
(async () => {
  try {
    const c = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: 'Root@123', database: 'messmate' });
    const [r] = await c.execute("SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='complaints' AND COLUMN_NAME='description'");
    console.log('complaints_description', JSON.stringify(r));
    const tables = ['meals','meal_optins','meal_votes','meal_ratings','leftover_items'];
    for (const t of tables) {
      const [colrows] = await c.execute('SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?', [t, 'meal_date']);
      if (Number(colrows[0].cnt) > 0) {
        const [cnt] = await c.execute('SELECT COUNT(*) AS cnt FROM `'+t+'` WHERE CAST(meal_date AS CHAR) = \'0000-00-00\' OR meal_date IS NULL');
        console.log(t, JSON.stringify(cnt));
      } else {
        console.log(t, 'no-meal_date');
      }
    }
    await c.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
