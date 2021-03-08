# vl53l0x

A Node.js library for [a vl53l0x proximity sensor](https://amzn.to/2AP12Yw).

**NOTE:**
This package addresses the issue of adding multiple vl53l0x on one device. Please read below how to.

**NOTE:**

I honestly have very little knowledge of GPIO and hardware programming.
This is a fork from [https://github.com/williamkapke/vl53l0x ](https://github.com/williamkapke/vl53l0x)

I did this to try and understand a bit more how to develop nodejs -> sensors apis.
and to typescript the hell out of it!

[![vl53l0x](https://raw.githubusercontent.com/rip3rs/vl53l0x/master/vl53l0x.jpg)](https://amzn.to/2AP12Yw)

## Install

From: https://www.npmjs.com/package/i2c-bus#installation
<br/>
The way in which I2C is configured varies from board to board. Sometimes no
configuration is required, but sometimes it is:

- [Configuring I2C on the Raspberry Pi](doc/raspberry-pi-i2c.md)
- [Configuring Software I2C on the Raspberry Pi](doc/raspberry-pi-software-i2c.md)
  - Consider software I2C when there are issues communicating with a device on a Raspberry Pi

`npm install ts-vl53l0x`

## Use

## Normal single sensor

```typescript
import VL53L0X from 'ts-vl53l0x'

const vl53l0x = new VL53L0X()

const init = async () => {
  await vl53l0x.init()

  while (true) {
    console.log(await vl53l0x.api.measure())

    // output: { '0': 8191 }
  }
}

init()
```

## Multiple sensors

```typescript
import VL53L0X from 'ts-vl53l0x'

const arrayOfSensors = [
  [17, 0x30],
  [22, 0x31],
]

const vl53l0x = new VL53L0X(arrayOfSensors)

const init = async () => {
  await vl53l0x.init()

  while (true) {
    console.log(await vl53l0x.api.measure())
    // output: { '17': 8191, '22': 8191 }

    console.log(await vl53l0x.api.measure(17))
    // output: { '17': 8191 }

    console.log(await vl53l0x.api.measure(22))
    // output: { '22': 8191 }
  }
}

init()
```

You should be able to allocate individual calibrations:

```typescript
import VL53L0X from 'ts-vl53l0x'

const arrayOfSensors = [
  [17, 0x30],
  [22, 0x31],
]

const vl53l0x = new VL53L0X(arrayOfSensors)

const init = async () => {
  await vl53l0x.init()

  // The next options without a specific pin will do it all, or you can use  the opts on init.
  // await vl53l0x.init({...}) read bellow of rthe options available
  await vl53l0x.api.setSignalRateLimit(0.1)
  await vl53l0x.api.setVcselPulsePeriod('pre', 18)
  await vl53l0x.api.setVcselPulsePeriod('final', 14)

  //... or

  await vl53l0x.api.setSignalRateLimit(0.1, 17)

  await vl53l0x.api.setVcselPulsePeriod('pre', 18, 22)
  await vl53l0x.api.setVcselPulsePeriod('final', 14, 22)

  while (true) {
    // If you add a pin that does not exists it will error.

    console.log(await vl53l0x.api.measure())
    // output: { '17': 8191, '22': 8191 }

    console.log(await vl53l0x.api.measure(17))
    // output: { '17': 8191 }

    console.log(await vl53l0x.api.measure(22))
    // output: { '22': 8191 }
  }
}

init()
```

**note**
If by any chance you change back to single sensor, you will have to restart your device. WIP to go back to the default address

## Interface

### new VL53L0X(address?: [[pin: number, address: number]] | number = 0x29, bus = 1)

**address**

For multiple sensors, please use `XSHUT` and define the pin within the array:

```typescript
const arrayOfSensors = [
  [
    17, //pin
    0x30, // address to command
  ],
]
```

### vl53l0x.init(opts?: OPTS): Promise<void>

### OPTS

```typescript
  signalRateLimit?: number
  vcselPulsePeriod?: {
    pre: 12 | 14 | 16 | 18
    final: 12 | 14 | 16 | 18
  }
  measurementTimingBudget?: number
```

### vl53l0x.api: API

### API

```typescript
  measure: (pin?: number | string) => Promise<number>
  setSignalRateLimit(limit_Mcps: number, pin?: string | number): Promise<void | { [key: string]: BytesWritten } | BytesWritten>
  getSignalRateLimit(pin?: string | number): Promise<number | { [key: string]: number }>
  getMeasurementTimingBudget(pin?: string | number): Promise<number | { [key: string]: number }>
  setMeasurementTimingBudget(budget_us: number, pin: string | number): Promise<void>
  setVcselPulsePeriod: (type: 'pre' | 'final', period_pclks: 8 | 10 | 12 | 14 | 16 | 18, pin?: number) => Promise<void>
  getVcselPulsePeriod(type: number, pin?: string | number): Promise<number | { [key: string]: number }>
  performSingleRefCalibration(vhv_init_byte: number, pin?: string | number): Promise<void>
  io: {
    write(data: Buffer, addr: number): Promise<BytesWritten>
    writeReg(register: REG, value: number, addr: number, isReg16: boolean): Promise<BytesWritten>
    writeMulti(register: REG, array: Buffer, addr: number): Promise<BytesWritten>
    readReg(register: REG, addr: number, isReg16: boolean): Promise<number>
    readMulti(register: REG, addr: number, length?: number): Promise<Buffer>
  }
```

# References

https://www.st.com/resource/en/datasheet/vl53l0x.pdf

# License

MIT
