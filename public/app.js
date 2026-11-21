/**
 * CakraBoard — Frontend Application Engine
 * Menghubungkan visual UI yang presisi dengan backend CakraBoard & Socket.IO
 */

// ==================== STATE GLOBAL APLIKASI ====================
const state = {
  // Pengguna aktif saat ini
  currentUser: {
    id: null,
    name: 'Sinta Dewi',
    role: 'mahasiswa', // 'mahasiswa' | 'dosen'
    token: null,
    mockToken: 'mock:M001:mahasiswa:Sinta'
  },
  
  // Sesi aktif
  activeSession: null, // { id, code, title, qrDataUrl, status, accessMode, canWrite }
  
  // Socket.IO
  socket: null,
  
  // Whiteboard Canvas State
  tool: 'pen', // 'pen' | 'eraser'
  color: '#7357E8',
  size: 24,
  opacity: 1.0,
  stabilizerEnabled: true,
  stabilizerAmount: 0.35,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  isDrawing: false,
  currentStroke: null,
  objects: [], // Objek gambar yang ada di halaman
  undoStack: [],
  redoStack: [],

  // clientOpId milik sendiri yang sudah diterapkan lokal.
  // Server memantulkan board:op ke SEMUA peserta termasuk pengirim,
  // jadi echo milik sendiri harus diabaikan agar objek tidak dobel.
  pendingOps: new Set(),
  
  // Multi-page
  currentPage: 0,
  pages: [{ id: 0, title: 'Page 1' }],
  
  // UI Panels
  toolsPanelOpen: true,
  studentsDrawerExpanded: true,
  
  // Daftar Peserta — diisi dari server (GET /api/sessions/:id/participants
  // + event socket participants:update). Kosong saat sesi baru dibuat.
  students: [],

  // Camera scanner
  cameraStream: null,
  scanAnimFrame: null,

  // Dashboard data cache
  courses: [],
  savedSessions: [],
  historyList: []
};

// ==================== INISIALISASI SAAT DOM READY ====================
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  
  // Login awal sebagai mahasiswa (default)
  await authenticateUser('mahasiswa');
  
  initUIEventListeners();
  initCanvas();
  updateBrushPreview();
  renderStudentsList();
});

// ==================== SISTEM AUTENTIKASI (SIAKAD) ====================
async function authenticateUser(role = 'mahasiswa') {
  const tokens = {
    dosen: 'mock:D001:dosen:Pak Rudi',
    mahasiswa: 'mock:M001:mahasiswa:Sinta',
    outsider: 'mock:M999:mahasiswa:Outsider'
  };

  try {
    const mockToken = tokens[role] || tokens.mahasiswa;
      
    const res = await fetch('/api/auth/siakad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: mockToken })
    });
    
    const data = await res.json();
    if (res.ok && data.token) {
      state.currentUser = {
        id: data.user.id,
        name: data.user.name,
        role: data.user.role,
        token: data.token,
        mockToken
      };
      
      updateUserUI();
      await loadDashboardData();
      showToast(`Login sebagai ${state.currentUser.name} (${state.currentUser.role})`, 'success');
    }
  } catch (err) {
    console.error('Gagal login:', err);
    showToast('Gagal terhubung ke backend auth.', 'error');
  }
}

function switchUserRole(newRole) {
  document.getElementById('role-menu').classList.add('hidden');
  authenticateUser(newRole);
}

function updateUserUI() {
  const isDosen = state.currentUser.role === 'dosen';
  
  // Update header text
  document.getElementById('header-page-title').innerText = isDosen ? 'Dashboard dosen' : 'Papan Tulis';
  document.getElementById('user-display-name').innerText = state.currentUser.name;
  document.getElementById('user-role-label').innerText = isDosen ? 'Dosen' : 'Mahasiswa';
  document.getElementById('user-avatar-text').innerText = isDosen ? 'PR' : state.currentUser.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  
  // Toggle view dashboard
  const studentView = document.getElementById('view-student-dashboard');
  const lecturerView = document.getElementById('view-lecturer-dashboard');
  
  if (isDosen) {
    studentView.classList.add('hidden');
    lecturerView.classList.remove('hidden');
    document.getElementById('global-search').placeholder = 'Cari papan atau rekaman';
  } else {
    studentView.classList.remove('hidden');
    lecturerView.classList.add('hidden');
    document.getElementById('global-search').placeholder = 'Search Bar';
  }
}

// ==================== LOAD DATA DARI API ====================
async function loadDashboardData() {
  if (!state.currentUser.token) return;
  const headers = { Authorization: `Bearer ${state.currentUser.token}` };

  // Fetch semua data dashboard secara paralel
  const [coursesRes, historyRes] = await Promise.allSettled([
    fetch('/api/courses', { headers }),
    fetch('/api/history', { headers })
  ]);

  // Courses
  if (coursesRes.status === 'fulfilled' && coursesRes.value.ok) {
    const coursesData = await coursesRes.value.json();
    state.courses = coursesData.data || [];
    populateCourseSelect();
  }

  // History / Rekaman
  if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
    const historyData = await historyRes.value.json();
    state.historyList = historyData.data || [];
    renderHistoryList();
  }

  // Load saved sessions (dosen only)
  if (state.currentUser.role === 'dosen') {
    try {
      const sessionsRes = await fetch('/api/sessions', { headers });
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        state.savedSessions = sessionsData.data || [];
        populateSavedSessions();
      }
    } catch (e) {
      console.warn('Gagal load sessions:', e);
    }
  }

  // Check for live sessions (mahasiswa)
  if (state.currentUser.role === 'mahasiswa') {
    checkLiveSessions();
  }
}

function populateCourseSelect() {
  const select = document.getElementById('lecturer-course-select');
  if (!select) return;

  if (state.courses.length === 0) {
    select.innerHTML = '<option value="">Tidak ada kelas ditemukan</option>';
    return;
  }

  select.innerHTML = state.courses.map(c =>
    `<option value="${c.id}">${c.name} (${c.code})</option>`
  ).join('');
}

