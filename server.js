var Http = require('http')
var port = process.env.PORT || 3000
var host = process.env.HOST || '0.0.0.0'

Http.createServer( (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Hello world from Azure!')
})
.listen(port, host)

console.log('Server running at ' + host + ':' + port)
