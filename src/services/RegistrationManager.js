const RegistrationDAO = require('../dao/RegistrationDAO')
const SequenceDAO = require('../dao/SequenceDAO')
const UserDAO = require('../dao/UserDAO')
const Constants = require('../constants')
const logger = require('../common/logger')
const ForumWrapper = require('../dao/ForumWrapper')

async function getAllGroupIds (userId) {
  // try {
  //   const groupIds = await groupServiceClient.getGroups(userId)
  //   return groupIds
  // } catch (e) {
  //   throw e
  // }
  return []
}

/**
 * Check user challenge eligibility
 * @param user the user to pass
 * @param userId the userId to pass
 * @param challengeId the challengeId to pass
 * @throws SupplyException if any error occurs
 */
async function checkUserChallengeEligibility (userId, challengeId) {
  const groups = await RegistrationDAO.getChallengeAccessibilityAndGroups(userId, challengeId)
  // If there's no corresponding record in group_contest_eligibility
  // then the challenge is available to all users
  if (!groups || groups.length === 0) {
    return
  }
  const groupInd = groups[0].challenge_group_ind
  if (!groupInd) {
    return
  }
  await getAllGroupIds(userId)
  // const groupIds = await getAllGroupIds(userId)
}

/**
 * Register component inquiry
 * @param userId the userId to pass
 * @param challengeId the challengeId to pass
 * @throws Error if any error occurs
 * @return ComponentInfo
 */
async function registerComponentInquiry (userId, challengeId) {
  const compInfos = await RegistrationDAO.getComponentInfo(challengeId)
  if (!compInfos || compInfos.length < 1) {
    throw new Error('component not found when register component inquiry')
  }
  const compInfo = compInfos[0]
  const userRating = await RegistrationDAO.getUserRating(userId, compInfo.projectcategoryid + 111)
  let rating = null
  if (userRating && userRating.length > 0) {
    rating = userRating[0].rating
  }
  const nextId = await SequenceDAO.getCompInQuerySeqNextId()
  const phase = compInfo.projectcategoryid === Constants.DESIGN_PROJECT_TYPE || compInfo.projectcategoryid === Constants.DEVELOPMENT_PROJECT_TYPE ? compInfo.projectcategoryid : null
  await RegistrationDAO.insertRegistrationRecord(nextId, compInfo.componentid, userId, compInfo.comments, 1, rating, phase, userId, compInfo.version, challengeId)
  compInfo.rating = rating
  return compInfo
}

/**
 * Check if the rating suit for software category contests.
 * The code logic is duplicated from server-side java code.
 *
 * @param phaseId the phase id.
 * @param projectCategoryId the category id.
 * @return true if the rating is suitable for development (software) category challenge, otherwise false.
 */
function isRatingSuitableDevelopment (phaseId, projectCategoryId) {
  // The rating is suitable for software, e.g. not for studio.
  let suitable = false
  if (projectCategoryId === Constants.COMPONENT_TESTING_PROJECT_TYPE) {
    if (phaseId === 113) {
      suitable = true
    }
  } else if (projectCategoryId + 111 === phaseId) {
    suitable = true
  }
  return suitable
}

/**
 * Project track
 * @param userId the userId to pass
 * @param challengeId the challengeId to pass
 * @param compInfo the compInfo to pass
 * @throws Error if any error occurs
 */
