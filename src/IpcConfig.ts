import type { ElectronAPI } from '@electron-toolkit/preload'

interface IpcConfigType {
  rendererElectron: ElectronAPI | undefined
}

export const config: IpcConfigType = {
  rendererElectron: undefined
}

export function IpcConfig(cfg: IpcConfigType) {
  config.rendererElectron = cfg.rendererElectron
}
