// 3D load plan (Design System 9): cab block, see-through container, open doors, 50 cm floor grid, boxes in
// stop colours (instanced). Renders on demand; pixel ratio ≤ 1.5. Lazy-loaded so three.js stays out of the
// first load. Scene units are metres: X along the truck (cab −, doors +), Y up, Z across.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { PackContainer, Placement } from '@/types/domain'
import { stopColor } from '@/components/common/chips'
import type { BoxState } from '../lib/plan'
import { usePlanPalette, type PlanPalette } from '../lib/theme'

export type SceneView = '3d' | 'top' | 'side'

export interface TruckSceneProps {
  container: Pick<PackContainer, 'lengthCm' | 'widthCm' | 'heightCm'>
  placements: Placement[]
  view?: SceneView
  highlightKey?: string | null
  states?: Map<string, BoxState>
  visibleSteps?: number
  onSelect?: (key: string) => void
  className?: string
}

const M = 0.01 // cm → m

interface BoxGroup {
  keys: string[]
  matrices: THREE.Matrix4[]
  colors: THREE.Color[]
}

function boxMatrix(p: Placement, L: number, W: number): THREE.Matrix4 {
  const inset = 1 // 1 cm gap so neighbours read as separate boxes
  const pos = new THREE.Vector3((p.x + p.l / 2) * M - (L * M) / 2, (p.z + p.h / 2) * M, (p.y + p.w / 2) * M - (W * M) / 2)
  const scale = new THREE.Vector3(Math.max(0.001, (p.l - inset) * M), Math.max(0.001, (p.h - inset) * M), Math.max(0.001, (p.w - inset) * M))
  return new THREE.Matrix4().compose(pos, new THREE.Quaternion(), scale)
}

const unitBox = new THREE.BoxGeometry(1, 1, 1)

function Boxes({
  group,
  opacity,
  onSelect,
}: {
  group: BoxGroup
  opacity: number
  onSelect?: (key: string) => void
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const material = useMemo(() => new THREE.MeshLambertMaterial({ transparent: true, opacity }), [opacity])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    group.matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, group.colors[i])
    })
    mesh.count = group.keys.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
  }, [group, invalidate])
  if (group.keys.length === 0) return null
  return (
    <instancedMesh
      key={group.keys.length}
      ref={ref}
      args={[unitBox, material, group.keys.length]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (e.instanceId !== undefined) onSelect?.(group.keys[e.instanceId])
      }}
    />
  )
}

/** All box edges in one line geometry: darker edges, amber for fragile, lime for the selected box, red for problems. */
function BoxEdges({ placements, L, W, highlightKey, states, c }: { placements: Placement[]; L: number; W: number; highlightKey?: string | null; states?: Map<string, BoxState>; c: PlanPalette }) {
  const geometry = useMemo(() => {
    const edges = new THREE.EdgesGeometry(unitBox)
    const base = edges.getAttribute('position')
    const pos: number[] = []
    const col: number[] = []
    const v = new THREE.Vector3()
    for (const p of placements) {
      const m = boxMatrix(p, L, W)
      const st = states?.get(p.key)
      const edge =
        p.key === highlightKey
          ? new THREE.Color(c.selected)
          : st === 'issue'
            ? new THREE.Color(c.issue)
            : p.fragile
              ? new THREE.Color(c.fragile)
              : new THREE.Color(stopColor(p.unloadOrder)).lerp(new THREE.Color(c.boxEdgeMix), 0.55)
      for (let i = 0; i < base.count; i++) {
        v.fromBufferAttribute(base, i).applyMatrix4(m)
        pos.push(v.x, v.y, v.z)
        col.push(edge.r, edge.g, edge.b)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    edges.dispose()
    return g
  }, [placements, L, W, highlightKey, states, c])
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors />
    </lineSegments>
  )
}

function Truck({ L, W, H, c }: { L: number; W: number; H: number; c: PlanPalette }) {
  const l = L * M
  const w = W * M
  const h = H * M
  const shell = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(l, h, w)), [l, w, h])
  const grid = useMemo(() => {
    const pts: number[] = []
    for (let x = 50; x < L; x += 50) pts.push(x * M - l / 2, 0.002, -w / 2, x * M - l / 2, 0.002, w / 2)
    for (let z = 50; z < W; z += 50) pts.push(-l / 2, 0.002, z * M - w / 2, l / 2, 0.002, z * M - w / 2)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [L, W, l, w])
  const doors = useMemo(() => {
    // door frame at the back + two doors swung open
    const x = l / 2
    const pts = [
      [x, 0, -w / 2, x, h, -w / 2],
      [x, h, -w / 2, x, h, w / 2],
      [x, h, w / 2, x, 0, w / 2],
      // left door panel open towards +X
      [x, 0, -w / 2, x + w / 2, 0, -w / 2 - 0.02],
      [x + w / 2, 0, -w / 2 - 0.02, x + w / 2, h, -w / 2 - 0.02],
      [x + w / 2, h, -w / 2 - 0.02, x, h, -w / 2],
      // right door panel
      [x, 0, w / 2, x + w / 2, 0, w / 2 + 0.02],
      [x + w / 2, 0, w / 2 + 0.02, x + w / 2, h, w / 2 + 0.02],
      [x + w / 2, h, w / 2 + 0.02, x, h, w / 2],
    ].flat()
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [l, w, h])
  const cabLen = Math.min(1.8, l * 0.25)
  const cabEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(cabLen, h * 0.9, w)), [cabLen, h, w])
  return (
    <group>
      {/* container: 6 % fill + edges */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[l, h, w]} />
        <meshBasicMaterial color={c.containerFill} transparent opacity={0.06} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={shell} position={[0, h / 2, 0]}>
        <lineBasicMaterial color={c.edge} />
      </lineSegments>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color={c.grid3d} />
      </lineSegments>
      <lineSegments geometry={doors}>
        <lineBasicMaterial color={c.door} transparent opacity={c.doorOpacity} />
      </lineSegments>
      {/* cab */}
      <mesh position={[-l / 2 - cabLen / 2 - 0.15, (h * 0.9) / 2, 0]}>
        <boxGeometry args={[cabLen, h * 0.9, w]} />
        <meshLambertMaterial color={c.cab} />
      </mesh>
      <lineSegments geometry={cabEdges} position={[-l / 2 - cabLen / 2 - 0.15, (h * 0.9) / 2, 0]}>
        <lineBasicMaterial color={c.edge} />
      </lineSegments>
      <mesh position={[-l / 2 - cabLen - 0.16, h * 0.62, 0]}>
        <boxGeometry args={[0.02, h * 0.3, w * 0.86]} />
        <meshBasicMaterial color={c.cabWindow} />
      </mesh>
    </group>
  )
}

