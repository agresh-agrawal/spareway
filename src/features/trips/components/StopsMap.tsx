// Map for the wizard's Stops step: hubs as small dots (tap to add), chosen stops as numbered pins.
import { Marker } from 'react-map-gl/maplibre'
import { MapView, StopPin } from '@/components/common/MapView'
import { useLang } from '@/lib/i18n'
import type { Place } from '../lib/places'
import type { WizardStop } from '../schemas'

export default function StopsMap({ hubs, stops, onPick }: { hubs: Place[]; stops: WizardStop[]; onPick: (p: Place) => void }) {
  const { td } = useLang()
  const chosen = new Set(stops.map((s) => `${s.lat},${s.lng}`))
  const fit = stops.length ? stops.map((s) => [s.lng, s.lat] as [number, number]) : hubs.map((h) => [h.lng, h.lat] as [number, number])
  return (
    <MapView fitTo={fit} className="h-72 lg:h-[420px]">
      {hubs
        .filter((h) => !chosen.has(`${h.lat},${h.lng}`))
        .map((h) => (
          <Marker key={h.id} longitude={h.lng} latitude={h.lat} anchor="center">
            <button
              type="button"
              onClick={() => onPick(h)}
              aria-label={td(h.name)}
              title={td(h.name)}
              className="flex size-7 items-center justify-center rounded-full"
            >
              <span className="block size-3 rounded-full border-2 border-canvas bg-ink-2 shadow" />
            </button>
          </Marker>
        ))}
      {stops.map((s, i) => (
        <StopPin key={s.key} lng={s.lng} lat={s.lat} seq={i} label={td(s.name)} />
      ))}
    </MapView>
  )
}