function populateSavedSessions() {
  const select = document.getElementById('saved-sessions-select');
  if (!select) return;

  if (state.savedSessions.length === 0) {
    select.innerHTML = '<option value="">Belum ada papan tersimpan</option>';
    return;
  }

  select.innerHTML = '<option value="">Pilih papan tersimpan...</option>' +
    state.savedSessions.map(s => {
      const statusLabel = s.status === 'live' ? '🔴 LIVE' : s.status === 'ended' ? '✅ Selesai' : '📝 Draft';
      return `<option value="${s.id}">${s.title} — ${statusLabel} (${s.code})</option>`;
    }).join('');
}

function renderHistoryList() {
  const container = document.getElementById('recent-recordings-list');
  const badge = document.getElementById('rec-count-badge');
  if (!container) return;

  if (state.historyList.length === 0) {
    container.innerHTML = '<div class="px-4 py-2 text-xs text-slate-400 italic">Belum ada rekaman sesi.</div>';
    if (badge) badge.textContent = '0';
    return;
  }

  if (badge) badge.textContent = String(state.historyList.length);

  container.innerHTML = state.historyList.map((h, i) => {
    const date = h.startedAt ? new Date(h.startedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    return `
      <button class="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer text-left"
              onclick="viewReplay('${h.id}')">
        <i data-lucide="play-circle" class="w-4 h-4 text-brand-purple shrink-0"></i>
        <div class="overflow-hidden">
          <span class="text-xs font-semibold text-slate-700 block truncate">${h.title || 'Rekaman ' + (i + 1)}</span>
          <span class="text-[10px] text-slate-400">${date}</span>
        </div>
      </button>
    `;
  }).join('');

  lucide.createIcons();
}

async function checkLiveSessions() {
  // Check history for any live sessions the student can join
  const liveSession = state.historyList.find(s => s.status === 'live');
  const banner = document.getElementById('live-session-banner');
  if (!banner) return;

  if (liveSession) {
    banner.classList.remove('hidden');
    document.getElementById('live-banner-title').textContent =
      `${liveSession.title} — ${liveSession.host?.name || 'Dosen'}`;
    
    // Wire the join button
    document.getElementById('btn-banner-join').onclick = () => {
      if (liveSession.code) joinSessionByCode(liveSession.code);
    };
  } else {
    banner.classList.add('hidden');
  }
}

window.viewReplay = function(sessionId) {
  showToast('Fitur replay akan segera hadir!', 'info');
};

// ==================== EVENT LISTENERS UI ====================
function initUIEventListeners() {
  // Role switcher dropdown
  const roleBtn = document.getElementById('role-switch-btn');
  const roleMenu = document.getElementById('role-menu');
  roleBtn.addEventListener('click', () => roleMenu.classList.toggle('hidden'));
  document.addEventListener('click', (e) => {
    if (!roleBtn.contains(e.target) && !roleMenu.contains(e.target)) {
      roleMenu.classList.add('hidden');
    }
  });

  // ---- MOBILE SIDEBAR DRAWER ----
  const sidebar = document.getElementById('main-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  document.getElementById('btn-open-sidebar').addEventListener('click', () => {
    sidebar.classList.add('open');
    backdrop.classList.add('backdrop-active');
  });

  document.getElementById('btn-close-sidebar').addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);

  function closeSidebar() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('backdrop-active');
  }

  // ---- MOBILE TOOLS PANEL TOGGLE ----
  document.getElementById('btn-mobile-tools-trigger').addEventListener('click', () => {
    const panel = document.getElementById('drawing-tools-panel');
    panel.classList.toggle('mobile-open');
  });

  // Close tools panel when clicking collapse button on mobile
  document.getElementById('btn-collapse-tools').addEventListener('click', () => {
    const panel = document.getElementById('drawing-tools-panel');
    // On mobile: close slide-over
    if (window.innerWidth < 768) {
      panel.classList.remove('mobile-open');
    } else {
      // On desktop: toggle hidden
      state.toolsPanelOpen = !state.toolsPanelOpen;
      panel.classList.toggle('hidden');
    }
  });

  // Mahasiswa: Gabung via Kode
  document.getElementById('btn-student-join').addEventListener('click', () => {
    const code = document.getElementById('student-join-code-input').value.trim();
    if (!code) return showToast('Masukkan kode sesi terlebih dahulu.', 'warning');
    joinSessionByCode(code);
  });

  document.getElementById('student-join-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-student-join').click();
  });

  // Mahasiswa: Buka Kamera QR → Open modal with scanner
  document.getElementById('btn-open-camera').addEventListener('click', () => {
    openQRScannerModal();
  });

  // QR File upload
  document.getElementById('qr-file-input').addEventListener('change', handleQRFileUpload);

  // Dosen: Buat & Host Sesi Baru
  document.getElementById('btn-create-and-host').addEventListener('click', async () => {
    const title = document.getElementById('lecturer-board-title').value.trim() || 'Kalkulus Dasar';
    const courseSelect = document.getElementById('lecturer-course-select');
    const courseCode = courseSelect.value || '';
    
    if (!courseCode) {
      return showToast('Pilih mata kuliah terlebih dahulu.', 'warning');
    }
    await createAndHostSession(title, courseCode);
  });

  document.getElementById('btn-host-saved').addEventListener('click', () => {
    const savedSelect = document.getElementById('saved-sessions-select');
    const sessionId = savedSelect?.value;
    if (!sessionId) {
      return showToast('Pilih papan tersimpan terlebih dahulu.', 'warning');
    }
    hostSavedSession(sessionId);
  });

  // Modal QR Code
  document.getElementById('qr-modal-close').addEventListener('click', () => {
    closeQRModal();
  });

  document.getElementById('btn-show-qr').addEventListener('click', () => {
    if (state.activeSession?.qrDataUrl) {
      // Show QR image mode (dosen sharing)
      document.getElementById('qr-image-container').classList.remove('hidden');
      document.getElementById('qr-scanner-container').classList.add('hidden');
      document.getElementById('qr-modal-title').textContent = 'QR Code Sesi';
      document.getElementById('qr-modal-desc').textContent = 'Scan menggunakan kamera HP untuk langsung bergabung';
      document.getElementById('qr-modal-img').src = state.activeSession.qrDataUrl;
      document.getElementById('qr-modal-code').innerText = state.activeSession.code;
      document.getElementById('qr-modal').classList.remove('hidden');
    }
  });

  // Keluar dari Board
  document.getElementById('btn-leave-board').addEventListener('click', () => {
    if (confirm('Keluar dari ruang whiteboard?')) {
      leaveBoardRoom();
    }
  });

  // Akhiri Sesi (Dosen)
  document.getElementById('btn-end-session').addEventListener('click', async () => {
    if (!confirm('Akhiri sesi ini? Seluruh rekaman akan disimpan dan akses live ditutup.')) return;
    await endSession();
  });

  // Mode Izin Toggle (Dosen)
  const btnViewOnly = document.getElementById('btn-mode-view-only');
  const btnStudentWrite = document.getElementById('btn-mode-student-write');

  btnViewOnly.addEventListener('click', async () => {
    await updateAccessMode('view_only');
    btnViewOnly.className = 'px-3 py-0.5 rounded-full bg-white text-slate-800 shadow-sm transition cursor-pointer';
    btnStudentWrite.className = 'px-3 py-0.5 rounded-full text-slate-500 hover:text-slate-800 transition cursor-pointer';
  });

  btnStudentWrite.addEventListener('click', async () => {
    await updateAccessMode('student_write');
    btnStudentWrite.className = 'px-3 py-0.5 rounded-full bg-white text-slate-800 shadow-sm transition cursor-pointer';
    btnViewOnly.className = 'px-3 py-0.5 rounded-full text-slate-500 hover:text-slate-800 transition cursor-pointer';
  });

  // Students Drawer Toggle (Expand/Collapse - Screen 3 & 4)
  const btnToggleStudents = document.getElementById('btn-toggle-students');
  const studentsExpanded = document.getElementById('students-expanded-card');
  const studentsCollapsed = document.getElementById('students-collapsed-pill');

  btnToggleStudents.addEventListener('click', () => {
    studentsExpanded.classList.add('hidden');
    studentsCollapsed.classList.remove('hidden');
  });

  studentsCollapsed.addEventListener('click', () => {
    studentsCollapsed.classList.add('hidden');
    studentsExpanded.classList.remove('hidden');
  });

  // Drawing Tools Toggle (Paint vs Eraser)
  const toolPaint = document.getElementById('tool-paint');
  const toolEraser = document.getElementById('tool-eraser');
  const statusLabel = document.getElementById('active-tool-status');

  toolPaint.addEventListener('click', () => {
    state.tool = 'pen';
    toolPaint.className = 'py-2.5 px-3 rounded-xl bg-white text-brand-purple shadow-sm font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer';
    toolEraser.className = 'py-2.5 px-3 rounded-xl text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer';
    statusLabel.innerHTML = '<span class="w-2 h-2 rounded-full bg-brand-purple"></span><span><strong class="font-mono">B</strong> Paint is active</span>';
    updateBrushPreview();
  });

  toolEraser.addEventListener('click', () => {
    state.tool = 'eraser';
    toolEraser.className = 'py-2.5 px-3 rounded-xl bg-white text-brand-purple shadow-sm font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer';
    toolPaint.className = 'py-2.5 px-3 rounded-xl text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer';
    statusLabel.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500"></span><span><strong class="font-mono">E</strong> Eraser is active</span>';
    updateBrushPreview();
  });

  // Sliders: Size & Opacity
  const brushSize = document.getElementById('brush-size');
  brushSize.addEventListener('input', (e) => {
    state.size = parseInt(e.target.value, 10);
    document.getElementById('size-value-label').innerText = `${state.size} px`;
    updateBrushPreview();
  });

  const brushOpacity = document.getElementById('brush-opacity');
  brushOpacity.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    state.opacity = val / 100;
    document.getElementById('opacity-value-label').innerText = `${val}%`;
    updateBrushPreview();
  });

  // Stabilizer
  const stabilizerToggle = document.getElementById('stabilizer-toggle');
  stabilizerToggle.addEventListener('change', (e) => {
    state.stabilizerEnabled = e.target.checked;
    showToast(state.stabilizerEnabled ? 'Stabilizer garis aktif' : 'Stabilizer dinonaktifkan', 'info');
  });

  const stabilizerSlider = document.getElementById('stabilizer-slider');
  stabilizerSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    state.stabilizerAmount = val / 100;
    document.getElementById('stabilizer-value-label').innerText = `${val}%`;
  });

  // Color Hex Input
  const colorHexInput = document.getElementById('color-hex-input');
  colorHexInput.addEventListener('input', (e) => {
    const hex = '#' + e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
    if (hex.length === 7) {
      setColor(hex);
    }
  });

  // Native color picker (klik area spectrum -> color picker OS)
  const nativeColorInput = document.getElementById('color-native-input');
  if (nativeColorInput) {
    nativeColorInput.addEventListener('input', (e) => {
      setColor(e.target.value);
    });
  }

  // Klik langsung pada area gradient -> ambil warna di titik itu
  const colorSpectrum = document.getElementById('color-spectrum');
  if (colorSpectrum) {
    colorSpectrum.addEventListener('click', (e) => {
      // Biarkan input native yang menangani klik (dia menutupi seluruh area),
      // tapi kalau tidak didukung, hitung warna dari posisi klik.
      if (e.target === nativeColorInput) return;
      const rect = colorSpectrum.getBoundingClientRect();
      const hue = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 360;
      const light = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setColor(hslToHex(hue, 1, Math.max(0.02, light * 0.95)));
    });
  }

  // Saved Color Dots
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const col = dot.getAttribute('data-color');
      setColor(col);
    });
  });

  // Tambah warna saat ini ke palet "Saved colors"
  const btnAddColor = document.getElementById('btn-add-color');
  if (btnAddColor) {
    btnAddColor.addEventListener('click', () => {
      addSavedColor(state.color);
    });
  }

  // Reset Tools Button
  document.getElementById('btn-reset-tools').addEventListener('click', () => {
    setColor('#7357E8');
    brushSize.value = 24;
    state.size = 24;
    document.getElementById('size-value-label').innerText = '24 px';
    brushOpacity.value = 100;
    state.opacity = 1.0;
    document.getElementById('opacity-value-label').innerText = '100%';
    toolPaint.click();
    updateBrushPreview();
    showToast('Pengaturan kuas di-reset.', 'info');
  });

  // Keyboard Shortcuts: B for Brush, E for Eraser, Ctrl+Z for Undo
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === 'b' || e.key === 'B') toolPaint.click();
    if (e.key === 'e' || e.key === 'E') toolEraser.click();
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      handleUndo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      handleRedo();
    }
  });

  // Canvas Actions: Undo, Redo, Clear
  document.getElementById('btn-undo').addEventListener('click', handleUndo);
  document.getElementById('btn-redo').addEventListener('click', handleRedo);
  document.getElementById('btn-clear').addEventListener('click', handleClearPage);

  // Zoom Controls
  document.getElementById('btn-zoom-in').addEventListener('click', () => setZoom(state.zoom + 0.15));
  document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(state.zoom - 0.15));
  document.getElementById('btn-zoom-reset').addEventListener('click', () => setZoom(1.0));
}

