// MapLibre wrapper. Our styles in /map follow the Light / Dark theme (falls back to OpenFreeMap if a style is
// missing). Low-data → lite style. Attribution always visible.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import MapGL, {
  AttributionControl,
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { setWorkerUrl } from 'maplibre-gl'
// MapLibre 6 builds its worker URL at runtime, so the bundler never ships the file: import it explicitly.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Navigation, Truck } from 'lucide-react'
import { OPENFREEMAP_STYLE } from '@/lib/env'
import { boundsOf, INDIA_CENTER, type LngLat } from '@/lib/geo'
import { useLowData } from '@/lib/lowData'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'
import type { GeoLineString } from '@/types/domain'
import { stopColor } from './chips'

const STYLES = {
  dark: { full: '/map/spareway-dark.json', lite: '/map/spareway-lite.json' },
  light: { full: '/map/spareway-light.json', lite: '/map/spareway-light-lite.json' },
}

setWorkerUrl(maplibreWorkerUrl)

type MapInstance = ReturnType<MapRef['getMap']>
// text-field values are passed through unchanged; only the Hindi wrapper is added or removed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Expr = any

const isHindiWrap = (v: unknown): v is [string, unknown, Expr] =>
  Array.isArray(v) && v[0] === 'coalesce' && JSON.stringify(v[1]) === '["get","name:hi"]'

/** Place and water labels in Hindi (OpenStreetMap name:hi, else the usual name) when the app is in Hindi. */
function applyLabelLang(map: MapInstance, lang: string) {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== 'symbol' || !(layer.id.startsWith('place_') || layer.id === 'water_name')) continue
    const current = map.getLayoutProperty(layer.id, 'text-field') as Expr | undefined
    if (current === undefined) continue
    const original = isHindiWrap(current) ? current[2] : current
    const wanted = lang === 'hi' ? (['coalesce', ['get', 'name:hi'], original] as Expr) : original
    if (JSON.stringify(wanted) !== JSON.stringify(current)) map.setLayoutProperty(layer.id, 'text-field', wanted)
  }
}

function useStyleUrl(): string {
  const { lowData } = useLowData()
  const { theme } = useTheme()
  const wanted = STYLES[theme][lowData ? 'lite' : 'full']
  const [url, setUrl] = useState(wanted)
  useEffect(() => {
    if (!wanted.startsWith('/')) {
      setUrl(wanted)
      return
    }
    // same-origin style not built yet → OpenFreeMap
    let alive = true
    fetch(wanted, { method: 'HEAD' })
      .then((r) => {
        const ok = r.ok && (r.headers.get('content-type') ?? '').includes('json')
        if (alive) setUrl(ok ? wanted : OPENFREEMAP_STYLE)
      })
      .catch(() => alive && setUrl(OPENFREEMAP_STYLE))
    return () => {
      alive = false
    }
  }, [wanted])
  return url
}

export function MapView({
  fitTo = [],
  className,
  children,
  onRecentre,
}: {
  /** points to fit the view to, [lng, lat] */
  fitTo?: LngLat[]
  className?: string
  children?: ReactNode
  onRecentre?: () => void
}) {
  const ref = useRef<MapRef>(null)
  const styleUrl = useStyleUrl()
  const { lang } = useLang()
  useEffect(() => {
    const map = ref.current?.getMap()
    if (map?.isStyleLoaded()) applyLabelLang(map, lang)
  }, [lang])
  const [failed, setFailed] = useState(false)
  const bounds = useMemo(() => boundsOf(fitTo), [fitTo])

  const fit = () => {
    if (!ref.current) return
    if (bounds && fitTo.length > 1) ref.current.fitBounds(bounds, { padding: 60, duration: 0, maxZoom: 12 })
    else if (fitTo.length === 1) ref.current.jumpTo({ center: fitTo[0], zoom: 10 })
  }

  useEffect(fit, [bounds]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn('relative overflow-hidden rounded-card border border-line bg-[#0b0d0f]', className)}>
      <MapGL
        ref={ref}
        mapStyle={styleUrl}
        initialViewState={{ longitude: INDIA_CENTER[0], latitude: INDIA_CENTER[1], zoom: 4 }}
        attributionControl={false}
        onLoad={() => {
          fit()
          const map = ref.current?.getMap()
          if (map) applyLabelLang(map, lang)
        }}
        onStyleData={(e) => {
          // a new style (theme / low data) brings the usual labels back
          if (e.target.isStyleLoaded()) applyLabelLang(e.target, lang)
        }}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%' }}
        maxPitch={0}
        dragRotate={false}
      >
        <AttributionControl compact={false} position="bottom-right" />
        <NavigationControl showCompass={false} position="top-right" />
        {children}
      </MapGL>
      {(onRecentre || fitTo.length > 0) && (
        <button
          onClick={() => (onRecentre ? onRecentre() : fit())}
          aria-label="Re-centre"
          className="absolute right-2.5 bottom-10 flex size-12 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-ink hover:bg-surface-3"
        >
          <Navigation size={20} />
        </button>
      )}
      {failed && (
        <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-surface-2 px-3 py-1 text-label text-ink-2">
          Map tiles could not load
        </div>
      )}
    </div>
  )
}

/** 34 px circle with a truck; selected = lime with soft pulse. */
export function TruckMarker({
  lng,
  lat,
  selected,
  label,
  onClick,
}: {
  lng: number
  lat: number
  selected?: boolean
  label: string
  onClick?: () => void
}) {
  return (
    <Marker longitude={lng} latitude={lat} anchor="center">
      <button
        onClick={onClick}
        aria-label={label}
        className={cn(
          'flex size-[34px] items-center justify-center rounded-full border-2 shadow-lg',
          selected ? 'animate-pulse-soft border-accent bg-accent text-accent-ink' : 'border-ink-3 bg-surface-3 text-ink',
        )}
      >
        <Truck size={18} aria-hidden />
      </button>
    </Marker>
  )
}

/** 30 px circle in the stop colour with its number. */
export function StopPin({ lng, lat, seq, label }: { lng: number; lat: number; seq: number; label: string }) {
  return (
    <Marker longitude={lng} latitude={lat} anchor="center">
      <span
        title={label}
        aria-label={label}
        className="flex size-[30px] items-center justify-center rounded-full border-2 border-canvas text-[13px] font-bold text-accent-ink shadow-lg"
        style={{ background: stopColor(seq) }}
      >
        {seq}
      </span>
    </Marker>
  )
}

/** chosen route = accent 6 px; others ink-3 4 px at 70 %. */
export function RouteLine({ id, geometry, chosen = true }: { id: string; geometry: GeoLineString; chosen?: boolean }) {
  return (
    <Source id={`route-${id}`} type="geojson" data={{ type: 'Feature', properties: {}, geometry }}>
      <Layer
        id={`route-${id}-line`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': chosen ? '#e3f58c' : '#6b6b73',
          'line-width': chosen ? 6 : 4,
          'line-opacity': chosen ? 1 : 0.7,
        }}
      />
    </Source>
  )
}

export default MapView
