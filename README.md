# Drive Server WIP

[![node](https://img.shields.io/badge/node-20-iron)](https://nodejs.org/download/release/latest-iron/)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=internxt_drive-server-wip&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=internxt_drive-server-wip)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=internxt_drive-server-wip&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=internxt_drive-server-wip)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=internxt_drive-server-wip&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=internxt_drive-server-wip)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=internxt_drive-server-wip&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=internxt_drive-server-wip)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=internxt_drive-server-wip&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=internxt_drive-server-wip)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=internxt_drive-server-wip&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=internxt_drive-server-wip)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=internxt_drive-server-wip&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=internxt_drive-server-wip)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=internxt_drive-server-wip&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=internxt_drive-server-wip)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=internxt_drive-server-wip&metric=coverage)](https://sonarcloud.io/summary/new_code?id=internxt_drive-server-wip)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=internxt_drive-server-wip&metric=bugs)](https://sonarcloud.io/summary/new_code?id=internxt_drive-server-wip)
 
Drive server WIP is the new API to Drive based on NestJS and following Clean Architecture and DDD(Domain Driven Design).

## Table of Contents

- [Quick Setup](#quick-setup)
- [Install](#how-to-install)
- [Start the app](#start-app)
  - [Start with docker](#running-in-docker)
- [Testing](#testing)
  - [Unit Testing](#unit-testing)
  - [End to End Testing](#end-to-end-testing)
- [Guideline Nest.js](#guideline-nest.js)
  - [Modules](#modules)
    - [Controllers](#defining-controllers)
    - [Domain](#defining-domain)
    - [Use Cases](#defining-use-cases)
    - [Repository](#defining-repository)
  - [Externals](#externals)
  - [Config](#conig)
  - [Middlewares](#middlewares)
  - [Libs](#libs)
- [API Documentation](#api-documentation)

## Quick Setup

- Yarn

  `npm i -g yarn`

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

Running e2e test requires creating a database first (check .env.test file), and having a mariadb instance running.

```bash
yarn run test:e2e
```

## Guideline Nest.js

This project is based on <a href="http://nestjs.com/" target="blank">NestJS</a> and implements DDD (Domain Driven Design).
Our implementation has these layers:

- Use cases
- Persistence
- Domain
- Controllers

The project has these main folders

- Modules
- Externals
- Config
- Middlewares
- Lib

### Modules

In this folder we have all "use cases" or "context" where the business logic and the controllers (to respect Nest architecture) are located:

- <strong>Module:</strong> files with `*.module.ts`
- <strong>Use Cases:</strong> files with `*.usecase.ts`
- <strong>Controllers:</strong> files with `*.controller.ts`
- <strong>Domain:</strong> files with `*.domain.ts`
- <strong>Repository:</strong> files with `*.repository.ts`

As an example, a 'file' module would be `src/modules/file`:

- <strong>Controllers:</strong> `file.controller.ts` Endpoints for exposing the business logic of the file module.
- <strong>Use Cases:</strong> `file.usecase.ts` Contains all the use-cases that are related to the file domain: moving a file, removing a file, etc.
- <strong>Domain:</strong> `file.domain.ts` Class File, all attributes and business logic are here, but we do not include anything about persistence or use cases.
- <strong>Repository:</strong> `file.repository.ts` File that contains the interface that defines the signature of the methods to persist data and all the concrete implementations of this persistence (MariaDB, Redis..)
- <strong>Module:</strong> `file.module.ts` Nest.js module

#### Defining Controllers

Based on <a href="https://docs.nestjs.com/controllers" target="blank">Nest.js Controllers</a>. Contains endpoints for exposing the business logic of the module.

#### Defining Domain

Domain is an agnostic "entity" with the properties and the business logic, including global functionality to this domain. The domain <strong> does not persist the information </strong>, just changes the entity according to the situation.

Example of the File domain

```
# file.domain.ts

export class File implements FileAttributes {
  fileId: number;
  deleted: boolean;
  deletedAt: boolean;
  bucket: string;

  constructor({...}){
    ...
  }

  moveToTrash() {
    this.deleted = true;
    this.deletedAt = new Date();
  }

  moveTo(bucket) {
    if(this.bucket === bucket) {
      throw Error('you cannot move file to this directory')
    }
    this.bucket = bucket;
  }
}

```

#### Defining Usecases

The use case is a function that includes a real functional use case from the business model. To identify use cases we can use: "As User, I want ... for ... Example: "As Web User, I want to move files to trash for delete them later"

<strong>How to code a use case?</strong>

1. Use a repository if there is a need to get any information from the entity in the database, the repositories should always return the entity of a domain.
2. Update any properties of a domain or call functions with a business-logic. Ex: File.moveToTrash()
3. Persist changes using a repository.

Example of use case:

```
# file.usecase.ts

export class FileUsecase {
  constructor(private fileRepository: FileRepository) {}

  async moveToTrash(fileId) {
    const file = await this.fileRepository.findOne({ fileId });

    if(!file) {
      throw new Error('file not found');
    }

    file.moveToTrash();

    await this.fileRepository.update(file);

    return file;
  }

  async moveTo(fileId, destination) {
    const file = await this.fileRepository.findOne({ fileId });

    if(!file) {
      throw new Error('file not found');
    }

    file.moveTo(destination);

    await this.fileRepository.update(file);

    return file;
  }
}

```

#### Defining Repository

The repository is part of the persistence layer.

A repository <strong>commonly</strong> has a model and a CRUD to interact with the entities of any concrete persistence implementation.
The repository <strong>always returns an entity domain</strong> or a collection of them, so a repository should have adapters to parse from the model to the entity domain and viceversa.

Information about the repository pattern could be found <a href="https://medium.com/@pererikbergman/repository-design-pattern-e28c0f3e4a30" target="blank">here<a>.

### Externals

This folder contains third-party dependencies and external services whose usage could be necessary but it is not business-related.
This structure is based on `modules` structure of <a href="http://nestjs.com/" target="blank">Nest.js</a>.
A module can be found here if:

- Is an external API gateway.
- Is a bunch of logic that provides some 'service', as a cryptography service, a notifications service and any other logic that could be commonly found on generic folders like `utils`, `helpers`, etc. But grouped by a context. For instance:
  - `encryptText()` -> CryptoService
  - `sendAnalytics()` -> AnalyticsService
  - `parseStringToDate()` -> StringService

### config

This folder contains config files for the app.

### middlewares

This folder includes middlewares of any kind. You can find documentation about middlewares in <a href="https://docs.nestjs.com/middleware" target="blank">Nest.js</a>.

### lib

In this folder include only libraries to server HTTP and Nest.js

## API documentation

We use Swagger, which can be found up and running at `/api` endpoint via HTTP. You can find documentation of how to use it with Nest.js <a href="https://docs.nestjs.com/openapi/operations" target="blank">here</a>.

## License

This project is based on GNU License. You can show it in the [License](LICENSE) file.
