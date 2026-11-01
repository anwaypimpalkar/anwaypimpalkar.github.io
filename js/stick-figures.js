// Stick figures. A parade of eight crosses the research statement once it
// scrolls into view: each walks "personalization of", is measured and fitted
// with a different wearable at "robots and structures", and shows off what it
// does through "augment human performance". Each then stands and watches
// the next one, clapping; once the last has landed they all turn round and
// run off the end of the line, leaving it as they found it -- and after a
// pause, the parade sets out again. A ninth figure lies back on the
// footer's slash, reading or asleep by the time of day in Cambridge.
// Smaller ones elsewhere: a Kilroy peeks over "human" in the introduction
// and waves, award badges get a podium, a walker goes down a staircase of
// years beside the publications (to a pool of sharks), and the kid rides
// the back-to-top button.
//
// Everything is inline SVG drawn in currentColor. A pose is plain numbers,
// and each figure's route is a list of timed segments, so every frame is a
// pure function of time and layout -- resizing mid-parade just reflows it.

const SVG_NS = "http://www.w3.org/2000/svg";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// Phone widths, where the research statement stacks into lines: the figures
// around the research section sit those out, leaving the footer sunbather and
// the back-to-top kid.
const phone = window.matchMedia("(max-width: 720px)");

// Lengths in figure units, about 30 to a standing height. Angles are degrees
// from straight down, positive towards the way the figure faces.
const BONE = { thigh: 5.5, shin: 5.5, torso: 10.5, arm: 4.5, head: 3.5 };
const BODY = { thigh: 1, shin: 1, torso: 1, arm: 1, head: 1, scale: 1 };
// The figures around the page -- the stair walker, the back-to-top kid and
// the footer reader -- share one size, set from the body text: about 0.8px
// to a unit, so standing they are some 24px tall.
const figureUnit = () =>
  0.047 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fs-body")) || 16);

const rad = (deg) => (deg * Math.PI) / 180;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => v * v * (3 - 2 * v);
const lerp = (a, b, v) => a + (b - a) * v;
const lerpPt = (a, b, v) => ({ x: lerp(a.x, b.x, v), y: lerp(a.y, b.y, v) });
// One size fits all, then fitted: from 0 a wearable appears oversized,
// overshoots too tight, and settles at 1.
const snug = (v) => (v <= 0 ? 0 : 1 + Math.exp(-5 * v) * Math.cos(10 * v));
// a bump of height 1 centred on c, half-width w
const bump = (v, c, w) => clamp01(1 - Math.abs(v - c) / w);

// rot spins the whole body about pivot (figure units from the hip; clockwise
// is a forward flip). sx squeezes it horizontally: run through cos() it
// reads as a twist, and at -1 the figure faces backwards. lift raises it off
// the ground (negative drops it below); reach stretches the arms.
const POSE = { lean: 0, nod: 0, rot: 0, sx: 1, pivot: [0, 0], lift: 0, reach: 1, trail: 0, alpha: 1 };

// Blend two poses key by key; anything that isn't a number switches halfway.
const mix = (a, b, v) => {
  if (typeof a === "number" && typeof b === "number") return lerp(a, b, v);
  if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => mix(x, b[i], v));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const out = {};
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => {
      out[k] = k in a && k in b ? mix(a[k], b[k], v) : k in b ? b[k] : a[k];
    });
    return out;
  }
  return v < 0.5 ? a : b;
};

// how far below the hip the feet reach, so poses can be stood on a surface
const legDrop = (legs, body = BODY) =>
  Math.max(
    ...legs.map(
      ([thigh, shin]) =>
        Math.cos(rad(thigh)) * BONE.thigh * body.thigh + Math.cos(rad(shin)) * BONE.shin * body.shin
    )
  );

/* ---------- drawing ---------- */

const make = (parent, tag, cls) => {
  const el = document.createElementNS(SVG_NS, tag);
  if (cls) el.setAttribute("class", cls);
  parent.appendChild(el);
  return el;
};

const createLayer = (host, className) => {
  const svg = make(host, "svg", `stick_layer ${className}`);
  svg.setAttribute("aria-hidden", "true");
  return svg;
};

// Props are drawn by name each frame; whatever a frame doesn't draw is hidden.
const makeKit = (parent) => {
  const els = new Map();
  let used = new Set();
  const get = (name, tag, cls, opacity) => {
    let el = els.get(name);
    if (!el) {
      el = make(parent, tag, cls);
      els.set(name, el);
    }
    used.add(name);
    el.style.display = "";
    el.style.opacity = opacity;
    return el;
  };
  const pts = (list) => list.map((p) => `${p.x},${p.y}`).join(" ");
  return {
    begin() {
      used = new Set();
    },
    end() {
      els.forEach((el, name) => {
        if (!used.has(name)) el.style.display = "none";
      });
    },
    line(name, a, b, width, cls = "", opacity = 1) {
      const el = get(name, "line", cls, opacity);
      el.setAttribute("x1", a.x);
      el.setAttribute("y1", a.y);
      el.setAttribute("x2", b.x);
      el.setAttribute("y2", b.y);
      el.setAttribute("stroke-width", width);
    },
    poly(name, list, width, cls = "", opacity = 1) {
      const el = get(name, "polyline", cls, opacity);
      el.setAttribute("points", pts(list));
      el.setAttribute("stroke-width", width);
    },
    shape(name, list, cls, opacity = 1) {
      get(name, "polygon", cls, opacity).setAttribute("points", pts(list));
    },
    ring(name, c, r, width, cls = "", opacity = 1) {
      const el = get(name, "circle", cls, opacity);
      el.setAttribute("cx", c.x);
      el.setAttribute("cy", c.y);
      el.setAttribute("r", r);
      el.setAttribute("stroke-width", width);
    },
    dot(name, c, r, cls, opacity = 1) {
      const el = get(name, "circle", cls, opacity);
      el.setAttribute("cx", c.x);
      el.setAttribute("cy", c.y);
      el.setAttribute("r", r);
    },
    text(name, c, size, str, cls, opacity = 1) {
      const el = get(name, "text", cls, opacity);
      el.textContent = str;
      el.setAttribute("x", c.x);
      el.setAttribute("y", c.y);
      el.setAttribute("font-size", size);
    },
  };
};

// index 0 is the far side, drawn behind and fainter
const createFigure = (svg) => {
  const g = make(svg, "g", "stick_figure");
  const fig = { g, back: makeKit(make(g, "g")) };
  fig.arms = [make(g, "polyline", "stick_far")];
  fig.legs = [make(g, "polyline", "stick_far")];
  fig.torso = make(g, "line");
  fig.head = make(g, "circle");
  fig.legs.push(make(g, "polyline"));
  fig.arms.push(make(g, "polyline"));
  fig.front = makeKit(make(g, "g"));
  fig.hit = make(g, "circle", "stick_hit");
  return fig;
};

// Every point of a pose in the host's pixels. `raw` is the pose before the
// spin and twist, for props that are easier to place upright; `spin` maps a
// raw point to where it is drawn.
const joints = (pose, u, body = BODY) => {
  const at = (p, angle, len) => ({
    x: p.x + Math.sin(rad(angle)) * len * u,
    y: p.y + Math.cos(rad(angle)) * len * u,
  });
  const arm = BONE.arm * body.arm * pose.reach;
  const headR = BONE.head * body.head;

  const hip = { x: pose.hx, y: pose.hy };
  const up = 180 - pose.lean;
  const neck = at(hip, up, BONE.torso * body.torso);
  const shoulder = at(hip, up, BONE.torso * body.torso * 0.86);
  const head = at(neck, up - pose.nod, headR + 0.6);
  const legs = pose.legs.map(([thigh, shin]) => {
    const knee = at(hip, thigh, BONE.thigh * body.thigh);
    return { knee, foot: at(knee, shin, BONE.shin * body.shin), thigh, shin };
  });
  const arms = pose.arms.map(([upper, lower]) => {
    const elbow = at(shoulder, upper, arm);
    return { elbow, hand: at(elbow, lower, arm), upper, lower };
  });

  const pivot = { x: hip.x + pose.pivot[0] * u, y: hip.y + pose.pivot[1] * u };
  const cos = Math.cos(rad(pose.rot));
  const sin = Math.sin(rad(pose.rot));
  const spin = (p) => {
    const dx = (p.x - pivot.x) * pose.sx;
    const dy = p.y - pivot.y;
    return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
  };

  return {
    raw: { hip, neck, shoulder, head, legs, arms },
    hip: spin(hip),
    neck: spin(neck),
    shoulder: spin(shoulder),
    head: spin(head),
    headR: headR * u,
    legs: legs.map((leg) => ({ knee: spin(leg.knee), foot: spin(leg.foot) })),
    arms: arms.map((a) => ({ elbow: spin(a.elbow), hand: spin(a.hand) })),
    spin,
    at,
  };
};

const drawFigure = (fig, pose, u, env = {}) => {
  const pts = (...list) => list.map((p) => `${p.x},${p.y}`).join(" ");
  const j = joints(pose, u, env.body);

  fig.g.setAttribute("stroke-width", Math.max(1.25, 1.6 * u));
  fig.torso.setAttribute("x1", j.hip.x);
  fig.torso.setAttribute("y1", j.hip.y);
  fig.torso.setAttribute("x2", j.neck.x);
  fig.torso.setAttribute("y2", j.neck.y);
  fig.head.setAttribute("cx", j.head.x);
  fig.head.setAttribute("cy", j.head.y);
  fig.head.setAttribute("r", j.headR);
  j.legs.forEach((leg, i) => fig.legs[i].setAttribute("points", pts(j.hip, leg.knee, leg.foot)));
  j.arms.forEach((arm, i) => fig.arms[i].setAttribute("points", pts(j.shoulder, arm.elbow, arm.hand)));

  fig.back.begin();
  fig.front.begin();
  if (env.draw) env.draw(fig, j, pose, u, env);
  fig.back.end();
  fig.front.end();

  fig.hit.setAttribute("cx", j.shoulder.x);
  fig.hit.setAttribute("cy", j.shoulder.y);
  fig.hit.setAttribute("r", 12 * u);
};

/* ---------- poses and gaits ---------- */

const STAND = { legs: [[0, 0], [0, 0]], arms: [[0, 10], [0, 10]] };
const CROUCH = { lean: 25, legs: [[45, -35], [40, -40]], arms: [[-45, -25], [-40, -20]] };
const DEEP_CROUCH = { lean: 30, legs: [[75, -55], [70, -60]], arms: [[-50, -30], [-45, -25]] };
const LEAP = { lean: 5, legs: [[-70, -85], [80, 88]], arms: [[-115, -130], [135, 150]] };
const TUCK = { lean: 30, nod: 25, legs: [[125, -15], [118, -20]], arms: [[85, 150], [92, 158]] };
const SALUTE = { lean: -8, nod: -10, legs: [[0, 0], [0, 0]], arms: [[220, 225], [140, 135]] };
const ARROW = { lean: 0, nod: 0, legs: [[4, 0], [-4, 0]], arms: [[175, 180], [185, 180]] };
const HANDS_UP = { lean: 0, arms: [[230, 215], [130, 145]] };
// standing and squatting turned a little towards us, so both arms and both
// legs show instead of one stick in front of the other
const OPEN = { legs: [[16, 16], [-14, -14]], arms: [[38, 20], [-34, -16]] };
const OPEN_CROUCH = { ...CROUCH, legs: [[55, -30], [30, -50]], arms: [[-45, -25], [-15, -5]] };
const OPEN_SQUAT = { ...DEEP_CROUCH, legs: [[80, -50], [55, -75]], arms: [[-55, -30], [-25, -10]] };
const BOW = { lean: 65, nod: 10, legs: [[0, 0], [0, 0]], arms: [[-20, -10], [70, 110]] };
// bent double over the feet, fitting something on
const STOOP = { lean: 60, nod: 20, legs: [[72, -25], [66, -30]], arms: [[8, 0], [0, -8]] };

const WALK = { thigh: 28, knee: 40, arm: 20, elbow: 12, lean: 3 };
const JOG = { thigh: 32, knee: 60, arm: 30, elbow: 50, lean: 8 };
const RUN = { thigh: 40, knee: 85, arm: 45, elbow: 75, lean: 14 };

