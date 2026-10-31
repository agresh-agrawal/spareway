/** Small isometric box of the truck's inside size (length scaled against a 32 ft container). */
export function BoxPreview({ lengthCm, widthCm, heightCm }: { lengthCm: number; widthCm: number; heightCm: number }) {
  const ok = [lengthCm, widthCm, heightCm].every((v) => Number.isFinite(v) && v > 0)
  const max = 1000
  const L = ok ? Math.min(1, lengthCm / max) * 180 + 20 : 120
  const W = ok ? Math.min(1, widthCm / 300) * 60 + 10 : 50
  const H = ok ? Math.min(1, heightCm / 300) * 70 + 10 : 55
  const dx = W * 0.6
  const dy = W * 0.35
  const x0 = 10
  const y0 = 20 + dy
  const front = `${x0},${y0 + H} ${x0 + L},${y0 + H} ${x0 + L},${y0} ${x0},${y0}`
  const top = `${x0},${y0} ${x0 + dx},${y0 - dy} ${x0 + L + dx},${y0 - dy} ${x0 + L},${y0}`
  const side = `${x0 + L},${y0} ${x0 + L + dx},${y0 - dy} ${x0 + L + dx},${y0 + H - dy} ${x0 + L},${y0 + H}`
  return (
    <svg viewBox={`0 0 ${L + dx + 20} ${H + dy + 40}`} className="h-24 w-full" aria-hidden>
      <polygon points={top} fill="rgb(227 245 140 / 0.10)" stroke="#6b6b73" strokeWidth="1.5" />
      <polygon points={side} fill="rgb(227 245 140 / 0.06)" stroke="#6b6b73" strokeWidth="1.5" />
      <polygon points={front} fill="rgb(227 245 140 / 0.14)" stroke="#e3f58c" strokeWidth="1.5" />
      {/* cab */}
      <rect x={x0 - 8} y={y0 + H * 0.35} width="8" height={H * 0.65} rx="2" fill="#232327" stroke="#6b6b73" />
    </svg>
  )
}
