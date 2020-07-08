/**
 * Service for legacy resources processor.
 */
const _ = require('lodash')
const Joi = require('joi')
const config = require('config')
const logger = require('../common/logger')
const helper = require('../common/helper')
const {getRoleIdByUuid, isStudio} = require('../common/utils')

/**
 * Check if a challenge exists on legacy (v4)
 * @param {Object} message The message containing the challenge resource information
 */
async function legacyChallengeExist (message) {
  let exists = true
  try {
    const m2mToken = await helper.getM2Mtoken()
    const res = await helper.getRequest(`${config.CHALLENGE_API_V5_URL}/${_.get(message, 'payload.challengeId')}`, m2mToken)
    // logger.debug(`m2m Token: ${m2mToken}`)
    logger.debug(`Getting Challenge from V5 ${config.CHALLENGE_API_V5_URL}/${_.get(message, 'payload.challengeId')}`)
    logger.debug(`Response ${JSON.stringify(res.body)}`)
    const v5Challenge = res.body
    if (!v5Challenge.legacyId) {
      exists = false
    }
    await helper.getRequest(`${config.CHALLENGE_API_V4_URL}/${v5Challenge.legacyId}`, m2mToken)

    logger.debug(`Calling V4: ${config.CHALLENGE_API_V4_URL}/${v5Challenge.legacyId}`)
  } catch (e) {
    logger.error(`error getting legacy challenge ${JSON.stringify(e)}`)
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

  let v5Challenge = null
  try {
    const res = await helper.getRequest(`${config.CHALLENGE_API_V5_URL}/${_.get(message, 'payload.challengeId')}`, m2mToken)
    v5Challenge = res.body
  } catch (err) {
    throw new Error(`Challenge with uuid ${_.get(message, 'payload.challengeId')} does not exist.`)
  }

  const body = {
    roleId: getRoleIdByUuid(message.payload.roleId),
    resourceUserId: _.get(message, 'payload.memberId'),
    isStudio: isStudio(v5Challenge.type)
  }

  // create or delete the challenge resource from V4 API
  if (isDelete) {
    logger.debug(`Deleteing Challenge Resource ${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/resources - ${JSON.stringify(body)}`)
    await helper.deleteRequest(`${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/resources`, body, m2mToken)
  } else {
    logger.debug(`POSTING Challenge Resource ${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/resources - ${JSON.stringify(body)}`)
    await helper.postRequest(`${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/resources`, body, m2mToken)
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
    logger.logFullError(e)
    logger.debug(e.message)
  }

  logger.info(`Successfully processed create challenge resource message : ${JSON.stringify(message)}`)
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
  }).required()
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
    logger.info(`Failed to find and delete the resource: ${JSON.stringify(message)}`)
  }

  logger.info(`Successfully processed delete challenge resource message : ${JSON.stringify(message)}`)
}

deleteChallengeResource.schema = createChallengeResource.schema

module.exports = {
  createChallengeResource,
  deleteChallengeResource,
  legacyChallengeExist
}

logger.buildService(module.exports)
