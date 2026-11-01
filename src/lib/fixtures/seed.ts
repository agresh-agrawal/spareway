// Engineering Reference section 7 sample data, built the same way as SQL `_seed_company()`.
// Used by dev fixture mode (?fixture=seed) so screens render without a database.
import type { Tables } from '@/types/database'

export const FIXTURE_COMPANY_ID = '00000000-0000-4000-8000-00000000c0de'
export const FIXTURE_USER_ID = '00000000-0000-4000-8000-0000000000a1'

/** Stable, readable uuids: 00000000-0000-4000-8000-<prefix><n> */
function id(prefix: string, n: number): string {
  return `00000000-0000-4000-8000-${(prefix + String(n).padStart(12, '0')).slice(-12)}`
}

const HOUR = 3_600_000
const MIN = 60_000

export interface FixtureData {
  profile: Tables<'profiles'>
  company: Tables<'companies'>
  settings: Tables<'company_settings'>
  trucks: Tables<'trucks'>[]
  trips: Tables<'trips'>[]
  trip_stops: Tables<'trip_stops'>[]
  cargo_items: Tables<'cargo_items'>[]
  load_plans: Tables<'load_plans'>[]
  loading_progress: Tables<'loading_progress'>[]
  route_options: Tables<'route_options'>[]
  freight_listings: Tables<'freight_listings'>[]
  trip_extra_loads: Tables<'trip_extra_loads'>[]
  alerts: Tables<'alerts'>[]
  trip_expenses: Tables<'trip_expenses'>[]
  provider_links: Tables<'provider_links'>[]
  listing_offers: Tables<'listing_offers'>[]
  providers: Tables<'providers'>[]
  notifications: Tables<'notifications'>[]
  activity_log: Tables<'activity_log'>[]
  fleet_daily_stats: Tables<'fleet_daily_stats'>[]
  pois: Tables<'pois'>[]
}

