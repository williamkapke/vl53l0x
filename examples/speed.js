const i2c = require('i2c-bus-promise')
const VL53L0X = require('../')

i2c.open(1).then(async (bus) => {
  const vl53l0x = VL53L0X(bus, 0x29)

  // HIGH_SPEED
  await vl53l0x.setMeasurementTimingBudget(20000)

  while(true) {
    console.log(await vl53l0x.measure())
  }
})
.catch(console.error)