async function projectTrack (userId, challengeId, compInfo) {
  const resourceId = await SequenceDAO.getResourceSeqNextId()
  await RegistrationDAO.persistResource(userId, challengeId, resourceId)

  await RegistrationDAO.auditChallengeRegistration(challengeId, userId, Constants.SUBMITTER_RESOURCE_ROLE_ID, Constants.PROJECT_USER_AUDIT_CREATE_TYPE, userId)

  let rating = compInfo.rating
  if (!isRatingSuitableDevelopment(compInfo.phaseid, compInfo.projectcategoryid)) {
    rating = null
  }
  await RegistrationDAO.insertChallengeResult(challengeId, userId, 0, 0, rating)
  await RegistrationDAO.persistResourceInfo(userId, resourceId, 1, '' + userId)
  const res = await UserDAO.getUserHandle(userId)
  if (!res || res.length < 1) {
    throw new Error('user\'s handle not found')
  }
  const handle = res[0].handle

  await RegistrationDAO.persistResourceInfo(userId, resourceId, 2, handle)
  if (compInfo.rating != null && compInfo.rating > 0) {
    await RegistrationDAO.persistResourceInfo(userId, resourceId, 4, '' + compInfo.rating)
  }
  const rr = await RegistrationDAO.getUserReliability(userId, challengeId)
  if (rr && rr.length > 0) {
    const rel = +rr[0].rating
    await RegistrationDAO.persistResourceInfo(userId, resourceId, 5, '' + rel * 100)
  }
  await RegistrationDAO.persistResourceInfo(userId, resourceId, 6, new Date())
  await RegistrationDAO.persistResourceInfo(userId, resourceId, Constants.APPEALS_COMPLETE_EARLY_PROPERTY_ID, Constants.NO_VALUE)
}

/**
 * Register challenge
 * @param userId the userId to pass
 * @param challengeId the challengeId to pass
 * @param challengeType the challengeType to pass
 * @throws Error if any error occurs
 */
async function registerChallengeByType (userId, challengeId, challengeType) {
  const compInfo = await registerComponentInquiry(userId, challengeId)
  if (challengeType === Constants.DEVELOPMENT_PROJECT_TYPE) {
    await projectTrack(userId, challengeId, compInfo)
  }

  const ns = await RegistrationDAO.getChallengeNotificationCount(challengeId, userId, Constants.TIMELINE_NOTIFICATION_ID)
  if (!ns || ns.length < 1) {
    throw new Error('Notification not found.')
  }
  if (ns[0].total_count === 0) {
    await RegistrationDAO.insertChallengeNotification(challengeId, userId, 1)
  }
  if (compInfo.componentid <= 0) {
    throw new Error('Could not find component for challenge')
  }
  const cId = await RegistrationDAO.getActiveForumCategory(compInfo.componentid)
  let categoryForumId = 0
  if (!cId || cId.length < 1) {
    logger.debug('Could not find component for challenge ' + challengeId)
  } else {
    categoryForumId = cId[0].jive_category_id
  }

  if (categoryForumId > 0) {
    if (challengeType === Constants.DEVELOPMENT_PROJECT_TYPE) {
      try {
        logger.debug('start to grant user ' + userId + ' forum category ' + categoryForumId + ' access.')
        await ForumWrapper.createCategoryWatch(userId, categoryForumId)
        await ForumWrapper.assignRole(userId, 'Software_Users_' + categoryForumId)
      } catch (exp) {
        throw new Error('Failed to create the forum wrapper' + exp)
      }
    }
  }

  // TODO: implement similar logic for below java code
  // this.sendEmailNotification(userId, challengeId, challengeType, categoryForumId, compInfo);
}

/**
 * Check all terms of use
 * @param userId the userId to pass
 * @param challengeId the challengeId to pass
 * @return true if agreed
 */
async function allUseOfTermsAgreed (userId, challengeId) {
  const roles = await RegistrationDAO.getResourceRoles()
  let submitterRole = null
  for (const role of roles) {
    if (role.name.toLowerCase() === 'submitter') {
      submitterRole = role
      break
    }
  }
  if (!submitterRole) {
    return false
  }
  const terms = await RegistrationDAO.getUseTermsOfAgree(userId, challengeId, submitterRole.id)
  for (const term of terms) {
    if (!term.agreed) {
      return false
    }
  }
  return true
}

/**
 * Register studio challenge
 * @param userId the userId to pass
 * @param challengeId the challengeId to pass
 */
