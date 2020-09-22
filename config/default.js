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

  IS_CREATE_FORUM: process.env.IS_CREATE_FORUM || true,

  CREATE_CHALLENGE_RESOURCE_TOPIC: process.env.CREATE_CHALLENGE_RESOURCE_TOPIC || 'challenge.action.resource.create',
  DELETE_CHALLENGE_RESOURCE_TOPIC: process.env.DELETE_CHALLENGE_RESOURCE_TOPIC || 'challenge.action.resource.delete',

  CHALLENGE_ORIGINATOR: process.env.CHALLENGE_ORIGINATOR || 'app.challenge.service',
  CHALLENGE_USER_UNREGISTRATION_TOPIC: process.env.CHALLENGE_USER_UNREGISTRATION_TOPIC || 'notifications.kafka.queue.java.test',
  CHALLENGE_USER_REGISTRATION_TOPIC: process.env.CHALLENGE_USER_REGISTRATION_TOPIC || 'notifications.kafka.queue.java.test',

  CHALLENGE_API_V4_URL: process.env.CHALLENGE_API_V4_URL || 'https://api.topcoder-dev.com/v4/challenges',
  CHALLENGE_API_V5_URL: process.env.CHALLENGE_API_V5_URL || 'http://localhost:3001/v5/challenges',

  AUTH0_URL: process.env.AUTH0_URL || 'https://topcoder-dev.auth0.com/oauth/token', // Auth0 credentials for M2M token
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://m2m.topcoder-dev.com/',
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID || 'e6oZAxnoFvjdRtjJs1Jt3tquLnNSTs0e',
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET || 'invalid',
  AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL || 'https://topcoder-dev.auth0.com/oauth/token',
  TOKEN_CACHE_TIME: 90,

  INFORMIX: {
    SERVER: process.env.INFORMIX_SERVER || 'informixoltp_tcp', // informix server
    DATABASE: process.env.INFORMIX_DATABASE || 'tcs_catalog', // informix database
    HOST: process.env.INFORMIX_HOST || 'localhost', // host
    PROTOCOL: process.env.INFORMIX_PROTOCOL || 'onsoctcp',
    PORT: process.env.INFORMIX_PORT || '2021', // port
    DB_LOCALE: process.env.INFORMIX_DB_LOCALE || 'en_US.57372',
    USER: process.env.INFORMIX_USER || 'informix', // user
    PASSWORD: process.env.INFORMIX_PASSWORD || '1nf0rm1x', // password
    POOL_MAX_SIZE: parseInt(process.env.MAXPOOL, 10) || 60,
    maxsize: parseInt(process.env.MAXSIZE) || 0,
    minpool: parseInt(process.env.MINPOOL, 10) || 1,
    idleTimeout: parseInt(process.env.IDLETIMEOUT, 10) || 3600,
    timeout: parseInt(process.env.TIMEOUT, 10) || 30000
  }
}
