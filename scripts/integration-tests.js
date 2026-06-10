/*
  Basic integration test scaffold for realtime flows.
  Usage (example):
    NODE_ENV=test node scripts/integration-tests.js

  Configure env vars:
    API_BASE=http://127.0.0.1:3000
    SOCKET_URL=http://127.0.0.1:4001
    TEST_EMAIL, TEST_PASSWORD

  This script is a starting point — extend with real assertions and CI hooks.
*/

const axios = require('axios');
const io = require('socket.io-client');

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000';
const SOCKET_URL = process.env.SOCKET_URL || 'http://127.0.0.1:4001';

async function signin(email, password) {
  const res = await axios.post(`${API_BASE}/api/auth/signin`, { email, password });
  return res.data;
}

async function run() {
  console.log('Integration test scaffold starting');
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    console.warn('Set TEST_EMAIL and TEST_PASSWORD to run auth tests');
    return;
  }

  try {
    const auth = await signin(email, password);
    console.log('Signed in, session:', !!auth);

    // connect socket with token
    const token = auth?.sessionToken || '';
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });

    socket.on('connect', () => {
      console.log('socket connected', socket.id);
      socket.close();
    });

    socket.on('connect_error', (err) => {
      console.error('socket connect_error', err.message || err);
    });
  } catch (err) {
    console.error('integration test error', err?.response?.data || err.message || err);
  }
}

run();
