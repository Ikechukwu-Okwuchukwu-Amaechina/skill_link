// Express application setup
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');

const { httpLogger } = require('./config/logger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandlers');

const app = express();

// Security headers
// Allow cross-origin resource loading for images and media (fixes CORP blocking)
// Disable COEP to avoid cross-origin embedder restrictions when embedding assets
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// CORS (simple style)
let allowedOrigins = '*';
if (process.env.CORS_ORIGIN) {
  allowedOrigins = process.env.CORS_ORIGIN.split(',').map(function (s) { return s.trim(); });
}
app.use(cors({ origin: allowedOrigins, credentials: true }));
// Explicitly handle preflight across all routes
app.options('*', cors({ origin: allowedOrigins, credentials: true }));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Cookies
app.use(cookieParser());

// Sanitization and hardening (no hpp)
app.use(mongoSanitize());
app.use(xssClean());

// Compression
app.use(compression());

// Rate limiting (basic)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 });
app.use('/api', limiter);

// Logging
app.use(httpLogger);
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health route
app.get('/health', function (req, res) {
  res.json({ status: 'ok' });
});

// Mount routes
const apiRouter = require('./routes');
app.use('/api', apiRouter);

// Serve admin static files
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// Root route
app.get('/', function (req, res) {
  res.json({ message: 'Skill Link API - Visit /admin for dashboard or /api for API endpoints' });
});

// 404 and error handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
