import * as THREE from "three";
import { initAudio, isMuted, sfx, toggleMute } from "./audio";
import {
  CHARS,
  LEN,
  box,
  makeBoat,
  makeChar,
  makeCoin,
  makeProp,
  makeVehicle,
  mat,
  type CharId,
  type PropKind,
  type VehicleKind,
} from "./models";
import { board, player, setNick, submit, type Board } from "./scores";

// ---------- costanti ----------
const MINX = -5;
const MAXX = 5;
const HALF_W = 22; // i veicoli girano tra -22 e 22
const HOP = 0.13; // durata del salto, secondi
const STORE = "attraversa-milano";

// ---------- renderer, scena, camera ----------
const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const SKY = new THREE.Color(0xbfd8e6);
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 22, 40);

const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 80);
const CAM_OFF = new THREE.Vector3(3.2, 13, 9.5);
let camK = 1;

scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x8a9a7a, 1.35));
const sun = new THREE.DirectionalLight(0xfff1dc, 1.9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -16;
sun.shadow.camera.right = 16;
sun.shadow.camera.top = 16;
sun.shadow.camera.bottom = -16;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(-6, 14, 5);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  camera.aspect = w / h;
  // in verticale ci si allontana per vedere tutta la larghezza giocabile
  camK = Math.min(1.6, Math.max(1, 0.95 / camera.aspect));
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---------- random ----------
const rnd = Math.random;
const rint = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

// ---------- salvataggi ----------
function load(key: string, def: number) {
  try {
    return Number(localStorage.getItem(`${STORE}-${key}`) ?? def) || def;
  } catch {
    return def;
  }
}
function store(key: string, v: string | number) {
  try {
    localStorage.setItem(`${STORE}-${key}`, String(v));
  } catch {
    /* niente */
  }
}
let best = load("best", 0);
let bank = load("coins", 0); // monete raccolte in tutto: sbloccano i personaggi
let charIdx = clamp(load("char", 0), 0, CHARS.length - 1);
if (CHARS[charIdx].cost > bank) charIdx = 0;

// ---------- particelle ----------
type Particle = { m: THREE.Mesh; v: THREE.Vector3; life: number; max: number; spin: THREE.Vector3; grav: number; s0: number };
const particles: Particle[] = [];
const partGeo = box(1, 1, 1);
function burst(pos: THREE.Vector3, n: number, colors: number[], o: { speed?: number; up?: number; size?: number; life?: number; grav?: number } = {}) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, mat(pick(colors)));
    const s = (o.size ?? 0.08) * (0.6 + rnd() * 0.8);
    m.scale.setScalar(s);
    m.position.copy(pos);
    scene.add(m);
    const a = rnd() * Math.PI * 2;
    const sp = (o.speed ?? 2) * (0.4 + rnd() * 0.8);
    const life = (o.life ?? 0.7) * (0.6 + rnd() * 0.6);
    particles.push({
      m,
      v: new THREE.Vector3(Math.cos(a) * sp, (o.up ?? 3) * (0.5 + rnd() * 0.7), Math.sin(a) * sp),
      life,
      max: life,
      spin: new THREE.Vector3(rnd() * 10, rnd() * 10, rnd() * 10),
      grav: o.grav ?? 12,
      s0: s,
    });
  }
}
function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.m);
      particles.splice(i, 1);
      continue;
    }
    p.v.y -= p.grav * dt;
    p.m.position.addScaledVector(p.v, dt);
    if (p.m.position.y < 0.02 && p.grav > 0) {
      p.m.position.y = 0.02;
      p.v.multiplyScalar(0.5);
      p.v.y = Math.abs(p.v.y) * 0.3;
    }
    p.m.rotation.x += p.spin.x * dt;
    p.m.rotation.y += p.spin.y * dt;
    p.m.scale.setScalar(p.s0 * Math.min(1, (p.life / p.max) * 2.5));
  }
}

