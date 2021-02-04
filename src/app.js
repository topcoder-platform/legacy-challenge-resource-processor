/**
 * The application entry point
 */

global.Promise = require('bluebird')
const config = require('config')
const Kafka = require('no-kafka')
const healthcheck = require('topcoder-healthcheck-dropin')
const logger = require('./common/logger')
const { getKafkaOptions } = require('./common/utils')
const ProcessorService = require('./services/ProcessorService')

// create consumer
const options = getKafkaOptions()
const consumer = new Kafka.GroupConsumer(options)

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
  // application specific logging, throwing an error, or other logic here
})

// data handler
const dataHandler = async (messageSet, topic, partition) => Promise.each(messageSet, async (m) => {
  const message = m.message.value.toString('utf8')
  logger.info(`Handle Kafka event message; Topic: ${topic}; Partition: ${partition}; Offset: ${m.offset}; Message: ${message}.`)
  let messageJSON
  try {
    messageJSON = JSON.parse(message)
  } catch (e) {
    logger.error('Invalid message JSON.')
    logger.error(e)
    // ignore the message
    return
  }
  if (messageJSON.topic !== topic) {
    logger.error(`The message topic ${messageJSON.topic} doesn't match the Kafka topic ${topic}.`)
    // ignore the message
    return
  }
  try {
    switch (topic) {
      case config.CREATE_CHALLENGE_RESOURCE_TOPIC :
        await ProcessorService.createChallengeResource(messageJSON)
        break
      case config.DELETE_CHALLENGE_RESOURCE_TOPIC:
        await ProcessorService.deleteChallengeResource(messageJSON)
        break
      default:
        throw new Error(`Invalid topic: ${topic}`)
    }
    // only commit if no errors
    await consumer.commitOffset({ topic, partition, offset: m.offset })
    // logger.debug('Successfully processed message')
  } catch (err) {
    logger.error(`app.js error message: ${err.message}`)
  }
})

// check if there is kafka connection alive
function check () {
  if (!consumer.client.initialBrokers && !consumer.client.initialBrokers.length) {
    return false
  }
  let connected = true
  consumer.client.initialBrokers.forEach(conn => {
    logger.debug(`url ${conn.server()} - connected=${conn.connected}`)
    connected = conn.connected & connected
  })
  return connected
}

const topics = [config.CREATE_CHALLENGE_RESOURCE_TOPIC, config.DELETE_CHALLENGE_RESOURCE_TOPIC]
consumer
  .init([{
    subscriptions: topics,
    handler: dataHandler
  }])
  // consume configured topics
  .then(() => {
    logger.info('Initialized.......')
    healthcheck.init([check])
    logger.info('Adding topics successfully.......')
    logger.info(topics)
    logger.info('Kick Start.......')
  })
  .catch((err) => logger.error(err))
if (process.env.NODE_ENV === 'test') {
  module.exports = consumer
}
