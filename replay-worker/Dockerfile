FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates fonts-liberation && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install && npx playwright install --with-deps chromium
COPY . .
RUN mkdir -p /data/jobs && chown -R node:node /data
USER node
EXPOSE 8787
CMD ["npm", "start"]
