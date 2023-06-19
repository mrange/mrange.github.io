let bstart    = 16.62
let bpm       = 125.0
let bhz       = bpm/60.0
let bperiod   = 8.0/bhz
let btime n   = n*bperiod+bstart
let ibtime tm = (tm-bstart)/bperiod

