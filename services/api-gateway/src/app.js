const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { logger } = require('../../../shared/logger');
const { config } = require('../../../shared/config');
const authMiddleware = require('./middleware/auth');

const app = express();

// Security middlewares
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGINS || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// JSON and URL encoding
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Authentication middleware (conditional based on routes)
app.use('/api/v1/private', authMiddleware.authenticate);

// API routes
app.use('/api/v1', routes);

// Error handler
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  logger.debug(err.stack);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(config.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

const PORT = config.API_GATEWAY_PORT || 3000;

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});

module.exports = app;
