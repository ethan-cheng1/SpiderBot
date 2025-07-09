const { getClient } = require('../elastic/connection');
const { createClient } = require('redis');

// Redis client for caching
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
  await redisClient.connect();
})();

exports.indexPage = async (req, res) => {
  try {
    const pageData = req.body;
    const client = getClient();

    // Extract domain from URL
    const domain = new URL(pageData.url).hostname;
    pageData.domain = domain;

    // Add document to Elasticsearch
    const result = await client.index({
      index: 'pages',
      id: pageData._id || pageData.id,
      body: pageData,
      refresh: 'wait_for' // Make sure document is searchable immediately
    });

    res.status(201).json({
      message: 'Page indexed successfully',
      result
    });
  } catch (error) {
    console.error('Error indexing page:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.bulkIndex = async (req, res) => {
  try {
    const { pages } = req.body;
    const client = getClient();

    if (!Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty pages array' });
    }

    // Prepare bulk operation
    const operations = pages.flatMap(page => {
      // Extract domain if not already present
      if (!page.domain && page.url) {
        page.domain = new URL(page.url).hostname;
      }

      return [
        { index: { _index: 'pages', _id: page._id || page.id } },
        page
      ];
    });

    // Execute bulk operation
    const result = await client.bulk({
      refresh: 'wait_for',
      body: operations
    });

    // Check for errors
    const hasErrors = result.body.errors;
    const errorItems = hasErrors
      ? result.body.items.filter(item => item.index.error)
      : [];

    res.status(hasErrors ? 207 : 200).json({
      message: hasErrors
        ? 'Bulk indexing completed with some errors'
        : 'Bulk indexing completed successfully',
      totalProcessed: pages.length,
      successful: pages.length - errorItems.length,
      failed: errorItems.length,
      errors: errorItems.map(item => ({
        id: item.index._id,
        reason: item.index.error.reason
      }))
    });
  } catch (error) {
    console.error('Error bulk indexing pages:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const { id } = req.params;
    const client = getClient();

    const result = await client.delete({
      index: 'pages',
      id,
      refresh: 'wait_for'
    });

    res.json({
      message: 'Page deleted successfully',
      result
    });
  } catch (error) {
    // Check if document not found
    if (error.meta && error.meta.statusCode === 404) {
      return res.status(404).json({ error: 'Page not found' });
    }

    console.error('Error deleting page:', error);
    res.status(500).json({ error: error.message });
  }
};
