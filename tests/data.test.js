const fs = require('fs')
const os = require('os')
const path = require('path')

const { validateSchema, createDefault, clampPosition, loadNotes } = require('../src/data')

// --- createDefault ---
test('createDefault returns schemaVersion 1', () => {
  const d = createDefault()
  expect(d.schemaVersion).toBe(1)
})

test('createDefault sets petPosition to null (position computed at runtime)', () => {
  const d = createDefault()
  expect(d.petPosition).toEqual({ x: null, y: null })
})

test('createDefault has empty notes and tags arrays', () => {
  const d = createDefault()
  expect(d.notes).toEqual([])
  expect(d.tags).toEqual([])
})

// --- validateSchema ---
test('validateSchema passes for version 1', () => {
  expect(() => validateSchema({ schemaVersion: 1 })).not.toThrow()
})

test('validateSchema throws for version 2', () => {
  expect(() => validateSchema({ schemaVersion: 2 })).toThrow('Unsupported schema version')
})

test('validateSchema throws when schemaVersion missing', () => {
  expect(() => validateSchema({})).toThrow('Unsupported schema version')
})

// --- clampPosition ---
test('clampPosition clamps x below minimum margin', () => {
  const result = clampPosition({ x: 5, y: 100 }, 1920, 1080)
  expect(result.x).toBe(20)
})

test('clampPosition clamps x above maximum (screenWidth - petSize - margin)', () => {
  const result = clampPosition({ x: 2000, y: 100 }, 1920, 1080)
  expect(result.x).toBe(1920 - 80 - 20)
})

test('clampPosition passes through in-bounds position unchanged', () => {
  const result = clampPosition({ x: 500, y: 400 }, 1920, 1080)
  expect(result).toEqual({ x: 500, y: 400 })
})

// --- loadNotes: schema error propagates ---
test('loadNotes throws when schemaVersion is invalid', () => {
  const tmpPath = path.join(os.tmpdir(), `notepet-schema-test-${Date.now()}.json`)
  fs.writeFileSync(tmpPath, JSON.stringify({ schemaVersion: 99, notes: [], tags: [] }))
  expect(() => loadNotes(tmpPath)).toThrow('Unsupported schema version')
  fs.unlinkSync(tmpPath)
})
