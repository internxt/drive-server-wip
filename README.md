# Drive Server
[![ci](https://github.com/internxt/drive-server-wip/actions/workflows/code-coverage.yml/badge.svg)](https://github.com/internxt/drive-server-wip/actions/workflows/code-coverage.yml)
[![codecov](https://codecov.io/gh/internxt/drive-server-wip/branch/master/graph/badge.svg?token=5D9UW1HSCK)](https://codecov.io/gh/internxt/drive-server-wip)
[![node](https://img.shields.io/badge/node-16-brightgreen)](https://nodejs.org/download/release/latest-fermium/)

## Quick setup

  ```npm i -g yarn```

# Install

- Create a `.npmrc` file from the `.npmrc.template` example provided in the repo. 
- Replace `TOKEN` with your own [Github Personal Access Token](https://docs.github.com/en/github/authenticating-to-github/keeping-your-account-and-data-secure/creating-a-personal-access-token) with `read:packages` permission **ONLY**
- Use `yarn` to install project dependencies.

#### Database setup (MariaDB)



#### Start app

Run `yarn start` to start server in production mode.

Run `yarn run dev` to start with nodemon and development environment.

# Running:

With docker-compose:

`docker-compose up`

Checkout localhost:3000/api to see every endpoint of the app along documentation

Locally:

Make sure to have mariadb running in port 6603 and run: `yarn start:dev`

# Unit testing

You can run unit tests with:

`yarn run test`

# End to End Testing

Running e2e test requires creating a database first (check .env.test file)

You can either run :

`yarn run test:e2e // If you have mariadb running locally`

Or you can run:
`docker-compose -f docker-compose.end-to-end.yaml up`
