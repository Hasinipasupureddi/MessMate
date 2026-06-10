const mysql = require('mysql2/promise');
(async () => {
  try {
    const c = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: 'Root@123', database: 'messmate' });

    // meal_votes: set meal_date = DATE(vote_date)
    console.log('meal_votes: fixing from vote_date');
    const [r1] = await c.execute("UPDATE meal_votes SET meal_date = DATE(vote_date) WHERE CAST(meal_date AS CHAR) = '0000-00-00' OR meal_date IS NULL");
    console.log('meal_votes updated', r1.affectedRows);

    // meal_optins: derive from meal_id if possible
    console.log('meal_optins: deriving from meal_id where possible');
    const [r2] = await c.execute("UPDATE meal_optins SET meal_date = REPLACE(SUBSTRING_INDEX(meal_id,'-',3),'meal-','') WHERE (CAST(meal_date AS CHAR) = '0000-00-00' OR meal_date IS NULL) AND meal_id LIKE 'meal-%-%-%'");
    console.log('meal_optins updated', r2.affectedRows);

    // meals: set to CURDATE() if invalid
    console.log('meals: setting to CURDATE() where invalid');
    const [r3] = await c.execute("UPDATE meals SET meal_date = CURDATE() WHERE CAST(meal_date AS CHAR) = '0000-00-00' OR meal_date IS NULL");
    console.log('meals updated', r3.affectedRows);

    // leftover_items: set to CURDATE() where invalid
    console.log('leftover_items: setting to CURDATE() where invalid');
    const [r4] = await c.execute("UPDATE leftover_items SET meal_date = CURDATE() WHERE CAST(meal_date AS CHAR) = '0000-00-00' OR meal_date IS NULL");
    console.log('leftover_items updated', r4.affectedRows);

    await c.end();
    console.log('migration complete');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