// ---------- neve ----------
const SNOW = 700;
const snowGeo = new THREE.BufferGeometry();
const snowPos = new Float32Array(SNOW * 3);
for (let i = 0; i < SNOW; i++) {
  snowPos[i * 3] = (rnd() - 0.5) * 34;
  snowPos[i * 3 + 1] = rnd() * 12;
  snowPos[i * 3 + 2] = (rnd() - 0.5) * 34;
}
snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }));
scene.add(snow);
function updateSnow(dt: number, t: number) {
  for (let i = 0; i < SNOW; i++) {
    let y = snowPos[i * 3 + 1] - dt * (0.7 + (i % 5) * 0.12);
    if (y < 0) y += 12;
    snowPos[i * 3 + 1] = y;
    snowPos[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.25;
  }
  snowGeo.attributes.position.needsUpdate = true;
}

// ---------- mondo a corsie ----------
type LaneType = "parco" | "strada" | "binari" | "naviglio";
type Mover = { obj: THREE.Object3D; x: number; half: number; kind: VehicleKind | "barca"; honk: number };
type Lane = {
  r: number;
  type: LaneType;
  group: THREE.Group;
  blocked: Set<number>;
  coins: Map<number, THREE.Object3D>;
  movers: Mover[];
  speed: number;
  tram?: { timer: number; active: boolean; warned: boolean; light: THREE.Mesh; mover: Mover };
  foam: THREE.Object3D[];
};
const lanes = new Map<number, Lane>();
let gen = { next: -8, type: "parco" as LaneType, left: 0, prev: "parco" as LaneType, pathX: 0, waterDir: 1 };

const GROUND: Record<LaneType, number[]> = {
  parco: [0x9fcf72, 0x95c76a],
  strada: [0x535764, 0x535764],
  binari: [0xa69b90, 0xa09489],
  naviglio: [0x3c93bf, 0x3c93bf],
};

function difficulty() {
  return Math.min(1, score / 160);
}

function chooseType(r: number): LaneType {
  if (r < 3) return "parco";
  if (gen.left > 0) {
    gen.left--;
    return gen.type;
  }
  const d = difficulty();
  const w: [LaneType, number][] = [
    ["parco", gen.type === "parco" ? 0.1 : 0.32],
    ["strada", 0.38],
    ["binari", r > 12 && gen.type !== "binari" ? 0.12 + d * 0.06 : 0],
    ["naviglio", r > 7 && gen.type !== "naviglio" ? 0.24 : 0],
  ];
  let x = rnd() * w.reduce((s, [, v]) => s + v, 0);
  let t: LaneType = "parco";
  for (const [k, v] of w) {
    if ((x -= v) <= 0) {
      t = k;
      break;
    }
  }
  gen.type = t;
  gen.left =
    t === "parco" ? rint(0, d > 0.5 ? 0 : 1) : t === "strada" ? rint(0, 2 + Math.round(d * 2)) : t === "naviglio" ? rint(0, 2) : 0;
  return t;
}

function placeMovers(lane: Lane, kinds: (VehicleKind | "barca")[], gapMin: number, gapMax: number, boatCells?: () => number) {
  let x = -HALF_W + rnd() * 4;
  while (x < HALF_W) {
    const kind = pick(kinds);
    let obj: THREE.Object3D;
    let len: number;
    if (kind === "barca") {
      const cells = boatCells!();
      obj = makeBoat(cells);
      len = cells;
    } else {
      obj = makeVehicle(kind);
      len = LEN[kind];
    }
    const half = len / 2;
    x += half;
    if (x + half > HALF_W) break;
    if (lane.speed < 0) obj.rotation.y = Math.PI;
    lane.group.add(obj);
    lane.movers.push({ obj, x, half, kind, honk: 0 });
    x += half + gapMin + rnd() * (gapMax - gapMin);
  }
}

function addProp(lane: Lane, x: number, kind: PropKind) {
  const p = makeProp(kind);
  p.position.set(x + (rnd() - 0.5) * 0.08, 0, 0);
  p.rotation.y = kind === "panchina" ? 0 : (rnd() - 0.5) * 0.6;
  lane.group.add(p);
}

function makeLane(r: number): Lane {
  const type = chooseType(r);
  const d = difficulty();
  const group = new THREE.Group();
  group.position.z = -r;
  const lane: Lane = { r, type, group, blocked: new Set(), coins: new Map(), movers: [], speed: 0, foam: [] };
  const col = GROUND[type][((r % 2) + 2) % 2];

  if (type === "naviglio") {
    const w = new THREE.Mesh(box(60, 0.2, 1), mat(col, { flat: false }));
    w.position.y = -0.32;
    w.receiveShadow = true;
    group.add(w);
    const bed = new THREE.Mesh(box(60, 0.4, 1), mat(0x2a5d78));
    bed.position.y = -0.62;
    group.add(bed);
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(box(0.5 + rnd(), 0.02, 0.05), mat(0xd7eef7));
      f.position.set((rnd() - 0.5) * 40, -0.21, (rnd() - 0.5) * 0.7);
      group.add(f);
      lane.foam.push(f);
    }
  } else {
    const g = new THREE.Mesh(box(60, 0.4, 1), mat(col));
    g.position.y = -0.2;
    g.receiveShadow = true;
    group.add(g);
  }

  // bordi: marciapiede tra parco e strada, argine di pietra sul naviglio
  const prev = gen.prev;
  if (prev !== type) {
    if (type === "naviglio" || prev === "naviglio") {
      const e = new THREE.Mesh(box(60, 0.12, 0.14), mat(0xcfc6b8));
      e.position.set(0, type === "naviglio" ? -0.06 : 0.02, 0.5 - 0.07);
      e.receiveShadow = true;
      group.add(e);
    } else if (type === "strada" || prev === "strada") {
      const e = new THREE.Mesh(box(60, 0.06, 0.12), mat(0xd9d4cb));
      e.position.set(0, 0.0, 0.5 - 0.06);
      e.receiveShadow = true;
      group.add(e);
    }
  }

  if (type === "parco") {
    const prevPath = gen.pathX;
    gen.pathX = clamp(gen.pathX + rint(-1, 1), MINX + 1, MAXX - 1);
    for (let x = -13; x <= 13; x++) {
      const inside = x >= MINX && x <= MAXX;
      if (!inside) {
        // fuori dal campo: alberi e arredo fitto, decide il confine
        if (rnd() < 0.55) addProp(lane, x, pick<PropKind>(["albero", "albero", "abete", "lampione", "fioriera"]));
        continue;
      }
      let solid = false;
      if (r <= -3) solid = true; // dietro la partenza
      else if (r >= 2 && x !== gen.pathX && x !== prevPath && rnd() < 0.13 + d * 0.12 && lane.blocked.size < 6) solid = true;
      if (solid) {
        lane.blocked.add(x);
        addProp(lane, x, pick<PropKind>(["albero", "albero", "albero", "fioriera", "lampione", "fontanella", "panchina", "cestino", r % 9 === 0 ? "abete" : "albero"]));
      } else if (r >= 2 && rnd() < 0.045) addCoin(lane, x);
    }
  } else if (type === "strada") {
    // righe tratteggiate tra due corsie di strada
    if (prev === "strada") {
      for (let x = -20; x <= 20; x += 1.5) {
        const s = new THREE.Mesh(box(0.7, 0.02, 0.07), mat(0xf2efe6));
        s.position.set(x, 0.005, 0.5);
        group.add(s);
      }
    }
    const kinds: VehicleKind[] = pick([
      ["auto", "auto", "auto"],
      ["auto", "auto", "ape"],
      ["vespa", "vespa"],
      ["bus", "auto"],
      ["bus"],
    ]);
    const fast = kinds[0] === "vespa";
    const base = fast ? 3.8 + rnd() * 1.6 : kinds[0] === "bus" ? 1.5 + rnd() * 0.8 : 2 + rnd() * 1.6;
    lane.speed = base * (1 + d * 0.75) * (rnd() < 0.5 ? -1 : 1);
    placeMovers(lane, kinds, fast ? 3.5 : 2.6, fast ? 9 : 7 - d * 2);
    if (rnd() < 0.05) addCoin(lane, rint(MINX, MAXX));
  } else if (type === "binari") {
    for (const z of [-0.26, 0.26]) {
      const rail = new THREE.Mesh(box(60, 0.06, 0.07), mat(0x6f737c));
      rail.position.set(0, 0.03, z);
      group.add(rail);
    }
    for (let x = -24; x <= 24; x += 0.8) {
      const s = new THREE.Mesh(box(0.16, 0.03, 0.8), mat(0x8a7a6a));
      s.position.set(x, 0.01, 0);
      s.receiveShadow = true;
      group.add(s);
    }
    // palo col semaforo del tram, sul bordo destro del campo
    const pole = new THREE.Group();
    const p = new THREE.Mesh(box(0.08, 1.1, 0.08), mat(0x2e3440));
    p.position.y = 0.55;
    p.castShadow = true;
    const head = new THREE.Mesh(box(0.26, 0.26, 0.14), mat(0x2e3440));
    head.position.y = 1.15;
    const light = new THREE.Mesh(box(0.16, 0.16, 0.05), new THREE.MeshLambertMaterial({ color: 0x552222, emissive: 0x000000 }));
    light.position.set(0, 1.15, 0.08);
    pole.add(p, head, light);
    pole.position.set(MAXX + 1, 0, 0.42);
    group.add(pole);
    const tram = makeVehicle("tram");
    const dir = rnd() < 0.5 ? -1 : 1;
    if (dir < 0) tram.rotation.y = Math.PI;
    tram.visible = false;
    group.add(tram);
    lane.speed = dir * (17 + d * 6);
    const mover: Mover = { obj: tram, x: -dir * 40, half: LEN.tram / 2, kind: "tram", honk: 0 };
    lane.movers.push(mover);
    lane.tram = { timer: 1.5 + rnd() * 4, active: false, warned: false, light, mover };
  } else {
    gen.waterDir = prev === "naviglio" ? -gen.waterDir : rnd() < 0.5 ? -1 : 1;
    lane.speed = gen.waterDir * (0.9 + rnd() * 1.1) * (1 + d * 0.45);
    placeMovers(lane, ["barca"], 1.2 + d * 0.6, 3.2 + d * 1.2, () => rint(2, d > 0.6 ? 3 : 4));
  }

  for (const m of lane.movers) m.obj.position.x = m.x;
  gen.prev = type;
  scene.add(group);
  lanes.set(r, lane);
  return lane;
}

