const { createLogger, format, transports } = require('winston');

const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logger = createLogger({
  level: logLevel,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        format.printf(({ level, message, timestamp, stack, ...meta }) => {
          if (stack) return `${timestamp} ${level}: ${message}\n${stack}`;
          const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${rest}`;
        })
      ),
    }),
  ],
});

// Express middleware to log basic HTTP info
function httpLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`);
  });
  next();
}

module.exports = { logger, httpLogger };
