const i2c = require('i2c-bus-promise')
const VL53L0X = require('../')

i2c.open(1).then(async (bus) => {
  const vl53l0x = VL53L0X(bus, 0x29)

  // LONG_RANGE
  await vl53l0x.setSignalRateLimit(0.1)
  await vl53l0x.setVcselPulsePeriod('pre', 18)
  await vl53l0x.setVcselPulsePeriod('final', 14)

  while(true) {
    console.log(await vl53l0x.measure())
  }
})
.catch(console.error)

