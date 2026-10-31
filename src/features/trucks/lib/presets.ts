// Typical inside sizes of common Indian closed-body trucks — suggestions only ("typical — check your truck").
export interface TruckPreset {
  id: string
  label: string
  bodyType: 'closed' | 'container'
  lengthCm: number
  widthCm: number
  heightCm: number
  payloadKg: number
  axles: number
}

export const TRUCK_PRESETS: TruckPreset[] = [
  { id: '14ft', label: '14 ft', bodyType: 'closed', lengthCm: 427, widthCm: 183, heightCm: 198, payloadKg: 4000, axles: 2 },
  { id: '17ft', label: '17 ft', bodyType: 'closed', lengthCm: 518, widthCm: 213, heightCm: 213, payloadKg: 7000, axles: 2 },
  { id: '19ft', label: '19 ft', bodyType: 'closed', lengthCm: 579, widthCm: 214, heightCm: 214, payloadKg: 9000, axles: 2 },
  { id: '20ft', label: '20 ft', bodyType: 'closed', lengthCm: 610, widthCm: 229, heightCm: 229, payloadKg: 9000, axles: 2 },
  { id: '22ft', label: '22 ft', bodyType: 'container', lengthCm: 670, widthCm: 244, heightCm: 244, payloadKg: 9000, axles: 2 },
  { id: '24ft', label: '24 ft', bodyType: 'closed', lengthCm: 732, widthCm: 244, heightCm: 244, payloadKg: 10000, axles: 3 },
  { id: '32sxl', label: '32 ft SXL', bodyType: 'container', lengthCm: 975, widthCm: 235, heightCm: 244, payloadKg: 7500, axles: 2 },
  { id: '32mxl', label: '32 ft MXL', bodyType: 'container', lengthCm: 975, widthCm: 243, heightCm: 243, payloadKg: 15000, axles: 3 },
]
