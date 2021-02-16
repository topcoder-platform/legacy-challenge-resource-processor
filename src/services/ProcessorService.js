/**
 * Service for legacy resources processor.
 */
const _ = require('lodash')
const Joi = require('joi')
const config = require('config')
const logger = require('../common/logger')
const helper = require('../common/helper')
const ResourceDirectManager = require('./ResourceDirectManager')
const ProjectServices = require('./ProjectService')
const notificationService = require('./NotificationService')
const {isStudio} = require('../common/utils')

/**
 * Check if a challenge exists on legacy (v4)
 * @param {Object} message The message containing the challenge resource information
 */
async function legacyChallengeExistInV4 (legacyId) {
  try {
    const m2mToken = await helper.getM2Mtoken()
    logger.debug(`Calling V4: ${config.CHALLENGE_API_V4_URL}/${legacyId}`)
    await helper.getRequest(`${config.CHALLENGE_API_V4_URL}/${legacyId}`, m2mToken)
  } catch (e) {
    logger.logFullError(e)
    throw new Error(`v4 Challenge not found for ${legacyId}`)
  }
}

/**
 * Updates (create or delete) a challenge resource based on the isDelete flag
 *
 * @param {Object} message The message containing the challenge resource information
 * @param {Boolean} isDelete The flag indicating whether it is a delete or create operation
 */
async function _updateChallengeResource (message, isDelete) {
  const m2mToken = await helper.getM2Mtoken()
  const challengeId = _.get(message, 'payload.challengeId')

  if (_.isNil(challengeId)) {
    throw new Error(`Challenge ID ${challengeId} is null`)
  }

  let v5Challenge = null
  try {
    const res = await helper.getRequest(`${config.CHALLENGE_API_V5_URL}/${challengeId}`, m2mToken)
    v5Challenge = res.body
    if (_.get(v5Challenge, 'legacy.pureV5Task')) {
      logger.debug('Challenge is a pure v5 task. Will skip...')
      return
    }
  } catch (err) {
    throw new Error(`Challenge with uuid ${challengeId} does not exist in v5 API [GET ${config.CHALLENGE_API_V5_URL}/${challengeId}] - Error: ${JSON.stringify(err)}.`)
  }

  if (!v5Challenge.legacyId) {
    throw new Error(`Challenge ${challengeId} has no Legacy ID: ${JSON.stringify(v5Challenge)}`)
  }
  await legacyChallengeExistInV4(v5Challenge.legacyId)

  let resourceRole = null
  let resourceRoleResponse = null
  try {
    resourceRoleResponse = await helper.getRequest(`${config.RESOURCE_ROLE_API_URL}?id=${_.get(message, 'payload.roleId')}`, m2mToken)
  } catch (err) {
    throw new Error(`Resource Role ${_.get(message, 'payload.roleId')} not found. ${JSON.stringify(err)}`)
  }
  resourceRole = resourceRoleResponse.body[0]
  const userId = _.get(message, 'payload.memberId')
  const handle = _.get(message, 'payload.memberHandle')
  const resourceRoleId = resourceRole.legacyId
  const legacyChallengeID = _.get(v5Challenge, 'legacyId')
  const isStudioChallenge = isStudio(v5Challenge.type)
  // const forumId = _.get(v5Challenge, 'legacy.forumId', 0)
  const isTask = _.get(v5Challenge, 'task.isTask', false)

  const prizeSets = _.get(v5Challenge, 'prizeSets')
  const copilotPaymentAmount = _.get(_.find(prizeSets, p => p.type === config.COPILOT_PAYMENT_TYPE), 'prizes[0].value', null)

  const body = {
    roleId: resourceRoleId,
    resourceUserId: userId,
    isStudio: isStudioChallenge
  }

  // let response = null
  const resources = await ProjectServices.searchResources(legacyChallengeID, resourceRoleId)
  const existingResource = _.find(resources, r => _.toString(r.userid) === _.toString(userId))
  // if the resource already exists, skip it
  if (!isDelete && existingResource) {
    logger.debug(`Will skip creating resource ${userId} with role ${resourceRoleId} for challenge ${legacyChallengeID}`)
    return
  }

  if (resourceRole.id === config.SUBMITTER_ROLE_ID && !isTask) {
    if (isDelete) {
      logger.debug(`v4 Unregistering Submitter ${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/unregister?userId=${userId} - ${JSON.stringify(body)}`)
      await helper.postRequest(`${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/unregister?userId=${userId}`, {}, m2mToken)
    } else {
      logger.debug(`v4 Registering Submitter ${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/register?userId=${userId} - ${JSON.stringify(body)}`)
      await helper.postRequest(`${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/register?userId=${userId}`, {}, m2mToken)
    }
  } else {
    if (isDelete) {
      logger.debug(`Deleting Challenge Resource ${userId} from challenge ${legacyChallengeID} with roleID ${resourceRoleId}`)
      await ResourceDirectManager.removeResource(legacyChallengeID, resourceRoleId, userId)
    } else {
      logger.debug(`Creating Challenge Resource ${userId} to challenge ${legacyChallengeID} with roleID ${resourceRoleId}`)
      await ResourceDirectManager.addResource(legacyChallengeID, resourceRoleId, userId, handle, copilotPaymentAmount)
    }
  }
  if (config.RESOURCE_ROLES_WITHOUT_TIMELINE_NOTIFICATIONS.indexOf(resourceRole.id) === -1) {
    if (isDelete) {
      await notificationService.disableTimelineNotifications(_.get(v5Challenge, 'legacyId'), userId)
    } else {
      let shouldEnableNotifications = true
      if (resourceRole.id === config.MANAGER_RESOURCE_ROLE_ID) {
        // see if notifications should be enabled based on the user's role on the project
        const v5ProjectRes = await helper.getRequest(`${config.PROJECTS_V5_API_URL}/${v5Challenge.projectId}`, m2mToken)
        const memberRolesOnV5Project = _.map(_.filter(_.get(v5ProjectRes, 'body.members', []), m => _.toString(m.userId) === _.toString(userId)), r => r.role)
        if (memberRolesOnV5Project.length > 0 && _.intersection(config.PROJECT_ROLES_WITHOUT_TIMELINE_NOTIFICATIONS, memberRolesOnV5Project).length > 0) {
          // notifications should not be enabled
          shouldEnableNotifications = false
        }
      }
      if (shouldEnableNotifications) {
        await notificationService.enableTimelineNotifications(_.get(v5Challenge, 'legacyId'), userId, _.get(v5Challenge, 'updatedBy') || _.get(v5Challenge, 'createdBy'))
      }
    }
  }
}

