const fs = require('fs')
const path = require('path')

const DEFAULT_DATA_PATH = path.join(__dirname, '..', 'data', 'notes.json')

function createDefault() {
  return {
    schemaVersion: 2,
    pet: { mood: 80, lastInteractAt: null },
    petImage: 'assets/default-pet.png',
    activePetCharacterId: 'default',
    petCharacters: [
      { id: 'default', name: '預設搭子', idle: 'assets/default-pet.png', pick: 'assets/pinch-pet.png', builtIn: true },
      { id: 'custom-1', name: '角色 1', idle: '', pick: '' },
      { id: 'custom-2', name: '角色 2', idle: '', pick: '' },
    ],
    petPosition: { x: null, y: null },
    notes: [],
    tags: [],
    settings: { fontSize: 14, fontFamily: 'Microsoft JhengHei', theme: 'default', timeFormat: '24', petOpacity: 1, panelSize: { width: 280, height: 360 }, panelPosition: null },
  }
}

function migrateV1toV2(data, filePath) {
  const def = createDefault()
  data.schemaVersion = 2
  data.pet = { mood: 80, lastInteractAt: null }
  if (!data.activePetCharacterId) data.activePetCharacterId = def.activePetCharacterId
  if (!Array.isArray(data.petCharacters)) data.petCharacters = def.petCharacters
  if (!data.settings) data.settings = def.settings
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

function validateSchema(data, filePath) {
  if (data.schemaVersion === 1) {
    migrateV1toV2(data, filePath)
    return
  }
  if (data.schemaVersion !== 2) {
    throw new Error('Unsupported schema version: ' + data.schemaVersion)
  }
}

function normalizePetCharacters(data) {
  const def = createDefault()
  const existing = Array.isArray(data.petCharacters) ? data.petCharacters : []
  const byId = new Map(existing.map(c => [c.id, c]))
  const defaultCharacter = byId.get('default') || {}
  const custom1 = byId.get('custom-1') || {}
  const custom2 = byId.get('custom-2') || {}

  data.petCharacters = [
    {
      ...def.petCharacters[0],
      ...defaultCharacter,
      idle: defaultCharacter.idle || data.petImage || def.petCharacters[0].idle,
      pick: defaultCharacter.pick || def.petCharacters[0].pick,
      builtIn: true,
    },
    { ...def.petCharacters[1], ...custom1 },
    { ...def.petCharacters[2], ...custom2 },
  ]

  if (!data.activePetCharacterId || !data.petCharacters.some(c => c.id === data.activePetCharacterId)) {
    data.activePetCharacterId = 'default'
  }

  const active = data.petCharacters.find(c => c.id === data.activePetCharacterId) || data.petCharacters[0]
  data.petImage = active.idle || def.petCharacters[0].idle
  return data
}

function loadNotes(dataPath) {
  const filePath = dataPath || DEFAULT_DATA_PATH
  if (!fs.existsSync(filePath)) {
    const def = createDefault()
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(def, null, 2))
    return def
  }
  const raw = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(raw)
  validateSchema(data, filePath)
  return normalizePetCharacters(data)
}

function clampPosition(pos, screenWidth, screenHeight) {
  const margin = 20
  const petSize = 80
  return {
    x: Math.min(Math.max(pos.x, margin), screenWidth - petSize - margin),
    y: Math.min(Math.max(pos.y, margin), screenHeight - petSize - margin),
  }
}

module.exports = { createDefault, validateSchema, loadNotes, clampPosition, normalizePetCharacters }