function setColor(hex) {
  state.color = hex;
  document.getElementById('color-hex-input').value = hex.replace('#', '').toUpperCase();
  document.getElementById('color-preview-circle').style.backgroundColor = hex;

  // Sinkronkan native color input & penanda di area gradient
  const nativeInput = document.getElementById('color-native-input');
  if (nativeInput) nativeInput.value = hex;
  const cursor = document.getElementById('color-spectrum-cursor');
  if (cursor) {
    cursor.style.backgroundColor = hex;
    const pos = hexToSpectrumPos(hex);
    cursor.style.left = `${pos.x}%`;
    cursor.style.top = `${pos.y}%`;
  }

  // Update active dot ring
  document.querySelectorAll('.color-dot').forEach(dot => {
    if (dot.getAttribute('data-color').toUpperCase() === hex.toUpperCase()) {
      dot.className = 'color-dot w-6 h-6 rounded-full ring-2 ring-offset-2 ring-brand-purple transition active cursor-pointer';
    } else {
      dot.className = 'color-dot w-6 h-6 rounded-full hover:scale-110 transition cursor-pointer';
    }
  });

  updateBrushPreview();
}

// ==================== KONVERSI WARNA ====================
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60)       [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else              [r, g, b] = [c, 0, x];
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0
  };
}

