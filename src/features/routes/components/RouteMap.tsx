// Route step map (Design System 7.10 / 8): lime = the route being looked at, grey = the others, numbered stops,
// toll / dhaba / check post / no-entry icons from zoom 8. Lazy-loaded with MapLibre.
import { useEffect, useMemo, useState } from 'react'
import { Marker, useMap } from 'react-map-gl/maplibre'
import { MapView, RouteLine, StopPin } from '@/components/common/MapView'
import { useLang } from '@/lib/i18n'
import type { LngLat } from '../lib/line'
import type { PlannedRoute } from '../hooks'
import type { StopRow } from '../api'

const ICON_ZOOM = 8

const HALT_ICON: Record<string, string> = {
  break: 'dhaba',
  overnight: 'parking',
  checkpoint: 'checkpoint',
  no_entry_wait: 'no-entry',
}

function useZoom(): number {
  const { current: map } = useMap()
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 4)
  useEffect(() => {
    if (!map) return
    const on = () => setZoom(map.getZoom())
    on()
    map.on('zoomend', on)
    return () => {
      map.off('zoomend', on)
    }
  }, [map])
  return zoom
}

function PoiIcons({ route }: { route: PlannedRoute }) {
  const zoom = useZoom()
  if (zoom < ICON_ZOOM) return null
  return (
    <>
      {route.plan.tolls.map((t) => (
        <Marker key={`toll-${t.poiId}`} longitude={t.lng} latitude={t.lat} anchor="center">
          <img src="/map/icons/toll.svg" alt="" title={t.name} width={22} height={22} />
        </Marker>
      ))}
      {route.plan.schedule.halts.map((h, i) => (
        <Marker key={`halt-${i}`} longitude={h.lng} latitude={h.lat} anchor="center">
          <img src={`/map/icons/${HALT_ICON[h.kind]}.svg`} alt="" title={h.name} width={22} height={22} />
        </Marker>
      ))}
    </>
  )
}

export default function RouteMap({ routes, viewedId, stops }: { routes: PlannedRoute[]; viewedId?: string; stops: StopRow[] }) {
  const { td } = useLang()
  const viewed = routes.find((r) => r.row.id === viewedId) ?? routes[0]
  const fitTo = useMemo(() => routes.flatMap((r) => r.geometry.coordinates as LngLat[]).filter((_, i) => i % 5 === 0), [routes])
  // the lime route is drawn last so it sits on top
  const ordered = [...routes.filter((r) => r !== viewed), ...(viewed ? [viewed] : [])]
  return (
    <MapView fitTo={fitTo} className="h-[300px] sm:h-[420px]">
      {ordered.map((r) => (
        <RouteLine key={`${r.row.id}-${r === viewed}`} id={`${r.row.id}-${r === viewed ? 'on' : 'off'}`} geometry={r.geometry} chosen={r === viewed} />
      ))}
      {viewed && <PoiIcons route={viewed} />}
      {stops.map((s) => (
        <StopPin key={s.id} lng={s.lng} lat={s.lat} seq={s.seq} label={td(s.name)} />
      ))}
    </MapView>
  )
}
