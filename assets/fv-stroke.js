/* ホームのFV：線で描いて満たす「Hello / new / me inc.」と、スクロールで1行に組み替えて上へ流す動き（2026-11-16 本人決定）
   - 経緯：立体の文字（assets/fv3d.js、今は読み込まない）→ 本人指定で「線で描いて満たす」へ。参考：21st.dev の Stroke Draw Type
   - 試作：visual/fv-stroke.html。SVG は build.py の fv_type_svg が assets/fv-glyphs.json から組む
   時間割：1文字ずつ 0.11 秒ずらして白い線で輪郭を描く（1文字 1.5 秒）→ 描き終える頃から液体が下から満ちる（1.4 秒）。
           Hello を描き終えた頃に app.js へヘッダーを降ろす合図（fv3d:reveal、名前は立体版のまま）。
   乗せると：その文字の液体が抜けて輪郭に戻り、離すとまた満ちる（PC）。
   スクロール（FV の区間）：3行の文字が1行（Hello new me inc.）に並び直り（〜.42）、そのまま上へ流れて画面の外へ（.45〜.9）。空は .62〜.95 で白へ。
   （2026-11-16 本人指定。o をくぐる → 散る → フェードアウト → 1行に組み替えて流す）
   満ちた後は、ピアノの鍵盤のように1文字ずつランダムに沈んで跳ね返る（同日の本人指定。動きを減らす設定では動かさない）
   1行に並んだ後は、上へ流す代わりに、縮みながらヘッダーのロゴの位置へ移り、ロゴと入れ替わる（同日の本人指定。FVの間はヘッダーのロゴを隠す）。
   空が白くなるのに合わせて、文字の色も白からロゴの墨色へ変わる */
