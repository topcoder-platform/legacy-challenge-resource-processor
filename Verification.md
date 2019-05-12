# Topcoder - Challenge Resource Processor Verification

- start kafka server
- start Challenges V5 Mock API :
   1. Go to challenge-api-v5-mock
   2. Run `npm install`
   3. Run `node mock-challenge-api.js`
- start processor app
- start kafka-console-producer to write messages to `challenge.resources.notification.create` topic:
  `bin/kafka-console-producer.sh --broker-list localhost:9092 --topic challenge.resources.notification.create`

- start kafka-console-producer to write messages to `challenge.resources.notification.delete` topic:
  `bin/kafka-console-producer.sh --broker-list localhost:9092 --topic challenge.resources.notification.delete`


 -- Please note that the Challenge V5 API is configured to return a Challenge legacy Id = '30049360', se we are using this challenge https://software.topcoder-dev.com/review/actions/ViewProjectDetails?pid=30049360 for testing (Login as TonyJ/appirio123 at https://accounts.topcoder-dev.com/member to access it)

 -- To be noted as well that the test messages use roleId='bac822d2-725d-4973-9701-360918a09bc0' which is mapped to resource_role = 1 ( Submitter) in src/common/utils.js#11 ( This mapping is only provided for testing, the concrete mapping should be done between the actual ids in v5 db and informix Database)
 The full list of resource_roles in the Dev informix database ( https://hub.docker.com/r/appiriodevops/tc-database-scripts) can be found in verification-docs/resource_roles.txt

-- A postman collection is also provided, which contains some useful tests specifically 'Get Challenge Resources' which can be used to list the challenge resources before and after sending a message to Kafka topic. ( execute 'get-machine-token' first to properly set the machine token for accessing the V4 API)

-- The memberId used for testing is 23225544 for lazybaer ( you can use another memberId to avoid issues if both reviewers are testing at the same time)

- write message of `Add Challenge Resource` in the corresponding producer:


  `{"topic":"challenge.resources.notification.create","originator":"resources-api","timestamp":"2019-05-03T15:46:05.575Z","mime-type":"application/json","payload":{"challengeId":"96059e8d-4761-4978-9a14-c86ae6b971c3","roleId":"bac822d2-725d-4973-9701-360918a09bc0","memberId":23225544}}`
  
- the processor app console will show a message like :

```bash
info: Handle Kafka event message; Topic: challenge.resources.notification.create; Partition: 0; Offset: 368; Message: {"topic":"challenge.resources.notification.create","originator":"resources-api","timestamp":"2019-05-03T15:46:05.575Z","mime-type":"application/json","payload":{"challengeId":"96059e8d-4761-4978-9a14-c86ae6b971c3","roleId":"bac822d2-725d-4973-9701-360918a09bc0","memberId":23225544}}.
debug: ENTER createChallengeResource
debug: input arguments
debug: { message:
   { topic: 'challenge.resources.notification.create',
     originator: 'resources-api',
     timestamp: '2019-05-03T15:46:05.575Z',
     'mime-type': 'application/json',
     payload:
      { challengeId: '96059e8d-4761-4978-9a14-c86ae6b971c3',
        roleId: 'bac822d2-725d-4973-9701-360918a09bc0',
        memberId: 23225544 } } }
info: Successfully processed create challenge resource message : {"topic":"challenge.resources.notification.create","originator":"resources-api","timestamp":"2019-05-03T15:46:05.575Z","mime-type":"application/json","payload":{"challengeId":"96059e8d-4761-4978-9a14-c86ae6b971c3","roleId":"bac822d2-725d-4973-9701-360918a09bc0","memberId":23225544}}
debug: EXIT createChallengeResource
debug: output arguments
debug: Successfully processed message
```

-- You can directly check https://software.topcoder-dev.com/review/actions/ViewProjectDetails?pid=30049360 and verify if the member is properly added to the challenge resources, If Online Review in the dev environment is unstable, you ca use the provided postman collection to get the list of challenge resources and check if the added member is in the list


- write message of `Delete Challenge Resource` in the corresponding producer:
  `{"topic":"challenge.resources.notification.delete","originator":"resources-api","timestamp":"2019-05-03T15:46:05.575Z","mime-type":"application/json","payload":{"challengeId":"96059e8d-4761-4978-9a14-c86ae6b971c3","roleId":"bac822d2-725d-4973-9701-360918a09bc0","memberId":23225544}}`

- the processor app console will show logs similar to the following :

```bash
info: Handle Kafka event message; Topic: challenge.resources.notification.delete; Partition: 0; Offset: 360; Message: {"topic":"challenge.resources.notification.delete","originator":"resources-api","timestamp":"2019-05-03T15:46:05.575Z","mime-type":"application/json","payload":{"challengeId":"96059e8d-4761-4978-9a14-c86ae6b971c3","roleId":"bac822d2-725d-4973-9701-360918a09bc0","memberId":23225544}}.
debug: ENTER deleteChallengeResource
debug: input arguments
debug: { message:
   { topic: 'challenge.resources.notification.delete',
     originator: 'resources-api',
     timestamp: '2019-05-03T15:46:05.575Z',
     'mime-type': 'application/json',
     payload:
      { challengeId: '96059e8d-4761-4978-9a14-c86ae6b971c3',
        roleId: 'bac822d2-725d-4973-9701-360918a09bc0',
        memberId: 23225544 } } }
info: Successfully processed delete challenge resource message : {"topic":"challenge.resources.notification.delete","originator":"resources-api","timestamp":"2019-05-03T15:46:05.575Z","mime-type":"application/json","payload":{"challengeId":"96059e8d-4761-4978-9a14-c86ae6b971c3","roleId":"bac822d2-725d-4973-9701-360918a09bc0","memberId":23225544}}
debug: EXIT deleteChallengeResource
debug: output arguments
debug: Successfully processed message
```

-- Check if the member is properly removed from the challenge resources list

- you may write invalid message like:
  `{"topic":"challenge.resources.notification.delete","originator":"resources-api","timestamp":"2019-05-03T15:46:05.575Z","mime-type":"application/json","payload":{"challengeId":"96059e8d-4761-4978-9a14-c86ae6b971c3","roleId":"bac822d2-725d-4973-9701-360918a09bc0","memberId":"invalid"}}`

  `{"topic":"challenge.resources.notification.delete","timestamp":"2019-05-03T15:46:05.575Z","mime-type":"application/json","payload":{"challengeId":"96059e8d-4761-4978-9a14-c86ae6b971c3","roleId":"bac822d2-725d-4973-9701-360918a09bc0","memberId":23225544}}`

  `[ { - a b c`

- The processor console will show the appropriate error messages.