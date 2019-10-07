const VL53L0X = require('../')
// const args = ['/dev/tty.usbserial-DO01INSW', 0x29, 'i2cdriver/i2c-bus']
const args = [1, 0x29]

VL53L0X(...args).then(async (vl53l0x) => {
  while(true) {
    console.log(await vl53l0x.measure())
  }
})
.catch(console.error)
