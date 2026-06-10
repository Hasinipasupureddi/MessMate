require('dotenv').config();
const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  const users = [
    { name: 'Demo Student', email: 'student@demo.local', password: 'password', role: 'student' },
    { name: 'Demo Staff', email: 'staff@demo.local', password: 'password', role: 'staff' },
    { name: 'Demo Warden', email: 'warden@demo.local', password: 'password', role: 'warden' }
  ];

  try {
    for (const u of users) {
      const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [u.email]);
      if (rows.length) {
        console.log('User exists:', u.email);
        continue;
      }
      const hash = bcrypt.hashSync(u.password, 10);
      await db.query(
        'INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [u.name, u.email, hash, u.role]
      );
      console.log('Inserted:', u.email);
    }
    console.log('Seeding complete');
  } catch (err) {
    console.error('Seeding error', err);
  } finally {
    process.exit(0);
  }
}

seed();
