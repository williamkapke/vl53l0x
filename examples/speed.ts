import VL53L0X from '../'

const vl53l0x = new VL53L0X(1)
let interval = null
const init = async () => {
  await vl53l0x.init()

  // HIGH_SPEED
  await vl53l0x.api.setMeasurementTimingBudget(20000)

  getMeasurement()
}

const getMeasurement = async () => {
  clearInterval(interval)
  interval = null
  const measure = await vl53l0x.api.measure()
  const now = new Date()

  console.log(measure, [now.getHours(), ':', now.getMinutes(), ':', now.getSeconds()].join(''))

  interval = setInterval(getMeasurement, 1000)
}

init()
