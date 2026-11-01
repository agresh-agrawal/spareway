// notify-email — pure parts: one digest email for the important changes since the last one (en / hi).
// The words mirror the app's common:templates so the email reads like the bell. Tested with Vitest.
import { button, C, esc, layout, p } from './email.ts'

export interface Notice {
  kind: string
  severity: string
  title: string
  meta: Record<string, unknown>
  link: string
  createdAt: string
}

type Lang = 'en' | 'hi'

const T: Record<Lang, Record<string, string>> = {
  en: {
    loader_issue: 'Loader reported a problem — {{code}} · step {{step}}: {{note}}',
    loader_cargo: 'Loader added cargo — {{code}}: {{count}} items. Re-plan the load.',
    driver_challan: 'Driver paid {{kind}} ₹{{amount}} — {{code}} {{note}}',
    driver_stop: 'Driver delivered at {{stop}} — {{code}}',
    provider_load: '{{name}} sent {{count}} new load(s) — see Loads',
    offer_answer: 'Your offer for {{code}} (₹{{amount}}) was answered',
    trip_started: '{{code}} has left — trip started',
    trip_done: '{{code}} finished — see the earnings',
    trip_cancelled: '{{code}} was cancelled',
  },
  hi: {
    loader_issue: 'लोडर ने समस्या बताई — {{code}} · स्टेप {{step}}: {{note}}',
    loader_cargo: 'लोडर ने सामान जोड़ा — {{code}}: {{count}} सामान। लोड फिर से प्लान करें।',
    driver_challan: 'ड्राइवर ने {{kind}} ₹{{amount}} दिया — {{code}} {{note}}',
    driver_stop: 'ड्राइवर ने {{stop}} पर माल दे दिया — {{code}}',
    provider_load: '{{name}} ने {{count}} नए लोड भेजे — लोड पेज देखें',
    offer_answer: '{{code}} के लिए आपके ऑफ़र (₹{{amount}}) का जवाब आया',
    trip_started: '{{code}} निकल गई — ट्रिप शुरू',
    trip_done: '{{code}} पूरी हुई — कमाई देखें',
    trip_cancelled: '{{code}} रद्द हो गई',
  },
}

const KINDS: Record<Lang, Record<string, string>> = {
  en: { challan: 'challan', breakdown: 'breakdown', police: 'police', parking: 'parking', loading: 'loading', other: 'other cost' },
  hi: { challan: 'चालान', breakdown: 'खराबी', police: 'पुलिस', parking: 'पार्किंग', loading: 'लोडिंग', other: 'दूसरा खर्च' },
}

const W = {
  en: {
    subject: (n: number, first: string) => (n === 1 ? `Spareway: ${first}` : `Spareway: ${n} important updates`),
    title: (n: number) => (n === 1 ? '1 important update' : `${n} important updates`),
    hello: (name: string) => (name ? `Namaste ${name},` : 'Namaste,'),
    intro: 'This just happened on your trucks:',
    open: 'Open',
    openApp: 'Open Spareway',
    footer: 'You get these emails for problems, challans, finished or cancelled trips, new loads and offer answers — at most one every 10 minutes. Turn them off in Settings → Email me important changes.',
  },
  hi: {
    subject: (n: number, first: string) => (n === 1 ? `Spareway: ${first}` : `Spareway: ${n} ज़रूरी अपडेट`),
    title: (n: number) => (n === 1 ? '1 ज़रूरी अपडेट' : `${n} ज़रूरी अपडेट`),
    hello: (name: string) => (name ? `नमस्ते ${name},` : 'नमस्ते,'),
    intro: 'आपके ट्रकों पर अभी यह हुआ:',
    open: 'खोलें',
    openApp: 'Spareway खोलें',
    footer: 'समस्या, चालान, पूरी या रद्द ट्रिप, नए लोड और ऑफ़र के जवाब पर यह ईमेल आता है — 10 मिनट में ज़्यादा से ज़्यादा एक। सेटिंग → ज़रूरी बदलाव ईमेल पर से बंद करें।',
  },
}

/** Notice text in the owner's language; unknown kinds fall back to the stored English title. */
export function noticeText(n: Notice, lang: Lang): string {
  const tpl = T[lang][n.kind]
  if (!tpl) return n.title
  const meta = { ...n.meta } as Record<string, unknown>
  if (n.kind === 'driver_challan' && typeof meta.kind === 'string') meta.kind = KINDS[lang][meta.kind] ?? meta.kind
  if (typeof meta.amount === 'number') meta.amount = Math.round(meta.amount).toLocaleString('en-IN')
  return tpl
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => (meta[k] === undefined || meta[k] === null ? '' : String(meta[k])))
    .replace(/\s+/g, ' ')
    .trim()
}

const time = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })

/** One email for several notices, newest first. */
export function renderDigest(list: Notice[], lang: Lang, ownerName: string, company: string, appUrl: string): { subject: string; html: string } {
  const w = W[lang]
  const items = list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const rows = items
    .map((n) => {
      const color = n.severity === 'critical' ? C.crit : n.severity === 'warning' ? C.warn : C.brandDark
      const href = `${appUrl}${n.link || '/'}`
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;border:1px solid ${C.line};border-left:4px solid ${color};border-radius:10px">
<tr><td style="padding:10px 12px">
<div style="font-size:15px;line-height:21px;font-weight:600;color:${C.ink}">${esc(noticeText(n, lang))}</div>
<div style="font-size:12px;color:${C.ink2};margin-top:4px">${esc(time(n.createdAt, lang))} · <a href="${esc(href)}" style="color:${C.brandDark};font-weight:700">${esc(w.open)}</a></div>
</td></tr></table>`
    })
    .join('')
  const body = `${p(w.hello(ownerName), C.ink)}${p(w.intro)}${rows}${button(appUrl, w.openApp)}`
  const first = items[0] ? noticeText(items[0], lang) : ''
  return {
    subject: w.subject(items.length, first.length > 80 ? `${first.slice(0, 77)}…` : first),
    html: layout({ lang, preheader: first, company, title: w.title(items.length), body, footer: w.footer }),
  }
}
