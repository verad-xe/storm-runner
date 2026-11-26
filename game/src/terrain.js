// Storm Runner — the valley. One height function drives the terrain the
// player sees, the ground the plane can hit, and the runway the plane can
// land on, so the picture and the physics never disagree.
import { CONFIG } from './config.js';
import { makeNoise1D, makeRng, range } from './random.js';

// The valley floor rolls low; the pass between the ridges is the only way
// east, and the far end climbs again toward the storm front.
function baseProfile(x) {
  const passRise =
    smoothstep(CONFIG.PASS_START_X - 900, CONFIG.PASS_START_X + 500, x) *
    (1 - smoothstep(CONFIG.PASS_END_X - 500, CONFIG.PASS_END_X + 900, x));
  const farRise = smoothstep(8600, 10600, x) * 90;
  return 24 + 290 * passRise + farRise;
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export class Valley {
  constructor(seed) {
    this.seed = seed;
    this.noise = makeNoise1D(seed, 620, 3);
    this.riverNoise = makeNoise1D(seed + 7, 340, 2);
    // The two strips are dead flat, by construction, so a landing there is
    // a landing on prepared ground and nowhere else is.
    this.homeStrip = { x0: -220, x1: CONFIG.HOME_STRIP_X + CONFIG.HOME_STRIP_LENGTH };
    this.farStrip = { x0: CONFIG.FAR_STRIP_X, x1: CONFIG.FAR_STRIP_X + CONFIG.FAR_STRIP_LENGTH };
    this.dropZone = { x0: 4650, x1: 4950 };
    this.rings = this.placeRings(seed);
    this.townLights = this.placeTownLights(seed);
    this.stars = this.placeStars(seed);
  }

  // Ground height in metres above the valley floor at world x.
  heightAt(x) {
    if (x >= this.homeStrip.x0 && x <= this.homeStrip.x1) return 0;
    if (x >= this.farStrip.x0 && x <= this.farStrip.x1) return 0;
    if (x >= this.dropZone.x0 - 60 && x <= this.dropZone.x1 + 60) return 0;
    let height = baseProfile(x) + this.noise(x) * 30;
    // The river cuts a channel through the valley floor.
    const riverCentre = CONFIG.RIVER_X;
    const riverDistance = Math.abs(x - riverCentre) / (CONFIG.RIVER_WIDTH / 2);
    if (riverDistance < 1) height -= (1 - riverDistance * riverDistance) * 26;
    // Gentle ground just past the home strip, so a take-off climbs out
    // over flat meadow instead of into a hillside.
    const takeoffBlend = smoothstep(this.homeStrip.x1, 1500, x);
    height = height * takeoffBlend + 8 * (1 - takeoffBlend);
    // The final approach ramps down to the far strip, so the last mile is
    // a clean glide instead of a foothill the pilot has to hop. The ramp
    // covers the strip itself and fades back out past its far end, where
    // the ground rises again.
    const approachFactor =
      smoothstep(9200, CONFIG.FAR_STRIP_X, x) *
      (1 - smoothstep(CONFIG.FAR_STRIP_X + CONFIG.FAR_STRIP_LENGTH, CONFIG.FAR_STRIP_X + CONFIG.FAR_STRIP_LENGTH + 200, x));
    height *= 1 - approachFactor;
    return Math.max(-24, height);
  }

  isRunway(x) {
    return (
      (x >= this.homeStrip.x0 && x <= this.homeStrip.x1) ||
      (x >= this.farStrip.x0 && x <= this.farStrip.x1)
    );
  }

  isFarStrip(x) {
    return x >= this.farStrip.x0 && x <= this.farStrip.x1;
  }

  // Rings thread the pass: low over the river, climbing through the gap,
  // then descending toward the far strip. Each ring hangs well clear of the
  // ground beneath it, at a height a careful pilot can reach.
  placeRings(seed) {
    const rng = makeRng(seed + 101);
    const anchors = [1500, 3050, 4300, 5450, 6200, 6900, 7650, 8400, 9200];
    return anchors.map((anchorX, index) => {
      const x = anchorX + range(rng, -40, 40);
      const clearance = 95 + range(rng, -12, 22);
      return {
        id: index,
        x,
        y: this.heightAt(x) + clearance,
        radius: 34,
        passed: false,
      };
    });
  }

  placeTownLights(seed) {
    const rng = makeRng(seed + 202);
    const lights = [];
    for (let index = 0; index < 46; index += 1) {
      lights.push({
        x: CONFIG.TOWN_X + range(rng, -CONFIG.TOWN_WIDTH / 2, CONFIG.TOWN_WIDTH / 2),
        lift: range(rng, 4, 26),
        warm: rng() > 0.35,
        phase: rng() * Math.PI * 2,
      });
    }
    return lights;
  }

  placeStars(seed) {
    const rng = makeRng(seed + 303);
    const stars = [];
    for (let index = 0; index < 130; index += 1) {
      stars.push({ x: rng(), y: rng() * 0.55, size: range(rng, 0.6, 2.1), twinkle: rng() * Math.PI * 2 });
    }
    return stars;
  }
}