// a stride: thigh swing, how far the knee folds on the way through, arm
// swing; hunch and nod are held, hop bounces each step, bob nods the head
const gait = (style) => (phase, amp) => {
  const side = (s) => {
    const p = phase + s;
    const thigh = amp * style.thigh * Math.sin(p);
    const arm = -amp * style.arm * Math.sin(p);
    return {
      leg: [thigh, thigh - amp * style.knee * Math.max(0, Math.cos(p))],
      arm: [arm, arm + 8 + amp * style.elbow],
    };
  };
  const [far, near] = [side(0), side(Math.PI)];
  return {
    lean: (style.hunch || 0) + amp * style.lean,
    nod: (style.nod || 0) + (style.bob || 0) * amp * Math.sin(2 * phase),
    legs: [far.leg, near.leg],
    arms: [far.arm, near.arm],
    lift: (style.hop || 0) * amp * Math.abs(Math.sin(phase)),
  };
};

/* ---------- the cast ---------- */

// Each member brings a body, how it moves before and after its wearable,
// gear() to put the wearable on, routine() for "augment human performance",
// draw() for its props, and optionally how it stands to watch and drops
// off the end. Routes are built through a director
// (see below), which supplies add, stride, flight and wear.

const drawShoes = (fig, j, pose, u) => {
  if (!pose.shoes) return;
  j.raw.legs.forEach((leg, i) => {
    const s = pose.shoes[i];
    if (s < 0.02) return;
    const heel = j.spin(j.at(leg.foot, leg.shin - 90, 0.7 * s));
    const toe = j.spin(j.at(leg.foot, leg.shin + 90, 2.4 * s));
    fig.front.line(`shoe${i}`, heel, toe, 2.4 * u * s, i ? "stick_gear" : "stick_gear stick_far");
  });
};

// points on the torso: a along it from the hip, b out behind the back
const torsoFrame = (j, u) => {
  const { hip, neck } = j.raw;
  const len = Math.hypot(neck.x - hip.x, neck.y - hip.y) || 1;
  const t = { x: (neck.x - hip.x) / len, y: (neck.y - hip.y) / len };
  const back = { x: t.y, y: -t.x };
  return (a, b) => j.spin({ x: hip.x + (t.x * a + back.x * b) * u, y: hip.y + (t.y * a + back.y * b) * u });
};

// short strokes bursting out of c, opening as amount falls
const burst = (fig, name, c, u, amount, count = 6, spread = 360, from = 0, cls = "stick_fx") => {
  if (!(amount > 0.02)) return;
  for (let k = 0; k < count; k += 1) {
    const a = rad(from + (spread * k) / (spread === 360 ? count : count - 1));
    const r0 = (1.5 + 2.5 * (1 - amount)) * u;
    const r1 = r0 + 2 * u;
    fig.front.line(
      `${name}${k}`,
      { x: c.x + Math.cos(a) * r0, y: c.y + Math.sin(a) * r0 },
      { x: c.x + Math.cos(a) * r1, y: c.y + Math.sin(a) * r1 },
      0.9 * u,
      cls,
      amount
    );
  }
};

// 1. The gymnast: running shoes, then a leap, a tuck, and a twisting double.
const gymnast = {
  width: 0.8,
  walk: { speed: 1.8, freq: 2.2, gait: gait(WALK) },
  run: { speed: 3.4, freq: 3.2, gait: gait(RUN) },
  gear(d, x) {
    d.add(1.3, (v) => {
      const tap = Math.sin(v * Math.PI * 6) * 6;
      return {
        hx: x,
        ...STOOP,
        arms: [[8 + tap, tap], [tap, -8 - tap]],
        shoes: [snug((v - 0.15) / 0.3), snug((v - 0.5) / 0.3)],
      };
    }, 0.3);
    d.wear({ shoes: [1, 1] });
    d.add(0.35, () => ({ hx: x, ...STAND }), 0.3);
  },
  routine(d, x0, x1) {
    const x = (f) => lerp(x0, x1, f);
    d.add(0.12, () => ({ hx: x0, ...CROUCH }), 0.12);
    d.flight(x(0), x(0.22), 0.55, 8, LEAP);
    d.add(0.16, (v) => ({ hx: lerp(x(0.22), x(0.26), v), ...CROUCH }));
    d.flight(x(0.26), x(0.52), 0.7, 15, TUCK, { turns: 1 });
    d.add(0.16, (v) => ({ hx: lerp(x(0.52), x(0.56), v), ...CROUCH }));
    d.flight(x(0.56), x1, 1.15, 26, TUCK, { turns: 2, twist: 1 });
    d.add(0.25, () => ({ hx: x1, ...CROUCH }));
    d.add(0.9, () => ({ hx: x1, ...SALUTE }), 0.3);
  },
  draw: drawShoes,
};

// 2. The jetpacker: straps one on, sputters over the phrase, crashes, bows.
const jetpacker = {
  width: 0.85,
  walk: { speed: 1.7, freq: 2.1, gait: gait(WALK) },
  run: { speed: 2.6, freq: 2.6, gait: gait(JOG) },
  gear(d, x) {
    d.add(1.0, (v) => ({
      hx: x,
      ...STAND,
      lean: 10,
      arms: [[-70, -20], [-60, -10]],
      pack: snug((v - 0.2) / 0.5),
    }), 0.25);
    d.wear({ pack: 1 });
    d.add(0.3, () => ({ hx: x, ...STAND }), 0.25);
  },
  routine(d, x0, x1) {
    d.add(0.4, (v) => ({ hx: x0, ...CROUCH, flame: ease(v) }), 0.15);
    d.add(2.4, (v) => {
      // climb, two sputters where the flame cuts out, then a nosedive
      const dips = 7 * bump(v, 0.42, 0.07) + 9 * bump(v, 0.68, 0.07);
      const dive = v > 0.82 ? (1 - v) / 0.18 : 1;
      return {
        hx: lerp(x0, x1, v),
        lean: 35,
        legs: [[-15, -35], [-5, -25]],
        arms: [[60, 80], [70, 95]],
        lift: (16 * ease(clamp01(v / 0.25)) - dips) * dive,
        rot: 8 * Math.sin(v * Math.PI * 6) + (v > 0.82 ? 55 * ease((v - 0.82) / 0.18) : 0),
        flame: v > 0.85 ? 0 : 1 - bump(v, 0.42, 0.05) - bump(v, 0.68, 0.05),
      };
    });
    // hits the line, rolls out of it, gets up, takes a bow
    d.add(0.5, (v) => ({ hx: x1, ...TUCK, rot: lerp(55 - 360, 0, ease(v)), lift: 3 * Math.sin(Math.PI * v), puff: 1 - v }));
    d.add(0.4, () => ({ hx: x1, ...STAND }), 0.3);
    d.add(0.9, (v) => mix({ ...POSE, hx: x1, ...STAND }, { ...POSE, hx: x1, ...BOW }, Math.sin(Math.PI * v)));
  },
  draw(fig, j, pose, u, env) {
    const P = torsoFrame(j, u);
    const s = pose.pack || 0;
    if (s > 0.02) {
      fig.back.shape("pack", [P(3, 0.6), P(3 + 6 * s, 0.6), P(3 + 6 * s, 0.6 + 2.6 * s), P(3, 0.6 + 2.6 * s)], "stick_gear_fill");
    }
    if (pose.flame > 0.02) {
      const len = pose.flame * (3 + 1.5 * Math.sin(env.time * 45));
      fig.back.shape("flame", [P(3, 1.1), P(3, 2.7), P(3 - len, 1.9)], "stick_fx_fill");
    }
    burst(fig, "puff", { x: pose.hx, y: env.ground }, u, pose.puff, 5, 150, -165);
  },
};

// 3. The tall one: soft sleeves that inflate, reach the far end, and fling.
const lanky = {
  body: { ...BODY, thigh: 1.3, shin: 1.3, torso: 1.15, arm: 1.3 },
  width: 0.85,
  walk: { speed: 1.5, freq: 1.5, gait: gait({ thigh: 22, knee: 30, arm: 32, elbow: 6, lean: 0 }) },
  run: { speed: 2.4, freq: 2.0, gait: gait({ thigh: 30, knee: 55, arm: 40, elbow: 30, lean: 6 }) },
  gear(d, x) {
    d.add(0.9, (v) => ({ hx: x, ...STAND, arms: [[80, 90], [85, 95]], sleeve: snug((v - 0.2) / 0.6), inflate: 0 }), 0.25);
    d.wear({ sleeve: 1, inflate: 0 });
  },
  routine(d, x0, x1) {
    const armLen = 2 * BONE.arm * 1.3 * d.u;
    const target = x1 + 4 * d.u;
    const reachTo = (hx) => Math.max(1, (target - hx) / armLen);
    const full = reachTo(x0);
    const OUT = [[90, 90], [92, 92]];
    d.add(0.6, (v) => ({ hx: x0, ...STAND, arms: [[100, 105], [105, 110]], inflate: ease(v) }), 0.25);
    d.add(0.6, (v) => ({ hx: x0, ...STAND, lean: -5, arms: OUT, inflate: 1, reach: lerp(1, full, ease(v)) }), 0.15);
    d.add(0.25, (v) => ({ hx: x0, ...STAND, lean: -8, arms: OUT, inflate: 1, reach: full * (1 - 0.03 * Math.sin(v * Math.PI)) }));
    d.add(0.5, (v) => {
      // flung fast, overshooting its spot a little before settling into it
      const hx = lerp(x0, x1, 1 - (1 - v) ** 3) + 3 * d.u * Math.sin(Math.PI * v) * v;
      return { hx, lean: 25, legs: [[-50, -80], [-35, -70]], arms: OUT, inflate: 1, reach: reachTo(hx), lift: 3 * Math.sin(Math.PI * v) };
    });
    d.add(0.9, (v, s) => ({
      hx: x1,
      ...STAND,
      lean: 18 * Math.sin(s * 20) * Math.exp(-4 * s),
      inflate: 1 - 0.7 * ease(v),
    }), 0.2);
    d.wear({ inflate: 0.3 });
  },
  draw(fig, j, pose, u) {
    if (!pose.sleeve) return;
    const width = (2.4 + 2.6 * (pose.inflate || 0)) * u * pose.sleeve;
    j.arms.forEach((arm, i) => {
      fig.front.poly(`sleeve${i}`, [j.shoulder, arm.elbow, arm.hand], width, i ? "stick_sleeve" : "stick_sleeve stick_far");
    });
  },
};

