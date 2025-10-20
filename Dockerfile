FROM node:22.17.0
LABEL author="internxt"

WORKDIR /usr/app

COPY package.json ./
COPY yarn.lock ./
COPY .npmrc ./

RUN yarn --ignore-scripts

COPY --chown=root:root --chmod=755 tsconfig.json ./
COPY --chown=root:root --chmod=755 tsconfig.build.json ./
COPY --chown=root:root --chmod=755 nest-cli.json ./
COPY --chown=root:root --chmod=755 .sequelizerc ./
COPY --chown=root:root --chmod=755 src ./src
COPY --chown=root:root --chmod=755 migrations ./migrations

RUN yarn build && chmod -R 755 dist/

USER node

CMD ["yarn", "start:prod"]
