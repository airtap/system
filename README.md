# airtap-system

**[Browser provider](https://github.com/airtap/browser-provider) for locally installed browsers. List and run browsers on your machine. Supports Chrome, Chromium, Firefox, IE, Edge, Brave, Opera and Safari, on Linux, Mac & Windows, with cross-platform headless mode on Chromium, Chrome, Edge, Brave and Firefox.**

[![npm status](http://img.shields.io/npm/v/airtap-system.svg)](https://www.npmjs.org/package/airtap-system)
[![node](https://img.shields.io/node/v/airtap-system.svg)](https://www.npmjs.org/package/airtap-system)
[![Travis build status](https://img.shields.io/travis/com/airtap/system.svg?label=travis)](http://travis-ci.com/airtap/system)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Table of Contents

<details><summary>Click to expand</summary>

- [Usage](#usage)
  - [Programmatic](#programmatic)
  - [With Airtap](#with-airtap)
- [API](#api)
  - [`System()`](#system)
  - [Browser options](#browser-options)
- [Install](#install)
- [License](#license)

</details>

## Usage

### Programmatic

```js
const System = require('airtap-system')
const provider = new System()

// Get a list of desired browsers
const wanted = [{ name: 'firefox', version: 79 }]
const manifests = await provider.manifests(wanted)

// Instantiate a browser
const target = { url: 'http://localhost:3000' }
const browser = provider.browser(manifests[0], target)

await browser.open()
```

### With [Airtap](https://github.com/airtap/airtap)

```yaml
providers:
  - airtap-system

browsers:
  - name: firefox
    version: 79
  - name: chrome
```

This provider also exposes a [`supports`](https://github.com/airtap/browser-manifest#supports) property to match on:

```yaml
browsers:
  - name: chrome
    supports:
      headless: true
```

As well as a release `channel` and (Windows-only) `arch`:

```yaml
browsers:
  - name: chrome
    channel: beta
  - name: firefox
    channel: nightly
  - name: ie
    arch: i386
```

## API

### `System()`

Constructor. Returns an instance of [`browser-provider`](https://github.com/airtap/browser-provider).

### Browser options

- `headless` (boolean, default true if supported): run in headless mode.

In Airtap these can be set like so:

```yaml
browsers:
  - name: chrome
    options:
      headless: false
```

## Install

With [npm](https://npmjs.org) do:

```
npm install airtap-system
```

## License

[MIT](LICENSE) © 2020-present Airtap contributors