// 4. The grandparent: ankle exoskeletons, a blurred sprint, a heel click.
const GRAN = { thigh: 14, knee: 22, arm: 4, elbow: 6, lean: 0, hunch: 22, nod: 12 };
const TUCKED_CANE = { cane: 95, caneDown: 0 };
const grandparent = {
  body: { ...BODY, torso: 0.95 },
  width: 0.9,
  start: { lean: 22, nod: 12, cane: 10, caneDown: 1, arms: [[0, 10], [25, 15]] },
  walk: {
    speed: 0.9,
    freq: 1.8,
    gait: (p, a) => {
      const g = gait(GRAN)(p, a);
      return { ...g, arms: [g.arms[0], [25, 15]], cane: 10, caneDown: 1 };
    },
  },
  run: {
    speed: 2.6,
    freq: 2.8,
    gait: (p, a) => {
      const g = gait(JOG)(p, a);
      return { ...g, arms: [g.arms[0], [10, 60]], ...TUCKED_CANE };
    },
  },
  gear(d, x) {
    d.add(1.1, (v) => ({
      hx: x,
      ...STOOP,
      lean: 50,
      arms: [[10, 0], [25, 15]],
      cane: 10,
      caneDown: 1,
      exo: [snug((v - 0.2) / 0.3), snug((v - 0.55) / 0.3)],
    }), 0.3);
    d.wear({ exo: [1, 1] });
    // stands up straight and stretches: good as new
    d.add(0.8, (v) => ({ hx: x, ...STAND, arms: [[165, 175], [10, 60]], ...TUCKED_CANE, spark: bump(v, 0.3, 0.3) }), 0.35);
  },
  routine(d, x0, x1) {
    const sprintEnd = Math.max(x0, x1 - 3 * d.u);
    d.add(0.25, () => ({ hx: x0, ...CROUCH, arms: [[-45, -25], [10, 60]], ...TUCKED_CANE }), 0.15);
    const dur = Math.max(0.35, (sprintEnd - x0) / (9 * d.size));
    d.add(dur, (v, s) => ({
      hx: lerp(x0, sprintEnd, v),
      ...gait(RUN)(2 * Math.PI * 11 * s, 1),
      arms: [[-60, -10], [10, 60]],
      lean: 22,
      ...TUCKED_CANE,
      blur: 1,
    }));
    // stops on a dime
    d.add(0.45, (v) => ({
      hx: lerp(sprintEnd, x1, ease(v)),
      lean: -25,
      legs: [[30, 45], [20, 35]],
      arms: [[-60, -30], [10, 60]],
      ...TUCKED_CANE,
      blur: 1 - v,
      dust: 1 - v,
    }), 0.08);
    d.flight(x1, x1, 0.6, 9, { lean: 0, legs: [[-25, 40], [25, -40]], arms: [[-40, -20], [165, 175]] }, {
      trail: false,
      extra: (v) => ({ spark: bump(v, 0.5, 0.2), cane: 180, caneDown: 0 }),
    });
    d.add(1.0, (v) => ({ hx: x1, ...STAND, lean: -3, arms: [[-30, 50], [80, 80]], cane: 90 + 720 * ease(v), caneDown: 0 }), 0.2);
  },
  scan: { lean: 15, arms: [[230, 215], [25, 15]] },
  watch: { arms: [[35, 115], [25, 15]], cane: 0, caneDown: 1 },
  draw(fig, j, pose, u, env) {
    // the cane: planted on the ground beside the hand, or held at an angle
    if (pose.cane !== undefined) {
      const hand = j.arms[1].hand;
      const held = j.spin(j.at(j.raw.arms[1].hand, pose.cane, 9));
      const planted = { x: hand.x + u, y: env.ground };
      const tip = lerpPt(held, planted, pose.caneDown || 0);
      const len = Math.hypot(hand.x - tip.x, hand.y - tip.y) || 1;
      const back = { x: (hand.x - tip.x) / len, y: (hand.y - tip.y) / len };
      const crook = { x: hand.x + back.x * 1.3 * u, y: hand.y + back.y * 1.3 * u };
      const hook = { x: crook.x - back.y * 1.3 * u, y: crook.y + back.x * 1.3 * u };
      fig.front.poly("cane", [tip, hand, crook, hook], 1.2 * u);
    }
    if (pose.exo) {
      j.raw.legs.forEach((leg, i) => {
        if (pose.exo[i] < 0.02) return;
        const a = j.spin(lerpPt(leg.knee, leg.foot, 0.4));
        const b = j.spin(lerpPt(leg.knee, leg.foot, 0.85));
        fig.front.line(`exo${i}`, a, b, 2.6 * u * pose.exo[i], i ? "stick_gear" : "stick_gear stick_far");
      });
    }
    // the legs go round like a cartoon wheel, with speed lines behind
    if (pose.blur > 0.02) {
      const c = j.spin({ x: j.raw.hip.x, y: j.raw.hip.y + 6 * u });
      fig.back.ring("blur", c, 6.5 * u, 0.9 * u, "stick_fx stick_dash", 0.7 * pose.blur);
      [0, 1, 2].forEach((k) => {
        const y = j.hip.y + (-8 + 6 * k) * u;
        fig.back.line(`speed${k}`, { x: j.hip.x - (7 + 2 * k) * u, y }, { x: j.hip.x - (15 + 4 * k) * u, y }, 0.9 * u, "stick_fx", pose.blur);
      });
    }
    burst(fig, "dust", j.legs[1].foot, u, pose.dust, 3, 70, -160);
    burst(fig, "spark", lerpPt(j.legs[0].foot, j.legs[1].foot, 0.5), u, pose.spark, 4);
  },
};

// 5. The wheelchair racer: power-assist hubs, a wheelie, a backflip.
const CHAIR = { legs: [[85, 5], [80, 0]], arms: [[15, 70], [20, 75]] };
const push = (p, a) => {
  const upper = 20 + 35 * Math.sin(p) * a;
  const lower = upper + 40 - 25 * Math.cos(p) * a;
  return { ...CHAIR, lean: 6 + 8 * a * Math.max(0, Math.sin(p)), arms: [[upper - 5, lower - 5], [upper, lower]] };
};
const racer = {
  width: 1.15,
  // wheel axle half a unit behind the hip, rim 5 units round: the hip rides
  // 9.5 units up, and wheelies and flips turn about the axle
  start: { chair: 1, hipH: 9.5, pivot: [-0.5, 4.5], ...CHAIR },
  walk: { speed: 1.9, freq: 1.2, gait: push },
  run: { speed: 3.4, freq: 1.8, gait: push },
  gear(d, x) {
    d.add(0.9, (v) => ({
      hx: x,
      ...CHAIR,
      lean: 30,
      arms: [[-10, 10], [-5, 15]],
      hub: snug((v - 0.2) / 0.35),
      gloves: snug((v - 0.55) / 0.35),
    }), 0.25);
    d.wear({ hub: 1, gloves: 1 });
  },
  routine(d, x0, x1) {
    const x = (f) => lerp(x0, x1, f);
    d.add(0.35, (v) => ({ hx: lerp(x0, x(0.08), v), ...CHAIR, rot: -28 * ease(v), lean: -5 }), 0.15);
    d.add(0.5, (v) => ({ hx: lerp(x(0.08), x(0.3), v), ...CHAIR, rot: -28 + 3 * Math.sin(v * Math.PI * 3), lean: -5 }));
    d.add(0.95, (v) => ({
      hx: lerp(x(0.3), x(0.85), v),
      ...CHAIR,
      arms: [[-60, -40], [130, 150]],
      lift: 20 * 4 * v * (1 - v),
      rot: lerp(-28, -360, ease(clamp01((v - 0.05) / 0.85))),
      trail: v > 0.06 && v < 0.94 ? 1 : 0,
    }));
    d.add(0.45, (v) => ({ hx: lerp(x(0.85), x1, ease(v)), ...CHAIR, lift: 1.5 * Math.sin(Math.PI * v), arms: [[40, 80], [45, 85]] }));
  },
  watch: { ...CHAIR, arms: [[35, 110], [40, 115]] },
  drop: { ...CHAIR, arms: [[150, 170], [160, 175]] },
  draw(fig, j, pose, u) {
    if (!pose.chair) return;
    const { hip } = j.raw;
    const R = 5 * u;
    const P = (dx, dy) => j.spin({ x: hip.x + dx * u, y: hip.y + dy * u });
    const axle = P(-0.5, 4.5);
    // the spokes turn with distance travelled
    const turn = pose.hx / R;
    fig.back.ring("wheel", axle, R, 1.1 * u);
    [0, 1, 2].forEach((k) => {
      const a = turn + (k * Math.PI) / 3;
      const dx = Math.cos(a) * 4.6;
      const dy = Math.sin(a) * 4.6;
      fig.back.line(`spoke${k}`, P(-0.5 + dx, 4.5 + dy), P(-0.5 - dx, 4.5 - dy), 0.6 * u, "", 0.6);
    });
    fig.back.line("seat", P(-2.5, 0.6), P(3, 0.6), 1.2 * u);
    fig.back.line("backrest", P(-2.5, 0.6), P(-3.2, -6), 1.2 * u);
    fig.back.line("fork", P(3, 0.6), P(6.5, 8.5), 1.1 * u);
    fig.back.line("footrest", P(5.2, 6.4), P(7.6, 6.4), 1.1 * u);
    fig.back.ring("caster", P(6.5, 8.5), u, u);
    if (pose.hub > 0.02) fig.front.dot("hub", axle, 1.8 * u * pose.hub, "stick_gear_fill");
    if (pose.gloves > 0.02) {
      j.arms.forEach((arm, i) => fig.front.dot(`glove${i}`, arm.hand, 1.1 * u * pose.gloves, "stick_gear_fill"));
    }
  },
};

// 6. The dancer: headphones and a buzzing wristband; moonwalk, headspin, freeze.
const HEADSPIN = { legs: [[35, 45], [-35, -45]], arms: [[165, 190], [195, 170]] };
const FREEZE = { legs: [[70, 120], [-20, -60]], arms: [[165, 190], [210, 160]] };
const dancer = {
  width: 0.8,
  walk: { speed: 1.7, freq: 2.1, gait: gait({ ...WALK, bob: 8 }) },
  run: { speed: 2.6, freq: 2.6, gait: gait({ ...JOG, bob: 10 }) },
  gear(d, x) {
    d.add(1.0, (v) => ({
      hx: x,
      ...STAND,
      arms: [[150, 200], [155, 205]],
      phones: snug((v - 0.15) / 0.35),
      band: snug((v - 0.6) / 0.3),
    }), 0.25);
    d.wear({ phones: 1, band: 1 });
    d.add(0.3, () => ({ hx: x, ...STAND }), 0.25);
  },
  routine(d, x0, x1) {
    const x = (f) => lerp(x0, x1, f);
    // upside down, the head rests on the line: torso, neck gap, then the head
    const headstand = BONE.torso + 0.6 + 2 * BONE.head;
    const standing = legDrop(STAND.legs);
    // facing backwards while gliding forwards
    const moon = Math.min(2.6, Math.max(1.2, (x(0.45) - x0) / (0.9 * d.size)));
    d.add(moon, (v, s) => ({
      hx: lerp(x0, x(0.45), v),
      ...gait({ ...WALK, thigh: 18, knee: 50 })(2 * Math.PI * 1.6 * s, 1),
      sx: -1,
      buzz: 1,
    }), 0.3);
    d.add(0.45, (v) => ({
      hx: lerp(x(0.45), x(0.6), v),
      ...mix(STAND, HEADSPIN, ease(v)),
      sx: lerp(-1, 1, ease(clamp01(v * 2))),
      rot: 180 * ease(v),
      hipH: lerp(standing, headstand, ease(v)) + 4 * Math.sin(Math.PI * v),
      buzz: 1,
    }));
    d.add(1.4, (v, s) => ({ hx: x(0.6), ...HEADSPIN, rot: 180, sx: Math.cos(2 * Math.PI * 2.5 * s), hipH: headstand, buzz: 1 }));
    d.add(0.6, () => ({ hx: x(0.6), ...FREEZE, rot: 165, hipH: headstand, buzz: 1 }), 0.15);
    d.add(0.5, (v) => ({
      hx: lerp(x(0.6), x1, v),
      ...mix(FREEZE, STAND, ease(v)),
      rot: lerp(165, 360, ease(v)),
      hipH: lerp(headstand, standing, ease(v)) + 6 * Math.sin(Math.PI * v),
    }));
    d.add(0.2, () => ({ hx: x1, ...CROUCH }));
  },
  draw(fig, j, pose, u, env) {
    const r = j.headR;
    if (pose.phones > 0.02) {
      // a band over the crown, and a cup over the ear
      const c = j.raw.head;
      const n = j.raw.neck;
      const len = Math.hypot(c.x - n.x, c.y - n.y) || 1;
      const up = { x: (c.x - n.x) / len, y: (c.y - n.y) / len };
      const rr = r + 0.9 * u * pose.phones;
      const band = [];
      for (let k = -4; k <= 4; k += 1) {
        const a = rad(k * 24);
        band.push(j.spin({
          x: c.x + (up.x * Math.cos(a) - up.y * Math.sin(a)) * rr,
          y: c.y + (up.x * Math.sin(a) + up.y * Math.cos(a)) * rr,
        }));
      }
      fig.front.poly("phones", band, 1.2 * u, "stick_gear", pose.phones);
      const ear = j.spin({ x: c.x - up.y * -0.8 * u - up.x * 0.3 * u, y: c.y + up.x * -0.8 * u - up.y * 0.3 * u });
      fig.front.dot("cup", ear, 1.2 * u * pose.phones, "stick_gear_fill");
    }
    if (pose.band > 0.02) {
      const arm = j.raw.arms[1];
      fig.front.line("band", j.spin(lerpPt(arm.elbow, arm.hand, 0.55)), j.spin(lerpPt(arm.elbow, arm.hand, 0.9)), 2.4 * u * pose.band, "stick_gear");
    }
    if (pose.buzz > 0.02) {
      const jit = 0.5 * u * Math.sin(env.time * 50);
      [-1, 1].forEach((side) => {
        const c = j.head;
        const o = r + 1.8 * u + jit;
        fig.front.poly(`buzz${side}`, [
          { x: c.x + side * o, y: c.y - 1.4 * u },
          { x: c.x + side * (o + 0.8 * u), y: c.y },
          { x: c.x + side * o, y: c.y + 1.4 * u },
        ], 0.9 * u, "stick_fx", pose.buzz);
      });
    }
  },
};

