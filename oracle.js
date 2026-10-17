(() => {
    const $ = s => document.querySelector(s);
    const $$ = s => [...document.querySelectorAll(s)];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sleep = ms => new Promise(r => setTimeout(r, reduceMotion ? Math.min(ms, 60) : ms));

    // ---------- tiny storage helpers (private windows can throw) ----------
    const store = {
        get(k, d) { try { const v = localStorage.getItem('oracle.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
        set(k, v) { try { localStorage.setItem('oracle.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
    };

    const visits = store.get('visits', 0) + 1;
    store.set('visits', visits);

    // ---------- seeded randomness: same question + same day = same prophecy ----------
    function hash(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function rng(seed) {
        return () => {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    const today = () => new Date().toISOString().slice(0, 10);

    // =====================================================================
    // BOOT
    // =====================================================================
    const boot = $('#boot');
    const bootLog = $('#bootLog');
    const bootHint = $('#bootHint');
    let booted = false;

    const BOOT_LINES = [
        ['DELPHI BIOS v4.80 BC  (C) APOLLO SYSTEMS', ''],
        ['CPU: BRONZE TRIPOD @ 3 LEGS', ''],
        ['MEMORY TEST: 2,500 YEARS ', 'ok', 'OK'],
        ['DETECTING SMOKE ............ ', 'ok', 'FOUND'],
        ['DETECTING PRIESTESS ........ ', 'ok', 'FOUND'],
        ['LOADING PYTHIA.SYS', ''],
        ['LOADING LAUREL.DLL', ''],
        ['WARNING: SIBYL.DRV NOT RESPONDING', 'warn'],
        ['WARNING: SOMEONE IS ALREADY LOGGED IN', 'warn'],
        ['', ''],
        ['ΓΝΩΘΙ ΣΕΑΥΤΟΝ', 'gold'],
    ];

    async function runBoot() {
        const fast = visits > 1;
        for (const [text, cls, tail] of BOOT_LINES) {
            if (booted) return;
            const line = document.createElement('span');
            if (cls && !tail) line.className = cls;
            line.textContent = text;
            bootLog.appendChild(line);
            if (tail) {
                await sleep(fast ? 60 : 260);
                const t = document.createElement('span');
                t.className = cls;
                t.textContent = tail;
                bootLog.appendChild(t);
            }
            bootLog.appendChild(document.createTextNode('\n'));
            await sleep(fast ? 70 : 230);
        }
        if (visits > 1) {
            const back = document.createElement('span');
            back.className = 'warn';
            back.textContent = `\nwelcome back. this is visit ${visits}. it remembers you.\n`;
            bootLog.appendChild(back);
        }
        bootHint.classList.add('show');
    }

    function enterDesktop() {
        if (booted) return;
        booted = true;
        boot.classList.add('done');
        setTimeout(() => boot.remove(), 700);
        focusWin($('#win-oracle'));
        $('#ask').focus({ preventScroll: true });
        greet();
        resetIdle();
    }

    boot.addEventListener('click', enterDesktop);
    // oracle.exe#desktop skips the boot screen (handy for links and screenshots)
    if (location.hash === '#desktop') setTimeout(enterDesktop, 0);
    window.addEventListener('keydown', function onKey() {
        if (!booted) enterDesktop();
        window.removeEventListener('keydown', onKey);
    });
    runBoot();

    // =====================================================================
    // WINDOWS
    // =====================================================================
    let z = 20;
    function focusWin(win) {
        $$('.win').forEach(w => w.classList.toggle('is-inactive', w !== win));
        win.style.zIndex = ++z;
    }

    function openWin(name) {
        const win = $(`#win-${name}`);
        if (!win) return;
        win.hidden = false;
        focusWin(win);
        if (name === 'oracle') $('#ask').focus({ preventScroll: true });
        closeStart();
    }

    $$('[data-open]').forEach(el => el.addEventListener('click', () => openWin(el.dataset.open)));
    $$('.win').forEach(win => {
        win.addEventListener('pointerdown', () => focusWin(win));
        const close = win.querySelector('[data-close]');
        if (close) close.addEventListener('click', e => {
            e.stopPropagation();
            if (win.id === 'win-oracle') {
                // you can't close the oracle
                win.classList.add('shake');
                setTimeout(() => win.classList.remove('shake'), 800);
                say('sys', 'the oracle cannot be closed. only ignored.');
                return;
            }
            win.hidden = true;
        });
    });

    // drag by the title bar (desktop only)
    $$('.win-bar').forEach(bar => {
        const win = bar.closest('.win');
        bar.addEventListener('pointerdown', e => {
            if (e.target.closest('.win-btns') || window.innerWidth <= 700) return;
            const r = win.getBoundingClientRect();
            const dx = e.clientX - r.left, dy = e.clientY - r.top;
            win.style.translate = 'none';
            win.style.left = r.left + 'px';
            win.style.top = r.top + 'px';
            win.style.right = 'auto';
            bar.setPointerCapture(e.pointerId);
            const move = ev => {
                const x = Math.min(window.innerWidth - 60, Math.max(-r.width + 80, ev.clientX - dx));
                const y = Math.min(window.innerHeight - 70, Math.max(0, ev.clientY - dy));
                win.style.left = x + 'px';
                win.style.top = y + 'px';
            };
            const up = () => {
                bar.removeEventListener('pointermove', move);
                bar.removeEventListener('pointerup', up);
            };
            bar.addEventListener('pointermove', move);
            bar.addEventListener('pointerup', up);
        });
    });

    // ---------- start menu ----------
    const startBtn = $('#startBtn');
    const startMenu = $('#startMenu');
    function closeStart() { startMenu.hidden = true; startBtn.setAttribute('aria-expanded', 'false'); }
    startBtn.addEventListener('click', e => {
        e.stopPropagation();
        const open = startMenu.hidden;
        startMenu.hidden = !open;
        startBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => { if (!e.target.closest('.start-menu')) closeStart(); });

    $('#shutdown').addEventListener('click', () => {
        closeStart();
        const desk = $('#desktop');
        desk.classList.add('blackout');
        setTimeout(() => {
            desk.classList.remove('blackout');
            popup('it is not safe to turn off your fate.');
        }, 2400);
    });

    // ---------- clock ----------
    function tick() {
        const d = new Date();
        $('#clock').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · 480 BC`;
    }
    tick();
    setInterval(tick, 15000);

    // =====================================================================
    // WEIRDCORE BITS
    // =====================================================================
    const CAPTIONS = [
        'you were here when the smoke was still warm',
        'the columns are taller when nobody looks',
        'this is the temple. it has always been the temple',
        'do you remember asking?',
        'the sky has seen you before',
        'everything here is fine',
        'you can leave whenever you want',
    ];
    if (visits > 1) CAPTIONS.unshift('you have been here before');
    let capI = 0;
    setInterval(() => {
        capI = (capI + 1) % CAPTIONS.length;
        $('#caption').textContent = CAPTIONS[capI];
    }, 11000);

    // ---------- the eyes ----------
    // Realistic layered SVG eyes. The eyeball never scales: blinking and gazing move
    // the eyelids themselves (the eye opening is redrawn every frame from lid curves).
    const EYE_THEMES = {
        sky: {
            skin: ['#f4e4db', '#e3c4b6', '#c79d8f'], socket: '#6e463b', crease: '#8a5c4f',
            lash: '#1b1210', lidEdge: '#3a2620', waterline: '#e6aea3',
            sclera: ['#ffffff', '#f3eeec', '#c9bcba'], veins: '#c9484a', veinAlpha: 0.22,
            iris: ['#d6ecf6', '#86b7da', '#3f72a3', '#1a3354'], fibreLight: '#eef8ff', fibreDark: '#16304f',
            collar: '#d8b46a', rim: '#0b1628', noise: [0.55, 0.75, 0.95],
        },
        oracle: {
            skin: ['#f2d2ac', '#c78d60', '#5e3019'], socket: '#2e1209', crease: '#552613',
            lash: '#140906', lidEdge: '#3a1a10', waterline: '#e59a86',
            sclera: ['#fcf3e6', '#ecdac5', '#ab8a74'], veins: '#c3262c', veinAlpha: 0.5,
            iris: ['#ffe8a3', '#e89b2f', '#a4241a', '#260405'], fibreLight: '#ffe9ad', fibreDark: '#4d0b08',
            collar: '#ffd36b', rim: '#120101', noise: [1, 0.7, 0.35],
        },
    };
    const EYE = { cx: 100, cy: 60, irisR: 34, pupilR: 12 };
    const lerp = (a, b, k) => a + (b - a) * k;

    function bez(t, p0, p1, p2, p3) {
        const u = 1 - t;
        return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    }
    function bezD(t, p0, p1, p2, p3) {
        const u = 1 - t;
        return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
    }
    const upperPath = c => `M8 60 C52 ${c.toFixed(2)} 148 ${c.toFixed(2)} 192 60`;
    const lowerPath = d => `M8 60 C52 ${d.toFixed(2)} 148 ${d.toFixed(2)} 192 60`;
    const openingPath = (c, d) => `M8 60 C52 ${c.toFixed(2)} 148 ${c.toFixed(2)} 192 60 C148 ${d.toFixed(2)} 52 ${d.toFixed(2)} 8 60Z`;

    function buildEye(svg, themeName) {
        const t = EYE_THEMES[themeName];
        const id = 'eye-' + themeName;
        const R = rng(hash(id));
        const { cx, cy, irisR, pupilR } = EYE;
        svg.setAttribute('viewBox', '-30 -40 260 200');

        // iris fibres: fine radial strands, light and dark, uneven lengths
        let fibres = '';
        for (let i = 0; i < 150; i++) {
            const a = (i / 150) * Math.PI * 2 + (R() - 0.5) * 0.04;
            const r0 = pupilR + 1 + R() * 2.5, r1 = irisR * (0.7 + R() * 0.28);
            const wob = (R() - 0.5) * 0.12;
            const x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0;
            const xm = cx + Math.cos(a + wob) * (r0 + r1) / 2, ym = cy + Math.sin(a + wob) * (r0 + r1) / 2;
            const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
            const light = R() < 0.62;
            fibres += `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} Q${xm.toFixed(1)} ${ym.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${light ? t.fibreLight : t.fibreDark}" stroke-opacity="${(light ? 0.12 + R() * 0.3 : 0.15 + R() * 0.3).toFixed(2)}" stroke-width="${(0.3 + R() * 0.55).toFixed(2)}" fill="none"/>`;
        }
        // collarette: the wavy ring around the pupil
        let collar = '';
        for (let i = 0; i <= 48; i++) {
            const a = (i / 48) * Math.PI * 2;
            const r = pupilR + 5.5 + Math.sin(a * 7 + R()) * 1.3 + (R() - 0.5) * 1.2;
            collar += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
        }
        // crypts: little dark pits in the iris
        let crypts = '';
        for (let i = 0; i < 14; i++) {
            const a = R() * Math.PI * 2, r = pupilR + 8 + R() * 12;
            crypts += `<ellipse cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" rx="${(0.8 + R() * 1.6).toFixed(1)}" ry="${(0.5 + R() * 0.8).toFixed(1)}" transform="rotate(${(a * 180 / Math.PI).toFixed(0)} ${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)})" fill="${t.fibreDark}" opacity="${(0.25 + R() * 0.3).toFixed(2)}"/>`;
        }
        // veins on the white, branching in from both corners
        let veins = '';
        const vein = (x, y, dir, w) => {
            let d = `M${x.toFixed(1)} ${y.toFixed(1)}`, px = x, py = y;
            const steps = 3 + Math.floor(R() * 3);
            for (let k = 0; k < steps; k++) {
                const nx = px + dir * (5 + R() * 8), ny = py + (R() - 0.5) * 8;
                d += ` Q${((px + nx) / 2 + (R() - 0.5) * 4).toFixed(1)} ${((py + ny) / 2 + (R() - 0.5) * 4).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
                if (R() < 0.35) veins += `<path d="M${nx.toFixed(1)} ${ny.toFixed(1)} q${(dir * (3 + R() * 4)).toFixed(1)} ${((R() - 0.5) * 7).toFixed(1)} ${(dir * (5 + R() * 5)).toFixed(1)} ${((R() - 0.5) * 9).toFixed(1)}" stroke="${t.veins}" stroke-width="${(w * 0.6).toFixed(2)}" fill="none" stroke-linecap="round"/>`;
                px = nx; py = ny;
            }
            veins += `<path d="${d}" stroke="${t.veins}" stroke-width="${w.toFixed(2)}" fill="none" stroke-linecap="round"/>`;
        };
        for (let k = 0; k < 6; k++) {
            vein(14 + R() * 8, 48 + R() * 24, 1, 0.35 + R() * 0.45);
            vein(186 - R() * 8, 48 + R() * 24, -1, 0.35 + R() * 0.45);
        }

        const lashCount = 58, lowerCount = 22;
        let lashEls = '';
        for (let i = 0; i < lashCount; i++) lashEls += `<path class="lash" stroke="${t.lash}" fill="none" stroke-linecap="round"/>`;
        let lowerEls = '';
        for (let i = 0; i < lowerCount; i++) lowerEls += `<path class="lash-low" stroke="${t.lash}" fill="none" stroke-linecap="round" opacity="0.75"/>`;

        svg.innerHTML = `
            <defs>
                <radialGradient id="${id}-skin" cx="50%" cy="42%" r="55%">
                    <stop offset="0" stop-color="${t.skin[0]}"/>
                    <stop offset="0.55" stop-color="${t.skin[1]}"/>
                    <stop offset="1" stop-color="${t.skin[2]}"/>
                </radialGradient>
                <radialGradient id="${id}-fade" cx="50%" cy="50%" r="50%">
                    <stop offset="0.55" stop-color="#fff"/>
                    <stop offset="1" stop-color="#000"/>
                </radialGradient>
                <mask id="${id}-mask" maskContentUnits="userSpaceOnUse">
                    <ellipse cx="100" cy="58" rx="128" ry="96" fill="url(#${id}-fade)"/>
                </mask>
                <radialGradient id="${id}-sclera" cx="50%" cy="58%" r="58%">
                    <stop offset="0" stop-color="${t.sclera[0]}"/>
                    <stop offset="0.55" stop-color="${t.sclera[1]}"/>
                    <stop offset="1" stop-color="${t.sclera[2]}"/>
                </radialGradient>
                <radialGradient id="${id}-iris" cx="50%" cy="50%" r="50%">
                    <stop offset="0.3" stop-color="${t.iris[0]}"/>
                    <stop offset="0.5" stop-color="${t.iris[1]}"/>
                    <stop offset="0.82" stop-color="${t.iris[2]}"/>
                    <stop offset="1" stop-color="${t.iris[3]}"/>
                </radialGradient>
                <radialGradient id="${id}-limbal" cx="50%" cy="50%" r="50%">
                    <stop offset="0.8" stop-color="${t.rim}" stop-opacity="0"/>
                    <stop offset="0.93" stop-color="${t.rim}" stop-opacity="0.75"/>
                    <stop offset="1" stop-color="${t.rim}" stop-opacity="0.95"/>
                </radialGradient>
                <radialGradient id="${id}-pupil" cx="50%" cy="50%" r="50%">
                    <stop offset="0.82" stop-color="#030303"/>
                    <stop offset="1" stop-color="#030303" stop-opacity="0"/>
                </radialGradient>
                <filter id="${id}-noise" x="0" y="0" width="100%" height="100%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="3" seed="${hash(id) % 97}"/>
                    <feColorMatrix type="matrix" values="0 0 0 0 ${t.noise[0]}  0 0 0 0 ${t.noise[1]}  0 0 0 0 ${t.noise[2]}  1.1 0 0 0 -0.45"/>
                    <feComposite in2="SourceGraphic" operator="in"/>
                </filter>
                <filter id="${id}-blur1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1"/></filter>
                <filter id="${id}-blur4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
                <filter id="${id}-blur03"><feGaussianBlur stdDeviation="0.35"/></filter>
                <clipPath id="${id}-clip"><path class="eye-clip"/></clipPath>
            </defs>

            <!-- skin around the eye, fading out into the background -->
            <g mask="url(#${id}-mask)">
                <ellipse cx="100" cy="58" rx="128" ry="96" fill="url(#${id}-skin)"/>
                <ellipse cx="100" cy="-6" rx="86" ry="22" fill="#fff" opacity="0.22" filter="url(#${id}-blur4)"/>
                <path class="eye-socket" fill="none" stroke="${t.socket}" stroke-width="12" opacity="0.38" filter="url(#${id}-blur4)"/>
                <path class="eye-crease" fill="none" stroke="${t.crease}" stroke-width="2.2" stroke-linecap="round" opacity="0.5" filter="url(#${id}-blur1)"/>
                <path class="eye-lidfold" fill="none" stroke="#fff" stroke-width="3" opacity="0.18" filter="url(#${id}-blur1)"/>
                <path d="M30 98 C70 116 130 116 170 98" fill="none" stroke="${t.socket}" stroke-width="5" opacity="0.15" filter="url(#${id}-blur4)"/>
            </g>

            <!-- the eyeball, seen through the lid opening -->
            <g clip-path="url(#${id}-clip)">
                <rect x="0" y="0" width="200" height="120" fill="url(#${id}-sclera)"/>
                <g opacity="${t.veinAlpha}">${veins}</g>
                <ellipse cx="15" cy="61" rx="7" ry="5.5" fill="#d98d86" opacity="0.85" filter="url(#${id}-blur1)"/>
                <path d="M21 52 Q25 61 21 70" stroke="#c97c76" stroke-width="1.2" fill="none" opacity="0.6"/>
                <g class="eye-look">
                    <circle cx="${cx}" cy="${cy}" r="${irisR + 1.5}" fill="${t.rim}" opacity="0.35" filter="url(#${id}-blur1)"/>
                    <circle cx="${cx}" cy="${cy}" r="${irisR}" fill="url(#${id}-iris)"/>
                    <circle cx="${cx}" cy="${cy}" r="${irisR}" fill="#000" filter="url(#${id}-noise)" opacity="0.55"/>
                    <g>${fibres}</g>
                    ${crypts}
                    <path d="${collar}Z" fill="none" stroke="${t.collar}" stroke-width="1.6" opacity="0.55" filter="url(#${id}-blur03)"/>
                    <circle cx="${cx}" cy="${cy}" r="${irisR}" fill="url(#${id}-limbal)"/>
                    <circle class="eye-pupil" cx="${cx}" cy="${cy}" r="${pupilR}" fill="url(#${id}-pupil)"/>
                    <circle class="eye-pring" cx="${cx}" cy="${cy}" r="${pupilR + 0.6}" fill="none" stroke="${t.fibreDark}" stroke-width="1" opacity="0.5"/>
                </g>
                <!-- shadow the upper lid casts on the eyeball -->
                <path class="eye-lidshadow" fill="none" stroke="#000" stroke-width="16" opacity="0.42" filter="url(#${id}-blur4)"/>
                <path class="eye-lowshadow" fill="none" stroke="#000" stroke-width="6" opacity="0.15" filter="url(#${id}-blur4)"/>
                <!-- wet highlights -->
                <path d="M84 41 l9 -2.2 q1.6 -.3 1.9 1.3 l1.2 6.2 q.3 1.6 -1.3 2 l-9 2.2 q-1.6 .3 -1.9 -1.3 l-1.2 -6.2 q-.3 -1.6 1.3 -2z" fill="#fff" opacity="0.88" filter="url(#${id}-blur03)"/>
                <circle cx="113" cy="70" r="1.6" fill="#fff" opacity="0.55"/>
                <ellipse cx="52" cy="58" rx="16" ry="7" fill="#fff" opacity="0.18" filter="url(#${id}-blur4)"/>
            </g>

            <!-- lid edges, waterline and lashes (redrawn as the lids move) -->
            <path class="eye-waterline" fill="none" stroke="${t.waterline}" stroke-width="2.6" stroke-linecap="round" opacity="0.95"/>
            <path class="eye-wet" fill="none" stroke="#fff" stroke-width="0.7" opacity="0.55"/>
            <path class="eye-lidline" fill="none" stroke="${t.lidEdge}" stroke-width="3.2" stroke-linecap="round"/>
            <g class="eye-lashes-low">${lowerEls}</g>
            <g class="eye-lashes">${lashEls}</g>`;

        // per-lash randomness that stays fixed while the lids move
        const lashSeeds = Array.from({ length: lashCount }, () => [R(), R(), R()]);
        const lowerSeeds = Array.from({ length: lowerCount }, () => [R(), R()]);

        const el = {
            clip: svg.querySelector('.eye-clip'),
            socket: svg.querySelector('.eye-socket'),
            crease: svg.querySelector('.eye-crease'),
            fold: svg.querySelector('.eye-lidfold'),
            lidShadow: svg.querySelector('.eye-lidshadow'),
            lowShadow: svg.querySelector('.eye-lowshadow'),
            waterline: svg.querySelector('.eye-waterline'),
            wet: svg.querySelector('.eye-wet'),
            lidline: svg.querySelector('.eye-lidline'),
            lashes: [...svg.querySelectorAll('.lash')],
            lower: [...svg.querySelectorAll('.lash-low')],
            look: svg.querySelector('.eye-look'),
            pupil: svg.querySelector('.eye-pupil'),
            pring: svg.querySelector('.eye-pring'),
        };

        const state = { open: 1, wide: 0, lx: 0, ly: 0, svg, el, lashSeeds, lowerSeeds };
        renderEye(state);
        return state;
    }

    // Lid geometry: c = upper-lid control y, d = lower-lid control y.
    function renderEye(s) {
        const { el } = s;
        const closed = 1 - s.open;
        // lids follow the gaze a little: looking up lifts the upper lid, looking down drops it
        const c = lerp(68, lerp(20, 8, s.wide), s.open) + s.ly * 0.55;
        const d = lerp(72, 104, s.open) + s.ly * 0.25;
        const up = upperPath(c), low = lowerPath(d);

        el.clip.setAttribute('d', openingPath(c, d));
        el.socket.setAttribute('d', openingPath(c - 4, d + 3));
        const creaseC = lerp(c - 26, -14, 0.55);
        el.crease.setAttribute('d', `M22 46 C60 ${creaseC.toFixed(1)} 140 ${creaseC.toFixed(1)} 178 46`);
        el.fold.setAttribute('d', `M26 52 C62 ${(creaseC + 9).toFixed(1)} 138 ${(creaseC + 9).toFixed(1)} 174 52`);
        el.lidShadow.setAttribute('d', `M8 ${60 - 3} C52 ${(c - 3).toFixed(1)} 148 ${(c - 3).toFixed(1)} 192 ${60 - 3}`);
        el.lowShadow.setAttribute('d', low);
        el.waterline.setAttribute('d', `M14 61 C54 ${(d - 3.2).toFixed(1)} 146 ${(d - 3.2).toFixed(1)} 186 61`);
        el.wet.setAttribute('d', `M30 62 C62 ${(d - 6).toFixed(1)} 138 ${(d - 6).toFixed(1)} 170 62`);
        el.lidline.setAttribute('d', up);
        el.waterline.style.opacity = (0.95 * s.open).toFixed(2);
        el.wet.style.opacity = (0.55 * s.open).toFixed(2);

        // upper lashes: sweep up and out when open, droop down when the lid closes
        const n = el.lashes.length;
        el.lashes.forEach((p, i) => {
            const [r1, r2, r3] = s.lashSeeds[i];
            const tt = 0.04 + (i / (n - 1)) * 0.92 + (r3 - 0.5) * 0.012;
            const x = bez(tt, 8, 52, 148, 192), y = bez(tt, 60, c, c, 60);
            let tx = bezD(tt, 8, 52, 148, 192), ty = bezD(tt, 60, c, c, 60);
            const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
            let nx = ty, ny = -tx;
            if (ny > 0) { nx = -nx; ny = -ny; }
            const mid = Math.sin(tt * Math.PI);
            const L = (4 + mid * 10) * (0.65 + r1 * 0.6);
            const side = (tt - 0.5) * 2;
            const dirY = lerp(ny, -ny * 0.55, closed);          // flips downward as the eye shuts
            const ex = x + nx * L + side * L * 0.55 + (r2 - 0.5) * 5;
            const ey = y + dirY * L;
            const qx = x + nx * L * 0.45 + side * L * 0.05;
            const qy = y + dirY * L * 0.75;
            p.setAttribute('d', `M${x.toFixed(1)} ${y.toFixed(1)} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
            p.setAttribute('stroke-width', (0.4 + mid * 0.55 + r1 * 0.3).toFixed(2));
            p.style.opacity = (0.6 + r2 * 0.4).toFixed(2);
        });

        // lower lashes: short, sparse, pointing down and out
        const m = el.lower.length;
        el.lower.forEach((p, i) => {
            const [r1, r2] = s.lowerSeeds[i];
            const tt = 0.14 + (i / (m - 1)) * 0.78;
            const x = bez(tt, 8, 52, 148, 192), y = bez(tt, 60, d, d, 60);
            const side = (tt - 0.5) * 2;
            const L = (2.5 + Math.sin(tt * Math.PI) * 3.5) * (0.7 + r1 * 0.6);
            p.setAttribute('d', `M${x.toFixed(1)} ${(y + 0.8).toFixed(1)} q${(side * L * 0.3).toFixed(1)} ${(L * 0.6).toFixed(1)} ${(side * L * 0.7 + (r2 - 0.5)).toFixed(1)} ${L.toFixed(1)}`);
            p.setAttribute('stroke-width', (0.4 + r1 * 0.35).toFixed(2));
            p.style.opacity = (0.75 * s.open).toFixed(2);
        });

        el.look.setAttribute('transform', `translate(${s.lx.toFixed(2)} ${s.ly.toFixed(2)})`);
    }

    const eyes = $$('[data-eye]').map(svg => buildEye(svg, svg.dataset.eye));
    const eye = $('#eye');
    const oracleEye = eyes.find(s => s.svg === eye);

    // look at the pointer (iris moves, lids follow)
    let lookFrame = 0, lastPointer = null;
    window.addEventListener('pointermove', e => {
        lastPointer = e;
        if (lookFrame) return;
        lookFrame = requestAnimationFrame(() => {
            lookFrame = 0;
            eyes.forEach(s => {
                const r = s.svg.getBoundingClientRect();
                if (!r.width) return;
                const ex = r.left + r.width / 2, ey = r.top + r.height * 0.5;
                const a = Math.atan2(lastPointer.clientY - ey, lastPointer.clientX - ex);
                const k = Math.min(1, Math.hypot(lastPointer.clientX - ex, lastPointer.clientY - ey) / 280);
                s.lx = Math.cos(a) * 26 * k;
                s.ly = Math.sin(a) * 12 * k;
                renderEye(s);
            });
        });
    });

    // blink: the upper lid sweeps down and back up; the lower lid rises a touch
    function blink(s) {
        if (s.blinking) return;
        s.blinking = true;
        const down = 75, hold = 35, upDur = 150;
        const t0 = performance.now();
        const step = now => {
            const t = now - t0;
            if (t < down) s.open = 1 - Math.pow(t / down, 2);
            else if (t < down + hold) s.open = 0;
            else if (t < down + hold + upDur) s.open = 1 - Math.pow(1 - (t - down - hold) / upDur, 3);
            else { s.open = 1; s.blinking = false; renderEye(s); return; }
            renderEye(s);
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }
    eyes.forEach(s => (function loop() {
        setTimeout(() => {
            if (!reduceMotion) {
                blink(s);
                if (Math.random() < 0.22) setTimeout(() => blink(s), 330);   // sometimes a double blink
            }
            loop();
        }, 2600 + Math.random() * 5200);
    })());

    // the oracle's eye wakes up while she speaks: lids open wide, pupil blows open
    function eyeAwake(on) {
        if (!oracleEye) return;
        eye.classList.toggle('awake', on);
        const from = oracleEye.wide, to = on ? 1 : 0, t0 = performance.now();
        const step = now => {
            const k = Math.min(1, (now - t0) / 400);
            oracleEye.wide = lerp(from, to, 1 - Math.pow(1 - k, 2));
            renderEye(oracleEye);
            if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        oracleEye.el.pupil.style.r = on ? '17' : String(EYE.pupilR);
        oracleEye.el.pring.style.r = on ? '17.6' : String(EYE.pupilR + 0.6);
    }

    // ---------- pop-ups ----------
    const pop = $('#popup');
    function popup(text) {
        $('#popupText').textContent = text;
        pop.hidden = false;
        pop.querySelector('button').focus();
    }
    $$('[data-dismiss]').forEach(b => b.addEventListener('click', () => {
        pop.hidden = true;
        resetIdle();
        $('#ask').focus({ preventScroll: true });
    }));

    const IDLE_LINES = [
        'are you still there?',
        'are you still there?',
        'the smoke is getting cold. are you still there?',
        'someone else is asking a question right now. are you still there?',
    ];
    let idleTimer, idleCount = 0;
    function resetIdle() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            if (!pop.hidden || !booted) return resetIdle();
            popup(IDLE_LINES[Math.min(idleCount++, IDLE_LINES.length - 1)]);
        }, 45000);
    }
    ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => booted && resetIdle()));

    // ---------- offerings ----------
    const OFFER_LINES = {
        olive: 'an olive. modest. apollo nods.',
        laurel: 'laurel. his favourite. the smoke thickens.',
        coin: 'a coin. the priests take it before the god sees it.',
        honey: 'honey. the bees of Delphi remember this.',
    };
    function renderOfferings() {
        const offs = store.get('offerings', {});
        const total = Object.values(offs).reduce((a, b) => a + b, 0);
        $('#offerCount').textContent = total
            ? `on the altar: ${Object.entries(offs).map(([k, v]) => `${v} ${k}`).join(', ')}.`
            : 'the altar is empty.';
    }
    $$('[data-offer]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.offer;
        const offs = store.get('offerings', {});
        offs[k] = (offs[k] || 0) + 1;
        store.set('offerings', offs);
        renderOfferings();
        say('sys', OFFER_LINES[k]);
        $('#status').textContent = 'smoke: thick';
    }));
    renderOfferings();

    // ---------- temple hum (Web Audio, made on the fly, starts only on click) ----------
    let audio = null;
    $('#soundBtn').addEventListener('click', e => {
        const btn = e.currentTarget;
        if (!audio) {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const out = ctx.createGain();
            out.gain.value = 0;
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 420;
            lp.connect(out).connect(ctx.destination);
            [55, 55.4, 82.6, 110.2].forEach((f, i) => {
                const o = ctx.createOscillator();
                o.type = i % 2 ? 'triangle' : 'sine';
                o.frequency.value = f;
                const g = ctx.createGain();
                g.gain.value = i < 2 ? 0.35 : 0.12;
                o.connect(g).connect(lp);
                o.start();
            });
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.frequency.value = 0.07;
            lfoGain.gain.value = 180;
            lfo.connect(lfoGain).connect(lp.frequency);
            lfo.start();
            audio = { ctx, out, on: false };
        }
        audio.on = !audio.on;
        audio.ctx.resume();
        audio.out.gain.setTargetAtTime(audio.on ? 0.09 : 0, audio.ctx.currentTime, 0.6);
        btn.textContent = audio.on ? '🔊' : '🔇';
        btn.setAttribute('aria-pressed', String(audio.on));
    });

    // =====================================================================
    // THE ORACLE
    // =====================================================================
    const log = $('#log');
    const form = $('#prompt');
    const input = $('#ask');
    $('#visits').textContent = `visit ${visits}`;

    function say(cls, text) {
        const p = document.createElement('p');
        p.className = cls;
        p.textContent = text;
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
        return p;
    }

    const GLYPHS = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ#%&*+=?/\\|';
    // reveal text with a scramble: letters flicker as Greek glyphs before settling
    async function scrambleIn(cls, text) {
        const p = say(cls, '');
        if (reduceMotion) { p.textContent = text; return; }
        const steps = 14;
        for (let s = 1; s <= steps; s++) {
            const keep = Math.floor(text.length * s / steps);
            let out = text.slice(0, keep);
            for (let i = keep; i < Math.min(text.length, keep + 8); i++) {
                out += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
            }
            p.textContent = out;
            log.scrollTop = log.scrollHeight;
            await sleep(32);
        }
        p.textContent = text;
    }

    function greet() {
        say('sys', visits > 1
            ? `you came back. the smoke remembers ${visits - 1} visit${visits > 2 ? 's' : ''}.`
            : 'the priestess is listening.');
        say('sys', 'type a question and press enter. type HELP if you are lost.');
    }

    // ---------- the words of the smoke ----------
    const W = {
        lost: ['what you lost', 'the thing you stopped looking for', 'the voice you forgot', 'the door you closed', 'the name you never said'],
        waiting: ['is waiting', 'is still warm', 'has not moved', 'is listening', 'is counting'],
        place: ['behind the door you painted shut', 'under the third step', 'in the room you never enter', 'at the bottom of the well', 'in the last tab you closed', 'where the light is wrong', 'in a hallway that is longer than it should be', 'beside the sea, not in it'],
        thing: ['the small thing', 'the quiet one', 'the second choice', 'the road with no olive trees', 'the door on the left', 'the one you laughed at'],
        verb: ['ignore', 'carry', 'forget', 'promise', 'leave half finished', 'keep in your pocket'],
        becomes: ['will open', 'will follow you home', 'will become the big thing', 'will ask for you by name', 'will turn out to be a key', 'will grow teeth'],
        when: ['before the moon is full', 'when you stop counting', 'on a day that feels like a sunday', 'after the third yes', 'when the owl is silent', 'sooner than you think, later than you want'],
        animal: ['owls', 'crows', 'white dogs', 'moths', 'goats', 'dolphins'],
        omen: ['a cracked cup', 'a song you half remember', 'someone saying your name wrong', 'a light left on', 'the smell of rain inside', 'a clock that is two minutes late'],
        dont: ['do not', 'never', 'try not to'],
        act: ['sign anything', 'cross the river', 'look back', 'open it', 'answer the second call', 'go alone'],
        god: ['Apollo', 'Athena', 'Hermes', 'Persephone', 'Poseidon', 'Hecate'],
        godSays: ['laughs', 'turns away', 'is curious', 'has seen this before', 'pretends not to hear', 'nods once'],
    };

    const OMENS = [
        'THE SMOKE SAYS:',
        'THE LAUREL TREMBLES:',
        'THE TRIPOD SPEAKS:',
        'APOLLO IS SILENT. HIS SISTER ANSWERS:',
        'THE PRIESTESS LAUGHS, THEN SAYS:',
        'FROM THE CRACK IN THE EARTH:',
    ];

    const YES_NO = [
        'yes. but not the way you are hoping.',
        'no. and that will be the best thing that happens to you.',
        'yes. ask yourself why you needed to ask.',
        'a great thing will end. you will not know which one.',
        'the answer is yes on a tuesday and no on every other day.',
        'it will work. it will not look like it is working.',
    ];

    function prophecy(question) {
        const key = question.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
        const R = rng(hash(key + '|' + today()));
        const pick = arr => arr[Math.floor(R() * arr.length)];
        const n = () => ['two', 'three', 'four', 'seven', 'nine'][Math.floor(R() * 5)];

        const TEMPLATES = [
            () => [`${pick(W.lost)}`, `${pick(W.waiting)}`, `${pick(W.place)}.`],
            () => [`${pick(W.thing)} you ${pick(W.verb)}`, `${pick(W.becomes)}`, `${pick(W.when)}.`],
            () => [`${n()} ${pick(W.animal)} will cross your path`, `before ${pick(W.omen)}.`, 'count them.'],
            () => [`${pick(W.dont)} ${pick(W.act)}`, `until you notice ${pick(W.omen)}.`],
            () => [`${pick(W.god)} ${pick(W.godSays)}.`, `the answer is ${pick(W.place)}.`, 'it has always been there.'],
        ];

        const lines = [];
        const isYesNo = /^(will|should|is|am|are|do|does|did|can|could|would|shall|have|has)\b/i.test(key);
        if (isYesNo) lines.push(pick(YES_NO));

        const count = isYesNo ? 1 : 2;
        const used = new Set();
        while (lines.length < count + (isYesNo ? 1 : 0)) {
            const i = Math.floor(R() * TEMPLATES.length);
            if (used.has(i)) continue;
            used.add(i);
            lines.push(...TEMPLATES[i]());
        }

        // sometimes the oracle hands one of your own words back to you
        const words = key.split(' ').filter(w => w.length > 4);
        if (words.length && R() < 0.45) {
            const w = words.sort((a, b) => b.length - a.length)[0];
            lines.push(`the word "${w}" will mean something else by winter.`);
        }
        return { omen: pick(OMENS), lines };
    }

    async function consult() {
        // a progress bar that doesn't quite go the right way
        const bar = say('bar', '');
        const W_ = 22;
        const frames = reduceMotion ? [W_] : [2, 5, 9, 12, 14, 11, 8, 13, 17, 19, 21, 16, 20, W_];
        for (const f of frames) {
            bar.textContent = `consulting the smoke [${'█'.repeat(f)}${'░'.repeat(W_ - f)}]`;
            await sleep(110 + Math.random() * 120);
        }
    }

    const asked = store.get('asked', {});
    let busy = false;

    const COMMANDS = {
        help: () => {
            say('sys', 'ask any question, about anything. press enter.');
            say('sys', 'the same question on the same day gets the same answer.');
            say('sys', 'other words the priestess knows: WHO, CLEAR, APOLLO, OFFER, EXIT');
        },
        clear: () => { log.textContent = ''; say('sys', 'the smoke clears. it will come back.'); },
        cls: () => COMMANDS.clear(),
        who: () => {
            say('sys', 'i am the Pythia. i sat over a crack in the earth at Delphi for a thousand years.');
            say('sys', 'then they built computers over the crack. i moved in.');
        },
        apollo: () => say('warn', 'he is busy. he is always busy. ask me instead.'),
        offer: () => openWin('offerings'),
        exit: () => { say('warn', 'there is no exit. there is only the next question.'); $('#win-oracle').classList.add('shake'); setTimeout(() => $('#win-oracle').classList.remove('shake'), 800); },
        quit: () => COMMANDS.exit(),
    };

    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (busy) return;
        const q = input.value.trim();
        input.value = '';
        if (!q) { say('sys', 'the smoke cannot read silence.'); return; }

        say('q', `> ${q}`);
        const cmd = q.toLowerCase().replace(/[^a-z]/g, '');
        if (COMMANDS[cmd]) { COMMANDS[cmd](); return; }

        busy = true;
        input.disabled = true;
        $('#status').textContent = 'smoke: rising…';

        const key = q.toLowerCase().trim() + '|' + today();
        if (asked[key]) say('sys', 'you already asked this today. the smoke repeats itself.');
        asked[key] = true;
        store.set('asked', asked);

        eyeAwake(true);
        await consult();
        const { omen, lines } = prophecy(q);
        await sleep(250);
        await scrambleIn('omen', omen);
        for (const line of lines) {
            await sleep(260);
            await scrambleIn('prophecy', line);
        }
        await sleep(200);
        say('sys', ' ');

        // rarely, the screen notices you
        if (Math.random() < 0.18) setTimeout(() => popup('did you understand it?'), 1400);

        $('#status').textContent = 'smoke: settling';
        eyeAwake(false);
        busy = false;
        input.disabled = false;
        input.focus({ preventScroll: true });
    });
})();
