/**
 * The mock Challenge API V5.
 */
const http = require('http')
const send = require('http-json-response')
const _ = require('lodash')


// Sample challenge
const sampleChallenge = {
  "id": "96059e8d-4761-4978-9a14-c86ae6b971c3",
  "legacyId": 30049360,
  "type": "Code",
  "track": "Develop",
  "name": "Test Challenge 1",
  "description": "Test Challenge 1 - Description",
  "challengeSettings": [
    {
      "type": "setting1",
      "value": "value1"
    }
  ],
  "created": "2019-03-02T14:35:53.948Z",
  "createdBy": "Copilot1",
  "updated": "2019-03-02T14:35:53.948Z",
  "updatedBy": "Copilot1"
}


const responses = {
  '/v5/challenges/96059e8d-4761-4978-9a14-c86ae6b971c3': sampleChallenge
}

const mockChallengeV5Api = http.createServer((req, res) => {
  
if (req.method === 'GET' && _.includes(Object.keys(responses), req.url)) {
    return send(res, 200, responses[req.url])
  } else {
    // 404 for other routes
    return send(res, 404, {message : 'Challenge not found'})
  }
})

if (!module.parent) {
  const port = process.env.CHALLENGE_API_PORT || 3001
  mockChallengeV5Api.listen(port)
  console.log(`mock challenges api v5 is listening on port ${port}`)
}
