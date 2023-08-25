
var StatsD = require('node-statsd'),
  client = new StatsD({
    host: '13.235.33.218',
    port: 8125,
    prefix: 'statsd_metric'
  });


client.socket.on('error', function (error) {
  // logger.error({
  //   "Nice": error
  // })
  console.error(JSON.stringify({
    "Error": error,
    "msg": "While connecting node-statsd"
  }))
});




module.exports = client