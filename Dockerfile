FROM node:16

COPY package.json ./
COPY yarn.lock ./

RUN yarn
COPY . ./

RUN npm run  build

CMD ["yarn", "start:prod"]