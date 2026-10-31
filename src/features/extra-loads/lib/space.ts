// Does a load fit in the space left? Boxes of the active plan stay where they are (fitAdditional); the new
// units go between the existing stops (fractional load / unload order).
import { fitAdditional } from '@/features/load-planner'
import type { PackContainer, PackItem, PackOptions, PackResult, Placement } from '@/types/domain'
import { listingPackItems, type Candidate, type SpaceCheck } from './candidates'

export function checkSpace(
  container: PackContainer,
  base: Placement[],
  baseItems: PackItem[],
  candidate: Pick<Candidate, 'listing' | 'units' | 'loadOrder' | 'unloadOrder'>,
  options: PackOptions = {},
): { check: SpaceCheck; result: PackResult } {
  const extra = listingPackItems(candidate)
  const result = fitAdditional(container, base, [...baseItems, ...extra], options)
  // nothing may drop out — neither the new load nor cargo that was already planned
  const alreadyMissing = baseItems.length - base.length
  const check: SpaceCheck =
    result.unplaced.length <= alreadyMissing ? 'OK' : result.unplaced.some((u) => u.reason === 'ORDER_CONFLICT') ? 'ORDER_CONFLICT' : 'NO_SPACE'
  return { check, result }
}
