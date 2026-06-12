FROM node:24-slim AS builder

WORKDIR /app

FROM builder AS dev

# update and install in second time focus to build and dev
FROM builder AS prod