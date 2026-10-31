// monthly-report — pure parts: the month's numbers, tips to cut costs, and the email (en / hi). Tested with Vitest.

export interface ReportTrip {
  code: string
  status: string
  completedAt: string | null
  km: number
  freightInr: number
  extraInr: number
  routeCostInr: number
  extraCostInr: number
  miscInr: number
  challanInr: number
  netInr: number
  /** % of the truck's space used by the active load plan (null = no plan) */
  spacePct: number | null
}

export interface MonthReport {
  month: string // YYYY-MM
  trips: number
  km: number
  revenueInr: number
  costInr: number
  netInr: number
  challanInr: number
  challanTrips: number
  otherCostInr: number
  avgSpacePct: number | null
  lossTrips: number
  lowMarginTrips: number
  costPerKmInr: number | null
  freightPerKmInr: number | null
  prevNetInr: number | null
  tips: Tip[]
}

export type Tip =
  | { code: 'CHALLANS'; inr: number; count: number }
  | { code: 'SPACE'; pct: number }
  | { code: 'LOSS'; count: number }
  | { code: 'LOW_MARGIN'; count: number; minPerKm: number }
  | { code: 'OTHER_COSTS'; inr: number }
  | { code: 'NO_TRIPS' }
  | { code: 'GOOD' }

/** Previous calendar month in India time, as YYYY-MM, and its UTC start / end. */
export function previousMonth(now: Date): { month: string; startIso: string; endIso: string } {
  const ist = new Date(now.getTime() + 330 * 60_000)
  const y = ist.getUTCMonth() === 0 ? ist.getUTCFullYear() - 1 : ist.getUTCFullYear()
  const m = ist.getUTCMonth() === 0 ? 12 : ist.getUTCMonth()
  return monthRange(`${y}-${String(m).padStart(2, '0')}`)
}

export function monthRange(month: string): { month: string; startIso: string; endIso: string } {
  const [y, m] = month.split('-').map(Number)
  const start = Date.UTC(y, m - 1, 1) - 330 * 60_000
  const end = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - 330 * 60_000
  return { month, startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() }
}

const round = (n: number) => Math.round(n)

/** Numbers for completed trips that finished in the month; tips from the same numbers. */
export function buildReport(month: string, trips: ReportTrip[], prevNetInr: number | null): MonthReport {
  const done = trips.filter((t) => t.status === 'completed')
  const sum = (f: (t: ReportTrip) => number) => done.reduce((a, t) => a + f(t), 0)
  const km = sum((t) => t.km)
  const revenue = sum((t) => t.freightInr + t.extraInr)
  const cost = sum((t) => t.routeCostInr + t.extraCostInr + t.miscInr)
  const challan = sum((t) => t.challanInr)
  const other = sum((t) => t.miscInr - t.challanInr)
  const spaces = done.map((t) => t.spacePct).filter((v): v is number => v !== null && Number.isFinite(v))
  const avgSpace = spaces.length ? round(spaces.reduce((a, v) => a + v, 0) / spaces.length) : null
  const loss = done.filter((t) => t.netInr < 0).length
  const low = done.filter((t) => t.netInr >= 0 && t.freightInr + t.extraInr > 0 && t.netInr < 0.05 * (t.freightInr + t.extraInr)).length
  const costPerKm = km > 0 ? Math.round((cost / km) * 10) / 10 : null
  const freightPerKm = km > 0 ? Math.round((revenue / km) * 10) / 10 : null

  const tips: Tip[] = []
  if (done.length === 0) tips.push({ code: 'NO_TRIPS' })
  if (challan > 0) tips.push({ code: 'CHALLANS', inr: round(challan), count: done.filter((t) => t.challanInr > 0).length })
  if (loss > 0) tips.push({ code: 'LOSS', count: loss })
  // quote at least the cost per km + 10 % to keep a margin
  if (low > 0 && costPerKm !== null) tips.push({ code: 'LOW_MARGIN', count: low, minPerKm: Math.ceil(costPerKm * 1.1) })
  if (avgSpace !== null && avgSpace < 70) tips.push({ code: 'SPACE', pct: avgSpace })
  if (other > 0 && revenue > 0 && other > 0.03 * revenue) tips.push({ code: 'OTHER_COSTS', inr: round(other) })
  if (done.length > 0 && tips.length === 0) tips.push({ code: 'GOOD' })

  return {
    month,
    trips: done.length,
    km: round(km),
    revenueInr: round(revenue),
    costInr: round(cost),
    netInr: round(sum((t) => t.netInr)),
    challanInr: round(challan),
    challanTrips: done.filter((t) => t.challanInr > 0).length,
    otherCostInr: round(other),
    avgSpacePct: avgSpace,
    lossTrips: loss,
    lowMarginTrips: low,
    costPerKmInr: costPerKm,
    freightPerKmInr: freightPerKm,
    prevNetInr,
    tips,
  }
}

