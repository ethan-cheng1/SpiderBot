const mongoose = require('mongoose');

const PageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    metadata: {
      description: String,
      keywords: [String],
      author: String,
      publishedDate: Date,
    },
    headers: {
      type: Map,
      of: String,
    },
    links: [{
      url: String,
      text: String,
      isInternal: Boolean,
    }],
    images: [{
      url: String,
      alt: String,
    }],
    lastCrawled: {
      type: Date,
      default: Date.now,
    },
    statusCode: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

PageSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Page', PageSchema);

// services/data-storage/src/models/url.js
const mongoose = require('mongoose');

const UrlSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    domain: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
    depth: {
      type: Number,
      default: 0,
    },
    parentUrl: {
      type: String,
      default: null,
    },
    failureReason: String,
    retryCount: {
      type: Number,
      default: 0,
    },
    lastAttempt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Url', UrlSchema);
