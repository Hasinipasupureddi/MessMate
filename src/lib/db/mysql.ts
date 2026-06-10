import mysql, { type Pool } from 'mysql2/promise';

declare global {
  var __messmate_mysql_pool__: Pool | undefined;
}

function buildPool(): Pool {
  return mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'messmate',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
    dateStrings: true,
    timezone: '+05:30', // Set MySQL connection to IST timezone!
    // Fail fast when MySQL is down or misconfigured (default wait can be very long).
    connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 12_000),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

export function getMysqlPool(): Pool {
  if (!globalThis.__messmate_mysql_pool__) {
    globalThis.__messmate_mysql_pool__ = buildPool();
  }

  return globalThis.__messmate_mysql_pool__;
}