/** Camera distance so the whole truck (cab to open doors) fits the canvas width or height, whichever is tighter. */
function fitDistance(spanM: number, depthM: number, aspect: number, fov: number): number {
  const v = (fov * Math.PI) / 180
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect)
  return Math.max(spanM / 2 / Math.tan(h / 2), depthM / 2 / Math.tan(v / 2)) * 1.08
}

const FOV = 40

function Cameras({ view, L, W, H }: { view: SceneView; L: number; W: number; H: number }) {
  const size = useThree((s) => s.size)
  const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1.6
  const l = L * M
  const w = W * M
  const h = H * M
  const cab = Math.min(1.8, l * 0.25) + 0.15
  const span = l + cab + w / 2 // cab + container + open doors
  const cx = (w / 2 - cab) / 2 // centre of that span on X
  if (view === 'top') {
    const d = fitDistance(span, w * 2, aspect, FOV)
    return <PerspectiveCamera key="top" makeDefault fov={FOV} position={[cx, d + h, 0.001]} up={[0, 0, -1]} onUpdate={(c) => c.lookAt(cx, 0, 0)} />
  }
  if (view === 'side') {
    const d = fitDistance(span, h * 1.6, aspect, FOV)
    return <PerspectiveCamera key="side" makeDefault fov={FOV} position={[cx, h / 2, d + w / 2]} onUpdate={(c) => c.lookAt(cx, h / 2, 0)} />
  }
  const d = fitDistance(span, h * 2.2, aspect, FOV) * 1.3
  const dir = new THREE.Vector3(0.38, 0.5, 0.78).normalize()
  return (
    <>
      <PerspectiveCamera key="3d" makeDefault fov={FOV} position={[cx + dir.x * d, h / 2 + dir.y * d, dir.z * d]} />
      <OrbitControls makeDefault target={[cx, h / 2, 0]} enablePan={false} minDistance={2} maxDistance={d * 2.5} maxPolarAngle={Math.PI / 2.05} />
    </>
  )
}

export default function TruckScene({
  container,
  placements,
  view = '3d',
  highlightKey,
  states,
  visibleSteps,
  onSelect,
  className,
}: TruckSceneProps) {
  const c = usePlanPalette()
  const L = container.lengthCm
  const W = container.widthCm
  const H = container.heightCm
  const visible = useMemo(
    () => placements.filter((p) => visibleSteps === undefined || p.step <= visibleSteps),
    [placements, visibleSteps],
  )
  const [solid, faded] = useMemo(() => {
    const a: BoxGroup = { keys: [], matrices: [], colors: [] }
    const b: BoxGroup = { keys: [], matrices: [], colors: [] }
    for (const p of visible) {
      const st = states?.get(p.key)
      // a selected box stays solid while the others fade, so it stands out even in a lime stop colour
      const g = st === 'waiting' || (highlightKey && p.key !== highlightKey) ? b : a
      g.keys.push(p.key)
      g.matrices.push(boxMatrix(p, L, W))
      g.colors.push(st === 'issue' ? new THREE.Color(c.issue) : new THREE.Color(stopColor(p.unloadOrder)))
    }
    return [a, b]
  }, [visible, states, highlightKey, L, W, c])

  return (
    <div className={className}>
      <Canvas frameloop="demand" dpr={[1, 1.5]} gl={{ antialias: true }}>
        <color attach="background" args={[c.canvas]} />
        <ambientLight intensity={1.6} />
        <directionalLight position={[4, 8, 6]} intensity={1.4} />
        <Cameras view={view} L={L} W={W} H={H} />
        <Truck L={L} W={W} H={H} c={c} />
        <Boxes group={solid} opacity={0.85} onSelect={onSelect} />
        <Boxes group={faded} opacity={0.35} onSelect={onSelect} />
        <BoxEdges placements={visible} L={L} W={W} highlightKey={highlightKey} states={states} c={c} />
      </Canvas>
    </div>
  )
}
