// monthly-report — pure parts: the month's numbers, tips to cut costs, and the email (en / hi). Tested with Vitest.
import { bars, button, C, esc, h2, inr, kpis, layout, p, table } from './email.ts'

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
  /** truck number, for the per-truck table */
  truck?: string
}

export interface TripLine {
  code: string
  truck: string
  km: number
  netInr: number
}

export interface TruckLine {
  truck: string
  trips: number
  km: number
  netInr: number
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
  prevTrips: number | null
  extraInr: number
  /** net ÷ revenue, % */
  marginPct: number | null
  avgNetPerTripInr: number | null
  costParts: { routeInr: number; extraCostInr: number; challanInr: number; otherInr: number }
  best: TripLine | null
  worst: TripLine | null
  byTruck: TruckLine[]
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
export function buildReport(month: string, trips: ReportTrip[], prevNetInr: number | null, prevTrips: number | null = null): MonthReport {
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

  const line = (t: ReportTrip): TripLine => ({ code: t.code, truck: t.truck ?? '', km: round(t.km), netInr: round(t.netInr) })
  const byNet = done.slice().sort((a, b) => b.netInr - a.netInr)
  const trucks = new Map<string, TruckLine>()
  for (const t of done) {
    const k = t.truck ?? ''
    const r = trucks.get(k) ?? { truck: k, trips: 0, km: 0, netInr: 0 }
    r.trips++
    r.km += t.km
    r.netInr += t.netInr
    trucks.set(k, r)
  }
  const net = sum((t) => t.netInr)

  return {
    month,
    prevTrips,
    extraInr: round(sum((t) => t.extraInr)),
    marginPct: revenue > 0 ? Math.round((100 * net) / revenue) : null,
    avgNetPerTripInr: done.length ? round(net / done.length) : null,
    costParts: {
      routeInr: round(sum((t) => t.routeCostInr)),
      extraCostInr: round(sum((t) => t.extraCostInr)),
      challanInr: round(challan),
      otherInr: round(other),
    },
    best: byNet.length ? line(byNet[0]) : null,
    worst: byNet.length > 1 ? line(byNet[byNet.length - 1]) : null,
    byTruck: [...trucks.values()]
      .map((r) => ({ ...r, km: round(r.km), netInr: round(r.netInr) }))
      .sort((a, b) => b.netInr - a.netInr),
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
    open: 'Open trip history',
    footer: 'You get this email on the 1st of every month. Costs are worked out from each truck\'s cost per km plus the challans and costs added on the trip (Estimated). Sent by Spareway.',
    title: (m: string) => `Your ${m} report`,
    preheader: (net: string, trips: number) => `${trips} trips · net ${net}`,
    margin: 'Profit margin',
    perTrip: 'Average per trip',
    extra: 'From extra loads',
    tripsSub: (prev: number) => `month before: ${prev}`,
    moneyWent: 'Where the money went',
    parts: { route: 'Diesel, tolls and driver (route)', extraCost: 'Extra-load detours', challan: 'Challans', other: 'Breakdowns, police, parking, loading' },
    bestWorst: 'Best and weakest trip',
    best: 'Best',
    worst: 'Weakest',
    byTruck: 'Each truck',
    head: { truck: 'Truck', trips: 'Trips', km: 'km', net: 'Net' },
    noTruck: 'Truck not set',
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
    open: 'ट्रिप इतिहास खोलें',
    footer: 'यह ईमेल हर महीने की 1 तारीख को आता है। खर्च हर ट्रक के प्रति km खर्च और ट्रिप में जोड़े गए चालान व खर्च से निकाला गया है (अनुमानित)। Spareway की ओर से।',
    title: (m: string) => `आपकी ${m} की रिपोर्ट`,
    preheader: (net: string, trips: number) => `${trips} ट्रिप · शुद्ध ${net}`,
    margin: 'मुनाफ़ा',
    perTrip: 'हर ट्रिप औसत',
    extra: 'अतिरिक्त लोड से',
    tripsSub: (prev: number) => `पिछला महीना: ${prev}`,
    moneyWent: 'पैसा कहाँ गया',
    parts: { route: 'डीज़ल, टोल और ड्राइवर (रूट)', extraCost: 'अतिरिक्त लोड का चक्कर', challan: 'चालान', other: 'खराबी, पुलिस, पार्किंग, लोडिंग' },
    bestWorst: 'सबसे अच्छी और कमज़ोर ट्रिप',
    best: 'सबसे अच्छी',
    worst: 'सबसे कमज़ोर',
    byTruck: 'हर ट्रक',
    head: { truck: 'ट्रक', trips: 'ट्रिप', km: 'km', net: 'शुद्ध' },
    noTruck: 'ट्रक नहीं जुड़ा',
  },
}

export function monthName(month: string, lang: Lang): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}


