const cheerio = require('cheerio');
const url = require('url');
const logger = require('../../../../shared/logger');

/**
 * Extracts and normalizes URLs from HTML
 * @param {string} html - The HTML content to extract URLs from
 * @param {string} baseUrl - The base URL for resolving relative URLs
 * @returns {Array} - Array of extracted URLs
 */
const urlExtractor = async (html, baseUrl) => {
  try {
    const $ = cheerio.load(html);
    const links = new Set();
    const parsedBaseUrl = new URL(baseUrl);
    const domain = parsedBaseUrl.hostname;

    // Extract links from anchor tags
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          const resolvedUrl = new URL(href, baseUrl);

          // Skip non-HTTP protocols, fragment identifiers, and query parameters if configured
          if (resolvedUrl.protocol !== 'http:' && resolvedUrl.protocol !== 'https:') {
            return;
          }

          // Normalize the URL - remove fragments and trailing slashes
          let normalizedUrl = resolvedUrl.toString();
          normalizedUrl = normalizedUrl.replace(/#.*$/, ''); // Remove fragments
          normalizedUrl = normalizedUrl.endsWith('/') ? normalizedUrl.slice(0, -1) : normalizedUrl;

          links.add({
            url: normalizedUrl,
            internal: resolvedUrl.hostname === domain,
            text: $(el).text().trim().substring(0, 200) || '',
            nofollow: $(el).attr('rel') && $(el).attr('rel').includes('nofollow')
          });
        } catch (e) {
          logger.warn(`Failed to parse URL: ${href}`, { error: e.message });
        }
      }
    });

    return Array.from(links);
  } catch (error) {
    logger.error(`URL extraction error: ${error.message}`, { error });
    throw new Error(`URL extraction failed: ${error.message}`);
  }
};

module.exports = { urlExtractor };
