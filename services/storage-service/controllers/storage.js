const Page = require('../models/page');
const Url = require('../models/url');
const mongoose = require('mongoose');
const { createClient } = require('redis');

// Redis client for caching
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
  await redisClient.connect();
})();

exports.storePage = async (req, res) => {
  try {
    const pageData = req.body;

    // Check if page already exists
    const existingPage = await Page.findOne({ url: pageData.url });

    let page;
    if (existingPage) {
      // Update existing page
      page = await Page.findOneAndUpdate(
        { url: pageData.url },
        pageData,
        { new: true }
      );
    } else {
      // Create new page
      page = new Page(pageData);
      await page.save();
    }

    // Cache the page data in Redis
    await redisClient.set(`page:${page._id}`, JSON.stringify(page), {
      EX: 3600 // Expire in 1 hour
    });

    res.status(201).json(page);
  } catch (error) {
    console.error('Error storing page:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPageById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to get from cache first
    const cachedPage = await redisClient.get(`page:${id}`);

    if (cachedPage) {
      return res.json(JSON.parse(cachedPage));
    }

    // If not in cache, get from database
    const page = await Page.findById(id);

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Cache for future requests
    await redisClient.set(`page:${id}`, JSON.stringify(page), {
      EX: 3600 // Expire in 1 hour
    });

    res.json(page);
  } catch (error) {
    console.error('Error retrieving page:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPages = async (req, res) => {
  try {
    const { domain, limit = 10, skip = 0 } = req.query;

    let query = {};
    if (domain) {
      query.url = { $regex: domain, $options: 'i' };
    }

    const pages = await Page.find(query)
      .sort({ lastCrawled: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Page.countDocuments(query);

    res.json({
      data: pages,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + pages.length < total
      }
    });
  } catch (error) {
    console.error('Error retrieving pages:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.storeUrl = async (req, res) => {
  try {
    const urlData = req.body;

    // Extract domain from URL
    const domain = new URL(urlData.url).hostname;
    urlData.domain = domain;

    // Check if URL already exists
    const existingUrl = await Url.findOne({ url: urlData.url });

    if (existingUrl) {
      return res.status(200).json(existingUrl);
    }

    // Create new URL
    const url = new Url(urlData);
    await url.save();

    res.status(201).json(url);
  } catch (error) {
    console.error('Error storing URL:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPendingUrls = async (req, res) => {
  try {
    const { limit = 10, domain } = req.query;

    let query = { status: 'pending' };
    if (domain) {
      query.domain = domain;
    }

    const urls = await Url.find(query)
      .sort({ priority: -1, createdAt: 1 })
      .limit(parseInt(limit));

    res.json(urls);
  } catch (error) {
    console.error('Error retrieving pending URLs:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateUrlStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, failureReason } = req.body;

    const url = await Url.findByIdAndUpdate(
      id,
      {
        status,
        failureReason,
        lastAttempt: Date.now(),
        $inc: status === 'failed' ? { retryCount: 1 } : {}
      },
      { new: true }
    );

    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }

    res.json(url);
  } catch (error) {
    console.error('Error updating URL status:', error);
    res.status(500).json({ error: error.message });
  }
};
