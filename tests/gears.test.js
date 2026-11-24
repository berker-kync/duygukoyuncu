// Run: node tests/gears.test.js
import assert from 'node:assert/strict';
import { TEETH, PLANETS, RATIO, CENTER_DISTANCE, externalGear, internalGear, pose } from '../js/gears.js';

const inside = (p, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
// Add points along each edge so a thin tip cannot slip between vertices.
const dense = (poly) => poly.flatMap((a, i) => {
  const b = poly[(i + 1) % poly.length];
  return [0, 0.25, 0.5, 0.75].map((t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
});
const place = (poly, ang, d = 0, at = 0) => poly.map(([x, y]) => [
  x * Math.cos(ang) - y * Math.sin(ang) + d * Math.cos(at),
  x * Math.sin(ang) + y * Math.cos(ang) + d * Math.sin(at),
]);

assert.equal(TEETH.sun + 2 * TEETH.planet, TEETH.ring, 'teeth are coaxial');
assert.equal((TEETH.sun + TEETH.ring) % PLANETS, 0, 'planets space evenly');
assert.equal(RATIO, 3.5);

const sun = externalGear(TEETH.sun), planet = externalGear(TEETH.planet), ring = internalGear(TEETH.ring);
for (const g of [sun, planet, ring]) assert.ok(g.flat().every(Number.isFinite));

// The mesh repeats every sun tooth, so one carrier turn at a fine step covers every contact.
let frames = 0;
for (let a = 0; a < 2 * Math.PI * RATIO; a += 0.037) {
  const p = pose(a);
  const S = place(sun, p.sun), Sd = dense(S);
  for (const { at, spin } of p.planets) {
    const P = place(planet, spin, CENTER_DISTANCE, at), Pd = dense(P);
    assert.ok(!Pd.some((q) => inside(q, S)), `planet cuts sun at ${a}`);
    assert.ok(!Sd.some((q) => inside(q, P)), `sun cuts planet at ${a}`);
    assert.ok(Pd.every((q) => inside(q, ring)), `planet cuts ring at ${a}`);
  }
  frames++;
}
// Control: half a tooth out of phase must collide, otherwise the checks above prove nothing.
const bad = place(planet, pose(0).planets[0].spin + Math.PI / TEETH.planet, CENTER_DISTANCE, 0);
assert.ok(dense(bad).some((q) => inside(q, place(sun, 0))), 'control: wrong phase should collide');
assert.ok(dense(bad).some((q) => !inside(q, ring)), 'control: wrong phase should hit the ring');
console.log(`ok: ${frames} positions, no overlap, ratio ${RATIO}`);
