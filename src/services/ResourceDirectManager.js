const ProjectServices = require('./ProjectService')
const RegistrationDAO = require('../dao/RegistrationDAO')
const SequenceDAO = require('../dao/SequenceDAO')
const logger = require('../common/logger')
const config = require('config')
const { find, toString } = require('lodash')

/**
 * Assign the given roleId to the specified userId in the given project.
 * @param legacyChallengeId the id of the contest/challenge.
 * @param roleId
 *            the id of the role.
 * @param userId
 *            the id of the user.
 * @param handle
 */
async function assignRole (legacyChallengeId, roleId, userId, handle, copilotPaymentAmount) {
  let found = await ProjectServices.resourceExists(legacyChallengeId, roleId, userId)
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

    let projectPhaseId = null
    if (roleId === config.LEGACY_REVIEWER_ROLE_ID) {
      projectPhaseId = await RegistrationDAO.getPhaseIdForPhaseTypeId(legacyChallengeId, config.LEGACY_REVIEW_PHASE_ID)
    }
    const resourceId = await SequenceDAO.getResourceSeqNextId()
    await RegistrationDAO.persistResourceWithRoleId(userId, legacyChallengeId, resourceId, roleId, handle, projectPhaseId, copilotPaymentAmount)

    // only check notification setting for observer, else always add
    // if (roleId !== Constants.RESOURCE_ROLE_OBSERVER_ID || addNotification) {
    //   await ProjectServices.addNotifications(contestId, userId, Constants.TIMELINE_NOTIFICATION_ID, operatorId)
    // }
  }
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
async function addResource (challengeId, resourceRoleId, userId, handle, copilotPaymentAmount) {
  await assignRole(challengeId, resourceRoleId, userId, handle, copilotPaymentAmount)
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
