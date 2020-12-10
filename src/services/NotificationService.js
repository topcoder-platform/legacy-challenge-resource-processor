/**
 * Notification service
 * Interacts with InformixDB
 */
const util = require('util')
const logger = require('../common/logger')
const helper = require('../common/helper')

const QUERY_GET_TIMELINE_NOTIFICATION_ENTRY = 'SELECT external_ref_id FROM notification WHERE project_id = %d and external_ref_id = %d and notification_type_id = %d'
const QUERY_CREATE_TIMELINE_NOTIFICATION_ENTRY = 'INSERT INTO notification (project_id, external_ref_id, notification_type_id, create_user, create_date, modify_user, modify_date) VALUES (?, ?, "1", ?, CURRENT, ?, CURRENT)'
const QUERY_DELETE_TIMELINE_NOTIFICATION_ENTRY = 'DELETE FROM notification WHERE project_id = ? and external_ref_id = ? and notification_type_id = "1"'

/**
 * Prepare Informix statement
 * @param {Object} connection the Informix connection
 * @param {String} sql the sql
 * @return {Object} Informix statement
 */
async function prepare (connection, sql) {
  // logger.debug(`Preparing SQL ${sql}`)
  const stmt = await connection.prepareAsync(sql)
  return Promise.promisifyAll(stmt)
}

/**
 * Get teh timeline notification settings entry
 * @param {Number} challengeLegacyId the legacy challenge ID
 */
async function getTimelineNotifications (challengeLegacyId, memberId) {
  // logger.debug(`Getting Groups for Challenge ${challengeLegacyId}`)
  const connection = await helper.getInformixConnection()
  let result = null
  try {
    result = await connection.queryAsync(util.format(QUERY_GET_TIMELINE_NOTIFICATION_ENTRY, challengeLegacyId, memberId, 1))
  } catch (e) {
    logger.error(`Error in 'getTimelineNotifications' ${e}`)
    throw e
  } finally {
    await connection.closeAsync()
  }
  return result
}

/**
 * Enable timeline notifications
 * @param {Number} challengeLegacyId the legacy challenge ID
 * @param {Number} memberId the user ID
 * @param {String} createdBy the created by
 */
async function enableTimelineNotifications (challengeLegacyId, memberId, createdBy) {
  const connection = await helper.getInformixConnection()
  let result = null
  try {
    // await connection.beginTransactionAsync()
    const [existing] = await getTimelineNotifications(challengeLegacyId, memberId)
    if (!existing) {
      const query = await prepare(connection, QUERY_CREATE_TIMELINE_NOTIFICATION_ENTRY)
      result = await query.executeAsync([challengeLegacyId, memberId, createdBy, createdBy])
      logger.info(`Notifications have been enabled for challenge ${challengeLegacyId} and user ${memberId}`)
    }
    // await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'enableTimelineNotifications' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    await connection.closeAsync()
  }
  return result
}

/**
 * Disable timeline notifications
 * @param {Number} challengeLegacyId the legacy challenge ID
 * @param {Number} memberId the user ID
 */
async function disableTimelineNotifications (challengeLegacyId, memberId) {
  const connection = await helper.getInformixConnection()
  let result = null
  try {
    // await connection.beginTransactionAsync()
    const [existing] = await getTimelineNotifications(challengeLegacyId, memberId)
    if (existing) {
      const query = await prepare(connection, QUERY_DELETE_TIMELINE_NOTIFICATION_ENTRY)
      result = await query.executeAsync([challengeLegacyId, memberId])
      logger.info(`Notifications have been disabled for challenge ${challengeLegacyId} and user ${memberId}`)
    }
    // await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'disableTimelineNotifications' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    await connection.closeAsync()
  }
  return result
}

module.exports = {
  getTimelineNotifications,
  enableTimelineNotifications,
  disableTimelineNotifications
}
