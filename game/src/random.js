// Storm Runner — deterministic randomness. Every valley, gust and ring
// layout comes from a seed, so a screenshot scene can be replayed exactly
// and two players on the same seed fly the same valley.

// mulberry32: a small, fast seeded generator with a long period.
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, low, high) {
  return low + (high - low) * rng();
}

// Smooth 1-D value noise over a seeded grid of control values. Sampled
// anywhere, it is continuous, so terrain drawn from it has no kinks.
export function makeNoise1D(seed, spacing, octaves) {
  const rng = makeRng(seed);
  const layers = [];
  for (let layer = 0; layer < octaves; layer += 1) {
    const values = new Map();
    const step = spacing / (layer + 1);
    const amplitude = 1 / (layer + 1);
    layers.push({ values, step, amplitude });
  }
  function valueAt(layer, index) {
    if (!layer.values.has(index)) layer.values.set(index, rng() * 2 - 1);
    return layer.values.get(index);
  }
  return function noise(x) {
    let total = 0;
    let weight = 0;
    for (const layer of layers) {
      const position = x / layer.step;
      const index = Math.floor(position);
      const fraction = position - index;
      const smooth = fraction * fraction * (3 - 2 * fraction);
      const a = valueAt(layer, index);
      const b = valueAt(layer, index + 1);
      total += (a + (b - a) * smooth) * layer.amplitude;
      weight += layer.amplitude;
    }
    return total / weight;
  };
}
