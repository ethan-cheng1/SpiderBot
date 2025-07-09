# SpiderBot

A microservices-based web crawler system built with Node.js, Docker, and modern web technologies.

## Overview

SpiderBot is a distributed web crawling system that consists of multiple microservices working together to crawl, extract, store, and search web content. The system is designed to be scalable, fault-tolerant, and easy to deploy.

## Architecture

The system consists of the following microservices:

- **API Gateway** (`spiderbot-api-gateway`): Entry point for all client requests, handles authentication and routing
- **Data Extraction Service** (`spiderbot-data-extraction`): Crawls web pages and extracts content using Puppeteer and Cheerio
- **Data Storage Service** (`spiderbot-data-storage`): Manages data persistence using MongoDB
- **Search Service** (`spiderbot-search-service`): Provides search functionality using Elasticsearch
- **Task Scheduler Service** (`spiderbot-scheduler-service`): Manages crawling schedules and task distribution

### Infrastructure Services

- **MongoDB**: Primary data storage
- **Elasticsearch**: Search and indexing
- **Redis**: Caching and message queuing

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 14+ (for local development)
- PM2 (for production deployment)

### Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd SpiderBot
```

2. Create a `.env` file in the root directory:
```bash
# API Gateway
API_GATEWAY_PORT=3000
AUTH_SECRET=your-secret-key

# Database
MONGO_USER=admin
MONGO_PASSWORD=password
MONGO_DB=spiderbot
MONGO_PORT=27017

# Elasticsearch
ELASTICSEARCH_PORT=9200

# Redis
REDIS_PORT=6379

# OAuth (if needed)
OAUTH_CLIENT_ID=your-oauth-client-id
OAUTH_CLIENT_SECRET=your-oauth-client-secret

# Environment
NODE_ENV=development
```

### Running with Docker

Start all services:
```bash
npm run docker:up
```

Stop all services:
```bash
npm run docker:down
```

View logs:
```bash
npm run docker:logs
```

### Running with PM2

Start all services:
```bash
npm start
```

Stop all services:
```bash
npm run stop
```

Restart all services:
```bash
npm run restart
```

View status:
```bash
npm run status
```

## Development

### Local Development

For local development, you can run individual services:

```bash
# API Gateway
cd services/api-gateway
npm install
npm run dev

# Data Extraction Service
cd services/extraction-service
npm install
npm run dev

# Data Storage Service
cd services/storage-service
npm install
npm run dev

# Search Service
cd services/search-service
npm install
npm run dev

# Scheduler Service
cd services/scheduler-service
npm install
npm run dev
```

### Building Docker Images

Build all services:
```bash
npm run docker:build
```

## API Documentation

### API Gateway Endpoints

- `GET /health` - Health check
- `POST /auth/login` - User authentication
- `GET /api/crawl` - Start a crawling job
- `GET /api/search` - Search crawled content
- `GET /api/stats` - Get crawling statistics

### Service Communication

Services communicate through Redis for message queuing and MongoDB/Elasticsearch for data persistence. The API Gateway acts as the single entry point for all client requests.

## Configuration

Each service can be configured through environment variables. See the individual service directories for specific configuration options.

## Monitoring

- **PM2 Dashboard**: `pm2 monit`
- **Docker Logs**: `docker-compose logs -f [service-name]`
- **Health Checks**: Each service exposes a `/health` endpoint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions, please open an issue on the GitHub repository. 
