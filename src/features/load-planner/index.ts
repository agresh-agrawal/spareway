// Public API of load-planner for other features (Architecture F11). Import only from here.
// TruckScene is lazy (three.js in its own chunk); TopView / SideView are light SVG (loader page, Phase 2).
import { lazy } from 'react'

export { pack, fitAdditional, buildPackItems, computeInputHash, ENGINE_VERSION } from './engine'
export type { CargoRowInput, StopInput, TruckInput } from './engine'
export { TopView, SideView, type DrawingProps } from './components/drawings'
export { usePlanForTrip, usePacker, type PlanForTrip } from './hooks/usePlanForTrip'
export { resultFromRow } from './lib/plan'
export type { SceneView, TruckSceneProps } from './components/TruckScene'

export const TruckScene = lazy(() => import('./components/TruckScene'))
