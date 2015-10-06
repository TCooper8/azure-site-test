'use strict'

let Http = require('http')
let port = process.env.PORT || 80
let host = process.env.HOST || '0.0.0.0'

Http.createServer( (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Hello world from Azure!')
})
.listen(port, host)

console.log('Server running at ' + host + ':' + port)
