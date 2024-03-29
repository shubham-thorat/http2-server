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

let priv_key = '../private_key.pem'
let priv_cert = '../certificate.pem'


const server = http2.createSecureServer({
  key: fs.readFileSync(path.join(__dirname, priv_key)), //private key
  cert: fs.readFileSync(path.join(__dirname, priv_cert)),
  maxSessionMemory: 10000,
  settings: {
    maxConcurrentStreams: 1000
  },
});

server.setTimeout(1000 * 60 * 60)
// const server = http2.createServer({
//   maxSessionMemory: 10000,
//   settings: {
//     maxConcurrentStreams: 1000000
//   }
// });

const timeStart = Date.now()

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


// let rps = 0;
// const intervalInstance = setInterval(() => {
//   const data = `${Date.now()}  ${rps} \n`
//   // Count.rps_count = 0;
//   rps = 0
//   helper.writeToFile2(data)
// }, 1000)


let prev_file = ''
server.on('stream', (stream, headers) => {
  const startTime = Date.now()
  client.timing('request_received', 1);
  const method = headers[':method'];
  const path = headers[':path'];
  // console.log("REQUEST RECEIVED : ", "method : ", method, " Path: ", path)
  const serverlogfileName = headers['serverlogfilename'] ?? 'output_server.log';


  if (method === 'GET' && path === '/health') {
    //console.log("GET REQUEST RECEIVED /health")
    stream.respond({ ':status': 200 });
    return stream.end(JSON.stringify({
      "STATUS": "OK"
    }))
  }

  // console.log("REQUEST RECEIVED : ", "method : ", method, " Path: ", path)
  // console.log("REQUEST OTHER THAN /health")
  //rps += 1
  // console.log("RPS", rps)

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
    console.log("SENDING RESPONSE")
    stream.end(JSON.stringify({
      "Method": method,
      "Path": path,
      "streamId": stream.id,
      "TimeDiffServer": timeRequired,
    }))
  } else {
    // console.log("POST REQUEST RECEIVED")
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
      // console.log("POST REQUEST DATA RECEIVED ", data)
      try {
        //console.log(typeof data, " DATA: ", data)
        let payload = data === '' || data === undefined ? {
          'KEY': 'DEFAULT_KEY',
          'VALUE': 'DEFAULT_VALUE'
        } : JSON.parse(data);

        RedisClient.setKey(payload.key, payload.value).then(response => {
          const endTime = Date.now();
          stream.respond({ ':status': 200 })
          Count.increment()
          const timeRequired = endTime - startTime;

          // stats.calculateStats(startTime)
          client.timing('response_time', timeRequired)
          helper.writeToFile(timeRequired, Count.getCount(), serverlogfileName)

          console.log("REQUEST COUNT : ", Count.getCount())
          // rps += 1
          client.timing('request_end', 1)
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

server.on('timeout', () => {
  console.log(`Timeout Event is triggered, Total Time: ${Date.now() - timeStart}`);
})

const port = 6000
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
