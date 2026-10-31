// Photo → JPEG ≤ 1280 px and ≤ 700 KB before upload (Architecture F17).
import { fitSize } from './validate'

export const MAX_BYTES = 700 * 1024

export interface PhotoIn {
  base64: string
  mime: 'image/jpeg'
  /** object URL for the thumbnail — revoke when removed */
  url: string
  bytes: number
}

function toBlob(canvas: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', q))
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).replace(/^data:[^,]+,/, ''))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}

export async function compressPhoto(file: Blob): Promise<PhotoIn> {
  const bmp = await createImageBitmap(file)
  let { w, h } = fitSize(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  let blob: Blob | null = null
  for (let round = 0; round < 6; round++) {
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
    for (const q of [0.85, 0.75, 0.65, 0.55]) {
      blob = await toBlob(canvas, q)
      if (blob.size <= MAX_BYTES) break
    }
    if (blob && blob.size <= MAX_BYTES) break
    w = Math.round(w * 0.8)
    h = Math.round(h * 0.8)
  }
  bmp.close()
  if (!blob || blob.size > MAX_BYTES) throw new Error('TOO_LARGE')
  return { base64: await toBase64(blob), mime: 'image/jpeg', url: URL.createObjectURL(blob), bytes: blob.size }
}
