// Stored units: cm, kg, km, ₹. Trucks shown in ft, cargo in cm (inch switch).
export const CM_PER_FT = 30.48
export const CM_PER_IN = 2.54

export const cmToFt = (cm: number) => cm / CM_PER_FT
export const ftToCm = (ft: number) => Math.round(ft * CM_PER_FT)
export const cmToIn = (cm: number) => cm / CM_PER_IN
export const inToCm = (inch: number) => Math.round(inch * CM_PER_IN * 10) / 10

/** cm³ → m³ */
export const cm3ToM3 = (cm3: number) => cm3 / 1e6

export const boxVolumeM3 = (lCm: number, wCm: number, hCm: number) => cm3ToM3(lCm * wCm * hCm)
