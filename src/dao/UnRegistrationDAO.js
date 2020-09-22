const util = require('util')
const helper = require('../common/helper')
const prepare = helper.prepare
const logger = require('../common/logger')

const QUERY_CHALLENGE_UNREGISTRATION_VALIDATIONS = `
select distinct
  p.project_id as challengeId,
  p.project_category_id as challengeCategoryId,
  (pp_reg_open.project_id IS NOT NULL) as regOpen,
    (select ri.value is not null from resource r, resource_info ri 
      where r.project_id = p.project_id and r.resource_role_id = 1 
      and r.resource_id = ri.resource_id and ri.resource_info_type_Id = 1 and ri.value = %d) as userRegistered,
    CASE WHEN (p.project_studio_spec_id is NULL) THEN 0 ELSE 1 END as studio
from project p 
left join 
  project_phase pp_reg_open 
  on p.project_id = pp_reg_open.project_id 
  and pp_reg_open.phase_type_id = 1 
  and pp_reg_open.phase_status_id = 2
where p.project_id = %d`

/**
 * Perform Challenge unregistration validations
 *
 * @param userId the userId to use
 * @param challengeId the challengeId to use
 * @return the ChallengeUnregistrationValidation result
 */
async function performChallengeUnregistrationValidations (userId, challengeId) {
  let result = null
  const connection = await helper.getInformixConnection()
  try {
    await connection.beginTransactionAsync()
    result = await connection.queryAsync(util.format(QUERY_CHALLENGE_UNREGISTRATION_VALIDATIONS, userId, challengeId))
    await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'performChallengeUnregistrationValidations' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    await connection.closeAsync()
  }
  if (result && result.length > 0) {
    return result[0]
  }
  return result
}

const QUERY_DELETE_USER_RECORD_FROM_PROJECT_RESULT = 'DELETE FROM project_result WHERE project_id = ? and user_id = ?'
const QUERY_DELETE_USER_RECORD_FROM_COMPONENT_INQUIRY = 'DELETE FROM component_inquiry WHERE project_id = ? and user_id = ?'

/**
 * Delete challenge result
 *
 * @param challengeId the challengeId to use
 * @param userId the userId to use
 */
async function deleteChallengeResult (challengeId, userId) {
  const connection = await helper.getInformixConnection()
  try {
    await connection.beginTransactionAsync()
    let query = await prepare(connection, QUERY_DELETE_USER_RECORD_FROM_PROJECT_RESULT)
    await query.executeAsync([challengeId, userId])
    query = await prepare(connection, QUERY_DELETE_USER_RECORD_FROM_COMPONENT_INQUIRY)
    await query.executeAsync([challengeId, userId])
    await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'deleteChallengeResult' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    logger.info(`Delete challenge result for ${userId} from project ${challengeId}`)
    await connection.closeAsync()
  }
}

const QUERY_GET_USER_CHALLENGE_RESOURCE = `
SELECT DISTINCT
  resource_info_type_lu.resource_info_type_id AS resourceInfoTypeId,
  resource_info.value AS userId,
  resource.resource_id AS resourceId,
  resource_role_id AS resourceRoleId
FROM resource,
  resource_info,
  resource_info_type_lu
WHERE resource.resource_id = resource_info.resource_id
  AND resource_info.resource_info_type_id =  resource_info_type_lu.resource_info_type_id
  AND project_id = %d
  AND resource_info_type_lu.resource_info_type_id = 1
  AND resource_info.value = %d`

/**
 * Get user challenge resource
 *
 * @param challengeId the challengeId to use
 * @param userId the userId to use
 * @return the UserChallengeResource result
 */
async function getUserChallengeResource (challengeId, userId) {
  let result = null
  const connection = await helper.getInformixConnection()
  try {
    await connection.beginTransactionAsync()
    result = await connection.queryAsync(util.format(QUERY_GET_USER_CHALLENGE_RESOURCE, challengeId, userId))
    await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'getUserChallengeResource' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    await connection.closeAsync()
  }
  return result
}

