# syntax=docker/dockerfile:1
# escape=\
# check=error=true

#node is chosen because of js

#docker run -it pollpear-backend
FROM node:25-slim AS builder

#current directory which will be created (app) inside the docker
WORKDIR /app

RUN chown node:node /app && apt-get update -y && apt-get install -y openssl

USER node

#COPY from local comp to the container package.json and package.log.json
COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma

#install the dependencies with the RUN command (ci is the quivalent of install and is cleaner as it reinstalls everything from scratch (nodemodules)) https://docs.npmjs.com/cli/v9/commands/npm-ci
RUN npm ci

#takes what was built in the builder and will add to the base   (for ex workdir /app)
FROM builder AS dev

#copy everything inside the working dir ./app
COPY --chown=node:node . .

CMD ["npm", "run", "start:dev"]

FROM builder AS build

COPY --chown=node:node . .

RUN npm run build

FROM node:25-slim AS prod

# hadolint ignore=DL3008,DL3009
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN chown node:node /app
USER node
ENV NODE_ENV=production

COPY --chown=node:node package*.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma

RUN npm ci --omit=dev --ignore-scripts && npm rebuild @prisma/engines

COPY --chown=node:node --from=build /app/dist ./dist

CMD ["node", "dist/src/main" ]
