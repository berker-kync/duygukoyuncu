// Involute gear geometry for the planetary set. Pure maths, no rendering, so it can be checked in Node.
// Lengths are in modules (module = 1).

export const TEETH = { sun: 24, planet: 18, ring: 60 };
export const PLANETS = 3;
export const RADIUS = { sun: TEETH.sun / 2, planet: TEETH.planet / 2, ring: TEETH.ring / 2 };
export const CENTER_DISTANCE = RADIUS.sun + RADIUS.planet;
export const RATIO = 1 + TEETH.ring / TEETH.sun; // ring fixed, sun in, carrier out

const ALPHA = (20 * Math.PI) / 180; // pressure angle
const BACKLASH = 0.04; // per flank
const inv = (a) => Math.tan(a) - a;

// Half the angular tooth thickness at radius r, for pitch radius rp and z teeth.
function halfAngle(r, rp, z, thin) {
  const rb = rp * Math.cos(ALPHA);
  const a = r > rb ? Math.acos(rb / r) : 0;
  return Math.PI / (2 * z) + inv(ALPHA) - inv(a) - thin / rp;
}

function profile(z, rIn, rOut, thin, steps = 7) {
  const rp = z / 2;
  const rb = rp * Math.cos(ALPHA);
  const start = Math.max(rIn, rb);
  const pts = [];
  const polar = (r, a) => pts.push([r * Math.cos(a), r * Math.sin(a)]);
  for (let i = 0; i < z; i++) {
    const c = (i * 2 * Math.PI) / z;
    const half = (r) => halfAngle(r, rp, z, thin);
    if (rIn < start) polar(rIn, c - half(start));
    for (let s = 0; s <= steps; s++) {
      const r = start + ((rOut - start) * s) / steps;
      polar(r, c - half(r));
    }
    for (let s = steps; s >= 0; s--) {
      const r = start + ((rOut - start) * s) / steps;
      polar(r, c + half(r));
    }
    if (rIn < start) polar(rIn, c + half(start));
  }
  return pts;
}

// Outline of an external gear; tooth 0 is centred on +x.
export const externalGear = (z) => profile(z, z / 2 - 1.25, z / 2 + 1, BACKLASH);

// Inner outline of a ring gear: the cavity of an external shape. Rotated half a pitch so that a
// ring *tooth* is centred on +x. The addendum is 0.8 to stay clear of involute interference.
export function internalGear(z) {
  const half = Math.PI / z;
  const [c, s] = [Math.cos(half), Math.sin(half)];
  return profile(z, z / 2 - 0.8, z / 2 + 1.25, -BACKLASH).map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

// Angles of every member for a given sun angle. The ring stays at 0.
export function pose(sun) {
  const carrier = sun / RATIO;
  const k = TEETH.sun / TEETH.planet;
  const planets = Array.from({ length: PLANETS }, (_, i) => {
    const at = carrier + (i * 2 * Math.PI) / PLANETS;
    return { at, spin: at + Math.PI - Math.PI / TEETH.planet + k * (at - sun) };
  });
  return { sun, carrier, planets };
}
