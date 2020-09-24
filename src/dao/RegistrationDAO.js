const helper = require('../common/helper')
const moment = require('moment')

const RESOURCE_TYPE_EXT_REF_ID = 1
const RESOURCE_TYPE_HANDLE_ID = 2
const RESOURCE_TYPE_REG_DATE = 6
const RESOURCE_TYPE_APPEALS_COMPLETED = 13

const QUERY_GET_USER_RELIABILITY = `
SELECT rating
FROM user_reliability 
WHERE
  user_id = %d AND
phase_id = (SELECT 111 + project_category_id FROM project WHERE project_id = %d)
`

const QUERY_INSERT_RESOURCE_WITH_ROLE = `
INSERT INTO resource
  ( resource_id,
    resource_role_id,
    project_phase_id,
    project_id,
    user_id,
    create_user, 
    create_date, 
    modify_user,
    modify_date)
VALUES
  (?, ?, null, ?, ?, ?, CURRENT, ?, CURRENT)`

async function persistResourceWithRoleId (userId, challengeId, resourceId, roleId, handle) {
  await helper.executeSQLonDB(QUERY_INSERT_RESOURCE_WITH_ROLE, [resourceId, roleId, challengeId, userId, userId, userId])
  await persistResourceInfo(userId, resourceId, RESOURCE_TYPE_EXT_REF_ID, userId)
  await persistResourceInfo(userId, resourceId, RESOURCE_TYPE_HANDLE_ID, handle)
  await persistResourceInfo(userId, resourceId, RESOURCE_TYPE_REG_DATE, moment())
  await persistResourceInfo(userId, resourceId, RESOURCE_TYPE_APPEALS_COMPLETED, 'NO')
}

const QUERY_INSERT_RESOURCE = `
INSERT INTO resource
  ( resource_id,
    resource_role_id,
    project_phase_id,
    project_id,
    user_id,
    create_user, 
    create_date, 
    modify_user,
    modify_date)
VALUES
  (?, 1, null, ?, ?, ?, CURRENT, ?, CURRENT)`

async function persistResource (userId, challengeId, resourceId) {
  await helper.executeSQLonDB(QUERY_INSERT_RESOURCE, [resourceId, challengeId, userId, userId, userId])
}

/**
 * Get user reliability
 * @param userId the userId to pass
 * @param challengeId the challengeId to pass
 * @return the result
 */
async function getUserReliability (userId, challengeId) {
  return helper.queryDataFromDB(QUERY_GET_USER_RELIABILITY, [userId, challengeId])
}

const QUERY_GET_CHALLENGE_NOTIFICATION_COUNT = `
SELECT count(*) AS total_count FROM notification 
WHERE 
  project_id = %d 
  AND external_ref_id = %d 
  AND notification_type_id = %d
`

/**
 * Get challenge notification count
 *
 * @param challengeId the challengeId to pass
 * @param userId the userId to pass
 * @param notificationTypeId the notificationTypeId to pass
 * @return the result
 */
async function getChallengeNotificationCount (challengeId, userId, notificationTypeId) {
  return helper.queryDataFromDB(QUERY_GET_CHALLENGE_NOTIFICATION_COUNT, [challengeId, userId, notificationTypeId])
}

const QUERY_INSERT_CHALLENGE_NOTIFICATION = `
INSERT INTO notification
(
  project_id,
  external_ref_id,
  notification_type_id,
  create_user,
  create_date,
  modify_user,
  modify_date
)
VALUES
(%d, %d, %d, %d, CURRENT, %d, CURRENT)
`

/**
 * Insert challenge notification
 * @param challengeId the challengeId to pass
 * @param userId the userId to pass
 * @param notificationTypeId the notificationTypeId to pass
 */
async function insertChallengeNotification (challengeId, userId, notificationTypeId) {
  await helper.executeSQLonDB(QUERY_INSERT_CHALLENGE_NOTIFICATION, [challengeId, userId, notificationTypeId, userId, userId])
}

const QUERY_GET_ACTIVE_FORUM_CATEGORY = `
SELECT jive_category_id
FROM comp_versions cv
INNER JOIN comp_catalog cc on cv.component_id = cc.component_id
INNER JOIN comp_jive_category_xref cjcx on cjcx.comp_vers_id = cv.comp_vers_id
where cc.component_id = %d
`

/**
 * Get active forum category
 * @param componentId the componentId to pass
 * @return the result
 */
async function getActiveForumCategory (componentId) {
  return helper.queryDataFromDB(QUERY_GET_ACTIVE_FORUM_CATEGORY, [componentId])
}

