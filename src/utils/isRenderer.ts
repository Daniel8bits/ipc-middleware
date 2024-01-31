
export function isRenderer () {
  // running in a web browser
  if (typeof process === 'undefined') return true

  // node-integration is disabled
  if (!process) return true

  // We're in node.js somehow
  if (!process.type) return false

  return process.type === 'renderer'

  /*
  try {
    return process.type !== 'renderer'
  } catch(e) {
    return true
  }
  return false
  */
  //return window.api !== undefined
  //return window.process !== undefined && window.process.type === 'renderer'
  //return middlewareConfig.renderer //typeof window !== 'undefined' && window.process && window.process.type === 'renderer'
}

export function isMain () {
  return !isRenderer()
  //return window.api === undefined
  //return window.process === undefined
  //return window.process.type === 'browser'
  //return !middlewareConfig.renderer //!(typeof window !== 'undefined' && window.process && window.process.type === 'renderer')
}

