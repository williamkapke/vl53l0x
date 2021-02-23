// require('module-alias/register')

import VL53L0X from './vl53l0x'

const vl53l0x = new VL53L0X(1)

const init = async () => {
  await vl53l0x.init()

  while (true) {
    console.log(await vl53l0x.api.measure())
  }
}

init()