// Perkiraan posisi warna pada kotak gradient (hue = X, lightness = Y)
function hexToSpectrumPos(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  const light = (max + min) / 2;
  return { x: (h / 360) * 100, y: (1 - light) * 100 };
}

// Tambahkan warna ke palet "Saved colors" (maks 8, tanpa duplikat)
function addSavedColor(hex) {
  const container = document.getElementById('saved-colors-container');
  const btnAdd = document.getElementById('btn-add-color');
  if (!container || !btnAdd) return;

  const normalized = hex.toUpperCase();
  const existing = [...container.querySelectorAll('.color-dot')]
    .map(d => d.getAttribute('data-color').toUpperCase());
  if (existing.includes(normalized)) {
    showToast('Warna itu sudah ada di saved colors.', 'info');
    return;
  }

  const MAX_SAVED = 8;
  const dots = container.querySelectorAll('.color-dot');
  if (dots.length >= MAX_SAVED) {
    showToast(`Maksimal ${MAX_SAVED} warna tersimpan. Hapus dulu salah satu.`, 'warning');
    return;
  }

  const btn = document.createElement('button');
  btn.className = 'color-dot w-6 h-6 rounded-full hover:scale-110 transition cursor-pointer';
  btn.setAttribute('data-color', normalized);
  btn.style.backgroundColor = normalized;
  btn.title = 'Klik untuk pakai, klik kanan untuk hapus';
  btn.addEventListener('click', () => setColor(normalized));
  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    btn.remove();
    showToast('Warna dihapus dari saved colors.', 'info');
  });

  container.insertBefore(btn, btnAdd);
  setColor(normalized);
  showToast(`Warna ${normalized} ditambahkan.`, 'success');
}

// ==================== QR SCANNER (CAMERA REAL) ====================
function openQRScannerModal() {
  const modal = document.getElementById('qr-modal');
  const imgContainer = document.getElementById('qr-image-container');
  const scanContainer = document.getElementById('qr-scanner-container');

  // Switch to scanner mode
  imgContainer.classList.add('hidden');
  scanContainer.classList.remove('hidden');
  document.getElementById('qr-modal-title').textContent = 'Pindai QR Code';
  document.getElementById('qr-modal-desc').textContent = 'Arahkan kamera ke QR Code sesi yang dibagikan dosen';
  document.getElementById('qr-modal-code').innerText = '------';
  modal.classList.remove('hidden');

  startCameraScanner();
}

function closeQRModal() {
  document.getElementById('qr-modal').classList.add('hidden');
  stopCameraScanner();
}

async function startCameraScanner() {
  const video = document.getElementById('qr-video');
  const scanCanvas = document.getElementById('qr-scan-canvas');
  const statusEl = document.getElementById('camera-status');
  const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

  try {
    // Request camera — prefer rear camera on mobile
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
    });
    
    state.cameraStream = stream;
    video.srcObject = stream;
    
    // Wait for video to actually start playing
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    if (statusEl) statusEl.textContent = 'Kamera aktif — arahkan ke QR Code...';

    // Start scanning loop
    function scanFrame() {
      if (!state.cameraStream) return; // stopped

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        scanCanvas.width = video.videoWidth;
        scanCanvas.height = video.videoHeight;
        scanCtx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);

        const imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);

        // jsQR library decode
        if (typeof jsQR === 'function') {
          const qrResult = jsQR(imageData.data, scanCanvas.width, scanCanvas.height, {
            inversionAttempts: 'dontInvert'
          });

          if (qrResult && qrResult.data) {
            // Successfully decoded!
            const code = extractCodeFromQR(qrResult.data);
            if (code) {
              if (statusEl) statusEl.textContent = `✅ QR terbaca: ${code}`;
              closeQRModal();
              joinSessionByCode(code);
              return; // stop scanning
            }
          }
        }
      }

      state.scanAnimFrame = requestAnimationFrame(scanFrame);
    }

    state.scanAnimFrame = requestAnimationFrame(scanFrame);

  } catch (err) {
    console.error('Camera error:', err);
    if (statusEl) statusEl.textContent = '❌ Kamera gagal: ' + (err.message || 'Izin ditolak');
    showToast('Gagal mengakses kamera. Pastikan izin kamera diizinkan, atau gunakan upload foto QR.', 'error');
  }
}

