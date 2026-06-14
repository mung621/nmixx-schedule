const STORAGE_KEY = 'kpop-schedules';

let state = {
  events: [],
  dataProjects: [],
  view: 'calendar',
  calendarYear:  new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  selectedEventId: null,
  selectedProjectId: null,
  selectedVendorId: null,
  listSelection: [],   // IDs selected in list view for bulk delete
  labels: {
    vendor:    ['멬스', '사웨', '애플', '케이몬스터'],
    country:   ['국내', '가오슝', '홍콩', '도쿄', '광저우', '상하이'],
    albumType: ['일반반', '한정반', '플랫폼'],
    eventType: ['특전', '밋앤콜', '단체 영통', '개인 영통']
  },
  filters: {
    hiddenVendors:    [],
    hiddenCountries:  [],
    hiddenAlbumTypes: [],
    hiddenEventTypes: [],
    dateSort: 'asc',
    showSalePeriod: true,
    showEventDate:  true,
    open: { vendor: false, country: false, albumType: false, eventType: false }
  },
  // 목록 뷰 전용 필터 (사이드바 필터와 독립)
  listFilters: {
    hiddenVendors:    [],
    hiddenCountries:  [],
    hiddenAlbumTypes: [],
    hiddenEventTypes: [],
    dateSort: 'asc'
  }
};

// ── Persistence ──
function saveState() {
  const syncData = { events: state.events, labels: state.labels, dataProjects: state.dataProjects || [] };
  const FKEYS = ['hiddenVendors','hiddenCountries','hiddenAlbumTypes','hiddenEventTypes'];
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...syncData,
    filters:     { ...Object.fromEntries(FKEYS.map(k=>[k,state.filters[k]])),     dateSort: state.filters.dateSort },
    listFilters: { ...Object.fromEntries(FKEYS.map(k=>[k,state.listFilters[k]])), dateSort: state.listFilters.dateSort }
  }));
  if (typeof syncSave === 'function') syncSave(syncData);
}

function loadState() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!p) return;
    if (p.events) state.events = p.events;
    if (p.labels) Object.keys(p.labels).forEach(k => { if (state.labels[k]) state.labels[k] = p.labels[k]; });
    if (p.dataProjects) state.dataProjects = p.dataProjects;
    const FKEYS = ['hiddenVendors','hiddenCountries','hiddenAlbumTypes','hiddenEventTypes'];
    if (p.filters) {
      FKEYS.forEach(k => { if (Array.isArray(p.filters[k])) state.filters[k] = p.filters[k]; });
      if (p.filters.dateSort) state.filters.dateSort = p.filters.dateSort;
    }
    if (p.listFilters) {
      FKEYS.forEach(k => { if (Array.isArray(p.listFilters[k])) state.listFilters[k] = p.listFilters[k]; });
      if (p.listFilters.dateSort) state.listFilters.dateSort = p.listFilters.dateSort;
    }
  } catch(e) {}
}

