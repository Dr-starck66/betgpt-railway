export type GoalMatrix = {
  lambdaHome: number;
  lambdaAway: number;
  home: number;
  draw: number;
  away: number;
  over15: number;
  over25: number;
  over35: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  matrix: number[][];
};

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let v = 0;
  for (const x of xs) v += (x - m) ** 2;
  return Math.sqrt(v / (xs.length - 1));
}

export function sigmoid(z: number): number {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function logit(p: number): number {
  const x = clamp(p, 1e-6, 1 - 1e-6);
  return Math.log(x / (1 - x));
}

export function normalize3(
  home: number,
  draw: number,
  away: number,
): { home: number; draw: number; away: number } {
  const h = Math.max(home, 0);
  const d = Math.max(draw, 0);
  const a = Math.max(away, 0);
  const s = h + d + a;
  if (s <= 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  return { home: h / s, draw: d / s, away: a / s };
}

export function removeVig(odds: number[]): [number, number, number] {
  const impl = odds.map((o) => 1 / Math.max(o, 1.01));
  const s = impl.reduce((a, b) => a + b, 0) || 1;
  return [impl[0]! / s, impl[1]! / s, impl[2]! / s];
}

export function dixonTau(
  i: number,
  j: number,
  lh: number,
  la: number,
  rho: number,
): number {
  let t = 1;
  if (i === 0 && j === 0) t = 1 - lh * la * rho;
  else if (i === 0 && j === 1) t = 1 + la * rho;
  else if (i === 1 && j === 0) t = 1 + lh * rho;
  else if (i === 1 && j === 1) t = 1 - rho;
  return Math.max(t, 0.02);
}

function poissonPmfSeries(lambda: number, n: number): number[] {
  const lam = clamp(lambda, 0.05, 6);
  const out = new Array<number>(n + 1);
  out[0] = Math.exp(-lam);
  for (let k = 1; k <= n; k++) out[k] = out[k - 1]! * lam / k;
  return out;
}

export function goalMatrix(lh: number, la: number, rho = 0): GoalMatrix {
  const N = 8;
  const ph = poissonPmfSeries(lh, N);
  const pa = poissonPmfSeries(la, N);
  const matrix: number[][] = [];
  let total = 0;
  for (let i = 0; i <= N; i++) {
    const row: number[] = [];
    for (let j = 0; j <= N; j++) {
      const p = ph[i]! * pa[j]! * dixonTau(i, j, lh, la, rho);
      row.push(p);
      total += p;
    }
    matrix.push(row);
  }
  const inv = total > 0 ? 1 / total : 1;
  let home = 0;
  let draw = 0;
  let away = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let bttsYes = 0;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const p = matrix[i]![j]! * inv;
      matrix[i]![j] = p;
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
      const g = i + j;
      if (g >= 2) over15 += p;
      if (g >= 3) over25 += p;
      if (g >= 4) over35 += p;
      if (i > 0 && j > 0) bttsYes += p;
    }
  }
  const n = normalize3(home, draw, away);
  return {
    lambdaHome: clamp(lh, 0.05, 6),
    lambdaAway: clamp(la, 0.05, 6),
    home: n.home,
    draw: n.draw,
    away: n.away,
    over15,
    over25,
    over35,
    under25: 1 - over25,
    bttsYes,
    bttsNo: 1 - bttsYes,
    matrix,
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function samplePoisson(lambda: number, rng: () => number): number {
  const lam = clamp(lambda, 0.05, 8);
  const L = Math.exp(-lam);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > L && k < 20);
  return k - 1;
}
