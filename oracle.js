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

    // eyes follow the pointer
    const eye = $('#eye');
    const skyEye = $('.sky-eye .iris-group');
    window.addEventListener('pointermove', e => {
        [[eye, 4, ['.iris', '.pupil']], [skyEye, 14, null]].forEach(([el, max, parts]) => {
            if (!el) return;
            const svg = el.ownerSVGElement || el;
            const r = svg.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const a = Math.atan2(e.clientY - cy, e.clientX - cx);
            const d = Math.min(1, Math.hypot(e.clientX - cx, e.clientY - cy) / 300);
            const tx = Math.cos(a) * max * d, ty = Math.sin(a) * max * d * 0.6;
            const targets = parts ? parts.map(p => el.querySelector(p)) : [el];
            targets.forEach(t => t.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)})`));
        });
    });
    (function blinkLoop() {
        setTimeout(() => {
            eye.classList.add('blink');
            setTimeout(() => eye.classList.remove('blink'), 140);
            blinkLoop();
        }, 2500 + Math.random() * 5000);
    })();

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
        busy = false;
        input.disabled = false;
        input.focus({ preventScroll: true });
    });
})();
