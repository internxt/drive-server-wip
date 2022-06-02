FROM node:16

ENV NODE_ENV production

COPY package.json ./
COPY yarn.lock ./

RUN yarn
COPY . ./

RUN npm run  build

CMD ["yarn", "start:prod"]