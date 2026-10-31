// Lazy chunk: MapLibre + markers for the live map.
import { Marker } from 'react-map-gl/maplibre'
import { MapView, RouteLine, TruckMarker } from '@/components/common/MapView'
import type { LngLat } from '@/lib/geo'
import type { LiveTruck } from '../hooks'

export default function FleetMap({
  fleet,
  selectedId,
  onSelect,
  showRoutes,
  showProblems,
  className,
}: {
  fleet: LiveTruck[]
  selectedId: string | null
  onSelect: (id: string) => void
  showRoutes: boolean
  showProblems: boolean
  className?: string
}) {
  const placed = fleet.filter((f) => f.position)
  const fit = placed.map((f) => f.position as LngLat)
  return (
    <MapView fitTo={fit} className={className}>
      {showRoutes &&
        fleet
          .filter((f) => f.line && f.line.length > 1)
          .map((f) => (
            <RouteLine key={`r-${f.truck.id}`} id={f.truck.id} geometry={{ type: 'LineString', coordinates: f.line! }} chosen={f.truck.id === selectedId} />
          ))}
      {placed.map((f) => (
        <div key={f.truck.id}>
          <TruckMarker
            lng={f.position![0]}
            lat={f.position![1]}
            selected={f.truck.id === selectedId}
            label={f.truck.reg_no}
            onClick={() => onSelect(f.truck.id)}
          />
          {showProblems && f.hasProblem && (
            <ProblemDot lng={f.position![0]} lat={f.position![1]} />
          )}
        </div>
      ))}
    </MapView>
  )
}

function ProblemDot({ lng, lat }: { lng: number; lat: number }) {
  return (
    <Marker longitude={lng} latitude={lat} anchor="bottom-left" offset={[8, -10]}>
      <span className="block size-3.5 rounded-full border-2 border-[#0a0a0b] bg-crit" aria-hidden />
    </Marker>
  )
}