function addCoin(lane: Lane, x: number) {
  const c = makeCoin();
  c.position.set(x, 0.45, 0);
  lane.group.add(c);
  lane.coins.set(x, c);
}

function ensureLanes() {
  while (gen.next <= Math.ceil(camR) + 26) makeLane(gen.next++);
  for (const [r, l] of lanes) {
    if (r < camR - 12) {
      scene.remove(l.group);
      lanes.delete(r);
    }
  }
}

function wrapMover(m: Mover) {
  const span = HALF_W * 2;
  if (m.x > HALF_W + m.half) m.x -= span + m.half * 2;
  else if (m.x < -HALF_W - m.half) m.x += span + m.half * 2;
}

// ---------- giocatore ----------
type Hop = { fx: number; fr: number; tx: number; tr: number; t: number; bump: boolean; boat: Mover | null };
type Death = "strada" | "tram" | "acqua" | "corrente" | "lento";
const pl = {
  obj: new THREE.Group(),
  model: new THREE.Group() as THREE.Group,
  shadow: new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })),
  x: 0,
  r: 0,
  rx: 0, // posizione disegnata
  rr: 0,
  y: 0,
  facing: 0,
  face: 0,
  hop: null as Hop | null,
  queue: [] as [number, number][],
  boat: null as Mover | null,
  boatOff: 0,
  land: 0,
  dead: null as Death | null,
  deadT: 0,
  fly: new THREE.Vector3(),
};
pl.shadow.rotation.x = -Math.PI / 2;
pl.shadow.position.y = 0.01;
pl.obj.add(pl.model);
scene.add(pl.obj, pl.shadow);

