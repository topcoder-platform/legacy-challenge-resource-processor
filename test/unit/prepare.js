/*
 * Setting up Mock for unit tests
 */

const config = require('config')
const nock = require('nock')
const prepare = require('mocha-prepare')
const {
  challengeUuid,
  existingChallenge,
  nonExistingChallengeUuid,
  legacyId,
  apiV4RequestBody
} = require('../common/testData')

// called before loading of test cases
prepare((done) => {
  // configure mock responses for challenges v5 API
  nock(config.CHALLENGE_API_V5_URL)
    .persist()
    .get(`/${challengeUuid}`)
    .reply(200, existingChallenge)
    .get(`/${nonExistingChallengeUuid}`)
    .reply(404, null)

  // configure mock responses for challenges v4 API
  nock(config.CHALLENGE_API_V4_URL)
    .persist()
    .post(`/${legacyId}/resources`, apiV4RequestBody)
    .reply(200, {})
    .delete(`/${legacyId}/resources`, apiV4RequestBody)
    .reply(200, {})
  done()
}, (done) => {
  // called after all test completes (regardless of errors)
  nock.cleanAll()
  done()
})
