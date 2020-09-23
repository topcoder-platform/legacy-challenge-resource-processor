const ProjectServices = require('./ProjectService')
const RegistrationDAO = require('../dao/RegistrationDAO')
const SequenceDAO = require('../dao/SequenceDAO')
const Constants = require('../constants')

/**
 * Assign the given roleId to the specified userId in the given project.
 * @param operatorId
 * @param contestId the id of the contest/challenge.
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
async function assignRole (operatorId, contestId, roleId, userId, phase, addNotification, addForumWatch, isStudio, checkTerm) {
  let found = await ProjectServices.resourceExists(contestId, roleId, userId)
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
    const resourceId = await SequenceDAO.getResourceSeqNextId()
    await RegistrationDAO.persistResourceWithRoleId(userId, contestId, resourceId, roleId)

    // only check notification setting for observer, else always add
    if (roleId !== Constants.RESOURCE_ROLE_OBSERVER_ID || addNotification) {
      await ProjectServices.addNotifications(contestId, userId, Constants.TIMELINE_NOTIFICATION_ID, operatorId)
    }
  }
}

/**
 * Assign the given roleId to the specified userId in the given project.
 * @param operatorId
 * @param contestId
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
async function removeRole (operatorId, contestId, roleId, userId, phase, addNotification, addForumWatch, isStudio, checkTerm) {
  let found = await ProjectServices.resourceExists(contestId, roleId, userId)
  if (!found) {
    throw new Error('User ' + userId + ' does not have role ' + roleId + ' for the project ' + contestId)
  }
  const resources = await ProjectServices.searchResources(contestId, roleId)
  for (const resource of resources) {
    if (+resource.userid === userId) {
      await ProjectServices.removeResource(resource)
    }
  }
}

/**
 * Add resource
 *
 * @param operatorId the operator id
 * @param challengeId The id of the challenge to which to add the resource.
 * @param resourceRoleId The id of the resource role
 * @param isStudio The is studio or not
 */
async function addResource (operatorId, challengeId, resourceRoleId, isStudio) {
  await assignRole(operatorId, challengeId, resourceRoleId, operatorId, null, false, false, isStudio, false)
}

/**
 * Remove resource
 *
 * @param operatorId the operator id
 * @param challengeId The id of the challenge to which to add the resource.
 * @param resourceRoleId The id of the resource role
 * @param isStudio The is studio or not
 */
async function removeResource (operatorId, challengeId, resourceRoleId, isStudio) {
  await removeRole(operatorId, challengeId, resourceRoleId, operatorId, null, false, false, isStudio, false)
}

module.exports = {
  addResource,
  removeResource
}
