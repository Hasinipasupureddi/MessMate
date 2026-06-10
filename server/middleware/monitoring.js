const logger = require('../lib/logger');

function requestTiming() {
  return (req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
      const diff = process.hrtime(start);
      const ms = (diff[0] * 1e3) + (diff[1] / 1e6);
      logger.info({ requestId: req.requestId, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: ms.toFixed(2) }, 'request finished');
    });
    next();
  };
}

function errorHandler() {
  // basic error logging middleware
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    logger.error({ err, requestId: req.requestId, method: req.method, path: req.originalUrl }, 'request error');
    res.status(500).json({ ok: false, message: 'Internal server error' });
  };
}

module.exports = { requestTiming, errorHandler };
