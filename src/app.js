const http2 = require('node:http2');
const fs = require('node:fs');
const path = require('path');
// const logger = require('gk-logger')({
//   "log_file": '/node-http2.log',
//   "error_file": '/node-http2-error.log'
// });
const RedisClient = require('./redis/redisClient')
const helper = require('./helper')
// const stats = require('./statsd/index')
const client = require('./statsd/index')

const server = http2.createSecureServer({
  key: fs.readFileSync(path.join(__dirname, '../ssl/localhost-privkey.pem')), //private key
  cert: fs.readFileSync(path.join(__dirname, '../ssl/localhost-cert.pem')),
  maxSessionMemory: 1000,
  settings: {
    maxConcurrentStreams: 1000
  }
});

const getTime = (startTime) => {
  return (Date.now() - startTime) / 1000;
}

process.on('SIGINT', function () {
  console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
  // some other closing procedures go her
  process.exit(0);
});

class Count {
  static request_count = 0;
  static setInitial() {
    this.request_count = 0;
  }
  static increment() {
    this.request_count = this.request_count + 1
    return this.request_count
  }
  static getCount() {
    return this.request_count
  }
}


client.socket.on('error', function (error) {
  // logger.error({
  //   "Nice": error
  // })
  console.error(JSON.stringify({
    "Error": error,
    "msg": "While connecting node-statsd"
  }))
});

let prev_file = ''
server.on('stream', (stream, headers) => {
  const startTime = Date.now()
  client.timing("request_received",0);
  const method = headers[':method'];
  const path = headers[':path'];
  const serverlogfileName = headers['logfilepath'];

  stream.on('aborted', () => {
    const timeRequired = getTime(startTime);
    console.log("server aborted")
    // logger.error(JSON.stringify({
    //   msg: 'Stream Aborted',
    //   streamId: stream.id,
    //   time: timeRequired,
    //   TimeDiffServer: timeRequired
    // }))
    console.log({
      msg: 'Stream Aborted',
      streamId: stream.id,
      time: timeRequired,
      TimeDiffServer: timeRequired
    })
  })

  stream.on('error', (err) => {

    const timeRequired = getTime(startTime);
    // console.log("server error occurred", JSON.stringify(err))
    // logger.error(JSON.stringify({
    //   msg: `Error occured ${JSON.stringify(err)}`,
    //   streamId: stream.id,
    //   TimeDiffServer: timeRequired,
    // }))
    console.log({
      msg: `Error occured ${JSON.stringify(err)}`,
      streamId: stream.id,
      TimeDiffServer: timeRequired,
    })
  })


  if (method === 'GET') {
    // logger.info(`GET method request received at server for streamId : ${stream.id}`)
    console.log(`GET method request received at server for streamId : ${stream.id}`)
    stream.respond({ ':status': 200 });
    const timeRequired = getTime(startTime);
    stream.end(JSON.stringify({
      "Method": method,
      "Path": path,
      "streamId": stream.id,
      "TimeDiffServer": timeRequired,
    }))
  } else {
    // client.set(['foo', 'bar'], 42, function (error, bytes) {
    //   //this only gets called once after all messages have been sent
    //   if (error) {
    //     console.error('Oh noes! There was an error:', error);
    //   } else {
    //     console.log('Successfully sent', bytes, 'bytes');
    //   }
    // });

    let data = ''
    stream.setEncoding('utf-8')
    stream.on('data', (chunk) => {
      data += chunk
    })

    stream.on('end', () => {

      try {
        const payload = data === '' ? '{}' : JSON.parse(data);

        RedisClient.setKey(payload.key, payload.value).then(response => {
          const endTime = Date.now();
          stream.respond({ ':status': 200 })
          Count.increment()
          const timeRequired = endTime - startTime;

          // stats.calculateStats(startTime)
          client.timing('response_time', timeRequired)
          helper.writeToFile(timeRequired, Count.getCount(), serverlogfileName)

          console.log("count", Count.getCount())
          if (prev_file !== serverlogfileName) {
            console.log(`Request ended ... count: ${Count.getCount()}`)
            prev_file = serverlogfileName
            Count.setInitial()
          }
	 const  t = Date.now() - startTime;
          client.timing("request_send",t);
          stream.end(JSON.stringify({
            msg: 'Redis key set success',
            streamId: stream.id,
            TimeDiffServer: (endTime - startTime) / 1000,
            "request count": Count.getCount()
          }))

        }).catch(error => {
          const timeRequired = getTime(startTime);
          console.error(JSON.stringify({ "Error while parsing or setting redis key": error }))
          // logger.error(JSON.stringify({ "Error while parsing or setting redis key": error }))
          stream.respond({ ':status': 500 })
          stream.end(JSON.stringify({
            msg: 'Redis key set failure',
            streamId: stream.id,
            TimeDiffServer: timeRequired,
          }))

        })

      } catch (error) {
        const timeRequired = getTime(startTime);
        // logger.error(JSON.stringify({ "Error while parsing payload or setting redis key": error }))
        console.error(JSON.stringify({ "Error while parsing payload or setting redis key": error }))
        stream.respond({ ':status': 500 })
        stream.end(JSON.stringify({
          msg: error,
          streamId: stream.id,
          TimeDiffServer: timeRequired,
        }))
      }
    })

  }
})




const port = process.env.PORT || 6000
server.listen(port, () => {
  try {
    if (!fs.existsSync('./output')) {
      fs.mkdirSync('./output');
      console.log('Output Folder created')
    }
  } catch (err) {
    console.log(`Error while creating output folder..`)
  }

  Count.setInitial()
  console.log(`Server running https://localhost:${port}`)
})
