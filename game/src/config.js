// Azura Bay — shared constants: city layout, names, palette, tuning.
// Everything original: Azura Bay is a fictional city, none of its names,
// people or places come from any commercial game.

export const CITY = {
  name: 'AZURA BAY',
  // The main boulevard runs north (-z) to south (+z) along the beach.
  roadX: 0,            // centre line of Strand Boulevard
  roadHalf: 11,        // half width of the drivable road
  roadLength: 560,     // boulevard length, z in [-280, 280]
  beachX: 26,          // beach starts here (sea further east)
  seaX: 78,
  blockDepth: 34,      // building blocks west of the road
};

export const DISTRICTS = [
  { name: 'GOLDEN STRAND', street: 'Strand Boulevard', z: [-280, -90] },
  { name: 'NEON ROW', street: 'Lantern Avenue', z: [-90, 60] },
  { name: 'MARINA QUAY', street: 'Harbour Drive', z: [60, 280] },
];

export const PALETTE = {
  skyTop: 0x3568a8,
  skyMid: 0x93b4d8,
  skyLow: 0xff9a5c,
  sun: 0xffd9a0,
  heroOrange: 0xff7a1a,
  heroGold: 0xffc93c,
  policeWhite: 0xf2f4f6,
  policeBlack: 0x14181f,
  sea: 0x2fa8a0,
  sand: 0xe8c98f,
  asphalt: 0x2e3138,
};

export const TUNING = {
  heroTopSpeed: 62,     // m/s ~ 223 km/h
  heroAccel: 26,
  heroBrake: 46,
  heroGrip: 7.5,
  trafficSpeed: 13,
  policeSpeed: 47,
  wantedMax: 5,
  camHeight: 7.2,
  camDist: 13.5,
};

export const MISSIONS = [
  { id: 1, title: 'MISSION 1 — FIRST LIGHT', stage: 'STAGE 1/4', obj: 'STEAL THE SOLARA', sub: 'Lift the orange Solara GT from the marina car park.<br><b>NEXT</b> &nbsp;Lose the patrol car', bar: 12 },
  { id: 2, title: 'MISSION 2 — LANTERN RUN', stage: 'STAGE 2/4', obj: 'THREAD THE MARKET', sub: 'Cut through Neon Row market without wrecking a stall.<br><b>NEXT</b> &nbsp;Reach the customs garage', bar: 38 },
  { id: 3, title: 'MISSION 3 — GOLD STANDARD', stage: 'STAGE 3/4', obj: 'PAINT IT GOLD', sub: 'Get the Solara resprayed in 24-karat gold at Azura Customs.<br><b>NEXT</b> &nbsp;Show it off on the Strand', bar: 55 },
  { id: 4, title: 'MISSION 4 — THE GLASS RUN', stage: 'STAGE 4/4', obj: 'LOSE THE REGENT', sub: "Outrun the Regent's convoy before it reaches the marina.<br><b>NEXT</b> &nbsp;Vanish into the night market", bar: 62 },
  { id: 5, title: 'MISSION 5 — GLASS AND GOLD', stage: 'STAGE 1/3', obj: 'OWN THE STRAND', sub: 'Hold 200 km/h down the whole boulevard at dusk.<br><b>NEXT</b> &nbsp;Azura Bay is yours', bar: 80 },
  { id: 6, title: 'MISSION 6 — THE GLASS RUN', stage: 'STAGE 3/4', obj: 'LOSE THE REGENT', sub: "Outrun the Regent's convoy before it reaches the marina.<br><b>NEXT</b> &nbsp;Vanish into the night market", bar: 62 },
];

export const CREW_LINES = [
  { who: 'KIRA VOSS', line: "He's making for the marina! Cut the Regent off before it reaches the water!" },
  { who: 'ZARA', line: 'Plates swapped. APD just lost your trail — for now. Keep moving!' },
  { who: 'RIO', line: 'Gold paint is still wet, boss. One scratch and I charge you double.' },
  { who: 'KIKI', line: 'Two units on Lantern, one chopper overhead. Market crowd is your cover.' },
  { who: 'KIRA VOSS', line: 'The whole Strand is watching. Give them a show they will never forget.' },
];

export const RADIO = ['♪ AZURA 98.4 — Island Pop', '♪ NEON FM — Midnight Drive', '♪ GOLD COAST — Sunset Mix', '♪ HARBOUR 101 — Bassline'];
