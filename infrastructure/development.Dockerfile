FROM node:20.11.1

WORKDIR /usr/app

COPY package.json ./
COPY yarn.lock ./
COPY .npmrc ./

RUN yarn
COPY . ./

RUN yarn build

CMD yarn migrate && yarn start:dev