// 7. The juggler: a robot arm with a claw, and three dots from thin air.
const JUGGLE = { arms: [[45, 120], [40, 125]] };
const juggler = {
  width: 0.8,
  walk: { speed: 1.7, freq: 2.1, gait: gait(WALK) },
  run: { speed: 2.8, freq: 2.8, gait: gait(JOG) },
  gear(d, x) {
    d.add(1.0, (v) => ({ hx: x, ...STAND, lean: 6, arms: [[30, 60], [-10, 20]], robot: snug((v - 0.25) / 0.5), claw: 0 }), 0.25);
    d.wear({ robot: 1, claw: 0 });
    d.add(0.5, (v) => ({ hx: x, ...STAND, arms: [[0, 10], [120, 150]], claw: Math.abs(Math.sin(v * Math.PI * 3)) }), 0.2);
  },
  routine(d, x0, x1) {
    d.add(0.6, (v) => ({ hx: x0, ...STAND, arms: [[0, 10], [130, 160]], claw: Math.abs(Math.sin(v * Math.PI * 4)) }), 0.2);
    const dur = 2.8;
    d.add(dur, (v, s) => ({
      hx: lerp(x0, x1, v),
      ...gait(WALK)(2 * Math.PI * 1.4 * s, 0.6),
      ...JUGGLE,
      juggle: s * 1.5,
      balls: clamp01(s / 0.9),
    }), 0.3);
    d.add(0.5, (v) => ({ hx: x1, ...STAND, ...JUGGLE, juggle: dur * 1.5, balls: 1 - v, claw: 0.2 }));
    d.add(0.8, (v) => mix({ ...POSE, hx: x1, ...STAND }, { ...POSE, hx: x1, ...BOW }, Math.sin(Math.PI * v)), 0.2);
  },
  draw(fig, j, pose, u) {
    if (pose.robot > 0.02) {
      const arm = j.arms[1];
      const raw = j.raw.arms[1];
      fig.front.poly("robot", [j.shoulder, arm.elbow, arm.hand], 2.6 * u * pose.robot, "stick_gear");
      fig.front.dot("joint", arm.elbow, 1.2 * u * pose.robot, "stick_gear_fill");
      [-1, 1].forEach((side) => {
        const tip = j.spin(j.at(raw.hand, raw.lower + side * (20 + 30 * (pose.claw || 0)), 2 * pose.robot));
        fig.front.line(`claw${side}`, arm.hand, tip, 1.1 * u, "stick_gear");
      });
    }
    if (pose.balls > 0.02) {
      const from = j.arms[1].hand;
      const to = j.arms[0].hand;
      for (let i = 0; i < 3; i += 1) {
        if (pose.balls * 3 < i + 0.5) continue;
        const p = (pose.juggle + i / 3) % 1;
        // up and over from the robot hand to the other, then a quick pass back
        const q = p / 0.7;
        const c = p < 0.7
          ? { x: lerp(from.x, to.x, q) + Math.sin(Math.PI * q) * 1.5 * u, y: lerp(from.y, to.y, q) - 36 * u * q * (1 - q) }
          : lerpPt(to, from, (p - 0.7) / 0.3);
        fig.front.dot(`ball${i}`, c, 1.1 * u, "stick_fx_fill");
      }
    }
  },
};

// 8. The kid: snap-through popper shoes, straight up and back down spinning.
const kid = {
  body: { ...BODY, scale: 0.72, head: 1.4, torso: 0.9 },
  width: 0.7,
  walk: { speed: 1.7, freq: 2.6, gait: gait({ thigh: 30, knee: 50, arm: 30, elbow: 20, lean: 2, hop: 2 }) },
  run: { speed: 2.6, freq: 3.2, gait: gait({ ...JOG, hop: 3 }) },
  gear(d, x) {
    d.add(0.9, (v) => ({
      hx: x,
      ...DEEP_CROUCH,
      arms: [[20, 0], [10, -5]],
      domes: [snug((v - 0.2) / 0.35), snug((v - 0.5) / 0.35)],
      snap: 0,
    }), 0.25);
    d.wear({ domes: [1, 1], snap: 0 });
  },
  routine(d, x0, x1) {
    if (x1 - x0 > 2 * d.u) d.stride(x0, x1, 2.2, gait({ ...JOG, hop: 3 }), 3.2, 0.2, 0.25);
    // the domes turn inside out as it squats, then snap back and launch it
    d.add(0.6, (v) => ({ hx: x1, ...DEEP_CROUCH, snap: ease(v) }), 0.2);
    // High enough to clear the top of the page, wherever it is scrolled:
    // the kid is gone for a moment, then drops back in spinning.
    const high = ((d.sky + 3 * d.size) * 1.15) / d.u;
    d.add(1.6 + d.sky / 600, (v) => {
      const falling = clamp01((v - 0.7) / 0.25);
      return {
        hx: x1,
        ...mix(ARROW, TUCK, ease(clamp01(falling * 3)) * (1 - bump(v, 1, 0.05))),
        lift: high * 4 * v * (1 - v),
        rot: 720 * ease(falling),
        snap: 0,
        flash: bump(v, 0, 0.06),
        trail: v > 0.7 && v < 0.95 ? 1 : 0,
      };
    });
    d.add(0.3, (v) => ({ hx: x1, ...CROUCH, flash: 0.6 * (1 - v) }));
  },
  draw(fig, j, pose, u) {
    if (pose.domes) {
      j.raw.legs.forEach((leg, i) => {
        const s = pose.domes[i];
        if (s < 0.02) return;
        const bulge = 1.3 * u * (1 - 2 * (pose.snap || 0));
        const pts = [-2, -1, 0, 1, 2].map((k) => {
          const x = 0.8 * k;
          return j.spin({ x: leg.foot.x + x * u * s, y: leg.foot.y + bulge * (1 - (x / 1.6) ** 2) * s });
        });
        fig.front.poly(`dome${i}`, pts, 1.3 * u, i ? "stick_gear" : "stick_gear stick_far");
      });
    }
    burst(fig, "flash", lerpPt(j.legs[0].foot, j.legs[1].foot, 0.5), u, pose.flash);
  },
};

// Being measured, in the colour of "personalization": a line sweeps down the
// figure shading what it has covered, and a dimension bracket grows beside it.
const drawScan = (fig, j, pose, u, env) => {
  if (!(pose.scanAlpha > 0.02)) return;
  const pts = [j.head, j.hip, ...j.legs.flatMap((l) => [l.knee, l.foot]), ...j.arms.flatMap((a) => [a.elbow, a.hand])];
  const left = Math.min(...pts.map((p) => p.x)) - 2.5 * u;
  const right = Math.max(...pts.map((p) => p.x)) + 2.5 * u;
  const top = Math.min(...pts.map((p) => p.y), j.head.y - j.headR) - 1.5 * u;
  const y = lerp(top, env.ground, pose.scan);
  const a = pose.scanAlpha;
  fig.back.shape("scanned", [{ x: left, y: top }, { x: right, y: top }, { x: right, y }, { x: left, y }], "stick_scan_fill", 0.12 * a);
  if (pose.scan < 1) fig.front.line("scanline", { x: left - u, y }, { x: right + u, y }, 0.9 * u, "stick_scan", a);
  const bx = left - 2.5 * u;
  fig.front.line("ruler", { x: bx, y: top }, { x: bx, y }, 0.7 * u, "stick_scan", a);
  fig.front.line("tickTop", { x: bx - 1.2 * u, y: top }, { x: bx + 1.2 * u, y: top }, 0.7 * u, "stick_scan", a);
  fig.front.line("tickEnd", { x: bx - 1.2 * u, y }, { x: bx + 1.2 * u, y }, 0.7 * u, "stick_scan", a);
};

// Finished performers line up from the end of the line leftwards, so the
// ones that need the most room for their routine go first.
const CAST = [gymnast, jetpacker, lanky, grandparent, racer, dancer, juggler, kid];

/* ---------- the parade on the research statement ---------- */

const ENTER = 0.5;
const SIT = 0.6;

// A director builds one figure's route: timed segments, each a pose as a
// function of its own progress, optionally easing in from where the
// previous one ended. Wearables put on along the way stay on for every later
// segment; marks note when the figure reaches each stage.
const director = (m, member) => {
  const body = member.body || BODY;
  const u = m.u * body.scale;
  const segs = [];
  const marks = {};
  let worn = { ...(member.start || {}) };
  let total = 0;

  const hipFor = (pose) =>
    m.ground - ((pose.hipH !== undefined ? pose.hipH : legDrop(pose.legs, body)) + pose.lift) * u;

  const d = {
    u,
    size: m.size,
    sky: m.sky,
    wear(extra) {
      worn = { ...worn, ...extra };
    },
    mark(name) {
      marks[name] = total;
    },
    add(dur, fn, blend = 0) {
      const w = worn;
      segs.push({
        dur,
        blend,
        pose: (v, s) => {
          const pose = { ...POSE, ...STAND, ...w, ...fn(v, s) };
          if (pose.hy === undefined) pose.hy = hipFor(pose);
          return pose;
        },
      });
      total += dur;
    },
    // a stretch of gait between two points, in whole strides so it ends on
    // the step it started with
    stride(x0, x1, speed, step, freq, easeIn = 0.3, easeOut = 0.3) {
      const dur = Math.max(0.3, Math.abs(x1 - x0) / (speed * m.size));
      const f = Math.max(1, Math.round(dur * freq)) / dur;
      d.add(dur, (v, s) => {
        const amp = (easeIn ? ease(clamp01(s / easeIn)) : 1) * (easeOut ? ease(clamp01((dur - s) / easeOut)) : 1);
        return { hx: lerp(x0, x1, v), ...step(2 * Math.PI * f * s, amp) };
      });
    },
    // one flight: crouch, airborne arc of height h (figure units), crouch
    flight(x0, x1, dur, h, shape, { turns = 0, twist = 0, trail = true, extra = () => ({}) } = {}) {
      d.add(dur, (v) => {
        const tuck = ease(clamp01(v / 0.18)) * ease(clamp01((1 - v) / 0.18));
        return {
          ...mix({ ...POSE, ...CROUCH }, { ...POSE, ...CROUCH, ...shape }, tuck),
          hx: lerp(x0, x1, v),
          lift: h * 4 * v * (1 - v),
          rot: 360 * turns * ease(clamp01((v - 0.12) / 0.76)),
          sx: Math.cos(rad(360 * twist * ease(clamp01((v - 0.25) / 0.5)))),
          trail: trail && v > 0.06 && v < 0.94 ? 1 : 0,
          ...extra(v),
        };
      });
    },
  };
  return { d, segs, marks, body, u };
};

const WATCH = { ...STAND, lean: 0, nod: 0, arms: [[35, 115], [40, 120]] };
const DROP = 0.7;

