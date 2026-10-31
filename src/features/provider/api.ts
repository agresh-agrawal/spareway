// Load providers (stage 5): no-login posting link, a share link per load (see, edit, cancel, answer counter-offers),
// and the owner's counter-offers. SQL: prephase4code_provider_offers.sql. Fixture mode (?fixture=seed, dev only)
// keeps the same rules in the in-memory store.
import { getSupabase } from '@/lib/supabase'
import { AppError, throwIfDataError, toAppError } from '@/lib/errors'
import { fixtureDelay, fixtureStore, isFixtureMode } from '@/lib/fixtures'
import type { Tables } from '@/types/database'

export type Offer = Tables<'listing_offers'>

export interface ProviderLoad {
  goods: string
  note: string
  pickupName: string
  pickupLat: number
  pickupLng: number
  dropName: string
  dropLat: number
  dropLng: number
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  quantity: number
  fragile: boolean
  priceInr: number
  readyFrom: string
  deliverBy: string
}

export interface SharedLoad {
  load: ProviderLoad & {
    code: string
    status: string
    shipperName: string
    shipperPhone: string
    createdAt: string
  }
  sharedBy: { name: string; phone: string }
  offers: {
    id: string
    amount: number
    note: string
    status: string
    company: string
    phone: string
    at: string
  }[]
}

const hex = (n: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('')

// ---------- owner ----------

/** The company's provider link token (made on first use); `fresh` replaces the old link. */
export async function getProviderLink(fresh = false): Promise<string> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    if (fresh) for (const l of d.provider_links) l.enabled = false
    let link = d.provider_links.find((l) => l.enabled)
    if (!link) {
      link = {
        id: crypto.randomUUID(),
        company_id: d.company.id,
        token: hex(18),
        enabled: true,
        created_at: new Date().toISOString(),
      }
      d.provider_links.push(link)
    }
    return fixtureDelay(link.token)
  }
  const { data, error } = await getSupabase().rpc('get_provider_link', { p_new: fresh })
  if (error) throw toAppError(error)
  return (data as { token: string }).token
}

/** Offers on these listings that I can see (mine, and others' on loads my company shared). */
export async function listOffers(listingIds: string[]): Promise<Offer[]> {
  if (listingIds.length === 0) return []
  if (isFixtureMode())
    return fixtureDelay(fixtureStore().listing_offers.filter((o) => listingIds.includes(o.listing_id)))
  const { data, error } = await getSupabase()
    .from('listing_offers')
    .select('*')
    .in('listing_id', listingIds)
    .order('created_at', { ascending: false })
  if (error) throw toAppError(error)
  return data
}

