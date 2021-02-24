// require('module-alias/register')

import VL53L0X from '../'

const vl53l0x = new VL53L0X(1)
let interval = null
const init = async () => {
  await vl53l0x.init()
  await vl53l0x.api.setSignalRateLimit(0.1)
  await vl53l0x.api.setVcselPulsePeriod('pre', 18)
  await vl53l0x.api.setVcselPulsePeriod('final', 14)
  await vl53l0x.api.setMeasurementTimingBudget(400000)

  getMeasurement()
}

const getMeasurement = async () => {
  clearInterval(interval)
  interval = null
  const measure = await vl53l0x.api.measure()
  const now = new Date()

  console.log(measure, [now.getHours(), ':', now.getMinutes(), ':', now.getSeconds()].join(''))

  // When using an async function as an argument to setInterval or setTimeout,
  // make sure you wrap any operations that can throw errors in a try/catch
  // to avoid un-handled errors and, on Node.js, do not call process.exit
  // as it will pre-empt the event loop without any respect for timers.
  // More detail in Async, Promises, and Timers in Node.js.
  interval = setInterval(getMeasurement, 1000)
}

init()
