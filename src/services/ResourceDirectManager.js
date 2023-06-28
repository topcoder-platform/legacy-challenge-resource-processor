const ProjectServices = require('./ProjectService')
const RegistrationDAO = require('../dao/RegistrationDAO')
const SequenceDAO = require('../dao/SequenceDAO')
const ProjectPaymentDAO = require('../dao/ProjectPaymentDAO')
const logger = require('../common/logger')
const config = require('config')
const { find, toString } = require('lodash')
const { isReviewerRole, isSubmitterRole } = require('../common/helper')

/**
 * Assign the given roleId to the specified userId in the given project.
 * @param legacyChallengeId the id of the contest/challenge.
 * @param roleId
 *            the id of the role.
 * @param userId
 *            the id of the user.
 * @param handle
 */
async function assignRole (legacyChallengeId, roleId, userId, handle, copilotPayment, reviewerPayment, isStudioChallenge) {
  const { reviewerPaymentAmount, manual: isReviewerPaymentManual } = reviewerPayment || {};
  const { copilotPaymentAmount } = copilotPayment || {};

  const found = await ProjectServices.resourceExists(legacyChallengeId, roleId, userId)
  const termChecking = true
  const eligible = true
  if (found) {
    throw new Error('User ' + userId + ' with role ' + roleId + ' already exists')
  }

  // if not found && user agreed terms (if any) && is eligible, add resource
  if (!found && termChecking && eligible) {
    const allroles = await ProjectServices.getAllResourceRoles()
    let roleToSet = null
    if (allroles && allroles.length > 0) {
      for (const role of allroles) {
        if (role.resource_role_id === roleId) {
          roleToSet = role
        }
      }
    }
    if (!roleToSet) {
      throw new Error('Invalid role id ' + roleId)
    }
  }

  logger.info('Before isSubmitterRole')
  if (isSubmitterRole(roleId)) {
    logger.info('is submitter role, it should register component inquiry and project result')
    const compInfo = await RegistrationDAO.registerComponentInquiry(userId, legacyChallengeId)
    let { rating } = compInfo
    if (!isStudioChallenge) {
      if (!RegistrationDAO.isRatingSuitableDevelopment(parseInt(compInfo.phaseid, 10), parseInt(compInfo.projectcategoryid, 10)) ? compInfo.rating : null) {
        rating = null
      }
      logger.info('Register project result')
      await RegistrationDAO.insertChallengeResult(legacyChallengeId, userId, 0, 0, rating)
      // User reliability
      const [rel] = await RegistrationDAO.getUserReliability(userId, legacyChallengeId)
      if (rel) {
        logger.info('Update user reliability')
        await RegistrationDAO.persistResourceInfo(userId, resourceId, RegistrationDAO.RESOURCE_TYPE_USER_RELIABILITY, rel*100);
      }
    }
  }

  let projectPhaseId = null
  if (roleId === config.LEGACY_REVIEWER_ROLE_ID) {
    projectPhaseId = await RegistrationDAO.getPhaseIdForPhaseTypeId(legacyChallengeId, config.LEGACY_REVIEW_PHASE_ID)
  }
  const resourceId = await SequenceDAO.getResourceSeqNextId()
  await RegistrationDAO.persistResourceWithRoleId(userId, legacyChallengeId, resourceId, roleId, handle, projectPhaseId, copilotPaymentAmount)

  if (isReviewerRole(roleId) && reviewerPaymentAmount != null) {
    logger.info(`Add reviewer payment. Payment type is set to ${isReviewerPaymentManual ? 'manual' : 'automatic'}`)
    await ProjectPaymentDAO.persistReviewerPayment(userId, resourceId, reviewerPaymentAmount, config.LEGACY_PROJECT_REVIEW_PAYMENT_TYPE_ID)
    if (isReviewerPaymentManual) {
      await RegistrationDAO.persistResourceInfo(userId, resourceId, RegistrationDAO.RESOURCE_TYPE_MANUAL_PAYMENTS, 'true');
    }
  } else {
    logger.info(`Not a reviewer role ${roleId} or reviewerPaymentAmount:${reviewerPaymentAmount} is null`)
  }

  // only check notification setting for observer, else always add
  // if (roleId !== Constants.RESOURCE_ROLE_OBSERVER_ID || addNotification) {
  //   await ProjectServices.addNotifications(contestId, userId, Constants.TIMELINE_NOTIFICATION_ID, operatorId)
  // }
}

/**
 * Assign the given roleId to the specified userId in the given project.
 * @param legacyChallengeId
 *            the id of the contest/challenge.
 * @param roleId
 *            the id of the role.
 * @param userId
 *            the id of the user.
 */
async function removeRole (legacyChallengeId, roleId, userId) {
  const resources = await ProjectServices.searchResources(legacyChallengeId, roleId)
  const existingResource = find(resources, r => toString(r.userid) === toString(userId))

  if (!existingResource) {
    logger.error('removeRole Resource Not Found')
    throw new Error('User ' + userId + ' does not have role ' + roleId + ' for the project ' + legacyChallengeId)
  }

  if (isReviewerRole(roleId)) {
    logger.info('Remove reviewer payment first.')
    await ProjectPaymentDAO.removeReviewerPayment(existingResource.resourceid)
  } else if (isSubmitterRole(roleId)) {
    try {
      await RegistrationDAO.deleteProjectResult(legacyChallengeId, userId)
    } catch (e) {
      logger.error('Error deleting project result', e)
    }
    try {
      await RegistrationDAO.deleteComponentInquiry(legacyChallengeId, userId)
    } catch (e) {
      logger.error('Error deleting component inquiry', e)
    }
  }
  await ProjectServices.removeResource(existingResource)

}

/**
 * Add resource
 *
 * @param challengeId
 * @param resourceRoleId
 * @param userId
 * @param handle
 * @param copilotPaymentAmount
 */
async function addResource (challengeId, resourceRoleId, userId, handle, copilotPayment, reviewerPayment, isStudioChallenge) {
  await assignRole(challengeId, resourceRoleId, userId, handle, copilotPayment, reviewerPayment, isStudioChallenge)
}

/**
 * Remove resource
 *
 * @param challengeId
 * @param resourceRoleId
 * @param userId
 */
async function removeResource (challengeId, resourceRoleId, userId) {
  await removeRole(challengeId, resourceRoleId, userId)
}

module.exports = {
  addResource,
  removeResource
}
