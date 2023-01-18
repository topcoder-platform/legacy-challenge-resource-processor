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
const ProjectPaymentDAO = require('../dao/ProjectPaymentDAO')
const RegistrationDAO = require('../dao/RegistrationDAO');

const notificationService = require('./NotificationService')
const { isStudio } = require('../common/utils')

function getReviewerPaymentData(v5Challenge) {
  const metadata = _.get(v5Challenge, 'metadata', [])

  let reviewerPaymentAmount = null;

  // if prizeSets[x].type == 'reviewer' then prizeSets[x].prizes[0].value is a "fixed" reviewer payment amount
  // this applies to Self Service & Topgear specific challenges
  // Note: for challenges that set a reviewer prize, but have multiple reviewers all reviewers will have the prize amount
  // and if this is not the desired behaviour, then we'll need to settle on a an interface to define which reviewer gets what amount
  // and it'll likely be through index (prizeSets[0] is 1st reviewer, prizeSets[1] is 2nd reviewer, etc.) since at this stage reviewer
  // information is not available
  const reviewerPaymentAmounts = _.get(_.find(v5Challenge.prizeSets, prizeSet => prizeSet.type === config.REVIEWER_PAYMENT_TYPE), 'prizes', null)
  logger.info(`${v5Challenge.id}: Reviewer payment amounts: ${JSON.stringify(reviewerPaymentAmounts)}`)
  reviewerPaymentAmount = reviewerPaymentAmounts != null && reviewerPaymentAmounts.length > 0 ? reviewerPaymentAmounts[0].value : null;

  if (reviewerPaymentAmount == null) {
    // Since this is how Topgear currently stores the reviewer payment amount, we need to have this separate check
    // If Topgear ever changes the way it stores the reviewer payment amount, this check can be removed to make the amount extraction consistent
    reviewerPaymentAmount = _.get(_.find(metadata, m => m.name === 'reviewerPrize'), 'value', null)
    logger.info(`${v5Challenge.id}: Reviewer payment amount (extracted from metadata): ${reviewerPaymentAmount}`)
  }


  return {
    reviewerPaymentAmount,
    manual: reviewerPaymentAmount != null
  }
}

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
  const reviewerPaymentData = helper.isReviewerRole(resourceRoleId) ? getReviewerPaymentData(v5Challenge) : null;

  logger.info(`Reviewers payment data: ${JSON.stringify(reviewerPaymentData)}`)

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
    // force sync v4 elasticsearch service
    logger.debug('Start v4 challenge reindexing to the elasticsearch service')
    await helper.forceV4ESFeeder(_.get(v5Challenge, 'legacyId'))
    await new Promise(resolve => setTimeout(resolve, config.INDEX_CHALLENGE_TIMEOUT * 1000))
    logger.debug('End v4 challenge reindexing to the elasticsearch service')
    if (isDelete) {
      logger.debug(`v4 Unregistering Submitter ${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/unregister?userId=${userId} - ${JSON.stringify(body)}`)
      await helper.postRequest(`${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/unregister?userId=${userId}`, {}, m2mToken)
    } else {
      logger.debug(`v4 Registering Submitter ${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/register?userId=${userId}&v5ChallengeId=${challengeId} - ${JSON.stringify(body)}`)
      await helper.postRequest(`${config.CHALLENGE_API_V4_URL}/${_.get(v5Challenge, 'legacyId')}/register?userId=${userId}&v5ChallengeId=${challengeId}`, {}, m2mToken)
    }
  } else {
    if (isDelete) {
      logger.debug(`Deleting Challenge Resource ${userId} from challenge ${legacyChallengeID} with roleID ${resourceRoleId}`)
      await ResourceDirectManager.removeResource(legacyChallengeID, resourceRoleId, userId)
    } else {
      logger.debug(`Creating Challenge Resource ${userId} to challenge ${legacyChallengeID} with roleID ${resourceRoleId}`)
      await ResourceDirectManager.addResource(legacyChallengeID, resourceRoleId, userId, handle, { copilotPaymentAmount, manual: false }, reviewerPaymentData)
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


/**
 * Updates resource payment
 *
 * @param {Object} message The message containing the information of challenge whose resource payment to update
 */

async function updateResourcePayment (message) {
  logger.info(`Received update resource payment message : ${JSON.stringify(message)}`)
  const { payload: { legacyId, updatedBy } } = message

  // if legacy challenge has not yet been created, we don't need to modify any payment records
  // as they don't exist yet :) challenge.action.resource.create should take care of that
  if (legacyId == null) {
    logger.info(`LegacyId is null. Skipping update resource payment message : ${JSON.stringify(message)}`)
    return;
  }

  logger.info(`Get reviewer payments for challenge ${legacyId}`)
  const reviewerPaymentAmounts = await ProjectPaymentDAO.getChallengePaymentsByRoleIds(legacyId, [config.LEGACY_REVIEWER_ROLE_ID, config.LEGACY_REVIEWER_ITERATIVE_ROLE_ID])

  logger.info(`Reviewer payments for legacyId: ${legacyId} are -> ${JSON.stringify(reviewerPaymentAmounts)}`)

  let reviewerPrize = getReviewerPaymentData(message.payload).reviewerPaymentAmount;
  logger.info(`reviewerPrize: ${JSON.stringify(reviewerPrize)}`)

  if (reviewerPrize == null) {
    logger.info(`reviewerPrize is null. Skipping update resource payment message : ${JSON.stringify(message)}`)
    return;
  }

  try {
    reviewerPrize = parseFloat(reviewerPrize)
  } catch (err) {
    logger.error(`Invalid reviewerPrize: ${JSON.stringify(reviewerPrize)}`)
    return;
  }

  const userId = await helper.getUserId(updatedBy);

  for (const reviewerPaymentAmount of reviewerPaymentAmounts) {
    logger.info(`Payment Amt: ${reviewerPrize}`)

    const { resource_id: resourceId, role_id: roleId, project_payment_id: projectPaymentId, amount } = reviewerPaymentAmount
    if (projectPaymentId == null) {
      logger.info(`Add new payment for resource ${resourceId} with role ${roleId}.`)
      await ProjectPaymentDAO.persistReviewerPayment(userId, resourceId, reviewerPrize, config.LEGACY_PROJECT_REVIEW_PAYMENT_TYPE_ID);
      await RegistrationDAO.persistResourceInfo(userId, resourceId, RegistrationDAO.RESOURCE_TYPE_MANUAL_PAYMENTS, 'true');
    } else {
      logger.info(`Update reviewer payment ${amount} for resource ${resourceId} with role ${roleId} and payment ${projectPaymentId} with amount ${reviewerPrize.value}`)
      await ProjectPaymentDAO.updateProjectPayment(userId, projectPaymentId, reviewerPrize)
    }
  }
}

updateResourcePayment.schema = {
  message: Joi.object().keys({
    topic: Joi.string().required(),
    originator: Joi.string().required(),
    timestamp: Joi.date().required(),
    'mime-type': Joi.string().required(),
    key: Joi.string().allow(null),
    payload: Joi.object().keys({
      legacyId: Joi.number().integer().positive(),
      id: Joi.string().required(),
      updatedBy: Joi.string(),
      metadata: Joi.array().items(Joi.object().keys({
        name: Joi.string().required(),
        value: Joi.string().required()
      }).unknown(true))
    }).unknown(true).required()
  }).required()
}

module.exports = {
  createChallengeResource,
  deleteChallengeResource,
  updateResourcePayment
}

// logger.buildService(module.exports)
