FROM node:24-alpine AS dependencies
WORKDIR /repo
COPY packages/api-client/package.json packages/api-client/package-lock.json packages/api-client/
COPY apps/web/package.json apps/web/package-lock.json apps/web/
RUN npm ci --prefix packages/api-client --omit=dev --ignore-scripts \
    && npm ci --prefix apps/web

FROM node:24-alpine AS build
WORKDIR /repo
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /repo ./
COPY packages/api-client packages/api-client
COPY apps/web apps/web
RUN npm run build --prefix apps/web

FROM node:24-alpine AS runtime
WORKDIR /app
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
