class DateTimePicker {
  constructor({ triggerEl, onChange, initialValue = null, includeTime = true }) {
    this.triggerEl = triggerEl;
    this.onChange = onChange;
    this.includeTime = includeTime;
    this.isOpen = false;
    this.pickerEl = null;
    this._sel = null;        // { y, m, d }
    this._h = 9;
    this._min = 0;
    this._viewY = new Date().getFullYear();
    this._viewM = new Date().getMonth();
    this._textEl = null;
    this._clearBtnEl = null;

    if (initialValue) this._parse(initialValue);

    this._buildTrigger();
    this._onOutside = this._onOutside.bind(this);
  }

  /* ── Public ── */
  getValue() {
    if (!this._sel) return '';
    const { y, m, d } = this._sel;
    const ds = `${y}-${pad(m+1)}-${pad(d)}`;
    if (!this.includeTime) return ds;
    return `${ds}T${pad(this._h)}:${pad(this._min)}`;
  }

  setValue(val) {
    if (val) this._parse(val);
    else { this._sel = null; this._h = 9; this._min = 0; }
    this._refresh();
  }

  open()  { if (this.isOpen) return; this.isOpen = true;  this._render(); document.addEventListener('click', this._onOutside); }
  close() { if (!this.isOpen) return; this.isOpen = false; if (this.pickerEl) { this.pickerEl.remove(); this.pickerEl = null; } document.removeEventListener('click', this._onOutside); }

