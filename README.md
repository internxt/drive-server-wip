# Drive Server WIP
[![ci](https://github.com/internxt/drive-server-wip/actions/workflows/code-coverage.yml/badge.svg)](https://github.com/internxt/drive-server-wip/actions/workflows/code-coverage.yml)
[![codecov](https://codecov.io/gh/internxt/drive-server-wip/branch/master/graph/badge.svg?token=5D9UW1HSCK)](https://codecov.io/gh/internxt/drive-server-wip)
[![node](https://img.shields.io/badge/node-16-brightgreen)](https://nodejs.org/download/release/latest-fermium/)

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

* Yarn

  ```npm i -g yarn```

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

Running e2e test requires creating a database first (check .env.test file), and having mariadb started.

You can either run :

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
- <strong>Domain:</strong> `file.domain.ts` Class File, all attributes and business logic are here, but in this class, we do not include anything about persistence or use cases.
- <strong>Repository:</strong> `file.repository.ts` Class with all queries to database using model.
- <strong>Module:</strong> `file.module.ts` Module of Nest.js

#### Defining Controllers

Based on <a href="https://docs.nestjs.com/controllers" target="blank">Nest.js Controllers</a>. Contains endpoints for exposing the business logic of the module.

#### Defining Domain

Domain is an "entity" agnostic with all properties and business logic including global functionality to this domain. Domain ignores persistence layer, so, in domain never implement persistence, like SQL, Redis or other.

Example of Domain
```
# file.domain.ts

export class File implements FileAttributes{
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

#### Defining Use Cases

The use case is a function that includes a real functional use case from the user.

To identify Use cases we can use: "As User, I want ... for ... Example: "As Web User, I want to move files to trash for delete later permanently"

<strong>How coding use case?</strong>

1. Use repository to get information from the entity in the database, repository return always domains.
2. Update properties of domains o call functions with business-logic. Ex: File.moveToTrash()
3. Persist repository in the database with the domain.

Example of use case:
```
# file.usecase.ts

export class FileUseCase {
  constructor(private fileRepository: FileRepository) {}

  async moveToTrash(fileId) {
    const file = await this.fileRepository.findOne({ fileId });
    if(!file) {
      throw new Error('file not found');
    }
    file.moveToTrash();

    await this.fileRepository.update(file)

    return file;
  }

  async moveTo(fileId, destination) {
    const file = await this.fileRepository.findOne({ fileId });
    if(!file) {
      throw new Error('file not found');
    }
    file.moveTo(destination);

    await this.fileRepository.update(file)

    return file;
  }
}

```

#### Defining Repository

The repository is inside the persistence layer.

Repository has model and query functions to search, insert, update, and remove entities in specific database implementation.
The repository always returns a Domain or collection of domains, so the repository has adapters from Model to Domain and Domain to Model.

Information about repository patterns is <a href="https://medium.com/@pererikbergman/repository-design-pattern-e28c0f3e4a30" target="blank">here<a>.

### Externals
This folder contains third-party dependencies and external services whose usage could be necessary but is not business-related
This structure is based on modules of <a href="http://nestjs.com/" target="blank">Nest.js</a> too.
You require to include your module in externals if:

- Your module is used by other modules.
- Your module doesn't have any persistence database, so, it doesn't have a domain and model.
- Your module has logic to call requests to externals APIS.
- Your module doesn't have any business logic.

### Config

In this folder include the configuration file and map `process.env` variables.
### Middlewares

In this folder includes middlewares to HTTP requests, you have <a href="https://docs.nestjs.com/middleware" target="blank">documentation</a> about middlewares in Nest.js.

### Libs

In this folder include only libraries to server HTTP and Nest.js
## API documentation
We include the swagger library in <a href="http://nestjs.com/" target="blank">Nest.js</a>, to show how to use it in projects you have <a href="https://docs.nestjs.com/openapi/operations" target="blank">Official Documentation</a>.

To show swagger when your server is up go to `localhost:3000/api`

## License
This project is based on GNU License. You can show it in the [License](LICENSE) file.