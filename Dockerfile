# syntax=docker/dockerfile:1
# escape=\
# check=error=true

#node is chosen because of js

#docker run -it pollpear-backend
FROM node:24-slim AS builder

#current directory which will be created (app) inside the docker
WORKDIR /app

#COPY from local comp to the container package.json and package.log.json
COPY package*.json ./

#install the dependencies with the RUN command (ci is the quivalent of install and is cleaner as it reinstalls everything from scratch (nodemodules)) https://docs.npmjs.com/cli/v9/commands/npm-ci
RUN npm ci

#takes what was built in the builder and will add to the base   (for ex workdir /app)
FROM builder AS dev

#copy everything inside the working dir ./app
COPY . .

#RUN the command to build, npm run in this case, 
CMD ["npm", "run", "start:dev"]

FROM builder AS prod