type Lang = 'en' | 'hi'

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

const WORDS = {
  en: {
    subject: (m: string, net: string) => `Spareway report for ${m}: you earned ${net}`,
    hello: (name: string) => (name ? `Namaste ${name},` : 'Namaste,'),
    intro: (m: string) => `Here is how your trucks did in ${m}.`,
    trips: 'Trips done',
    km: 'Distance',
    revenue: 'Freight + extra loads',
    cost: 'All costs',
    net: 'Net earnings',
    challans: 'Challans paid',
    space: 'Average space used',
    perKm: 'Cost / freight per km',
    vsPrev: (d: string, up: boolean) => (up ? `${d} more than the month before` : `${d} less than the month before`),
    tipsTitle: 'How to cut costs next month',
    tip: {
      CHALLANS: (t: { inr: number; count: number }) => `${inr(t.inr)} went on challans in ${t.count} trip(s). Check the papers and the no-entry times in the Challan corner before each trip.`,
      SPACE: (t: { pct: number }) => `Trucks left about ${t.pct}% full. Add extra loads on the way from the Loads page to earn from the empty space.`,
      LOSS: (t: { count: number }) => `${t.count} trip(s) lost money. Open them in Trip history and check the freight against the route cost.`,
      LOW_MARGIN: (t: { count: number; minPerKm: number }) => `${t.count} trip(s) earned under 5%. Quote at least ₹${t.minPerKm} per km to keep a margin.`,
      OTHER_COSTS: (t: { inr: number }) => `${inr(t.inr)} went on breakdowns, police, parking and loading. Service trucks on time and plan halts at known stops.`,
      NO_TRIPS: () => 'No trips were finished this month.',
      GOOD: () => 'Good month — no challans, no loss-making trips and trucks well filled. Keep it up.',
    },
    open: 'Open Spareway',
    footer: 'You get this email on the 1st of every month. Sent by Spareway.',
  },
  hi: {
    subject: (m: string, net: string) => `${m} की Spareway रिपोर्ट: आपकी कमाई ${net}`,
    hello: (name: string) => (name ? `नमस्ते ${name},` : 'नमस्ते,'),
    intro: (m: string) => `${m} में आपके ट्रकों का हिसाब।`,
    trips: 'पूरी ट्रिप',
    km: 'दूरी',
    revenue: 'भाड़ा + अतिरिक्त लोड',
    cost: 'कुल खर्च',
    net: 'शुद्ध कमाई',
    challans: 'दिए गए चालान',
    space: 'औसत भरी जगह',
    perKm: 'प्रति km खर्च / भाड़ा',
    vsPrev: (d: string, up: boolean) => (up ? `पिछले महीने से ${d} ज़्यादा` : `पिछले महीने से ${d} कम`),
    tipsTitle: 'अगले महीने खर्च कैसे घटाएँ',
    tip: {
      CHALLANS: (t: { inr: number; count: number }) => `${t.count} ट्रिप में ${inr(t.inr)} चालान में गए। हर ट्रिप से पहले चालान कॉर्नर में कागज़ और नो-एंट्री का समय देख लें।`,
      SPACE: (t: { pct: number }) => `ट्रक लगभग ${t.pct}% ही भरे गए। लोड पेज से रास्ते के अतिरिक्त लोड जोड़कर खाली जगह से कमाएँ।`,
      LOSS: (t: { count: number }) => `${t.count} ट्रिप में घाटा हुआ। ट्रिप इतिहास में खोलकर भाड़ा और रूट खर्च मिलाएँ।`,
      LOW_MARGIN: (t: { count: number; minPerKm: number }) => `${t.count} ट्रिप में 5% से कम कमाई हुई। मुनाफ़े के लिए कम से कम ₹${t.minPerKm} प्रति km भाड़ा लें।`,
      OTHER_COSTS: (t: { inr: number }) => `खराबी, पुलिस, पार्किंग और लोडिंग में ${inr(t.inr)} गए। ट्रकों की सर्विस समय पर करें और जानी-पहचानी जगह रुकें।`,
      NO_TRIPS: () => 'इस महीने कोई ट्रिप पूरी नहीं हुई।',
      GOOD: () => 'अच्छा महीना — न चालान, न घाटे की ट्रिप, और ट्रक अच्छे से भरे। ऐसे ही चलाते रहें।',
    },
    open: 'Spareway खोलें',
    footer: 'यह ईमेल हर महीने की 1 तारीख को आता है। Spareway की ओर से।',
  },
}

