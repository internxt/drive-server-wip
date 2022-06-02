FROM node:16

ENV NODE_ENV test

COPY package.json ./
COPY yarn.lock ./

RUN yarn
COPY . ./

RUN yarn build

CMD ["yarn", "run", "test:e2e", "--watch"]