export async function makeOffer(listingId: string, amountInr: number, note: string): Promise<void> {
  if (!(amountInr > 0 && amountInr <= 10_000_000)) throw new AppError('BAD_ITEMS')
  if (isFixtureMode()) {
    const d = fixtureStore()
    const l = d.freight_listings.find((x) => x.id === listingId)
    if (!l || l.status !== 'open') throw new AppError('LISTING_NOT_OPEN')
    d.listing_offers.push({
      id: crypto.randomUUID(),
      listing_id: listingId,
      company_id: d.company.id,
      amount_inr: Math.round(amountInr),
      note: note.trim().slice(0, 200),
      status: 'pending',
      created_at: new Date().toISOString(),
      answered_at: null,
    })
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase()
    .from('listing_offers')
    .insert({ listing_id: listingId, amount_inr: Math.round(amountInr), note: note.trim().slice(0, 200) })
  if (error) throw toAppError(error)
}

export async function withdrawOffer(id: string): Promise<void> {
  if (isFixtureMode()) {
    const o = fixtureStore().listing_offers.find((x) => x.id === id && x.status === 'pending')
    if (o) o.status = 'withdrawn'
    return fixtureDelay(undefined)
  }
  const { error } = await getSupabase().from('listing_offers').update({ status: 'withdrawn' }).eq('id', id)
  if (error) throw toAppError(error)
}

// ---------- provider (no login) ----------

function fixtureLink(token: string) {
  const l = fixtureStore().provider_links.find((x) => x.token === token && x.enabled)
  if (!l) throw new AppError('LINK_INVALID')
  return l
}

export async function getLinkInfo(
  token: string,
): Promise<{ company: { name: string; phone: string; city: string } }> {
  if (isFixtureMode()) {
    fixtureLink(token)
    const c = fixtureStore().company
    return fixtureDelay({ company: { name: c.name, phone: c.phone, city: c.city } })
  }
  const { data, error } = await getSupabase().rpc('provider_link_info', { p_token: token })
  if (error) throw toAppError(error)
  return throwIfDataError(data) as unknown as { company: { name: string; phone: string; city: string } }
}

const toIso = (date: string) => (date ? new Date(`${date}T00:00:00+05:30`).toISOString() : '')

export async function postLoads(
  token: string,
  shipper: { name: string; phone: string },
  loads: ProviderLoad[],
): Promise<{ code: string; shareToken: string }[]> {
  const body = loads.map((l) => ({ ...l, readyFrom: toIso(l.readyFrom), deliverBy: toIso(l.deliverBy) }))
  if (isFixtureMode()) {
    const link = fixtureLink(token)
    const d = fixtureStore()
    const out: { code: string; shareToken: string }[] = []
    for (const l of body) {
      const max = d.freight_listings
        .filter((x) => x.company_id === link.company_id && /^LD-\d+$/.test(x.code))
        .reduce((m, x) => Math.max(m, Number(x.code.slice(3))), 2000)
      const code = `LD-${max + 1}`
      const shareToken = hex(12)
      d.freight_listings.push({
        id: crypto.randomUUID(),
        company_id: link.company_id,
        code,
        visibility: 'public',
        shipper_name: shipper.name.trim(),
        shipper_phone: shipper.phone.trim(),
        goods_type: l.goods.trim(),
        description: l.note,
        pickup_name: l.pickupName,
        pickup_lat: l.pickupLat,
        pickup_lng: l.pickupLng,
        drop_name: l.dropName,
        drop_lat: l.dropLat,
        drop_lng: l.dropLng,
        length_cm: l.lengthCm,
        width_cm: l.widthCm,
        height_cm: l.heightCm,
        weight_kg: l.weightKg,
        quantity: l.quantity,
        fragile: l.fragile,
        upright_only: false,
        stackable: !l.fragile,
        offered_rate_inr: Math.round(l.priceInr),
        ready_from: l.readyFrom || new Date().toISOString(),
        deliver_by: l.deliverBy || null,
        status: 'open',
        share_token: shareToken,
        provider_link_id: link.id,
        posted_by: null,
        accepted_by_company: null,
        is_sample: false,
        created_at: new Date().toISOString(),
      })
      out.push({ code, shareToken })
    }
    return fixtureDelay(out)
  }
  const { data, error } = await getSupabase().rpc('provider_post_loads', {
    p_token: token,
    p_shipper: shipper,
    p_loads: body as never,
  })
  if (error) throw toAppError(error)
  return (throwIfDataError(data) as unknown as { loads: { code: string; shareToken: string }[] }).loads
}

function fixtureShared(share: string): SharedLoad {
  const d = fixtureStore()
  const l = d.freight_listings.find((x) => x.share_token === share)
  if (!l) throw new AppError('LINK_INVALID')
  return {
    load: {
      code: l.code,
      status: l.status,
      goods: l.goods_type,
      note: l.description,
      shipperName: l.shipper_name,
      shipperPhone: l.shipper_phone,
      pickupName: l.pickup_name,
      pickupLat: l.pickup_lat,
      pickupLng: l.pickup_lng,
      dropName: l.drop_name,
      dropLat: l.drop_lat,
      dropLng: l.drop_lng,
      lengthCm: Number(l.length_cm),
      widthCm: Number(l.width_cm),
      heightCm: Number(l.height_cm),
      weightKg: Number(l.weight_kg),
      quantity: l.quantity,
      fragile: l.fragile,
      priceInr: Number(l.offered_rate_inr),
      readyFrom: l.ready_from ?? '',
      deliverBy: l.deliver_by ?? '',
      createdAt: l.created_at,
    },
    sharedBy: { name: d.company.name, phone: d.company.phone },
    offers: d.listing_offers
      .filter((o) => o.listing_id === l.id && o.status !== 'withdrawn')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((o) => ({
        id: o.id,
        amount: Number(o.amount_inr),
        note: o.note,
        status: o.status,
        company: d.company.name,
        phone: d.company.phone,
        at: o.created_at,
      })),
  }
}

export async function getSharedLoad(share: string): Promise<SharedLoad> {
  if (isFixtureMode()) return fixtureDelay(fixtureShared(share))
  const { data, error } = await getSupabase().rpc('provider_get_load', { p_share: share })
  if (error) throw toAppError(error)
  return throwIfDataError(data) as unknown as SharedLoad
}

export async function updateSharedLoad(share: string, load: ProviderLoad): Promise<void> {
  const body = { ...load, readyFrom: toIso(load.readyFrom), deliverBy: toIso(load.deliverBy) }
  if (isFixtureMode()) {
    const l = fixtureStore().freight_listings.find((x) => x.share_token === share)
    if (!l) throw new AppError('LINK_INVALID')
    if (l.status !== 'open') throw new AppError('LISTING_NOT_OPEN')
    Object.assign(l, {
      goods_type: body.goods.trim(),
      description: body.note,
      pickup_name: body.pickupName,
      pickup_lat: body.pickupLat,
      pickup_lng: body.pickupLng,
      drop_name: body.dropName,
      drop_lat: body.dropLat,
      drop_lng: body.dropLng,
      length_cm: body.lengthCm,
      width_cm: body.widthCm,
      height_cm: body.heightCm,
      weight_kg: body.weightKg,
      quantity: body.quantity,
      fragile: body.fragile,
      stackable: !body.fragile,
      offered_rate_inr: Math.round(body.priceInr),
      ready_from: body.readyFrom || l.ready_from,
      deliver_by: body.deliverBy || null,
    })
    return fixtureDelay(undefined)
  }
  const { data, error } = await getSupabase().rpc('provider_update_load', {
    p_share: share,
    p_load: body as never,
  })
  if (error) throw toAppError(error)
  throwIfDataError(data)
}

export async function cancelSharedLoad(share: string): Promise<void> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const l = d.freight_listings.find(
      (x) => x.share_token === share && (x.status === 'open' || x.status === 'reserved'),
    )
    if (!l) throw new AppError('LISTING_NOT_OPEN')
    l.status = 'expired'
    for (const o of d.listing_offers)
      if (o.listing_id === l.id && o.status === 'pending') o.status = 'rejected'
    return fixtureDelay(undefined)
  }
  const { data, error } = await getSupabase().rpc('provider_cancel_load', { p_share: share })
  if (error) throw toAppError(error)
  throwIfDataError(data)
}

export async function answerOffer(share: string, offerId: string, accept: boolean): Promise<void> {
  if (isFixtureMode()) {
    const d = fixtureStore()
    const l = d.freight_listings.find((x) => x.share_token === share)
    if (!l) throw new AppError('LINK_INVALID')
    const o = d.listing_offers.find(
      (x) => x.id === offerId && x.listing_id === l.id && x.status === 'pending',
    )
    if (!o) throw new AppError('BAD_ITEMS')
    if (accept && l.status !== 'open') throw new AppError('LISTING_NOT_OPEN')
    o.status = accept ? 'accepted' : 'rejected'
    if (accept) {
      Object.assign(l, {
        offered_rate_inr: o.amount_inr,
        status: 'reserved',
        accepted_by_company: o.company_id,
      })
      for (const x of d.listing_offers)
        if (x.listing_id === l.id && x.id !== o.id && x.status === 'pending') x.status = 'rejected'
    }
    return fixtureDelay(undefined)
  }
  const { data, error } = await getSupabase().rpc('provider_answer_offer', {
    p_share: share,
    p_offer_id: offerId,
    p_accept: accept,
  })
  if (error) throw toAppError(error)
  throwIfDataError(data)
}