// One member's whole route, ending at its spot x in the line-up. The last
// segment is the afterparty, sized and filled in once everyone is scheduled.
const plan = (m, member, spot, last) => {
  const r = director(m, member);
  const { d } = r;
  d.add(ENTER, () => ({ hx: m.start }));
  const walk = (x0, x1) => d.stride(x0, x1, member.walk.speed, member.walk.gait, member.walk.freq);
  if (m.shoesAt !== null) {
    // hands up on the last letter of "personalization" to be measured, a
    // sweep from head to toe, then on to the fitting
    walk(m.start, m.scanAt);
    d.mark("scan");
    d.add(1.0, (v) => ({
      hx: m.scanAt,
      ...(member.scan || HANDS_UP),
      scan: clamp01(v / 0.6),
      scanAlpha: 1 - ease(clamp01((v - 0.8) / 0.2)),
    }), 0.2);
    d.mark("scanned");
    walk(m.scanAt, m.shoesAt);
    d.mark("gear");
    member.gear(d, m.shoesAt);
    d.mark("geared");
    const runEnd = m.tumbleAt ?? spot;
    d.stride(m.shoesAt, runEnd, member.run.speed, member.run.gait, member.run.freq, 0.3, m.tumbleAt === null ? 0.3 : 0.15);
  } else {
    walk(m.start, spot);
  }
  if (m.tumbleAt !== null) {
    d.mark("routine");
    // powering up: a burst, and from here on the wearable is in the colour
    // of "augment human performance"
    d.wear({ charged: 1 });
    d.add(0.4, (v) => ({ hx: m.tumbleAt, ...member.run.gait(0, 0), power: 1 - v }), 0.15);
    member.routine(d, m.tumbleAt, Math.max(spot, m.tumbleAt + 4 * d.u));
  }
  d.mark("done");
  // turn round to watch whoever comes next; the last one in has nobody to
  // watch, and stays facing the way out
  d.add(0.5, () => ({ hx: spot, ...WATCH, ...(member.watch || {}), sx: last ? 1 : -1 }), 0.5);
  d.mark("watching");
  d.add(1, (v, s) => r.after(s));
  return r;
};

// Watching: facing back down the line, clapping each landing, the last one
// included. Then all turn round together, and one by one run off the end
// of the line, hop off the edge, and drop out of sight.
const afterparty = (m, member, T, cue) => {
  const u = m.u * (member.body || BODY).scale;
  const watch = { hx: cue.spot, ...WATCH, ...(member.watch || {}), sx: cue.last ? 1 : -1 };

  if (T >= cue.exitAt) {
    const e = T - cue.exitAt;
    if (e < cue.run) {
      return {
        ...watch,
        ...member.run.gait(2 * Math.PI * member.run.freq * e, ease(clamp01(e / 0.25))),
        hx: lerp(cue.spot, m.edge, e / cue.run),
        sx: 1,
      };
    }
    const f = clamp01((e - cue.run) / DROP);
    return {
      ...watch,
      ...(member.drop || ARROW),
      hx: m.edge + 4 * u * f,
      sx: 1,
      rot: 40 * f,
      lift: 6 * Math.sin(Math.PI * f) - 50 * f * f,
      alpha: 1 - ease(clamp01((f - 0.3) / 0.7)),
    };
  }

  let pose = watch;
  const clap = cue.claps.find((c) => T >= c && T < c + 1.2);
  if (clap !== undefined) {
    const k = Math.sin(2 * Math.PI * 4 * (T - clap));
    const env = ease(clamp01((T - clap) / 0.15)) * ease(clamp01((clap + 1.2 - T) / 0.15));
    pose = mix(pose, { ...pose, arms: [[60 + 8 * k, 95], [60 - 8 * k, 85]] }, env);
  }
  const turn = ease(clamp01((T - cue.turnAt) / 0.3));
  return { ...pose, sx: cue.last ? 1 : lerp(-1, 1, turn) };
};

const poseAt = (segs, t) => {
  let t0 = 0;
  let prev = null;
  for (const seg of segs) {
    if (t < t0 + seg.dur || seg === segs[segs.length - 1]) {
      const s = Math.min(Math.max(t - t0, 0), seg.dur);
      const pose = seg.pose(clamp01(s / seg.dur), s);
      if (!seg.blend || !prev) return pose;
      return mix(prev.pose(1, prev.dur), pose, ease(clamp01(s / seg.blend)));
    }
    t0 += seg.dur;
    prev = seg;
  }
  return null;
};

// Stagger the starts so nobody collides: each figure reaches the wearable
// spot only after the one before has left it, and starts its routine only
// once the one before has finished. Starting behind and arriving behind at
// steady speeds, nobody overtakes on the way.
const schedule = (routes) => {
  const starts = [0];
  for (let i = 1; i < routes.length; i += 1) {
    const r = routes[i];
    const p = routes[i - 1];
    const before = starts[i - 1];
    const after = (mark, prevMark, gap) =>
      r.marks[mark] !== undefined && p.marks[prevMark] !== undefined
        ? before + p.marks[prevMark] + gap - r.marks[mark]
        : -Infinity;
    starts.push(
      Math.max(
        before + 1.4,
        after("scan", "scanned", 0.3),
        after("gear", "geared", 0.5),
        after("routine", "done", 0.25),
        after("done", "done", 0.6)
      )
    );
  }
  return starts;
};

// The middle of the last letter `ch` (or just the last letter) in an
// element's own text, in viewport pixels
const letterX = (el, ch) => {
  const text = [...el.childNodes].reverse().find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  if (!text) return null;
  const str = text.textContent;
  const i = ch ? str.lastIndexOf(ch) : str.trimEnd().length - 1;
  if (i < 0) return null;
  const range = document.createRange();
  range.setStart(text, i);
  range.setEnd(text, i + 1);
  const r = range.getBoundingClientRect();
  return (r.left + r.right) / 2;
};

const setupParade = () => {
  const formula = document.querySelector(".thesis_formula");
  // nothing stays on the line afterwards, so with reduced motion there is
  // simply no parade
  if (!formula || reduceMotion.matches) return;

  const svg = createLayer(formula, "stick_layer-runner");
  const figs = CAST.map(() => createFigure(svg));
  const TRAIL = 8;
  const TRAIL_STEP = 0.03;

  // The route only follows the first row of the statement. The parade is
  // off at phone widths, where the lines stack, so in practice that row is
  // the whole statement; the check keeps any in-between layout sensible.
  const measure = () => {
    const origin = svg.getBoundingClientRect();
    const size = parseFloat(getComputedStyle(formula).fontSize);
    const u = size / 26;
    const pieces = [...formula.querySelectorAll(".thesis_phrase, .thesis_plus")].map((el) => ({
      el,
      rect: el.getBoundingClientRect(),
    }));
    const top = pieces[0].rect.top;
    const row = pieces.filter((p) => Math.abs(p.rect.top - top) < size * 0.3);
    const startOf = (term) => {
      const piece = row.find((p) => p.el.closest(term));
      return piece ? piece.rect.left - origin.left + 2 * u : null;
    };
    const lastLetter = (term) => {
      const piece = row.find((p) => p.el.closest(term));
      const x = piece && letterX(piece.el);
      return x == null ? null : x - origin.left;
    };
    const right = row[row.length - 1].rect.right - origin.left;
    const spots = [right - 2 * u];
    for (let i = 1; i < CAST.length; i += 1) {
      spots.push(spots[i - 1] - ((CAST[i - 1].width + CAST[i].width) / 2) * size);
    }
    // just clear of the tallest letters, which top out about 0.22em down
    const ground = top - origin.top + 0.13 * size;
    return {
      u,
      size,
      ground,
      // how far the line sits below the top of the page
      sky: origin.top + window.scrollY + ground,
      edge: right + u,
      start: row[0].rect.left - origin.left + 3 * u,
      scanAt: lastLetter(".thesis_term-how") ?? startOf(".thesis_term-what"),
      shoesAt: startOf(".thesis_term-what"),
      tumbleAt: startOf(".thesis_term-why"),
      spots,
    };
  };

  let startedAt = 0;
  let frame = 0;

  const render = (now) => {
    const m = measure();
    const routes = CAST.map((member, i) => plan(m, member, m.spots[i], i === CAST.length - 1));
    const starts = schedule(routes);
    const elapsed = (now - startedAt) / 1000;

    // once the applause for the last landing dies down, everyone turns for
    // the end of the line, the front of the line-up first
    const landed = routes.map((r, i) => starts[i] + r.marks.done);
    const turnAt = Math.max(...landed) + 1.3;
    let done = 0;
    routes.forEach((r, i) => {
      const run = Math.max(0.2, (m.edge - m.spots[i]) / (3 * m.size));
      const cue = { spot: m.spots[i], last: i === CAST.length - 1, claps: landed.slice(i + 1), turnAt: turnAt + i * 0.08, exitAt: turnAt + 0.5 + i * 0.35, run };
      const begins = starts[i] + r.marks.watching;
      const ends = cue.exitAt + run + DROP;
      r.segs[r.segs.length - 1].dur = Math.max(0.01, ends - begins);
      r.after = (s) => afterparty(m, CAST[i], begins + s, cue);
      done = Math.max(done, ends);
    });

    routes.forEach((r, i) => {
      const member = CAST[i];
      const t = elapsed - starts[i];
      const env = { body: r.body, ground: m.ground, time: now / 1000 };
      env.draw = (fig, j, pose, u) => {
        // the head's recent path while airborne, fading with age
        const heads = Array.from({ length: TRAIL + 1 }, (_, k) => {
          const past = poseAt(r.segs, t - k * TRAIL_STEP);
          return past.trail > 0.5 ? joints(past, u, r.body).head : null;
        });
        for (let k = 0; k < TRAIL; k += 1) {
          if (heads[k] && heads[k + 1]) {
            fig.back.line(`trail${k}`, heads[k], heads[k + 1], 1.4 * u, "stick_trail", 0.7 * (1 - k / TRAIL));
          }
        }
        drawScan(fig, j, pose, u, env);
        burst(fig, "power", lerpPt(j.hip, j.neck, 0.4), u, pose.power, 8);
        if (member.draw) member.draw(fig, j, pose, u, env);
      };
      const pose = poseAt(r.segs, t);
      drawFigure(figs[i], pose, r.u, env);
      figs[i].g.classList.toggle("stick_figure-charged", pose.charged > 0.5);
      figs[i].g.style.opacity = clamp01(t / ENTER) * pose.alpha;
    });

    return elapsed < done;
  };

  // The parade loops: a short pause after the last figure drops off, then
  // the next sets out. A parade that ends out of view waits for the line to
  // come back into view before starting again.
  const LOOP_PAUSE = 3000;
  let visible = false;
  let waiting = 0;

  const stop = () => {
    clearTimeout(waiting);
    waiting = 0;
    cancelAnimationFrame(frame);
    frame = 0;
    figs.forEach((fig) => {
      fig.g.style.opacity = 0;
    });
  };

  const start = () => {
    stop();
    if (phone.matches) return;
    startedAt = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const tick = (now) => {
    if (render(now)) {
      frame = requestAnimationFrame(tick);
      return;
    }
    frame = 0;
    waiting = setTimeout(() => {
      waiting = 0;
      if (visible) start();
    }, LOOP_PAUSE);
  };

  figs.forEach((fig) => {
    fig.g.style.opacity = 0;
    fig.hit.addEventListener("click", start);
  });
  new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible && !frame && !waiting) start();
    },
    { threshold: 0.6 }
  ).observe(formula);
  // no parade at phone widths; widen the window and it sets out again
  phone.addEventListener("change", () => {
    if (phone.matches) stop();
    else if (visible) start();
  });
};

/* ---------- small figures around the page ---------- */

// Runs step(now) every frame until it returns false. Calling the returned
// function again while it is running does nothing.
const animator = (step) => {
  let frame = 0;
  const tick = (now) => {
    frame = step(now) ? requestAnimationFrame(tick) : 0;
  };
  return () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };
};

// A figure that only decorates: no click target of its own.
const quietFigure = (svg) => {
  const fig = createFigure(svg);
  fig.hit.remove();
  return fig;
};

// One layer over the whole document, in page coordinates, and one fixed to
// the screen, each shared by the figures that need it.
let pageLayer = null;
const page = () => {
  if (!pageLayer) pageLayer = createLayer(document.body, "stick_layer-page");
  return pageLayer;
};
let screenLayer = null;
const fixedLayer = () => {
  if (!screenLayer) screenLayer = createLayer(document.body, "stick_layer-screen");
  return screenLayer;
};
const onPage = (el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left + window.scrollX, right: r.right + window.scrollX, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
};
const fontSize = (el) => parseFloat(getComputedStyle(el).fontSize);

