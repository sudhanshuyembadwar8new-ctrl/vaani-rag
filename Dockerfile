FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm install \
    && npm run build
  
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
