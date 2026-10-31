import type { LngLat } from '@/lib/geo'
import { cumulativeKm, kmOfPoint, minutesToBreak, nextStopIndex, pointAlong, simulatedFraction, SPEED_UP } from './lib/simulate'

const line: LngLat[] = [
  [76.9366, 28.354], // Manesar
  [75.8306, 26.7787], // Jaipur
  [72.5947, 22.9536], // Ahmedabad
]

describe('position along a line at time t', () => {
  it('start, end and middle of the line', () => {
    expect(pointAlong(line, 0).point).toEqual(line[0])
    expect(pointAlong(line, 1).point).toEqual(line[2])
    const cum = cumulativeKm(line)
    const half = pointAlong(line, 0.5, cum)
    expect(half.km).toBeCloseTo(cum[2] / 2, 5)
  })
  it('clamps outside 0–1 and handles tiny lines', () => {
    expect(pointAlong(line, -1).point).toEqual(line[0])
    expect(pointAlong(line, 2).point).toEqual(line[2])
    expect(pointAlong([line[0]], 0.5).point).toEqual(line[0])
  })
  it('simulation: real time since departure, then ×60 since the page opened, capped at 98 %', () => {
    const dep = 0
    const opened = 60 * 60_000 // 1 h after departure
    expect(simulatedFraction(dep, 600, opened, opened)).toBeCloseTo(0.1, 5)
    // one real minute later the truck is 60 minutes further
    expect(simulatedFraction(dep, 600, opened + 60_000, opened)).toBeCloseTo((60 + SPEED_UP) / 600, 5)
    expect(simulatedFraction(dep, 600, opened + 24 * 3_600_000, opened)).toBe(0.98)
    expect(simulatedFraction(dep, 0, opened, opened)).toBe(0)
  })
  it('next stop and km of a stop on the line', () => {
    const cum = cumulativeKm(line)
    const kms = line.map((p) => kmOfPoint(line, p, cum))
    expect(kms[0]).toBe(0)
    expect(nextStopIndex(kms, 10)).toBe(1)
    expect(nextStopIndex(kms, kms[1] + 5)).toBe(2)
  })
  it('break timer from minutes driven', () => {
    expect(minutesToBreak(0, 5)).toBe(300)
    expect(minutesToBreak(260, 5)).toBe(40)
    expect(minutesToBreak(300, 5)).toBe(300)
  })
})
