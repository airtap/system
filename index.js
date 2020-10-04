'use strict'

const Provider = require('browser-provider')
const Browser = require('abstract-browser')
const names = require('browser-names')
const debug = require('debug')('airtap-system')
const launcher = require('the-last-browser-launcher')
const tasklist = require('tasklist')
const exec = require('child_process').exec

const kProvider = Symbol('kProvider')
const kOnExit = Symbol('kOnExit')
const kInstance = Symbol('kInstance')
const kImage = Symbol('kImage')
const kPriorPids = Symbol('kPriorPids')

// TODO (browser-launcher): disable update check on FF
class SystemProvider extends Provider {
  _manifests (callback) {
    launcher.detect((err, manifests) => {
      if (err) return callback(err)

      manifests = manifests.map(function (manifest) {
        const title = names.title(manifest.name) || manifest.name
        const suffix = manifest.version ? ` ${manifest.version}` : ''

        manifest.title = `System ${title}${suffix}`

        if (getImage(manifest.name)) {
          // Can't run multiple processes if they're killed by image name
          // (and IE doesn't support it for additional, unknown reasons).
          manifest.supports.concurrency = false
        }

        return manifest
      })

      callback(null, manifests)
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

      launcher.launch(this.manifest, this.target.url, (err, instance) => {
        if (err) return callback(err)

        this[kInstance] = instance
        this[kInstance].process.once('exit', this[kOnExit])

        callback()
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

  unref () {
    if (this[kInstance]) this[kInstance].unref()
  }
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
