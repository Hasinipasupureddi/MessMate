const mysql = require('mysql2/promise');
(async () => {
  try {
    const c = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: 'Root@123', database: 'messmate' });

    // Add complaints.description if missing
    const [[complaintsDescRow]] = await c.execute("SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='complaints' AND COLUMN_NAME='description'");
    if (Number(complaintsDescRow.cnt) === 0) {
      console.log('Adding complaints.description column...');
      await c.execute("ALTER TABLE complaints ADD COLUMN description TEXT NULL AFTER complaint_text");
      console.log('Added complaints.description');
    } else {
      console.log('complaints.description already exists');
    }

    // Fix meal_votes: set meal_date = DATE(vote_date) where meal_date is zero/NULL
    const [toFix] = await c.execute("SELECT COUNT(*) AS cnt FROM meal_votes WHERE CAST(meal_date AS CHAR) = '0000-00-00' OR meal_date IS NULL");
    console.log('meal_votes_to_fix', JSON.stringify(toFix));
    if (Number(toFix[0].cnt) > 0) {
      console.log('Updating meal_votes meal_date from vote_date...');
      const [res] = await c.execute("UPDATE meal_votes SET meal_date = DATE(vote_date) WHERE CAST(meal_date AS CHAR) = '0000-00-00' OR meal_date IS NULL");
      console.log('updated', res.affectedRows);
    } else {
      console.log('No meal_votes to fix');
    }

    await c.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
