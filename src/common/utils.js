/**
 * This module contains functions to :
 * -- build Kafka options from configuration.
 * -- Get the resource role legacy id by role UUID
 * -- Check if a a challenge is of studio type or not
 */
const config = require('config')
const _ = require('lodash')

const RoleUuidToRoleIdMap = {
  'bac822d2-725d-4973-9701-360918a09bc0': 1, // submitter
  'bac822d2-725d-4973-9704-360918a09bc0': 4 // reviewer
}

const STUDIO_CHALLENGE_TYPES = ['Web Design', 'Design First2Finish', 'Studio Other', 'Idea Generation',
  'Wireframes', 'Print/Presentation', 'Front-End Flash', 'Widget or Mobile Screen Design', 'Application Front-End Design',
  'Banners/Icons', 'Logo Design']

module.exports = {
  /**
   * Get Kafka options from configuration file.
   * @return Kafka options from configuration file.
   */
  getKafkaOptions: () => {
    const options = {
      connectionString: config.KAFKA_URL,
      handlerConcurrency: 1,
      groupId: config.KAFKA_GROUP_ID
    }
    if (config.KAFKA_CLIENT_CERT && config.KAFKA_CLIENT_CERT_KEY) {
      options.ssl = {
        cert: config.KAFKA_CLIENT_CERT,
        key: config.KAFKA_CLIENT_CERT_KEY
      }
    }
    return options
  },

  getRoleIdByUuid: (roleUuid) => {
    return RoleUuidToRoleIdMap[roleUuid]
  },

  isStudio: (challengeType) => {
    return _.includes(STUDIO_CHALLENGE_TYPES, challengeType)
  }
}
