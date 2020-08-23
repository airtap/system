'use strict'

const Provider = require('browser-provider')
const Browser = require('abstract-browser')
const names = require('browser-names')
const thunky = require('thunky')
const which = require('which')
const debug = require('debug')('airtap-system')
const launcher = require('@httptoolkit/browser-launcher')
const tasklist = require('tasklist')
const exec = require('child_process').exec

const kLauncher = Symbol('kLauncher')
const kProvider = Symbol('kProvider')
const kOnExit = Symbol('kOnExit')
const kInstance = Symbol('kInstance')
const kImage = Symbol('kImage')
const kPriorPids = Symbol('kPriorPids')

// TODO (browser-launcher): use unique profile dirs
// TODO (browser-launcher): disable update check on FF
class SystemProvider extends Provider {
  constructor (options) {
    super(options)

    this[kLauncher] = thunky(function (callback) {
      // TODO (browser-launcher): opt-out of cache
      launcher.update(function (err) {
        if (err) return callback(err)
        launcher(callback)
      })
    })
  }

  _manifests (callback) {
    this[kLauncher]((err, launch) => {
      if (err) return callback(err)

      // Headless support depends on xvfb
      const headless = hasXvfb()

      // TODO (browser-launcher): expose release channel, arch, etc
      const manifests = launch.browsers.map(function ({ name, version, command }) {
        if (name === 'phantomjs') return

        const title = `System ${names.title(name) || name} ${version}`
        const options = { headless }
        const supports = { headless }

        if (getImage(name)) {
          // Can't run multiple processes if they're killed by image name
          // (and IE doesn't support it for additional, unknown reasons).
          supports.concurrency = false
        }

        return { name, version, title, command, options, supports }
      })

      callback(null, manifests.filter(Boolean))
    })
  }

  _browser (manifest, target) {
    return new SystemBrowser(this, manifest, target)
  }
}

class SystemBrowser extends Browser {
  constructor (provider, manifest, target) {
    super(manifest, target)

    this[kProvider] = provider
    this[kInstance] = null
    this[kOnExit] = this[kOnExit].bind(this)
    this[kImage] = getImage(this.manifest.name)
    this[kPriorPids] = null
  }

  _open (callback) {
    imagePids(this[kImage], (err, pids) => {
      if (err) return callback(err)

      this[kPriorPids] = pids
      this[kProvider][kLauncher]((err, launch) => {
        if (err) return callback(err)

        launch(this.target.url, {
          // TODO (browser-launcher): allow passing in exact browser
          browser: this.manifest.name,
          version: this.manifest.version,
          ...this.manifest.options
        }, (err, instance) => {
          if (err) return callback(err)

          this[kInstance] = instance
          this[kInstance].process.once('exit', this[kOnExit])

          callback()
        })
      })
    })
  }

  [kOnExit] (code) {
    // Some browsers exit immediately so we can't treat this as an error
    debug('process %o exited early with code %o', this.title, code)
    if (!this[kImage]) this[kInstance] = null
  }

  _close (callback) {
    if (!this[kInstance]) {
      return callback()
    }

    const instance = this[kInstance]
    const pid = instance.process.pid

    this[kInstance] = null
    instance.process.removeListener('exit', this[kOnExit])

    if (this[kImage]) {
      // For browsers that spawn or take over another process and then kill
      // themselves, find running processes by image name, exclude those that
      // were already running before open(), and then kill them.
      // TODO: move this fix to browser-launcher
      imagePids(this[kImage], (err, pids) => {
        if (err) return callback(err)

        pids = pids.filter(pid => {
          return !this[kPriorPids].includes(pid)
        })

        if (!pids.length) {
          return callback()
        }

        const switches = pids.map(pid => `/pid ${pid}`)
        const command = `taskkill /T /F ${switches.join(' ')}`

        exec(command, ignoreResult(callback))
      })
    } else if (process.platform === 'win32' && this.manifest.name === 'msedge' && pid) {
      // Without this, Edge sometimes takes 1 minute to exit for some reason
      // TODO: move this fix to browser-launcher (maybe even for all browsers)
      exec(`taskkill /T /F /pid ${pid}`, ignoreResult(callback))
    } else {
      instance.stop(callback)
    }
  }
}

function hasXvfb () {
  if (process.platform === 'win32') return false
  if (!which.sync('Xvfb', { nothrow: true })) return false

  return true
}

function imagePids (image, callback) {
  if (!image) {
    return process.nextTick(callback, null, [])
  }

  tasklist().then((list) => {
    const pids = list
      .filter(task => task.imageName === image)
      .map(task => task.pid)
      .filter(Boolean)

    process.nextTick(callback, null, pids)
  }).catch((err) => {
    process.nextTick(callback, err)
  })
}

function ignoreResult (callback) {
  return function () {
    callback()
  }
}

function getImage (name) {
  if (process.platform !== 'win32') return
  if (name === 'ie') return 'iexplore.exe'
  if (name === 'opera') return 'opera.exe'
  if (name === 'firefox') return 'firefox.exe'
}

module.exports = SystemProvider
