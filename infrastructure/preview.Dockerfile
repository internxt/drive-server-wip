FROM node:22.17.0

WORKDIR /usr/app

COPY package.json ./
COPY package-lock.json ./
COPY .npmrc ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY nest-cli.json ./
COPY .sequelizerc ./
COPY --chmod=755 src ./src
COPY --chmod=755 migrations ./migrations
COPY --chmod=755 seeders ./seeders
RUN npm run build && chmod -R 755 dist/

USER node

CMD ["sh", "-c", "npm run migrate && npm run db:seed:test:all && npm run start:dev"]
