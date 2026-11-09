(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const input = $('#pw'), meter = $('#meter'), verdict = $('#verdict');

  // A deliberately small list. Real attackers use far bigger ones, so treat results as optimistic.
  const WORDS = ['password', 'passw0rd', 'welcome', 'welcome1', 'letmein', 'monkey', 'dragon', 'iloveyou', 'admin', 'login', 'princess', 'football', 'baseball', 'master', 'sunshine', 'shadow', 'superman', 'trustno1', 'qwerty', 'abc123', 'starwars', 'whatever', 'freedom', 'hello', 'secret', 'summer', 'winter', 'spring', 'autumn', 'michael', 'jessica', 'charlie', 'donald', 'batman', 'access', 'flower', 'loveme', 'changeme', 'computer', 'internet', 'soccer', 'hockey', 'ranger', 'buster', 'thomas', 'tigger', 'robert', 'daniel', 'george', 'harley', 'hunter', 'matrix', 'killer', 'pepper', 'cookie', 'ginger', 'banana', 'orange', 'yellow', 'purple', 'guitar', 'family', 'friend', 'school', 'monday', 'sunday', 'london', 'paris', 'google', 'facebook', 'test', 'guest', 'root', 'user', 'love', 'home', 'blue', 'star', 'moon', 'king', 'queen', '123456', '12345678', '123456789', '000000', '111111', '1q2w3e', 'zaq1zaq1', 'qazwsx'];
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'qazwsx', '1qaz2wsx'];
  const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
  const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  const lg = Math.log2;
  const isLetter = (c) => c >= 'a' && c <= 'z';
  const isDigit = (c) => c >= '0' && c <= '9';
  const isAlnum = (c) => isLetter(c) || isDigit(c);

  function pool(chars) {
    const t = { lower: false, upper: false, digit: false, sym: false };
    let other = false;
    chars.forEach((c) => {
      if (c >= 'a' && c <= 'z') t.lower = true;
      else if (c >= 'A' && c <= 'Z') t.upper = true;
      else if (isDigit(c)) t.digit = true;
      else if (c.charCodeAt(0) > 127) other = true;
      else t.sym = true;
    });
    const size = (t.lower ? 26 : 0) + (t.upper ? 26 : 0) + (t.digit ? 10 : 0) + (t.sym ? 33 : 0) + (other ? 100 : 0);
    return { size: size || 1, types: { ...t, sym: t.sym || other } };
  }

  function analyze(pw) {
    const chars = pw.split(''), n = chars.length;
    const low = chars.map((c) => { const l = c.toLowerCase(); return l.length === 1 ? l : c; });
    const L = low.join(''), M = low.map((c) => LEET[c] || c).join('');
    const p = pool(chars), perChar = lg(p.size);
    const hasUpper = chars.some((c) => c >= 'A' && c <= 'Z');
    const segs = [];
    const add = (i, j, bits, kind) => segs.push({ i, j, bits, kind });

    WORDS.forEach((w) => {
      [L, M].forEach((src, si) => {
        if (si === 1 && M === L) return;
        for (let i = src.indexOf(w); i !== -1; i = src.indexOf(w, i + 1)) {
          const bits = 10 + (hasUpper ? 1 : 0) + (si === 1 ? 1 : 0);
          add(i, i + w.length, bits, w.length === n ? 'common' : 'word');
        }
      });
    });
    for (let i = 0; i < n - 2;) {
      const d = L.charCodeAt(i + 1) - L.charCodeAt(i);
      if (Math.abs(d) !== 1 || !isAlnum(L[i])) { i++; continue; }
      let j = i + 1;
      while (j + 1 < n && L.charCodeAt(j + 1) - L.charCodeAt(j) === d && isAlnum(L[j + 1])) j++;
      if (j - i + 1 >= 3) add(i, j + 1, 6 + lg(j - i + 1), 'sequence');
      i = j;
    }
    ROWS.forEach((row) => [row, row.split('').reverse().join('')].forEach((r) => {
      for (let k = 0; k + 4 <= r.length; k++) for (let len = r.length - k; len >= 4; len--) {
        const sub = r.substr(k, len);
        for (let i = L.indexOf(sub); i !== -1; i = L.indexOf(sub, i + 1)) add(i, i + len, 7 + lg(len), 'keyboard');
      }
    }));
    for (let i = 0; i < n;) {
      let j = i;
      while (j + 1 < n && L[j + 1] === L[i]) j++;
      if (j - i + 1 >= 3) add(i, j + 1, 5 + lg(j - i + 1), 'repeat');
      i = j + 1;
    }
    for (let b = 2; b <= n / 2; b++) {
      if (n % b === 0 && L.slice(0, b).repeat(n / b) === L) { add(0, n, b * perChar + lg(n / b), 'repeat'); break; }
    }
    for (let i = 0; i + 4 <= n; i++) {
      const s = L.substr(i, 4);
      if ((s.startsWith('19') || s.startsWith('20')) && s.split('').every(isDigit)) add(i, i + 4, 7, 'year');
    }

    segs.sort((a, b) => (b.j - b.i) - (a.j - a.i) || a.bits - b.bits);
    const covered = new Array(n).fill(false), picked = [];
    segs.forEach((s) => {
      for (let k = s.i; k < s.j; k++) if (covered[k]) return;
      for (let k = s.i; k < s.j; k++) covered[k] = true;
      picked.push(s);
    });

    // Letter runs that look like a pronounceable word cost about 14 bits, not 4.7 bits per letter.
    for (let i = 0; i < n;) {
      if (covered[i] || !isLetter(low[i])) { i++; continue; }
      let j = i + 1;
      while (j < n && !covered[j] && isLetter(low[j]) && !(chars[j] !== low[j] && chars[j - 1] === low[j - 1])) j++;
      const len = j - i, vowels = low.slice(i, j).filter((c) => 'aeiou'.includes(c)).length;
      if (len >= 4 && len <= 10 && vowels / len >= 0.25 && vowels / len <= 0.6) {
        for (let k = i; k < j; k++) covered[k] = true;
        picked.push({ i, j, bits: 14, kind: 'wordlike' });
      }
      i = j;
    }

    let bits = picked.reduce((s, x) => s + x.bits, 0);
    covered.forEach((c) => { if (!c) bits += perChar; });
    bits = Math.max(bits, 1);
    const kinds = new Set(picked.map((s) => s.kind));
    let level = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
    if (kinds.has('common')) level = 0;
    return { n, bits, level, kinds, types: p.types, unique: new Set(chars).size };
  }

  function plural(v, w) { return v + ' ' + w + (v === 1 ? '' : 's'); }
  function span(bits, rate) {
    const s = Math.pow(2, bits - 1) / rate;
    if (s < 1) return 'less than a second';
    if (s < 60) return plural(Math.round(s), 'second');
    if (s < 3600) return plural(Math.round(s / 60), 'minute');
    if (s < 86400) return plural(Math.round(s / 3600), 'hour');
    const y = s / 31536000;
    if (y < 1) return plural(Math.round(s / 86400), 'day');
    if (y < 1000) return plural(Math.round(y), 'year');
    if (y < 1e6) return Math.round(y / 1e3) + ' thousand years';
    if (y < 1e9) return Math.round(y / 1e6) + ' million years';
    if (y < 1e12) return Math.round(y / 1e9) + ' billion years';
    return 'trillions of years or more';
  }

  function findings(r) {
    const f = [];
    if (r.n < 8) f.push(['bad', 'Short. Under 8 characters is quick to guess, and length matters more than anything else.']);
    else if (r.n < 12) f.push(['warn', 'A decent start, but 12 or more characters is much harder to guess.']);
    else if (r.n >= 16) f.push(['ok', 'Good length. Long passwords are hard to brute force.']);
    const used = Object.values(r.types).filter(Boolean).length;
    if (used === 1) f.push(['warn', 'Only one kind of character. Mixing types helps, but length helps more.']);
    if (r.kinds.has('common')) f.push(['bad', 'This matches a very common password. Attackers try these first.']);
    if (r.kinds.has('word')) f.push(['warn', 'Contains a common word, possibly with swaps like @ for a or 0 for o. Attackers know those tricks.']);
    if (r.kinds.has('sequence')) f.push(['warn', 'Contains a predictable sequence like abc or 123.']);
    if (r.kinds.has('keyboard')) f.push(['warn', 'Contains a keyboard pattern such as qwerty or asdf.']);
    if (r.kinds.has('repeat')) f.push(['warn', 'Repeats characters or blocks, which makes it much easier to guess.']);
    if (r.kinds.has('year')) f.push(['warn', 'Contains a year-like number. Years are among the first things guessed.']);
    if (r.n >= 8 && r.unique / r.n < 0.5) f.push(['warn', 'Many characters are reused. More variety makes guessing harder.']);
    if (!f.some((x) => x[0] !== 'ok') && r.level >= 3) f.push(['ok', 'No obvious patterns found by this checker.']);
    return f;
  }

  const TIPS = [
    'Go long. Four or more unrelated random words beat a short, complicated password.',
    'Use a different password for every account, so one leak does not become many.',
    'A password manager remembers them for you, so they can be long and random.',
    'Turn on two-factor authentication wherever it is offered.',
    'Skip names, birthdays, pet names and keyboard patterns.'
  ];

  function fill(id, text) { $(id).textContent = text; }
  function list(el, rows) {
    el.textContent = '';
    rows.forEach(([cls, text]) => { const li = document.createElement('li'); li.className = cls; li.textContent = text; el.appendChild(li); });
  }

  function render() {
    const pw = input.value;
    if (!pw) {
      meter.dataset.level = '-1'; meter.setAttribute('aria-valuenow', '0');
      verdict.textContent = 'Type something to begin.';
      ['#f-len', '#f-uniq', '#f-bits', '#f-online', '#f-offline'].forEach((id) => fill(id, '-'));
      document.querySelectorAll('#f-types span').forEach((s) => s.classList.remove('on'));
      list($('#findings'), [['info', 'Nothing to analyze yet.']]);
      list($('#tips'), TIPS.map((t) => ['tip', t]));
      return;
    }
    const r = analyze(pw);
    meter.dataset.level = String(r.level); meter.setAttribute('aria-valuenow', String(r.level));
    const text = 'Estimated strength: ' + LABELS[r.level];
    if (verdict.textContent !== text) verdict.textContent = text;
    fill('#f-len', r.n + ' characters');
    fill('#f-uniq', r.unique + ' of ' + r.n);
    fill('#f-bits', 'about ' + Math.round(r.bits) + ' bits');
    fill('#f-online', span(r.bits, 100));
    fill('#f-offline', span(r.bits, 1e10));
    document.querySelectorAll('#f-types span').forEach((s) => s.classList.toggle('on', !!r.types[s.dataset.k]));
    list($('#findings'), findings(r));
    const first = r.level <= 1 ? ['tip', 'Start by making it longer. Each extra character helps more than swapping letters for symbols.'] : null;
    list($('#tips'), (first ? [first] : []).concat(TIPS.map((t) => ['tip', t])));
  }

  input.addEventListener('input', render);
  $('#btn-clear').addEventListener('click', () => { input.value = ''; render(); input.focus(); });
  $('#btn-show').addEventListener('click', (e) => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'Hide' : 'Show';
    e.currentTarget.setAttribute('aria-pressed', String(show));
  });
  document.querySelectorAll('.demos button').forEach((b) => b.addEventListener('click', () => {
    input.value = b.dataset.v; input.type = 'text';
    $('#btn-show').textContent = 'Hide'; $('#btn-show').setAttribute('aria-pressed', 'true');
    render();
  }));
  window.addEventListener('pagehide', () => { input.value = ''; });

  const root = document.documentElement;
  try { root.dataset.theme = localStorage.getItem('passcheck-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); } catch { root.dataset.theme = 'dark'; }
  $('#btn-theme').addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('passcheck-theme', root.dataset.theme); } catch { /* theme is the only thing ever stored */ }
  });
  render();
})();