async function registerStudioChallenge (userId, challengeId) {
  // check terms
  const agreed = await allUseOfTermsAgreed(userId, challengeId)
  if (!agreed) {
    throw new Error('You should agree with all terms of use.')
  }
  const resourceId = await SequenceDAO.getResourceSeqNextId()
  await RegistrationDAO.persistResource(userId, challengeId, resourceId)
  await RegistrationDAO.persistResourceInfo(userId, resourceId, 1, '' + userId)
  const res = await UserDAO.getUserHandle(userId)
  if (!res || res.length < 1) {
    throw new Error('user\'s handle not found')
  }
  const handle = res[0].handle
  await RegistrationDAO.persistResourceInfo(userId, resourceId, 2, handle)
  await RegistrationDAO.persistResourceInfo(userId, resourceId, 6, new Date()) // new Date() is not used at last
  await RegistrationDAO.persistResourceInfo(userId, resourceId, 8, 'N/A')
  await registerChallengeByType(userId, challengeId, Constants.DESIGN_PROJECT_TYPE)
}

async function registerSoftwareChallenge (userId, challengeId) {
  const isCopilotPosting = await RegistrationDAO.checkChallengeIsCopilotPosting(challengeId)
  const isCopilot = await RegistrationDAO.checkIsCopilot(userId)
  if (isCopilotPosting && !isCopilot) {
    throw new Error('You should be a copilot before register a copilot posting.')
  }

  // check terms
  const agreed = await allUseOfTermsAgreed(userId, challengeId)
  if (!agreed) {
    throw new Error('You should agree with all terms of use.')
  }
  await registerChallengeByType(userId, challengeId, Constants.DEVELOPMENT_PROJECT_TYPE)
}

/**
 * Validate challenge registration
 * @param userId the userId to pass
 * @param challengeId the challengeId to pass
 */
async function validateChallengeRegistration (userId, challengeId) {
  const valid = await RegistrationDAO.validateChallengeRegistration(userId, challengeId)
  if (!valid.regopen) {
    throw new Error('Registration Phase of this challenge is not open.')
  }
  if (valid.userregistered) {
    throw new Error('You are already registered for this challenge.')
  }
  if (valid.user_suspended) {
    throw new Error('You cannot participate in this challenge due to suspension.')
  }
  if (valid.usercountrybanned) {
    throw new Error('You are not eligible to participate in this challenge because ' +
        'of your country of residence. Please see our terms of service for more information.')
  }
  if (valid.compcountryisnull) {
    throw new Error('You are not eligible to participate in this challenge because you ' +
        'have not specified your country of residence. Please go to your Settings and enter a country. ' +
        'Please see our terms of service for more information.')
  }

  if (valid.projectcategoryid === Constants.COPILOT_POSTING_PROJECT_TYPE) {
    if (!valid.useriscopilot && valid.copilottype != null && valid.copilottype.contains('Marathon Match')) {
      throw new Error('You cannot participate in this challenge because you are not an active member of the copilot pool.')
    }
  }
}

/**
 * Register challenge
 *
 * @param userId the user id
 * @param challengeId the challengeId to use
 * @param isAdmin is admin user or not
 */
async function registerChallenge (userId, challengeId, isAdmin) {
  // check user activated
  const us = await RegistrationDAO.checkUserActivated(userId)
  if (!us || us[0].status !== 'A') {
    throw new Error('You must activate your account in order to participate. ' +
        'Please check your e-mail in order to complete the activation process, ' +
        'or contact support@topcoder.com if you did not receive an e-mail.')
  }
  // check challenge exists
  const cs = await RegistrationDAO.checkChallengeExists(challengeId)
  if (!cs || cs.length === 0) {
    throw new Error('The challenge does not exist.')
  }
  if (!isAdmin) {
    // check user eligibility
    await checkUserChallengeEligibility(userId, challengeId)
  }
  // validate the challenge
  await validateChallengeRegistration(userId, challengeId)

  const isStudio = +cs[0].is_studio
  if (isStudio) {
    await registerStudioChallenge(userId, challengeId)
  } else {
    await registerSoftwareChallenge(userId, challengeId)
  }
}

module.exports = {
  registerChallenge
}
