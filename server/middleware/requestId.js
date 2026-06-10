const { createRequestId } = require('../socket/observability');

function requestIdMiddleware() {
  return (req, res, next) => {
    const requestId = String(req.headers['x-request-id'] || createRequestId());
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  };
}

module.exports = { requestIdMiddleware };