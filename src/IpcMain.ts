
import type Electron from 'electron'
import {isRenderer, isMain} from './utils/isRenderer'
import {nameFormat} from './utils/nameFormat'
import {config as ipcConfig} from './IpcConfig'

const electronMain: {
  ipcMain?: Electron.IpcMain
} = {};

(async () => {
  if (isMain()) {
    const electronMainModule = await import('electron')
    electronMain.ipcMain = electronMainModule.ipcMain
  }
})()

const ipcMainProperties = {
  targets: new Set(),
  methods: new Map<Function, string>(),
  senderTargets: new Set(),
  senderMethods: new Map<Function, string>(),
  dependencies: new Map<Function, Map<string, () => Promise<any>>>()
}

export interface IpcMainMiddlewareConfig {
  once?: boolean
  before?: () => void
  after?: () => void
  during?: (...params: never[]) => never
  clean?: Function[]
}

function Receiver<T>(Target: new () => T): {[key in keyof T]: (config?: IpcMainMiddlewareConfig) => Promise<void>} {
  if (isRenderer()) return undefined as unknown as {[key in keyof T]: (config?: IpcMainMiddlewareConfig) => Promise<void>}

  const target = new Target();
  ipcMainProperties.targets.add(target)

  const middlewaredObject: Record<string, Function> = {}

  // DEPENDENCY INJECTION
  Object.keys(target as Object)
    .forEach(key => {
      const member = target[key]
      if (typeof member !== 'undefined') return

      const depsKey = [...ipcMainProperties.dependencies.keys()].find(obj => obj.constructor === Target)

      if (!depsKey) return

      const deps = ipcMainProperties.dependencies.get(depsKey)

      if (deps) {
        const dependency = [...deps].find((dep) => dep[0] === key)?.[1]
        if (!dependency) return
        dependency().then(v => target[key] = v)
      }
    })

  // CONTROLLER GENERATION
  Object.getOwnPropertyNames(Object.getPrototypeOf(target))
    .forEach(name => {
      if (name === 'constructor') return
      const method = target[name]
      const eventName = nameFormat(Target.name + ':' + name)
      ipcMainProperties.methods.set(method, eventName)
      middlewaredObject[`${name}`] = async (config?: IpcMainMiddlewareConfig) => {
        const {once, before, after, during, clean} = config ?? {}

        const {ipcMain} = await import('electron')

        ipcMain[once ? 'once' : 'on'](eventName, (event, ...params) => {
          before?.()
          method.call(target, {event, params, during})
          after?.()
          clean?.forEach(m => {
            const eventName = ipcMainProperties.methods.get(m)
            if (!eventName) return;
            ipcMain.removeAllListeners(eventName)
          })
        })
      }
    })

  return middlewaredObject as {[key in keyof T]: (config?: IpcMainMiddlewareConfig) => Promise<void>}
}

interface IpcMainMiddlewareRequest<T = undefined, F extends Function = (...params: never[]) => never> {
  params?: T
  during?: F
  event: Electron.IpcMainEvent
}

type IpcMainSenderType<T> = T extends undefined
  ? (event?: Electron.IpcRendererEvent) => void
  : (...args: [Electron.IpcRendererEvent, T] | [T]) => void

type IpcMainSenderReturn<T> = {[key in keyof T]: T[key] extends (arg: infer R) => void
  ? R extends undefined
    ? IpcMainSenderType<undefined>
    : IpcMainSenderType<R extends {params?: infer P} ? P : undefined>
  : never
}

/**
 * If called in the main will return undefined
 * @param Target
 * @returns
 */
function Sender<T>(Target: new () => T): IpcMainSenderReturn<T> {
  if (isMain()) return undefined as unknown as IpcMainSenderReturn<T>

  const target = new Target();
  ipcMainProperties.senderTargets.add(target)

  const middlewaredObject: Record<string, IpcMainSenderType<[]>> = {}

  Object.getOwnPropertyNames(Object.getPrototypeOf(target))
    .forEach(name => {
      if (name === 'constructor') return
      const method = target[name]
      const eventName = nameFormat(Target.name + ':' + name)
      ipcMainProperties.senderMethods.set(method, eventName)

      middlewaredObject[`${name}`] = (...args) => {
        const [maybeEvent, maybeParamsIfThereIsAnEvent] = args

        if (Array.isArray(maybeEvent)) {
          ipcConfig.rendererElectron?.ipcRenderer.send(eventName, ...maybeEvent)
          return
        }

        if (Array.isArray(maybeParamsIfThereIsAnEvent)) {
          (maybeEvent as Electron.IpcRendererEvent).sender.send(eventName, ...maybeParamsIfThereIsAnEvent)
          return
        }

        if (maybeEvent) {
          (maybeEvent as Electron.IpcRendererEvent).sender.send(eventName)
          return
        }

        ipcConfig.rendererElectron?.ipcRenderer.send(eventName)
      }
    })

  return middlewaredObject as unknown as IpcMainSenderReturn<T>
}

function Autowired<T>(module: () => Promise<T>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target, name) => {
    if (isRenderer()) return
    const deps = ipcMainProperties.dependencies.get(target)
    if(deps) {
      deps.set(name, module)
      return
    }
    ipcMainProperties.dependencies.set(target, new Map([[name, module]]))
  }
}

export default {
  Receiver,
  Sender,
  Autowired
}

export type {
  IpcMainMiddlewareRequest,
  IpcMainSenderReturn
}
