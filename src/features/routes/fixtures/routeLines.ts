// Fixture mode + tests: mocked route-plan responses (Engineering Reference 6.1 shape). For the demo trip the
// lines follow NH48 through the real toll plazas (fastest), a shorter state-highway cut that skips the Udaipur
// stretch (shortest) and a line kept off the toll plazas (no_tolls). Other trips get simple lines through their stops.
import type { RouteVariant } from '@/types/domain'
import type { LngLat } from '../lib/line'
import { makeLine } from '../lib/line'

const DEMO_FASTEST: LngLat[] = [
  [76.9366, 28.354], // Manesar warehouse
  [76.430522, 27.99978], // Shahjahanpur toll
  [75.9535128, 27.3056399], // Manoharpur toll
  [75.8345568, 27.0868994], // Daulatpura toll
  [75.8306, 26.7787], // Jaipur (Sitapura)
  [75.615578, 26.843328], // Thikariya toll
  [74.939169, 26.595329], // Kishangarh toll
  [74.6849376, 26.1029659], // Khedi toll
  [74.593839, 25.5871683], // Lambia Kalan toll
  [74.624379, 25.082922], // Jojro Ka Kheda toll
  [74.233079, 24.613529], // Narayanpura toll
  [73.720874, 24.500543], // Dakan Kotra toll (Udaipur bypass)
  [73.6271827, 23.9941418], // Khandi Obari toll
  [73.254472, 23.61615], // Vantada toll + Gujarat check post
  [72.828618, 23.410181], // Kathpur toll
  [72.5947, 22.9536], // Ahmedabad (Narol)
  [72.740887, 22.715971], // Radhvanaj toll
  [73.070539, 22.453254], // Vasad toll
  [73.115049, 22.015027], // Bharthana toll
  [73.059975, 21.702698], // Mandva toll
  [72.95418, 21.303367], // Choryasi toll
  [73.052162, 20.885548], // Boriach toll
  [72.917204, 20.43495], // Bhagwada toll
  [72.942644, 19.890544], // Charoti toll + Achhad check post
  [72.916898, 19.519667], // Khaniwade toll
  [72.97, 19.27], // Ghodbunder Road
  [73.0483, 19.2813], // Mumbai (Bhiwandi)
]

const STOPS = new Set([0, 4, 15, 26])

/** Shortest: cuts from Jojro Ka Kheda straight to Kathpur (skips the Udaipur tolls and the check post). */
const DEMO_SHORTEST = DEMO_FASTEST.filter((_, i) => i < 10 || i > 13)

/** No tolls: every point except the stops moved ~4 km off the plaza. */
const DEMO_NO_TOLLS = DEMO_FASTEST.map((p, i) => (STOPS.has(i) ? p : ([p[0] + 0.04, p[1] - 0.02] as LngLat)))

const ROAD_FACTOR = 1.12

function variant(v: RouteVariant['variant'], coords: LngLat[], factor: number, kmh: number): RouteVariant {
  const km = Math.round(makeLine(coords).lengthKm * ROAD_FACTOR * factor)
  return {
    variant: v,
    distanceKm: km,
    durationMin: Math.round((km / kmh) * 60),
    geometry: { type: 'LineString', coordinates: coords },
    restricted: true,
    cached: false,
  }
}

const near = (a: LngLat, b: LngLat) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01

/** Mocked route-plan answer for these stop coordinates (in order). */
export function fixtureRoutes(coordinates: LngLat[]): RouteVariant[] {
  const isDemo =
    coordinates.length === 4 && [0, 4, 15, 26].every((idx, i) => near(coordinates[i], DEMO_FASTEST[idx]))
  if (isDemo)
    return [
      variant('fastest', DEMO_FASTEST, 1, 62),
      variant('shortest', DEMO_SHORTEST, 1, 50),
      variant('no_tolls', DEMO_NO_TOLLS, 1.22, 48),
    ]
  const bend = (dx: number, dy: number) =>
    coordinates.flatMap((p, i) =>
      i === 0 ? [p] : [[(coordinates[i - 1][0] + p[0]) / 2 + dx, (coordinates[i - 1][1] + p[1]) / 2 + dy] as LngLat, p],
    )
  return [
    variant('fastest', bend(0.05, 0.03), 1.05, 60),
    variant('shortest', coordinates, 1, 48),
    variant('no_tolls', bend(-0.08, -0.05), 1.18, 50),
  ]
}
