const fs = require('fs')
const path = require('path')
const os = require('os')

const { createWriteQueue, atomicWrite } = require('../src/writeQueue')

test('atomicWrite creates the target file with correct content', async () => {
  const tmpFile = path.join(os.tmpdir(), `notepet-aw-${Date.now()}.json`)
  await atomicWrite(tmpFile, { hello: 'world' })
  const result = JSON.parse(fs.readFileSync(tmpFile, 'utf8'))
  expect(result.hello).toBe('world')
  fs.unlinkSync(tmpFile)
})

test('atomicWrite does not leave a .tmp file after success', async () => {
  const tmpFile = path.join(os.tmpdir(), `notepet-aw2-${Date.now()}.json`)
  await atomicWrite(tmpFile, { v: 1 })
  expect(fs.existsSync(tmpFile + '.tmp')).toBe(false)
  fs.unlinkSync(tmpFile)
})

test('write queue serialises concurrent writes — last value wins', async () => {
  const tmpFile = path.join(os.tmpdir(), `notepet-q-${Date.now()}.json`)
  const queue = createWriteQueue(tmpFile)

  await Promise.all([
    queue.enqueue({ value: 1 }),
    queue.enqueue({ value: 2 }),
    queue.enqueue({ value: 3 }),
  ])

  const result = JSON.parse(fs.readFileSync(tmpFile, 'utf8'))
  expect(result.value).toBe(3)
  fs.unlinkSync(tmpFile)
})
