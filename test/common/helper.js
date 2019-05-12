/**
 * This module provides test helper functionality.
 */

const should = require('should')

/**
 * Sleep with given time
 * @param {Number} time the time to sleep
 */
async function sleep (time) {
  await new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}

/**
  * Assert validation error in the error logs
  *
  * @param {Array} errorLogs The error logs array
  * @param {Object} err the error to validate
  * @param {String} message the error message
  */
const assertValidationErrorInLogs = (errorLogs, err, message) => {
  err.isJoi.should.be.true()
  should.equal(err.name, 'ValidationError')
  err.details.map(x => x.message).should.containEql(message)
  errorLogs.should.not.be.empty()
  errorLogs.some(x => String(x).includes(err.stack)).should.be.true()
}

module.exports = {
  sleep,
  assertValidationErrorInLogs
}
