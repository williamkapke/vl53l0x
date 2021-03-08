import VL53L0X from '../lib'
const XSHUT = [
  [17, 0x30],
  [22, 0x31],
  [23, 0x32],
  [27, 0x33],
]

// TODO: fix loop of pins
const vl53l0x = new VL53L0X(XSHUT)

let interval = null
const init = async () => {
  await vl53l0x.init({ signalRateLimit: 2.5 })

  // await vl53l0x.api.setSignalRateLimit(0.1)
  // await vl53l0x.api.setVcselPulsePeriod('pre', 18)
  // await vl53l0x.api.setVcselPulsePeriod('final', 14)
  // await vl53l0x.api.setMeasurementTimingBudget(400000)

  getMeasurement()
}

const getMeasurement = async () => {
  clearInterval(interval)
  interval = null
  const measure = await vl53l0x.api.measure()
  // const measure22 = await vl53l0x22.api.measure()
  // const measure23 = await vl53l0x23.api.measure()
  // const measure27 = await vl53l0x27.api.measure()

  const now = new Date()

  console.log(measure, [now.getHours(), ':', now.getMinutes(), ':', now.getSeconds()].join(''))
  // console.log(22, measure22, [now.getHours(), ':', now.getMinutes(), ':', now.getSeconds()].join(''))
  // console.log(23, measure23, [now.getHours(), ':', now.getMinutes(), ':', now.getSeconds()].join(''))
  // console.log(27, measure27, [now.getHours(), ':', now.getMinutes(), ':', now.getSeconds()].join(''))

  // When using an async function as an argument to setInterval or setTimeout,
  // make sure you wrap any operations that can throw errors in a try/catch
  // to avoid un-handled errors and, on Node.js, do not call process.exit
  // as it will pre-empt the event loop without any respect for timers.
  // More detail in Async, Promises, and Timers in Node.js.
  interval = setInterval(getMeasurement, 1000)
}

init()
