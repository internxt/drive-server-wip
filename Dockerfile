FROM node:22.17.0 AS builder
LABEL author="internxt"

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
RUN yarn build && chmod -R 755 dist/

FROM node:22.17.0
LABEL author="internxt"

WORKDIR /usr/app

COPY package.json ./
COPY yarn.lock ./
COPY .npmrc ./
RUN yarn --ignore-scripts --production

COPY --from=builder /usr/app/dist ./dist
COPY --from=builder /usr/app/migrations ./migrations
COPY --from=builder /usr/app/.sequelizerc ./

USER node

CMD ["yarn", "start:prod"]
