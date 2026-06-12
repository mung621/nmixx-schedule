const RECENT_KEY = 'ep-recently-used';
const RECENT_MAX = 16;

function getRecentEmojis() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function saveRecentEmoji(emoji) {
  let recent = getRecentEmojis().filter(e => e !== emoji);
  recent.unshift(emoji);
  if (recent.length > RECENT_MAX) recent = recent.slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

class EmojiPicker {
  constructor({ triggerEl, onSelect, initialEmoji = null, size = 'normal' }) {
    this.triggerEl = triggerEl;
    this.onSelect = onSelect;
    this.currentEmoji = initialEmoji;
    this.size = size;
    this.activeTab = 'emoji';
    this.searchQuery = '';
    this.pickerEl = null;
    this.isOpen = false;
    this._activeCategoryEl = null;

    this._buildTrigger();
    this._handleOutsideClick = this._handleOutsideClick.bind(this);
  }

  _buildTrigger() {
    this.triggerEl.classList.add('emoji-trigger-btn');
    if (this.size === 'large') this.triggerEl.classList.add('emoji-trigger-btn--large');
    if (this.currentEmoji) {
      this.triggerEl.textContent = this.currentEmoji;
      this.triggerEl.classList.add('has-emoji');
    } else {
      this.triggerEl.innerHTML = `<span class="ep-plus-icon">+</span>`;
    }
    this.triggerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isOpen ? this.close() : this.open();
    });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this._render();
    document.addEventListener('click', this._handleOutsideClick);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.pickerEl) { this.pickerEl.remove(); this.pickerEl = null; }
    document.removeEventListener('click', this._handleOutsideClick);
  }

  _handleOutsideClick(e) {
    if (this.pickerEl && !this.pickerEl.contains(e.target) && e.target !== this.triggerEl) {
      this.close();
    }
  }

  _render() {
    if (this.pickerEl) this.pickerEl.remove();

    const picker = document.createElement('div');
    picker.className = 'emoji-picker';
    picker.addEventListener('click', e => e.stopPropagation());

    // ── Tabs ──
    const tabs = document.createElement('div');
    tabs.className = 'ep-tabs';
    [{ id: 'emoji', label: '😊 이모지' }, { id: 'remove', label: '🗑 제거' }].forEach(({ id, label }) => {
      const btn = document.createElement('button');
      btn.className = 'ep-tab' + (this.activeTab === id ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => { this.activeTab = id; this._render(); });
      tabs.appendChild(btn);
    });
    picker.appendChild(tabs);

    if (this.activeTab === 'emoji') {
      // ── Search row ──
      const searchRow = document.createElement('div');
      searchRow.className = 'ep-search-row';

      const searchInput = document.createElement('input');
      searchInput.className = 'ep-search';
      searchInput.type = 'text';
      searchInput.placeholder = '이모지 검색...';
      searchInput.value = this.searchQuery;

      const randomBtn = document.createElement('button');
      randomBtn.className = 'ep-random-btn';
      randomBtn.title = '랜덤 이모지';
      randomBtn.textContent = '🔀';
      randomBtn.addEventListener('click', () => {
        const all = Object.values(EMOJI_DATA).flat();
        this._selectEmoji(all[Math.floor(Math.random() * all.length)]);
      });

      searchRow.appendChild(searchInput);
      searchRow.appendChild(randomBtn);
      picker.appendChild(searchRow);

      // ── Category nav bar ──
      const navBar = document.createElement('div');
      navBar.className = 'ep-cat-nav';
      const body = document.createElement('div');
      body.className = 'ep-body';

      const navItems = Object.entries(CATEGORY_ICONS);
      navItems.forEach(([cat, icon], idx) => {
        const navBtn = document.createElement('button');
        navBtn.className = 'ep-cat-nav-btn' + (idx === 0 ? ' active' : '');
        navBtn.textContent = icon;
        navBtn.title = cat;
        navBtn.addEventListener('click', () => {
          navBar.querySelectorAll('.ep-cat-nav-btn').forEach(b => b.classList.remove('active'));
          navBtn.classList.add('active');
          const target = body.querySelector(`[data-category="${CSS.escape(cat)}"]`);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        navBar.appendChild(navBtn);
      });
      picker.appendChild(navBar);

      // ── Body ──
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this._renderBody(body);
      });
      this._renderBody(body);
      picker.appendChild(body);

      // Sync nav on scroll
      body.addEventListener('scroll', () => {
        const sections = body.querySelectorAll('[data-category]');
        let active = null;
        sections.forEach(s => {
          if (s.offsetTop - body.scrollTop <= 30) active = s;
        });
        if (active) {
          const cat = active.dataset.category;
          navBar.querySelectorAll('.ep-cat-nav-btn').forEach((b, i) => {
            b.classList.toggle('active', navItems[i]?.[0] === cat);
          });
        }
      });

      setTimeout(() => searchInput.focus(), 50);
    } else if (this.activeTab === 'remove') {
      const removeBody = document.createElement('div');
      removeBody.className = 'ep-remove-tab-body';
      const icon = document.createElement('div');
      icon.className = 'ep-remove-icon';
      icon.textContent = this.currentEmoji || '😶';
      const msg = document.createElement('div');
      msg.style.fontSize = '13px';
      msg.textContent = this.currentEmoji ? '현재 이모지를 제거할까요?' : '설정된 이모지가 없습니다.';
      removeBody.appendChild(icon);
      removeBody.appendChild(msg);
      if (this.currentEmoji) {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'ep-remove-confirm-btn';
        confirmBtn.textContent = '이모지 제거';
        confirmBtn.addEventListener('click', () => this._selectEmoji(null));
        removeBody.appendChild(confirmBtn);
      }
      picker.appendChild(removeBody);
    }

    const wrapper = this.triggerEl.closest('.emoji-picker-wrapper') || this.triggerEl.parentElement;
    wrapper.appendChild(picker);
    this.pickerEl = picker;

    // Position: check right overflow
    requestAnimationFrame(() => {
      const rect = picker.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) { picker.style.left = 'auto'; picker.style.right = '0'; }
      if (rect.bottom > window.innerHeight - 8) { picker.style.top = 'auto'; picker.style.bottom = 'calc(100% + 6px)'; }
    });
  }

  _renderBody(body) {
    body.innerHTML = '';
    const query = this.searchQuery.trim().toLowerCase();

    if (query) {
      const allEmojis = Object.values(EMOJI_DATA).flat();
      const filtered = allEmojis.filter(e => e.includes(query));
      if (filtered.length === 0) {
        const noResult = document.createElement('div');
        noResult.className = 'ep-no-result';
        noResult.textContent = '검색 결과가 없습니다.';
        body.appendChild(noResult);
        return;
      }
      body.appendChild(this._buildGrid(filtered));
      return;
    }

    // Recently used
    const recent = getRecentEmojis();
    if (recent.length > 0) {
      const title = document.createElement('div');
      title.className = 'ep-category-title';
      title.dataset.category = '최근 사용';
      title.textContent = '최근 사용';
      body.appendChild(title);
      body.appendChild(this._buildGrid(recent));
    }

    // Regular categories
    Object.entries(EMOJI_DATA).forEach(([category, emojis]) => {
      const title = document.createElement('div');
      title.className = 'ep-category-title';
      title.dataset.category = category;
      title.textContent = category;
      body.appendChild(title);
      body.appendChild(this._buildGrid(emojis));
    });
  }

  _buildGrid(emojis) {
    const grid = document.createElement('div');
    grid.className = 'ep-grid';
    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'ep-emoji-btn' + (emoji === this.currentEmoji ? ' selected' : '');
      btn.textContent = emoji;
      btn.type = 'button';
      btn.tabIndex = -1; // 포커스 시 자동 스크롤 방지

      // ── 마우스: mousedown에서 포커스(=자동 스크롤) 차단, click에서 선택 ──
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._selectEmoji(emoji);
      });

      // ── 터치: 이동 거리(8px) 기준으로 탭 vs 스크롤 판별 ──
      let tx = 0, ty = 0;
      btn.addEventListener('touchstart', e => {
        tx = e.touches[0].clientX;
        ty = e.touches[0].clientY;
      }, { passive: true });
      btn.addEventListener('touchend', e => {
        const dx = Math.abs(e.changedTouches[0].clientX - tx);
        const dy = Math.abs(e.changedTouches[0].clientY - ty);
        if (dx < 8 && dy < 8) {           // 탭 (스크롤 아님)
          e.preventDefault();              // 합성 click 이벤트 방지
          e.stopPropagation();
          this._selectEmoji(emoji);
        }
      }, { passive: false });

      grid.appendChild(btn);
    });
    return grid;
  }

  _selectEmoji(emoji) {
    this.currentEmoji = emoji;
    if (emoji) {
      this.triggerEl.textContent = emoji;
      this.triggerEl.classList.add('has-emoji');
      saveRecentEmoji(emoji);
    } else {
      this.triggerEl.innerHTML = `<span class="ep-plus-icon">+</span>`;
      this.triggerEl.classList.remove('has-emoji');
    }
    if (this.onSelect) this.onSelect(emoji);
    this.close();
  }

  setEmoji(emoji) {
    this.currentEmoji = emoji;
    if (emoji) {
      this.triggerEl.textContent = emoji;
      this.triggerEl.classList.add('has-emoji');
    } else {
      this.triggerEl.innerHTML = `<span class="ep-plus-icon">+</span>`;
      this.triggerEl.classList.remove('has-emoji');
    }
  }
}
