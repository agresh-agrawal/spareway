import { describe, expect, it } from 'vitest'
import { checkpointRows, inIndia, noEntryRows, parseCsv, tollRows, toSql } from './pois-lib.mjs'

const TOLLS = parseCsv(`seq,route_group,plaza_name,plaza_code,state,highway,section,latitude,longitude,car_jeep_van,lcv,truck_2axle,truck_3axle,truck_4to6axle,truck_7plus_axle,nearest_police_station,police_phone,nearest_hospital,route_patrol_phone,crane_phone
1,main_NH48,Shahjahanpur,9001,Rajasthan,NH48,Gurgaon-Jaipur,27.99978,76.430522,205,330,685,750,1080,1310,Shahjahanpur,01494-235231,Getwell,988,930
2,main_NH48,Nowhere,9999,Rajasthan,NH48,x,51.5,-0.12,1,1,1,1,1,1,a,b,c,d,e
3,main_NH48,BadRate,9998,Rajasthan,NH48,x,27,76,1,1,abc,1,1,1,a,b,c,d,e`)

describe('POI validator', () => {
  it('checks India bounds', () => {
    expect(inIndia(26.9, 75.8)).toBe(true)
    expect(inIndia(51.5, -0.12)).toBe(false)
    expect(inIndia(NaN, 75)).toBe(false)
  })

  it('keeps valid tolls, rejects outside India and non-numeric rates', () => {
    const errors = []
    const rows = tollRows(TOLLS, errors)
    expect(rows).toHaveLength(1)
    expect(rows[0].data.rate_inr).toEqual({ 2: 685, 3: 750, 4: 1080, 5: 1080, 6: 1080, 7: 1310 })
    expect(errors).toHaveLength(2)
  })

  it('places live checkpoints at their toll plaza and skips abolished ones', () => {
    const cps = parseCsv(`checkpoint_id,seq,name,checkpoint_type,route_group,state,highway,location,linked_toll_plaza_code,operated_by,status,status_as_of,trucks_stop
C1,1,Old post,commercial_tax,m,Rajasthan,NH48,x,9001,x,abolished,2017-07-01,no
C2,2,Khedi weigh bridge,weigh_bridge,m,Rajasthan,NH48,Shahjahanpur toll plaza,9001,x,operational,2026-10-29,yes
C3,3,Lost post,rto_border,m,Rajasthan,NH48,x,none,x,closure_ordered_still_operating,2025-12-01,yes`)
    const errors = []
    const rows = checkpointRows(cps, TOLLS, errors)
    expect(rows.map((r) => r.kind)).toEqual(['weighbridge'])
    expect(errors).toHaveLength(1)
  })

  it('groups no-entry windows per area, skips buses, maps 00:00 end to 24:00', () => {
    const rules = parseCsv(`rule_id,city,state,area,vehicle_class,direction,no_entry_start,no_entry_end,rule_type,valid_until,exemptions,rule_as_of,issued_by
N11,Mumbai,Maharashtra,Mumbai city incl Dahisar entry,heavy_vehicles,city_entry,08:00,11:00,standing,not_stated,x,2026-02-01,MTP
N12,Mumbai,Maharashtra,Mumbai city incl Dahisar entry,heavy_vehicles,city_entry,17:00,21:00,standing,not_stated,x,2026-02-01,MTP
N13,Mumbai,Maharashtra,South Mumbai,heavy_vehicles,city_entry,07:00,00:00,standing,not_stated,x,2026-02-01,MTP
N04,Ahmedabad,Gujarat,Ahmedabad city,buses_above_33_seats,city_entry,08:00,22:00,standing,not_stated,x,2026-10-09,APC`)
    const rows = noEntryRows(rules, [])
    expect(rows).toHaveLength(2)
    expect(rows[0].data.no_entry).toEqual([['08:00', '11:00'], ['17:00', '21:00']])
    expect(rows[1].data.no_entry).toEqual([['07:00', '24:00']])
  })

  it('writes re-runnable SQL with escaped quotes', () => {
    const sql = toSql([{ kind: 'dhaba', name: "Raju's", lat: 1, lng: 2, highway: '', city: '', state: '', data: {} }])
    expect(sql).toContain("delete from public.pois where source = 'vansh-2026-10-29'")
    expect(sql).toContain("'Raju''s'")
  })
})
