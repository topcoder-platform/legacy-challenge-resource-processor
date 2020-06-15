/**
 * This module contains functions to :
 * -- build Kafka options from configuration.
 * -- Get the resource role legacy id by role UUID
 * -- Check if a a challenge is of studio type or not
 */
const config = require('config')
const _ = require('lodash')

const RoleUuidToRoleIdMap = {
  "16461876-297b-49a9-86cf-41b42f13ac97": 8, // Aggregator
  "19546631-3133-42f1-adf9-ce332a884ad6": 7, // Stress Reviewer
  "2a4dc376-a31c-4d00-b173-13934d89e286": 12, // Observer
  "404bf28d-6eec-4d4d-9802-dc6cbc0c2bf0": 6, // Failure Reviewer
  "50906190-747b-4c82-9706-7a5b11999dfb": 4, // Reviewer
  "5cac51cc-6386-4ff8-9cd2-caca6424e5fe": 17, // Specification Submitter
  "607c5041-272d-45be-b633-b1ca5b5ccb82": 11, // Designer
  "658d568e-0957-44ee-86bb-84105edb2b06": 2, // Primary Screener
  "6d88e386-7064-478b-a4aa-14d40e6381e8": 19, // Checkpoint Screener
  "732339e7-8e30-49d7-9198-cccf9451e221": 1, //Submitter
  "80a433cf-205d-4831-aa08-46aa53230705": 5, // Accuracy Reviewer
  "89ebb5e3-fc58-4fac-85eb-af4c656cb87f": 9, // Final Reviewer
  "8f0c0d35-c20d-43d1-9c63-af1a50ceb075": 10, // Approver
  "b1df1a6e-81f7-46fc-b38d-eed46f54cde7": 18, // Specification Reviewer
  "b52a9879-92b8-47a4-a55a-d250962692ac": 16, // Post-Mortem Reviewer
  "be53d697-8ce5-407e-b82e-23ddb2b3d87d": 3, // Screener
  "cc25f311-89a9-43f5-85f9-3c56b6b71a3a": 13, // Manager
  "cfe12b3f-2a24-4639-9d8b-ec86726f76bd": 14, // Copilot
  "e2ee18c4-096b-42ee-953a-abfe9284a6e0": 15, // Client Manager
  "f31c7e62-8dd1-46c9-a3c2-b67b3b2913c8": 21, // Iterative Reviewer
  "fef4d185-232e-4747-8f56-485bda803e62": 20 // Checkpoint Reviewer
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
