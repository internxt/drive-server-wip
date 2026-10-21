FROM node:24.22.1 AS builder
LABEL author="internxt"

WORKDIR /usr/app

COPY package.json ./
COPY package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY nest-cli.json ./
COPY .sequelizerc ./
COPY --chmod=755 src ./src
COPY --chmod=755 migrations ./migrations
RUN npm run build && chmod -R 755 dist/

FROM node:24.22.1
LABEL author="internxt"

WORKDIR /usr/app

COPY package.json ./
COPY package-lock.json ./
RUN npm ci --ignore-scripts --production

COPY --from=builder /usr/app/dist ./dist
COPY --from=builder /usr/app/migrations ./migrations
COPY --from=builder /usr/app/.sequelizerc ./

USER node

CMD ["npm", "run", "start:prod"]
