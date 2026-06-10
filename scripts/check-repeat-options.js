const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Root@123',
    database: 'messmate',
    connectionLimit: 1,
  });

  const dates = process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : ['2026-06-11', '2026-06-12'];
  const result = {};

  for (const d of dates) {
    const [rows] = await pool.query(
      'SELECT meal_type, item_name FROM vote_options WHERE vote_date = ? ORDER BY meal_type, item_name',
      [d]
    );
    result[d] = rows;
  }

  const yesterdayDate = dates[0];
  const todayDate = dates[1];

  const yesterday = new Set(
    result[yesterdayDate].map((r) => `${r.meal_type}|${String(r.item_name).toLowerCase().trim()}`)
  );

  const repeated = result[todayDate].filter((r) =>
    yesterday.has(`${r.meal_type}|${String(r.item_name).toLowerCase().trim()}`)
  );

  console.log('YESTERDAY_DATE', yesterdayDate);
  console.log('TODAY_DATE', todayDate);
  console.log('YESTERDAY_COUNT', result[yesterdayDate].length);
  console.log('TODAY_COUNT', result[todayDate].length);
  console.log('REPEATED_COUNT', repeated.length);
  console.log('REPEATED_ITEMS', repeated);

  await pool.end();
})();