export function tipText(tip: Tip, lang: Lang): string {
  const w = WORDS[lang].tip as Record<string, (t: never) => string>
  return w[tip.code](tip as never)
}

/** Subject + phone-friendly HTML: headline number, KPIs, where the money went, best / weakest trip, each truck, tips. */
export function renderEmail(r: MonthReport, lang: Lang, ownerName: string, company: string, appUrl: string): { subject: string; html: string } {
  const w = WORDS[lang]
  const m = monthName(r.month, lang)
  const km = (n: number) => `${n.toLocaleString('en-IN')} km`
  const prev =
    r.prevNetInr !== null && r.trips > 0
      ? `<p style="margin:2px 0 0;font-size:14px;font-weight:600;color:${r.netInr >= r.prevNetInr ? C.ok : C.crit}">${r.netInr >= r.prevNetInr ? '▲' : '▼'} ${esc(w.vsPrev(inr(Math.abs(r.netInr - r.prevNetInr)), r.netInr >= r.prevNetInr))}</p>`
      : ''
  let body = `${p(w.hello(ownerName), C.ink)}${p(w.intro(m))}
<div style="background:${C.bg};border-radius:14px;padding:16px;margin:12px 0">
<div style="font-size:14px;color:${C.ink2}">${esc(w.net)}</div>
<div style="font-size:34px;font-weight:700;color:${r.netInr >= 0 ? C.ok : C.crit}">${esc(inr(r.netInr))}</div>${prev}
</div>`
  if (r.trips > 0) {
    body += kpis([
      { label: w.trips, value: String(r.trips), sub: r.prevTrips !== null ? w.tripsSub(r.prevTrips) : undefined },
      { label: w.km, value: km(r.km) },
      { label: w.revenue, value: inr(r.revenueInr) },
      { label: w.cost, value: inr(r.costInr) },
      ...(r.marginPct !== null ? [{ label: w.margin, value: `${r.marginPct}%`, tone: r.marginPct >= 5 ? ('ok' as const) : ('crit' as const) }] : []),
      ...(r.avgNetPerTripInr !== null ? [{ label: w.perTrip, value: inr(r.avgNetPerTripInr) }] : []),
      ...(r.extraInr > 0 ? [{ label: w.extra, value: inr(r.extraInr), tone: 'ok' as const }] : []),
      ...(r.avgSpacePct !== null ? [{ label: w.space, value: `${r.avgSpacePct}%` }] : []),
      ...(r.costPerKmInr !== null && r.freightPerKmInr !== null ? [{ label: w.perKm, value: `₹${r.costPerKmInr} / ₹${r.freightPerKmInr}` }] : []),
    ])
    const parts = [
      { label: w.parts.route, value: r.costParts.routeInr, color: C.ink2 },
      { label: w.parts.extraCost, value: r.costParts.extraCostInr, color: C.brandDark },
      { label: w.parts.challan, value: r.costParts.challanInr, color: C.crit },
      { label: w.parts.other, value: r.costParts.otherInr, color: C.warn },
    ].filter((x) => x.value > 0)
    if (parts.length) body += h2(w.moneyWent) + bars(parts.map((x) => ({ ...x, text: inr(x.value) })))
    if (r.best) {
      const rows = [[`${w.best} · ${r.best.code}`, km(r.best.km), inr(r.best.netInr)]]
      if (r.worst) rows.push([`${w.worst} · ${r.worst.code}`, km(r.worst.km), inr(r.worst.netInr)])
      body += h2(w.bestWorst) + table([], rows)
    }
    if (r.byTruck.length > 1 || (r.byTruck[0] && r.byTruck[0].truck))
      body +=
        h2(w.byTruck) +
        table(
          [w.head.truck, w.head.trips, w.head.km, w.head.net],
          r.byTruck.map((x) => [x.truck || w.noTruck, String(x.trips), x.km.toLocaleString('en-IN'), inr(x.netInr)]),
        )
  }
  body += h2(w.tipsTitle)
  body += r.tips
    .map(
      (t, i) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr>
<td width="30" valign="top"><div style="width:24px;height:24px;border-radius:12px;background:${t.code === 'GOOD' ? C.ok : C.brand};color:${t.code === 'GOOD' ? '#fff' : C.ink};font-weight:700;font-size:13px;line-height:24px;text-align:center">${i + 1}</div></td>
<td style="font-size:15px;line-height:22px">${esc(tipText(t, lang))}</td></tr></table>`,
    )
    .join('')
  body += button(`${appUrl}/history`, w.open)
  const html = layout({ lang, preheader: w.preheader(inr(r.netInr), r.trips), company, title: w.title(m), body, footer: w.footer })
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
