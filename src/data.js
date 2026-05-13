const fs = require('fs')
const path = require('path')

const DEFAULT_DATA_PATH = path.join(__dirname, '..', 'data', 'notes.json')
const DATA_DIR = path.join(__dirname, '..', 'data')

function createDefault() {
  return {
    schemaVersion: 1,
    petImage: 'assets/default-pet.png',
    petPosition: { x: null, y: null },
    notes: [],
    tags: [],
  }
}

function validateSchema(data) {
  if (data.schemaVersion !== 1) {
    throw new Error('Unsupported schema version: ' + data.schemaVersion)
  }
}

function loadNotes(dataPath) {
  const filePath = dataPath || DEFAULT_DATA_PATH
  if (!fs.existsSync(filePath)) {
    const def = createDefault()
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(def, null, 2))
    return def
  }
  const raw = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(raw)
  validateSchema(data)
  return data
}

function clampPosition(pos, screenWidth, screenHeight) {
  const margin = 20
  const petSize = 80
  return {
    x: Math.min(Math.max(pos.x, margin), screenWidth - petSize - margin),
    y: Math.min(Math.max(pos.y, margin), screenHeight - petSize - margin),
  }
}

module.exports = { createDefault, validateSchema, loadNotes, clampPosition }