/**
 * Creates a challenge resource.
 *
 * @param {Object} message The message containing the information of the resource to create.
 */
async function createChallengeResource (message) {
  try {
    await _updateChallengeResource(message, false)
    logger.info(`Successfully processed create challenge resource message : ${JSON.stringify(message)}`)
  } catch (e) {
    logger.error(e.message)
    logger.logFullError(e)
  }
}

createChallengeResource.schema = {
  message: Joi.object().keys({
    topic: Joi.string().required(),
    originator: Joi.string().required(),
    timestamp: Joi.date().required(),
    'mime-type': Joi.string().required(),
    payload: Joi.object().keys({
      challengeId: Joi.string().uuid().required(),
      roleId: Joi.string().uuid().required(),
      memberId: Joi.number().integer().min(1).required()
    }).unknown(true).required()
  }).unknown(true).required()
}

/**
 * Deletes a challenge resource.
 *
 * @param {Object} message The message containing the information of the resource to delete.
 */
async function deleteChallengeResource (message) {
  try {
    await _updateChallengeResource(message, true)
    logger.info(`Successfully processed delete challenge resource message : ${JSON.stringify(message)}`)
  } catch (e) {
    logger.error(`Failed to find and delete the resource: ${JSON.stringify(message)} Error: ${JSON.stringify(e)}`)
  }
}

deleteChallengeResource.schema = createChallengeResource.schema

module.exports = {
  createChallengeResource,
  deleteChallengeResource
}

// logger.buildService(module.exports)
