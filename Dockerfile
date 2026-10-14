FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run tsc

FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# the daily tasks (like the birthday messages) run on the clock of the server, so it has to be a Swedish one
RUN apk add --no-cache tzdata
ENV TZ=Europe/Stockholm

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/builds ./builds

RUN mkdir -p cache && chown -R bun:bun /app
USER bun

CMD ["bun", "builds/index.js"]
