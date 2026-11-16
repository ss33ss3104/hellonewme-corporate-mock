// ホームのFV：立体の「Hello / new / me inc.」と、o をくぐって序章へ入る動き（2026-11-16 本人決定）
// - 決定の経緯：Momo Trust Display を軸に5案 → 案4「o をくぐって入る」、質感は「1 ソフトマット」、空は鮮やかに
// - 試作：visual/fv-through.html（質感の比較つき）。設計書の判断ログ
// - 書体：assets/fonts/MomoTrustDisplay-Regular.ttf（Google Fonts、SIL OFL 1.1）。three.js 0.160（ページの importmap）
// 時間割：読み込み直後は o の穴を間近に覗く → 3.4秒でカメラが引いて3語が見える（ここで app.js にヘッダーを降ろす合図）
//         → スクロール（FV の区間）で o の正面へ寄り、穴をくぐって空へ抜け、白へ溶けて序章へ
// 立体を描けない時（WebGL がない・書体が読めない）は .fvx-off を付け、静止画の FV にする（style.css）
import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const fv = document.querySelector('.fv.fvx');
const reveal = () => dispatchEvent(new Event('fv3d:reveal'));
const fail = () => { if (fv) fv.classList.add('fvx-off'); reveal(); };

if (fv) {
  try { init(); } catch (e) { console.warn('fv3d', e); fail(); }
}