  /* ── Internal ── */
  _parse(val) {
    const str = val.includes('T') ? val : val + 'T00:00:00';
    const d = new Date(str);
    if (isNaN(d)) return;
    this._sel = { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
    this._viewY = d.getFullYear();
    this._viewM = d.getMonth();
    this._h   = d.getHours();
    this._min = d.getMinutes();
  }

  _fmt() {
    if (!this._sel) return '날짜 선택...';
    const { y, m, d } = this._sel;
    const dow = ['일','월','화','수','목','금','토'][new Date(y, m, d).getDay()];
    const yy = String(y).slice(2);
    const base = `${yy}.${pad(m+1)}.${pad(d)}(${dow})`;
    if (!this.includeTime) return base;
    const ampm = this._h < 12 ? 'AM' : 'PM';
    return `${base} ${this._h % 12 || 12}:${pad(this._min)}${ampm}`;
  }

  _buildTrigger() {
    this.triggerEl.classList.add('dtp-trigger');

    const icon = document.createElement('span');
    icon.className = 'dtp-trigger-icon';
    icon.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

    const text = document.createElement('span');
    text.className = 'dtp-trigger-text';
    text.textContent = this._fmt();
    this._textEl = text;

    const clr = document.createElement('button');
    clr.className = 'dtp-clear';
    clr.textContent = '✕';
    clr.style.display = this._sel ? '' : 'none';
    clr.addEventListener('click', e => { e.stopPropagation(); this.clear(); });
    this._clearBtnEl = clr;

    this.triggerEl.appendChild(icon);
    this.triggerEl.appendChild(text);
    this.triggerEl.appendChild(clr);

    this.triggerEl.addEventListener('click', e => { e.stopPropagation(); this.isOpen ? this.close() : this.open(); });
  }

  _refresh() {
    if (this._textEl) this._textEl.textContent = this._fmt();
    if (this._clearBtnEl) this._clearBtnEl.style.display = this._sel ? '' : 'none';
    this.triggerEl.classList.toggle('has-value', !!this._sel);
  }

  clear() {
    this._sel = null; this._h = 9; this._min = 0;
    this._refresh();
    if (this.onChange) this.onChange('');
    this.close();
  }

  _onOutside(e) {
    if (this.pickerEl && !this.pickerEl.contains(e.target) && !this.triggerEl.contains(e.target)) this.close();
  }

  _render() {
    if (this.pickerEl) this.pickerEl.remove();

    const p = document.createElement('div');
    p.className = 'dtp-picker';
    p.addEventListener('click', e => e.stopPropagation());

    p.appendChild(this._buildCal());
    if (this.includeTime) p.appendChild(this._buildTime());

    const footer = document.createElement('div');
    footer.className = 'dtp-footer';
    const clrBtn = this._btn('지우기', 'ghost', () => this.clear());
    const doneBtn = this._btn('완료', 'primary', () => { if (this.onChange) this.onChange(this.getValue()); this._refresh(); this.close(); });
    footer.appendChild(clrBtn);
    footer.appendChild(doneBtn);
    p.appendChild(footer);

    document.body.appendChild(p);
    this.pickerEl = p;

    const tr = this.triggerEl.getBoundingClientRect();
    p.style.position = 'fixed';
    p.style.zIndex = '10001';

    // On mobile (narrow viewport) use bottom-sheet regardless
    if (window.innerWidth <= 640) {
      p.style.left = '0';
      p.style.right = '0';
      p.style.bottom = '0';
      p.style.top = 'auto';
      p.style.width = '100%';
      p.style.borderRadius = '20px 20px 0 0';
      return;
    }

    // Position: initially below trigger
    p.style.top = `${tr.bottom + 4}px`;
    p.style.left = `${tr.left}px`;

    requestAnimationFrame(() => {
      const pr = p.getBoundingClientRect();
      const VW = window.innerWidth, VH = window.innerHeight;

      // Horizontal: don't overflow right edge
      if (pr.right > VW - 8) {
        p.style.left = `${Math.max(8, tr.right - pr.width)}px`;
      }
      // Vertical: if bottom overflows, try flipping above
      if (pr.bottom > VH - 8) {
        const flippedTop = tr.top - pr.height - 4;
        if (flippedTop >= 8) {
          p.style.top = `${flippedTop}px`;
        } else {
          // Neither side fits: pin to top with scroll
          p.style.top = '8px';
          p.style.maxHeight = `${VH - 16}px`;
          p.style.overflowY = 'auto';
        }
      }
    });
  }

  _btn(label, variant, cb) {
    const b = document.createElement('button');
    b.className = `dtp-btn ${variant}`;
    b.textContent = label;
    b.addEventListener('click', cb);
    return b;
  }

  /* ── Calendar ── */
  _buildCal() {
    const cal = document.createElement('div');
    cal.className = 'dtp-cal';
    cal.appendChild(this._buildNav(cal));
    cal.appendChild(this._buildGrid());
    return cal;
  }

  _buildNav(calEl) {
    const nav = document.createElement('div');
    nav.className = 'dtp-cal-nav';

    const prev = this._btn('‹', 'nav', () => {
      this._viewM--; if (this._viewM < 0) { this._viewM = 11; this._viewY--; }
      this._reGrid(calEl, nav);
    });
    const next = this._btn('›', 'nav', () => {
      this._viewM++; if (this._viewM > 11) { this._viewM = 0; this._viewY++; }
      this._reGrid(calEl, nav);
    });

    const title = document.createElement('span');
    title.className = 'dtp-cal-title';
    title.textContent = `${this._viewY}년 ${this._viewM + 1}월`;
    nav._titleEl = title;

    nav.appendChild(prev);
    nav.appendChild(title);
    nav.appendChild(next);
    return nav;
  }

  _reGrid(calEl, nav) {
    nav._titleEl.textContent = `${this._viewY}년 ${this._viewM + 1}월`;
    const old = calEl.querySelector('.dtp-grid-wrap');
    if (old) old.remove();
    calEl.appendChild(this._buildGrid());
  }

  _buildGrid() {
    const wrap = document.createElement('div');
    wrap.className = 'dtp-grid-wrap';

    const header = document.createElement('div');
    header.className = 'dtp-cal-header';
    ['일','월','화','수','목','금','토'].forEach((d, i) => {
      const c = document.createElement('div');
      c.className = 'dtp-hcell';
      c.style.color = i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : '';
      c.textContent = d;
      header.appendChild(c);
    });
    wrap.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'dtp-cal-grid';
    const first = new Date(this._viewY, this._viewM, 1).getDay();
    const total = new Date(this._viewY, this._viewM + 1, 0).getDate();
    const cells = Math.ceil((first + total) / 7) * 7;
    const today = new Date();

    for (let i = 0; i < cells; i++) {
      const n = i - first + 1;
      const btn = document.createElement('button');
      btn.className = 'dtp-cal-day';
      if (n < 1 || n > total) {
        btn.disabled = true;
        btn.classList.add('empty');
      } else {
        btn.textContent = n;
        const dow = new Date(this._viewY, this._viewM, n).getDay();
        if (dow === 0) btn.classList.add('sun');
        if (dow === 6) btn.classList.add('sat');
        if (today.getFullYear() === this._viewY && today.getMonth() === this._viewM && today.getDate() === n) btn.classList.add('today');
        if (this._sel && this._sel.y === this._viewY && this._sel.m === this._viewM && this._sel.d === n) btn.classList.add('selected');

        btn.addEventListener('click', () => {
          this._sel = { y: this._viewY, m: this._viewM, d: n };
          this._refresh();
          const cw = btn.closest('.dtp-grid-wrap');
          const cal = btn.closest('.dtp-cal');
          if (cw && cal) { cw.remove(); cal.appendChild(this._buildGrid()); }
          if (!this.includeTime) { if (this.onChange) this.onChange(this.getValue()); this._refresh(); this.close(); }
        });
      }
      grid.appendChild(btn);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  /* ── Time ── */
  _buildTime() {
    const el = document.createElement('div');
    el.className = 'dtp-time';

    const label = document.createElement('div');
    label.className = 'dtp-time-label';
    label.textContent = '시간 설정';
    el.appendChild(label);

    const drums = document.createElement('div');
    drums.className = 'dtp-drums';
    drums.appendChild(this._drum(0, 23, this._h,   v => { this._h   = v; this._refresh(); }));
    const sep = document.createElement('div');
    sep.className = 'dtp-colon';
    sep.textContent = ':';
    drums.appendChild(sep);
    drums.appendChild(this._drum(0, 59, this._min, v => { this._min = v; this._refresh(); }));
    el.appendChild(drums);
    return el;
  }

  _drum(min, max, init, cb) {
    const col = document.createElement('div');
    col.className = 'dtp-drum';

    let val = init;
    const range = max - min + 1;

    const wrap = v => ((v - min) % range + range) % range + min;

    const list = document.createElement('div');
    list.className = 'dtp-drum-list';

    const render = () => {
      list.innerHTML = '';
      for (let off = -1; off <= 1; off++) {
        const v = wrap(val + off);
        const item = document.createElement('div');
        item.className = 'dtp-drum-item' + (off === 0 ? ' active' : '');
        item.textContent = pad(v);
        if (off !== 0) item.addEventListener('click', () => { val = wrap(val + off); render(); cb(val); });
        list.appendChild(item);
      }
    };

    const step = dir => { val = wrap(val + dir); render(); cb(val); };

    const up = this._btn('▲', 'drum-arrow', () => step(-1));
    const down = this._btn('▼', 'drum-arrow', () => step(1));

    const vp = document.createElement('div');
    vp.className = 'dtp-drum-vp';
    vp.addEventListener('wheel', e => { e.preventDefault(); step(e.deltaY > 0 ? 1 : -1); }, { passive: false });

    render();
    vp.appendChild(list);
    col.appendChild(up);
    col.appendChild(vp);
    col.appendChild(down);
    return col;
  }
}

function pad(n) { return String(n).padStart(2, '0'); }
