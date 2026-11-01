// Spareway email layout (same file in monthly-report/ and notify-email/). Table-based with inline styles only:
// Gmail and phone mail apps drop <style> and flexbox. Pure; tested with Vitest.

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const inr = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

export const C = {
  bg: '#f2f3ee',
  card: '#ffffff',
  ink: '#1a1d14',
  ink2: '#5b6052',
  line: '#e6e8e0',
  brand: '#9ccc2c',
  brandDark: '#5f8a0c',
  ok: '#2f7d1f',
  crit: '#c0392b',
  warn: '#b7791f',
}

/** Big numbers, two per row. `tone` colours the value. */
export function kpis(items: { label: string; value: string; sub?: string; tone?: 'ok' | 'crit' }[]): string {
  const cells = items.map(
    (k) => `<td width="50%" valign="top" style="padding:6px">
<div style="border:1px solid ${C.line};border-radius:12px;padding:12px">
<div style="font-size:13px;color:${C.ink2}">${esc(k.label)}</div>
<div style="font-size:22px;font-weight:700;color:${k.tone ? C[k.tone] : C.ink};margin-top:2px">${esc(k.value)}</div>
${k.sub ? `<div style="font-size:12px;color:${C.ink2};margin-top:2px">${esc(k.sub)}</div>` : ''}
</div></td>`,
  )
  const rows: string[] = []
  for (let i = 0; i < cells.length; i += 2) rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px -6px">${rows.join('')}</table>`
}

/** Horizontal bars (share of a total), e.g. where the money went. */
export function bars(items: { label: string; value: number; text: string; color?: string }[]): string {
  const max = Math.max(1, ...items.map((i) => i.value))
  return items
    .map((i) => {
      const pct = Math.max(2, Math.round((100 * Math.max(0, i.value)) / max))
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px">
<tr><td style="font-size:14px;color:${C.ink}">${esc(i.label)}</td><td align="right" style="font-size:14px;font-weight:700">${esc(i.text)}</td></tr>
<tr><td colspan="2" style="padding-top:4px"><div style="background:${C.line};border-radius:6px;height:10px"><div style="background:${i.color ?? C.brand};width:${pct}%;height:10px;border-radius:6px"></div></div></td></tr>
</table>`
    })
    .join('')
}

/** Simple table with a header row. Cells are escaped; column 0 left, the rest right. */
export function table(head: string[], rows: string[][]): string {
  const th = head
    .map((h, i) => `<th align="${i ? 'right' : 'left'}" style="font-size:12px;color:${C.ink2};font-weight:600;padding:6px 4px;border-bottom:1px solid ${C.line}">${esc(h)}</th>`)
    .join('')
  const tr = rows
    .map(
      (r) =>
        `<tr>${r.map((c, i) => `<td align="${i ? 'right' : 'left'}" style="font-size:14px;padding:8px 4px;border-bottom:1px solid ${C.line}${i ? ';font-weight:600' : ''}">${esc(c)}</td>`).join('')}</tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${th ? `<tr>${th}</tr>` : ''}${tr}</table>`
}

export const h2 = (s: string) => `<p style="font-size:17px;font-weight:700;margin:22px 0 8px;color:${C.ink}">${esc(s)}</p>`
export const p = (s: string, color = C.ink2) => `<p style="font-size:15px;line-height:22px;margin:0 0 8px;color:${color}">${esc(s)}</p>`
export const button = (href: string, label: string) =>
  `<p style="margin:22px 0 4px"><a href="${esc(href)}" style="display:inline-block;background:${C.brand};color:${C.ink};text-decoration:none;font-weight:700;font-size:16px;padding:13px 22px;border-radius:12px">${esc(label)}</a></p>`

/** The page: hidden preheader, brand band, white card with the body, small footer. `body` is trusted HTML. */
export function layout(o: { lang: 'en' | 'hi'; preheader: string; company: string; title: string; body: string; footer: string }): string {
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Arial,Helvetica,sans-serif;color:${C.ink}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">
<tr><td style="background:${C.ink};border-radius:16px 16px 0 0;padding:18px 20px">
<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${C.brand};margin-right:8px"></span>
<span style="font-size:18px;font-weight:700;color:#ffffff">Spareway</span>
<span style="font-size:14px;color:#c9cdbf"> · ${esc(o.company)}</span>
<div style="font-size:22px;font-weight:700;color:#ffffff;margin-top:10px">${esc(o.title)}</div>
</td></tr>
<tr><td style="background:${C.card};border-radius:0 0 16px 16px;padding:20px">${o.body}</td></tr>
<tr><td style="padding:14px 6px;font-size:12px;line-height:18px;color:#7a7f70">${esc(o.footer)}</td></tr>
</table></td></tr></table></body></html>`
}
