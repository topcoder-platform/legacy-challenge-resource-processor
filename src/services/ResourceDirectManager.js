const ProjectServices = require('./ProjectService')
const RegistrationDAO = require('../dao/RegistrationDAO')
const SequenceDAO = require('../dao/SequenceDAO')
const config = require('config')

/**
 * Assign the given roleId to the specified userId in the given project.
 * @param legacyChallengeId the id of the contest/challenge.
 * @param roleId
 *            the id of the role.
 * @param userId
 *            the id of the user.
 * @param handle
 */
async function assignRole (legacyChallengeId, roleId, userId, handle) {
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

    let reviewPhaseId = null
    if (roleId === config.LEGACY_REVIEWER_ROLE_ID) {
      reviewPhaseId = await RegistrationDAO.getPhaseIdForPhaseTypeId(legacyChallengeId, config.LEGACY_REVIEW_PHASE_ID)
    }
    const resourceId = await SequenceDAO.getResourceSeqNextId()
    await RegistrationDAO.persistResourceWithRoleId(userId, legacyChallengeId, resourceId, roleId, handle, reviewPhaseId)

    // only check notification setting for observer, else always add
    // if (roleId !== Constants.RESOURCE_ROLE_OBSERVER_ID || addNotification) {
    //   await ProjectServices.addNotifications(contestId, userId, Constants.TIMELINE_NOTIFICATION_ID, operatorId)
    // }
  }
}

/**
 * Assign the given roleId to the specified userId in the given project.
 * @param operatorId
 * @param legacyChallengeId
 *            the id of the contest/challenge.
 * @param roleId
 *            the id of the role.
 * @param userId
 *            the id of the user.
 * @param phase
 *            the <code>Phase</code> associated with the resource.
 * @param addNotification
 *            whether to add notification.
 * @param addForumWatch
 *            whether to add forum watch.
 * @param isStudio
 *            whether assign to studio contest.
 * @param checkTerm
 *            whether to check terms and conditions.
 */
async function removeRole (legacyChallengeId, roleId, userId) {
  let found = await ProjectServices.resourceExists(legacyChallengeId, roleId, userId)
  if (!found) {
    throw new Error('User ' + userId + ' does not have role ' + roleId + ' for the project ' + legacyChallengeId)
  }
  const resources = await ProjectServices.searchResources(legacyChallengeId, roleId)
  for (const resource of resources) {
    if (+resource.userid === userId) {
      await ProjectServices.removeResource(resource)
    }
  }
}

/**
 * Add resource
 *
 * @param challengeId
 * @param resourceRoleId
 * @param userId
 * @param handle
 */
async function addResource (challengeId, resourceRoleId, userId, handle) {
  await assignRole(challengeId, resourceRoleId, userId, handle)
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
