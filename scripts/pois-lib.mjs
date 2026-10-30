// Pure helpers that turn Vansh's route CSVs (data/pois) into rows for public.pois.
// Used by scripts/pois-to-sql.mjs and its test.

export const SOURCE = 'vansh-2026-10-29'

// Town / city centres for rows that only name a place. Approximate: flagged in data.approx_location.
export const PLACES = {
  Sidhrawali: [28.162, 76.628],
  Dharuhera: [28.206, 76.797],
  Neemrana: [27.987, 76.388],
  Behror: [27.888, 76.286],
  Kotputli: [27.703, 76.199],
  Kanwarpura: [27.383, 75.967],
  Kishangarh: [26.59, 74.854],
  Bhilwara: [25.347, 74.641],
  Udaipur: [24.585, 73.712],
  Shamlaji: [23.687, 73.386],
  Prantij: [23.438, 72.857],
  'Bharuch-Surat section': [21.45, 72.99],
  Talasari: [20.133, 72.93],
  Manor: [19.725, 72.907],
}

// no-entry areas: centre + radius (km) the rule applies to
export const NO_ENTRY_AREAS = {
  'Gurugram|NH48 Pachgaon Chowk to IMT Manesar Chowk': [28.36, 76.93, 5],
  'Udaipur|11 city entry routes incl Balicha and Bhuvana': [24.585, 73.712, 10],
  'Ahmedabad|Ahmedabad city': [23.0225, 72.5714, 12],
  'Vadodara|Vadodara city': [22.3072, 73.1812, 10],
  'Surat|Surat city': [21.1702, 72.8311, 10],
  'Mira-Bhayandar Vasai-Virar|NH48 and Ghodbunder Road in MBVV limits': [19.35, 72.86, 15],
  'Mumbai|Mumbai city incl Dahisar entry': [19.076, 72.8777, 20],
  'Mumbai|South Mumbai': [18.93, 72.83, 6],
  'Indore|Indore city': [22.7196, 75.8577, 10],
}

const STATE_CODES = {
  Haryana: 'HR', Rajasthan: 'RJ', Gujarat: 'GJ', Maharashtra: 'MH', 'Madhya Pradesh': 'MP',
}

export function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const head = splitLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = splitLine(line)
    return Object.fromEntries(head.map((h, i) => [h.trim(), (cells[i] ?? '').trim()]))
  })
}

function splitLine(line) {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted
    } else if (c === ',' && !quoted) { out.push(cur); cur = '' } else cur += c
  }
  out.push(cur)
  return out
}

export function inIndia(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5
}