function setChar(i: number) {
  pl.obj.remove(pl.model);
  pl.model = makeChar(CHARS[i].id);
  pl.obj.add(pl.model);
}

// ---------- stato ----------
type State = "title" | "play" | "dead" | "over" | "pause";
let state: State = "title";
let score = 0;
let coins = 0;
let camR = 0;
let camX = 0;
let started = false; // la camera scorre solo dopo il primo salto
let shake = 0;
let time = 0;
let overAt = 0;
let lastBoard: Board | null = null;
let spazz: { obj: THREE.Object3D; x: number; z: number } | null = null;

function reset() {
  for (const l of lanes.values()) scene.remove(l.group);
  lanes.clear();
  for (const p of particles) scene.remove(p.m);
  particles.length = 0;
  if (spazz) scene.remove(spazz.obj);
  spazz = null;
  gen = { next: -8, type: "parco", left: 0, prev: "parco", pathX: 0, waterDir: 1 };
  score = 0;
  coins = 0;
  camR = 0;
  camX = 0;
  started = false;
  Object.assign(pl, { x: 0, r: 0, rx: 0, rr: 0, y: 0, facing: 0, face: 0, hop: null, queue: [], boat: null, boatOff: 0, land: 0, dead: null, deadT: 0 });
  pl.obj.visible = true;
  pl.obj.rotation.set(0, 0, 0);
  setChar(charIdx);
  pl.model.scale.set(1, 1, 1);
  pl.model.position.set(0, 0, 0);
  pl.model.rotation.set(0, 0, 0);
  ensureLanes();
  hud();
}

// ---------- movimento ----------
const FACE: Record<string, number> = { "0,1": 0, "1,0": -Math.PI / 2, "-1,0": Math.PI / 2, "0,-1": Math.PI };

function tryMove(dx: number, dr: number) {
  if (state === "title") {
    if (!startGame()) return;
  }
  if (state !== "play" || pl.dead) return;
  if (pl.hop) {
    if (pl.queue.length < 1) pl.queue.push([dx, dr]);
    return;
  }
  started = true;
  pl.face = FACE[`${dx},${dr}`];
  const tr = pl.r + dr;
  const target = lanes.get(tr);
  const fromBoat = pl.boat;
  let tx = pl.x + dx;
  if (target && target.type !== "naviglio" && dr !== 0) tx = Math.round(tx);
  let bump = false;
  if (!target) bump = true;
  else if (target.type !== "naviglio" && (Math.round(tx) < MINX || Math.round(tx) > MAXX)) bump = true;
  else if (target.type === "naviglio" && (tx < MINX - 0.5 || tx > MAXX + 0.5)) bump = true;
  else if (target.type === "parco" && target.blocked.has(Math.round(tx))) bump = true;
  if (bump) {
    pl.hop = { fx: pl.x, fr: pl.r, tx: pl.x, tr: pl.r, t: 0, bump: true, boat: fromBoat };
    sfx.bump();
    return;
  }
  // un salto laterale sopra la stessa barca si porta dietro la barca
  const sameBoat = fromBoat && dr === 0 ? fromBoat : null;
  pl.hop = { fx: pl.x, fr: pl.r, tx, tr, t: 0, bump: false, boat: sameBoat };
  pl.boat = null;
  sfx.hop();
}

