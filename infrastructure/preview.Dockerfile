FROM node:22.17.0

WORKDIR /usr/app

COPY package.json ./
COPY yarn.lock ./
COPY .npmrc ./
RUN yarn --ignore-scripts

COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY nest-cli.json ./
COPY .sequelizerc ./
COPY --chmod=755 src ./src
COPY --chmod=755 migrations ./migrations
COPY --chmod=755 seeders ./seeders
RUN yarn build && chmod -R 755 dist/

USER node

CMD ["sh", "-c", "yarn migrate && yarn db:seed:test:all && yarn start:dev"]
