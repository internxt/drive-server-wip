FROM node:22.17.0

WORKDIR /usr/app

COPY package.json ./
COPY yarn.lock ./
COPY .npmrc ./

RUN yarn --ignore-scripts

RUN chown -R node:node /usr/app

USER node

COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node tsconfig.build.json ./
COPY --chown=node:node nest-cli.json ./
COPY --chown=node:node .sequelizerc ./
COPY --chown=node:node src ./src
COPY --chown=node:node migrations ./migrations

RUN yarn build

CMD ["sh", "-c", "yarn migrate && yarn start:dev"]
