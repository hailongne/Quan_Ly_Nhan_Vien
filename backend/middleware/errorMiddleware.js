function notFoundHandler(req, res, next) {
  res.status(404).json({ message: 'Not Found' });
}

function errorHandler(err, req, res, next) {
  // simple error handler
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
}

module.exports = { notFoundHandler, errorHandler };
