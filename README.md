# Opinionated NestJS Boilerplate.

After making my mind up of what is my ideal setup for NestJS I created this opinionated starter.

- It spins up a Swagger OPEN API in localhost:3000/api
- Uses Postgres
- Uses JWT Tokens for authentication
- Every saved password uses a different salt
- Makes sure the architecture divides business logic nicely for if we wanted to replace Postgres with another DB, business logic remains almost entirely untouched.

Sample endpoints are for a Note taking application but can be used to start whichever application

# Running:

With docker-compose:

`docker-compose up`

Note: postgres is running on port 5433

Checkout localhost:3000/api to see every endpoint of the app along documentation

With skaffold:

//TODO DOC

Locally:

Make sure to have postgres running in port 5432 and run: `yarn start:dev`

# Tests

Right now there are both Unit tests and End to end tests

# Unit testing

You can run unit tests with:

`yarn run test`

# End to End Testing

Running e2e test requires creating a database named 'notes_test' first (check .env.test file)

You can either run :

`yarn run test:e2e // If you have postgres running locally`

Or you can run:
`docker-compose -f docker-compose.end-to-end.yaml up`

# Rationale:

TODO