function init() {
  const stage = fv.querySelector('.stage'), canvas = stage.querySelector('canvas'), wash = stage.querySelector('.wash'), fade = stage.querySelector('.fadeout');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .02, 300);
  // 光：柔らかい映り込み（RoomEnvironment）＋弱めの直接光。強くすると白が飛んで階調が消える
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  scene.add(new THREE.HemisphereLight(0xeef5ff, 0x8fa6c4, 1.27));
  const sun = new THREE.DirectionalLight(0xffffff, 1.43); sun.position.set(-2, 4, 9); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xcfe0ff, .44); fill.position.set(6, -3, 2); scene.add(fill);

  // ---- 文字：Hello / new / me ＋小さな inc.。ソフトマット（つや消しの白、縁にだけ淡いピンクの光、丸い面取り） ----
  const SIZE = 1, DEPTH = .42, LH = 1.02, BEVEL = { t: .07, s: .016, n: 16 };
  const FRONT_Z = DEPTH / 2 + BEVEL.t + .006;
  const front = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .62, sheen: 1, sheenRoughness: .45, sheenColor: 0xffc2d1, clearcoat: .35, clearcoatRoughness: .5 });
  const side = new THREE.MeshPhysicalMaterial({ color: 0xdbe8f7, roughness: .7, sheen: .9, sheenRoughness: .55, sheenColor: 0xffd3de });
  const block = new THREE.Group(); scene.add(block);
  let blockW = 1, blockH = 1, hole = null;

  function build(font) {
    const res = font.data.resolution;
    const lines = [['Hello'], ['new'], ['me', { text: 'inc.', size: .26, gap: .07 }]];
    let oChar = null;
    lines.forEach((parts, i) => {
      const line = new THREE.Group(); let pen = 0;
      parts.forEach((part, k) => {
        const text = typeof part === 'string' ? part : part.text, size = typeof part === 'string' ? SIZE : part.size;
        if (k > 0) pen += part.gap || 0;
        [...text].forEach((ch) => {
          const g = new TextGeometry(ch, { font, size, height: DEPTH * size, curveSegments: 40, bevelEnabled: true,
            bevelThickness: BEVEL.t * size, bevelSize: BEVEL.s * size, bevelSegments: BEVEL.n });   // o を間近でくぐるので曲線を細かく
          g.computeBoundingBox(); const bb = g.boundingBox, cx = (bb.min.x + bb.max.x) / 2;
          g.translate(-cx, 0, -DEPTH * size / 2);
          const c = new THREE.Group(); c.position.x = pen + cx; c.add(new THREE.Mesh(g, [front, side])); line.add(c);
          if (!oChar && ch === 'o' && i === 0) oChar = { c, cx, line, shapes: font.generateShapes(ch, size) };
          pen += font.data.glyphs[ch].ha * size / res;
        });
      });
      line.children.forEach((c) => c.position.x -= pen / 2);
      line.position.y = -i * LH; blockW = Math.max(blockW, pen); block.add(line);
    });
    // 上下は実際の外形で中心をそろえる（小文字だけの行があっても片寄らない）
    block.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(block), cy = (box.min.y + box.max.y) / 2;
    block.children.forEach((l) => l.position.y -= cy);
    blockH = box.max.y - box.min.y;
    // Hello の o の穴（形の穴の輪郭）の中心と高さ
    const pts = oChar.shapes[0].holes[0].getPoints(24);
    const ox = oChar.line.position.x + oChar.c.position.x - oChar.cx, oy = oChar.line.position.y;
    const hb = new THREE.Box3().setFromPoints(pts.map((p) => new THREE.Vector3(p.x + ox, p.y + oy, 0)));
    hole = { c: hb.getCenter(new THREE.Vector3()), h: hb.max.y - hb.min.y };
  }

  // ---- 画面に合わせる。文字の塊は、下の目次に重ならないよう少し上に置く ----
  let baseZ = 14, lift = 0, kfov = 1;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight, aspect = w / h;
    renderer.setSize(w, h, false); camera.aspect = aspect; camera.updateProjectionMatrix();
    kfov = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const portrait = aspect < .9;
    baseZ = Math.max(blockW / (portrait ? .86 : .52) / (kfov * aspect), blockH / (portrait ? .5 : .58) / kfov);
    lift = (portrait ? .07 : .05) * kfov * baseZ;
  }

  // ---- カメラの位置：S＝o の穴を間近に覗く／M＝3語の全体／E＝o をくぐった向こう ----
  const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const poseS = () => new THREE.Vector3(hole.c.x, hole.c.y, FRONT_Z + hole.h / (.62 * kfov));
  const poseM = () => new THREE.Vector3(0, -lift, baseZ);
  const poseE = () => new THREE.Vector3(hole.c.x, hole.c.y, -5);
  const lerp3 = (a, b, u) => a.clone().lerp(b, u);
  function introPose(u) {   // 奥行きは早めに、横の移動は後半に（穴の中心から外れずに引く）
    const S = poseS(), M = poseM(), z = ease(u), xy = ease(seg(u, .35, 1));
    return new THREE.Vector3(S.x + (M.x - S.x) * xy, S.y + (M.y - S.y) * xy, S.z + (M.z - S.z) * z);
  }
  function scrollPose(p) {  // 前半：穴の正面へ寄る／後半：まっすぐ穴をくぐる
    if (p < .55) return lerp3(poseM(), poseS(), ease(p / .55));
    const S = poseS(); return new THREE.Vector3(S.x, S.y, S.z + (poseE().z - S.z) * Math.pow((p - .55) / .45, 1.6));
  }

  const INTRO = 3.4, cam = new THREE.Vector3(), goal = new THREE.Vector3();
  let t0 = 0, first = true, revealed = false, inView = true, mx = 0, my = 0, sx = 0, sy = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }).observe(fv);   // FV を過ぎたら描かない
  addEventListener('resize', resize);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!inView || !hole) return;
    const t = still ? INTRO : (now - t0) / 1000;
    const span = fv.offsetHeight - innerHeight, p = still ? 0 : clamp01(-fv.getBoundingClientRect().top / Math.max(1, span));
    if (!revealed && (t > INTRO - .4 || p > 0)) { revealed = true; reveal(); }
    goal.copy(p > 0 ? scrollPose(p) : introPose(clamp01(t / INTRO)));
    if (first) { cam.copy(goal); first = false; } else cam.lerp(goal, p > 0 ? .18 : .5);   // 急なスクロールをならす
    const near = clamp01((cam.z - FRONT_Z) / (baseZ * .5));                               // 穴をくぐる時はマウスを効かせない
    sx += (mx - sx) * .05; sy += (my - sy) * .05;
    camera.position.set(cam.x + sx * .6 * near, cam.y - sy * .4 * near, cam.z);
    camera.rotation.set(sy * .04 * near, sx * .06 * near, 0);
    const tilt = (p > 0 ? 1 : ease(seg(clamp01(t / INTRO), .4, 1))) * (1 - seg(p, .3, .55));   // 覗く時とくぐる時は正面
    block.rotation.set(-.08 * tilt, -.16 * tilt, 0);
    wash.style.opacity = seg(p, .82, 1).toFixed(3);
    if (fade) fade.style.opacity = (1 - seg(p, 0, .12)).toFixed(3);   // 目次と下の線は、寄り始めたら消す
    renderer.render(scene, camera);
  }

  new TTFLoader().load('assets/fonts/MomoTrustDisplay-Regular.ttf', (json) => {
    try { build(new Font(json)); resize(); t0 = performance.now(); fv.classList.add('fvx-on'); requestAnimationFrame(frame); }
    catch (e) { console.warn('fv3d', e); fail(); }
  }, undefined, (e) => { console.warn('fv3d font', e); fail(); });
}