const QUERY_CHECK_USER_ACTIVATED = 'SELECT status FROM user WHERE user_id = %d'

/**
 * Check user activated
 * @param userId the userId to pass
 * @return the result
 */
async function checkUserActivated (userId) {
  return helper.queryDataFromDB(QUERY_CHECK_USER_ACTIVATED, [userId])
}

const QUERY_CHECK_CHALLENGE_EXISTS = `
SELECT
  CASE WHEN (p.project_studio_spec_id is NULL) THEN 0 ELSE 1 END as is_studio
FROM project p
WHERE p.project_id = %d
`

/**
 * Check challenge exists
 * @param challengeId the challengeId to pass
 * @return the result
 */
async function checkChallengeExists (challengeId) {
  return helper.queryDataFromDB(QUERY_CHECK_CHALLENGE_EXISTS, [challengeId])
}

const QUERY_GET_CHALLENGE_ACCESSIBILITY_AND_GROUPS = `
SELECT  
  ce.is_studio,
  sg.challenge_group_ind,
  ugx.group_id AS user_group_xref_found,
  sg.group_id AS group_id
FROM 
  (
    (
      contest_eligibility ce 
      LEFT JOIN group_contest_eligibility gce
      ON ce.contest_eligibility_id = gce.contest_eligibility_id
    ) 
    LEFT JOIN security_groups sg 
    ON gce.group_id = sg.group_id
  ) 
  LEFT JOIN (
    SELECT group_id FROM user_group_xref WHERE login_id = %d
  ) ugx
  ON ugx.group_id = gce.group_id
WHERE ce.contest_id = %d`

/**
 * Get challenge accessibility and groups
 * @param userId the user_id to pass
 * @param challengeId the challengeId to pass
 * @return the result
 */
async function getChallengeAccessibilityAndGroups (userId, challengeId) {
  return helper.queryDataFromDB(QUERY_GET_CHALLENGE_ACCESSIBILITY_AND_GROUPS, [userId, challengeId])
}

const QUERY_CHECK_CHALLENGE_IS_COPILOT_POSTING = `
SELECT (project_id IS NOT NULL) as challenge_is_copilot
FROM project p
WHERE p.project_id = %d
AND p.project_category_id = 29`

/**
 * check the challenge is copilot posting
 * @param challengeId the challenge id to check
 * @return the result list
 */
async function checkChallengeIsCopilotPosting (challengeId) {
  const result = await helper.queryDataFromDB(QUERY_CHECK_CHALLENGE_IS_COPILOT_POSTING, [challengeId])
  if (result && result.length > 0) {
    return result.challenge_is_copilot
  }
  return false
}

const QUERY_CHECK_IS_COPILOT = `
select
    (copilot_profile_id IS NOT NULL) as user_is_copilot
from copilot_profile where user_id = %d and copilot_profile_status_id = 1`

/**
 * Check user is copilot
 *
 * @param userId the userId to check
 * @return the result list
 */
async function checkIsCopilot (userId) {
  const result = await helper.queryDataFromDB(QUERY_CHECK_IS_COPILOT, [userId])
  if (result && result.length > 0) {
    return result.user_is_copilot
  }
  return false
}

const QUERY_CHALLENGE_REGISTRATION_VALIDATIONS = `
select
    p.project_id as challengeId,
    p.project_category_id as projectCategoryId,
    (pp_reg_open.project_id IS NOT NULL) as regOpen,
    (r.project_id IS NOT NULL) as userRegistered,
    (us.user_id IS NOT NULL) as user_suspended,
    (uax.user_id IS NOT NULL OR coder.coder_id IS NOT NULL) as userCountryBanned,
    (coder2.comp_country_code IS NULL OR coder2.comp_country_code = '') as compCountryIsNull,
    (cop.copilot_profile_id IS NOT NULL) as userIsCopilot,
    (pctl.name) as copilotType
from project p
left join 
    project_phase pp_reg_open 
    on p.project_id = pp_reg_open.project_id 
    and pp_reg_open.phase_type_id = 1 
    and pp_reg_open.phase_status_id = 2
left join
    resource r
    on r.project_id = p.project_id and r.resource_role_id = 1
    and user_id = %d
left join
    user_status us
    on us.user_id = %d
    and us.user_status_type_id = 1
    and us.user_status_id = 3
left outer join (
    informixoltp:user_address_xref uax join (
        informixoltp:address a join informixoltp:country c
        on a.country_code=c.country_code
    )
    on uax.address_id=a.address_id 
    and c.country_name in ( "Iran", "North Korea", "Cuba", "Sudan", "Syria" )
) on uax.user_id = %d
left outer join (
    informixoltp:coder coder join informixoltp:country country
    on (
        coder.comp_country_code=country.country_code OR
        coder.home_country_code=country.country_code
  ) and country.country_name in ( "Iran", "North Korea", "Cuba", "Sudan", "Syria" )
) on coder.coder_id = %d
left outer join informixoltp:coder coder2 on coder2.coder_id = %d
left join (
    project_copilot_type pct join project_copilot_type_lu pctl
    on pct.project_copilot_type_id = pctl.project_copilot_type_id
) on pct.project_id = p.project_id
left join 
    copilot_profile cop ON cop.user_id = %d and cop.copilot_profile_status_id = 1
where p.project_id = %d
`
/**
 * Validate the challenge registration
 *
 * @param userId the user id
 * @param challengeId the challenge id
 * @return the challenge registration validation
 */
