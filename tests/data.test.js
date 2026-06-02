const fs = require('fs')
const os = require('os')
const path = require('path')

const { validateSchema, createDefault, clampPosition, loadNotes, normalizePetCharacters } = require('../src/data')

// --- createDefault ---
test('createDefault returns schemaVersion 2', () => {
  const d = createDefault()
  expect(d.schemaVersion).toBe(2)
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

test('createDefault includes default pet plus two custom character slots', () => {
  const d = createDefault()
  expect(d.activePetCharacterId).toBe('default')
  expect(d.petCharacters).toHaveLength(3)
  expect(d.petCharacters.map(c => c.id)).toEqual(['default', 'custom-1', 'custom-2'])
  expect(d.petCharacters[0].idle).toBe('assets/default-pet.png')
  expect(d.petCharacters[0].pick).toBe('assets/pinch-pet.png')
})

// --- validateSchema ---
test('validateSchema migrates v1 file to v2 via loadNotes', () => {
  const tmpPath = path.join(os.tmpdir(), `notepet-v1-test-${Date.now()}.json`)
  fs.writeFileSync(tmpPath, JSON.stringify({ schemaVersion: 1, notes: [], tags: [] }))
  const result = loadNotes(tmpPath)
  expect(result.schemaVersion).toBe(2)
  const written = JSON.parse(fs.readFileSync(tmpPath, 'utf8'))
  expect(written.schemaVersion).toBe(2)
  fs.unlinkSync(tmpPath)
})

test('validateSchema throws for unknown version', () => {
  expect(() => validateSchema({ schemaVersion: 99 })).toThrow('Unsupported schema version')
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

test('normalizePetCharacters migrates legacy petImage into default idle state', () => {
  const data = normalizePetCharacters({
    schemaVersion: 1,
    petImage: 'assets/user/legacy.png',
    notes: [],
    tags: [],
  })

  expect(data.activePetCharacterId).toBe('default')
  expect(data.petCharacters).toHaveLength(3)
  expect(data.petCharacters[0].idle).toBe('assets/user/legacy.png')
  expect(data.petCharacters[0].pick).toBe('assets/pinch-pet.png')
  expect(data.petImage).toBe('assets/user/legacy.png')
})