/* Award badges get a podium: hover one, and a little gold block rises beside
   it, a figure in powered-up shoes hops on, and celebrates in a shower of
   gold; leave, and figure and block fade away. Beside the badge rather than
   on it, so nothing covers the line above. One figure serves every badge. */
const setupPodium = () => {
  const root = document.getElementById("publications-root");
  if (!root || reduceMotion.matches) return;
  const fig = quietFigure(page());
  fig.g.classList.add("stick_figure-charged");
  const UP = 0.5;
  const FADE = 0.35;
  const CHEER = [[230, 215], [130, 145]];
  let badge = null;
  let inAt = 0;
  let outAt = null;

  const step = (now) => {
    if (!badge) return false;
    const t = now / 1000;
    const r = onPage(badge);
    const s = (fontSize(badge) * 1.9) / 30;
    const ground = r.bottom;
    const blockW = 12 * s;
    const blockH = 5 * s;
    const centre = r.right + 6 + blockW / 2;
    const top = ground - blockH;
    const from = centre + 14 * s;

    // the pose as it would be at time e after the hover began
    const at = (e) => {
      if (e < UP) {
        // one hop up onto the block from beside it
        const v = e / UP;
        const feet = lerp(ground, top, v) - 8 * s * 4 * v * (1 - v);
        const tuck = ease(clamp01(v / 0.2)) * ease(clamp01((1 - v) / 0.2));
        const pose = { ...POSE, shoes: [1, 1], ...mix({ ...POSE, ...CROUCH }, { ...POSE, ...CROUCH, ...TUCK }, tuck), sx: -1 };
        return { ...pose, hx: lerp(from, centre, v), hy: feet - legDrop(pose.legs) * s };
      }
      // arms flung up in a wide V, waving a little
      const wave = Math.sin((e - UP) * 7);
      return {
        ...POSE,
        ...OPEN,
        shoes: [1, 1],
        lean: -6,
        nod: -8,
        arms: [[CHEER[0][0] + 8 * wave, CHEER[0][1]], [CHEER[1][0] - 8 * wave, CHEER[1][1]]],
        hx: centre,
        hy: top - legDrop(OPEN.legs) * s,
      };
    };

    // leaving freezes the pose and fades it, block and all
    const e = (outAt === null ? t : outAt) - inAt;
    const fade = outAt === null ? 0 : clamp01((t - outAt) / FADE);
    if (fade >= 1) {
      badge = null;
      fig.g.style.opacity = 0;
      return false;
    }
    const rise = ease(clamp01(e / 0.25));
    const sparkle = outAt === null && e >= UP ? 1 - clamp01((e - UP) / 0.7) : 0;
    drawFigure(fig, at(e), s, {
      draw: (f, j) => {
        const h = blockH * rise;
        f.back.shape("block", [
          { x: centre - blockW / 2, y: ground - h }, { x: centre + blockW / 2, y: ground - h },
          { x: centre + blockW / 2, y: ground }, { x: centre - blockW / 2, y: ground },
        ], "stick_podium");
        burst(f, "gold", j.head, s, sparkle, 8, 360, 0, "stick_award");
      },
    });
    fig.g.style.opacity = clamp01(e / 0.15) * (1 - ease(fade));
    return true;
  };

  const kick = animator(step);
  root.addEventListener("pointerover", (event) => {
    if (phone.matches) return;
    const b = event.target.closest(".publication_award_badge");
    if (!b || (b === badge && outAt === null)) return;
    badge = b;
    inAt = performance.now() / 1000;
    outAt = null;
    kick();
  });
  root.addEventListener("pointerout", (event) => {
    const b = event.target.closest(".publication_award_badge");
    if (!b || b !== badge || b.contains(event.relatedTarget) || outAt !== null) return;
    outAt = performance.now() / 1000;
    kick();
  });
};

// The pool at the foot of the stairs: a rippling surface with two shark
// fins going round in it, one always across from the other, each bigger and
// bolder on the near side of the circle and smaller and fainter round the
// back. The fins are clipped to the surface, so nothing shows below it.
const makePool = (parent, defs) => {
  const clip = make(defs, "clipPath");
  clip.id = "stick-pool-surface";
  const above = make(clip, "polygon");
  const g = make(parent, "g");
  g.setAttribute("clip-path", "url(#stick-pool-surface)");
  const fins = [make(g, "path", "stick_shark"), make(g, "path", "stick_shark")];
  const water = make(parent, "polyline", "stick_water");
  water.setAttribute("stroke-width", 1.2);

  return (pool, t) => {
    const cx = (pool.x0 + pool.x1) / 2;
    const w = pool.x1 - pool.x0;
    const surface = [];
    for (let i = 0; i <= 24; i += 1) {
      const x = pool.x0 + (w * i) / 24;
      surface.push({ x, y: pool.y + 1.2 * Math.sin(x * 0.35 - t * 2.2) });
    }
    const pts = (list) => list.map((p) => `${p.x},${p.y}`).join(" ");
    water.setAttribute("points", pts(surface));
    above.setAttribute("points", pts([...surface, { x: pool.x1, y: pool.y - 60 }, { x: pool.x0, y: pool.y - 60 }]));

    fins.forEach((fin, i) => {
      const a = t * 0.8 + i * Math.PI;
      const near = (Math.sin(a) + 1) / 2;
      const x = cx + 0.32 * w * Math.cos(a);
      // which way it is heading across the screen: left along the near
      // side, right round the back, and at the ends of the circle, turning,
      // seen nose or tail on, a narrow sliver
      const across = -Math.sin(a);
      const side = Math.sign(across) * Math.max(0.15, Math.abs(across));
      const k = 0.8 + 0.3 * near;
      // a dorsal fin: the leading edge bowed out and swept back to the
      // tip, the trailing edge curving in under it. Its base sits below the
      // surface, for the clip to cut off.
      const P = (dx, dy) => `${x + side * dx * k},${pool.y + 3 + dy * k}`;
      fin.setAttribute(
        "d",
        `M${P(5, 0)} Q${P(3, -9)} ${P(-3, -10)} Q${P(-1.5, -5)} ${P(-4.5, 0)} Z`
      );
      fin.style.opacity = 0.25 + 0.75 * near;
    });
  };
};

/* The years as a staircase: a zig-zag flight of small steps runs down the
   left margin of the publications, the step level with each year's heading
   marked as its landing. A figure walks down it as the page scrolls (and
   back up when it scrolls back), stopping on whichever year is nearest. Only
   the stretch around the figure is lit, as if by a torch, fading out above
   and below. The flight stops dead after the last entry, over a pool where
   sharks circle; reach the edge and the figure teeters.
   It needs the margin: where there is no room beside the text, there are
   no stairs. */
const setupStairs = () => {
  const root = document.getElementById("publications-root");
  if (!root || reduceMotion.matches) return;
  const fig = quietFigure(page());
  // the steps, in figure units, so they fit the walker's stride
  const RISE = 18.5;
  const TREAD = 14;
  const PACE = 22;
  const CATCH_UP = 6;
  const LIGHT = 170;

  // the torch: a radial fade, used as a mask over the stairs alone
  const defs = make(page(), "defs");
  const glow = make(defs, "radialGradient");
  glow.id = "stick-stairs-glow";
  glow.setAttribute("gradientUnits", "userSpaceOnUse");
  [[0, 1], [0.5, 0.75], [1, 0]].forEach(([offset, alpha]) => {
    const stop = make(glow, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", "#fff");
    stop.setAttribute("stop-opacity", alpha);
  });
  const mask = make(defs, "mask");
  mask.id = "stick-stairs-light";
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  const lit = make(mask, "rect");
  lit.setAttribute("fill", "url(#stick-stairs-glow)");
  // the figure's back layer is where the stairs are drawn, and the pool
  fig.g.firstChild.setAttribute("mask", "url(#stick-stairs-light)");
  const drawPool = makePool(fig.g.firstChild, defs);
  let p = null;
  let phase = 0;
  let moving = 0;
  let last = 0;

  const build = () => {
    if (phone.matches) return null;
    const headers = [...root.querySelectorAll(".section_header")];
    if (!headers.length) return null;
    const box = onPage(root);
    const u = figureUnit();
    const rise = RISE * u;
    const tread = TREAD * u;
    // set back from the text so it doesn't crowd the year headings
    const right = box.left - 26;
    const steps = Math.floor(Math.min(66, right - 6) / tread);
    if (steps < 3) return null;
    const years = headers.map((h) => {
      const r = onPage(h);
      return (r.top + r.bottom) / 2;
    });
    // each flight runs out to the far side and turns back, a riser lower
    const treads = [];
    let x = right;
    let dir = -1;
    for (let y = years[0]; y <= box.bottom; ) {
      for (let k = 0; k < steps && y <= box.bottom; k += 1) {
        treads.push({ x0: x, x1: x + dir * tread, y, dir });
        x += dir * tread;
        y += rise;
      }
      dir = -dir;
    }
    const landings = years.map((y) => Math.min(treads.length - 1, Math.round((y - years[0]) / rise)));
    // the pool under the drop, as wide as the flights
    const xs = treads.flatMap((tr) => [tr.x0, tr.x1]);
    const pool = { x0: Math.min(...xs) - 10, x1: Math.max(...xs) + 10, y: treads[treads.length - 1].y + 32 };
    return { treads, landings, pool, u, rise };
  };

  // where the feet are at a point p along the treads: walking along one,
  // then a little hop down to the next
  const feetAt = (st, q) => {
    const n = st.treads.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor(q)));
    const f = Math.min(1, q - i);
    const a = st.treads[i];
    const b = st.treads[Math.min(n - 1, i + 1)];
    const inset = 4 * st.u;
    if (f < 0.65 || i === n - 1) {
      return { x: lerp(a.x0 + a.dir * inset, a.x1 - a.dir * inset, Math.min(1, f / 0.65)), y: a.y, dir: a.dir, air: 0 };
    }
    const v = (f - 0.65) / 0.35;
    return {
      x: lerp(a.x1 - a.dir * inset, b.x0 + b.dir * inset, v),
      y: lerp(a.y, b.y, v) - 7.5 * st.u * 4 * v * (1 - v),
      dir: v < 0.5 ? a.dir : b.dir,
      air: Math.sin(Math.PI * v),
    };
  };

  const step = (now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    const st = build();
    if (!st) {
      fig.g.style.opacity = 0;
      return false;
    }
    fig.g.style.opacity = 1;
    const n = st.treads.length;
    const top = st.treads[0].y;

    // follow the middle of the screen down the stairs, settling on a year's
    // landing when the middle is right beside it. Nearing the end of the
    // page the point it follows slides to the bottom of the screen, so
    // scrolled all the way down it walks right out to the edge.
    const remaining = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    const follow = 0.55 + 0.45 * clamp01(1 - remaining / (0.6 * window.innerHeight));
    let goal = Math.min(n - 0.42, Math.max(0, (window.scrollY + window.innerHeight * follow - top) / st.rise));
    const near = st.landings.reduce((best, l) => (Math.abs(l - goal) < Math.abs(best - goal) ? l : best), st.landings[0]);
    if (Math.abs(near - goal) * st.rise < 30) goal = near;
    if (p === null) p = goal;
    // a walk when close; when the page has moved far, a run quick enough to
    // catch up in about half a second, so it never trails off the screen
    const gap = goal - p;
    const speed = Math.max(PACE, Math.abs(gap) * CATCH_UP);
    const dp = Math.sign(gap) * Math.min(Math.abs(gap), speed * dt);
    p += dp;
    moving += ((Math.abs(dp) > 0.0001 ? 1 : 0) - moving) * Math.min(1, dt * 10);

    const s = st.u;
    const feet = feetAt(st, p);
    phase += Math.abs(dp) * 1.6;
    const walk = gait(WALK)(phase, moving * (1 - feet.air));
    // stood still, it turns a little towards us
    const stride = mix({ ...POSE, ...OPEN }, { ...POSE, ...walk }, moving);
    let pose = {
      ...POSE,
      ...STAND,
      ...mix(stride, { ...POSE, ...CROUCH }, feet.air * 0.6),
      // facing the way it is going: down the flight, or back up it
      sx: (dp < 0 ? -1 : 1) * feet.dir,
      hx: feet.x,
    };
    // at the edge, every few seconds, a wobble: leaning out over the
    // pool, arms windmilling, and back
    const t = now / 1000;
    const edge = clamp01((p - (n - 0.5)) / 0.08) * (1 - moving);
    const wobble = edge * bump((t % 4) / 1.4, 0.5, 0.5);
    if (wobble > 0) {
      const spin = t * 11;
      pose = mix(pose, {
        ...pose,
        lean: 14 + 10 * Math.sin(t * 7),
        nod: 20,
        arms: [[180 + 70 * Math.sin(spin), 190 + 70 * Math.sin(spin)], [180 + 70 * Math.sin(spin + Math.PI), 190 + 70 * Math.sin(spin + Math.PI)]],
      }, ease(wobble));
    }
    pose.hy = feet.y - legDrop(pose.legs) * s;

    // light the stretch of stairs around the figure. The mask's own region
    // has to move with it too: left to its default, it covers only the
    // first screenful of the page and hides every step below that.
    const left = st.pool.x0 - 4;
    const area = { x: left, y: feet.y - LIGHT, width: st.pool.x1 + 4 - left, height: 2 * LIGHT };
    Object.entries(area).forEach(([key, value]) => {
      mask.setAttribute(key, value);
      lit.setAttribute(key, value);
    });
    glow.setAttribute("cx", feet.x);
    glow.setAttribute("cy", feet.y);
    glow.setAttribute("r", LIGHT);

    drawFigure(fig, pose, s, {
      draw: (f) => {
        // each tread and the riser under it, except the last, which just
        // ends: a short lip, then the drop
        const outline = [];
        st.treads.forEach((tr, i) => {
          const end = i === n - 1 ? 3 : st.rise;
          outline.push({ x: tr.x0, y: tr.y }, { x: tr.x1, y: tr.y }, { x: tr.x1, y: tr.y + end });
        });
        f.back.poly("stairs", outline, 1, "stick_stairs");
        drawPool(st.pool, t);
        st.landings.forEach((l, i) => {
          const tr = st.treads[l];
          f.back.line(`landing${i}`, { x: tr.x0, y: tr.y }, { x: tr.x1, y: tr.y }, 1.6, "stick_landing");
        });
      },
    });
    // the pool keeps circling while it is on screen
    const poolShown = st.pool.y > window.scrollY - 40 && st.pool.y < window.scrollY + window.innerHeight + 40;
    return Math.abs(goal - p) > 0.001 || moving > 0.01 || poolShown;
  };

  const kick = animator(step);
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  phone.addEventListener("change", kick);
  new ResizeObserver(kick).observe(root);
  kick();
};

