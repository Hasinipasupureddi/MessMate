const mysql = require('mysql2/promise');

async function test() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Root@123',
    database: 'messmate'
  });

  const [columns] = await connection.execute('DESCRIBE meal_ratings');
  console.log('Columns of meal_ratings:', columns);

  await connection.end();
}

test().catch(console.error);
