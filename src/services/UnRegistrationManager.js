const UnRegistrationDAO = require('../dao/UnRegistrationDAO')
const logger = require('../common/logger')
const helper = require('../common/helper')
const config = require('../../config/default')
const Constants = require('../constants')
const ForumWrapper = require('../dao/ForumWrapper')
const EsFeederServiceClient = require('../client/EsFeederServiceClient')

async function unregisterChallenge (userId, challengeId) {
  const regValidation = await UnRegistrationDAO.performChallengeUnregistrationValidations(userId, challengeId)
  if (!regValidation) {
    throw new Error('No such challenge exists.')
  }
  if (!regValidation.regopen) {
    throw new Error('You cannot unregister since registration phase is not open.')
  }
  if (!regValidation.userregistered) {
    throw new Error('You are not registered for this challenge.')
  }
  if (!regValidation.studio) {
    await UnRegistrationDAO.deleteChallengeResult(challengeId, userId)
  }
  const resources = await UnRegistrationDAO.getUserChallengeResource(challengeId, userId)
  if (!resources || resources.length < 1) {
    logger.error('Could not find user challenge resource')
    throw new Error(`Could not find user ${userId} from challenge ${challengeId}.`)
  }
  let toDelete = null
  for (const res of resources) {
    if (res.resourceroleid === Constants.SUBMITTER_RESOURCE_ROLE_ID) {
      toDelete = res
      break
    }
  }
  if (toDelete) {
    await UnRegistrationDAO.deleteChallengeResources(toDelete.resourceid)
    await UnRegistrationDAO.auditChallengeRegistration(challengeId, userId, Constants.SUBMITTER_RESOURCE_ROLE_ID, Constants.PROJECT_USER_AUDIT_DELETE_TYPE, userId)
  }
  // remove forum permission for dev challenge. No forum permission for design challenge right now
  if (!regValidation.studio) {
    // Only remove forum permissions if the user has no other roles left.
    if (resources.length === 1 && resources[0].resourceroleid === Constants.SUBMITTER_RESOURCE_ROLE_ID) {
      const forums = await UnRegistrationDAO.getChallengeForum(challengeId)
      if (!forums || forums.length < 1) {
        logger.error('Could not find user challenge forum')
        throw new Error('Could not find user challenge forum')
      }
      const forumCategoryId = forums[0].forumcategoryid
      if (!forumCategoryId && forumCategoryId === 0) {
        return
      }
      if (forumCategoryId === null) {
        logger.error('Could not find forum category')
        throw new Error('Could not find forum category')
      }
      logger.info('start to remove user ' + userId + ' from forum category ' + forumCategoryId + '.')
      try {
        await ForumWrapper.removeRole(userId, 'Software_Users_' + forumCategoryId)
        await ForumWrapper.removeRole(userId, 'Software_Moderators_' + forumCategoryId)
        await ForumWrapper.removeUserPermission(userId, forumCategoryId)
        await ForumWrapper.deleteCategoryWatch(userId, forumCategoryId)
      } catch (exp) {
        logger.error(exp)
      }
    }
  }
  // TODO: implement following logic in nodejs
  await fireEvent(challengeId, userId)
  logger.info('notify es es')
  await EsFeederServiceClient.notifyChallengeChange(challengeId)
}

/**
 * Fire event
 *
 * @param challengeId the challengeId to use
 * @param userId the user id
 */
async function fireEvent (challengeId, userId) {
  const message = {
    type: 'USER_UNREGISTRATION',
    detail: {
      challengeId,
      userId
    }
  }
  await helper.postBusEvent(config.CHALLENGE_USER_UNREGISTRATION_TOPIC, message)
}

module.exports = {
  unregisterChallenge
}
