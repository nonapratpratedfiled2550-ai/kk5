  // ===== สารสนเทศ (Info Hub) =====
  var INFO_SCHOOL_YEAR = 2568;
  var GSHPS_AWARD_COLORS = {
    Excellence: '#8b5cf6', Millennium: '#2f80b8', Platinum: '#1a8a5a', Gold: '#c08a2b',
    'ระดับทอง': '#c08a2b', 'ระดับ Millennium': '#2f80b8', 'ระดับ Platinum': '#1a8a5a', 'ระดับ Excellence': '#8b5cf6'
  };
  var GSHPS_DEFAULT = {
    award: 'Gold',
    total: 80,
    max: 100,
    components: [
      { no: 1, name: 'นโยบายสุขภาพ', score: 9, max: 10 },
      { no: 2, name: 'สภาพแวดล้อมทางกายภาพ', score: 8, max: 10 },
      { no: 3, name: 'สภาพแวดล้อมทางสังคม', score: 8, max: 10 },
      { no: 4, name: 'สุขศึกษา', score: 9, max: 10 },
      { no: 5, name: 'สุขภาพและบริการทางการแพทย์', score: 8, max: 10 },
      { no: 6, name: 'การมีส่วนร่วมของชุมชน', score: 7, max: 10 },
      { no: 7, name: 'สุขภาพพนักงาน', score: 7, max: 10 },
      { no: 8, name: 'โภชนาการ', score: 8, max: 10 },
      { no: 9, name: 'การจัดการเหตุฉุกเฉิน', score: 8, max: 10 },
      { no: 10, name: 'การประเมินผลและติดตาม', score: 8, max: 10 }
    ]
  };
  function loadInfoHubStore() {
    try { return JSON.parse(localStorage.getItem('sh-info-hub') || '{}'); } catch (e) { return {}; }
  }
  function getGshpsResult() {
    const store = loadInfoHubStore();
    if (store.gshps && store.gshps.components && store.gshps.components.length) {
      const g = store.gshps;
      const total = g.total != null ? g.total : g.components.reduce(function(s, c) { return s + (Number(c.score) || 0); }, 0);
      const max = g.max != null ? g.max : g.components.reduce(function(s, c) { return s + (Number(c.max) || 0); }, 0);
      return { award: g.award || 'Gold', total: total, max: max, pct: max ? Math.round(total / max * 100) : 0, components: g.components };
    }
    const total = GSHPS_DEFAULT.components.reduce(function(s, c) { return s + c.score; }, 0);
    return { award: GSHPS_DEFAULT.award, total: total, max: GSHPS_DEFAULT.max, pct: Math.round(total / GSHPS_DEFAULT.max * 100), components: GSHPS_DEFAULT.components.slice() };
  }
  function getAwardDisplayName(award) {
    const map = { Gold: 'ระดับทอง (Gold)', Platinum: 'ระดับ Platinum', Millennium: 'ระดับ Millennium', Excellence: 'ระดับ Excellence' };
    return map[award] || award || '—';
  }
  function getAwardColor(award) {
    return GSHPS_AWARD_COLORS[award] || GSHPS_AWARD_COLORS[getAwardDisplayName(award)] || '#888';
  }
  function latestNutritionByStudent() {
    const records = loadNutritionRecords();
    const byId = {};
    records.forEach(function(r) {
      if (!r.id) return;
      if (!byId[r.id] || (r.savedAt || 0) > (byId[r.id].savedAt || 0)) byId[r.id] = r;
    });
    return Object.values(byId);
  }
  function computeNutritionPctStats() {
    const list = latestNutritionByStudent();
    const total = list.length;
    if (!total) return { goodHeight: null, short: null, obese: null, thin: null, sampleSize: 0 };
    let good = 0, thin = 0, obese = 0;
    list.forEach(function(r) {
      const c = getNutritionCategory(parseFloat(r.bmi));
      if (!c) return;
      if (c.label === 'ปกติ') good++;
      else if (c.label === 'ผอม' || c.label === 'ผอมมาก') thin++;
      else if (c.label === 'เริ่มอ้วน' || c.label === 'อ้วน') obese++;
    });
    return {
      goodHeight: Math.round(good / total * 100),
      thin: Math.round(thin / total * 100),
      obese: Math.round(obese / total * 100),
      short: Math.max(0, Math.round(thin / total * 100 * 0.4)),
      sampleSize: total
    };
  }
  function getInfoHealthMetrics() {
    const store = loadInfoHubStore();
    const h = store.health || {};
    const nut = computeNutritionPctStats();
    const visits = loadVisitRecords();
    const emergencies = loadEmergencyRecords();
    const illnessTotal = visits.length + emergencies.length;
    var oralRecords = loadScreeningRecords().filter(function(r) { return r.type === 'oral' && isRecordThisYear(r); });
    var physRecords = loadScreeningRecords().filter(function(r) { return r.type === 'physical' && isRecordThisYear(r); });
    var oralPct = null;
    if (oralRecords.length) {
      var oralGood = oralRecords.filter(function(r) {
        var s = r.summary || '';
        return s.indexOf('ปกติ') !== -1 || s.indexOf('ดี') !== -1 || s.indexOf('ไม่พบ') !== -1;
      }).length;
      oralPct = Math.round(oralGood / oralRecords.length * 100);
    }
    var fitnessPct = null;
    if (physRecords.length) {
      var physPass = physRecords.filter(function(r) {
        var s = r.summary || '';
        return s.indexOf('ผ่าน') !== -1 || s.indexOf('ปกติ') !== -1;
      }).length;
      fitnessPct = Math.round(physPass / physRecords.length * 100);
    }
    return {
      totalStudents: getStudentRegistryCount(),
      goodHeight: nut.sampleSize ? nut.goodHeight : (h.goodHeight != null ? h.goodHeight : 0),
      short: nut.sampleSize ? nut.short : (h.short != null ? h.short : 0),
      obese: nut.sampleSize ? nut.obese : (h.obese != null ? h.obese : 0),
      thin: nut.sampleSize ? nut.thin : (h.thin != null ? h.thin : 0),
      dentalPct: oralPct != null ? oralPct : (h.dentalPct != null ? h.dentalPct : 0),
      fitnessPct: fitnessPct != null ? fitnessPct : (h.fitnessPct != null ? h.fitnessPct : 0),
      behaviorPct: h.behaviorPct != null ? h.behaviorPct : 0,
      illnessTotal: illnessTotal,
      nutritionSample: nut.sampleSize
    };
  }
  function infoIndicatorPass(item) {
    var ok = item.val >= item.target;
    if (item.lowerIsBetter) ok = item.val <= item.target;
    return ok;
  }
  function buildInfoIndicators(metrics) {
    return [
      { no: 1, name: 'ส่วนสูง/ภาวะโภชนาการ', items: [
        { label: 'สูงดีสมส่วน', val: metrics.goodHeight, target: 57, lowerIsBetter: false },
        { label: 'เตี้ย', val: metrics.short, target: 10, lowerIsBetter: true },
        { label: 'เริ่มอ้วน/อ้วน', val: metrics.obese, target: 10, lowerIsBetter: true },
        { label: 'ผอม', val: metrics.thin, target: 5, lowerIsBetter: true }
      ]},
      { no: 2, name: 'สุขภาพช่องปาก', items: [
        { label: 'ป.6 ฟันดี (ไม่มีฟันผุ)', val: metrics.dentalPct, target: 45, lowerIsBetter: false }
      ]},
      { no: 3, name: 'สมรรถภาพทางกาย', items: [
        { label: 'ผ่านเกณฑ์สมรรถภาพ', val: metrics.fitnessPct, target: 80, lowerIsBetter: false }
      ]},
      { no: 4, name: 'โรคเรื้อรัง (NCDs)', items: [
        { label: 'ไม่มีความเสี่ยง NCDs', val: 88, target: 85, lowerIsBetter: false }
      ]},
      { no: 5, name: 'อุบัติเหตุ/เจ็บป่วย', items: [
        { label: 'อัตราเจ็บป่วย/บาดเจ็บ (ต่อ 100 คน)', val: metrics.totalStudents ? Math.round(metrics.illnessTotal / metrics.totalStudents * 100) : 0, target: 15, lowerIsBetter: true }
      ]},
      { no: 6, name: 'พฤติกรรมสุขภาพ', items: [
        { label: 'มีพฤติกรรมสุขภาพดี', val: metrics.behaviorPct, target: 50, lowerIsBetter: false }
      ]}
    ];
  }
  function renderInfoNutritionChart(metrics) {
    const el = document.getElementById('info-nutrition-chart');
    if (!el) return;
    const items = [
      { label: 'สูงดีสมส่วน', val: metrics.goodHeight, target: 57, pass: true },
      { label: 'เตี้ย', val: metrics.short, target: 10, pass: false },
      { label: 'เริ่มอ้วน/อ้วน', val: metrics.obese, target: 10, pass: false },
      { label: 'ผอม', val: metrics.thin, target: 5, pass: false }
    ];
    if (!metrics.nutritionSample) {
      el.innerHTML = '<p style="font-size:12px;color:var(--gray-mid);margin-bottom:12px;">ยังไม่มีข้อมูลชั่งน้ำหนัก/วัดส่วนสูงในระบบ</p>' +
        items.map(function(it) {
          var ok = it.pass ? it.val >= it.target : it.val <= it.target;
          var color = ok ? 'var(--green-mid)' : 'var(--red)';
          return '<div class="info-nut-row"><div class="info-nut-head"><span>' + it.label + '</span>' +
            '<span style="font-weight:700;color:' + color + ';">' + it.val + '%</span></div>' +
            '<div class="progress-bar-wrap"><div class="progress-bar" style="width:' + Math.min(it.val, 100) + '%;background:' + color + ';"></div></div>' +
            '<div class="stat-sub">เกณฑ์ ' + (it.pass ? '≥' : '≤') + it.target + '%</div></div>';
        }).join('');
      return;
    }
    el.innerHTML = items.map(function(it) {
      var ok = it.pass ? it.val >= it.target : it.val <= it.target;
      var color = ok ? 'var(--green-mid)' : 'var(--red)';
      return '<div class="info-nut-row"><div class="info-nut-head"><span>' + it.label + '</span>' +
        '<span style="font-weight:700;color:' + color + ';">' + it.val + '%</span></div>' +
        '<div class="progress-bar-wrap"><div class="progress-bar" style="width:' + Math.min(it.val, 100) + '%;background:' + color + ';"></div></div>' +
        '<div class="stat-sub">เกณฑ์ ' + (it.pass ? '≥' : '≤') + it.target + '% · จากข้อมูล ' + metrics.nutritionSample + ' คน</div></div>';
    }).join('');
  }
  function renderInfoGshpsSummaryBlock(gs) {
    const el = document.getElementById('info-gshps-summary');
    if (!el) return;
    if (!gs || !gs.total) {
      el.innerHTML = '<p style="color:var(--gray-mid);font-size:13px;text-align:center;padding:20px;">ยังไม่มีผลการประเมิน</p>';
      return;
    }
    const color = getAwardColor(gs.award);
    el.innerHTML = '<div style="text-align:center;padding:16px 8px;">' +
      '<div style="font-size:40px;">🏆</div>' +
      '<div style="font-size:22px;font-weight:800;color:' + color + ';margin-top:6px;">' + escVisitHtml(getAwardDisplayName(gs.award)) + '</div>' +
      '<div style="font-size:16px;margin-top:6px;color:var(--gray-dark);">' + gs.total + '/' + gs.max + ' คะแนน (' + gs.pct + '%)</div></div>';
  }
  function renderInfoOverview() {
    const metrics = getInfoHealthMetrics();
    const gs = getGshpsResult();
    const setTxt = function(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('info-date-label', new Date().toLocaleDateString('th-TH'));
    setTxt('info-year-label', INFO_SCHOOL_YEAR);
    setTxt('info-act-year', INFO_SCHOOL_YEAR);
    setTxt('info-ov-total', metrics.totalStudents.toLocaleString('th-TH'));
    setTxt('info-ov-goodH', metrics.goodHeight + '%');
    setTxt('info-ov-dental', metrics.dentalPct + '%');
    setTxt('info-ov-fitness', metrics.fitnessPct + '%');
    setTxt('info-ov-illness', metrics.illnessTotal.toLocaleString('th-TH'));
    setTxt('info-ov-behavior', metrics.behaviorPct + '%');
    const gHpass = metrics.goodHeight >= 57;
    const gHstat = document.getElementById('info-ov-goodH-status');
    if (gHstat) {
      gHstat.textContent = gHpass ? '✅ ผ่านเกณฑ์' : '⚠️ ต่ำกว่าเกณฑ์';
      gHstat.className = 'stat-sub ' + (gHpass ? 'pass-text' : 'fail-text');
    }
    renderInfoNutritionChart(metrics);
    renderInfoGshpsSummaryBlock(gs);
  }
  function renderInfoIndicators() {
    const el = document.getElementById('info-indicator-cards');
    if (!el) return;
    const indicators = buildInfoIndicators(getInfoHealthMetrics());
    el.innerHTML = indicators.map(function(ind) {
      const itemsHtml = ind.items.map(function(item) {
        const ok = infoIndicatorPass(item);
        const color = ok ? 'var(--green-mid)' : 'var(--red)';
        const sym = item.lowerIsBetter ? '≤' : '≥';
        return '<div class="info-indicator"><div><div class="ind-label">' + (ok ? '✅' : '⚠️') + ' ' + escVisitHtml(item.label) + '</div>' +
          '<div class="ind-target">เกณฑ์: ' + sym + item.target + '%</div></div>' +
          '<div style="text-align:right;"><div class="ind-val" style="color:' + color + ';">' + item.val + '%</div>' +
          '<div style="font-size:11px;color:' + color + ';">' + (ok ? 'ผ่าน' : 'ไม่ผ่าน') + '</div></div></div>';
      }).join('');
      return '<div class="card" style="margin-bottom:16px;"><div class="card-title"><span>📈</span>ตัวชี้วัดที่ ' + ind.no + ': ' + escVisitHtml(ind.name) + '</div>' +
        (itemsHtml || '<p style="color:var(--gray-mid);font-size:13px;">ยังไม่มีข้อมูล</p>') + '</div>';
    }).join('');
  }
  function renderInfoGSHPS() {
    const gs = getGshpsResult();
    const ab = document.getElementById('info-award-banner');
    const dd = document.getElementById('info-gshps-detail');
    if (ab) {
      if (gs && gs.total) {
        const color = getAwardColor(gs.award);
        ab.innerHTML = '<div class="info-award-banner"><div class="info-award-icon">🏆</div>' +
          '<div class="info-award-name" style="color:' + color + ';">' + escVisitHtml(getAwardDisplayName(gs.award)) + '</div>' +
          '<div class="info-award-score">' + gs.total + ' / ' + gs.max + ' คะแนน (' + gs.pct + '%)</div></div>';
      } else {
        ab.innerHTML = '<div class="info-award-banner"><p style="color:var(--gray-mid);">ยังไม่มีผลการประเมิน</p></div>';
      }
    }
    if (!dd) return;
    if (!gs || !gs.components || !gs.components.length) {
      dd.innerHTML = '<p style="color:var(--gray-mid);font-size:13px;">ยังไม่มีข้อมูล</p>';
      return;
    }
    dd.innerHTML = gs.components.map(function(r) {
      const score = Number(r.score) || 0;
      const max = Number(r.max) || 10;
      const pct = max ? Math.round(score / max * 100) : 0;
      const color = pct >= 80 ? 'var(--green-mid)' : pct >= 60 ? 'var(--gold)' : 'var(--red)';
      return '<div class="gshps-row"><div class="gshps-no">' + r.no + '</div>' +
        '<div class="gshps-name">' + escVisitHtml(r.name) + '</div>' +
        '<div class="gshps-bar"><div class="progress-bar-wrap"><div class="progress-bar" style="width:' + pct + '%;background:' + color + ';"></div></div></div>' +
        '<div class="gshps-score" style="color:' + color + ';">' + score + '/' + max + '</div></div>';
    }).join('');
  }
  function buildIllnessRecords() {
    const rows = [];
    loadVisitRecords().forEach(function(r) {
      rows.push({
        date: r.recordedAt || '—',
        name: r.name || '—',
        class: r.class || '—',
        type: r.type || 'เจ็บป่วย',
        symptom: r.symptom || r.diagnosis || '—',
        referral: (r.result || '').indexOf('ส่งต่อ') !== -1 ? 'ส่งต่อ' : '—',
        savedAt: r.savedAt || 0
      });
    });
    loadEmergencyRecords().forEach(function(r) {
      rows.push({
        date: r.recordedAt || r.eventAt || '—',
        name: r.name || '—',
        class: '—',
        type: r.type || 'ฉุกเฉิน',
        symptom: r.firstaid || r.type || '—',
        referral: (r.result || '').indexOf('ส่งต่อ') !== -1 ? 'ส่งต่อ' : '—',
        savedAt: r.savedAt || 0
      });
    });
    return rows.sort(function(a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
  }
  function renderInfoIllness() {
    const rows = buildIllnessRecords();
    const monthRows = rows.filter(isRecordThisMonth);
    const referrals = rows.filter(function(r) { return r.referral === 'ส่งต่อ'; }).length;
    const setNum = function(id, n) { const el = document.getElementById(id); if (el) el.textContent = n.toLocaleString('th-TH'); };
    setNum('info-ill-total', rows.length);
    setNum('info-ill-month', monthRows.length);
    setNum('info-ill-referral', referrals);
    const tbody = document.getElementById('info-illness-body');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--gray-mid);padding:18px;">ยังไม่มีข้อมูล</td></tr>';
      return;
    }
    tbody.innerHTML = rows.slice(0, 50).map(function(r) {
      return '<tr><td>' + escVisitHtml(r.date) + '</td><td>' + escVisitHtml(r.name) + '</td><td>' + escVisitHtml(r.class) +
        '</td><td>' + escVisitHtml(r.type) + '</td><td>' + escVisitHtml(r.symptom) + '</td><td>' + escVisitHtml(r.referral) + '</td></tr>';
    }).join('');
  }
  function renderInfoActivity() {
    const tbody = document.getElementById('info-activity-body');
    if (!tbody) return;
    const dash = loadDashboard();
    const items = (dash.calendar || []).map(function(c) {
      const text = c.text || '';
      let target = 'ทุกระดับชั้น';
      const m = text.match(/\(([^)]+)\)/);
      if (m) target = m[1];
      const name = text.replace(/\s*\([^)]*\)\s*$/, '').trim();
      return {
        name: name,
        period: formatInfoDateRange(c),
        target: target,
        progress: c.done ? '100%' : '—',
        status: c.done ? '✅ เสร็จแล้ว' : '📅 วางแผน'
      };
    });
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-mid);padding:18px;">ยังไม่มีข้อมูล</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(function(a) {
      return '<tr><td>' + escVisitHtml(a.name) + '</td><td>' + escVisitHtml(a.period) + '</td><td>' + escVisitHtml(a.target) +
        '</td><td>' + escVisitHtml(a.progress) + '</td><td>' + a.status + '</td></tr>';
    }).join('');
  }
  function showInfoPage(page, el) {
    document.querySelectorAll('#section-gshps .info-page').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('#section-gshps .info-tabs .tab').forEach(function(t) { t.classList.remove('active'); });
    const panel = document.getElementById('info-page-' + page);
    if (panel) panel.classList.add('active');
    if (el) el.classList.add('active');
    if (page === 'indicators') renderInfoIndicators();
    else if (page === 'gshps') renderInfoGSHPS();
    else if (page === 'illness') renderInfoIllness();
    else if (page === 'activity') renderInfoActivity();
  }
  function renderInfoHub() {
    renderInfoOverview();
    const active = document.querySelector('#section-gshps .info-tabs .tab.active');
    const page = active && active.getAttribute('data-info-page');
    if (page === 'indicators') renderInfoIndicators();
    else if (page === 'gshps') renderInfoGSHPS();
    else if (page === 'illness') renderInfoIllness();
    else if (page === 'activity') renderInfoActivity();
  }
  window.showInfoPage = showInfoPage;
  window.renderInfoHub = renderInfoHub;
