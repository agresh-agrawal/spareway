// One shared packing worker (Comlink). Where Workers don't exist (tests, very old browsers) the engine runs
// on the main thread instead — same code, same result.
import { wrap, type Remote } from 'comlink'
import type { PackContainer, PackItem, PackOptions, PackResult, Placement } from '@/types/domain'
import type { PackerWorkerApi } from './packer.worker'

export interface Packer {
  pack: (container: PackContainer, items: PackItem[], options?: PackOptions) => Promise<PackResult>
  fitAdditional: (container: PackContainer, fixed: Placement[], items: PackItem[], options?: PackOptions) => Promise<PackResult>
}

let instance: Packer | null = null

function inThread(): Packer {
  const engine = () => import('../engine')
  return {
    pack: async (c, i, o) => (await engine()).pack(c, i, o),
    fitAdditional: async (c, f, i, o) => (await engine()).fitAdditional(c, f, i, o),
  }
}

function inWorker(): Packer {
  const worker = new Worker(new URL('./packer.worker.ts', import.meta.url), { type: 'module' })
  const remote: Remote<PackerWorkerApi> = wrap<PackerWorkerApi>(worker)
  const fallback = inThread()
  // if the worker can't start (blocked, failed to load), pack on the main thread
  let broken = false
  const failed = new Promise<never>((_, reject) =>
    worker.addEventListener(
      'error',
      (e) => {
        broken = true
        reject(e)
      },
      { once: true },
    ),
  )
  failed.catch(() => {})
  const safe = <T>(run: () => Promise<T>, local: () => Promise<T>): Promise<T> =>
    broken ? local() : Promise.race([run(), failed]).catch(local)
  return {
    pack: (c, i, o) => safe(() => remote.pack(c, i, o), () => fallback.pack(c, i, o)),
    fitAdditional: (c, f, i, o) => safe(() => remote.fitAdditional(c, f, i, o), () => fallback.fitAdditional(c, f, i, o)),
  }
}

export function getPacker(): Packer {
  if (!instance) instance = typeof Worker === 'undefined' ? inThread() : inWorker()
  return instance
}

/** Tests: swap in a fake packer (null → back to the default). */
export function setPacker(p: Packer | null) {
  instance = p
}