function landHop(h: Hop) {
  pl.hop = null;
  pl.land = 1;
  if (h.bump) {
    if (h.boat) {
      pl.boat = h.boat;
      pl.boatOff = pl.x - h.boat.x;
    }
    return;
  }
  pl.r = h.tr;
  pl.x = h.tx;
  const lane = lanes.get(pl.r)!;
  if (lane.type === "naviglio") {
    let found: Mover | null = null;
    for (const m of lane.movers) if (Math.abs(m.x - pl.x) <= m.half + 0.15) found = m;
    if (!found) return die("acqua");
    // aggancio al centro della casella più vicina sulla barca
    const k = clamp(Math.round(pl.x - (found.x - found.half + 0.5)), 0, Math.round(found.half * 2) - 1);
    pl.boat = found;
    pl.boatOff = -found.half + 0.5 + k;
    found.obj.position.y = -0.06;
    sfx.land();
  } else {
    pl.x = Math.round(pl.x);
    sfx.land();
    burst(new THREE.Vector3(pl.x, 0.05, -pl.r), 4, [0xffffff, 0xeef3f7], { speed: 1.2, up: 1, size: 0.07, life: 0.35, grav: 3 });
    const c = lane.coins.get(pl.x);
    if (c) {
      lane.group.remove(c);
      lane.coins.delete(pl.x);
      coins++;
      bank++;
      store("coins", bank);
      sfx.coin();
      burst(new THREE.Vector3(pl.x, 0.5, -pl.r), 10, [0xf2c94c, 0xfff0a8], { speed: 1.8, up: 2.5, size: 0.06, life: 0.5, grav: 6 });
    }
  }
  if (pl.r > score) {
    score = pl.r;
    hud();
  }
  const q = pl.queue.shift();
  if (q) tryMove(q[0], q[1]);
}

// ---------- morte ----------
const DEATH_TEXT: Record<Death, string> = {
  strada: "SPIACCICATO!",
  tram: "PRESO DAL TRAM!",
  acqua: "SPLASH!",
  corrente: "PORTATO VIA DAL NAVIGLIO!",
  lento: "TROPPO LENTO!",
};

function die(how: Death, by?: Mover, lane?: Lane) {
  if (pl.dead) return;
  pl.dead = how;
  pl.deadT = 0;
  pl.hop = null;
  pl.queue = [];
  state = "dead";
  shake = how === "lento" ? 0.2 : 0.45;
  const pos = new THREE.Vector3(pl.rx, 0.3, -pl.rr);
  const colors = featherColors();
  if (how === "strada") {
    sfx.squash();
    burst(pos, 22, colors, { speed: 3, up: 4, size: 0.09, life: 1.1, grav: 9 });
    pl.model.scale.set(1.5, 0.12, 1.5);
    pl.y = 0;
  } else if (how === "tram") {
    sfx.squash();
    sfx.whoosh();
    burst(pos, 18, colors, { speed: 4, up: 5, size: 0.09, life: 1, grav: 9 });
    const dir = Math.sign(lane?.speed || 1);
    pl.fly.set(dir * 16, 9, 0);
  } else if (how === "acqua" || how === "corrente") {
    sfx.splash();
    burst(new THREE.Vector3(pl.rx, -0.15, -pl.rr), 26, [0xd7eef7, 0x8fd0ee, 0xffffff], { speed: 2.2, up: 5, size: 0.08, life: 0.9, grav: 14 });
  } else {
    // la spazzatrice notturna passa e si porta via chi è rimasto indietro
    const obj = makeVehicle("spazzatrice");
    obj.position.set(-14, 0, -pl.rr);
    scene.add(obj);
    spazz = { obj, x: -14, z: -pl.rr };
    sfx.honk(-0.5);
  }
  void by;
  setTimeout(gameOver, how === "lento" ? 1600 : 1100);
}

function featherColors() {
  switch (CHARS[charIdx].id) {
    case "piccione":
      return [0x9aa0b0, 0x7d8496, 0x5f9a86, 0xc2c6d0];
    case "papera":
      return [0xfaf7ef, 0xeae4d4, 0xf08a24];
    case "gatto":
      return [0xe8913a, 0xb9661f, 0xfaf3e6];
    case "pinguino":
      return [0x262a36, 0xf7f5ef, 0xd7263d];
    case "panettone":
      return [0xc68a3a, 0x9a5a22, 0xe23d3d, 0x3fae49, 0xf3e2c0];
  }
}

