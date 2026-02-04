FROM node:22-slim

WORKDIR /app

# Install dependencies for sharp (image processing)
RUN apt-get update && apt-get install -y \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY typescript/api-ts/package*.json ./typescript/api-ts/
COPY typescript/workflow-ts/package*.json ./typescript/workflow-ts/

# Install dependencies
WORKDIR /app/typescript/api-ts
RUN npm install

WORKDIR /app/typescript/workflow-ts
RUN npm install

# Copy source code
WORKDIR /app
COPY typescript ./typescript
COPY shared ./shared

# Build TypeScript
WORKDIR /app/typescript/workflow-ts
RUN npm run build

WORKDIR /app/typescript/api-ts
RUN npm run build

# Run the API
CMD ["npm", "run", "start"]
