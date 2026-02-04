FROM node:22-slim

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY frontend ./

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server with host flag for Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
