/**
 * ส่งข้อมูลจากเว็บไซต์ → Google Sheets (Apps Script Web App)
 */
var SHEETS_CONFIG = {
  ENABLED: true,
  SPREADSHEET_ID: '15IlAOVYRi3MixwzvhwO10ZkDonm_oam_wzSM-3-BpIw',
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbz_edVGCg8AcLUSOHmWjbQiaj1EPLLli72fL2jS9ofi72d2X_BiWFJolGqzPrpusrn8LA/exec',
  QUEUE_KEY: 'sh-sheets-queue',
  IS_WORKSPACE: false
};

var SHEET_NAMES = {
  visit: 'บันทึกการรักษา',
  nutrition: 'ภาวะโภชนาการ',
  vaccine: 'วัคซีน',
  chronic: 'โรคเรื้อรัง',
  diseaseStudent: 'รายงานโรคติดต่อ_นักเรียน',
  diseaseStaff: 'รายงานโรคติดต่อ_เจ้าหน้าที่',
  emergency: 'เหตุฉุกเฉิน',
  referral: 'ส่งต่อและติดตาม',
  environment: 'อนามัยสิ่งแวดล้อม',
  mental: 'สุขภาพจิต',
  appointment: 'ใบนัด',
  screening: 'ตรวจคัดกรอง',
  calendar: 'ปฏิทินโรงเรียน',
  medicine: 'คลังยา',
  nurseAlert: 'แจ้งเตือนงานอนามัย',
  knowledge: 'ความรู้ด้านอนามัย',
  studentHealth: 'ข้อมูลสุขภาพนักเรียน'
};

function getSyncRoleLabel() {
  if (typeof getCurrentRole !== 'function') return '';
  var map = {
    nurse: 'เจ้าหน้าที่อนามัย',
    teacher: 'ครู',
    admin: 'ผู้บริหาร',
    student: 'นักเรียน'
  };
  return map[getCurrentRole()] || getCurrentRole() || '';
}

function ensureSheetSyncDom_() {
  if (document.getElementById('sheet-sync-form')) return;
  var form = document.createElement('form');
  form.id = 'sheet-sync-form';
  form.method = 'POST';
  form.action = SHEETS_CONFIG.WEB_APP_URL;
  form.target = 'sheet-sync-frame';
  form.style.display = 'none';
  form.setAttribute('accept-charset', 'UTF-8');
  var input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'payload';
  form.appendChild(input);
  document.body.appendChild(form);
  var iframe = document.createElement('iframe');
  iframe.id = 'sheet-sync-frame';
  iframe.name = 'sheet-sync-frame';
  iframe.title = 'sheet-sync';
  iframe.style.cssText = 'display:none;width:0;height:0;border:0';
  document.body.appendChild(iframe);
}

function showSheetToast_(msg, isError) {
  var el = document.getElementById('sheet-sync-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sheet-sync-toast';
    el.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:99999;max-width:320px;padding:10px 14px;border-radius:10px;font-size:13px;line-height:1.4;box-shadow:0 4px 16px rgba(0,0,0,.15);display:none';
    document.body.appendChild(el);
  }
  el.style.background = isError ? '#fef2f2' : '#ecfdf5';
  el.style.color = isError ? '#991b1b' : '#065f46';
  el.style.border = isError ? '1px solid #fecaca' : '1px solid #a7f3d0';
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(function() { el.style.display = 'none'; }, isError ? 8000 : 4000);
}

function loadSheetQueue_() {
  try { return JSON.parse(localStorage.getItem(SHEETS_CONFIG.QUEUE_KEY) || '[]'); } catch (e) { return []; }
}

function saveSheetQueue_(items) {
  try { localStorage.setItem(SHEETS_CONFIG.QUEUE_KEY, JSON.stringify(items)); } catch (e) {}
}

function enqueueSheetSync_(payload) {
  var q = loadSheetQueue_();
  q.push(Object.assign({ at: Date.now() }, payload));
  saveSheetQueue_(q);
}

function buildPayload_(sheetName, row, options) {
  var payload = { sheet: sheetName, row: row };
  if (options && options.action) payload.action = options.action;
  if (options && options.matchKey) payload.matchKey = options.matchKey;
  return payload;
}

function syncPayload_(payload) {
  if (!SHEETS_CONFIG.ENABLED || !SHEETS_CONFIG.WEB_APP_URL) {
    return Promise.resolve({ ok: false, skipped: true });
  }

  if (SHEETS_CONFIG.IS_WORKSPACE || SHEETS_CONFIG.WEB_APP_URL.indexOf('/a/macros/') !== -1) {
    syncViaHiddenForm_(payload);
    syncViaPopup_(payload);
    showSheetToast_('กำลังส่งไป Google Sheet... ถ้าขึ้นหน้า Google ให้ล็อกอิน @banphai.ac.th');
    return Promise.resolve({ ok: true, method: 'workspace' });
  }

  return syncViaFetch_(payload)
    .then(function(res) {
      if (res && res.ok) showSheetToast_('ส่ง Google Sheet สำเร็จ');
      return res;
    })
    .catch(function() {
      syncViaHiddenForm_(payload);
      showSheetToast_('กำลังส่งไป Google Sheet...');
      return { ok: true, method: 'form' };
    });
}

function syncToSheet(sheetName, row) {
  return syncPayload_(buildPayload_(sheetName, row));
}

function syncViaHiddenForm_(payload) {
  ensureSheetSyncDom_();
  var form = document.getElementById('sheet-sync-form');
  form.action = SHEETS_CONFIG.WEB_APP_URL;
  form.querySelector('input[name="payload"]').value = JSON.stringify(payload);
  form.submit();
}

function syncViaPopup_(payload) {
  var url = SHEETS_CONFIG.WEB_APP_URL + '?payload=' + encodeURIComponent(JSON.stringify(payload));
  var w = window.open(url, 'sh_sheet_sync', 'width=480,height=200,left=100,top=100');
  setTimeout(function() {
    try { if (w && !w.closed) w.close(); } catch (e) {}
  }, 4000);
}

