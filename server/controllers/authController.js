const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';
const VALID_ROLES = new Set(['student', 'staff', 'warden']);

function normalizeRole(input) {
  const role = String(input || 'student').trim().toLowerCase();
  return VALID_ROLES.has(role) ? role : null;
}

async function signup(req, res) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    const userRole = normalizeRole(role);
    if (!userRole) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [name, email, password_hash, userRole]
    );

    const user = { id: result.insertId, name, email, role: userRole };
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({ token, user });
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const [rows] = await db.query('SELECT id, name, email, password_hash, role FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const userRole = normalizeRole(user.role);
    if (!userRole) {
      return res.status(500).json({ error: 'Invalid account role' });
    }
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign({ id: user.id, role: userRole }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: userRole } });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { signup, login };
