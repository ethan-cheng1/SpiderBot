const express = require('express');
const bodyParser = require('body-parser');
const { initializeProducer } = require('./queue/producer');
const { startConsumers } = require('./queue/consumer');
const { initializeScheduler } = require('./scheduler/crawler');
const logger = require('../../../shared/logger');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(bodyParser.json());

// Initialize queues and scheduler
let producer;
let scheduler;

const initialize = async () => {
  try {
    // Initialize Redis producer
    producer = await initializeProducer();

    // Start consumer workers
    await startConsumers(process.env.CONSUMER_COUNT || 3);

    // Initialize and start the crawler scheduler
    scheduler = await initializeScheduler(producer);

    logger.info('Task scheduler service initialized successfully');
  } catch (error) {
    logger.error(`Failed to initialize task scheduler: ${error.message}`, { error });
    process.exit(1);
  }
};

// Initialize on startup
initialize();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Add URL to crawl
app.post('/crawl', async (req, res) => {
  try {
    const { url, priority, depth, frequency } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const jobId = await producer.addCrawlJob({
      url,
      priority: priority || 'normal',
      depth: depth || 1,
      frequency: frequency || 'once',
      addedAt: new Date().toISOString()
    });

    res.status(201).json({
      message: 'Crawl job added successfully',
      jobId
    });
  } catch (error) {
    logger.error(`Failed to add crawl job: ${error.message}`, { error });
    res.status(500).json({
      error: 'Failed to add crawl job',
      message: error.message
    });
  }
});

// Get scheduler status
app.get('/status', async (req, res) => {
  try {
    const status = await scheduler.getStatus();
    res.status(200).json(status);
  } catch (error) {
    logger.error(`Failed to get scheduler status: ${error.message}`, { error });
    res.status(500).json({
      error: 'Failed to get scheduler status',
      message: error.message
    });
  }
});

// Control crawler operations
app.post('/control', async (req, res) => {
  try {
    const { action } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    let result;

    switch (action) {
      case 'pause':
        result = await scheduler.pause();
        break;
      case 'resume':
        result = await scheduler.resume();
        break;
      case 'reset':
        result = await scheduler.reset();
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.status(200).json(result);
  } catch (error) {
    logger.error(`Failed to control scheduler: ${error.message}`, { error });
    res.status(500).json({
      error: 'Failed to control scheduler',
      message: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Task scheduler service running on port ${PORT}`);
});

module.exports = app;