function syncViaFetch_(payload) {
  return fetch(SHEETS_CONFIG.WEB_APP_URL, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(res) {
    return res.text().then(function(text) {
      if (text.indexOf('Sign in') !== -1 || text.indexOf('AccountChooser') !== -1) {
        throw new Error('AUTH_REQUIRED');
      }
      try { return JSON.parse(text); } catch (e) {
        if (text.indexOf('"ok":true') !== -1) return { ok: true };
        throw new Error('BAD_RESPONSE');
      }
    });
  });
}

function syncToSheetQuiet(sheetName, row) {
  syncPayloadQuiet(buildPayload_(sheetName, row));
}

function syncPayloadQuiet(payload) {
  syncPayload_(payload).then(function(res) {
    if (res && res.ok) return;
    if (res && res.skipped) return;
    enqueueSheetSync_(payload);
    if (!window._sheetAuthWarned) {
      window._sheetAuthWarned = true;
      showSheetToast_('ส่ง Sheet ไม่สำเร็จ — ล็อกอิน Google @banphai.ac.th แล้วลองใหม่', true);
    }
  });
}

function flushSheetQueue_() {
  var q = loadSheetQueue_();
  if (!q.length || !SHEETS_CONFIG.WEB_APP_URL) return;
  var item = q[0];
  var payload = item.action
    ? { action: item.action, sheet: item.sheet, matchKey: item.matchKey, row: item.row }
    : buildPayload_(item.sheet, item.row);
  syncPayload_(payload).then(function(res) {
    if (res && res.ok) {
      q.shift();
      saveSheetQueue_(q);
      if (q.length) flushSheetQueue_();
    }
  });
}

function formatSheetDate(iso) {
  if (!iso) return '';
  if (typeof formatVacDate === 'function' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return formatVacDate(iso);
  }
  return iso;
}

function buildVaccineSheetRow(record) {
  return {
    'เลขประจำตัว': record.id || '',
    'ชื่อนามสกุล': record.name || '',
    'วัคซีนที่ฉีด': record.vaccine || '',
    'วันที่ฉีด': formatSheetDate(record.date),
    'วันที่บันทึก': record.recordedAt || '',
    'บทบาทผู้บันทึก': getSyncRoleLabel(),
    id: record.id || '',
    name: record.name || '',
    vaccine: record.vaccine || '',
    date: formatSheetDate(record.date),
    recordedAt: record.recordedAt || ''
  };
}

function buildNutritionSheetRow(record) {
  var w = record.weight != null && record.weight !== '' ? String(record.weight) : '';
  var h = record.height != null && record.height !== '' ? String(record.height) : '';
  var bmi = record.bmi != null && record.bmi !== '' ? String(record.bmi) : '';
  var date = record.date || record.recordedAt || new Date().toLocaleString('th-TH');
  return {
    'วันที่บันทึก': date,
    'รหัสนักเรียน': record.id || '',
    'ชื่อ-นามสกุล': record.name || '',
    'ชั้น': record.class || '',
    'เพศ': record.sex || '',
    'อายุ': record.age != null && record.age !== '' ? String(record.age) : '',
    'น้ำหนัก(kg)': w,
    'น้ำหนัก': w,
    'น้ำหนัก(กก.)': w,
    'น้ำหนัก (kg)': w,
    'น้ำหนัก (กก.)': w,
    'ส่วนสูง(cm)': h,
    'ส่วนสูง': h,
    'ส่วนสูง(ซม.)': h,
    'ส่วนสูง (cm)': h,
    'ส่วนสูง (ซม.)': h,
    'BMI': bmi,
    'สถานะโภชนาการ': record.category || '',
    'บทบาทผู้บันทึก': getSyncRoleLabel(),
    id: record.id || '',
    name: record.name || '',
    class: record.class || '',
    sex: record.sex || '',
    age: record.age != null && record.age !== '' ? String(record.age) : '',
    weight: w,
    height: h,
    bmi: bmi,
    category: record.category || '',
    recordedAt: date
  };
}

function buildChronicSheetRow(record) {
  return {
    'วันที่บันทึก': record.recordedAt || new Date().toLocaleString('th-TH'),
    'รหัสนักเรียน': record.id || '',
    'ชื่อ-นามสกุล': record.name || '',
    'ชั้น': record.class || '',
    'โรคประจำตัว': record.disease || '',
    'ยาที่ใช้': record.medicine || '',
    'เบอร์ติดต่อฉุกเฉิน': record.phone || '',
    'หมายเหตุ': record.note || '',
    'บทบาทผู้บันทึก': getSyncRoleLabel(),
    id: record.id || '',
    name: record.name || '',
    class: record.class || '',
    disease: record.disease || '',
    medicine: record.medicine || '',
    phone: record.phone || '',
    note: record.note || '',
    recordedAt: record.recordedAt || ''
  };
}

function buildEmergencySheetRow(record) {
  return {
    'วันที่เวลา': record.eventAt || record.recordedAt || '',
    'ชื่อผู้บาดเจ็บ/เจ็บป่วย': record.name || '',
    'ประเภทเหตุการณ์': record.type || '',
    'สถานที่เกิดเหตุ': record.location || '',
    'การปฐมพยาบาล': record.firstaid || '',
    'ผลลัพธ์': record.result || '',
    'บทบาทผู้บันทึก': getSyncRoleLabel(),
    name: record.name || '',
    type: record.type || '',
    location: record.location || '',
    firstaid: record.firstaid || '',
    result: record.result || '',
    eventAt: record.eventAt || record.recordedAt || '',
    recordedAt: record.recordedAt || ''
  };
}

function buildDiseaseStudentSheetRow(record) {
  return {
    'วันที่รายงาน': record.recordedAt || '',
    'รหัสนักเรียน': record.id || '',
    'ชื่อ-นามสกุล': record.name || '',
    'โรคที่พบ/สงสัย': record.disease || '',
    'วันที่เริ่มมีอาการ': formatSheetDate(record.symptomDate),
    'อาการ/รายละเอียด': record.note || '',
    'สถานะ': record.status || '',
    id: record.id || '',
    name: record.name || '',
    disease: record.disease || '',
    symptomDate: formatSheetDate(record.symptomDate),
    note: record.note || '',
    status: record.status || '',
    recordedAt: record.recordedAt || ''
  };
}

