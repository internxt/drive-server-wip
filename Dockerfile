FROM node:16-alpine

COPY package.json ./
COPY yarn.lock ./

RUN yarn
COPY . ./

RUN npm run build

CMD ["yarn", "start:prod"]