function stopCameraScanner() {
  // Stop scan loop
  if (state.scanAnimFrame) {
    cancelAnimationFrame(state.scanAnimFrame);
    state.scanAnimFrame = null;
  }

  // Stop camera tracks
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }

  const video = document.getElementById('qr-video');
  if (video) video.srcObject = null;
}

function extractCodeFromQR(rawData) {
  // QR may contain full URL like http://localhost:4000/join?code=ABC123
  // or just the plain code "ABC123"
  if (!rawData) return null;

  try {
    if (rawData.includes('code=')) {
      const url = new URL(rawData);
      const code = url.searchParams.get('code');
      if (code) return code.trim();
    }
  } catch (e) {
    // Not a valid URL — might be query string fragment
    const match = rawData.match(/code=([A-Za-z0-9]+)/);
    if (match) return match[1].trim();
  }

  // Fallback: treat raw data as the code itself (if it looks like a session code)
  const cleaned = rawData.trim();
  if (cleaned.length >= 4 && cleaned.length <= 12 && /^[A-Za-z0-9]+$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

function handleQRFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const img = new Image();
    img.onload = function() {
      // Draw image to hidden canvas and scan
      const scanCanvas = document.getElementById('qr-scan-canvas');
      const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
      scanCanvas.width = img.width;
      scanCanvas.height = img.height;
      scanCtx.drawImage(img, 0, 0);

      const imageData = scanCtx.getImageData(0, 0, img.width, img.height);

      if (typeof jsQR === 'function') {
        const qrResult = jsQR(imageData.data, img.width, img.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (qrResult && qrResult.data) {
          const code = extractCodeFromQR(qrResult.data);
          if (code) {
            showToast(`QR terbaca dari file: ${code}`, 'success');
            closeQRModal();
            joinSessionByCode(code);
            return;
          }
        }
      }

      showToast('Tidak dapat membaca QR dari file ini. Coba foto yang lebih jelas.', 'warning');
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);

  // Reset input so same file can be re-selected
  e.target.value = '';
}

// ==================== SESI MANAGEMENT & API ====================
async function createAndHostSession(title, courseId) {
  try {
    // 1. Buat sesi
    const createRes = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.currentUser.token}`
      },
      body: JSON.stringify({ courseId, title })
    });

    const sessionData = await createRes.json();
    if (!createRes.ok) throw new Error(sessionData.error?.message || 'Gagal membuat sesi');

    // 2. Start Sesi
    const startRes = await fetch(`/api/sessions/${sessionData.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.currentUser.token}` }
    });
    const startedData = await startRes.json();

    state.activeSession = {
      ...startedData,
      qrDataUrl: sessionData.qrDataUrl,
      canWrite: true
    };

    enterBoardRoom();
    showToast(`Sesi "${sessionData.title}" dimulai! Kode: ${sessionData.code}`, 'success');
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
}

async function hostSavedSession(sessionId) {
  try {
    const startRes = await fetch(`/api/sessions/${sessionId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.currentUser.token}` }
    });
    const startedData = await startRes.json();
    if (!startRes.ok) throw new Error(startedData.error?.message || 'Gagal memulai sesi');

    // Get session details with QR
    const detailRes = await fetch(`/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${state.currentUser.token}` }
    });
    const detailData = await detailRes.json();

    state.activeSession = {
      ...startedData,
      ...detailData,
      qrDataUrl: detailData.qrDataUrl,
      canWrite: true
    };

    enterBoardRoom();
    showToast(`Sesi "${startedData.title}" dimulai! Kode: ${startedData.code}`, 'success');
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
}

async function joinSessionByCode(code) {
  try {
    const res = await fetch('/api/sessions/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.currentUser.token}`
      },
      body: JSON.stringify({ code })
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403) return showToast('Akses ditolak: Anda tidak terdaftar di kelas ini.', 'error');
      if (res.status === 404) return showToast('Kode sesi tidak ditemukan.', 'error');
      if (res.status === 410) return showToast('Sesi telah selesai / kedaluwarsa.', 'warning');
      throw new Error(data.error?.message || 'Gagal bergabung');
    }

    state.activeSession = {
      ...data,
      canWrite: data.me?.canWrite || data.accessMode === 'student_write'
    };

    enterBoardRoom();
    showToast(`Berhasil bergabung ke sesi ${data.title}!`, 'success');
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
}

async function updateAccessMode(accessMode) {
  if (!state.activeSession?.id) return;
  try {
    const res = await fetch(`/api/sessions/${state.activeSession.id}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.currentUser.token}`
      },
      body: JSON.stringify({ accessMode })
    });
    if (res.ok) {
      showToast(`Izin board diubah ke: ${accessMode === 'student_write' ? 'Mahasiswa Boleh Menulis' : 'Hanya Lihat'}`, 'info');
    }
  } catch (err) {
    console.error(err);
  }
}

async function endSession() {
  if (!state.activeSession?.id) return;
  try {
    const res = await fetch(`/api/sessions/${state.activeSession.id}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.currentUser.token}` }
    });
    if (res.ok) {
      showToast('Sesi resmi diakhiri. Seluruh rekaman tersimpan rapi.', 'success');
      leaveBoardRoom();
    }
  } catch (err) {
    console.error(err);
  }
}

// ==================== WHITEBOARD ROOM LOGIC & SOCKET ====================
function enterBoardRoom() {
  document.getElementById('dashboard-layout').classList.add('hidden');
  document.getElementById('whiteboard-room-layout').classList.remove('hidden');

  // Set Info Header
  document.getElementById('board-host-name').innerText = state.activeSession.host?.name || state.currentUser.name;
  document.getElementById('board-course-name').innerText = state.activeSession.course?.name || state.activeSession.title;
  document.getElementById('board-code-badge').innerText = state.activeSession.code;

  // Sembunyikan toggle izin jika user adalah mahasiswa
  const permToggle = document.getElementById('lecturer-permission-toggle');
  const endBtn = document.getElementById('btn-end-session');
  if (state.currentUser.role === 'dosen') {
    permToggle.classList.remove('hidden');
    endBtn.classList.remove('hidden');
  } else {
    permToggle.classList.add('hidden');
    endBtn.classList.add('hidden');
  }

  // Resize Canvas
  resizeCanvas();

  // Sesi baru = belum ada peserta. Render kondisi kosong dulu,
  // daftar terisi otomatis begitu mahasiswa scan & join.
  state.students = [];
  renderStudentsList();

  // Koneksi Socket.IO
  connectSocket();
}

