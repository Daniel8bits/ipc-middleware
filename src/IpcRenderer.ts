
import type {IpcRendererEvent, IpcMainEvent, BrowserWindow} from 'electron'
import {isRenderer, isMain} from './utils/isRenderer'
import {nameFormat} from './utils/nameFormat'
import {config as ipcConfig} from './IpcConfig'

type Obj = Record<string, never>

const ipcRendererProperties = {
  targets: new Set(),
  methods: new Map<Function, string>(),
  senderTargets: new Set(),
  senderMethods: new Map<Function, string>(),
  windowMapping: new Map<Function, BrowserWindow>(),
  dependencies: new Map<Function, Map<string, () => Promise<any>>>()
}

interface IpcRendererMiddlewareConfig {
  once?: boolean
  before?: () => void
  after?: () => void
  during?: (...params: never[]) => never
  clean?: Function[]
}

function Receiver<T>(Target: new () => T): {[key in keyof T]: (config?: IpcRendererMiddlewareConfig) => void} {
  if (isMain()) return undefined as unknown as {[key in keyof T]: (config?: IpcRendererMiddlewareConfig) => void}

  const target = new Target();
  ipcRendererProperties.targets.add(target)

  const middlewaredObject: Record<string, Function> = {}

  // DEPENDENCY INJECTION
  Object.keys(target as Obj)
    .forEach(key => {
      const member = (target as Obj)[key]
      if (typeof member !== 'undefined') return

      const depsKey = [...ipcRendererProperties.dependencies.keys()].find(obj => obj.constructor === Target)

      if (!depsKey) return

      const deps = ipcRendererProperties.dependencies.get(depsKey)

      if (deps) {
        const dependency = [...deps].find((dep) => dep[0] === key)?.[1]
        if (!dependency) return
        dependency().then(v => (target as Obj)[key] = v as never)
      }
    })

  // CONTROLLER GENERATION
  Object.getOwnPropertyNames(Object.getPrototypeOf(target))
    .forEach(name => {
      if (name === 'constructor') return
      const method = (target as Obj)[name] as ((...args: any[]) => void)

      const eventName = nameFormat(Target.name + ':' + name)
      ipcRendererProperties.methods.set(method, eventName)

      middlewaredObject[`${name}`] = (config?: IpcRendererMiddlewareConfig) => {
        const {once, before, after, during, clean} = config ?? {}
        ipcConfig.rendererElectron?.ipcRenderer[once ? 'once' : 'on'](eventName, (event, ...params) => {
          before?.()
          method.call(target, {event, params, during})
          after?.()
          clean?.forEach(m => {
            const eventName = ipcRendererProperties.methods.get(m)
            if (!eventName) return;
            ipcConfig.rendererElectron?.ipcRenderer.removeAllListeners(eventName)
          })
        })
      }
    })

  return middlewaredObject as {[key in keyof T]: (config?: IpcRendererMiddlewareConfig) => void}
}

interface IpcRendererMiddlewareRequest<T = never[], F extends Function = (...params: never[]) => never> {
  params?: T
  during?: F
  event: IpcRendererEvent
}

/*
type IpcRendererSenderType =
  | ((event: IpcRendererEvent, params: never[]) => void)
  | ((params: never[]) => void)
*/

type IpcRendererSenderType<T> = T extends undefined
  ? (event?: IpcMainEvent) => void
  : (...args: [IpcMainEvent, T] | [T]) => void

type IpcRendererSenderReturn<T> = {[key in keyof T]: T[key] extends (arg: infer R) => void
  ? R extends undefined
    ? IpcRendererSenderType<undefined>
    : IpcRendererSenderType<R extends {params?: infer P} ? P : undefined>
  : never
}

  /**
   * If called in the renderer will return undefined
   * @param Target
   * @returns
   */
function Sender<T>(Target: new () => T): IpcRendererSenderReturn<T> {
  if (isRenderer()) return undefined as unknown as IpcRendererSenderReturn<T>

  const target = new Target();
  ipcRendererProperties.senderTargets.add(target)

  const middlewaredObject: Record<string, IpcRendererSenderType<[]>> = {}

  Object.getOwnPropertyNames(Object.getPrototypeOf(target))
    .forEach(name => {
      if (name === 'constructor') return
      const method = (target as Obj)[name]
      const eventName = nameFormat(Target.name + ':' + name)
      ipcRendererProperties.senderMethods.set(method, eventName)
      middlewaredObject[`${name}`] = (...args) => {
        const [maybeEvent, maybeParamsIfThereIsAnEvent] = args

        if (Array.isArray(maybeEvent)) {
          import('electron').then(module => {
            const {BrowserWindow} = module
            const window = ipcRendererProperties.windowMapping.get(method) ?? BrowserWindow.getAllWindows()[0]
            window.webContents.send(eventName, ...maybeEvent)
          })
          return
        }

        if (Array.isArray(maybeParamsIfThereIsAnEvent)) {
          (maybeEvent as IpcMainEvent).sender.send(eventName, ...maybeParamsIfThereIsAnEvent)
          return
        }

        if (maybeEvent) {
          (maybeEvent as IpcMainEvent).sender.send(eventName)
          return
        }

        import('electron').then(module => {
          const {BrowserWindow} = module
          const window = ipcRendererProperties.windowMapping.get(method) ?? BrowserWindow.getAllWindows()[0]
          window.webContents.send(eventName)
        })
      }
    })

  return middlewaredObject as unknown as IpcRendererSenderReturn<T>
}

interface IpcEventConstraints {
  window?: BrowserWindow | number
}

function Constraints(constraints: IpcEventConstraints) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return <T>(target: T, ctx: unknown) => {
    if (typeof target !== 'function') return target
    if (isRenderer()) return target
    const {window} = constraints

    if (window !== undefined) {
      import('electron').then(module => {
        if (typeof window === 'number') {
          if (window < 0) return
          ipcRendererProperties.windowMapping.set(target, module.BrowserWindow.getAllWindows()[window])
          return
        }
        ipcRendererProperties.windowMapping.set(target, window)
      })
    }

    return target
  }
}

function Autowired<T>(module: () => Promise<T>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: (() => Promise<any>), name: string) => {
    if (isMain()) return
    const deps = ipcRendererProperties.dependencies.get(target)
    if(deps) {
      deps.set(name, module)
      return
    }
    ipcRendererProperties.dependencies.set(target, new Map([[name, module]]))
  }
}

export default {
  Constraints,
  Receiver,
  Sender,
  Autowired
}

export type {
  IpcRendererMiddlewareRequest,
  IpcRendererMiddlewareConfig,
  IpcEventConstraints,
  IpcRendererSenderReturn
}
