// Классический скрипт: модули three.js подгружаются динамически,
// чтобы страница работала и при открытии index.html напрямую с диска.

/* ── оглавление: подсветка текущего раздела ── */
(() => {
  const links = [...document.querySelectorAll('.runhead a')];
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove('on'));
      const a = map.get(e.target.id);
      if (!a) return;
      a.classList.add('on');
      // на узком экране меню прокручивается вбок — держим активный пункт в поле зрения
      const nav = a.parentElement;
      nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
})();

/* ── одноразовые анимации при появлении ── */
(() => {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.35 });
  document.querySelectorAll('.fork, .scale').forEach(el => io.observe(el));
})();

/* ── фото in vivo скрыты до явного клика ── */
document.querySelector('.veil__btn')?.addEventListener('click', () => {
  document.getElementById('veil').classList.add('open');
});

/* ── «Как это работает»: каркас → клетки → ткань, по прокрутке ── */
(() => {
  const svg = document.getElementById('tissue');
  const wrap = document.getElementById('howto');
  if (!svg || !wrap) return;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };

  // псевдослучайность с фиксированным зерном — рисунок одинаков при каждой загрузке
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const tissue = el('g', {});
  const scaffold = el('g', { stroke: '#191613', 'stroke-width': 1.4, fill: 'none' });
  const cells = el('g', {});
  svg.append(tissue, scaffold, cells);

  // сетка каркаса: волокна электроспиннинга — набор пересекающихся кривых
  for (let i = 0; i < 26; i++) {
    const vertical = i % 2;
    const t = (i / 26) * 400 + rnd() * 12;
    const w = 18 + rnd() * 26;
    const d = vertical
      ? `M${t} -10 C${t + w} 120 ${t - w} 280 ${t + w * .4} 410`
      : `M-10 ${t} C120 ${t - w} 280 ${t + w} 410 ${t - w * .4}`;
    scaffold.append(el('path', { d }));
  }

  // клетки: появляются, растут и сливаются в ткань
  const list = [];
  for (let i = 0; i < 70; i++) {
    const x = 20 + rnd() * 360, y = 20 + rnd() * 360;
    const at = rnd();
    const c = el('ellipse', { cx: x, cy: y, rx: 0, ry: 0, fill: '#a3221b', transform: `rotate(${rnd() * 180} ${x} ${y})` });
    const n = el('circle', { cx: x, cy: y, r: 0, fill: '#f2eee6' });
    const blob = el('circle', { cx: x, cy: y, r: 0, fill: '#d98c7e' });
    cells.append(c, n); tissue.append(blob);
    list.push({ c, n, blob, at, k: 0.6 + rnd() * 0.8 });
  }

  const mScaf = document.getElementById('m-scaf');
  const mTis = document.getElementById('m-tis');
  const clamp = v => Math.max(0, Math.min(1, v));

  function draw() {
    const r = wrap.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight));
    const seedP = clamp(p / 0.35);            // клетки высеваются
    const grow = clamp((p - 0.25) / 0.5);    // размножаются, формируют ткань
    const dissolve = clamp((p - 0.45) / 0.5); // каркас растворяется

    list.forEach(o => {
      const vis = seedP > o.at * 0.9 ? 1 : 0;
      const s = vis * (1 + grow * 1.6) * o.k;
      o.c.setAttribute('rx', 7 * s); o.c.setAttribute('ry', 4.2 * s);
      o.n.setAttribute('r', 1.6 * s);
      o.c.setAttribute('opacity', 1 - grow * 0.55);
      o.blob.setAttribute('r', vis * grow * 44 * o.k);
    });
    tissue.setAttribute('opacity', grow * 0.85);
    scaffold.setAttribute('opacity', 1 - dissolve);
    scaffold.setAttribute('stroke-dasharray', dissolve > 0 ? `${40 * (1 - dissolve) + 1} ${dissolve * 30}` : 'none');
    mScaf.style.setProperty('--p', `${(1 - dissolve) * 100}%`);
    mTis.style.setProperty('--p', `${grow * 100}%`);
  }
  addEventListener('scroll', () => requestAnimationFrame(draw), { passive: true });
  addEventListener('resize', draw);
  draw();
})();