// ---------- aggiornamento ----------
function update(dt: number) {
  time += dt;
  const d = difficulty();
  ensureLanes();

  // corsie
  for (const lane of lanes.values()) {
    if (lane.type === "binari" && lane.tram) {
      const tr = lane.tram;
      const near = Math.abs(lane.r - pl.r) <= 4 && state !== "title";
      if (!tr.active) {
        tr.timer -= dt;
        const warn = tr.timer < 1.4;
        const blink = warn && Math.floor(time * 8) % 2 === 0;
        (tr.light.material as THREE.MeshLambertMaterial).color.setHex(blink ? 0xff3b3b : 0x552222);
        (tr.light.material as THREE.MeshLambertMaterial).emissive.setHex(blink ? 0xff2020 : 0x000000);
        if (warn && !tr.warned) {
          tr.warned = true;
          if (near) sfx.tramBell(0.3);
        }
        if (tr.timer <= 0) {
          tr.active = true;
          tr.mover.x = -Math.sign(lane.speed) * 34;
          tr.mover.obj.visible = true;
          if (near) sfx.tramPass(0);
        }
      } else {
        tr.mover.x += lane.speed * dt;
        if (Math.abs(tr.mover.x) > 34) {
          tr.active = false;
          tr.warned = false;
          tr.mover.obj.visible = false;
          tr.timer = (2.5 + rnd() * 4) / (1 + d * 0.6);
        }
      }
      tr.mover.obj.position.x = tr.mover.x;
      continue;
    }
    for (const m of lane.movers) {
      m.x += lane.speed * dt;
      wrapMover(m);
      m.obj.position.x = m.x;
      if (m.kind === "barca") {
        m.obj.position.y = damp(m.obj.position.y, Math.sin(time * 2 + m.x) * 0.03, 6, dt);
        m.obj.rotation.x = Math.sin(time * 1.6 + m.x * 0.7) * 0.03;
      } else if (state === "play" && Math.abs(lane.r - pl.r) <= 1) {
        // clacson quando un veicolo arriva addosso alla corsia vicina
        m.honk -= dt;
        const ahead = (pl.rx - m.x) * Math.sign(lane.speed);
        if (m.honk <= 0 && ahead > 0 && ahead < 3 && lane.r !== pl.r && rnd() < 0.02) {
          m.honk = 6;
          const pan = clamp((m.x - pl.rx) / 6, -1, 1);
          if (m.kind === "vespa") sfx.vespa(pan);
          else sfx.honk(pan);
        }
      }
    }
    for (const f of lane.foam) {
      f.position.x += lane.speed * 0.6 * dt;
      if (f.position.x > 22) f.position.x -= 44;
      if (f.position.x < -22) f.position.x += 44;
    }
    for (const c of lane.coins.values()) {
      c.rotation.y += dt * 3;
      c.position.y = 0.45 + Math.sin(time * 3 + c.position.x) * 0.06;
    }
  }

  // giocatore
  if (!pl.dead && (state === "play" || state === "title")) {
    if (pl.hop) {
      const h = pl.hop;
      if (h.boat) {
        // si salta "dentro" il sistema di riferimento della barca
        const delta = (lanes.get(h.fr)?.speed ?? 0) * dt;
        h.fx += delta;
        h.tx += delta;
      }
      h.t += dt / HOP;
      const t = Math.min(1, h.t);
      const e = t * (2 - t);
      if (h.bump) {
        const k = Math.sin(Math.PI * t) * 0.12;
        const [ddx, ddr] = [Math.round(-Math.sin(pl.face)), Math.round(Math.cos(pl.face))];
        pl.rx = h.fx + ddx * k;
        pl.rr = h.fr + ddr * k;
        pl.x = h.fx;
        pl.y = Math.sin(Math.PI * t) * 0.15;
      } else {
        pl.rx = h.fx + (h.tx - h.fx) * e;
        pl.rr = h.fr + (h.tr - h.fr) * e;
        pl.y = Math.sin(Math.PI * t) * 0.45;
      }
      if (h.t >= 1) {
        pl.rx = h.tx;
        pl.rr = h.tr;
        pl.y = 0;
        landHop(h);
      }
    } else {
      if (pl.boat) {
        pl.x = pl.boat.x + pl.boatOff;
        pl.rx = damp(pl.rx, pl.x, 30, dt);
        if (pl.x < MINX - 1.4 || pl.x > MAXX + 1.4) die("corrente");
      } else {
        pl.rx = damp(pl.rx, pl.x, 25, dt);
      }
      pl.rr = pl.r;
      pl.y = 0;
    }

    // collisioni con veicoli e tram sulla corsia in cui si è (a metà salto conta l'arrivo)
    const lr = pl.hop && !pl.hop.bump ? (pl.hop.t > 0.5 ? pl.hop.tr : pl.hop.fr) : pl.r;
    const lane = lanes.get(lr);
    if (lane && state === "play" && (lane.type === "strada" || lane.type === "binari")) {
      for (const m of lane.movers) {
        if (lane.type === "binari" && !lane.tram!.active) continue;
        if (Math.abs(m.x - pl.rx) < m.half + 0.27) {
          if (pl.hop) {
            pl.rr = lr;
            pl.hop = null;
          }
          pl.r = lr;
          pl.x = Math.round(pl.rx);
          die(lane.type === "binari" ? "tram" : "strada", m, lane);
          break;
        }
      }
    }

    // la camera avanza da sola: chi resta indietro viene spazzato via
    if (state === "play" && pl.r < camR - 3.2 && !pl.hop) die("lento");
  }

  if (pl.dead) {
    pl.deadT += dt;
    if (pl.dead === "tram") {
      pl.rx += pl.fly.x * dt;
      pl.y += pl.fly.y * dt;
      pl.fly.y -= 20 * dt;
      pl.obj.rotation.z += dt * 14;
    } else if (pl.dead === "acqua" || pl.dead === "corrente") {
      pl.y = damp(pl.y, -1.2, 5, dt);
      if (pl.boat) pl.rx = pl.boat.x + pl.boatOff;
    } else if (pl.dead === "lento" && spazz) {
      spazz.x += 14 * dt;
      spazz.obj.position.x = spazz.x;
      if (spazz.x > pl.rx - 0.8) {
        pl.rx = spazz.x + 0.8;
        pl.y = 0.4;
        pl.obj.rotation.y += dt * 12;
      }
    }
  }

  // squash & stretch
  if (!pl.dead) {
    pl.land = Math.max(0, pl.land - dt / 0.16);
    let sy = 1;
    let sxz = 1;
    if (pl.hop && !pl.hop.bump) {
      const s = Math.sin(Math.PI * Math.min(1, pl.hop.t));
      sy = 1 + 0.22 * s;
      sxz = 1 - 0.1 * s;
    } else if (pl.land > 0) {
      sy = 1 - 0.24 * pl.land;
      sxz = 1 + 0.14 * pl.land;
    } else if (state === "title") {
      sy = 1 + Math.sin(time * 3) * 0.03;
    }
    pl.model.scale.set(sxz, sy, sxz);
    let df = pl.face - pl.facing;
    df = Math.atan2(Math.sin(df), Math.cos(df));
    pl.facing += df * (1 - Math.exp(-28 * dt));
    pl.model.rotation.y = pl.facing;
    if (state === "title") pl.model.rotation.y = Math.sin(time * 0.9) * 0.6;
  }
  const deckY = pl.boat && !pl.dead ? pl.boat.obj.position.y : 0;
  pl.obj.position.set(pl.rx, pl.y + deckY, -pl.rr);
  pl.shadow.visible = pl.y > 0.02 && !pl.dead;
  pl.shadow.position.set(pl.rx, deckY + 0.01, -pl.rr);
  pl.shadow.scale.setScalar(1 - pl.y * 0.6);

  // camera
  if (state === "play" || state === "title") {
    const want = pl.rr;
    if (want > camR) camR = damp(camR, want, 3.2, dt);
    if (started && state === "play") camR += (0.32 + d * 0.38) * dt;
  } else if (pl.dead === "lento") camR = damp(camR, pl.rr + 1, 4, dt); // si torna a guardare la spazzatrice
  camX = damp(camX, clamp(pl.rx * 0.45, -2, 2), 3, dt);
  shake = Math.max(0, shake - dt * 1.2);
  const sx = (rnd() - 0.5) * shake * 0.6;
  const sz = (rnd() - 0.5) * shake * 0.6;
  const look = new THREE.Vector3(camX, 0, -camR - 1.6);
  camera.position.copy(look).addScaledVector(CAM_OFF, camK).add(new THREE.Vector3(sx, 0, sz));
  camera.lookAt(look);
  sun.position.copy(look).add(SUN_OFF);
  sun.target.position.copy(look);
  (scene.fog as THREE.Fog).near = 20 * camK;
  (scene.fog as THREE.Fog).far = 38 * camK;
  snow.position.set(camX, 0, -camR - 2);

  updateParticles(dt);
  updateSnow(dt, time);
}

