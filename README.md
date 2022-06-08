# Drive Server WIP
[![ci](https://github.com/internxt/drive-server-wip/actions/workflows/code-coverage.yml/badge.svg)](https://github.com/internxt/drive-server-wip/actions/workflows/code-coverage.yml)
[![codecov](https://codecov.io/gh/internxt/drive-server-wip/branch/master/graph/badge.svg?token=5D9UW1HSCK)](https://codecov.io/gh/internxt/drive-server-wip)
[![node](https://img.shields.io/badge/node-16-brightgreen)](https://nodejs.org/download/release/latest-fermium/)

Drive server wip is the new API to Drive based in NestJS and following Clean Arquitecture and DDD(Domain Driven Design).
## Quick Setup

* Yarn

  ```npm i -g yarn```

## Table of Contents

- [Install](#how-to-install)
- [Start the app](#start-app)
  - [Start with docker](#running-in-docker)
- [Testing](#testing)
  - [Unit Testing](#unit-testing)
  - [End to End Testing](#end-to-end-testing)
- [Guideline Nest.js](#guideline-nest.js)
  - [Modules](#modules)
  - [Externals](#externals)
- [Swagger](#api-documentation-with-swagger)

## How to Install

- Create a `.npmrc` file from the `.npmrc.template` example provided in the repo. 
- Replace `TOKEN` with your own [Github Personal Access Token](https://docs.github.com/en/github/authenticating-to-github/keeping-your-account-and-data-secure/creating-a-personal-access-token) with `read:packages` permission **ONLY**
- Use `yarn` to install project dependencies.

## Start app

Run `yarn start` to start server in production mode.

Run `yarn start:dev` to start with nodemon and development environment.
### Running in docker:

With docker-compose:
```bash
docker-compose up
```

## Testing
### Unit testing

You can run unit tests with:

```bash
yarn run test
```

### End to End Testing

Running e2e test requires creating a database first (check .env.test file), and have mariadb started.

You can either run :

```bash
yarn run test:e2e
```


## Guideline Nest.js
This project is based in <a href="http://nestjs.com/" target="blank">NestJS</a> and implement DDD (Domain Driven Design).
Important in DDD is separate this layers:
- Use cases
- Persistence
- Domain
- Controllers

So, following best practices in NestJS we have 2 primary folders:
- Modules
- Externals

### Modules
In this folder we have all "use cases" or "context" and following nest.js modules structure, we have 3 concepts of files:
- <strong>Module:</strong> files with `*.module.ts`
- <strong>Providers:</strong> files with `*.service.ts`
- <strong>Controllers:</strong> files with `*.controller.ts`
- <strong>Model:</strong> files with `*.model.ts`

And following DDD we include this concepts:
- <strong>Domain:</strong> files with `*.domain.ts`
- <strong>Repository:</strong> files with `*.repository.ts`

So, example of module "File" `src/modules/file`:
- <strong>Controllers:</strong> `file.controller.ts` http Requests with endpoints: POST /file/:id/move
- <strong>Services:</strong> `file.service.ts` use cases of files: moveFile, call Repository to move file in database, and work with domains.
- <strong>Domain:</strong> `file.domain.ts` Class File, all attributes and business-logic is here, but in this class we not include nothing about persistence or use cases.
- <strong>Model:</strong> `file.model.ts` Entity Model in Sequelize(MariaDB)
- <strong>Repository:</strong> `file.repository.ts` Class with all querys using model, but important, Repository response with domains(File) but never with model directly.
- <strong>Module:</strong> `file.module.ts` Module of Nest.js

### Externals
In this folder we have all librarys of third partys or not business-based.
This structure is based in modules of <a href="http://nestjs.com/" target="blank">Nest.js</a> too.

You require include your module in externals if:

- Your module is used by other modules.
- Your module doesn't have any persistence database, so, it doesn't have domain and model.
- Your module have logic to call requests to externals APIS.
- Your module doesn't have any business logic.

## Api documentation with Swagger
We include swagger library in <a href="http://nestjs.com/" target="blank">Nest.js</a>, to show how use in project you have <a href="https://docs.nestjs.com/openapi/operations" target="blank">Official Documentation</a>.

To show swagger when your server is up go to `localhost:3000/api`

## License
This project is based in GNU License. You can show it in [License](LICENSE) file.