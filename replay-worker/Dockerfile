FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates fonts-liberation && rm -rf /var/lib/apt/lists/*
COPY replay-worker/package.json ./package.json
RUN npm install && npx playwright install --with-deps chromium
COPY replay-worker/ ./replay-worker/
COPY scripts/ ./scripts/
COPY fixtures/ ./fixtures/
RUN test -s /app/fixtures/demo-image.svg && mkdir -p /data/jobs && chown -R node:node /data /app
USER node
EXPOSE 8787
CMD ["node", "replay-worker/server.mjs"]
