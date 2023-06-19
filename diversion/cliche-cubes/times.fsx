let bstart    = 2.153
let bpm       = 146.0
let bhz       = bpm/60.0
let bperiod   = 8.0/bhz
let btime n   = n*bperiod+bstart
let ibtime tm = (tm-bstart)/bperiod

