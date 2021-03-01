import { parallel, series, src, watch } from 'gulp'
import * as GulpSSH from 'gulp-ssh'
import * as rimraf from 'rimraf'
import run from 'gulp-run-command'

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

const cleanupDev = (cb) =>
  SSH.shell([
    `cd ${config.remoteFolderPath}`,
    `find -maxdepth 1 ! -name "tsconfig.json" ! -name "package.json" ! -name "package-lock.json" ! -name "node_modules" ! -name . -exec rm -rv {} \;`,
    `ls -lah`,
  ])

const runTSCTask = async () => run('npm run tsc')()
const cleanLib = (cb) => rimraf('lib', { force: true }, cb)

const deployDevTask = () => src('lib/**').pipe(SSH.dest(`${config.remoteFolderPath}/lib`))
const deployDevExamplesTask = () => src('examples/**').pipe(SSH.dest(`${config.remoteFolderPath}/examples`))
const deployDevPackage = () =>
  src(['package.json', 'package-lock.json', 'tsconfig.json']).pipe(SSH.dest(`${config.remoteFolderPath}`))
const npmInstallDevDeps = () => SSH.shell([`cd ${config.remoteFolderPath}`, `npm install`])
export const depsDevTask = series(parallel(deployDevPackage, deployDevExamplesTask), npmInstallDevDeps)
export const watchTask = () =>
  watch(['./src/**/*.ts'], series(parallel(cleanupDev, cleanLib, deployDevExamplesTask), runTSCTask, deployDevTask))