const QUERY_DELETE_FROM_RESOURCE_INFO = 'DELETE FROM resource_info WHERE resource_id = ?'
const QUERY_DELETE_FROM_RESOURCE_SUBMISSION = 'DELETE FROM resource_submission WHERE resource_id = ?'
const QUERY_DELETE_FROM_SUBMISSION = 'DELETE FROM submission where upload_id in (select upload_id from upload where resource_id=?)'
const QUERY_DELETE_FROM_UPLOAD = 'DELETE FROM upload where resource_id=?'
const QUERY_DELETE_FROM_RESOURCE = 'DELETE FROM resource WHERE resource_id = ?'

/**
 * Delete challenge resources
 * @param resourceId the resourceId to use
 */
async function deleteChallengeResources (resourceId) {
  const connection = await helper.getInformixConnection()
  try {
    await connection.beginTransactionAsync()
    let query = await prepare(connection, QUERY_DELETE_FROM_RESOURCE_INFO)
    await query.executeAsync([resourceId])
    query = await prepare(connection, QUERY_DELETE_FROM_RESOURCE_SUBMISSION)
    await query.executeAsync([resourceId])
    query = await prepare(connection, QUERY_DELETE_FROM_SUBMISSION)
    await query.executeAsync([resourceId])
    query = await prepare(connection, QUERY_DELETE_FROM_UPLOAD)
    await query.executeAsync([resourceId])
    query = await prepare(connection, QUERY_DELETE_FROM_RESOURCE)
    await query.executeAsync([resourceId])
    await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'deleteChallengeResources' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    logger.info(`Delete challenge resource ${resourceId}`)
    await connection.closeAsync()
  }
}

const QUERY_AUDIT_CHALLENGE_REGISTRATION = `
INSERT INTO project_user_audit 
  ( project_user_audit_id,
    project_id,
    resource_user_id, 
    resource_role_id,
    audit_action_type_id,
    action_date, 
    action_user_id
  ) 
VALUES 
( PROJECT_USER_AUDIT_SEQ.nextval,
  ?,
  ?,
  ?,
  ?,
  CURRENT,
  ?)`

/**
 * Audit challenge registration
 *
 * @param challengeId the challengeId to use
 * @param resourceUserId the resourceUserId to use
 * @param resourceRoleId the resourceRoleId to use
 * @param auditActionTypeId the auditActionTypeId to use
 * @param actionUserId the actionUserId to use
 */
async function auditChallengeRegistration (challengeId, resourceUserId, resourceRoleId, auditActionTypeId, actionUserId) {
  const connection = await helper.getInformixConnection()
  try {
    await connection.beginTransactionAsync()
    const query = await prepare(connection, QUERY_AUDIT_CHALLENGE_REGISTRATION)
    await query.executeAsync([challengeId, resourceUserId, resourceRoleId, auditActionTypeId, actionUserId])
    await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'persistResourceInfo' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    await connection.closeAsync()
  }
}

const QUERY_GET_CHALLENGE_FORUM = `
SELECT info.project_id as challengeId,
       info_type.name as name,
       info.value as forumCategoryId
FROM   project_info AS info
       JOIN project_info_type_lu AS info_type
         ON info.project_info_type_id = info_type.project_info_type_id
WHERE name = 'Developer Forum ID' and info.project_id = %d`

/**
 * Get challenge forum
 *
 * @param challengeId the challengeId
 * @return the ChallengeForum result
 */
async function getChallengeForum (challengeId) {
  let result = null
  const connection = await helper.getInformixConnection()
  try {
    await connection.beginTransactionAsync()
    result = await connection.queryAsync(util.format(QUERY_GET_CHALLENGE_FORUM, challengeId))
    await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'getChallengeForum' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    await connection.closeAsync()
  }
  return result
}

module.exports = {
  performChallengeUnregistrationValidations,
  deleteChallengeResult,
  getUserChallengeResource,
  deleteChallengeResources,
  auditChallengeRegistration,
  getChallengeForum
}
