FROM node:16

ENV NODE_ENV development

COPY package.json ./
COPY yarn.lock ./

RUN yarn
COPY . ./

RUN yarn build

CMD ["yarn", "start:dev"]