function leaveBoardRoom() {
  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }
  state.activeSession = null;
  state.objects = [];
  state.students = [];
  state.pendingOps.clear();
  state.undoStack = [];
  state.redoStack = [];
  renderStudentsList();
  redrawCanvas();

  document.getElementById('whiteboard-room-layout').classList.add('hidden');
  document.getElementById('dashboard-layout').classList.remove('hidden');

  // Reload dashboard data
  loadDashboardData();
}

function connectSocket() {
  if (state.socket) state.socket.disconnect();

  state.socket = io({
    auth: { token: state.currentUser.token },
    transports: ['websocket', 'polling']
  });

  state.socket.on('connect', () => {
    console.log('[Socket Connected]', state.socket.id);
    state.socket.emit('session:join', { sessionId: state.activeSession.id }, (res) => {
      if (!res || !res.ok) {
        showToast(res?.message || 'Gagal masuk sesi.', 'error');
        return;
      }
      console.log('[Session Joined]', res);

      // Tanpa afterSeq server membalas `state` penuh (bukan `events`).
      // Muat keduanya supaya papan lama langsung tampil dan tidak kosong.
      if (res.state) {
        loadBoardSnapshot(res.state);
      }
      if (res.events) {
        res.events.forEach((ev) => applyRemoteOp(ev));
      }

      // Sinkronkan daftar peserta dari server
      loadParticipants();
    });
  });

  // Menerima coretan peserta lain secara real-time
  state.socket.on('board:op', (ev) => {
    console.log('[Remote Op]', ev);
    applyRemoteOp(ev);
  });

  // Presensi berubah (ada yang join/leave) -> muat ulang daftar peserta
  state.socket.on('participants:update', () => {
    loadParticipants();
  });

  // Notifikasi perubahan izin akses
  state.socket.on('session:settings', (settings) => {
    if (settings.accessMode) {
      state.activeSession.accessMode = settings.accessMode;
      const canWriteNow = state.currentUser.role === 'dosen' || settings.accessMode === 'student_write';
      state.activeSession.canWrite = canWriteNow;
      showToast(canWriteNow ? 'Dosen mengizinkan mahasiswa menulis.' : 'Papan sekarang dalam mode lihat-saja.', 'info');
    }
  });

  // Notifikasi status sesi (Ended)
  state.socket.on('session:status', (s) => {
    if (s.status === 'ended') {
      showToast('Sesi telah diakhiri oleh dosen.', 'warning');
      state.activeSession.canWrite = false;
    }
  });
}

function applyRemoteOp(ev) {
  if (!ev || !ev.op) return;
  const op = ev.op;

  // Server memantulkan board:op ke semua peserta, termasuk pengirim.
  // Op yang kita terapkan sendiri punya clientOpId di pendingOps -> abaikan.
  if (ev.clientOpId && state.pendingOps.has(ev.clientOpId)) {
    state.pendingOps.delete(ev.clientOpId);
    return;
  }

  if (op.type === 'object.add' && op.object) {
    // Jaga-jaga: jangan tambah objek dengan id yang sudah ada
    if (!state.objects.some(o => o.id === op.object.id)) {
      state.objects.push(op.object);
    }
  } else if (op.type === 'object.update' && op.id) {
    const target = state.objects.find(o => o.id === op.id);
    if (target) Object.assign(target, op.patch || {});
  } else if (op.type === 'page.clear') {
    state.objects = [];
    state.undoStack = [];
    state.redoStack = [];
  } else if (op.type === 'object.remove' && op.ids) {
    state.objects = state.objects.filter(o => !op.ids.includes(o.id));
  }

  redrawCanvas();
}

// Muat state papan penuh dari server (balasan session:join -> res.state)
function loadBoardSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.pages)) return;
  const page = snapshot.pages[state.currentPage] || snapshot.pages[0];
  state.objects = (page && page.objects) ? page.objects.slice() : [];
  state.undoStack = [];
  state.redoStack = [];
  redrawCanvas();
}

// ==================== CANVAS DRAWING ENGINE ====================
let canvas, ctx;

function initCanvas() {
  canvas = document.getElementById('whiteboard-canvas');
  ctx = canvas.getContext('2d');

  window.addEventListener('resize', resizeCanvas);

  // Pointer Events untuk dukungan Mouse, Touch, dan Stylus
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  // Zoom with mouse wheel
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom(state.zoom + delta);
  }, { passive: false });
}

