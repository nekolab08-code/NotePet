const fs = require('fs')

function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp'
  return new Promise((resolve, reject) => {
    try {
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
      fs.renameSync(tmp, filePath)
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

function createWriteQueue(filePath) {
  let chain = Promise.resolve()

  function enqueue(data) {
    chain = chain.then(() => atomicWrite(filePath, data))
    return chain
  }

  // drain() awaits all pending writes — call before app.quit()
  function drain() { return chain }

  return { enqueue, drain }
}

module.exports = { createWriteQueue, atomicWrite }
