// The room's own furniture, built with some care: rounded edges, legs, cloth, wood and metal, small details.
// It is the yardstick for what Pip makes himself (he builds from the same kind of simple shapes).
// Every piece keeps the size and place it always had (web/furniture.js), so walking and placing things work as before.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function makeProps(THREE) {
  const mats = new Map();
  const M = (color, o = {}) => {
    const k = `${color}|${JSON.stringify(o)}`;
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }));
    return mats.get(k);
  };
  const add = (parent, geo, mat, [x, y, z], rot = [0, 0, 0], scale = null) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(...rot);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const rbox = (parent, [w, h, d], r, mat, pos, rot) => add(parent, new RoundedBoxGeometry(w, h, d, 3, Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))), mat, pos, rot);
  const cyl = (parent, [rt, rb, h], mat, pos, rot, seg = 24) => add(parent, new THREE.CylinderGeometry(rt, rb, h, seg), mat, pos, rot);
  const ball = (parent, r, mat, pos, scale, rot) => add(parent, new THREE.SphereGeometry(r, 20, 14), mat, pos, rot, scale);

  const wood = M(0x9a6a43, { roughness: 0.65 });
  const woodDark = M(0x6e4529, { roughness: 0.7 });
  const oak = M(0xc89f72, { roughness: 0.6 });
  const metal = M(0x3d3d44, { roughness: 0.4, metalness: 0.6 });
  const brass = M(0xd4a84a, { roughness: 0.35, metalness: 0.7 });

  return {
    // The bed: head toward the room's back (low z), along the right wall. Footprint x 2.2..4.6, z 1.3..4.7.
    bed(g) {
      for (const [x, z] of [[2.42, 1.52], [4.38, 1.52], [2.42, 4.5], [4.38, 4.5]]) cyl(g, [0.05, 0.04, 0.2], woodDark, [x, 0.1, z]);
      rbox(g, [2.2, 0.2, 3.15], 0.04, wood, [3.4, 0.3, 3.0]); // the frame
      rbox(g, [2.24, 1.0, 0.1], 0.04, wood, [3.4, 0.62, 1.38]); // headboard
      rbox(g, [2.32, 0.07, 0.16], 0.03, woodDark, [3.4, 1.14, 1.38]);
      for (const x of [2.85, 3.4, 3.95]) rbox(g, [0.36, 0.5, 0.03], 0.02, M(0xa8784f), [x, 0.78, 1.44]); // panels in the headboard
      rbox(g, [2.24, 0.42, 0.08], 0.03, wood, [3.4, 0.44, 4.62]); // footboard
      rbox(g, [2.02, 0.26, 3.0], 0.09, M(0xf3efe6, { roughness: 0.95 }), [3.4, 0.53, 3.02]); // mattress
      rbox(g, [2.1, 0.1, 2.2], 0.05, M(0x8fb0d4, { roughness: 0.95 }), [3.4, 0.69, 3.45]); // duvet
      rbox(g, [2.12, 0.13, 0.26], 0.06, M(0xeef2f6, { roughness: 0.95 }), [3.4, 0.7, 2.33]); // its folded top
      rbox(g, [2.16, 0.12, 0.6], 0.05, M(0xd9a441, { roughness: 0.95 }), [3.4, 0.74, 4.2]); // a throw at the foot
      rbox(g, [0.82, 0.17, 0.46], 0.08, M(0xffffff, { roughness: 0.95 }), [2.93, 0.75, 1.76], [0.12, 0.06, 0]); // pillows
      rbox(g, [0.82, 0.17, 0.46], 0.08, M(0xfdf7ee, { roughness: 0.95 }), [3.87, 0.75, 1.76], [0.12, -0.05, 0]);
    },

    // The desk: an oak top on slim legs, a drawer, a mug. The screen and printer are added by main.js. Footprint x -5..-3.6, z 0.1..2.3.
    desk(g) {
      const top = M(0xc89f72, { roughness: 0.6 });
      const leg = M(0xb88d60, { roughness: 0.62 }); // the same warm oak, a shade deeper, so it reads as one piece of wood
      rbox(g, [1.32, 0.07, 2.12], 0.025, top, [-4.3, 0.815, 1.2]);
      for (const [x, z] of [[-4.86, 0.22], [-3.74, 0.22], [-4.86, 2.18], [-3.74, 2.18]]) rbox(g, [0.09, 0.78, 0.09], 0.02, leg, [x, 0.39, z]); // square wooden legs
      rbox(g, [0.05, 0.12, 1.86], 0.015, leg, [-3.76, 0.72, 1.2]); // a wooden frame under the top, all round
      rbox(g, [0.05, 0.12, 1.86], 0.015, leg, [-4.84, 0.72, 1.2]);
      rbox(g, [1.02, 0.12, 0.05], 0.015, leg, [-4.3, 0.72, 0.24]);
      rbox(g, [1.02, 0.12, 0.05], 0.015, leg, [-4.3, 0.72, 2.16]);
      rbox(g, [0.05, 0.06, 1.86], 0.015, leg, [-4.84, 0.14, 1.2]); // a low shelf rail at the back
      rbox(g, [0.5, 0.11, 0.6], 0.02, top, [-3.98, 0.69, 0.55]); // the drawer front, in the frame
      rbox(g, [0.1, 0.02, 0.02], 0.008, brass, [-3.72, 0.69, 0.55]);
      cyl(g, [0.045, 0.04, 0.1], M(0xe9806e, { roughness: 0.5 }), [-3.85, 0.9, 2.0]); // a mug
      add(g, new THREE.TorusGeometry(0.03, 0.009, 8, 16), M(0xe9806e, { roughness: 0.5 }), [-3.85, 0.9, 2.05], [0, Math.PI / 2, 0]);
      rbox(g, [0.08, 0.025, 0.12], 0.012, M(0xdedede), [-3.95, 0.865, 1.8]); // a mouse
    },

    // The screen: the same size and place, a little nicer. A slim rounded frame and back, a tiny power light; the glowing
    // screen itself (with its scrolling text) is drawn by main.js just in front of the frame, at x -4.49.
    monitorBack(g) {
      const shell = M(0x2c2d33, { roughness: 0.45, metalness: 0.2 });
      rbox(g, [0.06, 0.78, 1.08], 0.03, shell, [-4.53, 1.3, 1.2]); // the frame around the screen
      rbox(g, [0.08, 0.5, 0.7], 0.06, shell, [-4.6, 1.3, 1.2]); // the rounded back
      ball(g, 0.008, M(0x7dff9a, { emissive: 0x3cff7a, emissiveIntensity: 1 }), [-4.495, 0.94, 1.66]); // the power light
    },
    monitorStand(g) {
      const wood = M(0xb88d60, { roughness: 0.62 });
      rbox(g, [0.07, 0.36, 0.1], 0.025, wood, [-4.62, 1.0, 1.2], [0, 0, -0.12]); // the neck, leaning back a little
      rbox(g, [0.32, 0.03, 0.42], 0.012, wood, [-4.6, 0.865, 1.2]); // the foot
      rbox(g, [0.36, 0.035, 0.82], 0.014, M(0xe9e6df, { roughness: 0.6 }), [-4.0, 0.868, 1.2]); // the keyboard: light, with rows of keys
      for (let r = 0; r < 4; r++) for (let k = 0; k < 12; k++) {
        const w = r === 3 && k > 3 && k < 8 ? 0 : 0.05;
        if (w) rbox(g, [0.055, 0.012, w], 0.004, M(0xfbfaf6, { roughness: 0.5 }), [-4.13 + r * 0.075, 0.89, 0.88 + k * 0.058]);
      }
      rbox(g, [0.055, 0.012, 0.22], 0.004, M(0xfbfaf6, { roughness: 0.5 }), [-3.905, 0.89, 1.2]); // the space bar
    },

    // The bookshelf: sides, back, shelves and books of all sizes, a few leaning. Its group stands at (2.6, 0, -4.65), 2 wide, 3 high.
    bookshelf(g) {
      for (const x of [-0.96, 0.96]) rbox(g, [0.08, 3.0, 0.6], 0.02, wood, [x, 1.5, 0]);
      rbox(g, [2.08, 0.08, 0.64], 0.02, woodDark, [0, 3.02, 0]);
      rbox(g, [2.0, 0.12, 0.58], 0.02, woodDark, [0, 0.06, 0]);
      add(g, new THREE.BoxGeometry(1.86, 2.9, 0.03), M(0x7b5034), [0, 1.5, -0.28]);
      const colors = [0xc8553d, 0x5b8fbf, 0xe8b84a, 0x6aa36f, 0x9a72b8, 0xe58aa8, 0x3e5c76, 0xd9d2c3];
      [0.12, 0.8, 1.55, 2.3].forEach((y, row) => {
        if (row) rbox(g, [1.86, 0.05, 0.55], 0.01, woodDark, [0, y - 0.03, 0.02]);
        let x = -0.86;
        let i = row * 3;
        while (x < 0.82) {
          const w = 0.07 + ((i * 7) % 5) * 0.022;
          const h = 0.42 + ((i * 11) % 5) * 0.05;
          if (row === 3 && x > 0.2) break; // room for a little plant on the top shelf
          const lean = i % 9 === 4 ? 0.22 : 0;
          rbox(g, [w, h, 0.36], 0.01, M(colors[i % colors.length], { roughness: 0.75 }), [x + w / 2 + (lean ? 0.06 : 0), y + h / 2, 0.06], [0, 0, -lean]);
          x += w + 0.012 + (lean ? 0.1 : 0);
          i++;
        }
      });
      cyl(g, [0.11, 0.08, 0.16], M(0xc9714f, { roughness: 0.9 }), [0.55, 2.38, 0.05]);
      for (const [dx, dz, r] of [[0, 0, 0.12], [0.07, 0.03, 0.09], [-0.06, -0.02, 0.08]]) ball(g, r, M(0x5f9e63), [0.55 + dx, 2.55 + r * 0.6, 0.05 + dz], [1, 0.8, 1]);
    },

    // The chest: planks, iron bands, brass corners and a rounded lid (lid is its own group, so it can open).
    chest(g, lid) {
      rbox(g, [1.0, 0.44, 0.6], 0.03, M(0x8d5a3b, { roughness: 0.7 }), [0, 0.22, 0]);
      for (const y of [0.15, 0.3]) add(g, new THREE.BoxGeometry(1.005, 0.012, 0.605), woodDark, [0, y, 0]);
      for (const x of [-0.34, 0.34]) rbox(g, [0.06, 0.45, 0.62], 0.01, metal, [x, 0.225, 0]);
      for (const [x, z] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) rbox(g, [0.07, 0.07, 0.07], 0.01, brass, [x, 0.04, z]);
      const top = new THREE.CylinderGeometry(0.31, 0.31, 1.02, 24, 1, false, 0, Math.PI);
      add(lid, top, M(0xa06a3f, { roughness: 0.7 }), [0, 0, 0.3], [0, 0, Math.PI / 2], [1, 1, 0.5]).scale.set(0.42, 1, 1); // a low arch
      for (const x of [-0.34, 0.34]) add(lid, new THREE.CylinderGeometry(0.315, 0.315, 0.06, 24, 1, false, 0, Math.PI), metal, [x, 0, 0.3], [0, 0, Math.PI / 2]).scale.set(0.42, 1, 1);
      rbox(lid, [0.13, 0.13, 0.04], 0.015, brass, [0, -0.03, 0.62]); // the lock
    },

    // The plant in the corner: a terracotta pot with a rim, soil, and big leaves on stems. Around (4.1, -4.1).
    plant(g) {
      const pot = M(0xc9654a, { roughness: 0.9 });
      cyl(g, [0.28, 0.21, 0.42], pot, [4.1, 0.21, -4.1]);
      cyl(g, [0.31, 0.31, 0.07], pot, [4.1, 0.42, -4.1]);
      cyl(g, [0.27, 0.27, 0.02], M(0x4a3020, { roughness: 1 }), [4.1, 0.44, -4.1]);
      const leaves = [M(0x5f9e63, { roughness: 0.7, side: THREE.DoubleSide }), M(0x4f8a55, { roughness: 0.7, side: THREE.DoubleSide }), M(0x74b06f, { roughness: 0.7, side: THREE.DoubleSide })];
      const stem = M(0x4f7d45);
      for (let i = 0; i < 14; i++) { // big leaves on stems, fanning out and drooping a little, at three heights
        const a = i * 2.39996;
        const tier = i % 3;
        const h = 0.7 + tier * 0.22 + (i % 2) * 0.06;
        const out = 0.18 + tier * 0.05 + (i % 4) * 0.03;
        const x = 4.1 + Math.cos(a) * out;
        const z = -4.1 + Math.sin(a) * out;
        add(g, new THREE.CylinderGeometry(0.012, 0.016, h - 0.42, 6), stem, [(4.1 + x) / 2, (0.44 + h) / 2, (-4.1 + z) / 2], [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]);
        const l = ball(g, 0.27 - tier * 0.03, leaves[i % 3], [x + Math.cos(a) * 0.14, h, z + Math.sin(a) * 0.14], [1, 0.09, 0.58]);
        l.rotation.set(0, -a, 0);
        l.rotateZ(-0.35 - tier * 0.12); // the tip hangs down a little
      }
    },
  };
}
