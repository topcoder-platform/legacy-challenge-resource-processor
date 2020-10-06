const helper = require('../common/helper')
const logger = require('../common/logger')
const { toInteger } = require('lodash')
const Constants = require('../constants')

const QUERY_CHECK_RESOURCE_EXISTS = 'SELECT COUNT(*) as num FROM resource WHERE project_id = %d AND resource_role_id = %d AND user_id = %d'

/**
 * Check resource exists or not
 * @param challengeId the challengeId to pass
 * @param roleId the userId to pass
 * @param userId the userId to pass
 * @return the result
 */
async function resourceExists (challengeId, roleId, userId) {
  const result = helper.queryDataFromDB(QUERY_CHECK_RESOURCE_EXISTS, [challengeId, roleId, toInteger(userId)])
  logger.debug(`resourceExists ${JSON.stringify([challengeId, roleId, toInteger(userId)])} result: ${JSON.stringify(result)}`)
  if (result && result.length > 0) {
    return result[0].num > 0
  }
  return false
}

const QUERY_GET_RESOURCES = `
SELECT
  resource_id as resourceId,
  user_id as userId,
  project_id as projectId,
  resource_role_id as resourceRoleId
FROM resource where project_id = %d and resource_role_id = %d`

/**
 * Get all resources with challengeId and roleId
 * @param challengeId the challengeId to pass
 * @param roleId the userId to pass
 * @return the result
 */
async function searchResources (challengeId, roleId) {
  return helper.queryDataFromDB(QUERY_GET_RESOURCES, [challengeId, roleId])
}

const QUERY_GET_ALL_RESOURCE_ROLES = 'SELECT * FROM resource_role_lu'

/**
 * Get all resource roles
 * @returns all resource roles
 */
async function getAllResourceRoles () {
  return helper.queryDataFromDB(QUERY_GET_ALL_RESOURCE_ROLES, [])
}

const QUERY_INSERT_NOTIFICATION = `
INSERT INTO notification (project_id, external_ref_id, notification_type_id, create_user, create_date, modify_user, modify_date)
VALUES (?, ?, ?, ?, CURRENT, ?, CURRENT)`

/**
 * Get all resources with challengeId and roleId
 * @param contestId the challengeId to pass
 * @param externalRefId the external ref id
 * @param notificationTypeId the notification type id
 * @param operatorId the operator id
 */
async function addNotifications (contestId, externalRefId, notificationTypeId, operatorId) {
  await helper.executeSQLonDB(QUERY_INSERT_NOTIFICATION, [contestId, externalRefId, notificationTypeId, operatorId, operatorId])
}

const QUERY_DELETE_NOTIFICATION = 'DELETE FROM notification WHERE project_id = ? AND external_ref_id = ? AND notification_type_id = ?'
/**
 * Get all resources with challengeId and roleId
 * @param userId the challengeId to pass
 * @param contestId the challengeId to pass
 */
async function removeNotifications (userId, contestId) {
  await helper.executeSQLonDB(QUERY_DELETE_NOTIFICATION, [contestId, userId, Constants.TIMELINE_NOTIFICATION_ID])
}

const QUERY_GET_FORUM_ID = 'select value from project_info where project_info_type_id = 4 and project_id = %d'

async function getForumId (challengeId) {
  const result = await helper.queryDataFromDB(QUERY_GET_FORUM_ID, [challengeId])
  if (result && result.length > 0) {
    return result[0].value
  }
  return result
}

const QUERY_DELETE_RES_INFO = 'DELETE FROM resource_info WHERE resource_id = ?'
const QUERY_DELETE_SUBMISSION = 'DELETE FROM resource_submission WHERE resource_id = ?'
const QUERY_DELETE_RESOURCE = 'DELETE FROM resource WHERE resource_id = ?'
/**
 * Remove resource
 * @param resource the resource obj
 * @param operatorId operator id
 */
async function removeResource (resource) {
  logger.debug(`removeResource ${JSON.stringify(resource)}`)
  await helper.executeSQLonDB(QUERY_DELETE_RES_INFO, [resource.resourceid])
  await helper.executeSQLonDB(QUERY_DELETE_SUBMISSION, [resource.resourceid])
  await helper.executeSQLonDB(QUERY_DELETE_RESOURCE, [resource.resourceid])
  // audit deletion
  await auditProjectUser(resource, Constants.PROJECT_USER_AUDIT_DELETE_TYPE) // delete
}

const QUERY_INSERT_PROJECT_USER_AUDIT = `
INSERT INTO project_user_audit (project_user_audit_id, project_id, resource_user_id,
  resource_role_id, audit_action_type_id, action_date, action_user_id)
VALUES (PROJECT_USER_AUDIT_SEQ.nextval, ?, ?, ?, ?, CURRENT, ?)`

/**
 * This method will audit project user information. This information is generated when a resource is added,
 * deleted or changes its user or role.
 *
 * @param connection the connection to database
 * @param resource the resource being audited
 * @param auditType the audit type. Can be PROJECT_USER_AUDIT_CREATE_TYPE or PROJECT_USER_AUDIT_DELETE_TYPE.
 * @param userId the resource user id. This value overrides the value inside resource if present.
 * @param resourceRoleId the resource role id. This value overrides the value inside resource if present.
 */
async function auditProjectUser (resource, auditType) {
  await helper.executeSQLonDB(QUERY_INSERT_PROJECT_USER_AUDIT, [resource.projectid, resource.userid, resource.resourceroleid, auditType, resource.userid])
}

module.exports = {
  resourceExists,
  searchResources,
  getAllResourceRoles,
  addNotifications,
  removeNotifications,
  getForumId,
  removeResource
}
