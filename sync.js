// ─────────────────────────────────────────────────────────────
//  sync.js — Firebase Realtime Database 동기화
//  5명이 같은 데이터를 공유하고 실시간으로 반영됩니다.
//
//  설정 방법:
//  1. https://console.firebase.google.com 에서 프로젝트 생성
//  2. "Realtime Database" 메뉴 → 데이터베이스 만들기 (테스트 모드)
//  3. 프로젝트 설정 > 앱 추가(웹) > 아래 firebaseConfig 값 붙여넣기
// ─────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            "AIzaSyAzVXrQw78z0zfLAc4C5gzyS52dvcmxqkQ",
  authDomain:        "nmixx-schedule-28ff1.firebaseapp.com",
  databaseURL:       "https://nmixx-schedule-28ff1-default-rtdb.firebaseio.com",
  projectId:         "nmixx-schedule-28ff1",
  storageBucket:     "nmixx-schedule-28ff1.firebasestorage.app",
  messagingSenderId: "196903655357",
  appId:             "1:196903655357:web:a6600970194df902d9e4d4"
};

// ── 내부 변수 ──
let _db = null;
let _skipNextUpdate = false;

const DB_PATH = 'schedule';   // Firebase 저장 경로

// ── 초기화 ──
function initSync() {
  if (!firebaseConfig.databaseURL) {
    setSyncStatus('offline');
    console.info('[Sync] Firebase 미설정 — 로컬 저장만 사용합니다.');
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    _db = firebase.database();

    // 연결 상태 감지
    _db.ref('.info/connected').on('value', snap => {
      setSyncStatus(snap.val() ? 'online' : 'connecting');
    });

    // 원격 변경 수신
    _db.ref(DB_PATH).on('value', snapshot => {
      if (_skipNextUpdate) { _skipNextUpdate = false; return; }
      const remote = snapshot.val();
      if (!remote) return;

      if (remote.events) state.events = remote.events;
      if (remote.labels) {
        Object.keys(remote.labels).forEach(k => {
          if (state.labels[k]) state.labels[k] = remote.labels[k];
        });
      }

      // 열린 디테일 패널이 있으면 해당 이벤트 최신화
      const panel = document.getElementById('detail-panel');
      if (panel && panel.classList.contains('open') && state.selectedEventId) {
        renderDetailPanel(state.selectedEventId);
      }

      render();
      flashSyncBadge();
    });

  } catch (err) {
    console.error('[Sync] 초기화 실패:', err);
    setSyncStatus('error');
  }
}

// 로컬 변경 → Firebase 업로드
function syncSave(data) {
  if (!_db) return;
  _skipNextUpdate = true; // 자신의 변경으로 인한 re-render 방지
  _db.ref(DB_PATH).set(data)
    .then(() => { setSyncStatus('online'); })
    .catch(err => {
      console.error('[Sync] 저장 실패:', err);
      setSyncStatus('error');
      _skipNextUpdate = false;
    });
}

// ── 상태 표시 ──
function setSyncStatus(status) {
  const dot  = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');
  if (!dot || !text) return;

  const MAP = {
    online:      { color: '#10b981', label: '동기화됨' },
    connecting:  { color: '#f59e0b', label: '연결 중...' },
    offline:     { color: '#9ca3af', label: '로컬 전용' },
    error:       { color: '#ef4444', label: '오류' }
  };
  const s = MAP[status] || MAP.offline;
  dot.style.background = s.color;
  text.textContent = s.label;
}

function flashSyncBadge() {
  const badge = document.getElementById('sync-badge');
  if (!badge) return;
  badge.classList.add('flash');
  setTimeout(() => badge.classList.remove('flash'), 800);
}

// ── DOMContentLoaded 후 자동 시작 ──
window.addEventListener('DOMContentLoaded', () => {
  initSync();
});
