/**
 * The E2E test cases for Legacy resources processor.
 */
global.Promise = require('bluebird')
const _ = require('lodash')
const config = require('config')
const should = require('should')
const request = require('superagent')
const Kafka = require('no-kafka')
const logger = require('../../src/common/logger')
const { getKafkaOptions } = require('../../src/common/utils')
const { sleep } = require('../common/helper')

const {
  testMethods,
  nonExistingChallengeUuid
} = require('../common/testData')

const kafkaOptions = getKafkaOptions()
const WAIT_TIME = config.WAIT_TIME
describe('Legacy resources processor e2e Tests', () => {
  let appConsumer
  const infoLogs = []
  const errorLogs = []
  const debugLogs = []
  const debug = logger.debug
  const info = logger.info
  const error = logger.error

  const producer = new Kafka.Producer(kafkaOptions)

  /**
   * Clear logs
   */
  const clearLogs = () => {
    infoLogs.length = 0
    errorLogs.length = 0
    debugLogs.length = 0
  }

  /**
   * Assert error logs
   * @param message the error message to validate
   */
  const assertErrorLogs = (message) => {
    errorLogs.should.not.be.empty()
    errorLogs.some(x => String(x).includes(message)).should.be.true()
  }

  /**
   * Send message to Kafka producer
   * @param {Object} testMessage the test message to send
   * @param {String} the topic to which to send the message
   */
  const sendMessage = async (testMessage) => {
    await producer.send({
      topic: testMessage.topic,
      message: {
        value: JSON.stringify(testMessage)
      }
    })
  }

  /**
   * Consume not committed messages before e2e tests
   */
  const consumeMessages = async () => {
    // remove all not processed messages
    const consumer = new Kafka.GroupConsumer(kafkaOptions)
    await consumer.init([{
      subscriptions: [config.CREATE_CHALLENGE_RESOURCE_TOPIC, config.DELETE_CHALLENGE_RESOURCE_TOPIC],
      handler: (messageSet, topic, partition) => Promise.each(messageSet, (m) => consumer.commitOffset({ topic, partition, offset: m.offset }))
    }])
    // make sure to process all not committed messages before testing
    await sleep(2 * WAIT_TIME)
    await consumer.end()
  }

  // the message pattern to get topic/partition/offset
  const messagePattern = /^Handle Kafka event message; Topic: (.+); Partition: (.+); Offset: (.+); Message: (.+).$/

  /**
   * Wait job finished with successful log or error log is found
   */
  const waitJob = async (waitTime) => {
    while (true) {
      if (errorLogs.length > 0) {
        if (infoLogs.length && messagePattern.exec(infoLogs[0])) {
          const matchResult = messagePattern.exec(infoLogs[0])
          // only manually commit for error message during test
          await appConsumer.commitOffset({
            topic: matchResult[1],
            partition: parseInt(matchResult[2]),
            offset: parseInt(matchResult[3])
          })
        }
        break
      }
      if (debugLogs.some(x => String(x).includes('Successfully processed message'))) {
        break
      }
      // use small time to wait job and will use global timeout so will not wait too long
      await sleep(waitTime || WAIT_TIME)
    }
  }

  before(async () => {
    // inject logger with log collector
    logger.info = (message) => {
      infoLogs.push(message)
      if (!config.DISABLE_LOGGING) {
        info(message)
      }
    }
    logger.debug = (message) => {
      debugLogs.push(message)
      if (!config.DISABLE_LOGGING) {
        debug(message)
      }
    }
    logger.error = (message) => {
      errorLogs.push(message)
      if (!config.DISABLE_LOGGING) {
        error(message)
      }
    }
    await consumeMessages()
    // start kafka producer
    await producer.init()
    // start the application (kafka listener)
    appConsumer = require('../../src/app')

    // wait until consumer is successfully initialized
    while (true) {
      if (infoLogs.some(x => String(x).includes('Kick Start'))) {
        break
      }
      await sleep(WAIT_TIME)
    }
  })

  beforeEach(async () => {
    // clear logs
    clearLogs()
  })

  after(async () => {
    // restore logger
    logger.error = error
    logger.info = info
    logger.debug = debug
    try {
      await producer.end()
    } catch (err) {
      // ignore
    }
    try {
      await appConsumer.end()
    } catch (err) {
      // ignore
    }
  })

  it('Should setup healthcheck with check on kafka connection', async () => {
    const healthcheckEndpoint = `http://localhost:${process.env.PORT || 3000}/health`
    const result = await request.get(healthcheckEndpoint)
    should.equal(result.status, 200)
    should.deepEqual(result.body, { checksRun: 1 })
    debugLogs.should.match(/connected=true/)
  })

  it('Should handle invalid json message - createChallengeResource', async () => {
    await producer.send({
      topic: config.CREATE_CHALLENGE_RESOURCE_TOPIC,
      message: {
        value: '[ { - a b c'
      }
    })
    await waitJob()
    should.equal(errorLogs[0], 'Invalid message JSON.')
  })

  it('Should handle invalid json message - deleteChallengeResource', async () => {
    await producer.send({
      topic: config.DELETE_CHALLENGE_RESOURCE_TOPIC,
      message: {
        value: '[ { - a b c'
      }
    })
    await waitJob()
    should.equal(errorLogs[0], 'Invalid message JSON.')
  })

  // Tests common to all functions.
  for (const testMethod of Object.keys(testMethods)) {
    const { testMessage, requiredFields, integerFields, stringFields } = testMethods[testMethod]
    it(`test ${testMethod} message - invalid parameters, invalid timestamp`, async () => {
      const message = _.cloneDeep(testMessage)
      message.timestamp = 'invalid'
      await sendMessage(message)
      await waitJob()

      errorLogs.should.not.be.empty()
      assertErrorLogs('"timestamp" must be a number of milliseconds or valid date string')
    })

    for (const requiredField of requiredFields.filter(r => { return r !== 'topic' })) {
      it(`test ${testMethod} message - invalid parameters, required field ${requiredField} is missing`, async () => {
        let message = _.cloneDeep(testMessage)
        message = _.omit(message, requiredField)

        await sendMessage(message)
        await waitJob()

        errorLogs.should.not.be.empty()
        assertErrorLogs(`${_.last(requiredField.split('.'))}" is required`)
      })
    }

    for (const stringField of stringFields.filter(r => { return r !== 'topic' })) {
      it(`test ${testMethod} message - invalid parameters, invalid string type field ${stringField}`, async () => {
        const message = _.cloneDeep(testMessage)
        _.set(message, stringField, 111)

        await sendMessage(message)
        await waitJob()
        assertErrorLogs(`"${_.last(stringField.split('.'))}" must be a string`)
      })
    }

    for (const integerField of integerFields) {
      it(`test ${testMethod} message - invalid parameters, invalid integer type field ${integerField}(wrong number)`, async () => {
        const message = _.cloneDeep(testMessage)
        _.set(message, integerField, 'string')

        await sendMessage(message)
        await waitJob()
        assertErrorLogs(`"${_.last(integerField.split('.'))}" must be a number`)
      })
      it(`test ${testMethod} message - invalid parameters, invalid integer type field ${integerField}(wrong integer)`, async () => {
        const message = _.cloneDeep(testMessage)
        _.set(message, integerField, 1.1)

        await sendMessage(message)
        await waitJob()
        assertErrorLogs(`"${_.last(integerField.split('.'))}" must be an integer`)
      })
      it(`test ${testMethod} message - invalid parameters, invalid integer type field ${integerField}(negative)`, async () => {
        const message = _.cloneDeep(testMessage)
        _.set(message, integerField, -1)
        await sendMessage(message)
        await waitJob()
        assertErrorLogs(`"${_.last(integerField.split('.'))}" must be larger than or equal to 1`)
      })
    }

    it(`test ${testMethod} message - invalid parameters, non existing challenge uuid`, async () => {
      const message = _.cloneDeep(testMessage)
      _.set(message, 'payload.challengeId', nonExistingChallengeUuid)

      await sendMessage(message)
      await waitJob()
      assertErrorLogs(`Challenge with uuid ${nonExistingChallengeUuid} does not exist`)
    })
  }

  it('test createChallengeResource message - with valid message', async () => {
    await sendMessage(testMethods.createChallengeResource.testMessage)
    await waitJob(5 * WAIT_TIME)

    infoLogs[1].should.startWith('Successfully processed create challenge resource message')
    errorLogs.should.be.empty()
  })

  it('test deleteChallengeResource message - with valid message', async () => {
    // wait some time before sending the delete request to delete the added resource
    // The V4 API is a little bit slow
    await sleep(6 * WAIT_TIME)
    await sendMessage(testMethods.deleteChallengeResource.testMessage)
    await waitJob(5 * WAIT_TIME)

    infoLogs[1].should.startWith('Successfully processed delete challenge resource message')
    errorLogs.should.be.empty()
  })
})
