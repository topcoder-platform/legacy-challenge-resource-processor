/**
 * Configuration file to be used while running tests
 */

module.exports = {
  DISABLE_LOGGING: false, // If true, logging will be disabled
  LOG_LEVEL: 'debug',
  KAFKA_URL: process.env.TEST_KAFKA_URL || 'localhost:9092',
  WAIT_TIME: 1000 // small wait time used in test
}
