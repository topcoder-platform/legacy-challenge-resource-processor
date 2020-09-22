const util = require('util')
const helper = require('../common/helper')
const logger = require('../common/logger')

const QUERY_GET_USER_HANDLE = 'select handle from user where user_id = %d'

async function getUserHandle (userId) {
  let handle = null
  const connection = await helper.getInformixConnection()
  try {
    await connection.beginTransactionAsync()
    handle = await connection.queryAsync(util.format(QUERY_GET_USER_HANDLE, userId))
    await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'getUserHandle' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    await connection.closeAsync()
  }
  return handle
}

module.exports = {
  getUserHandle
}