function resizeCanvas() {
  const container = document.getElementById('canvas-container');
  if (!container || !canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  ctx.scale(dpr, dpr);
  redrawCanvas();
}

function onPointerDown(e) {
  // Cek hak menulis
  if (state.activeSession && !state.activeSession.canWrite) {
    showToast('Mode lihat-saja aktif. Anda tidak memiliki izin menulis.', 'warning');
    return;
  }

  canvas.setPointerCapture(e.pointerId);
  state.isDrawing = true;

  const pt = getCanvasPoint(e);

  state.currentStroke = {
    id: `strk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    kind: 'stroke',
    tool: state.tool,
    color: state.color,
    size: state.size,
    opacity: state.opacity,
    points: [[pt.x, pt.y]]
  };

  ctx.beginPath();
  ctx.moveTo(pt.x, pt.y);
}

function onPointerMove(e) {
  if (!state.isDrawing || !state.currentStroke) return;

  const rawPt = getCanvasPoint(e);
  let pt = rawPt;

  // Terapkan Stabilizer smoothing jika diaktifkan
  if (state.stabilizerEnabled) {
    const pts = state.currentStroke.points;
    const lastPt = pts[pts.length - 1];
    const weight = state.stabilizerAmount; // 0.35
    pt = {
      x: lastPt[0] + (rawPt.x - lastPt[0]) * (1 - weight),
      y: lastPt[1] + (rawPt.y - lastPt[1]) * (1 - weight)
    };
  }

  state.currentStroke.points.push([pt.x, pt.y]);

  // Gambar segmen terakhir langsung ke layar
  renderSegment(ctx, state.currentStroke, state.currentStroke.points.length - 2);
}

function onPointerUp(e) {
  if (!state.isDrawing || !state.currentStroke) return;
  state.isDrawing = false;
  canvas.releasePointerCapture(e.pointerId);

  const strokeObj = { ...state.currentStroke };
  state.objects.push(strokeObj);
  state.undoStack.push(strokeObj);
  state.redoStack = [];

  // Broadcast ke backend via Socket.IO
  if (state.socket) {
    const clientOpId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    state.pendingOps.add(clientOpId);
    state.socket.emit('board:op', {
      clientOpId,
      op: {
        type: 'object.add',
        page: state.currentPage,
        object: strokeObj
      }
    }, (res) => {
      if (res && !res.ok) {
        state.pendingOps.delete(clientOpId);
        showToast(res.message || res.error || 'Aksi ditolak server.', 'error');
      }
    });
  }

  state.currentStroke = null;
  redrawCanvas();
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - state.panX) / state.zoom,
    y: (e.clientY - rect.top - state.panY) / state.zoom
  };
}

function renderSegment(context, stroke, idx) {
  if (!stroke.points || stroke.points.length < 2 || idx < 0) return;
  const p1 = stroke.points[idx];
  const p2 = stroke.points[idx + 1];

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = stroke.size * state.zoom;

  if (stroke.tool === 'eraser') {
    context.globalCompositeOperation = 'destination-out';
    context.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = stroke.color;
    context.globalAlpha = stroke.opacity || 1.0;
  }

  context.beginPath();
  context.moveTo(p1[0] * state.zoom + state.panX, p1[1] * state.zoom + state.panY);
  context.lineTo(p2[0] * state.zoom + state.panX, p2[1] * state.zoom + state.panY);
  context.stroke();
  context.restore();
}

// ==================== GRID BACKGROUND ====================
function drawGrid(context, w, h) {
  const gridSize = 32; // px per cell
  const scaledGrid = gridSize * state.zoom;

  // Offset for pan
  const offsetX = (state.panX % scaledGrid + scaledGrid) % scaledGrid;
  const offsetY = (state.panY % scaledGrid + scaledGrid) % scaledGrid;

  context.save();
  context.strokeStyle = '#EEF2F6';
  context.lineWidth = 1;

  // Vertical lines
  for (let x = offsetX; x <= w; x += scaledGrid) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, h);
    context.stroke();
  }

  // Horizontal lines
  for (let y = offsetY; y <= h; y += scaledGrid) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(w, y);
    context.stroke();
  }

  context.restore();
}

function redrawCanvas() {
  if (!canvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  // Clear to white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  // Draw grid background
  drawGrid(ctx, w, h);

  // Render semua objek
  for (const obj of state.objects) {
    if (obj.kind === 'stroke') {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = obj.size * state.zoom;

      if (obj.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = obj.color;
        ctx.globalAlpha = obj.opacity || 1.0;
      }

      ctx.beginPath();
      for (let i = 0; i < obj.points.length; i++) {
        const x = obj.points[i][0] * state.zoom + state.panX;
        const y = obj.points[i][1] * state.zoom + state.panY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ==================== UNDO, REDO, CLEAR ====================
// undoStack = objek yang saya buat sendiri, urut pembuatan.
// Undo mengambil objek terakhir MILIK SAYA (bukan sembarang objek terakhir),
// karena server menolak menghapus coretan milik orang lain (NOT_OWNER).
function handleUndo() {
  if (state.undoStack.length === 0) {
    showToast('Tidak ada yang bisa di-undo.', 'info');
    return;
  }

  const target = state.undoStack.pop();
  state.redoStack.push(target);
  state.objects = state.objects.filter(o => o.id !== target.id);
  redrawCanvas();

  if (state.socket) {
    const clientOpId = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    state.pendingOps.add(clientOpId);
    state.socket.emit('board:op', {
      clientOpId,
      op: {
        type: 'object.remove',
        page: state.currentPage,
        ids: [target.id]
      }
    }, (res) => {
      if (res && !res.ok) {
        state.pendingOps.delete(clientOpId);
        // Server menolak -> kembalikan ke layar agar state tidak bohong
        state.undoStack.push(target);
        state.redoStack = state.redoStack.filter(o => o.id !== target.id);
        if (!state.objects.some(o => o.id === target.id)) state.objects.push(target);
        redrawCanvas();
        showToast(res.message || 'Undo ditolak server.', 'error');
      }
    });
  }
}

function handleRedo() {
  if (state.redoStack.length === 0) {
    showToast('Tidak ada yang bisa di-redo.', 'info');
    return;
  }

  const restored = state.redoStack.pop();
  state.undoStack.push(restored);
  if (!state.objects.some(o => o.id === restored.id)) state.objects.push(restored);
  redrawCanvas();

  if (state.socket) {
    const clientOpId = `redo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    state.pendingOps.add(clientOpId);
    state.socket.emit('board:op', {
      clientOpId,
      op: {
        type: 'object.add',
        page: state.currentPage,
        object: restored
      }
    }, (res) => {
      if (res && !res.ok) {
        state.pendingOps.delete(clientOpId);
        state.objects = state.objects.filter(o => o.id !== restored.id);
        state.redoStack.push(restored);
        state.undoStack = state.undoStack.filter(o => o.id !== restored.id);
        redrawCanvas();
        showToast(res.message || 'Redo ditolak server.', 'error');
      }
    });
  }
}

function handleClearPage() {
  if (!confirm('Bersihkan seluruh halaman board?')) return;
  state.objects = [];
  state.undoStack = [];
  state.redoStack = [];
  redrawCanvas();

  if (state.socket) {
    state.socket.emit('board:op', {
      op: {
        type: 'page.clear',
        page: state.currentPage
      }
    });
  }
  showToast('Papan telah dibersihkan.', 'info');
}

function setZoom(val) {
  state.zoom = Math.max(0.25, Math.min(3.0, val));
  document.getElementById('zoom-label').innerText = `${Math.round(state.zoom * 100)}%`;
  redrawCanvas();
}

// ==================== BRUSH PREVIEW LINE ====================
function updateBrushPreview() {
  const pCanvas = document.getElementById('brush-preview-canvas');
  if (!pCanvas) return;
  const pCtx = pCanvas.getContext('2d');
  const w = pCanvas.width;
  const h = pCanvas.height;

  pCtx.clearRect(0, 0, w, h);

  pCtx.save();
  pCtx.lineCap = 'round';
  pCtx.lineJoin = 'round';
  pCtx.lineWidth = Math.min(32, state.size * 0.7);

  if (state.tool === 'eraser') {
    pCtx.strokeStyle = '#94a3b8';
    pCtx.setLineDash([4, 4]);
  } else {
    pCtx.strokeStyle = state.color;
    pCtx.globalAlpha = state.opacity;
  }

  // Gambar garis lengkung S-curve estetik
  pCtx.beginPath();
  pCtx.moveTo(20, h / 2 + 5);
  pCtx.bezierCurveTo(w * 0.35, -5, w * 0.65, h + 5, w - 20, h / 2 - 5);
  pCtx.stroke();
  pCtx.restore();
}

// ==================== DAFTAR MAHASISWA (STUDENTS DRAWER) ====================
// Ambil peserta asli dari server. Hanya dosen pemilik sesi yang boleh
// memanggil endpoint ini (requireRole('dosen')), jadi untuk mahasiswa dilewati.
async function loadParticipants() {
  if (!state.activeSession?.id || !state.currentUser.token) return;
  if (state.currentUser.role !== 'dosen') return;

  try {
    const res = await fetch(`/api/sessions/${state.activeSession.id}/participants`, {
      headers: { Authorization: `Bearer ${state.currentUser.token}` }
    });
    if (!res.ok) return;

    const json = await res.json();
    const rows = Array.isArray(json.data) ? json.data : [];

    state.students = rows.map(p => ({
      id: p.userId,
      name: p.name || 'Mahasiswa',
      canWrite: !!p.canWrite,
      online: !!p.online,
      status: p.canWrite ? 'Can write' : 'Watching',
      avatar: avatarFor(p.name, p.userId)
    }));

    renderStudentsList();
  } catch (err) {
    console.warn('[participants] gagal memuat:', err);
  }
}

// Avatar inisial (tanpa dependensi eksternal)
function avatarFor(name, seed) {
  const initials = (name || 'M').trim().split(/\s+/).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const colors = ['#7357E8', '#2563EB', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];
  let hash = 0;
  for (const ch of String(seed || name || '')) hash = (hash + ch.charCodeAt(0)) % colors.length;
  const bg = colors[hash];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${bg}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="bold" fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function renderStudentsList() {
  const container = document.getElementById('students-cards-container');
  if (!container) return;

  const count = state.students.length;

  // Badge jumlah + teks status
  const badge = document.getElementById('students-count-badge');
  if (badge) badge.textContent = String(count);

  const statusText = document.getElementById('students-status-text');
  if (statusText) {
    statusText.textContent = count === 0
      ? 'Menunggu mahasiswa bergabung…'
      : `${count} mahasiswa tergabung`;
  }

  // Pill saat drawer diciutkan
  const collapsedCount = document.getElementById('collapsed-count');
  if (collapsedCount) collapsedCount.textContent = String(count);

  const collapsedAvatars = document.getElementById('collapsed-avatars');
  if (collapsedAvatars) {
    collapsedAvatars.innerHTML = state.students.slice(0, 3).map(s =>
      `<img class="inline-block h-5 w-5 rounded-full ring-2 ring-white" src="${s.avatar}" alt="${s.name}"/>`
    ).join('');
  }

  // Kondisi kosong: sesi baru, belum ada yang scan
  if (count === 0) {
    container.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center gap-1.5 py-5 text-center">
        <i data-lucide="users" class="w-5 h-5 text-slate-300"></i>
        <p class="text-xs font-semibold text-slate-500">Belum ada mahasiswa</p>
        <p class="text-[10px] text-slate-400">Bagikan QR code — daftar ini terisi otomatis saat mereka scan.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = state.students.map(s => `
    <div class="p-2.5 rounded-2xl border ${s.canWrite ? 'border-2 border-brand-purple bg-brand-purple-50' : 'border-slate-200 bg-white'} hover:border-brand-purple/50 transition flex items-center justify-between gap-2">
      <div class="flex items-center gap-2.5 overflow-hidden">
        <div class="relative w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
          <img src="${s.avatar}" class="w-full h-full object-cover" alt="${s.name}">
          <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${s.online ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
        </div>
        <div class="overflow-hidden">
          <p class="text-xs font-bold text-slate-800 truncate">${s.name}</p>
          <span class="text-[10px] ${s.canWrite ? 'text-brand-purple font-bold' : 'text-emerald-600 font-medium'}">${s.canWrite ? 'Can write' : 'Watching'}</span>
        </div>
      </div>
      ${state.currentUser.role === 'dosen' ? `
        <button onclick="toggleStudentPermission('${s.id}')" class="p-1 rounded text-slate-400 hover:text-brand-purple transition" title="${s.canWrite ? 'Cabut izin tulis' : 'Beri izin tulis'}">
          <i data-lucide="${s.canWrite ? 'check-circle-2' : 'edit-3'}" class="w-3.5 h-3.5"></i>
        </button>
      ` : ''}
    </div>
  `).join('');

  lucide.createIcons();
}

window.toggleStudentPermission = async function(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  student.canWrite = !student.canWrite;
  student.status = student.canWrite ? 'Can write' : 'Watching';

  renderStudentsList();
  showToast(`Izin tulis ${student.name} ${student.canWrite ? 'diberikan' : 'dicabut'}.`, 'info');

  if (state.activeSession?.id) {
    try {
      await fetch(`/api/sessions/${state.activeSession.id}/participants/${student.id}/write`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.currentUser.token}`
        },
        body: JSON.stringify({ allowed: student.canWrite })
      });
    } catch (e) {
      console.warn('API error:', e);
    }
  }
};

// ==================== TOAST NOTIFIKASI ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-slate-900 text-white'
  };

  const toast = document.createElement('div');
  toast.className = `toast-animate px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold ${bgColors[type] || bgColors.info} pointer-events-auto`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
