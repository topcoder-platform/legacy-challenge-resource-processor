/**
 * Contains generic helper methods
 */

global.Promise = require('bluebird')
const _ = require('lodash')
const config = require('config')
const ifxnjs = require('ifxnjs')
const logger = require('./logger')
const util = require('util')
const request = require('superagent')
const busApi = require('topcoder-bus-api-wrapper')
const m2mAuth = require('tc-core-library-js').auth.m2m
const m2m = m2mAuth(_.pick(config, ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME', 'AUTH0_PROXY_SERVER_URL']))

const Pool = ifxnjs.Pool
const pool = Promise.promisifyAll(new Pool())
pool.setMaxPoolSize(config.get('INFORMIX.POOL_MAX_SIZE'))

// Bus API Client
let busApiClient

/**
 * Get Informix connection using the configured parameters
 * @return {Object} Informix connection
 */
async function getInformixConnection (database) {
  if (!database) {
    database = config.get('INFORMIX.DATABASE')
  }
  // construct the connection string from the configuration parameters.
  const connectionString = 'SERVER=' + config.get('INFORMIX.SERVER') +
                           ';DATABASE=' + database +
                           ';HOST=' + config.get('INFORMIX.HOST') +
                           ';Protocol=' + config.get('INFORMIX.PROTOCOL') +
                           ';SERVICE=' + config.get('INFORMIX.PORT') +
                           ';DB_LOCALE=' + config.get('INFORMIX.DB_LOCALE') +
                           ';UID=' + config.get('INFORMIX.USER') +
                           ';PWD=' + config.get('INFORMIX.PASSWORD')
  const conn = await pool.openAsync(connectionString)
  return Promise.promisifyAll(conn)
}

/**
 * Get M2M token
 * @return {String} m2m token
 */
async function getM2Mtoken () {
  return m2m.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
}

/**
 * Uses superagent to proxy get request
 * @param {String} url the url
 * @param {String} m2mToken the M2M token
 * @returns {Object} the response
 */
async function getRequest (url, m2mToken) {
  return request
    .get(url)
    .set('Authorization', `Bearer ${m2mToken}`)
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
}

/**
 * Uses superagent to proxy post request
 * @param {String} url the url
 * @param {Object} body the JSON object body
 * @param {String} m2mToken the M2M token
 * @returns {Object} the response
 */
async function postRequest (url, body, m2mToken) {
  return request
    .post(url)
    .send(body)
    .set('Authorization', `Bearer ${m2mToken}`)
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
}

/**
 * Uses superagent to proxy delete request
 * @param {String} url the url
 * @param {Object} body the JSON object body
 * @param {String} m2mToken the M2M token
 * @returns {Object} the response
 */
async function deleteRequest (url, body, m2mToken) {
  return request
    .delete(url)
    .send(body)
    .set('Authorization', `Bearer ${m2mToken}`)
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
}

/**
 * Get Bus API Client
 * @return {Object} Bus API Client Instance
 */
function getBusApiClient () {
  // if there is no bus API client instance, then create a new instance
  if (!busApiClient) {
    busApiClient = busApi(_.pick(config,
      ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME',
        'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'BUSAPI_URL',
        'KAFKA_ERROR_TOPIC', 'AUTH0_PROXY_SERVER_URL']))
  }

  return busApiClient
}

/**
 * Post bus event.
 * @param {String} topic the event topic
 * @param {Object} payload the event payload
 */
async function postBusEvent (topic, payload) {
  const client = getBusApiClient()
  await client.postEvent({
    topic,
    originator: config.EVENT_ORIGINATOR,
    timestamp: new Date().toISOString(),
    'mime-type': config.EVENT_MIME_TYPE,
    payload
  })
}

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

async function ESFeederServiceClient () {
}

/**
 * Query data from database
 * @param sql
 * @param params
 * @returns {Promise<null>}
 */
async function queryDataFromDB (sql, params) {
  let result = null
  const connection = await getInformixConnection()
  try {
    await connection.beginTransactionAsync()
    result = await connection.queryAsync(util.format(sql, ...params))
    await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'queryDataFromDB' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    await connection.closeAsync()
  }
  return result
}

/**
 * Execute sql on database
 * @param sql
 * @param params
 */
async function executeSQLonDB (sql, params) {
  const connection = await getInformixConnection()
  // logger.debug(`Executing SQL: ${sql} ${JSON.stringify(params)}`)
  try {
    await connection.beginTransactionAsync()
    const query = await prepare(connection, sql)
    await query.executeAsync(params)
    await connection.commitTransactionAsync()
  } catch (e) {
    logger.error(`Error in 'executeSQLonDB' ${e}, rolling back transaction`)
    await connection.rollbackTransactionAsync()
    throw e
  } finally {
    await connection.closeAsync()
  }
}

async function forceV4ESFeeder (legacyId) {
  const token = await getM2MToken()
  const body = {
    param: {
      challengeIds: [legacyId]
    }
  }
  await request.put(`${config.V4_ES_FEEDER_API_URL}`).send(body).set({ Authorization: `Bearer ${token}` })
}

module.exports = {
  getInformixConnection,
  getM2Mtoken,
  getRequest,
  postRequest,
  deleteRequest,
  postBusEvent,
  prepare,
  ESFeederServiceClient,
  queryDataFromDB,
  executeSQLonDB,
  forceV4ESFeeder
}
