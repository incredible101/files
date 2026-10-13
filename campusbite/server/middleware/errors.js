// server/middleware/errors.js
// One place that turns thrown errors into JSON responses.

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Lets route handlers be `async` without try/catch in every one.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request.' });
  }
  console.error(err); // unexpected: log the detail, never send it to the client
  return res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}

module.exports = { HttpError, asyncHandler, errorHandler };