/* ── 3D‑модель клапана ── */
(async () => {
  const canvas = document.getElementById('valve');
  const loading = document.getElementById('loading');
  let THREE, OrbitControls, STLLoader, toCreasedNormals;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
    ({ STLLoader } = await import('three/addons/loaders/STLLoader.js'));
    ({ toCreasedNormals } = await import('three/addons/utils/BufferGeometryUtils.js'));
  } catch (e) {
    loading.textContent = 'не удалось загрузить 3D‑библиотеку';
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  const HOME = new THREE.Vector3(2.4, 3.1, 3.4);
  camera.position.copy(HOME);

  // свет: тёплый ключевой, холодный заполняющий, красный контровой
  scene.add(new THREE.HemisphereLight(0xf4ece0, 0x2a1e1a, 0.9));
  const key = new THREE.DirectionalLight(0xfff3e4, 2.4); key.position.set(3, 4, 2); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9db4cc, 0.7); fill.position.set(-3, 1, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xc0392b, 2.2); rim.position.set(-1, -2, -3); scene.add(rim);

  // STL хранится в valve.js как base64 — без fetch, работает и с file://
  const bin = Uint8Array.from(atob(window.VALVE_STL), c => c.charCodeAt(0)).buffer;
  let geo = new STLLoader().parse(bin);
  // сглаживаем фасеты, но сохраняем острые кромки створок
  geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(35));
  geo.center();
  geo.computeBoundingSphere();
  const s = 1 / geo.boundingSphere.radius;
  geo.scale(s, s, s);

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xece2d2, roughness: 0.42, metalness: 0,
    clearcoat: 0.6, clearcoatRoughness: 0.35,
    sheen: 1, sheenColor: new THREE.Color(0xd98c7e), sheenRoughness: 0.5,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const pivot = new THREE.Group();
  pivot.add(mesh);
  scene.add(pivot);

  // тонкая опорная окружность под образцом — «предметный столик»
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.25, 1.255, 128),
    new THREE.MeshBasicMaterial({ color: 0x6b6158, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.85;
  scene.add(ring);

  loading.remove();

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false; // колесо мыши остаётся за прокруткой страницы
  controls.minDistance = 1.4;
  controls.maxDistance = 7;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.1;

  const hint = document.getElementById('hint');
  let idle;
  controls.addEventListener('start', () => {
    controls.autoRotate = false; hint.style.opacity = 0; clearTimeout(idle);
  });
  controls.addEventListener('end', () => {
    idle = setTimeout(() => (controls.autoRotate = true), 4000);
  });

  // Ctrl/⌘ + колесо — масштаб, обычное колесо прокручивает страницу
  canvas.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    dolly(e.deltaY > 0 ? 1.08 : 1 / 1.08);
  }, { passive: false });

  function dolly(f) {
    const v = camera.position.clone().sub(controls.target);
    const d = THREE.MathUtils.clamp(v.length() * f, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(v.setLength(d));
  }
  document.querySelectorAll('[data-zoom]').forEach(b =>
    b.addEventListener('click', () => dolly(b.dataset.zoom > 0 ? 1 / 1.25 : 1.25)));
  document.querySelector('[data-reset]').addEventListener('click', () => {
    camera.position.copy(HOME); controls.target.set(0, 0, 0); pivot.rotation.set(0, 0, 0);
  });

  const ro = { az: document.getElementById('ro-az'), el: document.getElementById('ro-el'), z: document.getElementById('ro-zoom') };
  const homeDist = HOME.length();

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // на узких экранах расширяем угол обзора, чтобы клапан помещался целиком
      camera.fov = Math.min(60, 32 * Math.max(1, 0.95 / camera.aspect));
      camera.updateProjectionMatrix();
    }
  }

  // лёгкий наклон образца в зависимости от прокрутки страницы
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    resize();
    pivot.rotation.x = Math.min(scrollY / innerHeight, 1) * 0.6;
    controls.update();
    const az = (THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()) + 360) % 360;
    const el = 90 - THREE.MathUtils.radToDeg(controls.getPolarAngle());
    ro.az.textContent = String(Math.round(az)).padStart(3, '0');
    ro.el.textContent = String(Math.round(el)).padStart(2, '0');
    ro.z.textContent = (homeDist / camera.position.distanceTo(controls.target)).toFixed(1);
    renderer.render(scene, camera);
  });
})();