function buildDiseaseStaffSheetRow(record) {
  return {
    'วันที่รายงาน': record.recordedAt || '',
    'โรคที่พบ': record.disease || '',
    'จำนวนผู้ป่วย': record.patients || '',
    'ห้องเรียน/กลุ่ม': record.room || '',
    'วันที่เริ่มพบ': formatSheetDate(record.startDate),
    'มาตรการที่ดำเนินการ': (record.measures || []).join(', '),
    'บทบาทผู้บันทึก': getSyncRoleLabel(),
    disease: record.disease || '',
    patients: record.patients || '',
    room: record.room || '',
    startDate: formatSheetDate(record.startDate),
    measures: (record.measures || []).join(', '),
    recordedAt: record.recordedAt || ''
  };
}

function buildEnvironmentSheetRow(record) {
  var items = record.items || [];
  var passed = items.filter(function(it) { return it.checked; });
  var failed = items.filter(function(it) { return !it.checked; });
  return {
    'วันที่ตรวจ': record.recordedAt || '',
    'ผลการตรวจ': (record.passCount != null ? record.passCount : passed.length) + '/' + (record.total || items.length) + ' ข้อ',
    'รายการที่ผ่าน': passed.map(function(it) { return it.text; }).join(' | '),
    'รายการที่ยังไม่ผ่าน': failed.map(function(it) { return it.text; }).join(' | '),
    'ผู้บันทึก': record.recordedBy || getSyncRoleLabel(),
    passCount: record.passCount,
    passed: passed.map(function(it) { return it.text; }).join(' | '),
    failed: failed.map(function(it) { return it.text; }).join(' | '),
    recordedAt: record.recordedAt || ''
  };
}

function buildReferralSheetRow(record) {
  return {
    'รหัสรายการ': record.uid || '',
    'วันที่บันทึก': record.recordedAt || '',
    'รหัส': record.id || '',
    'ชื่อ-นามสกุล': record.name || '',
    'ชั้น': record.class || '',
    'สถานพยาบาล': record.hospital || '',
    'ความเร่งด่วน': record.urgency || '',
    'สาเหตุ/อาการ': record.reason || '',
    'แจ้งผู้ปกครอง': record.parentNotified || '',
    'หมายเหตุ': record.note || '',
    'สถานะ': record.status || '',
    'ผลติดตาม': record.followupNote || '',
    'แหล่งข้อมูล': record.source || '',
    'บทบาทผู้บันทึก': getSyncRoleLabel(),
    id: record.id || '',
    name: record.name || '',
    class: record.class || '',
    hospital: record.hospital || '',
    urgency: record.urgency || '',
    reason: record.reason || '',
    parentNotified: record.parentNotified || '',
    note: record.note || '',
    status: record.status || '',
    followupNote: record.followupNote || '',
    source: record.source || '',
    uid: record.uid || '',
    recordedAt: record.recordedAt || ''
  };
}

function syncUpsertRowQuiet(sheetName, matchKey, row) {
  if (!sheetName || !matchKey) return;
  var payload = {
    action: 'upsertRow',
    sheet: sheetName,
    matchKey: matchKey,
    row: row
  };
  ensureSheetSyncDom_();
  syncViaHiddenForm_(payload);
  syncPayloadQuiet(payload);
}

function screeningTypeLabel_(type) {
  var map = {
    vision: 'สายตา',
    hearing: 'การได้ยิน',
    blood: 'โลหิตจาง',
    oral: 'ช่องปาก',
    physical: 'ร่างกาย'
  };
  return map[type] || type || '';
}

function formatScreeningDetail_(record) {
  if (!record || !record.detail) return '';
  var d = record.detail;
  if (record.type === 'vision') {
    return 'ตาขวา ' + (d.vaRight || '—') + ' / ตาซ้าย ' + (d.vaLeft || '—');
  }
  if (record.type === 'hearing') {
    return 'ขวา ' + (d.right || '—') + ' / ซ้าย ' + (d.left || '—') + (d.method ? ' · ' + d.method : '');
  }
  if (record.type === 'blood') {
    return (d.value || '—') + (d.method ? ' · ' + d.method : '');
  }
  if (record.type === 'oral') {
    return (d.findings || []).join(', ') + (d.note ? ' · ' + d.note : '');
  }
  if (record.type === 'physical') {
    return (d.note || '') + (d.checked ? ' · ตรวจครบ ' + d.checked + ' ท่า' : '');
  }
  try { return JSON.stringify(d); } catch (e) { return ''; }
}

function getSyncRecorderName_() {
  if (typeof resolveLoggedInDisplayName === 'function') {
    try {
      var name = resolveLoggedInDisplayName();
      if (name) return name;
    } catch (e) {}
  }
  return getSyncRoleLabel();
}

function buildScreeningSheetRow(record) {
  return {
    'วันที่บันทึก': record.recordedAt || '',
    'รหัสนักเรียน': record.id || '',
    'ชื่อ-นามสกุล': record.name || '',
    'ชั้น': record.class || '',
    'เพศ': record.sex || '',
    'อายุ': record.age != null && record.age !== '' ? String(record.age) : '',
    'ประเภทการตรวจ': screeningTypeLabel_(record.type),
    'ผลสรุป': record.summary || '',
    'รายละเอียด': formatScreeningDetail_(record),
    'ผู้บันทึก': record.recorderName || getSyncRecorderName_(),
    'บทบาทผู้บันทึก': getSyncRoleLabel(),
    id: record.id || '',
    name: record.name || '',
    class: record.class || '',
    sex: record.sex || '',
    age: record.age != null && record.age !== '' ? String(record.age) : '',
    type: record.type || '',
    summary: record.summary || '',
    recordedAt: record.recordedAt || ''
  };
}

