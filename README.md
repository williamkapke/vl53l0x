# vl53l0x
A Node.js library for a vl53l0x device


```
npm install vl53l0x i2c-bus-promise
```

## Use
```js
const i2c = require('i2c-bus-promise')
const VL53L0X = require('vl53l0x')

i2c.open(1).then(async (bus) => {
  const vl53l0x = VL53L0X(bus, 0x29)
  while(true) {
    console.log(await vl53l0x.measure())
  }
})
.catch(console.error)
```

## BYO[protocol]
I've opted to leave the communication protocol libraries out to keep from
installing extra cruft that isn't needed.

This means **you will need to install the [i2c-bus-promise](https://www.npmjs.com/package/i2c-bus-promise) independently**.

## i2c-bus-promise
```
npm install i2c-bus-promise
```

This library is **async** (Promise) based. The [i2c-bus](https://www.npmjs.com/package/i2c-bus) is not. The
[i2c-bus-promise](https://www.npmjs.com/package/i2c-bus-promise) library is just a promise wrapper for it.

You should be able to reuse an existing instance of [i2c-bus](https://www.npmjs.com/package/i2c-bus) if you
already have one installed.


## Interface

### VL53L0X(bus, address)
Creates a VL53L0X instance.

**bus:** The [i2c-bus-promise](https://www.npmjs.com/package/i2c-bus-promise) instance<br>
**address:** The i2c device address (factory default is `0x29`). Changing it is a pain and this
library doesn't aim to take that on.

**Returns:** The VL53L0X interface.

#### measure()
Gets a measurement from the device.

**Returns:** The distance in millimeters (Number)


## Other functions...
There are additional functions exposed but you'll really need to read [the datasheet](https://www.st.com/resource/en/datasheet/vl53l0x.pdf)
to get an understanding of what each does. You can [checkout the examples](examples/) also.

**getSignalRateLimit()**<br>
**setSignalRateLimit(limit_Mcps)**<br>

**getMeasurementTimingBudget()**<br>
**setMeasurementTimingBudget(timing_budget)**<br>

**getVcselPulsePeriod()**<br>
**setVcselPulsePeriod(type, period_pclks)**<br>

**performSingleRefCalibration(vhv_init_byte)**<br>


# References
https://www.st.com/resource/en/datasheet/vl53l0x.pdf

# License
MIT
