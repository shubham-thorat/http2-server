const fs = require('node:fs');

function calculatePercentile(array, percentile) {
  if (array.length === 0) {
    console.log("Array is empty.");
    return { result: 0, min_value: 0, max_value: 0 }
  }

  array.sort((a, b) => a - b);
  const min_value = array.length != 0 ? array[0] : 0;
  const max_value = array.length != 0 ? array[array.length - 1] : 0;

  const index = (percentile / 100) * (array.length - 1);
  if (Number.isInteger(index)) {
    return { result: array[index], min_value, max_value };
  } else {
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const lowerValue = array[lowerIndex];
    const upperValue = array[upperIndex];
    const fraction = index - lowerIndex;
    let result = (upperValue - lowerValue) * fraction + lowerValue;

    return { result: result.toFixed(2), min_value, max_value }
  }
}


function calculateMean(array) {
  if (array.length === 0) {
    throw new Error("Array is empty.");
  }

  const sum = array.reduce((total, num) => total + num, 0);
  const mean = sum / array.length;
  return mean;
}

const calculate = (times, logger) => {
  const startTime = Date.now();
  const r1 = calculatePercentile(times, 99);
  const per_50 = calculateMean(times);
  const r2 = calculatePercentile(times, 50);
  const endTime = Date.now();

  // logger.info(JSON.stringify({
  //   "99th Percentile": `${r1.result}ms`,
  //   "50 Percentile": `${r2.result}ms`,
  //   "min time required for request": `${r1.min_value}ms`,
  //   "max time required for request": `${r1.max_value}ms`,
  //   "average": `${per_50.toFixed(3)}ms`,
  //   "proccessing time": `${(endTime - startTime)}ms`,
  // }))


  console.log({
    "99th Percentile": `${r1.result}ms`,
    "50 Percentile": `${r2.result}ms`,
    "min time required for request": `${r1.min_value}ms`,
    "max time required for request": `${r1.max_value}ms`,
    "average": `${per_50.toFixed(3)}ms`,
    "proccessing time": `${(endTime - startTime)}ms`,
  })
}



const writeToFile = (timeRequired, request_count, serverlogfilePath) => {
  //console.log("server log file", serverlogfilePath)
  const file_name = serverlogfilePath ?? 'output_server.log'
  const path = `./output/logs/${file_name}`
  const data = `${request_count} ${timeRequired.toString()}\n`
  fs.appendFile(path, data, (err) => {
    if (err) {
      console.log("Error occurred while appending data to file : ", path, err)
    }
  })
}

const writeToFile2 = (data) => {
  //console.log("server log file", serverlogfilePath)
  const file_name = 'rps.log'
  const path = `./rps/${file_name}`
  fs.appendFile(path, data, (err) => {
    if (err) {
      console.log("Error occurred while appending data to file : ", path, err)
    }
  })
}

module.exports = {
  calculateMean,
  calculatePercentile,
  calculate,
  writeToFile,
  writeToFile2
}
