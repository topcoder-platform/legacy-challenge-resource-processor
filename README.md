# Topcoder - Legacy Resources Processor

This Processor is used for processing kafka events and backfills Informix with Challenge Resource data

### Development deployment status
[![CircleCI](https://circleci.com/gh/topcoder-platform/legacy-challenge-resource-processor/tree/develop.svg?style=svg)](https://circleci.com/gh/topcoder-platform/legacy-challenge-resource-processor/tree/develop)

### Production deployment status
[![CircleCI](https://circleci.com/gh/topcoder-platform/legacy-challenge-resource-processor/tree/master.svg?style=svg)](https://circleci.com/gh/topcoder-platform/legacy-challenge-resource-processor/tree/master)

## Postman Collection

-  [Postman Collection](https://github.com/topcoder-platform/legacy-challenge-resource-processor/tree/develop/verification-docs/postman)

## Intended use

- Processor

## Related repos

- [Legacy Challenge API](https://github.com/appirio-tech/ap-challenge-microservice)
- [Challenge API](https://github.com/topcoder-platform/challenge-api)

## Prerequisites

-  [NodeJS](https://nodejs.org/en/) (v10)
-  [Kafka](https://kafka.apache.org/)
-  [Docker](https://www.docker.com/)
-  [Docker Compose](https://docs.docker.com/compose/)

## Configuration
Configuration for the processor is at `config/default.js`.
The following parameters can be set in config files or in env variables:

- DISABLE_LOGGING: whether to disable logging, default is false
- LOG_LEVEL: the log level; default value: 'debug'
- KAFKA_URL: comma separated Kafka hosts for consumer to listen; default value: 'localhost:9092'
- KAFKA_GROUP_ID: Kafka consumer group id; default value: 'legacy-resources-processor-group'
- KAFKA_CLIENT_CERT: Kafka connection certificate, optional; default value is undefined;
- KAFKA_ERROR_TOPIC: The kafka error topic.
- RETRY_TIMEOUT: The timeout to retry processing the same message
- BUSAPI_URL: Bus API URL

if not provided, then SSL connection is not used, direct insecure connection is used;

- KAFKA_CLIENT_CERT_KEY: Kafka connection private key, optional; default value is undefined;

if not provided, then SSL connection is not used, direct insecure connection is used;
- CREATE_CHALLENGE_RESOURCE_TOPIC: Create challenge resource Kafka topic, default value is 'challenge.resources.notification.create'
- DELETE_CHALLENGE_RESOURCE_TOPIC: Delete challenge resource Kafka topic, default value is 'challenge.resources.notification.delete'
- CHALLENGE_API_V4_URL: Challenge V4 API URL, default value is 'https://api.topcoder-dev.com/v4/challenges'
- CHALLENGE_API_V5_URL: Challenge V5 API URL, default value is 'http://localhost:3001/v5/challenges', which is mocked for now since the V5 API is not deployed in Topcoder Dev environment yet.
- AUTH0_URL: Auth0 url for M2M token
- AUTH0_AUDIENCE: Auth0 audience for M2M token || 'https://www.topcoder-dev.com',
- TOKEN_CACHE_TIME: Cache time of M2M token, optional
- AUTH0_CLIENT_ID: Auth0 client id for M2M token
- AUTH0_CLIENT_SECRET: Auth0 client secret for M2M token
- IS_CREATE_FORUM: Should create forum resource or not
- CHALLENGE_ORIGINATOR: originator from challenge service
- CHALLENGE_USER_UNREGISTRATION_TOPIC: unregistration topic from challenge service
- CHALLENGE_USER_REGISTRATION_TOPIC: registration topic from challenge service

Also note that there is a `/health` endpoint that checks for the health of the app. This sets up an expressjs server and listens on the environment variable `PORT`. It's not part of the configuration file and needs to be passed as an environment variable

Configuration for the tests is at `config/test.js`. Following parameters need to be set via environment variables or directly in config file
- TEST_KAFKA_URL: Kafka URL pointing to Kafka test instance
- WAIT_TIME: wait time used in test, default is 1000 or one second

## Local Deployment

### Foreman Setup
To install foreman follow this [link](https://theforeman.org/manuals/1.24/#3.InstallingForeman)
To know how to use foreman follow this [link](https://theforeman.org/manuals/1.24/#2.Quickstart)

### Local Kafka setup

-  `http://kafka.apache.org/quickstart` contains details to setup and manage Kafka server,
below provides details to setup Kafka server in Mac, Windows will use bat commands in bin/windows instead
- download kafka at `https://www.apache.org/dyn/closer.cgi?path=/kafka/1.1.0/kafka_2.11-1.1.0.tgz`
- extract out the downloaded tgz file
- go to extracted directory kafka_2.11-0.11.0.1
- start ZooKeeper server:
`bin/zookeeper-server-start.sh config/zookeeper.properties`
- use another terminal, go to same directory, start the Kafka server:
`bin/kafka-server-start.sh config/server.properties`
- note that the zookeeper server is at localhost:2181, and Kafka server is at localhost:9092
- use another terminal, go to same directory, create the needed topics:
- 
`bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic challenge.resources.notification.create`

`bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic challenge.resources.notification.delete`
- verify that the topics are created:

`bin/kafka-topics.sh --list --zookeeper localhost:2181`,

it should list out the created topics

### Local deployment without Docker
- install dependencies `npm i`
- run code lint check `npm run lint`, running `npm run lint:fix` can fix some lint errors if any
- start processor app `npm start`
- to start with production config `npm runt start:prod`

### Local Deployment with Docker
To run the processor using docker, follow the below steps
1. Navigate to the directory `docker`
2. Rename the file `sample.api.env` to `api.env`
3. Set parameters in the file `api.env`
4. Once that is done, run the following command

```bash
docker-compose up
```
5. When you are running the application for the first time, It will take some time initially to download the image and install the dependencies

## Production deployment
- TBD

## Running tests
### Configuration

Test configuration is at `config/test.js`. You don't need to change them.
The following test parameters can be set in config file or in env variables:
- DISABLE_LOGGING: whether to disable logging, default is false
- LOG_LEVEL: the log level; default value: 'debug'
- KAFKA_URL: comma separated Kafka hosts for consumer to listen; default value: 'localhost:9092'
- WAIT_TIME: wait time used in test, default is 1000 or one second

### Prepare
- Start Local services.
- Start Mock API.
- Various config parameters should be properly set.

### Running unit tests
To run unit tests alone
```bash
npm run test
```
To run unit tests with coverage report, you can check generated coverage report in coverage folder and coverage for `src/services/ProcessorService.js` is 100%.

```bash
npm run cov
```

### Running integration tests
To run integration tests alone

Please note that E2E tests work against the real Topcoder Dev API, and the following challenge is used for testing :

1. Go to [accounts.topcoder-dev.com/member](https://accounts.topcoder-dev.com/member)
2. Login as TonyJ/appirio123
3. https://software.topcoder-dev.com/review/actions/ViewProjectDetails?pid=30049360
```bash
npm run e2e
```
To run integration tests with coverage report

please note e2e tests will run with real api so e2e tests will not cover some error cases but most cases are modified from unit tests

```bash
npm run cov-e2e
```

## Running tests in CI

- TBD

## Verification

Refer to the verification document `Verification.md`
