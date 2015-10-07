'use strict'

let Bunyan = require('bunyan')
let Libuuid = require('node-uuid')
let Promise = require('bluebird')
let Restify = require('restify')
let SocketIO = require("socket.io")
let Util = require('util')
let _ = require('lodash')

let Azure = require('azure')
let AzureStorage = require('azure-storage')

let sprintf = Util.format

let liftTry = f => function() {
  try {
    let val = b.bind(this, arguments)
    return {
      get: () => val,
      isSuccess: true
    }
  }
  catch (err) {
    return {
      get: () => {
        throw new Error('Cannot call `get` from Failed value.')
      },
      err: () => err,
      isSuccess: false
    }
  }
}

let log = Bunyan.createLogger({
  name: 'server',
  level: 'info',
  streams: [
    {
      stream: process.stdout
    },
    {
      type: 'rotating-file',
      path: './logs.log'
    }
  ]
})

let port = process.env.PORT || 8080
let host = process.env.HOST || '0.0.0.0'

// Create the service bus service, for publishing to topics.
let serviceBusService = Azure.createServiceBusService(
  process.env.AZURE_SERVICEBUS_ACCESSS_KEY
)

// Create the queue for this web service.
let retryOps = new AzureStorage.ExponentialRetryPolicyFilter()
let queueService = AzureStorage.createQueueService(
  process.env.AZURE_STORAGE_ACCOUNT,
  process.env.AZURE_STORAGE_ACCESS_KEY,
  process.env.AZURE_STORAGE_CONNECTION_STRING
).withFilter(retryOps)

let queueUuid = Libuuid()
let queueName = 'web-service-' + queueUuid

// This is a table for managing active web RPC calls.
let webTasks = { }
let deadLetter = msg => {
  log.warn('Got dead letter %j', msg)
}

let pollLetters = () => {
  queueService.getMessages(queueName, (inError, inRes, inResp) => {
    if (inError) {
      log.error(inError, 'queueService::getMessagesError: %s', inError.message)
      return
    }

    let ack = letter => {
      queueService.deleteMessage(queueName, letter.messageid, letter.popreceipt, (delError, delResp) => {
        if (delError) {
          log.error(delError, 'queueService::deleteMessageError: %s', delError.message)
        }
      })
    }

    let handleLetter = letter => {
      let msg = JSON.parse(letter.messagetext)
      console.dir(msg)
      let taskUuid = msg.customProperties.msguuid
      let callback = webTasks[taskUuid]
      if (callback === undefined) {
        deadLetter(letter)
        return
      }

      let res = callback(msg)
      // If the result is a promise, acknowledge the letter once it has finished.
      if (res instanceof Promise) {
        res
        .catch( err => {
          log.error(err, 'Received error from taskUuid( %s ): %s', taskUuid, err.message)
        })
        .finally( () => {
          delete webTasks[taskUuid]
          ack(letter)
        })
      }
    }

    _.each(inRes, letter => {
      try {
        handleLetter(letter)
      }
      catch (err) {
        log.error(err)
      }
    })
    pollLetters()
  })
}

queueService.createQueueIfNotExists(queueName, (error, result, response) => {
  if (error) {
    log.error(error, 'createQueueError: %s', err.message)
    throw error
  }
  log.info('Created private queue %s', queueName)

  pollLetters()
})

let handleLogin = (username, password) => {
  return new Promise( (resolve, reject) => {
    let msgUuid = Libuuid()
    let msg = {
      body: {
        username: username,
        password: password
      },
      customProperties: {
        msguuid: msgUuid,
        replyto: queueName
      }
    }

    webTasks[msgUuid] = letter => {
      console.log('Got reply %j', letter)
      resolve(letter)
    }

    log.info('Publishing login for %s', username)

    queueService.createMessage('auth', JSON.stringify(msg), (inError, inRes, inResp) => {
      if (inError) {
        reject(inError)
        log.error(inErorr, 'publichError: %s', inError.message)
        delete webTasks[msgUuid]
      }
    })

    /*serviceBusService.sendTopicMessage('auth', msg, inError => {
      if (inError) {
        delete webTasks[msgUuid]
        log.error(inError, 'topicPublishError: %s', inError.message)
        reject(inError)
      }
    })*/
  })
}

let server = Restify.createServer()
let io = SocketIO.listen(server.server)

io.sockets.on('connection', socket => {
  log.info('Got connnections')

  socket.on('login', Promise.coroutine(function*(msg) {
    let username = msg.username
    let password = msg.password

    if (username === undefined || password === undefined) {
      console.log('Got bad credentials')
      socket.emit('loginReplyError', 'Invalid credentials')
      return
    }

    log.info('Logging in %s', username)

    let authResp = yield handleLogin(username, password)
    socket.emit('loginReply', authResp)
  }))
})

server.use(Restify.authorizationParser())

server.post('/login', (inReq, inRes, inNext) => {
  loginRoute(inReq, inRes, inNext)
  .catch( err => {
    log.error(err, 'Server error: %s', err.message)
    inRes.send(400, 'Uncaught exception')
  })
})

server.get(/\/?.*/, Restify.serveStatic({
  directory: './static',
  default: 'html/index.html'
}));

server.listen(port, host, () => {
  log.info('Listening on %s at %s', server.name, server.url)
})
