# Stage 1: image + git
FROM node:lts-bullseye-slim AS git
WORKDIR /app

# install git
RUN apt-get update && apt-get --yes install git

# Stage 2: bun deps
FROM git AS deps
WORKDIR /app

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

COPY package.json bun.lock* ./

RUN /root/.bun/bin/bun --version && \
    if [ -f bun.lockb ] || [ -f bun.lock ]; then /root/.bun/bin/bun install --frozen-lockfile; \
    else /root/.bun/bin/bun install; \
    fi

# Rebuild the source code only when needed
FROM git AS builder
WORKDIR /app

# Install bun for build
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

RUN /root/.bun/bin/bun run build

# Production image, copy all the files and run next
FROM node:lts-bullseye-slim AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# copy translation related files
COPY --from=builder /app/next.config.mjs ./next.config.mjs
# COPY --from=builder /app/next-i18next.config.js ./next-i18next.config.js

USER nextjs

EXPOSE 3001

ENV PORT 3001

CMD ["node", "server.js"]