# Playwright's official image ships Chromium plus the required system libraries.
FROM mcr.microsoft.com/playwright:v1.56.0-jammy

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

# Runs as the non-root user provided by the Playwright image.
USER pwuser
CMD ["node", "dist/index.js"]
