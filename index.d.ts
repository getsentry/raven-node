/// <reference types="node" />

import { IncomingMessage, ServerResponse } from 'http'

declare namespace raven {
  export interface UserData {
    id: string
    handle?: string
  }

  interface CaptureCallback {
    (result: { string: any }): void
  }

  interface DataCallback {
    (data: { string: any }): void
  }

  interface TransportCallback {
    (options: { string: any }): void
  }

  export interface ConstructorOptions {
    logger?: string
    release?: string
    environment?: string
    tags?: { string: string }
    extra?: { string: any }
    dataCallback?: DataCallback
    transport?: TransportCallback
  }

  export interface CaptureOptions {
    tags?: { string: string }
    extra?: { string: any }
    fingerprint?: string
    level?: string
  }

  export class Client {
    constructor(options: ConstructorOptions)
    constructor(dsn: string, options?: ConstructorOptions)
    config(dsn: string): Client
    config(dsn: string, options?: ConstructorOptions): Client
    install(): void
    requestHandler(): (req: IncomingMessage, res: ServerResponse, next: () => void) => void
    errorHandler(): (e: Error, req: IncomingMessage, res: ServerResponse, next: () => void) => void
    captureException(error: Error, options?: CaptureOptions, cb?: CaptureCallback): void
    captureMessage(message: string, options?: CaptureOptions, cb?: CaptureCallback): void
    captureBreadcrumb(breadcrumb: any): void
    setUserContext(data: UserData): void
    setDataCallback(fn: DataCallback): void
  }
}

export = raven