/* "I build human-centered devices": a Kilroy peeking over the word "human"
   as if it were a wall -- the top of a head with two eyes. Every few
   seconds a hand comes up from behind the word and waves, and straight away
   whenever the word is pointed at. Everything
   below the letters' top edge is clipped away, so it sits behind the word;
   it fits in the space the line above already leaves and moves no text. */
const setupWaver = () => {
  const word = document.querySelector(".waver_spot");
  if (!word) return;
  const svg = page();
  const EVERY = 5;
  const WAVE = 1.6;
  let hoverAt = -Infinity;
  let visible = false;

  // the wall: nothing below the top of the letters is drawn
  const defs = make(svg, "defs");
  const clip = make(defs, "clipPath");
  clip.id = "stick-kilroy-wall";
  const above = make(clip, "rect");

  const g = make(svg, "g", "stick_figure stick_kilroy");
  g.setAttribute("clip-path", "url(#stick-kilroy-wall)");
  const head = make(g, "circle");
  const eyes = [make(g, "circle", "stick_eye"), make(g, "circle", "stick_eye")];
  const arm = make(g, "line");
  const fingers = [make(g, "line"), make(g, "line"), make(g, "line")];

  const step = (now) => {
    const t = now / 1000;
    const r = onPage(word);
    const size = fontSize(word);
    const R = 0.4 * size;
    // the top of the short letters ("uman"), so the hands rest on them and
    // the "h" stands up beside them like part of the wall
    const wall = r.top + 0.42 * size;
    const cx = (r.left + r.right) / 2;

    above.setAttribute("x", r.left - 4 * R);
    above.setAttribute("y", wall - 6 * R);
    above.setAttribute("width", r.right - r.left + 8 * R);
    above.setAttribute("height", 6 * R);

    // how far the waving hand is up: lifted, waved, back on the wall
    const since = t - hoverAt < WAVE ? t - hoverAt : t % EVERY;
    const raise = reduceMotion.matches
      ? 0
      : ease(clamp01(since / 0.25)) * ease(clamp01((WAVE - since) / 0.25));
    const flap = rad(22 * Math.sin(t * 12) * raise);

    // the top of the head over the wall, eyes glancing towards the wave
    const hy = wall - 0.5 * R;
    head.setAttribute("cx", cx);
    head.setAttribute("cy", hy);
    head.setAttribute("r", R);
    eyes.forEach((eye, i) => {
      eye.setAttribute("cx", cx + (i ? 0.38 : -0.38) * R + 0.12 * R * raise);
      eye.setAttribute("cy", hy - 0.12 * R);
      eye.setAttribute("r", 0.13 * R);
    });

    // a hand comes up from behind the word, off to the right, to wave
    const handX = cx + 2.1 * R;
    const reach = 1.7 * R;
    const lifted = {
      x: handX + 0.4 * R + Math.sin(flap) * reach,
      y: wall + 0.6 * R - Math.cos(flap) * reach,
    };
    const hand = lerpPt({ x: handX, y: wall + 0.6 * R }, lifted, raise);
    arm.setAttribute("x1", handX);
    arm.setAttribute("y1", wall + 1.2 * R);
    arm.setAttribute("x2", hand.x);
    arm.setAttribute("y2", hand.y);
    // an open hand: three fingers fanned out from the end of the arm
    fingers.forEach((finger, i) => {
      const a = flap + rad((i - 1) * 32);
      finger.setAttribute("x1", hand.x);
      finger.setAttribute("y1", hand.y);
      finger.setAttribute("x2", hand.x + Math.sin(a) * 0.6 * R);
      finger.setAttribute("y2", hand.y - Math.cos(a) * 0.6 * R);
    });
    [arm, ...fingers].forEach((el) => {
      el.style.opacity = clamp01(raise * 3);
    });

    g.setAttribute("stroke-width", Math.max(1.2, 0.2 * R));
    return !reduceMotion.matches && (visible || t - hoverAt < WAVE);
  };

  const kick = animator(step);
  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) kick();
  }).observe(word);
  word.addEventListener("pointerenter", () => {
    hoverAt = performance.now() / 1000;
    kick();
  });
  new ResizeObserver(kick).observe(word.parentElement);
  kick();
};

/* Back to top: a round chevron button turns up in the bottom right once the
   page has been scrolled, with the kid from the parade standing on it. Press it
   and the kid snaps its domes and launches off the top of the screen with
   the page scrolling up after it; then it drops back in, spinning, onto the
   name. */
const setupTopButton = () => {
  if (document.querySelector(".to_top")) return;
  const button = document.createElement("button");
  button.type = "button";
  // an icon link, so js/icon-fallback.js shows the word if the icon font
  // never draws
  button.className = "to_top icon_link";
  button.setAttribute("aria-label", "Back to top");
  button.innerHTML = '<i class="fa-solid fa-chevron-up" aria-hidden="true"></i><span class="icon_link_label">Top</span>';
  document.body.appendChild(button);

  const fig = quietFigure(fixedLayer());
  // the same build as the other figures around the page; the popper shoes
  // still mark it as the parade's kid
  const body = BODY;
  const domes = { domes: [1, 1], snap: 0 };
  // waiting on the button turned a little the other way from the rest,
  // towards the page
  const IDLE = { ...OPEN, sx: -1 };
  const SQUAT = 0.25;
  const RISE = 0.6;
  const SCROLL = 1.0;
  const FALL = 0.6;
  let hover = false;
  let tripAt = null;
  let launch = null;
  let scrollFrom = 0;
  let scrolling = false;
  let alpha = 0;
  let last = 0;

  const shown = () => window.scrollY > window.innerHeight * 0.6;
  const drawKid = (pose, s, flash = 0) =>
    drawFigure(fig, { ...POSE, ...STAND, ...domes, ...pose }, s, {
      body,
      draw: (f, j, ps, u, env) => {
        kid.draw(f, j, ps, u, env);
        burst(f, "flash", lerpPt(j.legs[0].foot, j.legs[1].foot, 0.5), u, flash);
      },
    });

  const step = (now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    const t = now / 1000;
    button.classList.toggle("is-shown", shown());
    const r = button.getBoundingClientRect();
    const s = figureUnit();
    // standing on top of the button
    const home = { x: r.left + r.width / 2, y: r.top };
    const standOn = (pose, x, y, lift = 0) => ({ ...pose, hx: x, hy: y - (legDrop(pose.legs || STAND.legs, body) + lift) * s });

    if (tripAt === null) {
      alpha += ((shown() ? 1 : 0) - alpha) * Math.min(1, dt * 8);
      fig.g.style.opacity = alpha;
      const still = reduceMotion.matches;
      // waiting: a hop now and then, a crouch when you point at the button
      const hop = still ? 0 : Math.max(0, Math.sin((t * Math.PI * 2) / 4.5)) ** 12;
      const pose = hover && !still ? { ...OPEN_SQUAT, sx: -1, snap: 0.5 } : { ...IDLE };
      drawKid(standOn(pose, home.x, home.y, 3 * hop), s);
      return shown() || alpha > 0.01;
    }

    const e = t - tripAt;
    if (e < SQUAT) {
      drawKid(standOn({ ...OPEN_SQUAT, sx: -1, snap: ease(e / SQUAT) }, home.x, home.y), s);
      return true;
    }
    if (!launch) {
      launch = { ...home };
      scrollFrom = window.scrollY;
      scrolling = true;
    }
    const up = e - SQUAT;
    if (scrolling) {
      const v = clamp01(up / SCROLL);
      window.scrollTo({ top: scrollFrom * (1 - ease(v)), behavior: "instant" });
      if (v >= 1) scrolling = false;
    }

    const name = document.querySelector(".name_main");
    const nr = name.getBoundingClientRect();
    const land = { x: letterX(name, "l") ?? nr.left + nr.width * 0.8, y: nr.top + 0.22 * fontSize(name) };
    const standH = legDrop(STAND.legs, body) * s;
    let pose = null;
    let flash = 0;
    let fade = 1;
    if (up < RISE) {
      // straight up and away, faster and faster
      const v = up / RISE;
      pose = { ...ARROW, snap: 0, hx: launch.x, hy: lerp(launch.y, -60, v * v) - standH };
      flash = 1 - clamp01(v / 0.4);
    } else if (up < SCROLL + 0.1) {
      fade = 0;
    } else if (up < SCROLL + 0.1 + FALL) {
      // back down out of the sky, spinning, onto the name
      const v = (up - SCROLL - 0.1) / FALL;
      pose = {
        ...mix({ ...POSE, ...ARROW }, { ...POSE, ...TUCK }, Math.sin(Math.PI * v)),
        rot: 720 * ease(v),
        hx: land.x,
        hy: lerp(-80, land.y, v * v) - standH,
      };
    } else {
      const v = up - SCROLL - 0.1 - FALL;
      if (v < 0.2) pose = standOn({ ...OPEN_CROUCH, snap: 1 - v / 0.2 }, land.x, land.y);
      else if (v < 0.9) pose = standOn({ ...SALUTE, legs: OPEN.legs }, land.x, land.y);
      else if (v < 1.3) {
        const w = (v - 0.9) / 0.4;
        pose = standOn({ ...ARROW }, land.x, land.y, 10 * Math.sin(Math.PI * w));
        fade = 1 - w;
      } else {
        // home again, on the button, for next time
        tripAt = null;
        launch = null;
        alpha = 0;
        fig.g.style.opacity = 0;
        const main = document.getElementById("main-content");
        if (main && document.activeElement === button) {
          main.setAttribute("tabindex", "-1");
          main.focus({ preventScroll: true });
        }
        return true;
      }
    }
    if (pose) drawKid(pose, s, flash);
    fig.g.style.opacity = pose ? fade : 0;
    return true;
  };

  const kick = animator(step);
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  // a scroll of your own takes over from the kid's
  ["wheel", "touchstart"].forEach((type) =>
    window.addEventListener(type, () => {
      scrolling = false;
    }, { passive: true })
  );
  button.addEventListener("pointerenter", () => {
    hover = true;
    kick();
  });
  button.addEventListener("pointerleave", () => {
    hover = false;
  });
  button.addEventListener("click", () => {
    if (reduceMotion.matches) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    if (tripAt !== null) return;
    tripAt = performance.now() / 1000;
    hover = false;
    kick();
  });
  kick();
};