// ---------- UI ----------
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  score: $("score"),
  best: $("best"),
  coins: $("coins"),
  title: $("title"),
  over: $("over"),
  pause: $("pause"),
  charName: $("char-name"),
  charLock: $("char-lock"),
  reason: $("reason"),
  final: $("final"),
  finalBest: $("final-best"),
  rank: $("rank"),
  unlock: $("unlock"),
  boardTitle: $("board-title"),
  boardOver: $("board-over"),
  mute: $("mute"),
  nick: $<HTMLFormElement>("nick"),
  nickInput: $<HTMLInputElement>("nick-input"),
};

function hud() {
  ui.score.textContent = String(score);
  ui.best.textContent = `RECORD ${Math.max(best, score)}`;
  ui.coins.textContent = String(bank);
}

function renderBoard(el: HTMLElement, b: Board | null) {
  if (!b || !b.rows.length) {
    el.innerHTML = b ? "<li class='empty'>Nessuno ancora: il primo sei tu</li>" : "<li class='empty'>Classifica offline</li>";
    return;
  }
  el.innerHTML = b.rows
    .map((r) => `<li class="${r.me ? "me" : ""}"><span>${r.rank}</span><b>${r.me ? "TU" : r.tag}</b><em>${r.score}</em></li>`)
    .join("");
  if (b.me && b.me.rank && !b.rows.some((r) => r.me))
    el.innerHTML += `<li class="me"><span>${b.me.rank}</span><b>TU</b><em>${b.me.score}</em></li>`;
}

function showChar() {
  const c = CHARS[charIdx];
  ui.charName.textContent = c.name;
  const locked = c.cost > bank;
  ui.charLock.textContent = locked ? `Si sblocca a ${c.cost} monete (ne hai ${bank})` : c.cost ? "Sbloccato" : " ";
  ui.charLock.classList.toggle("locked", locked);
  ui.title.classList.toggle("locked", locked);
  pl.model.visible = true;
  setChar(charIdx);
  if (locked) pl.model.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).material = mat(0x2e3440)) : 0));
}

function changeChar(d: number) {
  charIdx = (charIdx + d + CHARS.length) % CHARS.length;
  sfx.select();
  showChar();
  if (CHARS[charIdx].cost <= bank) store("char", charIdx);
}

function showTitle() {
  state = "title";
  reset();
  ui.title.hidden = false;
  ui.over.hidden = true;
  ui.pause.hidden = true;
  ui.nickInput.value = player().nick || "";
  showChar();
  void board(5).then((b) => renderBoard($("board-title-list"), b));
}

