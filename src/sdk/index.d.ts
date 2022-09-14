declare interface InitOptions {
  host?: string
  port?: number
  uin?: number
  title?: string
  protocol?: 'wss:' | 'ws:'
}

export declare const version: string
export declare function init(opts: InitOptions): void
export declare function debug(script: string, url?: string): void
export declare function debugSrc(scriptSrc: string): void
export declare function debugCache(check: boolean | ((url: string) => boolean)): void
export declare function getId(): string

declare const RemoteDevSdk: {
  version: typeof version
  init: typeof init
  debug: typeof debug
  debugSrc: typeof debugSrc
  debugCache: typeof debugCache
  getId: typeof getId
}

export default RemoteDevSdk

declare global {
  interface Window {
    RemoteDevSdk: typeof RemoteDevSdk
  }
}