function genId() { return 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// ── Color maps ──
const VENDOR_COLORS = {
  '멬스':       { bg:'#fef3c7', color:'#92400e', border:'#fde68a' },
  '사웨':       { bg:'#dbeafe', color:'#1e40af', border:'#93c5fd' },
  '애플':       { bg:'#f3f4f6', color:'#374151', border:'#d1d5db' },
  '케이몬스터':  { bg:'#fce7f3', color:'#9d174d', border:'#fbcfe8' }
};
const COUNTRY_COLORS = {
  '국내':  { bg:'#dcfce7', color:'#166534', border:'#86efac' },
  '가오슝': { bg:'#fef9c3', color:'#713f12', border:'#fef08a' },
  '홍콩':  { bg:'#fee2e2', color:'#991b1b', border:'#fca5a5' },
  '도쿄':  { bg:'#ede9fe', color:'#5b21b6', border:'#c4b5fd' },
  '광저우': { bg:'#e0f2fe', color:'#075985', border:'#bae6fd' },
  '상하이': { bg:'#f0fdf4', color:'#166534', border:'#86efac' }
};
const ALBUM_COLORS = {
  '일반반': { bg:'#f3f4f6', color:'#374151', border:'#d1d5db' },
  '한정반': { bg:'#fef9c3', color:'#713f12', border:'#fef08a' },
  '플랫폼': { bg:'#e0f2fe', color:'#075985', border:'#bae6fd' }
};
const EVENT_TYPE_COLORS = {
  '특전':     { bg:'#fce7f3', color:'#9d174d', border:'#fbcfe8' },
  '밋앤콜':   { bg:'#ede9fe', color:'#5b21b6', border:'#c4b5fd' },
  '단체 영통': { bg:'#dcfce7', color:'#166534', border:'#86efac' },
  '개인 영통': { bg:'#fff7ed', color:'#9a3412', border:'#fed7aa' }
};
const PALETTE = [
  { bg:'#f0fdf4', color:'#166534', border:'#86efac' },
  { bg:'#eff6ff', color:'#1e40af', border:'#93c5fd' },
  { bg:'#fdf4ff', color:'#6b21a8', border:'#d8b4fe' },
  { bg:'#fff7ed', color:'#9a3412', border:'#fed7aa' },
  { bg:'#f0f9ff', color:'#075985', border:'#bae6fd' }
];
let _pi = 0;
function getColor(map, key) {
  if (!key) return PALETTE[0];
  if (map[key]) return map[key];
  const c = PALETTE[_pi++ % PALETTE.length];
  map[key] = c;
  return c;
}
function chipHtml(text, cmap) {
  const c = getColor(cmap, text);
  return `<span class="chip" style="background:${c.bg};color:${c.color};border:1.5px solid ${c.border}">${text}</span>`;
}

// ── Filter ──
const FM = {
  vendor:    { key:'hiddenVendors',    colors: VENDOR_COLORS },
  country:   { key:'hiddenCountries',  colors: COUNTRY_COLORS },
  albumType: { key:'hiddenAlbumTypes', colors: ALBUM_COLORS },
  eventType: { key:'hiddenEventTypes', colors: EVENT_TYPE_COLORS }
};

// 달력/목록 뷰에 적용되는 라벨 필터 (이벤트 기간/날짜 표시 여부는 별도)
function getFilteredEvents() {
  let evs = state.events.filter(ev => {
    if (ev.vendor    && state.filters.hiddenVendors.includes(ev.vendor))        return false;
    if (ev.country   && state.filters.hiddenCountries.includes(ev.country))     return false;
    if (ev.albumType && state.filters.hiddenAlbumTypes.includes(ev.albumType))  return false;
    if (ev.eventType && state.filters.hiddenEventTypes.includes(ev.eventType))  return false;
    return true;
  });
  return _sortEvents(evs);
}

// 사이드바 이벤트 목록: 필터 미적용, 정렬만
function getSidebarEvents() {
  return _sortEvents([...state.events]);
}

function _sortEvents(evs) {
  return evs.sort((a, b) => {
    const ad = a.saleStart || a.eventDate || '', bd = b.saleStart || b.eventDate || '';
    return state.filters.dateSort === 'desc' ? (bd < ad ? -1 : bd > ad ? 1 : 0) : (ad < bd ? -1 : ad > bd ? 1 : 0);
  });
}

function isFilterActive() {
  return ['hiddenVendors','hiddenCountries','hiddenAlbumTypes','hiddenEventTypes'].some(k => state.filters[k].length > 0)
    || !state.filters.showSalePeriod
    || !state.filters.showEventDate;
}

function toggleFilterItem(type, value) {
  const arr = state.filters[FM[type].key];
  const i = arr.indexOf(value);
  if (i === -1) arr.push(value); else arr.splice(i, 1);
  saveState(); renderSidebar(); renderContent();
}

function toggleAllFilter(type) {
  const key = FM[type].key;
  state.filters[key] = state.filters[key].length === 0 ? [...state.labels[type]] : [];
  saveState(); renderSidebar(); renderContent();
}

function resetFilters() {
  ['hiddenVendors','hiddenCountries','hiddenAlbumTypes','hiddenEventTypes'].forEach(k => state.filters[k] = []);
  state.filters.dateSort        = 'asc';
  state.filters.showSalePeriod  = true;
  state.filters.showEventDate   = true;
  saveState(); renderSidebar(); renderContent();
}

// ── 사이드바 필터 (캘린더 적용) ──
function setDateSort(d)          { state.filters.dateSort = d;                     saveState(); renderSidebar(); renderContent(); }
function toggleShowSalePeriod(cb){ state.filters.showSalePeriod = cb.checked;       saveState(); renderSidebar(); renderContent(); }
function toggleShowEventDate(cb) { state.filters.showEventDate  = cb.checked;       saveState(); renderSidebar(); renderContent(); }
function toggleFilterGroup(t)    { state.filters.open[t] = !state.filters.open[t]; renderSidebar(); }

// ── 목록 전용 필터 (사이드바와 독립) ──
function getListFilteredEvents() {
  let evs = state.events.filter(ev => {
    if (ev.vendor    && state.listFilters.hiddenVendors.includes(ev.vendor))        return false;
    if (ev.country   && state.listFilters.hiddenCountries.includes(ev.country))     return false;
    if (ev.albumType && state.listFilters.hiddenAlbumTypes.includes(ev.albumType))  return false;
    if (ev.eventType && state.listFilters.hiddenEventTypes.includes(ev.eventType))  return false;
    return true;
  });
  return evs.sort((a, b) => {
    const ad = a.saleStart||a.eventDate||'', bd = b.saleStart||b.eventDate||'';
    return state.listFilters.dateSort === 'desc' ? (bd<ad?-1:bd>ad?1:0) : (ad<bd?-1:ad>bd?1:0);
  });
}

function isListFilterActive() {
  return ['hiddenVendors','hiddenCountries','hiddenAlbumTypes','hiddenEventTypes'].some(k => state.listFilters[k].length > 0);
}

function toggleListFilterItem(type, value) {
  const key = FM[type].key;
  const arr = state.listFilters[key];
  const i = arr.indexOf(value);
  if (i === -1) arr.push(value); else arr.splice(i, 1);
  saveState(); renderContent();
}

function resetListFilters() {
  ['hiddenVendors','hiddenCountries','hiddenAlbumTypes','hiddenEventTypes'].forEach(k => state.listFilters[k] = []);
  state.listFilters.dateSort = 'asc';
  saveState(); renderContent();
}

function setListDateSort(d) { state.listFilters.dateSort = d; saveState(); renderContent(); }

// ── Debounce ──
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ── Date formatting ──
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseDateStr(str) {
  if (!str) return null;
  return new Date(str.includes('T') ? str : str + 'T00:00:00');
}

function formatDateKr(str) {
  const d = parseDateStr(str);
  if (!d || isNaN(d)) return '-';
  const dow = ['일','월','화','수','목','금','토'][d.getDay()];
  const yy = String(d.getFullYear()).slice(2);
  const base = `${yy}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}(${dow})`;
  if (!str.includes('T')) return base;
  const h = d.getHours(), ampm = h < 12 ? 'AM' : 'PM', h12 = h % 12 || 12;
  return `${base} ${h12}:${String(d.getMinutes()).padStart(2,'0')}${ampm}`;
}

function formatDateTimeKr(str) {
  const d = parseDateStr(str);
  if (!d || isNaN(d)) return '-';
  const dow = ['일','월','화','수','목','금','토'][d.getDay()];
  const h = d.getHours(), ampm = h < 12 ? 'AM' : 'PM', h12 = h % 12 || 12;
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}(${dow}) ${h12}:${String(d.getMinutes()).padStart(2,'0')}${ampm}`;
}

function formatSidebarDate(ev) {
  const str = ev.eventDate;
  if (!str) return '';
  const d = parseDateStr(str);
  if (!d || isNaN(d)) return '';
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  if (!str.includes('T')) return `${yy}.${mm}.${dd}`;
  const h = d.getHours(), ampm = h < 12 ? 'AM' : 'PM', h12 = h % 12 || 12;
  return `${yy}.${mm}.${dd} ${h12}:${String(d.getMinutes()).padStart(2,'0')}${ampm}`;
}

// ── Render ──
function render() { renderSidebar(); renderContent(); }

// ── Sidebar ──
function renderSidebar() {
  const sb = document.getElementById('sidebar');
  sb.innerHTML = '';

  // Filter panel
  const fp = document.createElement('div');
  fp.className = 'filter-panel';

  const fph = document.createElement('div');
  fph.className = 'filter-panel-header';
  const active = isFilterActive();
  fph.innerHTML = `
    <span class="filter-panel-title">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M1 3h14M3 8h10M6 13h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      필터 ${active ? '<span class="filter-active-dot"></span>' : ''}
    </span>
    <button class="filter-reset-btn ${active ? 'visible' : ''}" onclick="resetFilters()">초기화</button>
  `;
  fp.appendChild(fph);

  const GROUP_LABELS = { vendor:'판매처', country:'국가', albumType:'판매 앨범', eventType:'이벤트 형태' };
  Object.entries(GROUP_LABELS).forEach(([type, title]) => {
    const { key, colors } = FM[type];
    const hidden = state.filters[key];
    const labels = state.labels[type];
    const isOpen = state.filters.open[type];

    const grp = document.createElement('div');
    grp.className = 'filter-group';

    const gh = document.createElement('div');
    gh.className = 'filter-group-header';
    gh.innerHTML = `
      <span class="filter-group-title">${title}</span>
      <span class="filter-group-right">
        ${hidden.length > 0 ? `<span class="filter-hidden-badge">${hidden.length} 숨김</span>` : ''}
        <span class="filter-arrow ${isOpen ? 'open' : ''}">${isOpen ? '▾' : '▸'}</span>
      </span>
    `;
    gh.addEventListener('click', () => toggleFilterGroup(type));
    grp.appendChild(gh);

    if (isOpen) {
      const gb = document.createElement('div');
      gb.className = 'filter-group-body';

      const masterRow = document.createElement('label');
      masterRow.className = 'filter-check-row master';
      const mcb = document.createElement('input');
      mcb.type = 'checkbox';
      mcb.className = 'filter-cb';
      mcb.checked = hidden.length === 0;
      mcb.indeterminate = hidden.length > 0 && hidden.length < labels.length;
      mcb.addEventListener('change', () => toggleAllFilter(type));
      masterRow.appendChild(mcb);
      const ms = document.createElement('span');
      ms.className = 'filter-check-label-all';
      ms.textContent = '전체 보기';
      masterRow.appendChild(ms);
      gb.appendChild(masterRow);

      labels.forEach(label => {
        const isHidden = hidden.includes(label);
        const c = getColor(colors, label);
        const row = document.createElement('label');
        row.className = 'filter-check-row' + (isHidden ? ' faded' : '');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'filter-cb';
        cb.checked = !isHidden;
        cb.addEventListener('change', () => toggleFilterItem(type, label));
        const chip = document.createElement('span');
        chip.className = 'chip filter-chip';
        chip.style.cssText = `background:${c.bg};color:${c.color};border:1.5px solid ${c.border}`;
        chip.textContent = label;
        row.appendChild(cb);
        row.appendChild(chip);
        gb.appendChild(row);
      });
      grp.appendChild(gb);
    }
    fp.appendChild(grp);
  });

  // ── 이벤트 기간 / 이벤트 날짜 보기/숨기기 ──
  const visGrp = document.createElement('div');
  visGrp.className = 'filter-group filter-sort-group';
  visGrp.innerHTML = `
    <div class="filter-group-header no-arrow">
      <span class="filter-group-title">표시 설정</span>
    </div>
    <div class="filter-group-body" style="padding-top:4px">
      <label class="filter-check-row ${!state.filters.showSalePeriod ? 'faded' : ''}">
        <input type="checkbox" class="filter-cb" id="cb-sale-period"
               ${state.filters.showSalePeriod ? 'checked' : ''}
               onchange="toggleShowSalePeriod(this)">
        <span class="filter-vis-label">🗓 이벤트 기간</span>
      </label>
      <label class="filter-check-row ${!state.filters.showEventDate ? 'faded' : ''}">
        <input type="checkbox" class="filter-cb" id="cb-event-date"
               ${state.filters.showEventDate ? 'checked' : ''}
               onchange="toggleShowEventDate(this)">
        <span class="filter-vis-label">⭐ 이벤트 날짜</span>
      </label>
    </div>
  `;
  fp.appendChild(visGrp);

  // Sort
  const sortGrp = document.createElement('div');
  sortGrp.className = 'filter-group filter-sort-group';
  sortGrp.innerHTML = `
    <div class="filter-group-header no-arrow"><span class="filter-group-title">이벤트 날짜</span></div>
    <div class="filter-sort-btns">
      <button class="sort-btn ${state.filters.dateSort==='asc'?'active':''}" onclick="setDateSort('asc')">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M4 7l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>오래된순
      </button>
      <button class="sort-btn ${state.filters.dateSort==='desc'?'active':''}" onclick="setDateSort('desc')">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>최근순
      </button>
    </div>
  `;
  fp.appendChild(sortGrp);
  sb.appendChild(fp);

  // Event list
  const ls = document.createElement('div');
  ls.className = 'sidebar-list-section';

  const sidebarEvs = getSidebarEvents();   // 필터 미적용, 전체 목록
  const lh = document.createElement('div');
  lh.className = 'sidebar-list-header';
  lh.innerHTML = `<span class="sidebar-title">이벤트 목록</span><span class="sidebar-count-badge">${sidebarEvs.length}</span>`;
  ls.appendChild(lh);

  const listEl = document.createElement('div');
  listEl.className = 'event-list';
  listEl.id = 'event-list';

  if (sidebarEvs.length === 0) {
    listEl.innerHTML = `<div style="padding:24px 16px;text-align:center;color:#9ca3af;font-size:12px;line-height:1.6">이벤트가 없습니다</div>`;
  } else {
    sidebarEvs.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'event-item' + (ev.id === state.selectedEventId ? ' active' : '');
      const dateStr = formatSidebarDate(ev);
      item.innerHTML = `
        <div class="event-item-header">
          <span class="event-item-emoji">${ev.emoji || '📅'}</span>
          <div class="event-item-info">
            <span class="event-item-name">${ev.name || '(이름 없음)'}</span>
            ${dateStr ? `<span class="event-item-date">${dateStr}</span>` : ''}
          </div>
        </div>
        <div class="event-item-meta">
          ${ev.vendor    ? chipHtml(ev.vendor,    VENDOR_COLORS)     : ''}
          ${ev.country   ? chipHtml(ev.country,   COUNTRY_COLORS)    : ''}
          ${ev.eventType ? chipHtml(ev.eventType, EVENT_TYPE_COLORS) : ''}
        </div>
      `;
      item.addEventListener('click', () => { state.selectedEventId = ev.id; renderSidebar(); renderDetailPanel(ev.id); closeSidebarOnMobile(); });
      listEl.appendChild(item);
    });
  }

  ls.appendChild(listEl);
  sb.appendChild(ls);
}

// ── Content ──
function renderContent() {
  const content = document.getElementById('main-content');
  const tabs = `
    <div class="view-tabs">
      <button class="view-tab ${state.view==='calendar'?'active':''}" onclick="setView('calendar')">📅 캘린더</button>
      <button class="view-tab ${state.view==='list'?'active':''}" onclick="setView('list')">📋 목록</button>
      <button class="view-tab ${state.view==='data'?'active':''}" onclick="setView('data')">📊 데이터</button>
    </div>
  `;
  content.innerHTML = tabs + (state.view === 'calendar' ? renderCalendarHtml() : state.view === 'list' ? renderListHtml() : renderDataHtml());
}

function setView(v) {
  if (state.view !== v) { state.listSelection = []; }
  state.view = v;
  renderContent();
}

// ── Calendar ──
const DAY_NAMES   = ['일','월','화','수','목','금','토'];
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function renderCalendarHtml() {
  const { calendarYear: y, calendarMonth: m } = state;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const today = new Date();
  const filtered = getFilteredEvents();

  let html = `
    <div class="calendar-nav">
      <div class="calendar-nav-title">${y}년 ${MONTH_NAMES[m]}</div>
      <div class="calendar-nav-btns">
        <button class="btn btn-secondary btn-sm btn-icon" onclick="moveMonth(-1)">‹</button>
        <button class="btn btn-secondary btn-sm" onclick="goToday()">오늘</button>
        <button class="btn btn-secondary btn-sm btn-icon" onclick="moveMonth(1)">›</button>
      </div>
    </div>
    <div class="calendar-grid">
  `;

  DAY_NAMES.forEach((d, i) => {
    html += `<div class="calendar-header-cell" style="${i===0?'color:#ef4444':i===6?'color:#3b82f6':''}">${d}</div>`;
  });

  const cells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  for (let i = 0; i < cells; i++) {
    const n = i - firstDay + 1;
    const isTM = n >= 1 && n <= daysInMonth;
    const date = new Date(y, m, n);
    const ds = formatDate(date);
    const dow = date.getDay();
    const isToday = isTM && today.getFullYear()===y && today.getMonth()===m && today.getDate()===n;
    const dowCls = dow===0?'sun':dow===6?'sat':'';

    const saleEvs  = isTM ? filtered.filter(ev => { if (!ev.saleStart) return false; const s=ev.saleStart.split('T')[0]; const e=ev.saleEnd?ev.saleEnd.split('T')[0]:s; return ds>=s&&ds<=e; }) : [];
    const eventEvs = isTM ? filtered.filter(ev => ev.eventDate && ev.eventDate.split('T')[0] === ds) : [];

    html += `<div class="calendar-day ${!isTM?'other-month':''} ${isToday?'today':''} ${dowCls}">`;
    html += `<div class="day-number">${isTM?n:''}</div><div class="day-events">`;

    // 이벤트 기간 표시 여부
    if (state.filters.showSalePeriod) {
      saleEvs.slice(0,3).forEach(ev => {
        const c = getColor(VENDOR_COLORS, ev.vendor||'');
        html += `<div class="day-event-pill" style="background:${c.bg};color:${c.color}" onclick="selectEvent('${ev.id}')">
          <span class="day-event-emoji">${ev.emoji||'📅'}</span><span class="day-event-name">${ev.name||''}</span>
        </div>`;
      });
    }
    // 이벤트 날짜 표시 여부
    if (state.filters.showEventDate) {
      eventEvs.forEach(ev => {
        const c = getColor(EVENT_TYPE_COLORS, ev.eventType||'');
        html += `<div class="day-event-pill event-date-pill" style="background:${c.bg};color:${c.color}" onclick="selectEvent('${ev.id}')">
          <span class="day-event-emoji">${ev.emoji||'⭐'}</span><span class="day-event-name">${ev.name||''}</span>
        </div>`;
      });
    }

    html += `</div></div>`;
  }
  return html + '</div>';
}

function moveMonth(d) {
  state.calendarMonth += d;
  if (state.calendarMonth < 0)  { state.calendarMonth=11; state.calendarYear--; }
  if (state.calendarMonth > 11) { state.calendarMonth=0;  state.calendarYear++; }
  renderContent();
}
function goToday() { state.calendarYear=new Date().getFullYear(); state.calendarMonth=new Date().getMonth(); renderContent(); }
function goHome()  { closeDetailPanel(); state.view='calendar'; state.calendarYear=new Date().getFullYear(); state.calendarMonth=new Date().getMonth(); render(); }
function selectEvent(id) { state.selectedEventId=id; renderSidebar(); renderDetailPanel(id); }
function handleDayClick(_ds) {}

// ── List view ──
function renderListHtml() {
  const filtered = getListFilteredEvents();   // 목록 전용 필터 사용
  const sel = state.listSelection;

  // 목록 전용 filter bar
  let filterBar = `<div class="list-filter-bar">`;
  filterBar += `<div class="list-filter-groups">`;

  const GL = { vendor:'판매처', country:'국가', albumType:'앨범', eventType:'형태' };
  Object.entries(GL).forEach(([type, title]) => {
    const { key, colors } = FM[type];
    const hidden = state.listFilters[key];   // listFilters 사용
    const labels = state.labels[type];
    filterBar += `<div class="lf-group"><span class="lf-title">${title}</span>`;
    labels.forEach(label => {
      const isHidden = hidden.includes(label);
      const c = getColor(colors, label);
      filterBar += `<label class="lf-chip-label ${isHidden?'faded':''}">
        <input type="checkbox" class="lf-cb" ${isHidden?'':'checked'} onchange="toggleListFilterItem('${type}','${label}')">
        <span class="chip lf-chip" style="background:${c.bg};color:${c.color};border:1.5px solid ${c.border}">${label}</span>
      </label>`;
    });
    filterBar += `</div>`;
  });

  filterBar += `</div>`;
  filterBar += `<div class="lf-sort-row">
    <span class="lf-title">정렬</span>
    <button class="sort-btn sm ${state.listFilters.dateSort==='asc'?'active':''}" onclick="setListDateSort('asc')">오래된순</button>
    <button class="sort-btn sm ${state.listFilters.dateSort==='desc'?'active':''}" onclick="setListDateSort('desc')">최근순</button>
    ${isListFilterActive() ? `<button class="sort-btn sm danger" onclick="resetListFilters()">초기화</button>` : ''}
  </div>`;
  filterBar += `</div>`;

  // Bulk delete bar
  let bulkBar = '';
  if (sel.length > 0) {
    bulkBar = `<div class="bulk-bar">
      <span class="bulk-count">${sel.length}개 선택됨</span>
      <button class="btn btn-secondary btn-sm" onclick="clearListSelection()">선택 해제</button>
      <button class="btn btn-danger btn-sm" onclick="deleteSelected()">🗑 삭제</button>
    </div>`;
  }

  if (filtered.length === 0) {
    return filterBar + bulkBar + `<div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-title">${state.events.length===0?'이벤트가 없습니다':'필터 조건에 맞는 이벤트가 없습니다'}</div>
      <div class="empty-state-desc">${state.events.length===0?'+ 이벤트 추가 버튼을 눌러 등록해보세요':'필터를 초기화하면 모든 이벤트를 볼 수 있어요'}</div>
    </div>`;
  }

  let html = filterBar + bulkBar + `<table class="list-table"><thead><tr>
    <th><input type="checkbox" class="list-cb" id="list-cb-all" ${sel.length===filtered.length&&filtered.length>0?'checked':''} onchange="toggleSelectAll(this)"></th>
    <th>이벤트</th><th>판매처</th><th>국가</th><th>앨범</th><th>이벤트 형태</th>
    <th>예약 판매 기간</th><th>이벤트 날짜</th><th>장소</th>
  </tr></thead><tbody>`;

  filtered.forEach(ev => {
    const checked = sel.includes(ev.id);
    html += `<tr class="${checked?'row-selected':''}" onclick="selectEvent('${ev.id}')">
      <td onclick="event.stopPropagation()">
        <input type="checkbox" class="list-cb" ${checked?'checked':''} onchange="toggleListSelect('${ev.id}',this)">
      </td>
      <td><div class="event-name-cell"><span class="event-emoji-badge">${ev.emoji||'📅'}</span><strong>${ev.name||'(이름 없음)'}</strong></div></td>
      <td>${ev.vendor    ? chipHtml(ev.vendor,    VENDOR_COLORS)     : '-'}</td>
      <td>${ev.country   ? chipHtml(ev.country,   COUNTRY_COLORS)    : '-'}</td>
      <td>${ev.albumType ? chipHtml(ev.albumType, ALBUM_COLORS)      : '-'}</td>
      <td>${ev.eventType ? chipHtml(ev.eventType, EVENT_TYPE_COLORS) : '-'}</td>
      <td style="white-space:nowrap;font-size:12px">${ev.saleStart?formatDateTimeKr(ev.saleStart)+'<br><span style="color:#9ca3af">~</span> '+(ev.saleEnd?formatDateTimeKr(ev.saleEnd):''):'-'}</td>
      <td style="white-space:nowrap;font-size:12px">${ev.eventDate?formatDateKr(ev.eventDate):'-'}</td>
      <td style="font-size:12px">${ev.venue||'-'}</td>
    </tr>`;
  });

  return html + '</tbody></table>';
}

function toggleListSelect(id, cb) {
  const i = state.listSelection.indexOf(id);
  if (cb.checked) { if (i === -1) state.listSelection.push(id); }
  else { if (i !== -1) state.listSelection.splice(i, 1); }
  renderContent();
}

function toggleSelectAll(masterCb) {
  const filtered = getFilteredEvents();
  state.listSelection = masterCb.checked ? filtered.map(e => e.id) : [];
  renderContent();
}

function clearListSelection() { state.listSelection = []; renderContent(); }

function deleteSelected() {
  if (state.listSelection.length === 0) return;
  if (!confirm(`선택한 ${state.listSelection.length}개 이벤트를 삭제할까요?`)) return;
  state.events = state.events.filter(e => !state.listSelection.includes(e.id));
  state.listSelection = [];
  saveState(); render();
}

// ── Add / Edit Modal ──
let modalPickers = {};
let modalDtPickers = {};
let currentEditId = null;
let currentProjectEditId = null;

function openAddModal(prefill = {}) {
  currentEditId = prefill.id || null;
  const ev = currentEditId ? state.events.find(e => e.id === currentEditId) : null;
  const isEdit = !!ev;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'add-modal';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal('add-modal'); });

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">
          <div class="emoji-picker-wrapper" id="modal-emoji-wrapper">
            <button class="emoji-trigger-btn emoji-trigger-btn--large" id="modal-emoji-btn">
              ${ev?.emoji ? ev.emoji : '<span class="ep-plus-icon">+</span>'}
            </button>
          </div>
          <span>${isEdit ? '이벤트 수정' : '새 이벤트 추가'}</span>
        </div>
        <button class="modal-close" onclick="closeModal('add-modal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">1</span> 이벤트명</div>
          <input class="form-input" id="f-name" type="text" placeholder="예) KM_001" value="${ev?.name||''}">
        </div>
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">2</span> 판매처</div>
          <div class="chip-group" id="cg-vendor">${buildChipGroupHtml('vendor',ev?.vendor)}</div>
        </div>
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">3</span> 국가</div>
          <div class="chip-group" id="cg-country">${buildChipGroupHtml('country',ev?.country)}</div>
        </div>
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">4</span> 판매 앨범</div>
          <div class="chip-group" id="cg-albumType">${buildChipGroupHtml('albumType',ev?.albumType)}</div>
        </div>
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">5</span> 이벤트 형태</div>
          <div class="chip-group" id="cg-eventType">${buildChipGroupHtml('eventType',ev?.eventType)}</div>
        </div>
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">6</span> 예약 판매 기간</div>
          <div class="date-row">
            <div><div class="date-sub-label">시작</div><div class="dtp-wrapper" id="dtp-w-sale-start"><button class="dtp-trigger" id="dtp-sale-start"></button></div></div>
            <div><div class="date-sub-label">종료</div><div class="dtp-wrapper" id="dtp-w-sale-end"><button class="dtp-trigger" id="dtp-sale-end"></button></div></div>
          </div>
        </div>
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">7</span> 이벤트 날짜 & 시간</div>
          <div class="dtp-wrapper" id="dtp-w-event-date"><button class="dtp-trigger" id="dtp-event-date"></button></div>
        </div>
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">8</span> 이벤트 장소</div>
          <input class="form-input" id="f-venue" type="text" placeholder="예) 멬스 본사" value="${ev?.venue||''}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('add-modal')">취소</button>
        <button class="btn btn-primary" onclick="submitEventForm()">${isEdit?'✔ 저장':'＋ 추가'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Emoji picker
  const emojiBtn = document.getElementById('modal-emoji-btn');
  if (emojiBtn) {
    modalPickers.main = new EmojiPicker({ triggerEl: emojiBtn, onSelect: ()=>{}, initialEmoji: ev?.emoji||null, size:'large' });
  }

  // DateTimePickers
  modalDtPickers.saleStart = new DateTimePicker({ triggerEl: document.getElementById('dtp-sale-start'), onChange: ()=>{}, initialValue: ev?.saleStart||null, includeTime: true });
  modalDtPickers.saleEnd   = new DateTimePicker({ triggerEl: document.getElementById('dtp-sale-end'),   onChange: ()=>{}, initialValue: ev?.saleEnd||null,   includeTime: true });
  modalDtPickers.eventDate = new DateTimePicker({ triggerEl: document.getElementById('dtp-event-date'), onChange: ()=>{}, initialValue: ev?.eventDate||null,  includeTime: true });

  ['vendor','country','albumType','eventType'].forEach(t => initChipGroup(t));
}

function buildChipGroupHtml(type, selected) {
  let html = '';
  state.labels[type].forEach(l => {
    html += `<span class="chip-option${l===selected?' selected':''}" data-type="${type}" data-value="${l}">${l}</span>`;
  });
  return html + `<button class="chip-add-btn" onclick="addNewLabel('${type}')">＋ 추가</button>`;
}

function initChipGroup(type) {
  const c = document.getElementById(`cg-${type}`);
  if (!c) return;
  c.querySelectorAll('.chip-option').forEach(chip => {
    chip.addEventListener('click', () => { c.querySelectorAll('.chip-option').forEach(x => x.classList.remove('selected')); chip.classList.add('selected'); });
  });
}

function addNewLabel(type) {
  const c = document.getElementById(`cg-${type}`);
  if (!c) return;
  const ex = c.querySelector('.label-add-input');
  if (ex) { ex.remove(); return; }
  const inp = document.createElement('input');
  inp.className = 'label-add-input';
  inp.placeholder = '새 라벨명...';
  inp.maxLength = 20;
  c.insertBefore(inp, c.querySelector('.chip-add-btn'));
  inp.focus();
  const confirm = () => {
    const v = inp.value.trim();
    if (v && !state.labels[type].includes(v)) {
      state.labels[type].push(v);
      saveState();
      c.innerHTML = buildChipGroupHtml(type, v);
      initChipGroup(type);
      const nc = c.querySelector(`[data-value="${v}"]`);
      if (nc) { c.querySelectorAll('.chip-option').forEach(x=>x.classList.remove('selected')); nc.classList.add('selected'); }
    } else inp.remove();
  };
  inp.addEventListener('keydown', e => { if(e.key==='Enter') confirm(); if(e.key==='Escape') inp.remove(); });
  inp.addEventListener('blur', () => setTimeout(confirm, 150));
}

function getSelectedChip(type) {
  const s = document.querySelector(`#cg-${type} .chip-option.selected`);
  return s ? s.dataset.value : null;
}

