/**
 * The unit test cases for Legacy resources processor.
 */
global.Promise = require('bluebird')
const _ = require('lodash')
const config = require('config')
const processorService = require('../../src/services/ProcessorService')
const logger = require('../../src/common/logger')
const { assertValidationErrorInLogs } = require('../common/helper')
const {
  testMethods, nonExistingChallengeUuid
} = require('../common/testData')

describe('Legacy resources processor Unit Tests', () => {
  const infoLogs = []
  const errorLogs = []
  const info = logger.info
  const error = logger.error
  const assertValidationError = (err, message) => assertValidationErrorInLogs(errorLogs, err, message)

  before(async () => {
    // inject logger with log collector
    logger.info = (message) => {
      infoLogs.push(message)
      if (!config.DISABLE_LOGGING) {
        info(message)
      }
    }
    logger.error = (message) => {
      errorLogs.push(message)
      if (!config.DISABLE_LOGGING) {
        error(message)
      }
    }
  })
  beforeEach(async () => {
    // clear logs
    infoLogs.length = 0
    errorLogs.length = 0
  })
  after(async () => {
    // restore logger
    logger.error = error
    logger.info = info
  })

  // Tests common to all functions.
  for (const testMethod of Object.keys(testMethods)) {
    const { testMessage, requiredFields, integerFields, stringFields } = testMethods[testMethod]
    it(`test ${testMethod} message - invalid parameters, invalid timestamp`, async () => {
      let message = _.cloneDeep(testMessage)
      message.timestamp = 'invalid'
      try {
        await processorService[testMethod](message)
        throw new Error('should not throw error here')
      } catch (err) {
        assertValidationError(err, `"timestamp" must be a number of milliseconds or valid date string`)
      }
    })

    for (const requiredField of requiredFields) {
      it(`test ${testMethod} message - invalid parameters, required field ${requiredField} is missing`, async () => {
        let message = _.cloneDeep(testMessage)
        message = _.omit(message, requiredField)
        try {
          await processorService[testMethod](message)
          throw new Error('should not throw error here')
        } catch (err) {
          assertValidationError(err, `"${_.last(requiredField.split('.'))}" is required`)
        }
      })
    }

    for (const stringField of stringFields) {
      it(`test ${testMethod} message - invalid parameters, invalid string type field ${stringField}`, async () => {
        let message = _.cloneDeep(testMessage)
        _.set(message, stringField, 111)
        try {
          await processorService[testMethod](message)
          throw new Error('should not throw error here')
        } catch (err) {
          assertValidationError(err, `"${_.last(stringField.split('.'))}" must be a string`)
        }
      })
    }

    for (const integerField of integerFields) {
      it(`test ${testMethod} message - invalid parameters, invalid integer type field ${integerField}(wrong number)`, async () => {
        let message = _.cloneDeep(testMessage)
        _.set(message, integerField, 'string')
        try {
          await processorService[testMethod](message)
          throw new Error('should not throw error here')
        } catch (err) {
          assertValidationError(err, `"${_.last(integerField.split('.'))}" must be a number`)
        }
      })
      it(`test ${testMethod} message - invalid parameters, invalid integer type field ${integerField}(wrong integer)`, async () => {
        let message = _.cloneDeep(testMessage)
        _.set(message, integerField, 1.1)
        try {
          await processorService[testMethod](message)
          throw new Error('should not throw error here')
        } catch (err) {
          assertValidationError(err, `"${_.last(integerField.split('.'))}" must be an integer`)
        }
      })
      it(`test ${testMethod} message - invalid parameters, invalid integer type field ${integerField}(negative)`, async () => {
        let message = _.cloneDeep(testMessage)
        _.set(message, integerField, -1)
        try {
          await processorService[testMethod](message)
          throw new Error('should not throw error here')
        } catch (err) {
          assertValidationError(err, `"${_.last(integerField.split('.'))}" must be larger than or equal to 1`)
        }
      })
    }

    it(`test ${testMethod} message - invalid parameters, non existing challenge uuid`, async () => {
      let message = _.cloneDeep(testMessage)
      _.set(message, 'payload.challengeId', nonExistingChallengeUuid)
      try {
        await processorService[testMethod](message)
        throw new Error('should not throw error here')
      } catch (err) {
        errorLogs.should.not.be.empty()
        errorLogs[1].should.containEql(`Challenge with uuid ${nonExistingChallengeUuid} does not exist`)
      }
    })
  }

  it(`test createChallengeResource message - with valid message`, async () => {
    await processorService['createChallengeResource'](testMethods['createChallengeResource'].testMessage)
    infoLogs[0].should.startWith(`Successfully processed create challenge resource message`)
    errorLogs.should.be.empty()
  })

  it(`test deleteChallengeResource message - with valid message`, async () => {
    await processorService['deleteChallengeResource'](testMethods['deleteChallengeResource'].testMessage)
    infoLogs[0].should.startWith(`Successfully processed delete challenge resource message`)
    errorLogs.should.be.empty()
  })
})
