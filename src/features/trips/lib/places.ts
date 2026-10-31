// Freight hubs for the New trip wizard. Every place used by the sample data is here at exactly the
// sample coordinates (so stops, listings and POIs line up); the rest are city / industrial-area centres.
export interface Place {
  id: string
  name: string
  city: string
  state: string
  lat: number
  lng: number
}

const p = (id: string, name: string, city: string, state: string, lat: number, lng: number): Place => ({ id, name, city, state, lat, lng })

export const places: Place[] = [
  // sample data places (exact coordinates from the seed)
  p('manesar', 'Manesar warehouse', 'Gurugram', 'HR', 28.354, 76.9366),
  p('jaipur-sitapura', 'Jaipur (Sitapura)', 'Jaipur', 'RJ', 26.7787, 75.8306),
  p('jaipur-vkia', 'Jaipur (VKIA)', 'Jaipur', 'RJ', 26.967, 75.77),
  p('ahmedabad-narol', 'Ahmedabad (Narol)', 'Ahmedabad', 'GJ', 22.9536, 72.5947),
  p('ahmedabad-aslali', 'Ahmedabad (Aslali)', 'Ahmedabad', 'GJ', 22.9196, 72.5996),
  p('mumbai-bhiwandi', 'Mumbai (Bhiwandi)', 'Bhiwandi', 'MH', 19.2813, 73.0483),
  p('vadodara', 'Vadodara', 'Vadodara', 'GJ', 22.3072, 73.1812),
  p('vadodara-makarpura', 'Vadodara (Makarpura)', 'Vadodara', 'GJ', 22.2587, 73.1902),
  p('surat-sachin', 'Surat (Sachin GIDC)', 'Surat', 'GJ', 21.085, 72.882),
  p('surat-kamrej', 'Surat (Kamrej)', 'Surat', 'GJ', 21.2706, 72.959),
  p('himmatnagar', 'Himmatnagar', 'Himmatnagar', 'GJ', 23.5986, 72.9665),
  p('kishangarh', 'Kishangarh', 'Kishangarh', 'RJ', 26.59, 74.854),
  p('beawar', 'Beawar', 'Beawar', 'RJ', 26.1011, 74.32),
  p('udaipur', 'Udaipur', 'Udaipur', 'RJ', 24.5854, 73.7125),
  p('bharuch', 'Bharuch', 'Bharuch', 'GJ', 21.7051, 72.9959),
  p('vapi', 'Vapi', 'Vapi', 'GJ', 20.3893, 72.9106),
  p('indore', 'Indore', 'Indore', 'MP', 22.7196, 75.8577),
  p('bhopal', 'Bhopal', 'Bhopal', 'MP', 23.2599, 77.4126),
  // NH48 corridor
  p('gurugram', 'Gurugram', 'Gurugram', 'HR', 28.4595, 77.0266),
  p('dharuhera', 'Dharuhera', 'Rewari', 'HR', 28.206, 76.797),
  p('neemrana', 'Neemrana', 'Alwar', 'RJ', 27.987, 76.388),
  p('behror', 'Behror', 'Alwar', 'RJ', 27.888, 76.286),
  p('kotputli', 'Kotputli', 'Jaipur', 'RJ', 27.703, 76.199),
  p('ajmer', 'Ajmer', 'Ajmer', 'RJ', 26.4499, 74.6399),
  p('bhilwara', 'Bhilwara', 'Bhilwara', 'RJ', 25.347, 74.641),
  p('chittorgarh', 'Chittorgarh', 'Chittorgarh', 'RJ', 24.8887, 74.6269),
  p('gandhinagar', 'Gandhinagar', 'Gandhinagar', 'GJ', 23.2156, 72.6369),
  p('nadiad', 'Nadiad', 'Kheda', 'GJ', 22.6916, 72.8634),
  p('anand', 'Anand', 'Anand', 'GJ', 22.5645, 72.9289),
  p('ankleshwar', 'Ankleshwar', 'Bharuch', 'GJ', 21.6264, 73.0152),
  p('navsari', 'Navsari', 'Navsari', 'GJ', 20.9467, 72.952),
  p('valsad', 'Valsad', 'Valsad', 'GJ', 20.5992, 72.9342),
  p('palghar', 'Palghar', 'Palghar', 'MH', 19.6967, 72.7699),
  p('vasai', 'Vasai', 'Palghar', 'MH', 19.3919, 72.8397),
  p('thane', 'Thane', 'Thane', 'MH', 19.2183, 72.9781),
  p('mumbai', 'Mumbai', 'Mumbai', 'MH', 19.076, 72.8777),
  p('navi-mumbai', 'Navi Mumbai (Taloja)', 'Navi Mumbai', 'MH', 19.0654, 73.1185),
  p('jnpt', 'JNPT (Nhava Sheva)', 'Navi Mumbai', 'MH', 18.9496, 72.9517),
  // other big freight hubs
  p('delhi', 'Delhi', 'Delhi', 'DL', 28.6139, 77.209),
  p('faridabad', 'Faridabad', 'Faridabad', 'HR', 28.4089, 77.3178),
  p('noida', 'Noida', 'Noida', 'UP', 28.5355, 77.391),
  p('ludhiana', 'Ludhiana', 'Ludhiana', 'PB', 30.901, 75.8573),
  p('kanpur', 'Kanpur', 'Kanpur', 'UP', 26.4499, 80.3319),
  p('lucknow', 'Lucknow', 'Lucknow', 'UP', 26.8467, 80.9462),
  p('agra', 'Agra', 'Agra', 'UP', 27.1767, 78.0081),
  p('kota', 'Kota', 'Kota', 'RJ', 25.2138, 75.8648),
  p('jodhpur', 'Jodhpur', 'Jodhpur', 'RJ', 26.2389, 73.0243),
  p('rajkot', 'Rajkot', 'Rajkot', 'GJ', 22.3039, 70.8022),
  p('mundra', 'Mundra Port', 'Kutch', 'GJ', 22.8396, 69.7203),
  p('pithampur', 'Pithampur', 'Dhar', 'MP', 22.6139, 75.6789),
  p('nagpur', 'Nagpur', 'Nagpur', 'MH', 21.1458, 79.0882),
  p('nashik', 'Nashik', 'Nashik', 'MH', 19.9975, 73.7898),
  p('pune-chakan', 'Pune (Chakan)', 'Pune', 'MH', 18.7606, 73.8636),
  p('pune', 'Pune', 'Pune', 'MH', 18.5204, 73.8567),
  p('aurangabad', 'Aurangabad', 'Aurangabad', 'MH', 19.8762, 75.3433),
  p('hyderabad', 'Hyderabad', 'Hyderabad', 'TG', 17.385, 78.4867),
  p('bengaluru', 'Bengaluru', 'Bengaluru', 'KA', 12.9716, 77.5946),
  p('chennai', 'Chennai', 'Chennai', 'TN', 13.0827, 80.2707),
  p('kolkata', 'Kolkata', 'Kolkata', 'WB', 22.5726, 88.3639),
  p('raipur', 'Raipur', 'Raipur', 'CG', 21.2514, 81.6296),
]

/** Search hubs by name or city (case and spaces ignored). */
export function searchPlaces(q: string, list: Place[] = places): Place[] {
  const s = q.trim().toLowerCase()
  if (!s) return list
  return list.filter((x) => x.name.toLowerCase().includes(s) || x.city.toLowerCase().includes(s))
}
