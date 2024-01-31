import type { ElectronAPI } from '@electron-toolkit/preload'

export interface IpcConfigType {
  rendererElectron: ElectronAPI | undefined
}

export const config: IpcConfigType = {
  rendererElectron: undefined
}

export default function IpcConfig(cfg: IpcConfigType) {
  config.rendererElectron = cfg.rendererElectron
}