function submitEventForm() {
  const nameEl = document.getElementById('f-name');
  const name = nameEl.value.trim();
  if (!name) { nameEl.style.borderColor='#ef4444'; nameEl.focus(); return; }
  nameEl.style.borderColor = '';

  const emojiBtn = document.getElementById('modal-emoji-btn');
  const rawEmoji = emojiBtn?.textContent || '';
  const finalEmoji = rawEmoji.includes('+') || !rawEmoji.trim() ? null : rawEmoji.trim();

  const data = {
    name, emoji: finalEmoji,
    vendor:    getSelectedChip('vendor'),
    country:   getSelectedChip('country'),
    albumType: getSelectedChip('albumType'),
    eventType: getSelectedChip('eventType'),
    saleStart: modalDtPickers.saleStart?.getValue() || '',
    saleEnd:   modalDtPickers.saleEnd?.getValue()   || '',
    eventDate: modalDtPickers.eventDate?.getValue() || '',
    venue:     document.getElementById('f-venue').value.trim()
  };

  if (currentEditId) {
    const ev = state.events.find(e => e.id === currentEditId);
    if (ev) { const memo = ev.memo; Object.assign(ev, data); ev.memo = memo; }
  } else {
    state.events.push({ id: genId(), ...data, memo: '' });
  }

  saveState();
  closeModal('add-modal');
  render();
}