/* ---------- the sunbather on the footer ---------- */

// Is the sun up in Cambridge, Massachusetts? A rough sunrise equation, good
// to a few minutes, worked in UTC so the footer keeps my hours whatever the
// visitor's clock says.
const HOME = { lat: 42.37, lon: -71.11 };
// ?sky=day or ?sky=night in the address fixes it either way, for showing off
const FORCED_SKY = new URLSearchParams(window.location.search).get("sky");
const sunUp = (date = new Date()) => {
  if (FORCED_SKY === "day" || FORCED_SKY === "night") return FORCED_SKY === "day";
  const day = (date - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5;
  const lat = rad(HOME.lat);
  const tilt = rad(-23.44 * Math.cos((2 * Math.PI * (day + 10)) / 365));
  // half the day's length in hours, counting the sun as up while any of it
  // shows over the horizon
  const cosHalf = (Math.sin(rad(-0.83)) - Math.sin(lat) * Math.sin(tilt)) / (Math.cos(lat) * Math.cos(tilt));
  const half = (Math.acos(Math.min(1, Math.max(-1, cosHalf))) * 12) / Math.PI;
  // solar noon in UTC, nudged by the equation of time
  const b = (2 * Math.PI * (day - 81)) / 364;
  const noon = 12 - HOME.lon / 15 - (9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)) / 60;
  const fromNoon = (((((day % 1) * 24 - noon) % 24) + 36) % 24) - 12;
  return Math.abs(fromNoon) < half;
};

const drawZs = (fig, j, pose, u, env) => {
  if (!(pose.z > 0.02)) return;
  [0, 1, 2].forEach((i) => {
    const p = (env.time / 2.6 + i / 3) % 1;
    fig.front.text(
      `z${i}`,
      { x: j.head.x + (2 + p * 7) * u, y: j.head.y - (3 + p * 9) * u },
      (5 + p * 4) * u,
      "z",
      "stick_z",
      pose.z * Math.sin(Math.PI * p)
    );
  });
};

// The sky over the slash: a turning sun by day, by night a crescent moon and
// a couple of twinkling stars. `day` runs 0 to 1 as one gives way to the other.
const drawSky = (fig, centre, r, t, day) => {
  const night = 1 - day;
  if (day > 0.02) {
    const sun = 0.6 * r;
    fig.back.ring("sun", centre, sun, 0.3 * sun, "stick_sun", day);
    for (let i = 0; i < 8; i += 1) {
      const a = rad(i * 45 + t * 12);
      const dir = { x: Math.sin(a), y: Math.cos(a) };
      fig.back.line(
        `ray${i}`,
        { x: centre.x + dir.x * 1.6 * sun, y: centre.y + dir.y * 1.6 * sun },
        { x: centre.x + dir.x * 2.2 * sun, y: centre.y + dir.y * 2.2 * sun },
        0.3 * sun,
        "stick_sun",
        day
      );
    }
  }
  if (night > 0.02) {
    // A crescent: the moon's disc less a slightly smaller shadow disc set
    // off up and to the left. Its outline runs round the lit edge of the
    // disc, then back along the shadow's edge inside it.
    const R = 1.3 * r;
    const shadow = { x: centre.x - 0.5 * R, y: centre.y - 0.2 * R, r: 0.9 * R };
    const from = Math.atan2(shadow.y - centre.y, shadow.x - centre.x);
    const inShadow = (p) => Math.hypot(p.x - shadow.x, p.y - shadow.y) < shadow.r;
    const inDisc = (p) => Math.hypot(p.x - centre.x, p.y - centre.y) < R;
    const ring = (c, radius) =>
      Array.from({ length: 97 }, (_, i) => {
        const a = from + (i / 96) * 2 * Math.PI;
        return { x: c.x + radius * Math.cos(a), y: c.y + radius * Math.sin(a) };
      });
    const lit = ring(centre, R).filter((p) => !inShadow(p));
    const edge = ring(shadow, shadow.r).filter(inDisc).reverse();
    fig.back.shape("moon", [...lit, ...edge], "stick_moon", night);
    // craters, on the lit part
    [[0.55, -0.35, 0.16], [0.72, 0.18, 0.12], [0.38, 0.58, 0.11]].forEach(([dx, dy, size], i) => {
      fig.back.dot(`crater${i}`, { x: centre.x + dx * R, y: centre.y + dy * R }, size * R, "stick_crater", night);
    });
    [[-2.2, 0.3, 0], [-1.3, -1.3, 1.7]].forEach(([dx, dy, lag], i) => {
      const twinkle = 0.55 + 0.45 * Math.sin(t * 1.8 + lag);
      fig.back.dot(`star${i}`, { x: centre.x + dx * R, y: centre.y + dy * R }, 0.12 * R, "stick_moon", night * twinkle);
    });
  }
};

// The book, held up to read by day. Seen side on, like the rest of him: a
// slim block square to his gaze, cover out and the page edges towards him.
const drawBook = (fig, j, u, day) => {
  if (day > 0.02) {
    const hand = j.arms[0].hand;
    const dx = hand.x - j.head.x;
    const dy = hand.y - j.head.y;
    const len = Math.hypot(dx, dy) || 1;
    const away = { x: dx / len, y: dy / len };
    const side = { x: -away.y, y: away.x };
    const at = (a, s) => ({ x: hand.x + away.x * a * u + side.x * s * u, y: hand.y + away.y * a * u + side.y * s * u });
    const H = 2.6;
    fig.front.shape("cover", [at(-0.2, -H), at(1.1, -H), at(1.1, H), at(-0.2, H)], "stick_cover", day);
    fig.front.line("pages", at(-0.2, -H + 0.5), at(-0.2, H - 0.5), 0.6 * u, "stick_page_edges", day);
  }
};

// The footer's slash, a figure laid back along it: reading in the sun while
// it is up in Cambridge, asleep under the moon once it sets. Click it for a
// wave (and, at night, a start).
const setupSunbather = (footer) => {
  const slash = footer.querySelector(".footer_slash");
  if (!slash || footer.querySelector(".stick_layer")) return;

  const fig = createFigure(createLayer(footer, "stick_layer-sitter"));
  const WAVE = 1.6;
  const BLEND = 0.6;

  // the slash runs corner to corner of its box, top left to bottom right
  // the ends of the slash, as drawn
  const measure = () => {
    const origin = fig.g.ownerSVGElement.getBoundingClientRect();
    const ctm = slash.getScreenCTM();
    const [top, end] = [...slash.querySelector("polyline").points].map((p) => {
      const q = p.matrixTransform(ctm);
      return { x: q.x - origin.left, y: q.y - origin.top };
    });
    const len = Math.hypot(end.x - top.x, end.y - top.y);
    const along = { x: (end.x - top.x) / len, y: (end.y - top.y) / len };
    const u = figureUnit();
    // the hip a little over halfway down, resting just clear of the line:
    // head up the slope, feet down it
    const lift = 1.3 * u;
    const hip = { x: top.x + along.x * 18 * u + along.y * lift, y: top.y + along.y * 18 * u - along.x * lift };
    const size = parseFloat(getComputedStyle(slash).fontSize);
    return { u, hip, slope: (Math.atan2(along.y, along.x) * 180) / Math.PI, sky: { x: end.x + 0.5 * size, y: top.y - 0.4 * size }, size };
  };

  let mode = "rest";
  let modeAt = -Infinity;
  let from = null;
  let wokeUp = false;
  let frame = 0;
  let visible = false;
  let lastPose = null;
  let day = sunUp();
  let dayAt = -Infinity;

  const poseFor = (m, t, since) => {
    // down the slash towards the feet, and up it, the back propped a little
    // off it so the head rests clear, towards the head
    const down = 90 - m.slope;
    const back = 270 - m.slope - 14;
    const off = back - 66;
    const flat = { ...POSE, lean: 180 - back, hx: m.hip.x, hy: m.hip.y, z: 0 };
    const breath = Math.sin(t * 1.4);
    const rest = day
      ? {
          // reading, the book held up over the chest, knees up and one foot
          // tapping now and then
          ...flat,
          nod: 14,
          legs: [[down + 22, down - 18 + 10 * Math.max(0, Math.sin(t * 2.2)) ** 4], [down + 50, down - 46]],
          arms: [[back - 122, back - 76], [back - 128, back - 70]],
        }
      : {
          // dozed off, hands on the belly, breathing slowly
          ...flat,
          lean: flat.lean + 1.2 * breath,
          nod: 4,
          legs: [[down + 14, down - 10], [down + 30, down - 26]],
          arms: [[back - 138, back - 156], [back - 130, back - 154]],
          z: 1,
        };
    if (mode !== "wave") return rest;
    // up on one elbow to wave, straight up off the slash, the book kept in
    // the other hand
    const jolt = wokeUp ? Math.sin(Math.PI * clamp01(since / 0.35)) : 0;
    return {
      ...rest,
      lean: rest.lean + 18 + 10 * jolt,
      nod: 10 + 30 * jolt,
      arms: [rest.arms[0], [off - 15, off - 30 + 28 * Math.sin(2 * Math.PI * 2.6 * since)]],
      z: 0,
    };
  };

  const blendFrom = (t) => {
    from = lastPose;
    modeAt = t;
  };

  const render = (now) => {
    const m = measure();
    const t = now / 1000;
    const up = sunUp();
    if (up !== day) {
      day = up;
      dayAt = t;
      blendFrom(t);
    }
    if (mode === "wave" && t - modeAt > WAVE) {
      mode = "rest";
      blendFrom(t);
    }
    let pose = poseFor(m, t, t - modeAt);
    if (from) pose = mix(from, pose, ease(clamp01((t - modeAt) / BLEND)));
    lastPose = pose;
    const turn = ease(clamp01((t - dayAt) / BLEND));
    drawFigure(fig, pose, m.u, {
      time: t,
      draw: (f, j, ps, u, env) => {
        drawSky(f, m.sky, 0.27 * m.size, reduceMotion.matches ? 0 : t, day ? turn : 1 - turn);
        drawZs(f, j, ps, u, env);
        drawBook(f, j, u, day ? turn : 1 - turn);
      },
    });
  };

  const tick = (now) => {
    render(now);
    frame = visible ? requestAnimationFrame(tick) : 0;
  };

  // the slash moves if the text reflows once web fonts arrive
  document.fonts.addEventListener("loadingdone", () => render(reduceMotion.matches ? 0 : performance.now()));

  if (reduceMotion.matches) {
    new ResizeObserver(() => render(0)).observe(footer);
    render(0);
    // still turns from day to night, just without moving otherwise
    setInterval(() => render(0), 60000);
    return;
  }

  fig.hit.addEventListener("click", () => {
    wokeUp = !day;
    const t = performance.now() / 1000;
    mode = "wave";
    blendFrom(t);
  });

  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && !frame) frame = requestAnimationFrame(tick);
  }).observe(footer);

  render(performance.now());
};

const initStickFigures = () => {
  setupParade();
  setupPodium();
  setupStairs();
  setupTopButton();
  setupWaver();
  const footer = document.querySelector(".footer");
  if (footer) setupSunbather(footer);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStickFigures, { once: true });
} else {
  initStickFigures();
}

document.addEventListener("footer-loaded", (event) => {
  const footer = event.detail.container.querySelector(".footer");
  if (footer) setupSunbather(footer);
});
