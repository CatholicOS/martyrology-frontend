# martyrology-frontend image.
#
# next.config.ts already sets output: "standalone" for the Plesk deploy, which
# is exactly what a lean container wants: a self-contained server.js plus a
# pruned node_modules.
#
# NOTE: this is a PRODUCTION image. It does not hot-reload from a bind mount.
# For frontend iteration, stop this service and run `npm run dev` on the host —
# port 3000 is then free and the registered OIDC callback still matches.

FROM node:24.19.0-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.19.0-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24.19.0-slim AS main
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
EXPOSE 3000
USER node
CMD ["node", "server.js"]
