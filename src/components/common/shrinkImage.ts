// Photo → JPEG, longest side ≤ 1280 px and ≤ 700 KB, before it is uploaded (proof photos, weighbridge slips).
const MAX_SIDE = 1280
const MAX_BYTES = 700 * 1024

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', q))

export async function shrinkImage(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  let w = Math.round(bmp.width * s)
  let h = Math.round(bmp.height * s)
  const canvas = document.createElement('canvas')
  let blob: Blob | null = null
  for (let round = 0; round < 6 && !(blob && blob.size <= MAX_BYTES); round++) {
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
    for (const q of [0.85, 0.7, 0.55]) {
      blob = await toBlob(canvas, q)
      if (blob.size <= MAX_BYTES) break
    }
    w = Math.round(w * 0.8)
    h = Math.round(h * 0.8)
  }
  bmp.close()
  if (!blob || blob.size > MAX_BYTES) throw new Error('TOO_LARGE')
  return blob
}