function startGame(): boolean {
  if (CHARS[charIdx].cost > bank) {
    sfx.bump();
    return false;
  }
  initAudio();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  store("char", charIdx);
  if (state !== "title") reset();
  ui.title.hidden = true;
  ui.over.hidden = true;
  state = "play";
  return true;
}

async function gameOver() {
  state = "over";
  overAt = performance.now();
  const before = CHARS.filter((c) => c.cost <= bank - coins).length;
  const after = CHARS.filter((c) => c.cost <= bank).length;
  const isRecord = score > best;
  if (isRecord) {
    best = score;
    store("best", best);
  }
  ui.reason.textContent = DEATH_TEXT[pl.dead ?? "strada"];
  ui.final.textContent = String(score);
  ui.finalBest.textContent = isRecord && score > 0 ? "NUOVO RECORD!" : `Record ${best}`;
  ui.finalBest.classList.toggle("record", isRecord && score > 0);
  ui.unlock.hidden = after <= before;
  if (after > before) {
    ui.unlock.textContent = `Nuovo personaggio: ${CHARS[after - 1].name}!`;
    setTimeout(() => sfx.unlock(), 500);
  } else if (isRecord && score > 0) setTimeout(() => sfx.record(), 400);
  else sfx.over();
  ui.rank.textContent = " ";
  ui.over.hidden = false;
  hud();
  renderBoard(ui.boardOver, lastBoard);
  if (score > 0) {
    const rank = await submit(score, score, coins);
    if (rank && state === "over") ui.rank.textContent = `Sei ${rank}° in classifica`;
  }
  lastBoard = await board(5);
  if (state === "over") renderBoard(ui.boardOver, lastBoard);
}

function retry() {
  if (performance.now() - overAt < 450) return;
  reset();
  ui.over.hidden = true;
  state = "play";
}

function togglePause() {
  if (state === "play") {
    state = "pause";
    ui.pause.hidden = false;
  } else if (state === "pause") {
    state = "play";
    ui.pause.hidden = true;
    last = performance.now();
  }
}

function setMuteIcon() {
  ui.mute.textContent = isMuted() ? "AUDIO OFF" : "AUDIO ON";
  ui.mute.setAttribute("aria-pressed", String(isMuted()));
}
ui.mute.addEventListener("click", (e) => {
  e.stopPropagation();
  initAudio();
  toggleMute();
  setMuteIcon();
});
setMuteIcon();

$("char-prev").addEventListener("click", () => changeChar(-1));
$("char-next").addEventListener("click", () => changeChar(1));
$("play").addEventListener("click", () => {
  if (startGame()) tryMove(0, 1);
});
$("retry").addEventListener("click", retry);
$("menu").addEventListener("click", () => {
  if (performance.now() - overAt > 300) showTitle();
});
$("resume").addEventListener("click", togglePause);
ui.nick.addEventListener("submit", (e) => {
  e.preventDefault();
  setNick(ui.nickInput.value);
  ui.nickInput.blur();
  if (startGame()) tryMove(0, 1);
});
ui.nickInput.addEventListener("blur", () => setNick(ui.nickInput.value));

// ---------- input ----------
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, 1],
  KeyW: [0, 1],
  ArrowDown: [0, -1],
  KeyS: [0, -1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === "KeyM") {
    initAudio();
    toggleMute();
    setMuteIcon();
    return;
  }
  if (e.code === "KeyP" || e.code === "Escape") {
    if (state === "over" && e.code === "Escape") showTitle();
    else togglePause();
    return;
  }
  if (e.repeat) return;
  const dir = KEYS[e.code];
  if (state === "title") {
    if (e.code === "ArrowLeft" || e.code === "KeyA") return changeChar(-1);
    if (e.code === "ArrowRight" || e.code === "KeyD") return changeChar(1);
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      startGame();
      return;
    }
  }
  if (state === "over") {
    if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      retry();
    }
    return;
  }
  if (state === "pause") return;
  if (dir) {
    e.preventDefault();
    initAudio();
    tryMove(dir[0], dir[1]);
  }
});

// tocco: tap = avanti, swipe = direzione
let touch: { x: number; y: number; t: number } | null = null;
canvas.addEventListener(
  "pointerdown",
  (e) => {
    touch = { x: e.clientX, y: e.clientY, t: performance.now() };
  },
  { passive: true },
);
canvas.addEventListener("pointerup", (e) => {
  if (!touch) return;
  const dx = e.clientX - touch.x;
  const dy = e.clientY - touch.y;
  touch = null;
  initAudio();
  if (state === "over") return retry();
  if (state === "pause") return togglePause();
  const dist = Math.hypot(dx, dy);
  if (state === "title" && dist >= 30 && Math.abs(dx) > Math.abs(dy)) return changeChar(dx > 0 ? 1 : -1);
  if (dist < 30) return tryMove(0, 1);
  if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
  else tryMove(0, dy < 0 ? 1 : -1);
});
window.addEventListener("blur", () => {
  if (state === "play") togglePause();
});

// ---------- loop ----------
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state !== "pause") update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

showTitle();
requestAnimationFrame(frame);
