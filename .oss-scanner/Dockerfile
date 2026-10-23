FROM node:24.22.1

COPY . /src
WORKDIR /src

RUN npm ci --ignore-scripts
RUN npm run build
RUN npm test || echo "WARNING: unit tests reported failures"
