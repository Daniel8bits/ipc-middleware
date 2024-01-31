import type {IpcRendererMiddlewareConfig} from './IpcRenderer'

type Receiver = (config?: IpcRendererMiddlewareConfig) => void

function any(receivers: Receiver[]) {
  const others = (rec: Receiver) => receivers.filter(r => r === rec)
  return {
    on: () => receivers.forEach(rec => rec({clean: others(rec)})),
    once: () => receivers.forEach(rec => rec({once: true, clean: others(rec)})),
  }
}

export default {any}
