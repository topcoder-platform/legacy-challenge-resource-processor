/**
 * Production configuration file
 */

module.exports = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  CHALLENGE_API_V4_URL: process.env.CHALLENGE_API_V4_URL || 'https://api.topcoder.com/v4/challenges',
  CHALLENGE_API_V5_URL: process.env.CHALLENGE_API_V5_URL || 'https://api.topcoder.com/v5/challenges',

  AUTH0_URL: process.env.AUTH0_URL, // Auth0 credentials for M2M token
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://www.topcoder.com',
  TOKEN_CACHE_TIME: process.env.TOKEN_CACHE_TIME,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET
}