async function validateChallengeRegistration (userId, challengeId) {
  const result = await helper.queryDataFromDB(QUERY_CHALLENGE_REGISTRATION_VALIDATIONS, [userId, userId, userId, userId, userId, userId, challengeId])
  if (result && result.length > 0) {
    return result[0]
  }
  return result
}

const QUERY_GET_COMPONENT_INFO = `
SELECT
    d.scheduled_end_time AS initialSubmissionDate, 
    c.component_id AS componentId,
    c.phase_id AS phaseId,
    c.comp_vers_id AS componentVersionId,
    c.version AS version,
    nvl(c.comments, '') AS comments,
    (select project_category_id from project where project_id = %d) AS projectCategoryId,
    (select value from project_info where project_id = %d AND project_info_type_id = 6) AS projectName,
    pi79.value AS reviewType
FROM comp_versions c
    , project_info p
    , project_phase d
    , project_info pi79
WHERE
    p.project_info_type_id = 2 
    AND c.phase_id IN (112, 113)
    AND c.component_id = p.value
    AND p.project_id = %d
    AND d.project_id = %d and d.phase_type_id = 2
    AND pi79.project_info_type_id = 79
AND pi79.project_id = %d`

/**
 * Get component info result
 *
 * @param challengeId the challengeId to pass
 * @return the result
 */
async function getComponentInfo (challengeId) {
  return helper.queryDataFromDB(QUERY_GET_COMPONENT_INFO, [challengeId, challengeId, challengeId, challengeId, challengeId])
}

const QUERY_GET_USER_RATING = `
SELECT
nvl((SELECT rating FROM user_rating 
WHERE phase_id = %d AND user_id = %d), 0) as rating
FROM dual
`

/**
 * Get user rating
 * @param userId the userId to pass
 * @param phaseId the phaseId to pass
 * @return the rating result
 */
async function getUserRating (userId, phaseId) {
  return helper.queryDataFromDB(QUERY_GET_USER_RATING, [phaseId, userId])
}