function syncScreeningToSheetQuiet(record) {
  if (!SHEET_NAMES.screening || !record) return;
  syncToSheetQuiet(SHEET_NAMES.screening, buildScreeningSheetRow(record));
}

function buildCalendarSheetRow(item, index) {
  item = item || {};
  return {
    'ลำดับ': String((index || 0) + 1),
    'วันเริ่ม': formatSheetDate(item.dateStart) || item.dateStart || '',
    'วันสิ้นสุด': formatSheetDate(item.dateEnd) || item.dateEnd || '',
    'รายละเอียดงาน': item.text || '',
    'สถานะ': item.done ? 'เสร็จแล้ว' : 'วางแผน',
    'วันที่บันทึก': new Date().toLocaleString('th-TH'),
    'บทบาทผู้บันทึก': getSyncRoleLabel()
  };
}

function syncCalendarToSheetQuiet(item, index) {
  if (!SHEET_NAMES.calendar) return;
  syncUpsertRowQuiet(SHEET_NAMES.calendar, 'ลำดับ', buildCalendarSheetRow(item, index));
}

function buildMedicineSheetRow(item, opts) {
  opts = opts || {};
  item = item || {};
  return {
    'รหัสยา': item.id || '',
    'ชื่อยา': item.name || '',
    'ประเภท': item.category || '',
    'จำนวนคงเหลือ': item.qty != null ? String(item.qty) : '',
    'หน่วย': item.unit || '',
    'วันหมดอายุ': item.expiry || '',
    'สถานะ': opts.status || item.status || '',
    'จำนวนที่รับเพิ่ม': opts.addQty != null ? String(opts.addQty) : '',
    'ประเภทการบันทึก': opts.actionType || '',
    'หมายเหตุ': opts.note || item.lastNote || '',
    'วันที่บันทึก': new Date().toLocaleString('th-TH'),
    'บทบาทผู้บันทึก': getSyncRoleLabel()
  };
}

function syncMedicineStockToSheetQuiet(item, opts) {
  if (!SHEET_NAMES.medicine || !item) return;
  syncUpsertRowQuiet(SHEET_NAMES.medicine, 'รหัสยา', buildMedicineSheetRow(item, opts));
}

function syncMedicinePurchaseToSheetQuiet(item, addQty, note) {
  if (!SHEET_NAMES.medicine || !item) return;
  syncToSheetQuiet(SHEET_NAMES.medicine, buildMedicineSheetRow(item, {
    addQty: addQty,
    note: note,
    actionType: 'รับเข้า'
  }));
}

function buildNurseAlertSheetRow(alert) {
  alert = alert || {};
  return {
    'รหัสแจ้งเตือน': alert.id || '',
    'ข้อความ': alert.text || '',
    'ระดับความสำคัญ': alert.priority || '',
    'สถานะ': alert.active !== false ? 'แสดง' : 'ปิด',
    'ผู้เผยแพร่': alert.author || '',
    'วันที่เผยแพร่': alert.createdAt ? new Date(alert.createdAt).toLocaleString('th-TH') : '',
    'วันที่แก้ไข': alert.updatedAt ? new Date(alert.updatedAt).toLocaleString('th-TH') : ''
  };
}

function syncNurseAlertToSheetQuiet(alert) {
  if (!SHEET_NAMES.nurseAlert || !alert) return;
  syncUpsertRowQuiet(SHEET_NAMES.nurseAlert, 'รหัสแจ้งเตือน', buildNurseAlertSheetRow(alert));
}

function buildKnowledgeSheetRow(article) {
  article = article || {};
  return {
    'รหัสบทความ': article.id || '',
    'หมวดหมู่': article.category || '',
    'หัวข้อ': article.title || '',
    'เนื้อหา': article.content || '',
    'ผู้เขียน': article.author || '',
    'ลิงก์วิดีโอ': article.youtubeUrl || (article.youtubeId ? ('https://youtu.be/' + article.youtubeId) : ''),
    'วันที่เผยแพร่': article.date || new Date().toLocaleString('th-TH')
  };
}

function syncKnowledgeToSheetQuiet(article) {
  if (!SHEET_NAMES.knowledge || !article) return;
  syncUpsertRowQuiet(SHEET_NAMES.knowledge, 'รหัสบทความ', buildKnowledgeSheetRow(article));
}

function buildStudentHealthSheetRow(id, extra) {
  extra = extra || {};
  var name = '';
  if (typeof lookupStudent === 'function') {
    var student = lookupStudent(id);
    if (student && student.fullName) name = student.fullName;
  }
  var chronic = '';
  var drug = extra.drugAllergy || '';
  var food = extra.foodAllergy || '';
  var precautions = extra.precautions || '';
  if (typeof getStudentRegistryHealth === 'function') {
    var health = getStudentRegistryHealth(id);
    if (!drug && health.drug && health.drug !== '—') drug = health.drug;
    if (!food && health.food && health.food !== '—') food = health.food;
    if (!precautions && health.precautions && health.precautions !== '—') precautions = health.precautions;
    if (health.chronic && health.chronic !== '—') chronic = health.chronic;
  }
  return {
    'รหัสนักเรียน': id || '',
    'ชื่อ-นามสกุล': name,
    'แพ้ยา': drug,
    'แพ้อาหาร': food,
    'ข้อควรระวัง': precautions,
    'เบอร์ผู้ปกครอง': extra.guardianPhone || '',
    'โรคประจำตัว': chronic,
    'วันที่บันทึก': new Date().toLocaleString('th-TH'),
    'บทบาทผู้บันทึก': getSyncRoleLabel()
  };
}

function syncStudentHealthToSheetQuiet(id) {
  if (!SHEET_NAMES.studentHealth || !id) return;
  var extra = {};
  if (typeof getStudentHealthExtra === 'function') extra = getStudentHealthExtra(id) || {};
  syncUpsertRowQuiet(SHEET_NAMES.studentHealth, 'รหัสนักเรียน', buildStudentHealthSheetRow(id, extra));
}

