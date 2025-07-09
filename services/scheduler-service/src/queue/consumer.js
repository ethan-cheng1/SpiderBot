const Redis = require('ioredis');
const axios = require('axios');
const logger = require('../../../shared/logger');
const config = require('../../../shared/config');

class Consumer {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConsuming = false;
    this.processingInterval = 1000; // 1 second
    this.queueName = 'crawler';
    this.maxConcurrent = process.env.MAX_CONCURRENT_TASKS || 5;
    this.runningTasks = 0;
  }

  async connect() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
      });

      this.client.on('error', (err) => {
        logger.error(`Redis consumer connection error: ${err.message}`);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis consumer connected successfully');
        this.isConnected = true;
      });

      await this.client.ping();
      this.isConnected = true;

      return true;
    } catch (error) {
      logger.error(`Failed to connect to Redis: ${error.message}`);
      throw error;
    }
  }

  startConsuming() {
    if (this.isConsuming) {
      return;
    }

    this.isConsuming = true;
    this.consumeMessages();
    logger.info('Consumer started processing messages');
  }

  async consumeMessages() {
    while (this.isConsuming) {
      try {
        if (this.runningTasks >= this.maxConcurrent) {
          // Wait if we've reached max concurrent tasks
          await new Promise(resolve => setTimeout(resolve, this.processingInterval));
          continue;
        }

        // Get highest priority task
        const tasks = await this.client.zrevrange(`${this.queueName}:priority`, 0, 0);

        if (tasks.length === 0) {
          // No tasks available, wait before checking again
          await new Promise(resolve => setTimeout(resolve, this.processingInterval));
          continue;
        }

        const taskStr = tasks[0];
        const task = JSON.parse(taskStr);

        // Process the task in the background
        this.runningTasks++;
        this.processTask(task)
          .then(() => {
            this.runningTasks--;
          })
          .catch((error) => {
            this.runningTasks--;
            logger.error(`Error processing task ${task.taskId}: ${error.message}`);
          });

        // Remove from queue
        await this.client.zrem(`${this.queueName}:priority`, taskStr);
        await this.client.srem(`${this.queueName}:pending`, task.taskId);

        // Add to processing set
        await this.client.sadd(`${this.queueName}:processing`, task.taskId);

      } catch (error) {
        logger.error(`Error in consume loop: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, this.processingInterval));
      }
    }
  }

  async processTask(task) {
    try {
      logger.info(`Processing task: ${task.taskId} - URL: ${task.url}`);

      // Call the data extraction service to process the URL
      const response = await axios.post(
        `${process.env.DATA_EXTRACTION_URL || 'http://data-extraction:3001'}/extract`,
        {
          url: task.url,
          depth: task.depth || 2,
          taskId: task.taskId,
        },
        {
          timeout: 60000, // 60 seconds timeout
        }
      );

      logger.info(`Task ${task.taskId} processed successfully`);

      // Remove from processing set
      await this.client.srem(`${this.queueName}:processing`, task.taskId);

      // Add to completed set with timestamp
      await this.client.hset(
        `${this.queueName}:completed`,
        task.taskId,
        JSON.stringify({
          ...task,
          completedAt: new Date().toISOString(),
          result: response.data,
        })
      );

      // Set expiry on completed tasks (keep for 7 days)
      await this.client.expire(`${this.queueName}:completed:${task.taskId}`, 60 * 60 * 24 * 7);

      return true;
    } catch (error) {
      logger.error(`Failed to process task ${task.taskId}: ${error.message}`);

      // Move from processing back to queue with decremented priority if under retry limit
      const retryCount = task.retryCount || 0;

      if (retryCount < 3) {
        const updatedTask = {
          ...task,
          retryCount: retryCount + 1,
          lastError: error.message,
          lastRetryAt: new Date().toISOString(),
        };

        // Re-add to queue with lower priority
        await this.client.zadd(
          `${this.queueName}:priority`,
          1, // Always lowest priority for retries
          JSON.stringify(updatedTask)
        );

        logger.info(`Task ${task.taskId} requeued for retry (${retryCount + 1}/3)`);
      } else {
        // Add to failed set
        await this.client.hset(
          `${this.queueName}:failed`,
          task.taskId,
          JSON.stringify({
            ...task,
            failedAt: new Date().toISOString(),
            error: error.message,
          })
        );

        logger.error(`Task ${task.taskId} marked as failed after 3 retries`);
      }

      // Remove from processing set
      await this.client.srem(`${this.queueName}:processing`, task.taskId);

      throw error;
    }
  }

  async stopConsuming() {
    this.isConsuming = false;
    logger.info('Consumer stopped processing messages');
  }

  async disconnect() {
    if (this.client) {
      await this.stopConsuming();
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis consumer disconnected');
    }
  }
}

const consumer = new Consumer();

module.exports = { consumer };
