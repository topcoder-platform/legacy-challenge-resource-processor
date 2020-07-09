/**
   * The default configuration file.
   */

module.exports = {
  DISABLE_LOGGING: process.env.DISABLE_LOGGING || false, // If true, logging will be disabled
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',

  // Kafka consumer config
  KAFKA_URL: process.env.KAFKA_URL || 'localhost:9092',
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'legacy-resources-processor-group',
  BUSAPI_URL: process.env.BUSAPI_URL || 'https://api.topcoder-dev.com/v5',
  KAFKA_ERROR_TOPIC: process.env.KAFKA_ERROR_TOPIC || 'common.error.reporting',
  RETRY_TIMEOUT: process.env.RETRY_TIMEOUT || 10 * 1000,
  EVENT_ORIGINATOR: process.env.EVENT_ORIGINATOR || 'legacy-challenge-resource-processor',
  EVENT_MIME_TYPE: process.env.EVENT_MIME_TYPE || 'application/json',

  // below are used for secure Kafka connection, they are optional
  // for the local Kafka, they are not needed
  KAFKA_CLIENT_CERT: process.env.KAFKA_CLIENT_CERT,
  KAFKA_CLIENT_CERT_KEY: process.env.KAFKA_CLIENT_CERT_KEY,

  SUBMITTER_ROLE_ID: process.env.SUBMITTER_ROLE_ID || '732339e7-8e30-49d7-9198-cccf9451e221',

  CREATE_CHALLENGE_RESOURCE_TOPIC: process.env.CREATE_CHALLENGE_RESOURCE_TOPIC || 'challenge.action.resource.create',
  DELETE_CHALLENGE_RESOURCE_TOPIC: process.env.DELETE_CHALLENGE_RESOURCE_TOPIC || 'challenge.action.resource.delete',

  CHALLENGE_API_V4_URL: process.env.CHALLENGE_API_V4_URL || 'https://api.topcoder-dev.com/v4/challenges',
  CHALLENGE_API_V5_URL: process.env.CHALLENGE_API_V5_URL || 'http://localhost:3001/v5/challenges',
  RESOURCE_ROLE_API_URL: process.env.RESOURCE_ROLE_API_URL || 'https://api.topcoder-dev.com/v5/resource-roles',

  AUTH0_URL: process.env.AUTH0_URL || 'https://topcoder-dev.auth0.com/oauth/token', // Auth0 credentials for M2M token
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://m2m.topcoder-dev.com/',
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID || 'e6oZAxnoFvjdRtjJs1Jt3tquLnNSTs0e',
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET || 'invalid',
  AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL || 'https://topcoder-dev.auth0.com/oauth/token',
  TOKEN_CACHE_TIME: 90
}