function visitProviderNameForSheet_(record) {
  if (record.providerName) return String(record.providerName).trim();
  if (!record.provider) return '';
  return String(record.provider).replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function buildVisitSheetRow(record) {
  var providerName = visitProviderNameForSheet_(record);
  var providerRole = record.providerRole || '';
  var providerClass = record.providerClass || '';
  var row = {
    'วันที่เวลา': record.recordedAt || '',
    'รหัส': record.id || '',
    'ชื่อ': record.name || '',
    'ชื่อ-นามสกุล': record.name || '',
    'ชื่อนามสกุล': record.name || '',
    'ระบดับชั้น/ตำแหน่ง': record.class || '',
    'ระดับชั้น/ตำแหน่ง': record.class || '',
    'ชั้น/ตำแหน่ง': record.class || '',
    'ชั้น': record.class || '',
    'ประเภทผู้รับบริการ': record.type || '',
    'อาการ': record.symptom || '',
    'อาการ/ปัญหาสุขภาพ': record.symptom || '',
    'อุณหภูมิร่างกาย': record.temp || '',
    'อุณหภูมิ(°C)': record.temp || '',
    'อุณหภูมิ': record.temp || '',
    'ความดันโลหิต': record.bp || '',
    'ความดัน': record.bp || '',
    'ชีพจร': record.pulse || '',
    'การวินิจฉัยเบื้องต้น': record.diagnosis || '',
    'การรักษาและยาที่ให้': record.treatment || '',
    'การรักษาและยา': record.treatment || '',
    'ผลการรักษา': record.result || '',
    'ผู้ให้บริการ': providerName,
    'ตำแหน่งผู้ให้บริการ': providerRole,
    'ระดับชั้นผู้ให้บริการ (นักเรียน)': providerClass,
    'บทบาทผู้บันทึก': getSyncRoleLabel(),
    id: record.id || '',
    name: record.name || '',
    class: record.class || '',
    type: record.type || '',
    symptom: record.symptom || '',
    temp: record.temp || '',
    bp: record.bp || '',
    pulse: record.pulse || '',
    diagnosis: record.diagnosis || '',
    treatment: record.treatment || '',
    result: record.result || '',
    provider: providerName,
    providerName: providerName,
    providerRole: providerRole,
    providerClass: providerClass,
    recordedAt: record.recordedAt || ''
  };
  return row;
}

function buildMentalSheetRow(record, type) {
  var id = record.id || '';
  var name = record.name || '';
  var row = {
    'เลขประจำตัวนักเรียน': id,
    'รหัสนักเรียน': id,
    'ชื่อนามสกุล': name,
    'ชื่อ-นามสกุล': name,
    'ชั้น': record.class || '',
    'เพศ': record.sex || '',
    'อายุ': record.age != null && record.age !== '' ? String(record.age) : '',
    id: id,
    name: name,
    class: record.class || '',
    sex: record.sex || '',
    age: record.age != null && record.age !== '' ? String(record.age) : ''
  };
  var scoreStr = record.score != null ? String(record.score) : '';
  var riskStr = record.risk || '';
  var cellVal = riskStr ? (scoreStr + ' (' + riskStr + ')') : scoreStr;
  if (type === 'sdq') {
    row['SDQ'] = cellVal;
  } else if (type === '9q') {
    row['ซึมเศร้า'] = cellVal;
  } else if (type === 'assist') {
    row['ASSIST'] = cellVal;
  }
  return row;
}

function syncMentalToSheetQuiet(record, type) {
  if (!type || !SHEET_NAMES.mental) return;
  var payload = {
    action: 'upsertMental',
    sheet: SHEET_NAMES.mental,
    matchKey: 'เลขประจำตัวนักเรียน',
    row: buildMentalSheetRow(record, type)
  };
  ensureSheetSyncDom_();
  syncViaHiddenForm_(payload);
  syncPayloadQuiet(payload);
}

function buildAppointmentSheetRow(studentId, apptData) {
  apptData = apptData || {};
  return {
    'เลขประจำตัว': studentId || '',
    'ชื่อ-นามสกุล': apptData.studentName || '',
    'วันที่นัด': apptData.date || '',
    'เวลา': apptData.time || '',
    'เรื่อง': apptData.purpose || '',
    'สถานที่': apptData.place || '',
    'หมายเหตุ': apptData.note || '',
    'วันที่บันทึก': new Date().toLocaleString('th-TH'),
    'บทบาทผู้บันทึก': getSyncRoleLabel(),
    id: studentId || '',
    name: apptData.studentName || '',
    date: apptData.date || '',
    time: apptData.time || '',
    purpose: apptData.purpose || '',
    place: apptData.place || '',
    note: apptData.note || ''
  };
}

function syncAppointmentToSheetQuiet(studentId, apptData) {
  if (!SHEET_NAMES.appointment) return;
  var payload = {
    action: 'upsertAppointment',
    sheet: SHEET_NAMES.appointment,
    matchKey: 'เลขประจำตัว',
    row: buildAppointmentSheetRow(studentId, apptData)
  };
  ensureSheetSyncDom_();
  syncViaHiddenForm_(payload);
  syncPayloadQuiet(payload);
}

function deleteAppointmentFromSheetQuiet(studentId) {
  if (!SHEET_NAMES.appointment) return;
  var payload = {
    action: 'deleteAppointment',
    sheet: SHEET_NAMES.appointment,
    studentId: String(studentId || '').trim()
  };
  ensureSheetSyncDom_();
  syncViaHiddenForm_(payload);
  syncPayloadQuiet(payload);
}

function fetchAppointmentFromSheet(studentId) {
  if (!SHEETS_CONFIG.ENABLED || !SHEETS_CONFIG.WEB_APP_URL || !studentId) {
    return Promise.resolve(null);
  }
  var payload = { action: 'getAppointment', studentId: String(studentId).trim() };
  var url = SHEETS_CONFIG.WEB_APP_URL + '?payload=' + encodeURIComponent(JSON.stringify(payload));
  return fetch(url, { method: 'GET', mode: 'cors', redirect: 'follow' })
    .then(function(res) { return res.text(); })
    .then(function(text) {
      if (text.indexOf('Sign in') !== -1 || text.indexOf('AccountChooser') !== -1) return null;
      var data;
      try { data = JSON.parse(text); } catch (e) { return null; }
      if (data && data.ok && data.appointment && data.appointment.date) return data.appointment;
      return null;
    })
    .catch(function() { return null; });
}

function sheetIdsMatch_(a, b) {
  var sa = String(a == null ? '' : a).trim();
  var sb = String(b == null ? '' : b).trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  var na = parseInt(sa, 10);
  var nb = parseInt(sb, 10);
  return !isNaN(na) && !isNaN(nb) && na === nb;
}

function parseGvizJson_(text) {
  if (!text) return null;
  var jsonText = text;
  var marker = 'google.visualization.Query.setResponse(';
  var start = text.indexOf(marker);
  if (start !== -1) {
    jsonText = text.slice(start + marker.length);
    if (jsonText.slice(-2) === ');') jsonText = jsonText.slice(0, -2);
    else if (jsonText.slice(-1) === ')') jsonText = jsonText.slice(0, -1);
  }
  try { return JSON.parse(jsonText); } catch (e) { return null; }
}

function gvizCell_(row, idx) {
  if (!row || !row.c || !row.c[idx] || row.c[idx].v == null || row.c[idx].v === '') return '';
  if (row.c[idx].f != null && row.c[idx].f !== '') return String(row.c[idx].f);
  return String(row.c[idx].v);
}

function findGvizColIndex_(cols, names) {
  var normalized = {};
  for (var i = 0; i < cols.length; i++) {
    var label = String(cols[i].label || '').replace(/\s+/g, '').toLowerCase();
    normalized[label] = i;
  }
  for (var n = 0; n < names.length; n++) {
    var key = String(names[n]).replace(/\s+/g, '').toLowerCase();
    if (normalized[key] !== undefined) return normalized[key];
  }
  return -1;
}

function parseVisitRecordedAt(s) {
  if (!s) return 0;
  var t = String(s).trim();
  if (!t || t === 'ตัวอย่างข้อมูล' || t === '—') return 0;
  var thMonths = {
    'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6,
    'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12
  };
  var thMatch = t.match(/(\d{1,2})\s+([ก-ฮ\.]+)\s+(\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (thMatch) {
    var day = parseInt(thMatch[1], 10);
    var monKey = thMatch[2];
    var year = parseInt(thMatch[3], 10);
    var hour = parseInt(thMatch[4] || '12', 10);
    var min = parseInt(thMatch[5] || '0', 10);
    var sec = parseInt(thMatch[6] || '0', 10);
    var month = thMonths[monKey];
    if (!month) {
      Object.keys(thMonths).forEach(function(k) {
        if (!month && monKey.indexOf(k.replace(/\./g, '')) !== -1) month = thMonths[k];
      });
    }
    if (year >= 2400) year -= 543;
    else if (year < 100) year = 2500 + year - 543;
    if (month) return new Date(year, month - 1, day, hour, min, sec).getTime();
  }
  var slash = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slash) {
    var d2 = parseInt(slash[1], 10);
    var m2 = parseInt(slash[2], 10);
    var y2 = parseInt(slash[3], 10);
    if (y2 >= 2400) y2 -= 543;
    else if (y2 < 100) y2 = 2500 + y2 - 543;
    var timeMatch = t.match(/(\d{1,2}):(\d{2})/);
    var hh = timeMatch ? parseInt(timeMatch[1], 10) : 12;
    var mm = timeMatch ? parseInt(timeMatch[2], 10) : 0;
    return new Date(y2, m2 - 1, d2, hh, mm, 0).getTime();
  }
  var direct = new Date(t);
  if (!isNaN(direct.getTime()) && direct.getFullYear() >= 2000) return direct.getTime();
  return 0;
}

function isValidVisitSavedAt(ts) {
  if (ts == null || typeof ts !== 'number' || !isFinite(ts) || ts <= 0) return false;
  var ms = ts;
  if (ts >= 1e9 && ts < 1e11) ms = ts * 1000;
  else if (ts < 1e11) return false;
  var y = new Date(ms).getFullYear();
  return y >= 2000 && y <= 2100;
}

function resolveVisitSavedAt(record) {
  record = record || {};
  if (isValidVisitSavedAt(record.savedAt)) {
    return record.savedAt >= 1e9 && record.savedAt < 1e11 ? record.savedAt * 1000 : record.savedAt;
  }
  var m = String(record.recordId || '').match(/^v-(\d{11,})-/);
  if (m) {
    var fromId = parseInt(m[1], 10);
    if (isValidVisitSavedAt(fromId)) return fromId;
  }
  var parsed = parseVisitRecordedAt(record.recordedAt);
  if (isValidVisitSavedAt(parsed)) return parsed;
  return 0;
}

var VISIT_KNOWN_RESULTS_ = [
  'กลับชั้นเรียนได้', 'พักที่ห้องพยาบาล', 'แจ้งผู้ปกครองมารับ', 'ส่งต่อโรงพยาบาล'
];
var VISIT_KNOWN_SYMPTOMS_ = [
  'ไข้หวัด / หวัดใหญ่', 'ปวดศีรษะ', 'ปวดท้อง', 'อาการเวียนศีรษะ',
  'บาดแผล / อุบัติเหตุ', 'ปัญหาสุขภาพจิต / ความเครียด', 'อื่นๆ', 'อื่น ๆ'
];

function assignSheetVisitTodayTime_(record, rowIndex) {
  if (!record) return record;
  var today = new Date();
  today.setHours(8, 0, 0, 0);
  var order = typeof rowIndex === 'number' ? rowIndex : 0;
  var ts = today.getTime() + order * 180000;
  record.savedAt = ts;
  record.recordedAt = new Date(ts).toLocaleString('th-TH');
  record.timeRepaired = true;
  record.fromSheet = true;
  if (!record.sheetRow) record.sheetRow = order + 2;
  if (!record.recordId || String(record.recordId).indexOf('v-sheet-') !== 0) {
    record.recordId = 'v-sheet-r' + record.sheetRow + '-' + record.id;
  }
  return record;
}

function visitMatchKnownOption_(val, options) {
  var v = String(val || '').trim();
  if (!v) return '';
  for (var i = 0; i < options.length; i++) {
    var o = options[i];
    if (v === o || v.indexOf(o) !== -1 || o.indexOf(v) !== -1) return v;
  }
  return '';
}

function isCompactVisitSheetLayout_(cols) {
  var idxDate = findGvizColIndex_(cols, ['วันที่เวลา', 'วันที่บันทึก', 'recordedat']);
  if (idxDate >= 0) return false;
  var idxName = findGvizColIndex_(cols, ['ชื่อ', 'ชื่อ-นามสกุล', 'ชื่อนามสกุล', 'name']);
  var idxSymptom = findGvizColIndex_(cols, ['อาการ', 'อาการ/ปัญหาสุขภาพ', 'symptom']);
  if (idxName >= 0 && idxSymptom >= 0) return false;
  var idxId = findGvizColIndex_(cols, ['รหัส', 'เลขประจำตัว', 'รหัสนักเรียน', 'id']);
  return idxId === 0;
}

function parseCompactVisitRowFromCells_(cells, rowIndex) {
  if (!cells || !cells.length) return null;
  var id = String(cells[0] || '').trim();
  if (!/^\d{4,6}$/.test(id)) return null;
  var record = {
    id: id,
    name: '',
    class: '',
    type: 'นักเรียน',
    symptom: '',
    temp: '',
    bp: '',
    pulse: '',
    diagnosis: '',
    treatment: '',
    result: '',
    provider: '',
    recordedAt: '',
    sheetRow: rowIndex + 2,
    fromSheet: true
  };
  var vals = [];
  for (var c = 1; c < cells.length; c++) {
    var v = String(cells[c] || '').trim();
    if (v) vals.push(v);
  }
  if (vals[0] === 'นักเรียน' || vals[0] === 'ครู' || vals[0] === 'บุคลากร') {
    record.type = vals[0];
    vals = vals.slice(1);
  }
  var providerCandidates = [];
  vals.forEach(function(val) {
    if (visitMatchKnownOption_(val, VISIT_KNOWN_RESULTS_)) {
      record.result = val;
      return;
    }
    if (visitMatchKnownOption_(val, VISIT_KNOWN_SYMPTOMS_)) {
      record.diagnosis = val;
      record.symptom = val;
      return;
    }
    if (/^\d{2,3}\/\d{2,3}$/.test(val)) {
      record.bp = val;
      return;
    }
    if (/^\d+(\.\d+)?$/.test(val)) {
      var n = parseFloat(val);
      if (n >= 35 && n <= 42 && !record.temp) {
        record.temp = val;
        return;
      }
      if (n >= 50 && n <= 250 && !record.pulse) {
        record.pulse = val;
        return;
      }
    }
    providerCandidates.push(val);
  });
  if (!record.provider && providerCandidates.length) {
    record.provider = providerCandidates[providerCandidates.length - 1];
  }
  assignSheetVisitTodayTime_(record, rowIndex);
  return record;
}

function parseGvizVisitRows_(gvizData, studentId) {
  var table = gvizData && gvizData.table;
  if (!table || !Array.isArray(table.rows)) return [];
  var cols = table.cols || [];
  var compactLayout = isCompactVisitSheetLayout_(cols);
  var idxId = findGvizColIndex_(cols, ['รหัส', 'เลขประจำตัว', 'รหัสนักเรียน', 'id']);
  var idxDate = findGvizColIndex_(cols, ['วันที่เวลา', 'วันที่บันทึก', 'recordedat']);
  var idxName = findGvizColIndex_(cols, ['ชื่อ', 'ชื่อ-นามสกุล', 'ชื่อนามสกุล', 'name']);
  var idxClass = findGvizColIndex_(cols, ['ระดับชั้น/ตำแหน่ง', 'ระบดับชั้น/ตำแหน่ง', 'ชั้น/ตำแหน่ง', 'ชั้น', 'class']);
  var idxType = findGvizColIndex_(cols, ['ประเภทผู้รับบริการ', 'type']);
  var idxSymptom = findGvizColIndex_(cols, ['อาการ/ปัญหาสุขภาพ', 'อาการ', 'symptom']);
  var idxTemp = findGvizColIndex_(cols, ['อุณหภูมิ(°c)', 'อุณหภูมิร่างกาย', 'อุณหภูมิ', 'temp']);
  var idxBp = findGvizColIndex_(cols, ['ความดันโลหิต', 'ความดัน', 'bp']);
  var idxPulse = findGvizColIndex_(cols, ['ชีพจร', 'pulse']);
  var idxDiag = findGvizColIndex_(cols, ['การวินิจฉัยเบื้องต้น', 'การวินิจฉัย', 'diagnosis']);
  var idxTreat = findGvizColIndex_(cols, ['การรักษาและยาที่ให้', 'การรักษาและยา', 'การรักษา', 'treatment']);
  var idxResult = findGvizColIndex_(cols, ['ผลการรักษา', 'result']);
  var idxProvider = findGvizColIndex_(cols, ['ผู้ให้บริการ', 'provider']);
  var idxProviderRole = findGvizColIndex_(cols, ['ตำแหน่งผู้ให้บริการ', 'providerrole']);
  var idxProviderClass = findGvizColIndex_(cols, ['ระดับชั้นผู้ให้บริการ (นักเรียน)', 'providerclass']);
  var legacyLayout = !compactLayout && idxId === 0 && idxDate < 0 && cols[0] && cols[0].type === 'number';
  if (legacyLayout) {
    idxId = 0;
    idxName = 1;
    idxClass = 2;
    idxType = 3;
    idxSymptom = 4;
    idxTemp = 6;
    idxBp = 7;
    idxDiag = 8;
    idxTreat = 9;
    idxResult = 10;
    idxProvider = 11;
  }
  var visits = [];
  table.rows.forEach(function(row, rowIndex) {
    if (compactLayout) {
      var cells = [];
      for (var ci = 0; ci < (row.c || []).length; ci++) cells.push(gvizCell_(row, ci));
      var compact = parseCompactVisitRowFromCells_(cells, rowIndex);
      if (!compact) return;
      if (studentId && !sheetIdsMatch_(compact.id, studentId)) return;
      visits.push(compact);
      return;
    }
    var id = idxId >= 0 ? gvizCell_(row, idxId) : '';
    if (!id || (studentId && !sheetIdsMatch_(id, studentId))) return;
    var recordedAt = idxDate >= 0 ? gvizCell_(row, idxDate) : '';
    var savedAt = resolveVisitSavedAt({ recordedAt: recordedAt });
    var sheetName = idxName >= 0 ? gvizCell_(row, idxName) : '';
    if (sheetName === 'นักเรียน' || sheetName === 'ครู' || sheetName === 'บุคลากร') sheetName = '';
    visits.push({
      id: id,
      name: sheetName,
      class: idxClass >= 0 ? gvizCell_(row, idxClass) : '',
      type: idxType >= 0 ? gvizCell_(row, idxType) : '',
      symptom: idxSymptom >= 0 ? gvizCell_(row, idxSymptom) : '',
      temp: idxTemp >= 0 ? gvizCell_(row, idxTemp) : '',
      bp: idxBp >= 0 ? gvizCell_(row, idxBp) : '',
      pulse: idxPulse >= 0 ? gvizCell_(row, idxPulse) : '',
      diagnosis: idxDiag >= 0 ? gvizCell_(row, idxDiag) : '',
      treatment: idxTreat >= 0 ? gvizCell_(row, idxTreat) : '',
      result: idxResult >= 0 ? gvizCell_(row, idxResult) : '',
      provider: idxProvider >= 0 ? gvizCell_(row, idxProvider) : '',
      providerName: idxProvider >= 0 ? gvizCell_(row, idxProvider) : '',
      providerRole: idxProviderRole >= 0 ? gvizCell_(row, idxProviderRole) : '',
      providerClass: idxProviderClass >= 0 ? gvizCell_(row, idxProviderClass) : '',
      recordedAt: recordedAt,
      sheetRow: rowIndex + 2,
      fromSheet: true
    });
    var rec = visits[visits.length - 1];
    if (savedAt && isValidVisitSavedAt(savedAt)) {
      rec.savedAt = savedAt;
      rec.recordId = rec.recordId || ('v-sheet-r' + rec.sheetRow + '-' + id);
    } else {
      assignSheetVisitTodayTime_(rec, rowIndex);
    }
  });
  visits.sort(function(a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
  return visits;
}

function fetchVisitRecordsFromGviz(studentId) {
  if (!SHEETS_CONFIG.ENABLED || !SHEETS_CONFIG.SPREADSHEET_ID || !studentId) {
    return Promise.resolve([]);
  }
  var sheetName = (SHEET_NAMES && SHEET_NAMES.visit) ? SHEET_NAMES.visit : 'บันทึกการรักษา';
  var url = 'https://docs.google.com/spreadsheets/d/' + SHEETS_CONFIG.SPREADSHEET_ID +
    '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(sheetName);
  return fetch(url, { method: 'GET', mode: 'cors' })
    .then(function(res) { return res.text(); })
    .then(function(text) {
      var data = parseGvizJson_(text);
      if (!data || data.status !== 'ok') return [];
      return parseGvizVisitRows_(data, studentId);
    })
    .catch(function() { return []; });
}

function fetchVisitRecordsFromSheetApi(studentId) {
  if (!SHEETS_CONFIG.WEB_APP_URL || !studentId) return Promise.resolve([]);
  var payload = { action: 'getVisits', studentId: String(studentId).trim() };
  var url = SHEETS_CONFIG.WEB_APP_URL + '?payload=' + encodeURIComponent(JSON.stringify(payload));
  return fetch(url, { method: 'GET', mode: 'cors', redirect: 'follow' })
    .then(function(res) { return res.text(); })
    .then(function(text) {
      if (text.indexOf('Sign in') !== -1 || text.indexOf('AccountChooser') !== -1) return [];
      var data;
      try { data = JSON.parse(text); } catch (e) { return []; }
      if (data && data.ok && Array.isArray(data.visits)) return data.visits;
      return [];
    })
    .catch(function() { return []; });
}

function fetchVisitRecordsFromSheet(studentId) {
  if (!SHEETS_CONFIG.ENABLED || !studentId) return Promise.resolve([]);
  return fetchVisitRecordsFromSheetApi(studentId).then(function(visits) {
    if (visits && visits.length) return visits;
    return fetchVisitRecordsFromGviz(studentId);
  });
}

function fetchAllVisitRecordsFromGviz() {
  if (!SHEETS_CONFIG.ENABLED || !SHEETS_CONFIG.SPREADSHEET_ID) {
    return Promise.resolve([]);
  }
  var sheetName = (SHEET_NAMES && SHEET_NAMES.visit) ? SHEET_NAMES.visit : 'บันทึกการรักษา';
  var url = 'https://docs.google.com/spreadsheets/d/' + SHEETS_CONFIG.SPREADSHEET_ID +
    '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(sheetName);
  return fetch(url, { method: 'GET', mode: 'cors' })
    .then(function(res) { return res.text(); })
    .then(function(text) {
      var data = parseGvizJson_(text);
      if (!data || data.status !== 'ok') return [];
      return parseGvizVisitRows_(data, null);
    })
    .catch(function() { return []; });
}

function fetchAllVisitRecordsFromSheet() {
  if (!SHEETS_CONFIG.ENABLED) return Promise.resolve([]);
  return fetchAllVisitRecordsFromGviz();
}

document.addEventListener('DOMContentLoaded', function() {
  ensureSheetSyncDom_();
  flushSheetQueue_();
});
