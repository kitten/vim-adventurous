#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const stream = require('stream')
const Color = require('goethe').default
const diff = require('color-diff')
const byline = require('byline')
const x256 = require('x256')

function colorToDiff(c) {
  const res = c.toRGB()

  return { R: res.r, G: res.g, B: res.b }
}

function diffToColor(c) {
  return Color({ r: c.R, g: c.G, b: c.B })
}

const palette = [
  Color('#F8F8F2'), // Normal
  Color('#191B1F'), // Darkness
  Color('#404449'), // Ghostly
  Color('#F5BB12'), // Jake The Dog
  Color('#FFC620'), // Rawr
  Color('#D3422E'), // Peppermint Butler
  Color('#4BAE16'), // Finn's Bag
  Color('#7fd6fa'), // Ice King
  Color('#277BD3'), // Finn The Human
  Color('#f25a55'), // Heartbreaker
  Color('#de347a'), // Princess Bubblegum
  Color('#3299CC'), // Adventure Time
  Color('#8abeb7'), // Cyan
].map(colorToDiff)

function findSimilarInPalette(c) {
  const base = colorToDiff(c)

  const aprox = diff.closest(base, palette)

  return diffToColor(aprox)
}

function colorToTerm(c) {
  return x256(...c.rgbArray())
}

function termToColor(code) {
  if (typeof code !== 'number') {
    code = parseInt(code)
  }

  return Color(x256.colors[code])
}

function transform(str) {
  const [ key, val ] = str.split('=')

  if (key === 'gui' || key === 'cterm' || val === 'NONE') {
    return str
  }

  const isCTerm = key.startsWith('cterm')

  let color
  if (isCTerm) {
    color = termToColor(val)
  } else {
    color = Color(val)
  }

  if (!color) {
    return str
  }

  const aprox = findSimilarInPalette(color)

  let newVal
  if (isCTerm) {
    newVal = colorToTerm(aprox)
  } else {
    newVal = aprox.toString('hex')
  }

  return key + '=' + newVal
}

class TransformColors extends stream.Transform {
  constructor(opts) {
    super(opts)

    this.lastLineComment = true
    this.lastLineHi = true
  }

  _transform(chunk, enc, cb) {
    const str = chunk.toString()

    const _lastLineComment = this.lastLineComment
    this.lastLineComment = str.startsWith('"')

    const _lastLineHi = this.lastLineHi
    this.lastLineHi = str.startsWith('hi ')

    if (str.startsWith('hi ')) {
      const parsed = str.split(' ')
      const name = parsed[1]

      const rest = parsed
        .slice(2)
        .map(x => x.replace(/(\n|\s+)/, ''))
        .map(transform)

      this.push([
        (this.lastLineHi && !_lastLineHi) ? '\nhi' : 'hi',
        name,
        ...rest
      ].join(' ') + '\n')

      return cb()
    } else if (this.lastLineComment && !_lastLineComment) {
      this.push('\n' + str + '\n')
      return cb()
    }

    this.push(str + '\n')
    return cb()
  }
}

const draculaSyntax = byline.createStream(
  fs.createReadStream(path.join(__dirname, 'template.vim'))
)

const adventurousSyntax = fs.createWriteStream(
  path.join(__dirname, '../colors/adventurous.vim')
)

draculaSyntax
  .pipe(new TransformColors())
  .pipe(adventurousSyntax)