export function buildSeed(now: Date = new Date()): FixtureData {
  const t = now.getTime()
  const iso = (ms: number) => new Date(ms).toISOString()
  const c = FIXTURE_COMPANY_ID
  const created = iso(t - 2 * HOUR)
  // 06:00 IST tomorrow = 00:30 UTC tomorrow (same as the SQL seed)
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const dep = dayStart + 24 * HOUR + 30 * MIN

  const truck = (
    n: number,
    reg_no: string,
    model: string,
    body_type: string,
    [l, w, h]: [number, number, number],
    payload_kg: number,
    gross_weight_kg: number,
    axles: number,
    mileage_kmpl: number,
    cost_per_km_inr: number,
    status: string,
    home_city: string,
    driver_name: string,
    driver_phone: string,
    [last_lat, last_lng]: [number, number],
  ): Tables<'trucks'> => ({
    id: id('t', n),
    company_id: c,
    reg_no,
    model,
    body_type,
    internal_length_cm: l,
    internal_width_cm: w,
    internal_height_cm: h,
    payload_kg,
    gross_weight_kg,
    axles,
    door_position: 'rear',
    fuel_type: 'diesel',
    mileage_kmpl,
    cost_per_km_inr,
    status,
    home_city,
    driver_name,
    driver_phone,
    last_lat,
    last_lng,
    is_sample: true,
    created_at: created,
    updated_at: created,
  })

  const trucks = [
    truck(1, 'MP09 HG 4821', 'Tata Signa 3118.T · 32 ft MXL container', 'container', [975, 243, 243], 15000, 31000, 3, 3.6, 34, 'active', 'Indore', 'Ramesh Yadav', '+91 98270 00001', [28.354, 76.9366]),
    truck(2, 'RJ14 GC 7735', 'Ashok Leyland 2820 · 24 ft closed body', 'closed', [732, 244, 244], 10000, 28000, 3, 4.2, 28, 'idle', 'Jaipur', 'Suresh Meena', '+91 98290 00002', [26.7787, 75.8306]),
    truck(3, 'GJ01 KT 2208', 'Eicher Pro 3015 · 19 ft closed body', 'closed', [579, 214, 214], 9000, 16000, 2, 5.5, 22, 'active', 'Ahmedabad', 'Vikram Patel', '+91 98250 00003', [22.3072, 73.1812]),
    truck(4, 'MH04 LQ 9913', 'BharatBenz 1617R · 22 ft container', 'container', [670, 244, 244], 9000, 16200, 2, 5.0, 25, 'maintenance', 'Mumbai', 'Anil Pawar', '+91 98200 00004', [19.2813, 73.0483]),
    truck(5, 'MP09 KR 1147', 'Tata 1412 LPT · 17 ft closed body', 'closed', [518, 213, 213], 7000, 14000, 2, 6.0, 20, 'offline', 'Indore', 'Mahesh Chouhan', '+91 98260 00005', [22.7196, 75.8577]),
    truck(6, 'RJ14 TB 3360', 'Tata Ultra 1918.T · 20 ft closed body', 'closed', [610, 229, 229], 9000, 18500, 2, 5.2, 24, 'active', 'Jaipur', 'Imran Khan', '+91 98290 00006', [23.5986, 72.9665]),
  ]
  const truckId = (reg: string) => trucks.find((x) => x.reg_no === reg)!.id

  const trip = (
    n: number,
    code: string,
    reg: string,
    status: string,
    planned: number,
    actual: number | null,
    completed: number | null,
    base: number,
    notes = '',
  ): Tables<'trips'> => ({
    id: id('a', n),
    company_id: c,
    code,
    truck_id: truckId(reg),
    status,
    planned_departure: iso(planned),
    actual_departure: actual === null ? null : iso(actual),
    completed_at: completed === null ? null : iso(completed),
    base_freight_inr: base,
    selected_route_id: null,
    notes,
    loader_token: null,
    loader_token_expires_at: null,
    loader_link_enabled: false,
    driver_token: null,
    driver_link_enabled: false,
    driver_name: trucks.find((x) => x.reg_no === reg)!.driver_name,
    driver_phone: trucks.find((x) => x.reg_no === reg)!.driver_phone,
    gps_lat: null,
    gps_lng: null,
    gps_accuracy_m: null,
    gps_speed_kmph: null,
    gps_at: null,
    is_sample: true,
    created_at: created,
    updated_at: created,
  })

  const trips = [
    trip(31, 'TRP-2026-0031', 'MP09 HG 4821', 'planned', dep, null, null, 62000, 'Consumer durables for three distributors. Demo trip.'),
    trip(29, 'TRP-2026-0029', 'GJ01 KT 2208', 'in_transit', t - 3 * HOUR, t - 3 * HOUR, null, 21000),
    trip(30, 'TRP-2026-0030', 'RJ14 TB 3360', 'completed', t - 20 * HOUR, t - 20 * HOUR, t - 2 * HOUR, 28500),
  ]
  const [demo, live, done] = trips

  const stop = (
    n: number,
    tripId: string,
    seq: number,
    stop_type: string,
    name: string,
    city: string,
    lat: number,
    lng: number,
    extra: Partial<Tables<'trip_stops'>> = {},
  ): Tables<'trip_stops'> => ({
    id: id('s', n),
    company_id: c,
    trip_id: tripId,
    seq,
    stop_type,
    name,
    city,
    lat,
    lng,
    window_start: null,
    window_end: null,
    eta: null,
    status: 'pending',
    created_at: created,
    ...extra,
  })

  const w = (fromH: number, toH: number) => ({ window_start: iso(dep + fromH * HOUR), window_end: iso(dep + toH * HOUR) })
  const trip_stops = [
    stop(310, demo.id, 0, 'origin', 'Manesar warehouse', 'Gurugram', 28.354, 76.9366),
    stop(311, demo.id, 1, 'drop', 'Jaipur (Sitapura)', 'Jaipur', 26.7787, 75.8306, w(5, 10)),
    stop(312, demo.id, 2, 'drop', 'Ahmedabad (Narol)', 'Ahmedabad', 22.9536, 72.5947, w(26, 46)),
    stop(313, demo.id, 3, 'drop', 'Mumbai (Bhiwandi)', 'Bhiwandi', 19.2813, 73.0483, w(52, 70)),
    stop(290, live.id, 0, 'origin', 'Ahmedabad (Aslali)', 'Ahmedabad', 22.9196, 72.5996, { status: 'done' }),
    stop(291, live.id, 1, 'drop', 'Vadodara (Makarpura)', 'Vadodara', 22.2587, 73.1902, {
      status: 'done',
      eta: iso(t - 20 * MIN),
      window_end: iso(t + HOUR),
    }),
    stop(292, live.id, 2, 'drop', 'Surat (Sachin GIDC)', 'Surat', 21.085, 72.882, { eta: iso(t + 3 * HOUR), window_end: iso(t + 5 * HOUR) }),
    stop(300, done.id, 0, 'origin', 'Jaipur (VKIA)', 'Jaipur', 26.967, 75.77, { status: 'done' }),
    stop(301, done.id, 1, 'drop', 'Himmatnagar', 'Himmatnagar', 23.5986, 72.9665, {
      status: 'done',
      eta: iso(t - 2 * HOUR),
      window_end: iso(t - HOUR),
    }),
  ]
  const s = (n: number) => id('s', n)

  const cargo = (
    n: number,
    tripId: string,
    label: string,
    sku: string,
    client_name: string,
    [l, wd, h]: [number, number, number],
    weight_kg: number,
    quantity: number,
    drop: string,
    fragile: boolean,
    upright_only: boolean,
    stackable: boolean,
    priority: string,
  ): Tables<'cargo_items'> => ({
    id: id('c', n),
    company_id: c,
    trip_id: tripId,
    label,
    sku,
    client_name,
    length_cm: l,
    width_cm: wd,
    height_cm: h,
    weight_kg,
    quantity,
    pickup_stop_id: null,
    drop_stop_id: drop,
    fragile,
    upright_only,
    stackable,
    max_top_load_kg: null,
    priority,
    source: 'seed',
    added_by_loader: false,
    extra_load_id: null,
    image_path: null,
    confidence: null,
    created_at: created,
  })

  const cargo_items = [
    cargo(1, demo.id, 'Split AC indoor unit 1.5T', 'AC-IN-15', 'Shree Electronics, Jaipur', [95, 32, 38], 14, 24, s(311), false, true, true, 'normal'),
    cargo(2, demo.id, 'Ceiling fan (carton of 4)', 'FAN-4PK', 'Shree Electronics, Jaipur', [60, 40, 45], 18, 16, s(311), false, false, true, 'low'),
    cargo(3, demo.id, 'Split AC outdoor unit 1.5T', 'AC-OUT-15', 'Patel Appliances, Ahmedabad', [90, 40, 70], 38, 20, s(312), false, true, true, 'normal'),
    cargo(4, demo.id, 'LED TV 43 inch', 'TV-43', 'Patel Appliances, Ahmedabad', [105, 18, 68], 11, 12, s(312), true, true, false, 'high'),
    cargo(5, demo.id, 'Washing machine front-load', 'WM-FL7', 'Konkan Retail, Bhiwandi', [65, 65, 90], 72, 8, s(313), false, true, true, 'normal'),
    cargo(6, demo.id, 'Refrigerator 260 L', 'RF-260', 'Konkan Retail, Bhiwandi', [62, 70, 165], 52, 6, s(313), false, true, false, 'high'),
    cargo(7, demo.id, 'Microwave oven 25 L', 'MW-25', 'Konkan Retail, Bhiwandi', [52, 42, 35], 13, 18, s(313), true, false, true, 'normal'),
    cargo(8, live.id, 'Pharma cartons', '', 'Zydus distributor', [60, 40, 40], 12, 120, s(292), false, false, true, 'normal'),
    cargo(9, done.id, 'Marble tiles crate', '', 'Sanghvi Ceramics', [120, 60, 40], 180, 30, s(301), false, false, true, 'normal'),
  ]

  const plan = (n: number, tripId: string, vol: number, wt: number): Tables<'load_plans'> => ({
    id: id('p', n),
    company_id: c,
    trip_id: tripId,
    version: 1,
    status: 'active',
    engine_version: 'seed',
    input_hash: 'seed',
    placements: [],
    unplaced: [],
    metrics: { volumeUsedPct: vol, weightUsedPct: wt },
    created_by: null,
    created_at: created,
  })
  const load_plans = [plan(29, live.id, 78.4, 61.2), plan(30, done.id, 64.0, 60.0)]

  const listing = (
    n: number,
    code: string,
    shipper_name: string,
    goods_type: string,
    description: string,
    pickup: [string, number, number],
    drop: [string, number, number],
    [l, wd, h]: [number, number, number],
    weight_kg: number,
    quantity: number,
    fragile: boolean,
    upright_only: boolean,
    stackable: boolean,
    offered_rate_inr: number,
    days: number,
  ): Tables<'freight_listings'> => ({
    id: id('l', n),
    company_id: c,
    share_token: null,
    provider_link_id: null,
    provider_id: null,
    visibility: 'company',
    code,
    shipper_name,
    shipper_phone: `+91 90000 ${code.slice(3).padStart(5, '1')}`,
    goods_type,
    description,
    pickup_name: pickup[0],
    pickup_lat: pickup[1],
    pickup_lng: pickup[2],
    drop_name: drop[0],
    drop_lat: drop[1],
    drop_lng: drop[2],
    length_cm: l,
    width_cm: wd,
    height_cm: h,
    weight_kg,
    quantity,
    fragile,
    upright_only,
    stackable,
    offered_rate_inr,
    ready_from: iso(t),
    deliver_by: iso(t + days * 24 * HOUR),
    status: 'open',
    posted_by: null,
    accepted_by_company: null,
    is_sample: true,
    created_at: created,
  })
  const P = {
    kishangarh: ['Kishangarh', 26.59, 74.854] as [string, number, number],
    narol: ['Ahmedabad (Narol)', 22.9536, 72.5947] as [string, number, number],
    beawar: ['Beawar', 26.1011, 74.32] as [string, number, number],
    bhiwandi: ['Mumbai (Bhiwandi)', 19.2813, 73.0483] as [string, number, number],
    udaipur: ['Udaipur', 24.5854, 73.7125] as [string, number, number],
    vadodara: ['Vadodara', 22.3072, 73.1812] as [string, number, number],
    himmatnagar: ['Himmatnagar', 23.5986, 72.9665] as [string, number, number],
    kamrej: ['Surat (Kamrej)', 21.2706, 72.959] as [string, number, number],
    bharuch: ['Bharuch', 21.7051, 72.9959] as [string, number, number],
    vapi: ['Vapi', 20.3893, 72.9106] as [string, number, number],
    indore: ['Indore', 22.7196, 75.8577] as [string, number, number],
    bhopal: ['Bhopal', 23.2599, 77.4126] as [string, number, number],
    sitapura: ['Jaipur (Sitapura)', 26.7787, 75.8306] as [string, number, number],
  }
  const freight_listings = [
    listing(1041, 'LD-1041', 'Kishangarh Marble House', 'Marble tiles', 'Polished tiles in wooden crates', P.kishangarh, P.narol, [120, 60, 40], 180, 8, true, false, false, 16000, 3),
    listing(1042, 'LD-1042', 'Beawar Textiles', 'Textile bales', 'Compressed cotton bales', P.beawar, P.bhiwandi, [100, 60, 50], 90, 20, false, false, true, 24000, 4),
    listing(1043, 'LD-1043', 'Udaipur Handicrafts Co-op', 'Handicraft cartons', 'Wooden decor, packed', P.udaipur, P.vadodara, [60, 50, 50], 20, 25, true, true, true, 9000, 3),
    listing(1044, 'LD-1044', 'Himmatnagar Ceramics', 'Ceramic sanitaryware', 'Boxed wash basins', P.himmatnagar, P.bhiwandi, [70, 55, 45], 25, 30, true, true, true, 15500, 4),
    listing(1045, 'LD-1045', 'Vadodara Auto Components', 'Auto parts', 'Brake assemblies in cartons', P.vadodara, P.bhiwandi, [80, 60, 60], 45, 18, false, false, true, 14000, 3),
    listing(1046, 'LD-1046', 'Surat Silk Mills', 'Fabric rolls', 'Synthetic fabric rolls, wrapped', P.kamrej, P.bhiwandi, [150, 40, 40], 35, 24, false, false, true, 9500, 2),
    listing(1047, 'LD-1047', 'Bharuch Foods', 'Packaged snacks', 'Light cartons, keep dry', P.bharuch, P.kamrej, [60, 40, 40], 6, 40, false, false, true, 4200, 2),
    listing(1048, 'LD-1048', 'Vapi Paper Products', 'Paper reels', 'Kraft paper reels on pallets', P.vapi, P.bhiwandi, [110, 110, 120], 600, 3, false, true, false, 11000, 2),
    listing(1049, 'LD-1049', 'Malwa Agro', 'Soybean bags', 'Off corridor (Indore → Bhopal)', P.indore, P.bhopal, [80, 50, 30], 50, 40, false, false, true, 18000, 3),
    listing(1050, 'LD-1050', 'Mumbai Movers', 'Office furniture', 'Wrong direction (Mumbai → Ahmedabad)', P.bhiwandi, P.narol, [120, 80, 90], 60, 10, false, false, true, 20000, 3),
    listing(1051, 'LD-1051', 'Gujarat Steel Traders', 'Steel coils', 'Too heavy for remaining payload', P.vadodara, P.bhiwandi, [150, 150, 120], 4000, 4, false, true, false, 45000, 3),
    listing(1052, 'LD-1052', 'Jaipur Blue Pottery', 'Pottery', 'Low offer: likely negative net benefit', P.sitapura, P.udaipur, [50, 40, 40], 15, 6, true, true, false, 300, 3),
  ]

  const alerts: Tables<'alerts'>[] = [] // only loader reports remain; none in the sample
  const note = (
    n: number,
    kind: string,
    severity: string,
    major: boolean,
    meta: Record<string, string | number>,
    link: string,
    tripId: string | null,
    agoMin: number,
    read: boolean,
  ): Tables<'notifications'> => ({
    id: id('n', n),
    company_id: c,
    trip_id: tripId,
    kind,
    severity,
    major,
    title: kind.replace(/_/g, ' '),
    meta,
    link,
    read_at: read ? iso(t - (agoMin - 5) * MIN) : null,
    emailed_at: null,
    is_sample: true,
    created_at: iso(t - agoMin * MIN),
  })

  const act = (n: number, kind: string, message: string, entity_type: string, entity_ref: string, agoMin: number): Tables<'activity_log'> => ({
    id: id('v', n),
    company_id: c,
    kind,
    message,
    entity_type,
    entity_ref,
    meta: {},
    is_sample: true,
    created_at: iso(t - agoMin * MIN),
  })
  const activity_log = [
    act(1, 'trip_departed', 'Trip departed Ahmedabad (Aslali)', 'truck', 'GJ01 KT 2208', 180),
    act(2, 'stop_done', 'Delivered at Vadodara (Makarpura)', 'trip', 'TRP-2026-0029', 20),
    act(4, 'trip_completed', 'Trip completed at Himmatnagar', 'trip', 'TRP-2026-0030', 120),
    act(6, 'trip_planned', 'Trip planned: Manesar → Jaipur → Ahmedabad → Mumbai', 'trip', 'TRP-2026-0031', 60),
  ]

  // same formulas as the SQL seed (generate_series(1, 30))
  const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d
  const fleet_daily_stats: Tables<'fleet_daily_stats'>[] = []
  for (let g = 1; g <= 30; g++) {
    const day = new Date(dayStart - g * 24 * HOUR).toISOString().slice(0, 10)
    fleet_daily_stats.push({
      company_id: c,
      day,
      utilisation_pct: round(58 + 10 * Math.sin(g / 3) + (g % 5), 1),
      distance_km: round(1800 + 400 * Math.cos(g / 4) + 37 * (g % 7)),
      on_time_pct: round(88 + 6 * Math.sin(g / 5), 1),
      delayed_pct: round(12 - 6 * Math.sin(g / 5), 1),
      revenue_inr: round(180000 + 30000 * Math.sin(g / 6)),
      cost_inr: round(140000 + 15000 * Math.cos(g / 6)),
      extra_load_revenue_inr: g < 7 ? round(8000 + 1500 * g) : 0,
      is_sample: true,
    })
  }

  return {
    profile: {
      id: FIXTURE_USER_ID,
      company_id: c,
      full_name: 'Agresh Agrawal',
      email: 'owner@fixture.test',
      preferred_lang: 'en',
      email_notify: true,
      created_at: created,
    },
    company: { id: c, name: 'Agrawal Transport', city: 'Indore', phone: '', created_by: FIXTURE_USER_ID, sample_seeded_at: created, created_at: created },
    settings: {
      company_id: c,
      diesel_price_inr_per_l: 90,
      driver_cost_inr_per_h: 120,
      value_of_time_inr_per_h: 150,
      handling_inr_per_kg: 0.5,
      waiting_cost_inr_per_h: 300,
      delay_penalty_inr_per_min: 10,
      min_margin_inr: 500,
      corridor_km: 20,
      road_factor: 1.25,
      break_after_drive_h: 5,
      break_min: 30,
      max_drive_h_per_day: 10,
      overnight_rest_h: 8,
      avg_speed_kmph: 45,
      checkpoint_delay_min: 20,
      support_ratio: 1,
      cargo_unit: 'cm',
      updated_at: created,
    },
    trucks,
    trips,
    trip_stops,
    cargo_items,
    load_plans,
    loading_progress: [],
    route_options: [],
    freight_listings,
    trip_extra_loads: [],
    alerts,
    trip_expenses: [
      // one challan on the finished trip so the challan corner and earnings show it
      { id: id('e', 9001), company_id: c, trip_id: done.id, kind: 'challan', amount_inr: 2000, note: 'No-entry time, Jaipur', added_by: 'driver', created_at: iso(t - 6 * HOUR) },
    ],
    provider_links: [],
    listing_offers: [],
    providers: [],
    notifications: [
      note(1, 'trip_done', 'info', true, { code: done.code }, `/trips/${done.id}`, done.id, 6 * 60, true),
      note(2, 'driver_challan', 'warning', true, { code: done.code, kind: 'challan', amount: 2000, note: 'No-entry time, Jaipur' }, `/trips/${done.id}`, done.id, 6 * 60 + 30, true),
      note(3, 'provider_load', 'info', true, { name: 'Sharma Trading Co.', count: 3 }, '/loads', null, 25, false),
    ],
    activity_log,
    fleet_daily_stats,
    pois: [],
  }
}

