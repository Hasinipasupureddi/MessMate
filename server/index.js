const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const authRoutes = require('./routes/auth');
const internalRoutes = require('./routes/internal');
const healthRoutes = require('./routes/health');
const { initializeSocketServer } = require('./socket');
const logger = require('./lib/logger');
const { validateStartupEnvironment, getStartupSummary } = require('./config/env');
const { createRateLimiter } = require('./middleware/rateLimiter');
const { requestTiming, errorHandler } = require('./middleware/monitoring');
const { requestIdMiddleware } = require('./middleware/requestId');

validateStartupEnvironment();

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware());

// Basic rate limiters
const authLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20 });
const bridgeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60 });

app.use('/api/auth', authLimiter, authRoutes);
app.use('/internal', bridgeLimiter, internalRoutes);
app.use('/health', healthRoutes);
app.use(requestTiming());
app.use(errorHandler());

const port = process.env.PORT || 4001;
const server = http.createServer(app);

const socketServer = initializeSocketServer(server);

function shutdown(signal) {
  logger.info({ signal }, 'shutdown requested');

  if (socketServer?.io) {
    socketServer.io.close(() => {
      server.close(() => {
        process.exit(0);
      });
    });
    return;
  }

  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (error) => {
  logger.error({ err: error, requestId: 'process' }, 'uncaughtException');
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (error) => {
  logger.error({ err: error, requestId: 'process' }, 'unhandledRejection');
});

server.listen(port, () => {
  logger.info({ port }, 'MessMate server listening');
  logger.info({ port, ...getStartupSummary(socketServer) }, '[messmate][bootstrap] startup summary');
});

module.exports = { app, server };
