/*
 * Test data to be used in tests
 */

const challengeUuid = '96059e8d-4761-4978-9a14-c86ae6b971c3'
const nonExistingChallengeUuid = '96059e8d-1111-4978-9a14-c86ae6b971c3'
const submitterMemberId = 23225544 // lazybaer
const legacyId = 30049360

const submitterPayload = {
  'challengeId': challengeUuid,
  'roleId': 'bac822d2-725d-4973-9701-360918a09bc0',
  'memberId': submitterMemberId
}

const createResourceMessage = {
  'topic': 'challenge.resources.notification.create',
  'originator': 'resources-api',
  'timestamp': '2019-05-03T15:46:05.575Z',
  'mime-type': 'application/json',
  'payload': submitterPayload
}

const deleteResourceMessage = {
  'topic': 'challenge.resources.notification.delete',
  'originator': 'resources-api',
  'timestamp': '2019-05-03T15:46:05.575Z',
  'mime-type': 'application/json',
  'payload': submitterPayload
}

const existingChallenge = {
  'id': challengeUuid,
  'legacyId': legacyId,
  'type': 'Code'
}

const requiredFields = ['topic', 'originator', 'timestamp', 'mime-type', 'payload', 'payload.challengeId', 'payload.roleId', 'payload.memberId']
const stringFields = ['topic', 'originator', 'mime-type', 'payload.challengeId', 'payload.roleId']
const integerFields = ['payload.memberId']

const testMethods = {
  'createChallengeResource': {
    requiredFields,
    stringFields,
    integerFields,
    testMessage: createResourceMessage
  },
  'deleteChallengeResource': {
    requiredFields,
    stringFields,
    integerFields,
    testMessage: deleteResourceMessage
  }
}

const apiV4RequestBody = {
  roleId: 1,
  resourceUserId: submitterMemberId,
  isStudio: false
}

module.exports = {
  testMethods,
  nonExistingChallengeUuid,
  challengeUuid,
  existingChallenge,
  legacyId,
  apiV4RequestBody
}
