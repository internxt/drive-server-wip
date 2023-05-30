FROM node:16

WORKDIR /usr/app

COPY package.json ./
COPY yarn.lock ./
COPY .npmrc ./

RUN yarn
COPY . ./

RUN yarn build

CMD yarn start:prod