const QUERY_INSERT_REGISTRATION_RECORD = `
INSERT INTO component_inquiry (
  component_inquiry_id,
  component_id,
  user_id,
  comment,
  agreed_to_terms,
  rating,
  phase,
  tc_user_id,
  version,
  project_id
) 
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

/**
 * Insert registration record
 *
 * @param componentInquiryId the componentInquiryId to pass
 * @param componentId the componentId to pass
 * @param userId the userId to pass
 * @param comment the comment to pass
 * @param agreedToTerms the agreedToTerms to pass
 * @param rating the rating to pass
 * @param phase the phase to pass
 * @param tcUserId the tcUserId to pass
 * @param version the version to pass
 * @param challengeId the challengeId to pass
 */
async function insertRegistrationRecord (componentInquiryId, componentId, userId, comment, agreedToTerms, rating, phase, tcUserId, version, challengeId) {
  await helper.executeSQLonDB(QUERY_INSERT_REGISTRATION_RECORD, [componentInquiryId, componentId, userId, comment, agreedToTerms, rating, phase, tcUserId, version, challengeId])
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
 * @param challengeId the challengeId to pass
 * @param resourceUserId the resourceUserId to pass
 * @param resourceRoleId the resourceRoleId to pass
 * @param auditActionTypeId the auditActionTypeId to pass
 * @param actionUserId the actionUserId to pass
 */
async function auditChallengeRegistration (challengeId, resourceUserId, resourceRoleId, auditActionTypeId, actionUserId) {
  await helper.executeSQLonDB(QUERY_AUDIT_CHALLENGE_REGISTRATION, [challengeId, resourceUserId, resourceRoleId, auditActionTypeId, actionUserId])
}

const QUERY_INSERT_CHALLENGE_RESULT = `
INSERT INTO project_result
( project_id,
  user_id,
  rating_ind, 
  valid_submission_ind,
  old_rating
) 
VALUES ( ?, ?, ?, ?, ?)`

/**
 * Insert challenge result
 * @param challengeId the challengeId to pass
 * @param userId the userId to pass
 * @param ratingInd the ratingInd to pass
 * @param validSubmissionInd the validSubmissionInd to pass
 * @param oldRating the oldRating to pass
 */
async function insertChallengeResult (challengeId, userId, ratingInd, validSubmissionInd, oldRating) {
  await helper.executeSQLonDB(QUERY_INSERT_CHALLENGE_RESULT, [challengeId, userId, ratingInd, validSubmissionInd, oldRating])
}

const QUERY_INSERT_RESOURCE_INFO = `
INSERT INTO resource_info
( resource_id,
  resource_info_type_id,
  value,
  create_user,
  create_date,
  modify_user,
  modify_date
)
VALUES 
( ?, ?, ?, ?, CURRENT, ?, CURRENT)`

const QUERY_INSERT_RESOURCE_INFO_FOR_TYPE6 = `
INSERT INTO resource_info
( resource_id,
  resource_info_type_id,
  value,
  create_user,
  create_date,
  modify_user,
  modify_date
)
VALUES 
( ?, ?, CURRENT, ?, CURRENT, ?, CURRENT)`

/**
 * persist the resource info
 * @param userId the userId to pass
 * @param resourceId the resourceId to pass
 * @param resourceInfoTypeId the resourceInfoTypeId to pass
 * @param value the value to pass
 */
async function persistResourceInfo (userId, resourceId, resourceInfoTypeId, value) {
  if (resourceInfoTypeId === 6) {
    await helper.executeSQLonDB(QUERY_INSERT_RESOURCE_INFO_FOR_TYPE6, [resourceId, resourceInfoTypeId, userId, userId])
  } else {
    await helper.executeSQLonDB(QUERY_INSERT_RESOURCE_INFO, [resourceId, resourceInfoTypeId, value, userId, userId])
  }
}

const QUERY_GET_ALL_RESOURCE_ROLES = 'select resource_role_id as id, name from resource_role_lu'
/**
 * Get all resource roles
 *
 * @return a list of resource roles
 */
async function getResourceRoles () {
  return helper.queryDataFromDB(QUERY_GET_ALL_RESOURCE_ROLES, [])
}

const QUERY_GET_CHALLENGE_TERMS_OF_USE = `
SELECT  tou.terms_of_use_id as terms_of_use_id,
  tou.title as title, 
  tou.url as url,
  touat.name as agreeability_type,
  (utuox.user_id IS NOT NULL) as agreed,
    dtx.docusign_template_id
FROM project_role_terms_of_use_xref
INNER JOIN terms_of_use tou ON project_role_terms_of_use_xref.terms_of_use_id = tou.terms_of_use_id
INNER JOIN common_oltp:terms_of_use_agreeability_type_lu touat ON touat.terms_of_use_agreeability_type_id = tou.terms_of_use_agreeability_type_id
LEFT JOIN user_terms_of_use_xref utuox ON utuox.terms_of_use_id = tou.terms_of_use_id AND utuox.user_id = %d
LEFT JOIN common_oltp:terms_of_use_docusign_template_xref dtx ON dtx.terms_of_use_id = project_role_terms_of_use_xref.terms_of_use_id
WHERE project_id = %d AND 
resource_role_id = %d
ORDER BY group_ind, sort_order`

/**
 * Get terms of use
 *
 * @param userId the user id
 * @param challengeId the challenge id
 * @param roleId the role id
 * @return the challenge registration validation
 */
async function getUseTermsOfAgree (userId, challengeId, roleId) {
  return helper.queryDataFromDB(QUERY_GET_CHALLENGE_TERMS_OF_USE, [userId, challengeId, roleId])
}

module.exports = {
  persistResource,
  persistResourceWithRoleId,
  persistResourceInfo,
  getUserReliability,
  getChallengeNotificationCount,
  insertChallengeNotification,
  getActiveForumCategory,
  checkUserActivated,
  checkChallengeExists,
  getChallengeAccessibilityAndGroups,
  checkChallengeIsCopilotPosting,
  checkIsCopilot,
  validateChallengeRegistration,
  getComponentInfo,
  getUserRating,
  insertRegistrationRecord,
  auditChallengeRegistration,
  insertChallengeResult,
  getResourceRoles,
  getUseTermsOfAgree
}