function closeModal(id) {
  // Close any open DateTimePickers before removing modal
  Object.values(modalDtPickers).forEach(p => p?.close?.());
  const el = document.getElementById(id);
  if (el) el.remove();
  modalPickers = {};
  modalDtPickers = {};
  currentEditId = null;
}

// ── Detail Panel (inline side panel, no modal overlay) ──
function renderDetailPanel(id) {
  const ev = state.events.find(e => e.id === id);
  const panel = document.getElementById('detail-panel');
  if (!panel) return;

  if (!ev) { closeDetailPanel(); return; }
  state.selectedEventId = id;

  const chipHtmlDp = (label, cmap) => {
    if (!label) return '';
    const c = getColor(cmap, label);
    return `<span class="chip" style="background:${c.bg};color:${c.color};border:1.5px solid ${c.border}">${label}</span>`;
  };

  panel.innerHTML = `
    <div class="dp-header">
      <span class="dp-emoji">${ev.emoji || '📅'}</span>
      <span class="dp-name">${ev.name || '(이름 없음)'}</span>
      <button class="dp-close-btn" onclick="closeDetailPanel()" title="닫기">✕</button>
    </div>
    <div class="dp-body">
      <div class="dp-chips">
        ${chipHtmlDp(ev.vendor,    VENDOR_COLORS)}
        ${chipHtmlDp(ev.country,   COUNTRY_COLORS)}
        ${chipHtmlDp(ev.albumType, ALBUM_COLORS)}
        ${chipHtmlDp(ev.eventType, EVENT_TYPE_COLORS)}
      </div>
      <div class="dp-memo-section">
        <div class="dp-section-label">📝 메모</div>
        <textarea class="dp-memo-input" id="dp-memo" placeholder="이벤트 메모를 입력하세요...">${ev.memo || ''}</textarea>
        <div class="dp-memo-footer">
          <span class="dp-memo-hint">Ctrl+Enter 로도 저장 가능</span>
          <button class="dp-memo-save-btn" id="dp-memo-save">입력</button>
        </div>
        <div class="dp-memo-saved" id="dp-memo-saved"></div>
      </div>
      <div class="dp-info-box">
        <div class="dp-info-row"><span class="dp-info-label">🗓 예약시작</span><span>${ev.saleStart ? formatDateTimeKr(ev.saleStart) : '-'}</span></div>
        <div class="dp-info-row"><span class="dp-info-label">🗓 예약종료</span><span>${ev.saleEnd ? formatDateTimeKr(ev.saleEnd) : '-'}</span></div>
        <div class="dp-info-divider"></div>
        <div class="dp-info-row"><span class="dp-info-label">⭐ 이벤트</span><span>${ev.eventDate ? formatDateKr(ev.eventDate) : '-'}</span></div>
        <div class="dp-info-row"><span class="dp-info-label">📍 장소</span><span>${ev.venue || '-'}</span></div>
      </div>
    </div>
    <div class="dp-footer">
      <button class="btn btn-danger btn-sm" onclick="deleteEventFromPanel('${ev.id}')">🗑 삭제</button>
      <div style="flex:1"></div>
      <button class="btn btn-primary btn-sm" onclick="openAddModal({id:'${ev.id}'})">✏ 수정</button>
    </div>
  `;

  panel.classList.add('open');

  // Memo: save on button click (or Ctrl+Enter)
  const memoEl  = document.getElementById('dp-memo');
  const saveBtn = document.getElementById('dp-memo-save');
  const savedEl = document.getElementById('dp-memo-saved');

  const saveMemo = () => {
    const evData = state.events.find(e => e.id === id);
    if (!evData) return;
    evData.memo = memoEl.value;
    saveState();
    renderSidebar();

    saveBtn.textContent = '✓ 저장됨';
    saveBtn.classList.add('saved');
    savedEl.textContent = '';
    setTimeout(() => {
      saveBtn.textContent = '입력';
      saveBtn.classList.remove('saved');
    }, 1600);
  };

  if (saveBtn) saveBtn.addEventListener('click', saveMemo);

  if (memoEl) {
    memoEl.focus();
    memoEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveMemo(); }
    });
  }
}