function num(v) {
  if (v === undefined || v === '' || v === 'not_listed' || v === 'not_stated') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function state(s) {
  return s.split('/').map((p) => STATE_CODES[p.trim()] ?? p.trim()).join('/')
}

const clean = (v) => (v === 'not_listed' || v === 'not_stated' || v === 'none' ? null : v)

export function tollRows(tolls, errors) {
  const rows = []
  for (const t of tolls) {
    const lat = num(t.latitude)
    const lng = num(t.longitude)
    const rates = [t.truck_2axle, t.truck_3axle, t.truck_4to6axle, t.truck_7plus_axle].map(num)
    if (!inIndia(lat, lng)) { errors.push(`toll ${t.plaza_name}: outside India (${t.latitude}, ${t.longitude})`); continue }
    if (rates.some((r) => r === null || Number.isNaN(r) || r < 0)) { errors.push(`toll ${t.plaza_name}: bad truck rate`); continue }
    const [a2, a3, a4to6, a7] = rates
    rows.push({
      kind: 'toll',
      name: `${t.plaza_name} toll plaza`,
      lat, lng,
      highway: t.highway,
      city: t.plaza_name,
      state: state(t.state),
      data: {
        rate_inr: { 2: a2, 3: a3, 4: a4to6, 5: a4to6, 6: a4to6, 7: a7 },
        plaza_code: t.plaza_code,
        route_group: t.route_group,
        section: t.section,
        car_inr: num(t.car_jeep_van),
        lcv_inr: num(t.lcv),
        police_station: clean(t.nearest_police_station),
        police_phone: clean(t.police_phone),
        hospital: clean(t.nearest_hospital),
        patrol_phone: clean(t.route_patrol_phone),
        crane_phone: clean(t.crane_phone),
      },
    })
  }
  return rows
}

const LIVE_CHECKPOINT = new Set(['operational', 'active_reported', 'closure_ordered_still_operating'])

export function checkpointRows(checkpoints, tolls, errors) {
  const byCode = new Map(tolls.map((t) => [t.plaza_code, t]))
  const rows = []
  for (const c of checkpoints) {
    if (c.checkpoint_type === 'anpr_mlff_toll') continue // barrier-free tolling: no stop
    if (!LIVE_CHECKPOINT.has(c.status) || c.trucks_stop === 'no') continue
    const toll = byCode.get(c.linked_toll_plaza_code)
    if (!toll) { errors.push(`checkpoint ${c.checkpoint_id} ${c.name}: no location (plaza ${c.linked_toll_plaza_code})`); continue }
    const lat = num(toll.latitude)
    const lng = num(toll.longitude)
    if (!inIndia(lat, lng)) { errors.push(`checkpoint ${c.checkpoint_id}: outside India`); continue }
    const atPlaza = /toll plaza/i.test(c.location)
    rows.push({
      kind: c.checkpoint_type === 'weigh_bridge' ? 'weighbridge' : 'checkpoint',
      name: c.name,
      lat, lng,
      highway: c.highway,
      city: c.location,
      state: state(c.state),
      data: {
        checkpoint_type: c.checkpoint_type,
        route_group: c.route_group,
        operated_by: c.operated_by,
        status: c.status,
        status_as_of: c.status_as_of,
        trucks_stop: c.trucks_stop,
        approx_location: !atPlaza,
      },
    })
  }
  return rows
}

const HALT_KIND = { dhaba: 'dhaba', restaurant: 'dhaba', rest_stop: 'parking', rest_area: 'parking' }

export function haltRows(halts, errors) {
  const rows = []
  for (const h of halts) {
    const kind = HALT_KIND[h.halt_type]
    const place = PLACES[h.town]
    if (!kind) { errors.push(`halt ${h.halt_id}: unknown type ${h.halt_type}`); continue }
    if (!place) { errors.push(`halt ${h.halt_id} ${h.name}: no coordinates for ${h.town}`); continue }
    rows.push({
      kind,
      name: h.name,
      lat: place[0], lng: place[1],
      highway: 'NH48',
      city: h.town,
      state: state(h.state),
      data: { halt_type: h.halt_type, segment: h.segment, approx_location: true },
    })
  }
  return rows
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function noEntryRows(rules, errors) {
  const groups = new Map()
  for (const r of rules) {
    if (/bus/i.test(r.vehicle_class)) continue // trucks only
    if (!TIME.test(r.no_entry_start) || !TIME.test(r.no_entry_end)) { errors.push(`no-entry ${r.rule_id}: bad time`); continue }
    const key = `${r.city}|${r.area}`
    const area = NO_ENTRY_AREAS[key]
    if (!area) { errors.push(`no-entry ${r.rule_id}: no area for ${key}`); continue }
    if (!groups.has(key)) {
      groups.set(key, {
        kind: 'city_entry',
        name: `${r.city} heavy-vehicle no-entry hours`,
        lat: area[0], lng: area[1],
        highway: '',
        city: r.city,
        state: state(r.state),
        data: {
          no_entry: [],
          radius_km: area[2],
          area: r.area,
          vehicle_class: r.vehicle_class,
          direction: r.direction,
          rule_type: r.rule_type,
          valid_until: clean(r.valid_until),
          exemptions: clean(r.exemptions),
          issued_by: r.issued_by,
          rule_as_of: r.rule_as_of,
          approx_location: true,
        },
      })
    }
    // "00:00" as an end time means midnight at the end of the day
    const end = r.no_entry_end === '00:00' ? '24:00' : r.no_entry_end
    groups.get(key).data.no_entry.push([r.no_entry_start, end])
  }
  return [...groups.values()]
}

const sq = (s) => `'${String(s).replace(/'/g, "''")}'`

export function toSql(rows) {
  const values = rows.map(
    (r) =>
      `  (${sq(r.kind)}, ${sq(r.name)}, ${r.lat}, ${r.lng}, ${sq(r.highway)}, ${sq(r.city)}, ${sq(r.state)}, ` +
      `${sq(JSON.stringify(r.data))}::jsonb, ${sq(SOURCE)}, false)`,
  )
  return [
    '-- Real route POIs from data/pois/*.csv (Vansh, sources in docs/Spareway_Data_Sources.pdf).',
    '-- Generated by `npm run pois`. Re-runnable: replaces earlier rows from the same source and the',
    '-- sample rows of the kinds covered here (sample fuel stations and hotels stay, marked is_sample).',
    'begin;',
    `delete from public.pois where source = ${sq(SOURCE)};`,
    "delete from public.pois where is_sample and kind in ('toll', 'checkpoint', 'weighbridge', 'city_entry', 'dhaba', 'parking');",
    'insert into public.pois (kind, name, lat, lng, highway, city, state, data, source, is_sample) values',
    values.join(',\n') + ';',
    'commit;',
    '',
  ].join('\n')
}
