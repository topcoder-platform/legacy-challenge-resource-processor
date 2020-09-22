const ProjectServices = require('./ProjectService')
const RegistrationDAO = require('../dao/RegistrationDAO')
const config = require('config')
const SequenceDAO = require('../dao/SequenceDAO')
const Constants = require('../constants')
const ForumsWrapper = require('../dao/ForumWrapper')

/**
 * create software forum watch with given parameters.
 * @param forumId
 *            The forum id to use
 * @param userId
 *            The user id to use
 * @param watch
 *            If category watch is to be created
 */
async function createSoftwareForumWatchAndRole (forumId, userId, watch) {
  const roleId = 'Software_Moderators_' + forumId
  if (watch) {
    await ForumsWrapper.createCategoryWatch(userId, forumId)
  }

  await ForumsWrapper.assignRole(userId, roleId)
}

/**
 * create software forum watch with given parameters.
 * @param forumId
 *            The forum id to use
 * @param userId
 *            The user id to use
 */
async function removeSoftwareForumWatchAndRole (forumId, userId) {
  const forumRoleId = 'Software_Moderators_' + forumId
  await ForumsWrapper.deleteCategoryWatch(userId, forumId)
  await ForumsWrapper.removeRole(userId, forumRoleId)
}

/**
 * Assign the given roleId to the specified userId in the given project.
 * @param operatorId
 *            the operator id.
 * @param contestId
 *            the id of the contest.
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
  // TODO: suppose termChecking is ok and eligible
  // const termChecking = !checkTerm || checkTerms(contestId, userId, new int[] { (int) roleId })
  // const eligible = isEligible(userId, contestId, false)
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
    // create forum watch
    const forumId = await ProjectServices.getForumId(contestId)

    // only check notification for observer
    if (roleId !== Constants.RESOURCE_ROLE_OBSERVER_ID) {
      addForumWatch = true
    }

    if (forumId > 0 && config.IS_CREATE_FORUM && !isStudio) {
      await createSoftwareForumWatchAndRole(forumId, userId, addForumWatch)
    }
  }
}

/**
 * Assign the given roleId to the specified userId in the given project.
 * @param operatorId
 *            the operator id.
 * @param contestId
 *            the id of the contest.
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
  // always try to remove notifications. this method does nothing if notification does not exist
  await ProjectServices.removeNotifications(userId, contestId)
  const forumId = ProjectServices.getForumId(contestId)
  if (forumId > 0 && config.IS_CREATE_FORUM && !isStudio) {
    await removeSoftwareForumWatchAndRole(forumId, userId)
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