(() => {
  const fv = document.querySelector('.fv.fvx'), svg = fv && fv.querySelector('.fvt');
  const reveal = () => dispatchEvent(new Event('fv3d:reveal'));
  if (!svg) { reveal(); return; }
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = fv.querySelector('.stage'), wash = stage.querySelector('.wash'), fade = stage.querySelector('.fadeout');
  const STAGGER = .11, DRAW = 1.5, START = .25, FILL = 1.4;
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  const glyphs = [...svg.querySelectorAll('.fg')].map((g, i) => {
    const [x1, y1, x2, y2] = g.dataset.box.split(' ').map(Number);
    const gl = { el: g, i, row: +g.dataset.row, x1, y1, x2, y2, amp: +g.dataset.amp, lam: +g.dataset.lam, p: still ? 1 : 0, hover: false,
      front: g.querySelector('.liq:not(.back)'), back: g.querySelector('.liq.back'), phase: (i * 1.37) % 6, hit: -1 };
    g.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') gl.hover = true; });
    g.addEventListener('pointerleave', () => { gl.hover = false; });
    return gl;
  });
    const last = START + (glyphs.length - 1) * STAGGER + DRAW * .75 + FILL;

  // 線の太さを画面で約1.8pxにそろえる
  const measure = () => {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    svg.style.setProperty('--sw', (1.8 * vb.width / r.width).toFixed(2));
  };
  measure(); addEventListener('resize', measure);

  // 1行に組み替えた時の位置：行ごとの外形を左から「Hello␣new␣me inc.」と並べ、真ん中の行（new）の高さにそろえる
  const ROWS = [...new Set(glyphs.map((g) => g.row))].sort();
  const rowBox = ROWS.map((r) => { const gs = glyphs.filter((g) => g.row === r); return { r, x1: Math.min(...gs.map((g) => g.x1)), x2: Math.max(...gs.map((g) => g.x2)), y2: Math.max(...gs.map((g) => g.y2)) }; });
  const SP = (rowBox[0].x2 - rowBox[0].x1) * .12;                  // 単語の間
  const oneW = rowBox.reduce((s, b) => s + b.x2 - b.x1, 0) + SP * (rowBox.length - 1);
  const mid = rowBox[Math.floor(rowBox.length / 2)];
  let cx = -oneW / 2;
  rowBox.forEach((b) => { b.dx = cx - b.x1; b.dy = mid.y2 - b.y2; cx += b.x2 - b.x1 + SP; });
  glyphs.forEach((g) => { const b = rowBox.find((x) => x.r === g.row); g.dx = b.dx; g.dy = b.dy; });

  // ロゴへの移り先：1行に並んだ文字の外形（変形なしの時）を舞台からの位置で測っておく。画面の大きさが変わったら測り直す
  const logo = document.querySelector('.hd .logo-type'), SWAP = .82;   // SWAP：ロゴと入れ替わる所。app.js の pastY（ヘッダーの地が白くなる所）と同じ
  let line = null;
  const measureLine = () => {
    const st = stage.getBoundingClientRect(), prevS = svg.style.transform, prev = glyphs.map((g) => g.el.style.transform);
    svg.style.transform = 'none';
    glyphs.forEach((g) => { g.el.style.transform = `translate(${g.dx}px,${g.dy}px)`; });
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    glyphs.forEach((g) => { const r = g.el.querySelector('.ln').getBoundingClientRect(); x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top); x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom); });
    const b = svg.getBoundingClientRect();
    glyphs.forEach((g, i) => { g.el.style.transform = prev[i]; });
    svg.style.transform = prevS;
    line = { cx: (x1 + x2) / 2 - st.left, cy: (y1 + y2) / 2 - st.top, w: x2 - x1, sx: b.left + b.width / 2 - st.left, sy: b.top + b.height / 2 - st.top };
  };
  addEventListener('resize', () => { line = null; });
  if (logo && !still) document.body.classList.add('fvmorph');
  const mix = (c) => Math.round(255 + (26 - 255) * c);   // 白 → 墨（#1A1A1A）

  let t0 = performance.now(), revealed = false, inView = true;
  // ピアノの鍵盤：満ちた後、1文字ずつランダムに、押されて沈み、ばねで跳ね返る（2026-11-16 本人指定）。
  // ときどき2文字同時（和音）。同じ文字が続けて鳴らないようにする
  const KEY = .62;                                             // 1回の長さ（秒）
  let nextKey = 0, lastKey = -1;
  const keyY = (u, H) => {                                     // u：0〜1。沈む → 跳ね上がる → 小さく揺れて止まる
    if (u < .14) return H * .09 * Math.sin(u / .14 * Math.PI / 2);
    const v = (u - .14) / .86;
    return H * .09 * Math.cos(v * Math.PI * 2.4) * Math.pow(1 - v, 2.2) - H * .06 * Math.sin(v * Math.PI) * (1 - v);
  };
  const strike = (t) => {
    const free = glyphs.filter((g) => g.i !== lastKey && (g.hit < 0 || t - g.hit > KEY));
    if (!free.length) return;
    const n = Math.random() < .22 ? 2 : 1;
    for (let k = 0; k < n && free.length; k++) {
      const g = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      g.hit = t; lastKey = g.i;
    }
    nextKey = t + .18 + Math.random() * .42;                   // 次の打鍵まで 0.18〜0.6 秒
  };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }).observe(fv);
  svg.classList.add('run');
  if (still) { reveal(); revealed = true; }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!inView) return;
    const t = (now - t0) / 1000;
    const span = fv.offsetHeight - innerHeight, p = still ? 0 : clamp01(-fv.getBoundingClientRect().top / Math.max(1, span));
    if (!revealed && (t > START + 4 * STAGGER + DRAW || p > 0)) { revealed = true; reveal(); }

    // 液体：はじめは時間で満ち、満ちた後は乗せた文字だけ抜ける
    glyphs.forEach((g) => {
      const s0 = START + g.i * STAGGER + DRAW * .75, done = still || t > s0 + FILL;
      const goal = done ? (g.hover ? 0 : 1) : ease(seg(t, s0, s0 + FILL));
      g.p += (goal - g.p) * (done ? .06 : 1);
      const H = g.y2 - g.y1, level = g.y2 + g.amp * 2 - g.p * (H + g.amp * 5), w = still ? 0 : t * .9 + g.phase;
      g.front.setAttribute('transform', `translate(${(-(w * g.lam * .55) % g.lam).toFixed(1)} ${level.toFixed(1)})`);
      g.back.setAttribute('transform', `translate(${(-(w * g.lam * .35 + g.lam / 2) % g.lam).toFixed(1)} ${(level - g.amp * 1.2).toFixed(1)})`);
    });

    // スクロール：3行 → 1行に組み替え（〜.42、行ごとに少しずらす）→ 縮みながらヘッダーのロゴの位置へ（.44〜SWAP）→ ロゴと入れ替わる
    const vb = svg.viewBox.baseVal, w = svg.getBoundingClientRect().width / (parseFloat(svg.dataset.s || 1)), k = w / vb.width;
    const m = ease(seg(p, .02, .42)), fit = Math.min(1, innerWidth * .8 / (oneW * k));
    if (!still && t > last && p < .4 && t >= nextKey) strike(t);
    glyphs.forEach((g) => {
      const lag = (2 - g.row) * .05;                          // 下の行から先に動かし、上の行（Hello）が最後に下りてくる（途中で重ならない）
      const kr = ease(seg(p, .02 + lag, .32 + lag));
      const u = g.hit < 0 ? 1 : (t - g.hit) / KEY, by = u < 1 ? keyY(u, g.y2 - g.y1) : 0;
      g.el.style.transform = kr > 0 || by ? `translate(${(g.dx * kr).toFixed(1)}px,${(g.dy * kr + by).toFixed(1)}px)` : '';
    });
    const sc = 1 + (fit - 1) * m, q = logo ? ease(seg(p, .44, SWAP)) : 0;
    let S = sc, tx = 0, ty = -ease(seg(p, .45, .9)) * innerHeight * .62 * (logo ? 0 : 1);   // ロゴが無いページでは以前どおり上へ流す
    if (q > 0) {
      if (!line) measureLine();
      const st = stage.getBoundingClientRect(), T = logo.getBoundingClientRect();
      const Tc = [T.left + T.width / 2 - st.left, T.top + T.height / 2 - st.top];
      const Rc = [line.sx + (line.cx - line.sx) * sc, line.sy + (line.cy - line.sy) * sc];   // 1行に並んだ時の中心
      S = sc + (T.width / line.w - sc) * q;
      // 縮める中心は SVG の中心。文字の中心が Rc から Tc へまっすぐ進むよう、ずらし量を決める
      tx = Rc[0] + (Tc[0] - Rc[0]) * q - line.sx - (line.cx - line.sx) * S;
      ty = Rc[1] + (Tc[1] - Rc[1]) * q - line.sy - (line.cy - line.sy) * S;
    }
    svg.dataset.s = S;
    svg.style.transform = p > 0 ? `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${S.toFixed(4)})` : '';
    const c = logo ? seg(p, .62, .8) : 0;                     // 文字の色：白 → 墨。影も薄くする
    svg.style.setProperty('--fvc', `rgb(${mix(c)},${mix(c)},${mix(c)})`);
    svg.style.setProperty('--fvk', c.toFixed(3));
    svg.style.opacity = logo && p >= SWAP ? 0 : '';
    wash.style.opacity = (logo ? seg(p, .5, .8) : seg(p, .62, .95)).toFixed(3);
    if (fade) fade.style.opacity = (1 - seg(p, 0, .12)).toFixed(3);   // 目次と下の線は、寄り始めたら消す
  }
  requestAnimationFrame(frame);
})();
