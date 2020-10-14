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
const {isStudio} = require('../common/utils')

/**
 * Check if a challenge exists on legacy (v4)
 * @param {Object} message The message containing the challenge resource information
 */
async function legacyChallengeExist (message) {
  let exists = true
  const challengeId = _.get(message, 'payload.challengeId')
  if (_.isNil(challengeId)) {
    throw new Error(`Challenge ID ${challengeId} is null`)
  }
  try {
    const m2mToken = await helper.getM2Mtoken()
    const res = await helper.getRequest(`${config.CHALLENGE_API_V5_URL}/${challengeId}`, m2mToken)
    // logger.debug(`m2m Token: ${m2mToken}`)
    // logger.debug(`Getting Challenge from V5 ${config.CHALLENGE_API_V5_URL}/${challengeId}`)
    // logger.debug(`Response ${JSON.stringify(res.body)}`)
    const v5Challenge = res.body
    if (!v5Challenge.legacyId) {
      exists = false
      logger.warn(`Challenge ${challengeId} does not have a legacyId. Can't fetch details from V4`)
    } else {
      logger.debug(`Calling V4: ${config.CHALLENGE_API_V4_URL}/${v5Challenge.legacyId}`)
      await helper.getRequest(`${config.CHALLENGE_API_V4_URL}/${v5Challenge.legacyId}`, m2mToken)
    }
  } catch (e) {
    logger.warn(`error getting legacy challenge ${JSON.stringify(e)}`)
    exists = false
  }
  return exists
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
  } catch (err) {
    throw new Error(`Challenge with uuid ${challengeId} does not exist.`)
  }
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
}

/**
 * Creates a challenge resource.
 *
 * @param {Object} message The message containing the information of the resource to create.
 */
async function createChallengeResource (message) {
  try {
    await _updateChallengeResource(message, false)
  } catch (e) {
    logger.error(e.message)
    logger.logFullError(e)
  }

  // logger.debug(`Successfully processed create challenge resource message : ${JSON.stringify(message)}`)
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
  } catch (e) {
    logger.error(`Failed to find and delete the resource: ${JSON.stringify(message)} Error: ${JSON.stringify(e)}`)
  }

  // logger.debug(`Successfully processed delete challenge resource message : ${JSON.stringify(message)}`)
}

deleteChallengeResource.schema = createChallengeResource.schema

module.exports = {
  createChallengeResource,
  deleteChallengeResource,
  legacyChallengeExist
}

// logger.buildService(module.exports)
