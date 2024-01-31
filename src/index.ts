import IM from './IpcMain'
import IR from './IpcRenderer'
import IC from './IpcConfig'
import IU from './IpcUtils'

export const IpcMain = IM
export const IpcRenderer = IR
export const IpcConfig = IC
export const IpcUtils = IU

export type {
  IpcMainMiddlewareConfig,
  IpcMainMiddlewareRequest,
  IpcMainSenderReturn
} from './IpcMain'

export type {
  IpcEventConstraints,
  IpcRendererMiddlewareConfig,
  IpcRendererMiddlewareRequest,
  IpcRendererSenderReturn
} from './IpcRenderer'

export type {
  IpcConfigType
} from './IpcConfig'