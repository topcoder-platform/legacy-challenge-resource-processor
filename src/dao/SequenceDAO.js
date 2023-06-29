const util = require('util')
const helper = require('../common/helper')
const logger = require('../common/logger')

const QUERY_GET_COMP_INQUIRY_ID_NEXT = 'SELECT SEQUENCE_COMPONENT_INQUIRY_SEQ.nextval AS nextId FROM systables WHERE tabid = 1'
const QUERY_GET_RESOURCE_ID_NEXT = 'SELECT SEQUENCE_RESOURCE_ID_SEQ.nextval AS nextId FROM systables WHERE tabid = 1'

// const QUERY_GET_COMP_INQUIRY_ID_NEXT = 'SELECT PROJECT_USER_AUDIT_SEQ.nextval AS nextId FROM systables WHERE tabid = 1'
// const QUERY_GET_RESOURCE_ID_NEXT = 'SELECT PROJECT_USER_AUDIT_SEQ.nextval AS nextId FROM systables WHERE tabid = 1'

async function getNextIdBySQL (sql) {
  let res = null
  const connection = await helper.getInformixConnection('common_oltp')
  try {
    await connection.beginTransactionAsync()
    res = await connection.queryAsync(util.format(sql))
    await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'getNextIdBySQL' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    await connection.closeAsync()
  }
  if (res && res.length > 0) {
    return +res[0].nextid
  }
  return null
}

async function getResourceSeqNextId () {
  return getNextIdBySQL(QUERY_GET_RESOURCE_ID_NEXT)
}

async function getCompInquirySeqNextId () {
  return getNextIdBySQL(QUERY_GET_COMP_INQUIRY_ID_NEXT)
}

module.exports = {
  getResourceSeqNextId,
  getCompInquirySeqNextId
}
