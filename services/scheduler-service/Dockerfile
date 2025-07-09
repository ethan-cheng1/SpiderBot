FROM node:16-alpine

WORKDIR /app

# Copy package files
COPY ./services/task-scheduler/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy service files
COPY ./services/task-scheduler ./
COPY ./shared /app/shared

# Expose the service port
EXPOSE 3003

# Start the service
CMD ["node", "src/app.js"]
