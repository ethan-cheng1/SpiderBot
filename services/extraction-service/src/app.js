const express = require('express');
const bodyParser = require('body-parser');
const { htmlExtractor } = require('./extractors/htmlExtractor');
const { urlExtractor } = require('./extractors/urlExtractor');
const { authenticateRequest } = require('./auth/oauth');
const logger = require('../../../shared/logger');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Extract data from a URL
app.post('/extract', async (req, res) => {
  try {
    const { url, requiresAuth } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    logger.info(`Processing extraction request for URL: ${url}`);

    let html;

    // Handle authentication if required
    if (requiresAuth) {
      const authResult = await authenticateRequest(url, req.body.authConfig);
      if (!authResult.success) {
        return res.status(401).json({ error: 'Authentication failed', details: authResult.error });
      }
      html = authResult.html;
    } else {
      // Fetch the HTML content
      const response = await fetch(url, {
        headers: {
          'User-Agent': process.env.USER_AGENT || 'web-crawler-bot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      html = await response.text();
    }

    // Extract content and URLs
    const content = await htmlExtractor(html);
    const urls = await urlExtractor(html, url);

    res.status(200).json({
      url,
      content,
      urls,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Extraction error: ${error.message}`, { error });
    res.status(500).json({
      error: 'Extraction failed',
      message: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Data extraction service running on port ${PORT}`);
});

module.exports = app;