function closeDetailPanel() {
  const panel = document.getElementById('detail-panel');
  if (panel) { panel.classList.remove('open'); panel.innerHTML = ''; }
  state.selectedEventId = null;
  renderSidebar();
}

function deleteEventFromPanel(id) {
  if (!confirm('이 이벤트를 삭제할까요?')) return;
  state.events = state.events.filter(e => e.id !== id);
  state.selectedEventId = null;
  saveState(); closeDetailPanel(); render();
}

function deleteEvent(id) {
  if (!confirm('이 이벤트를 삭제할까요?')) return;
  state.events = state.events.filter(e => e.id !== id);
  if (state.selectedEventId === id) state.selectedEventId = null;
  saveState(); closeDetailPanel(); render();
}

// ═══════════════════════════════════════════════════════════════
// 데이터 프로젝트  (3단계: 프로젝트 → 판매처 → 이벤트)
// ═══════════════════════════════════════════════════════════════

function genProjectId()    { return 'dp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function genVendorEntryId(){ return 'dv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function getProjectById(id)              { return (state.dataProjects || []).find(p => p.id === id); }
function getVendorEntryById(project, vid){ return (project?.vendors || []).find(v => v.id === vid); }

// 판매처 항목 통계 계산
function calcVendorEntryStats(vendorEntry) {
  const mg = Number(vendorEntry.mg) || 0;
  const salesDetail = [];
  const sales = (vendorEntry.linkedEventIds || []).reduce((sum, eid) => {
    const qty = Number(vendorEntry.sales?.[eid]) || 0;
    if (qty > 0) {
      const ev = state.events.find(e => e.id === eid);
      salesDetail.push(`${ev?.name || eid}(${qty.toLocaleString()})`);
    }
    return sum + qty;
  }, 0);
  const remaining = mg - sales;
  const rate = mg > 0 ? Math.round(sales / mg * 1000) / 10 : 0;
  return { mg, sales, remaining, rate, salesDetail };
}

function getBarColor(rate) {
  return rate > 90 ? '#ef4444' : rate > 70 ? '#f59e0b' : '#10b981';
}

// ── Step 1: 프로젝트 목록 ──
function renderDataHtml() {
  if (state.selectedVendorId && state.selectedProjectId) {
    const project = getProjectById(state.selectedProjectId);
    const ve = getVendorEntryById(project, state.selectedVendorId);
    if (project && ve) return renderVendorDetailHtml(project, ve);
    state.selectedVendorId = null;
  }
  if (state.selectedProjectId) {
    const project = getProjectById(state.selectedProjectId);
    if (project) return renderProjectDetailHtml(project);
    state.selectedProjectId = null;
  }

  const projects = state.dataProjects || [];
  const headerHtml = `<div class="data-view-header">
    <button class="btn btn-primary btn-sm" onclick="openAddProjectModal()">＋ 새 프로젝트</button>
  </div>`;

  if (projects.length === 0) {
    return `<div class="data-view">${headerHtml}
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-title">데이터 프로젝트가 없습니다</div>
        <div class="empty-state-desc">새 프로젝트 버튼을 눌러 앨범 프로젝트를 등록해보세요</div>
      </div></div>`;
  }

  const cardsHtml = projects.map(project => {
    const vendors = project.vendors || [];
    const barsHtml = vendors.map(ve => {
      const s = calcVendorEntryStats(ve);
      const bc = getBarColor(s.rate);
      return `<div class="dpc-bar-row">
        <span class="dpc-bar-vendor">${ve.vendor}</span>
        <div class="dpc-bar-track"><div class="dpc-bar-fill" style="width:${Math.min(s.rate,100)}%;background:${bc}"></div></div>
        <span class="dpc-bar-pct" style="color:${bc}">${s.rate}%</span>
      </div>`;
    }).join('');
    const totalEvents = vendors.reduce((n, ve) => n + (ve.linkedEventIds?.length || 0), 0);
    return `<div class="data-project-card" onclick="selectProject('${project.id}')">
      <div class="dpc-name">${project.name || '(이름 없음)'}</div>
      <div class="dpc-total">제작수량 <strong>${(Number(project.totalQty)||0).toLocaleString()}</strong></div>
      <div class="dpc-chips">${vendors.map(ve => chipHtml(ve.vendor, VENDOR_COLORS)).join('')}</div>
      ${barsHtml ? `<div class="dpc-bars">${barsHtml}</div>` : ''}
      <div class="dpc-footer">${vendors.length}개 판매처 · ${totalEvents}개 이벤트</div>
    </div>`;
  }).join('');

  return `<div class="data-view">${headerHtml}<div class="data-projects-grid">${cardsHtml}</div></div>`;
}

// ── Step 2: 판매처 목록 ──
function renderProjectDetailHtml(project) {
  const vendors = project.vendors || [];
  const usedVendors = new Set(vendors.map(ve => ve.vendor));
  const availableVendors = state.labels.vendor.filter(v => !usedVendors.has(v));

  const totalQty = Number(project.totalQty) || 0;
  const totalMG  = vendors.reduce((sum, ve) => sum + (Number(ve.mg) || 0), 0);
  const mgDetailTitle = vendors.length > 0
    ? `총 MG수량: ${vendors.map(ve => `${ve.vendor}(${(Number(ve.mg)||0).toLocaleString()})`).join(' + ')} = ${totalMG.toLocaleString()}`
    : '판매처를 추가하면 총 MG수량이 계산됩니다';
  const qtyTitle = totalMG > 0
    ? `제작수량(${totalQty.toLocaleString()}) vs 총 MG수량(${totalMG.toLocaleString()}) — 차이: ${(totalQty - totalMG).toLocaleString()}`
    : '제작수량';

  const vendorCardsHtml = vendors.map(ve => {
    const s = calcVendorEntryStats(ve);
    const bc = getBarColor(s.rate);
    const c = getColor(VENDOR_COLORS, ve.vendor);
    const salesTitle  = s.salesDetail.length > 0
      ? `판매량 계산: ${s.salesDetail.join(' + ')} = ${s.sales.toLocaleString()}`
      : '판매 없음';
    const remainTitle = `잔여수량: MG수량(${s.mg.toLocaleString()}) - 판매량(${s.sales.toLocaleString()}) = ${s.remaining.toLocaleString()}`;
    const rateTitle   = s.mg > 0
      ? `소진률: 판매량(${s.sales.toLocaleString()}) ÷ MG수량(${s.mg.toLocaleString()}) × 100 = ${s.rate}%`
      : '판매 없음';
    return `<div class="data-vendor-card" onclick="selectVendorEntry('${ve.id}')">
      <div class="dvc-header">
        <span class="chip" style="background:${c.bg};color:${c.color};border:1.5px solid ${c.border}">${ve.vendor}</span>
        <button class="btn-unlink" onclick="event.stopPropagation();deleteVendorEntry('${project.id}','${ve.id}')" title="판매처 삭제">✕</button>
      </div>
      <div class="dvc-stats">
        <div class="dvc-stat" title="설정된 MG수량: ${s.mg.toLocaleString()}"><div class="dvc-stat-label">MG수량</div><div class="dvc-stat-val">${s.mg.toLocaleString()}</div></div>
        <div class="dvc-stat" title="${salesTitle}"><div class="dvc-stat-label">판매량</div><div class="dvc-stat-val" style="color:${s.sales>0?'#6366f1':'#9ca3af'}">${s.sales.toLocaleString()}</div></div>
        <div class="dvc-stat" title="${remainTitle}"><div class="dvc-stat-label">잔여</div><div class="dvc-stat-val" style="color:${s.remaining<0?'#ef4444':'#374151'}">${s.remaining.toLocaleString()}</div></div>
      </div>
      <div class="dvc-progress-row" title="${rateTitle}">
        <div class="dvc-bar-track"><div class="dvc-bar-fill" style="width:${Math.min(s.rate,100)}%;background:${bc}"></div></div>
        <span class="dvc-rate" style="color:${bc}">${s.rate}%</span>
      </div>
      <div class="dvc-footer">${(ve.linkedEventIds||[]).length}개 이벤트 연결됨</div>
    </div>`;
  }).join('');

  return `<div class="data-view data-detail-active">
    <div class="data-detail-nav">
      <button class="btn btn-secondary btn-sm" onclick="backToProjects()">‹ 목록으로</button>
      <div class="data-breadcrumb">${project.name || '(이름 없음)'}</div>
      <div class="data-detail-actions">
        ${availableVendors.length > 0 ? `<button class="btn btn-primary btn-sm" onclick="openAddVendorModal('${project.id}')">＋ 판매처 추가</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="openEditProjectModal('${project.id}')">✏ 수정</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProject('${project.id}')">🗑 삭제</button>
      </div>
    </div>
    <div class="data-project-meta">
      <span class="dpm-item" title="${qtyTitle}">📦 제작수량: <strong>${totalQty.toLocaleString()}</strong></span>
      <span class="dpm-sep">·</span>
      <span class="dpm-item" title="${mgDetailTitle}">📊 총 MG수량: <strong>${totalMG.toLocaleString()}</strong></span>
      <span class="dpm-sep">·</span>
      <span class="dpm-item">🏪 판매처 ${vendors.length}개</span>
    </div>
    ${vendors.length > 0
      ? `<div class="data-vendor-grid">${vendorCardsHtml}</div>`
      : `<div class="empty-state" style="padding:40px 0">
          <div class="empty-state-icon">🏪</div>
          <div class="empty-state-title">판매처가 없습니다</div>
          <div class="empty-state-desc">판매처 추가 버튼을 눌러 판매처별 MG수량을 등록해주세요</div>
        </div>`}
  </div>`;
}

// ── Step 3: 이벤트 목록 ──
function renderVendorDetailHtml(project, vendorEntry) {
  const s = calcVendorEntryStats(vendorEntry);
  const bc = getBarColor(s.rate);
  const c = getColor(VENDOR_COLORS, vendorEntry.vendor);
  const rateTitle   = `소진률: 판매량(${s.sales.toLocaleString()}) ÷ MG수량(${s.mg.toLocaleString()}) × 100 = ${s.rate}%`;
  const remainTitle = `잔여수량: MG수량(${s.mg.toLocaleString()}) - 판매량(${s.sales.toLocaleString()}) = ${s.remaining.toLocaleString()}`;
  const salesTitle  = s.salesDetail.length > 0
    ? `판매량 계산: ${s.salesDetail.join(' + ')} = ${s.sales.toLocaleString()}`
    : '판매 없음';

  const linkedIds = new Set(vendorEntry.linkedEventIds || []);
  // 해당 판매처로 등록된 이벤트만 드롭박스에 표시
  const availableEvents = state.events.filter(e => !linkedIds.has(e.id) && e.vendor === vendorEntry.vendor);

  const eventsBodyHtml = (vendorEntry.linkedEventIds || []).map(eid => {
    const ev = state.events.find(e => e.id === eid);
    if (!ev) return '';
    const qty = vendorEntry.sales?.[eid] ?? '';
    const contribPct = s.mg > 0 && qty !== '' ? Math.round(Number(qty) / s.mg * 100) : null;
    const inputTitle = contribPct !== null
      ? `이 이벤트 기여율: ${Number(qty).toLocaleString()} ÷ ${s.mg.toLocaleString()} × 100 = ${contribPct}%`
      : '판매량을 입력하세요';
    const safeName = (ev.name||'(이름 없음)').replace(/"/g, '&quot;');
    return `<tr>
      <td><span class="event-emoji-badge">${ev.emoji||'📅'}</span> <strong>${ev.name||'(이름 없음)'}</strong></td>
      <td><input type="number" class="data-sales-input" value="${qty}" min="0" placeholder="판매량"
            title="${inputTitle}"
            data-orig-value="${qty}"
            data-event-name="${safeName}"
            onchange="confirmEventSales('${project.id}','${vendorEntry.id}','${eid}',this)"></td>
      <td><button class="btn-unlink" onclick="unlinkEventFromVendor('${project.id}','${vendorEntry.id}','${eid}')" title="연결 해제">✕</button></td>
    </tr>`;
  }).join('');

  const eventSelectHtml = availableEvents.length > 0
    ? `<select class="data-event-select" onchange="linkEventToVendor('${project.id}','${vendorEntry.id}',this)">
        <option value="">＋ 이벤트 추가</option>
        ${availableEvents.map(e => `<option value="${e.id}">${e.emoji||'📅'} ${e.name||'(이름 없음)'}</option>`).join('')}
      </select>` : '';

  return `<div class="data-view data-detail-active">
    <div class="data-detail-nav">
      <button class="btn btn-secondary btn-sm" onclick="backToProject()">‹ ${project.name||'프로젝트'}</button>
      <div class="data-breadcrumb">
        <span class="chip" style="background:${c.bg};color:${c.color};border:1.5px solid ${c.border}">${vendorEntry.vendor}</span>
      </div>
      <div class="data-detail-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditVendorModal('${project.id}','${vendorEntry.id}')">MG 수정</button>
      </div>
    </div>
    <div class="data-vendor-stats-hero">
      <div class="dvsh-stat">
        <div class="dvsh-label">MG수량</div>
        <div class="dvsh-value">${s.mg.toLocaleString()}</div>
      </div>
      <div class="dvsh-stat" title="${salesTitle}">
        <div class="dvsh-label">판매량</div>
        <div class="dvsh-value" style="color:#6366f1">${s.sales.toLocaleString()}</div>
      </div>
      <div class="dvsh-stat ${s.remaining<0?'dvsh-over':''}" title="${remainTitle}">
        <div class="dvsh-label">잔여수량</div>
        <div class="dvsh-value">${s.remaining.toLocaleString()}</div>
      </div>
      <div class="dvsh-stat" title="${rateTitle}">
        <div class="dvsh-label">소진률</div>
        <div class="dvsh-value" style="color:${bc}">${s.rate}%</div>
      </div>
    </div>
    <div class="dvsh-bar-wrap" title="${rateTitle}">
      <div class="dvsh-bar-fill" style="width:${Math.min(s.rate,100)}%;background:${bc}"></div>
    </div>
    <div class="data-section">
      <div class="data-section-header">
        <div class="data-section-title">연결된 이벤트</div>
        ${eventSelectHtml}
      </div>
      ${(vendorEntry.linkedEventIds||[]).length > 0
        ? `<table class="data-table">
            <thead><tr>
              <th>이벤트명</th>
              <th title="마우스를 올리면 이 이벤트의 기여율 확인">판매량 (장)</th>
              <th></th>
            </tr></thead>
            <tbody>${eventsBodyHtml}</tbody>
          </table>`
        : `<div class="data-empty-msg">이벤트를 추가해주세요</div>`}
    </div>
  </div>`;
}

// ── 액션 ──
function selectProject(id)     { state.selectedProjectId = id; state.selectedVendorId = null; renderContent(); }
function backToProjects()       { state.selectedProjectId = null; state.selectedVendorId = null; renderContent(); }
function selectVendorEntry(vid) { state.selectedVendorId = vid; renderContent(); }
function backToProject()        { state.selectedVendorId = null; renderContent(); }

function confirmEventSales(projectId, vendorEntryId, eventId, inputEl) {
  const newVal = inputEl.value;
  const origVal = inputEl.dataset.origValue ?? '';
  if (newVal === origVal) return;
  const eventName = inputEl.dataset.eventName || '이벤트';
  const origDisplay = origVal === '' ? '미입력' : Number(origVal).toLocaleString();
  const newDisplay  = newVal  === '' ? '삭제'   : Number(newVal).toLocaleString();
  if (confirm(`"${eventName}" 판매량을 수정하시겠습니까?\n\n이전: ${origDisplay} → 수정: ${newDisplay}`)) {
    updateEventSales(projectId, vendorEntryId, eventId, newVal);
    inputEl.dataset.origValue = newVal;
  } else {
    inputEl.value = origVal;
  }
}

function updateEventSales(projectId, vendorEntryId, eventId, value) {
  const project = getProjectById(projectId);
  if (!project) return;
  const ve = getVendorEntryById(project, vendorEntryId);
  if (!ve) return;
  if (!ve.sales) ve.sales = {};
  const qty = parseInt(value, 10);
  if (isNaN(qty) || qty < 0) delete ve.sales[eventId];
  else ve.sales[eventId] = qty;
  saveState();

  // 입력 포커스 유지를 위해 hero 통계만 업데이트
  const s = calcVendorEntryStats(ve);
  const bc = getBarColor(s.rate);
  const heroEl = document.querySelector('.data-vendor-stats-hero');
  if (heroEl) {
    const st = s.salesDetail.length > 0 ? `판매량 계산: ${s.salesDetail.join(' + ')} = ${s.sales.toLocaleString()}` : '판매 없음';
    const rt = `잔여수량: MG수량(${s.mg.toLocaleString()}) - 판매량(${s.sales.toLocaleString()}) = ${s.remaining.toLocaleString()}`;
    const pt = `소진률: 판매량(${s.sales.toLocaleString()}) ÷ MG수량(${s.mg.toLocaleString()}) × 100 = ${s.rate}%`;
    heroEl.innerHTML = `
      <div class="dvsh-stat"><div class="dvsh-label">MG수량</div><div class="dvsh-value">${s.mg.toLocaleString()}</div></div>
      <div class="dvsh-stat" title="${st}"><div class="dvsh-label">판매량</div><div class="dvsh-value" style="color:#6366f1">${s.sales.toLocaleString()}</div></div>
      <div class="dvsh-stat ${s.remaining<0?'dvsh-over':''}" title="${rt}"><div class="dvsh-label">잔여수량</div><div class="dvsh-value">${s.remaining.toLocaleString()}</div></div>
      <div class="dvsh-stat" title="${pt}"><div class="dvsh-label">소진률</div><div class="dvsh-value" style="color:${bc}">${s.rate}%</div></div>`;
    const fill = document.querySelector('.dvsh-bar-fill');
    if (fill) { fill.style.width = Math.min(s.rate,100)+'%'; fill.style.background = bc; }
  }
}

function unlinkEventFromVendor(projectId, vendorEntryId, eventId) {
  const project = getProjectById(projectId);
  if (!project) return;
  const ve = getVendorEntryById(project, vendorEntryId);
  if (!ve) return;
  ve.linkedEventIds = (ve.linkedEventIds||[]).filter(id => id !== eventId);
  if (ve.sales) delete ve.sales[eventId];
  saveState(); renderContent();
}

function linkEventToVendor(projectId, vendorEntryId, selectEl) {
  const eventId = selectEl.value;
  if (!eventId) return;
  const project = getProjectById(projectId);
  const ve = getVendorEntryById(project, vendorEntryId);
  if (!ve) return;
  if (!ve.linkedEventIds) ve.linkedEventIds = [];
  if (!ve.linkedEventIds.includes(eventId)) { ve.linkedEventIds.push(eventId); saveState(); renderContent(); }
}

function deleteVendorEntry(projectId, vendorEntryId) {
  if (!confirm('이 판매처를 삭제할까요? 연결된 이벤트와 판매 데이터도 함께 삭제됩니다.')) return;
  const project = getProjectById(projectId);
  if (!project) return;
  project.vendors = (project.vendors||[]).filter(v => v.id !== vendorEntryId);
  if (state.selectedVendorId === vendorEntryId) state.selectedVendorId = null;
  saveState(); renderContent();
}

function deleteProject(id) {
  if (!confirm('이 프로젝트를 삭제할까요?')) return;
  state.dataProjects = (state.dataProjects||[]).filter(p => p.id !== id);
  state.selectedProjectId = null; state.selectedVendorId = null;
  saveState(); renderContent();
}

// ── 프로젝트 모달 (1단계: 앨범명 + 제작수량) ──
function openAddProjectModal() { currentProjectEditId = null; _openProjectModal(null); }
function openEditProjectModal(id) { currentProjectEditId = id; _openProjectModal(getProjectById(id)); }

function _openProjectModal(project) {
  const isEdit = !!project;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'project-modal';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal('project-modal'); });
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">📊 ${isEdit ? '프로젝트 수정' : '새 프로젝트'}</div>
        <button class="modal-close" onclick="closeModal('project-modal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">1</span> 프로젝트명</div>
          <input class="form-input" id="pf-name" type="text" placeholder="예) 앨범명" value="${project?.name||''}">
        </div>
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">2</span> 제작수량</div>
          <input class="form-input" id="pf-total-qty" type="number" placeholder="예) 10000" min="0" value="${project?.totalQty||''}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('project-modal')">취소</button>
        <button class="btn btn-primary" onclick="submitProjectForm()">${isEdit?'✔ 저장':'＋ 추가'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('pf-name')?.focus();
}

function submitProjectForm() {
  const nameEl = document.getElementById('pf-name');
  const name = nameEl.value.trim();
  if (!name) { nameEl.style.borderColor = '#ef4444'; nameEl.focus(); return; }
  nameEl.style.borderColor = '';
  const totalQty = parseInt(document.getElementById('pf-total-qty').value, 10) || 0;
  if (currentProjectEditId) {
    const p = getProjectById(currentProjectEditId);
    if (p) { p.name = name; p.totalQty = totalQty; }
  } else {
    if (!state.dataProjects) state.dataProjects = [];
    state.dataProjects.push({ id: genProjectId(), name, totalQty, vendors: [] });
  }
  saveState(); closeModal('project-modal'); renderContent();
}

// ── 판매처 모달 (2단계: 판매처 + MG수량) ──
let currentVendorProjectId = null;
let currentVendorEditId = null;

function openAddVendorModal(projectId) { currentVendorProjectId = projectId; currentVendorEditId = null; _openVendorModal(projectId, null); }
function openEditVendorModal(projectId, vid) { currentVendorProjectId = projectId; currentVendorEditId = vid; _openVendorModal(projectId, getVendorEntryById(getProjectById(projectId), vid)); }

function _openVendorModal(projectId, vendorEntry) {
  const isEdit = !!vendorEntry;
  const project = getProjectById(projectId);
  if (!project) return;
  const usedVendors = new Set((project.vendors||[]).map(v => v.vendor));
  if (isEdit) usedVendors.delete(vendorEntry.vendor);
  const availableVendors = state.labels.vendor.filter(v => !usedVendors.has(v));
  const vendorOptions = isEdit
    ? `<option value="${vendorEntry.vendor}" selected>${vendorEntry.vendor}</option>`
    : ['<option value="">판매처를 선택하세요</option>', ...availableVendors.map(v => `<option value="${v}">${v}</option>`)].join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'vendor-modal';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal('vendor-modal'); });
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">🏪 ${isEdit ? '판매처 수정' : '판매처 추가'}</div>
        <button class="modal-close" onclick="closeModal('vendor-modal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">1</span> 판매처</div>
          <select class="form-input" id="vf-vendor" ${isEdit?'disabled':''}>${vendorOptions}</select>
        </div>
        <div class="form-field">
          <div class="form-label"><span class="form-label-num">2</span> MG수량</div>
          <input class="form-input" id="vf-mg" type="number" min="0" placeholder="예) 3000" value="${vendorEntry?.mg||''}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('vendor-modal')">취소</button>
        <button class="btn btn-primary" onclick="submitVendorForm()">${isEdit?'✔ 저장':'＋ 추가'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById(isEdit ? 'vf-mg' : 'vf-vendor')?.focus();
}

function submitVendorForm() {
  const vendorEl = document.getElementById('vf-vendor');
  const vendor = vendorEl.value;
  if (!vendor) { vendorEl.style.borderColor = '#ef4444'; return; }
  vendorEl.style.borderColor = '';
  const mg = parseInt(document.getElementById('vf-mg').value, 10) || 0;
  const project = getProjectById(currentVendorProjectId);
  if (!project) return;
  if (currentVendorEditId) {
    const ve = getVendorEntryById(project, currentVendorEditId);
    if (ve) ve.mg = mg;
  } else {
    if (!project.vendors) project.vendors = [];
    project.vendors.push({ id: genVendorEntryId(), vendor, mg, linkedEventIds: [], sales: {} });
  }
  saveState(); closeModal('vendor-modal'); renderContent();
}

// ── Sidebar mobile toggle ──
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebar-backdrop');
  if (!sb) return;
  const isOpen = sb.classList.toggle('mobile-open');
  if (bd) bd.classList.toggle('visible', isOpen);
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 768) {
    const sb = document.getElementById('sidebar');
    const bd = document.getElementById('sidebar-backdrop');
    if (sb) sb.classList.remove('mobile-open');
    if (bd) bd.classList.remove('visible');
  }
}

// ── Init ──
window.addEventListener('DOMContentLoaded', () => { loadState(); render(); });

Object.assign(window, {
  moveMonth, goToday, goHome, setView, openAddModal, closeModal, submitEventForm,
  addNewLabel, selectEvent, deleteEvent, deleteEventFromPanel, handleDayClick,
  // 사이드바 필터
  toggleFilterItem, toggleAllFilter, resetFilters, setDateSort,
  toggleShowSalePeriod, toggleShowEventDate, toggleFilterGroup,
  // 목록 전용 필터
  toggleListFilterItem, resetListFilters, setListDateSort,
  // 목록 선택/삭제
  toggleListSelect, toggleSelectAll, clearListSelection, deleteSelected,
  // 패널/사이드바
  renderDetailPanel, closeDetailPanel, toggleSidebar,
  // 데이터 프로젝트
  selectProject, backToProjects, selectVendorEntry, backToProject,
  confirmEventSales, updateEventSales, unlinkEventFromVendor, linkEventToVendor,
  deleteVendorEntry, deleteProject,
  openAddProjectModal, openEditProjectModal, submitProjectForm,
  openAddVendorModal, openEditVendorModal, submitVendorForm
});
