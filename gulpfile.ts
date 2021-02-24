import { series, src, watch } from 'gulp'
import * as GulpSSH from 'gulp-ssh'

const config = {
  remoteFolderPath: '/home/pi/vl53l0x',
  ssh: {
    host: '192.168.1.111',
    port: 22,
    username: 'pi',
    password: 'raspberry',
  },
}

const SSH = new GulpSSH({
  ignoreErrors: false,
  sshConfig: config.ssh,
})

const cleanupDev = (cb) => SSH.shell([`cd ${config.remoteFolderPath}`, `find -maxdepth 1 ! -name "tsconfig.json" ! -name "package.json" ! -name "package-lock.json" ! -name "node_modules" ! -name . -exec rm -rv {} \;`, `ls -lah`])
const deployDevTask = () => src('src/**').pipe(SSH.dest(`${config.remoteFolderPath}/src`))
const deployDevPackage = () => src(['package.json', 'package-lock.json', 'tsconfig.json']).pipe(SSH.dest(`${config.remoteFolderPath}`))
const npmInstallDevDeps = () => SSH.shell([`cd ${config.remoteFolderPath}`, `npm install`])
export const depsDevTask = series(deployDevPackage, npmInstallDevDeps)
export const watchTask = () => watch(['./src/**/*.ts'], series(cleanupDev, deployDevTask))
