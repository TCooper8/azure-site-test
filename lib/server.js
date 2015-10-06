'use strict'

let Bunyan = require('bunyan')
let Promise = require('bluebird')
let Restify = require('restify')

let log = Bunyan.createLogger({
  name: 'server',
  level: 'info'
})

let port = process.env.PORT || 3000
let host = process.env.HOST || '0.0.0.0'

let loginRoute = Promise.coroutine(function*(inReq, inRes, inNext) {
  inRes.send(200, 'Hello person =)')
  inNext()
})

let server = Restify.createServer()
//server.post('/login/', (inReq, inRes, inNext) => {
//  loginRoute(inReq, inRes, inNext)
//  .catch( err => {
//    log.error(err, 'Server error: %s', err.message)
//    inRes.send(400, 'Uncaught exception')
//  })
//})

server.get(/\/?.*/, Restify.serveStatic({
  directory: './static',
  default: 'html/index.html'
}));

server.listen(port, host, () => {
  log.info('Listening on %s at %s', server.name, server.url)
})
