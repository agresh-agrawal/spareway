// Web Worker: runs the packing engine off the main thread so the UI never blocks.
import { expose } from 'comlink'
import { fitAdditional, pack } from '../engine'

const api = { pack, fitAdditional }
export type PackerWorkerApi = typeof api

expose(api)
