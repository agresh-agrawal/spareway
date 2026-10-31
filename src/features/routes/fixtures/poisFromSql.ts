// Fixture mode + tests: the real route POIs, read straight from supabase/sql/phase0_pois_real.sql so there is
// one source of truth (the fixture store has no POIs). Not used with a real database.
import type { PoiInput } from '../lib/pois'

/** Split one SQL tuple body into values: 'text' (with '' escapes), numbers, true/false, '{json}'::jsonb. */
function splitTuple(body: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < body.length) {
    while (body[i] === ' ' || body[i] === ',') i++
    if (i >= body.length) break
    if (body[i] === "'") {
      let s = ''
      i++
      while (i < body.length) {
        if (body[i] === "'" && body[i + 1] === "'") {
          s += "'"
          i += 2
        } else if (body[i] === "'") {
          i++
          break
        } else s += body[i++]
      }
      if (body.startsWith('::jsonb', i)) i += 7
      out.push(s)
    } else {
      let s = ''
      while (i < body.length && body[i] !== ',') s += body[i++]
      out.push(s.trim())
    }
  }
  return out
}

export function parsePoisSql(sql: string): PoiInput[] {
  const out: PoiInput[] = []
  for (const raw of sql.split('\n')) {
    const line = raw.trim()
    if (!line.startsWith("('")) continue
    const body = line.replace(/^\(/, '').replace(/\)[,;]?$/, '')
    const v = splitTuple(body)
    if (v.length < 10) continue
    const [kind, name, lat, lng, , city, , data] = v
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      parsed = {}
    }
    out.push({ id: `poi-${out.length + 1}`, kind, name, lat: Number(lat), lng: Number(lng), city, data: parsed })
  }
  return out
}

let cache: PoiInput[] | null = null

/** The real POIs (lazy: the SQL text is only loaded in fixture mode / tests). */
export async function loadFixturePois(): Promise<PoiInput[]> {
  if (cache) return cache
  const sql = (await import('../../../../supabase/sql/phase0_pois_real.sql?raw')).default
  cache = parsePoisSql(sql)
  return cache
}
