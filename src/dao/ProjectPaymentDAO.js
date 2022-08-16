const _ = require('lodash')
const helper = require('../common/helper')
const logger = require('../common/logger')

const QUERY_PROJECT_PAYMENT_MAX_ID = `
    SELECT MAX(project_payment_id) + 1 AS id FROM project_payment
`

// reference Direct App: https://github.com/appirio-tech/direct-app/blob/dev/components/project_payment_management/src/java/main/com/topcoder/management/payment/impl/persistence/DatabaseProjectPaymentPersistence.java#L58
// Note that project_payment_id is not a sequence, it is max(project_payment_id) + 1 - unlike other similar tables where it is a sequence
const QUERY_INSERT_PROJECT_PAYMENT = `
INSERT INTO project_payment
  ( resource_id
    amount,
    project_payment_type_id,
    create_user,
    modify_user,
    create_date, 
    modify_date, 
    project_payment_id
  )
VALUES
  (?, ?, ?, ?, ?, CURRENT, CURRENT, ?)`

// reference Direct App: https://github.com/appirio-tech/direct-app/blob/dev/components/project_payment_management/src/java/main/com/topcoder/management/payment/impl/persistence/DatabaseProjectPaymentPersistence.java#L87
const DELETE_PROJECT_PAYMENT = `
DELETE FROM project_payment WHERE resource_id = ?
`

async function persistReviewerPayment (userId, resourceId, amount, projectPaymentTypeId) {
  logger.info(`Persist reviewer payment. userId: ${userId}, resourceId: ${resourceId}, amount: ${amount}, projectPaymentTypeId: ${projectPaymentTypeId}`)
  const connection = await helper.getInformixConnection()
  try {
    logger.info('Open connection.')
    await connection.beginTransactionAsync()
    const result = await connection.queryAsync(QUERY_PROJECT_PAYMENT_MAX_ID)
    const projectPaymentId = _.get(result, '[0].id', null)

    logger.info(`Creating project payment with id ${projectPaymentId}`)

    const query = await helper.prepare(connection, QUERY_INSERT_PROJECT_PAYMENT)
    await query.executeAsync([resourceId, amount, projectPaymentTypeId, userId, userId, projectPaymentId])

    logger.info(`Project payment with id ${projectPaymentId} has been created`)

    await connection.commitTransactionAsync()
  } catch (e) {
    await connection.rollbackTransactionAsync()
    logger.error(`Error in 'createProjectPayment' ${e}`)
  } finally {
    await connection.closeAsync()
  }
}

async function removeReviewerPayment (resourceId) {
  await helper.executeSQLonDB(DELETE_PROJECT_PAYMENT, [resourceId])
}

module.exports = {
  persistReviewerPayment,
  removeReviewerPayment
}
