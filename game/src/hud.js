// Azura Bay — HUD: all DOM updates plus the 2D minimap canvas.
// The minimap is drawn every frame from live positions: hero, police,
// traffic, mission marker and the coastline.

import { CITY } from './config.js';

const $ = (id) => document.getElementById(id);

const RESPONSE_UNITS = [
  ['KITE-1', 'MARKSMAN', '15 m', '#37e08b'],
  ['MARLIN-3', 'SHORE WATCH', '187 m', '#5ec8ff'],
  ['CORAL-48', 'RAMMING', '7 m', '#ff5e7a'],
  ['CORAL-85', 'FLANKING', '14 m', '#ff5e7a'],
  ['CORAL-43', 'RAMMING', '15 m', '#ff5e7a'],
];

export function setMission(m) {
  $('m-stage').textContent = m.stage;
  $('m-title').textContent = m.title;
  $('m-obj').textContent = m.obj;
  $('m-sub').innerHTML = m.sub;
  $('m-bar').style.width = m.bar + '%';
}

export function setResponse(units, wanted) {
  $('r-units').textContent = units + ' UNITS';
  if (units === 0) {
    $('r-table').innerHTML = '<tr><td colspan="3" style="color:#8fa8c8">NO UNITS ON SCENE — YOU ARE CLEAR</td></tr>';
    return;
  }
  const rows = RESPONSE_UNITS.slice(0, Math.max(1, Math.min(5, units)));
  $('r-table').innerHTML = rows.map(([name, role, dist, color]) =>
    '<tr><td><span class="dot" style="background:' + color + '"></span>' + name + '</td><td>' + role + '</td><td>' + dist + '</td></tr>',
  ).join('') + (units > 5 ? '<tr><td colspan="3" style="color:#8fa8c8">+ ' + (units - 5) + ' more</td></tr>' : '');
}

export function setDistrict(name, street, pct) {
  $('d-name').textContent = name;
  $('d-street').textContent = street;
  $('d-bar').style.width = pct + '%';
  $('d-tag').textContent = (pct > 70 ? 'HOT · ' : pct > 40 ? 'NEUTRAL · ' : 'CALM · ') + pct;
}

export function setVitals(hp, armour) {
  $('v-hp').style.width = hp + '%';
  $('v-hpn').textContent = hp;
  $('v-ar').style.width = armour + '%';
  $('v-arn').textContent = armour;
}

export function setMoney(n) {
  $('money').textContent = '$' + n.toLocaleString('en-US');
}

export function setStars(n) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < n ? '★' : '<span class="off">★</span>';
  $('stars').innerHTML = s;
}

export function setClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  $('clock').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function setSpeed(kmh, carName, dent) {
  $('spd').textContent = Math.round(kmh);
  $('carname').textContent = carName;
  $('cardmg').textContent = dent + '% DENTED';
}

export function setRank(rp, max) {
  $('rank-bar').style.width = Math.min(100, (rp / max) * 100) + '%';
  $('rank-sub').textContent = rp.toLocaleString('en-US') + ' / ' + max.toLocaleString('en-US') + ' RP';
}

export function setDialogue(who, line) {
  $('dlg-who').textContent = who;
  $('dlg-line').textContent = line;
  document.querySelector('#dialogue .av').textContent = who.split(' ').map((w) => w[0]).join('').slice(0, 2);
}

export function setAirUnit(on) {
  $('airunit').style.visibility = on ? 'visible' : 'hidden';
}

export function setRadio(text) {
  $('radio').textContent = text;
}

let toastTimer = 0;
export function toast(big, small, ms) {
  $('toast-big').textContent = big;
  $('toast-small').textContent = small;
  $('toast').style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').style.display = 'none'; }, ms || 2600);
}

// ---- minimap ---------------------------------------------------------------
const mm = $('minimap');
const mg = mm.getContext('2d');

export function drawMinimap(state) {
  const W = mm.width, H = mm.height;
  const z0 = -290, z1 = 290;
  const x0 = -110, x1 = 110;
  const px = (x) => ((x - x0) / (x1 - x0)) * W;
  const pz = (z) => ((z - z0) / (z1 - z0)) * H;
  mg.clearRect(0, 0, W, H);
  // land + sea
  mg.fillStyle = '#223d2a'; mg.fillRect(0, 0, W, H);
  mg.fillStyle = '#c9a86a'; mg.fillRect(px(22), 0, px(78) - px(22), H);
  mg.fillStyle = '#1d6f8f'; mg.fillRect(px(78), 0, W - px(78), H);
  // city blocks
  mg.fillStyle = '#3a4a63';
  for (let z = -270; z < 275; z += 46) mg.fillRect(px(-52), pz(z - 20), px(-18) - px(-52), pz(z + 20) - pz(z - 20));
  // roads
  mg.fillStyle = '#3a4152';
  mg.fillRect(px(-11), 0, px(11) - px(-11), H);
  mg.fillStyle = '#f7c948';
  mg.fillRect(px(-0.6), 0, 1.5, H);
  // market plaza + customs
  mg.fillStyle = '#ff5ed8'; mg.fillRect(px(-26), pz(-84), px(-16) - px(-26), pz(66) - pz(-84));
  mg.fillStyle = '#ffd34d'; mg.fillRect(px(-49), pz(-249), px(-19) - px(-49), pz(-227) - pz(-249));
  // mission marker
  if (state.mission) {
    mg.fillStyle = '#ffd34d';
    mg.beginPath(); mg.arc(px(state.mission.x), pz(state.mission.z), 6, 0, Math.PI * 2); mg.fill();
    mg.strokeStyle = '#14080a'; mg.lineWidth = 2; mg.stroke();
    mg.fillStyle = '#14080a'; mg.font = 'bold 9px sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
    mg.fillText('!', px(state.mission.x), pz(state.mission.z));
  }
  // traffic dots
  mg.fillStyle = '#dfe8ff';
  for (const c of state.traffic || []) { mg.fillRect(px(c.x) - 1.5, pz(c.z) - 1.5, 3, 3); }
  // police dots (red/blue)
  for (const p of state.police || []) {
    mg.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#ff4444' : '#4488ff';
    mg.beginPath(); mg.arc(px(p.x), pz(p.z), 3.5, 0, Math.PI * 2); mg.fill();
  }
  // hero arrow
  const hx = px(state.hero.x), hz = pz(state.hero.z);
  mg.save();
  mg.translate(hx, hz);
  mg.rotate(Math.atan2(Math.sin(state.hero.heading), Math.cos(state.hero.heading)) + Math.PI / 2);
  mg.fillStyle = '#fff';
  mg.beginPath(); mg.moveTo(0, -8); mg.lineTo(5.5, 6); mg.lineTo(-5.5, 6); mg.closePath(); mg.fill();
  mg.strokeStyle = '#ff7a1a'; mg.lineWidth = 2; mg.stroke();
  mg.restore();
  // north + labels
  mg.fillStyle = '#fff'; mg.font = 'bold 11px sans-serif'; mg.textAlign = 'left';
  mg.fillText('N', 6, 14);
  mg.font = '9px sans-serif'; mg.fillStyle = 'rgba(255,255,255,.75)';
  mg.fillText('AZURA BAY', 6, H - 6);
}
