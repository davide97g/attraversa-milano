// Modelli low-poly sfaccettati fatti di primitive: niente file 3D esterni.
import * as THREE from "three";

const mats = new Map<string, THREE.Material>();
export function mat(color: number | string, opts: { emissive?: number; flat?: boolean } = {}) {
  const key = `${color}|${opts.emissive ?? ""}|${opts.flat ?? true}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      flatShading: opts.flat ?? true,
      emissive: opts.emissive ?? 0x000000,
    });
    mats.set(key, m);
  }
  return m;
}

const geos = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}
export const box = (w: number, h: number, d: number) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const sph = (r: number, ws = 7, hs = 5) => geo(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const cyl = (rt: number, rb: number, h: number, seg = 8) =>
  geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const cone = (r: number, h: number, seg = 6) => geo(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const ico = (r: number) => geo(`i${r}`, () => new THREE.IcosahedronGeometry(r, 0));

type V3 = [number, number, number];
function add(
  parent: THREE.Object3D,
  g: THREE.BufferGeometry,
  color: number | THREE.Material,
  pos: V3,
  scale?: V3,
  rot?: V3,
) {
  const m = new THREE.Mesh(g, typeof color === "number" ? mat(color) : color);
  m.position.set(...pos);
  if (scale) m.scale.set(...scale);
  if (rot) m.rotation.set(...rot);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------- personaggi (guardano verso -z, piedi in y=0) ----------
export type CharId = "piccione" | "papera" | "gatto" | "pinguino" | "panettone";
export const CHARS: { id: CharId; name: string; cost: number }[] = [
  { id: "piccione", name: "Piccione", cost: 0 },
  { id: "papera", name: "Papera", cost: 25 },
  { id: "gatto", name: "Gatto del Naviglio", cost: 60 },
  { id: "pinguino", name: "Pinguino in sciarpa", cost: 100 },
  { id: "panettone", name: "Panettone", cost: 150 },
];

function eyes(g: THREE.Object3D, y: number, z: number, spread: number, r = 0.045, iris = 0x111111) {
  for (const s of [-1, 1]) {
    add(g, sph(r, 6, 4), 0xffffff, [s * spread, y, z]);
    add(g, sph(r * 0.55, 6, 4), iris, [s * spread, y, z - r * 0.6]);
  }
}
function feet(g: THREE.Object3D, color: number, spread = 0.11) {
  for (const s of [-1, 1]) add(g, box(0.1, 0.04, 0.16), color, [s * spread, 0.02, -0.03]);
}

export function makeChar(id: CharId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case "piccione": {
      feet(g, 0xe0785a);
      for (const s of [-1, 1]) add(g, cyl(0.02, 0.02, 0.12, 4), 0xe0785a, [s * 0.11, 0.08, 0]);
      add(g, sph(0.27), 0x9aa0b0, [0, 0.34, 0.02], [1, 0.85, 1.25]);
      add(g, sph(0.2), 0xc2c6d0, [0, 0.3, -0.12], [0.9, 0.8, 0.7]);
      for (const s of [-1, 1]) add(g, sph(0.2), 0x7d8496, [s * 0.22, 0.38, 0.05], [0.35, 0.65, 1.1], [0.2, 0, s * 0.15]);
      add(g, box(0.26, 0.05, 0.22), 0x4e5466, [0, 0.38, 0.36], undefined, [0.35, 0, 0]);
      add(g, cyl(0.15, 0.17, 0.12, 7), 0x5f9a86, [0, 0.52, -0.14]);
      add(g, cyl(0.13, 0.15, 0.05, 7), 0x8e6aa8, [0, 0.47, -0.14]);
      add(g, sph(0.16), 0x6c7388, [0, 0.66, -0.2]);
      add(g, cone(0.045, 0.13, 5), 0xe8dccb, [0, 0.64, -0.38], undefined, [-Math.PI / 2, 0, 0]);
      add(g, sph(0.035, 5, 4), 0xf4f1ea, [0, 0.69, -0.33]);
      eyes(g, 0.7, -0.29, 0.09, 0.04, 0xc0392b);
      break;
    }
    case "papera": {
      feet(g, 0xf08a24, 0.12);
      add(g, sph(0.3), 0xfaf7ef, [0, 0.32, 0.04], [1, 0.82, 1.25]);
      for (const s of [-1, 1]) add(g, sph(0.2), 0xeae4d4, [s * 0.24, 0.34, 0.08], [0.35, 0.6, 1.1]);
      add(g, cone(0.12, 0.22, 5), 0xfaf7ef, [0, 0.42, 0.4], undefined, [-2.3, 0, 0]);
      add(g, cyl(0.11, 0.14, 0.25, 7), 0xfaf7ef, [0, 0.55, -0.16]);
      add(g, sph(0.17), 0xfaf7ef, [0, 0.74, -0.18]);
      add(g, box(0.16, 0.06, 0.2), 0xf08a24, [0, 0.69, -0.38]);
      add(g, box(0.05, 0.12, 0.05), 0xfaf7ef, [0, 0.92, -0.15], undefined, [0.4, 0, 0]);
      eyes(g, 0.78, -0.3, 0.09, 0.04);
      break;
    }
    case "gatto": {
      const o = 0xe8913a;
      const d = 0xb9661f;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, cyl(0.05, 0.05, 0.16, 6), 0xfaf3e6, [sx * 0.13, 0.08, sz * 0.18]);
      add(g, box(0.38, 0.28, 0.6), o, [0, 0.3, 0.02]);
      for (const z of [-0.1, 0.06, 0.22]) add(g, box(0.4, 0.06, 0.06), d, [0, 0.42, z]);
      add(g, box(0.4, 0.36, 0.34), o, [0, 0.55, -0.3]);
      add(g, box(0.22, 0.14, 0.08), 0xfaf3e6, [0, 0.46, -0.48]);
      add(g, box(0.06, 0.04, 0.04), 0xf2a0a8, [0, 0.52, -0.52]);
      for (const s of [-1, 1]) {
        add(g, cone(0.09, 0.16, 4), o, [s * 0.13, 0.8, -0.3], undefined, [0, Math.PI / 4, 0]);
        add(g, cone(0.05, 0.09, 4), 0xf2a0a8, [s * 0.13, 0.79, -0.33], undefined, [0, Math.PI / 4, 0]);
      }
      eyes(g, 0.6, -0.48, 0.1, 0.045, 0x3f8f3a);
      add(g, cyl(0.04, 0.05, 0.4, 5), o, [0, 0.42, 0.42], undefined, [0.9, 0, 0]);
      add(g, cyl(0.04, 0.04, 0.25, 5), d, [0, 0.62, 0.55], undefined, [0.2, 0, 0]);
      break;
    }
    case "pinguino": {
      feet(g, 0xf0a020, 0.1);
      add(g, sph(0.3, 8, 6), 0x262a36, [0, 0.42, 0], [0.95, 1.3, 0.9]);
      add(g, sph(0.24, 8, 6), 0xf7f5ef, [0, 0.38, -0.08], [0.9, 1.2, 0.8]);
      for (const s of [-1, 1]) add(g, box(0.06, 0.32, 0.18), 0x262a36, [s * 0.3, 0.42, 0], undefined, [0, 0, s * 0.3]);
      add(g, cyl(0.23, 0.24, 0.1, 8), 0xd7263d, [0, 0.66, 0]);
      add(g, box(0.1, 0.26, 0.04), 0xd7263d, [0.12, 0.54, -0.2], undefined, [0, 0, 0.15]);
      add(g, box(0.1, 0.06, 0.05), 0xffffff, [0.13, 0.42, -0.21]);
      add(g, sph(0.2, 8, 6), 0x262a36, [0, 0.84, -0.02]);
      add(g, cone(0.05, 0.14, 5), 0xf0a020, [0, 0.82, -0.25], undefined, [-Math.PI / 2, 0, 0]);
      eyes(g, 0.9, -0.17, 0.08, 0.04);
      break;
    }
    case "panettone": {
      for (const s of [-1, 1]) add(g, box(0.12, 0.08, 0.16), 0x7a4a24, [s * 0.14, 0.04, -0.02]);
      add(g, cyl(0.34, 0.34, 0.42, 10), 0xc68a3a, [0, 0.29, 0]);
      add(g, cyl(0.355, 0.355, 0.22, 10), 0xf3e2c0, [0, 0.2, 0]);
      add(g, cyl(0.357, 0.357, 0.04, 10), 0x8f2433, [0, 0.27, 0]);
      add(g, sph(0.37, 10, 6), 0x9a5a22, [0, 0.5, 0], [1, 0.55, 1]);
      const fruit = [0xe23d3d, 0x3fae49, 0xf2a01c, 0x5b2a16];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.3;
        const rr = i % 2 ? 0.18 : 0.28;
        add(g, box(0.06, 0.05, 0.06), fruit[i % 4], [Math.cos(a) * rr, 0.66 - rr * 0.35, Math.sin(a) * rr]);
      }
      add(g, box(0.05, 0.05, 0.05), 0xffffff, [0, 0.72, 0], undefined, [0.6, 0.6, 0]);
      eyes(g, 0.38, -0.33, 0.12, 0.055);
      add(g, box(0.1, 0.03, 0.03), 0x5b2a16, [0, 0.3, -0.35]);
      break;
    }
  }
  return g;
}

// ---------- veicoli (lunghi lungo x, muso verso +x) ----------
export type VehicleKind = "auto" | "vespa" | "ape" | "bus" | "tram" | "spazzatrice";
export const LEN: Record<VehicleKind, number> = { auto: 1.6, vespa: 0.9, ape: 1.3, bus: 3.6, tram: 9.5, spazzatrice: 1.8 };
const CAR_COLORS = [0xd94b3f, 0x3e7cc9, 0xf2c14e, 0x6bbf8a, 0xf6f1e7, 0x8c5ac2, 0x2f3a4f, 0xef8a4c];
const VESPA_COLORS = [0x9ed3c4, 0xf4a7b3, 0xf6e7a1, 0xd94b3f, 0xa8c6f0];

function wheels(g: THREE.Object3D, xs: number[], z: number, r: number, y = r) {
  for (const x of xs) for (const s of [-1, 1]) add(g, cyl(r, r, 0.1, 8), 0x1d1f26, [x, y, s * z], undefined, [Math.PI / 2, 0, 0]);
}

export function makeVehicle(kind: VehicleKind, rnd = Math.random): THREE.Group {
  const g = new THREE.Group();
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  switch (kind) {
    case "auto": {
      const c = pick(CAR_COLORS);
      wheels(g, [-0.5, 0.5], 0.36, 0.15);
      add(g, box(1.6, 0.34, 0.78), c, [0, 0.32, 0]);
      add(g, box(0.9, 0.3, 0.7), 0xbfe3f2, [-0.08, 0.62, 0]);
      add(g, box(0.82, 0.06, 0.74), c, [-0.08, 0.79, 0]);
      for (const s of [-1, 1]) {
        add(g, box(0.04, 0.08, 0.14), 0xfff3c4, [0.8, 0.34, s * 0.26]);
        add(g, box(0.04, 0.08, 0.12), 0xc0392b, [-0.8, 0.34, s * 0.27]);
      }
      add(g, box(1.62, 0.05, 0.8), 0x2b2d35, [0, 0.16, 0]);
      break;
    }
    case "vespa": {
      const c = pick(VESPA_COLORS);
      wheels(g, [-0.32, 0.34], 0.0, 0.11);
      add(g, sph(0.22, 7, 5), c, [-0.18, 0.28, 0], [1.3, 0.75, 0.9]);
      add(g, box(0.14, 0.4, 0.2), c, [0.32, 0.32, 0], undefined, [0, 0, -0.3]);
      add(g, box(0.05, 0.05, 0.4), 0x2b2d35, [0.38, 0.56, 0]);
      add(g, box(0.36, 0.06, 0.24), 0x3b2b22, [-0.16, 0.45, 0]);
      add(g, box(0.22, 0.32, 0.26), pick([0x324a6d, 0x7a2f2f, 0x2f5a3f, 0x4a4a4a]), [-0.12, 0.65, 0]);
      add(g, sph(0.14, 7, 5), pick([0xffffff, 0xf2c14e, 0x111111, 0xd94b3f]), [-0.08, 0.92, 0]);
      add(g, box(0.04, 0.06, 0.12), 0xfff3c4, [0.42, 0.42, 0]);
      break;
    }
    case "ape": {
      const c = pick([0x7fb6d6, 0xd94b3f, 0x9fc77b, 0xf2c14e]);
      wheels(g, [-0.35], 0.3, 0.13);
      wheels(g, [0.45], 0.0, 0.13);
      add(g, box(0.5, 0.6, 0.62), c, [0.4, 0.5, 0]);
      add(g, box(0.06, 0.24, 0.5), 0xbfe3f2, [0.66, 0.6, 0]);
      add(g, box(0.75, 0.12, 0.7), 0x8a6a48, [-0.28, 0.32, 0]);
      for (const s of [-1, 1]) add(g, box(0.75, 0.16, 0.04), 0x8a6a48, [-0.28, 0.44, s * 0.33]);
      add(g, box(0.28, 0.2, 0.26), 0xf2a33a, [-0.4, 0.48, -0.12]);
      add(g, box(0.28, 0.2, 0.26), 0xd94b3f, [-0.15, 0.48, 0.12]);
      break;
    }
    case "bus": {
      const c = pick([0xe9a23b, 0x5c9b6b, 0x3e7cc9]);
      wheels(g, [-1.2, 1.2], 0.42, 0.18);
      add(g, box(3.6, 0.85, 0.9), c, [0, 0.62, 0]);
      add(g, box(3.4, 0.28, 0.92), 0xcfe7f2, [-0.05, 0.86, 0]);
      add(g, box(0.06, 0.4, 0.8), 0xcfe7f2, [1.8, 0.74, 0]);
      add(g, box(3.62, 0.12, 0.92), 0xf6f1e7, [0, 0.4, 0]);
      add(g, box(3.4, 0.06, 0.8), 0xf6f1e7, [0, 1.08, 0]);
      break;
    }
    case "tram": {
      wheels(g, [-3.6, -2.6, 2.6, 3.6], 0.3, 0.14);
      add(g, box(9.4, 1.0, 1.0), 0xf0a93a, [0, 0.78, 0]);
      add(g, box(9.42, 0.22, 1.02), 0xf6ecd2, [0, 0.4, 0]);
      add(g, box(9.0, 0.32, 1.02), 0x2e3440, [0, 0.98, 0]);
      for (let x = -4; x <= 4; x += 1) add(g, box(0.08, 0.34, 1.04), 0xf0a93a, [x, 0.98, 0]);
      add(g, box(9.2, 0.1, 0.9), 0xd9d2c0, [0, 1.33, 0]);
      add(g, box(0.06, 0.5, 0.06), 0x2e3440, [0, 1.6, 0], undefined, [0, 0, 0.6]);
      add(g, box(0.06, 0.5, 0.06), 0x2e3440, [0.28, 1.6, 0], undefined, [0, 0, -0.6]);
      add(g, box(0.5, 0.04, 0.6), 0x2e3440, [0.14, 1.83, 0]);
      for (const sx of [-1, 1]) add(g, box(0.06, 0.14, 0.6), 0xfff3c4, [sx * 4.71, 0.6, 0]);
      break;
    }
    case "spazzatrice": {
      wheels(g, [-0.55, 0.55], 0.4, 0.17);
      add(g, box(1.4, 0.7, 0.86), 0xf3f0e6, [-0.15, 0.55, 0]);
      add(g, box(0.45, 0.45, 0.8), 0xbfe3f2, [0.6, 0.72, 0]);
      add(g, box(0.5, 0.08, 0.84), 0xf08a24, [0.6, 0.98, 0]);
      add(g, box(1.42, 0.1, 0.88), 0xf08a24, [-0.15, 0.4, 0]);
      add(g, cyl(0.2, 0.2, 0.9, 8), 0x2f6b3a, [0.9, 0.2, 0], undefined, [Math.PI / 2, 0, 0]);
      add(g, sph(0.06, 5, 4), 0xf2a01c, [-0.2, 0.96, 0]);
      break;
    }
  }
  return g;
}

// barca dei Navigli: ponte piatto a y=0 lungo `cells`, prua verso +x
export function makeBoat(cells: number, rnd = Math.random): THREE.Group {
  const g = new THREE.Group();
  const L = cells - 0.1;
  const c = [0x8a5a3a, 0x6f4a30, 0x2f5a72, 0x9c3b32][Math.floor(rnd() * 4)];
  add(g, box(L - 0.5, 0.3, 0.8), c, [0, -0.15, 0]);
  add(g, box(L - 0.5, 0.06, 0.82), 0xf6ecd2, [0, -0.06, 0]);
  add(g, cyl(0.4, 0.4, 0.3, 3), c, [L / 2 - 0.25, -0.15, 0], [0.9, 1, 1], [0, Math.PI, 0]);
  add(g, cyl(0.4, 0.4, 0.3, 3), c, [-L / 2 + 0.25, -0.15, 0], [0.9, 1, 1]);
  add(g, box(L - 0.6, 0.03, 0.66), 0xc49a6c, [0, 0.0, 0]);
  for (let i = 0; i < cells - 1; i++) add(g, box(0.04, 0.035, 0.66), 0xa47a4e, [-L / 2 + 0.95 + i, 0.005, 0]);
  return g;
}

// ---------- arredo urbano ----------
export type PropKind = "albero" | "abete" | "fioriera" | "lampione" | "fontanella" | "panchina" | "cestino";
export function makeProp(kind: PropKind, rnd = Math.random): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case "albero": {
      const h = 0.3 + rnd() * 0.3;
      add(g, cyl(0.09, 0.12, h, 6), 0x7a5236, [0, h / 2, 0]);
      const green = [0x4f9a5a, 0x5aa564, 0x468a50][Math.floor(rnd() * 3)];
      const s = 0.85 + rnd() * 0.3;
      add(g, ico(0.42), green, [0, h + 0.3 * s, 0], [s, s, s], [rnd(), rnd(), 0]);
      add(g, ico(0.3), green, [0.05, h + 0.68 * s, 0.02], [s, s, s], [rnd(), rnd(), 0]);
      add(g, ico(0.2), 0xf4f7fb, [0.02, h + 0.88 * s, 0], [s, 0.6 * s, s]);
      break;
    }
    case "abete": {
      add(g, cyl(0.08, 0.1, 0.25, 6), 0x7a5236, [0, 0.12, 0]);
      for (let i = 0; i < 3; i++) add(g, cone(0.42 - i * 0.1, 0.5, 7), 0x2f7a4a, [0, 0.42 + i * 0.3, 0], undefined, [0, i, 0]);
      add(g, cone(0.12, 0.18, 7), 0xf4f7fb, [0, 1.3, 0]);
      const lights = [0xff5a5a, 0xffd25a, 0x5ab4ff, 0x7dff8a];
      for (let i = 0; i < 9; i++) {
        const a = i * 2.1;
        const y = 0.35 + (i % 3) * 0.3;
        const r = 0.36 - (i % 3) * 0.1;
        const m = add(g, sph(0.04, 5, 4), mat(lights[i % 4], { emissive: lights[i % 4] }), [Math.cos(a) * r, y, Math.sin(a) * r]);
        m.castShadow = false;
      }
      add(g, sph(0.07, 5, 4), mat(0xffd25a, { emissive: 0xffaa00 }), [0, 1.42, 0]);
      break;
    }
    case "fioriera": {
      add(g, box(0.7, 0.35, 0.7), 0x9b8b7a, [0, 0.175, 0]);
      add(g, box(0.6, 0.05, 0.6), 0x5b3d28, [0, 0.36, 0]);
      add(g, ico(0.3), 0x5aa564, [0, 0.52, 0], [1, 0.7, 1]);
      for (const [x, z, c] of [[0.15, 0.1, 0xd94b3f], [-0.12, -0.1, 0xf2c14e], [0.02, -0.18, 0xffffff]] as const)
        add(g, sph(0.06, 5, 4), c, [x, 0.68, z]);
      break;
    }
    case "lampione": {
      add(g, cyl(0.12, 0.14, 0.14, 8), 0x2e3440, [0, 0.07, 0]);
      add(g, cyl(0.04, 0.05, 1.35, 6), 0x2e3440, [0, 0.75, 0]);
      add(g, cyl(0.16, 0.08, 0.22, 6), 0x2e3440, [0, 1.5, 0]);
      const l = add(g, sph(0.11, 6, 4), mat(0xfff0c0, { emissive: 0xffd27a }), [0, 1.36, 0]);
      l.castShadow = false;
      break;
    }
    case "fontanella": {
      add(g, cyl(0.15, 0.17, 0.75, 8), 0x2f6b3a, [0, 0.375, 0]);
      add(g, sph(0.15, 8, 4), 0x2f6b3a, [0, 0.75, 0], [1, 0.5, 1]);
      add(g, cyl(0.025, 0.025, 0.22, 5), 0x2f6b3a, [0, 0.55, -0.2], undefined, [Math.PI / 2, 0, 0]);
      add(g, box(0.3, 0.05, 0.3), 0x8a8f99, [0, 0.03, -0.28]);
      break;
    }
    case "panchina": {
      for (const x of [-0.3, 0.3]) add(g, box(0.06, 0.28, 0.4), 0x2e3440, [x, 0.14, 0]);
      add(g, box(0.85, 0.06, 0.38), 0x9c6a3e, [0, 0.3, 0]);
      add(g, box(0.85, 0.22, 0.05), 0x9c6a3e, [0, 0.46, 0.18]);
      break;
    }
    case "cestino": {
      add(g, cyl(0.16, 0.14, 0.5, 8), 0x6b7280, [0, 0.25, 0]);
      add(g, cyl(0.17, 0.17, 0.05, 8), 0x3b4250, [0, 0.5, 0]);
      add(g, box(0.18, 0.14, 0.02), 0xf2c14e, [0, 0.32, -0.16]);
      break;
    }
  }
  return g;
}

export function makeCoin(): THREE.Group {
  const g = new THREE.Group();
  const outer = add(g, cyl(0.22, 0.22, 0.06, 12), mat(0xd9b24a, { emissive: 0x4a3500 }), [0, 0, 0], undefined, [Math.PI / 2, 0, 0]);
  outer.castShadow = true;
  add(g, cyl(0.14, 0.14, 0.07, 12), mat(0xc9ccd4, { emissive: 0x202020 }), [0, 0, 0], undefined, [Math.PI / 2, 0, 0]);
  return g;
}
