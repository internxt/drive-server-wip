FROM node:22.17.0
LABEL author="internxt"

WORKDIR /usr/app

COPY package.json ./
COPY yarn.lock ./
COPY .npmrc ./

RUN yarn
COPY . ./

RUN yarn build

CMD yarn start:prod