export function monthName(month: string, lang: Lang): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function tipText(tip: Tip, lang: Lang): string {
  const w = WORDS[lang].tip as Record<string, (t: never) => string>
  return w[tip.code](tip as never)
}

/** Subject + simple, phone-friendly HTML (inline styles only — email clients drop <style>). */
export function renderEmail(r: MonthReport, lang: Lang, ownerName: string, company: string, appUrl: string): { subject: string; html: string } {
  const w = WORDS[lang]
  const m = monthName(r.month, lang)
  const row = (k: string, v: string) =>
    `<tr><td style="padding:8px 0;color:#555;border-bottom:1px solid #eee">${esc(k)}</td><td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #eee">${esc(v)}</td></tr>`
  const rows = [
    row(w.trips, String(r.trips)),
    row(w.km, `${r.km.toLocaleString('en-IN')} km`),
    row(w.revenue, inr(r.revenueInr)),
    row(w.cost, inr(r.costInr)),
    row(w.challans, inr(r.challanInr)),
  ]
  if (r.avgSpacePct !== null) rows.push(row(w.space, `${r.avgSpacePct}%`))
  if (r.costPerKmInr !== null && r.freightPerKmInr !== null) rows.push(row(w.perKm, `₹${r.costPerKmInr} / ₹${r.freightPerKmInr}`))
  const prev =
    r.prevNetInr !== null && r.trips > 0
      ? `<p style="margin:4px 0 0;color:#555">${esc(w.vsPrev(inr(Math.abs(r.netInr - r.prevNetInr)), r.netInr >= r.prevNetInr))}</p>`
      : ''
  const tips = r.tips.map((t) => `<li style="margin:0 0 10px">${esc(tipText(t, lang))}</li>`).join('')
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f0;font-family:Arial,Helvetica,sans-serif;color:#1a1d14">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="font-size:20px;font-weight:700;margin:0 0 16px">Spareway · ${esc(company)}</p>
<div style="background:#fff;border-radius:16px;padding:20px">
<p style="margin:0 0 4px;font-size:16px">${esc(w.hello(ownerName))}</p>
<p style="margin:0 0 16px;font-size:16px;color:#555">${esc(w.intro(m))}</p>
<p style="margin:0;color:#555">${esc(w.net)}</p>
<p style="margin:0;font-size:32px;font-weight:700;color:${r.netInr >= 0 ? '#2f7d1f' : '#c0392b'}">${esc(inr(r.netInr))}</p>
${prev}
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px">${rows.join('')}</table>
<p style="font-size:17px;font-weight:700;margin:16px 0 8px">${esc(w.tipsTitle)}</p>
<ul style="padding-left:20px;margin:0;font-size:15px;line-height:22px">${tips}</ul>
<p style="margin:20px 0 0"><a href="${esc(appUrl)}/history" style="display:inline-block;background:#9ccc2c;color:#1a1d14;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${esc(w.open)}</a></p>
</div>
<p style="font-size:12px;color:#777;margin:16px 0 0">${esc(w.footer)}</p>
</div></body></html>`
  return { subject: w.subject(m, inr(r.netInr)), html }
}

/** "Name <email>" or "email" → Brevo sender. */
export function parseSender(raw: string): { email: string; name: string } | null {
  const s = raw.trim()
  const m = s.match(/^(.*)<([^>]+)>$/)
  const email = (m ? m[2] : s).trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null
  return { email, name: (m ? m[1].trim().replace(/^"|"$/g, '') : '') || 'Spareway' }
}
