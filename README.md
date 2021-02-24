# vl53l0x
A Node.js library for [a vl53l0x proximity sensor](https://amzn.to/2AP12Yw).<br>

## NOTE:
I honestly have very little knowledge of GPIO and hex programming.
This is a fork from [https://github.com/williamkapke/vl53l0x ](https://github.com/williamkapke/vl53l0x)
I did this to try and understand a bit more how to develop nodejs -> sensors apis.
and to typescript the hell out of it!

<br>

<a href="https://amzn.to/2AP12Yw">
![vl53l0x](vl53l0x.jpg)
</a>

https://npmjs.com/package/vl53l0x<br>
https://npmjs.com/package/i2c-bus

The way in which I2C is configured varies from board to board. Sometimes no
configuraton is required, but sometimes it is:

* [Configuring I2C on the Raspberry Pi](doc/raspberry-pi-i2c.md)
* [Configuring Software I2C on the Raspberry Pi](doc/raspberry-pi-software-i2c.md)
  * Consider software I2C when there are issues communicating with a device on a Raspberry Pi

## Use
```typescript
import VL53L0X from './vl53l0x'

const vl53l0x = new VL53L0X(1)

const init = async () => {
  await vl53l0x.init()

  while (true) {
    console.log(await vl53l0x.api.measure())
  }
}

init()

```

## Interface

### vl53l0x.api
```typescript
  measure: (continuous?: boolean) => Promise<number>
  setSignalRateLimit: (limit_Mcps: number) => Promise<void | BytesWritten>
  getSignalRateLimit: () => Promise<number>
  getMeasurementTimingBudget: () => Promise<number>
  setMeasurementTimingBudget: (budget_us: number) => Promise<void>
  getVcselPulsePeriod: (type: number) => Promise<number>
  setVcselPulsePeriod: (type: 'pre' | 'final', period_pclks: 8 | 10 | 12 | 14 | 16 | 18) => Promise<void>
  performSingleRefCalibration: (vhv_init_byte: number) => Promise<void>
  io: {
    write: (data: Buffer) => Promise<BytesWritten>
    writeReg: (register: REG, value: number, isReg16?: boolean) => Promise<BytesWritten>
    writeMulti: (register: REG, array: Buffer) => Promise<BytesWritten>
    readReg: (register: REG, isReg16?: boolean) => Promise<number>
    readMulti: (register: REG, length?: number) => Promise<Buffer>
  }
```
### VL53L0X(bus, address)
Creates a VL53L0X instance.

**bus:** The [i2c-bus-promise](https://www.npmjs.com/package/i2c-bus-promise) instance<br>
**address:** The i2c device address (factory default is `0x29`). Changing it is a pain and this
library doesn't aim to take that on.

**Returns:** The VL53L0X interface.

#### measure()
Gets a measurement from the device.

**Returns:** The distance in millimeters (Number)

# References
https://www.st.com/resource/en/datasheet/vl53l0x.pdf

# License
MIT
