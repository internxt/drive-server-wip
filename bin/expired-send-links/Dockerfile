FROM mhart/alpine-node:16
LABEL author="internxt"

WORKDIR /

# Add useful packages
RUN apk add git curl

COPY . .

# Install deps
RUN yarn

# Run command
CMD ts-node ./bin/expired-send-links/index.ts
