// Lazy chunk: MapLibre for the driver page — the chosen route (or a straight line through the stops) and numbered stops.
import { useMemo } from 'react'
import { MapView, RouteLine, StopPin } from '@/components/common/MapView'
import type { LngLat } from '@/lib/geo'
import type { GeoLineString } from '@/types/domain'
import type { DriverStop } from '../api'

export default function DriverMap({ stops, geometry }: { stops: DriverStop[]; geometry: GeoLineString | null }) {
  const points = useMemo<LngLat[]>(() => stops.map((s) => [s.lng, s.lat]), [stops])
  const line = geometry ?? { type: 'LineString' as const, coordinates: points }
  return (
    <MapView fitTo={points} className="h-80 sm:h-96">
      {line.coordinates.length > 1 && <RouteLine id="driver" geometry={line} />}
      {stops.map((s) => (
        <StopPin key={s.id} lng={s.lng} lat={s.lat} seq={s.seq} label={s.name} />
      ))}
    </MapView>
  )
}
