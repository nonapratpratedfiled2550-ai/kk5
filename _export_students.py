# -*- coding: utf-8 -*-
"""Export student basic info from Excel to student-basic-data.js"""
import openpyxl, json, sys, os

EXCEL = r'c:\Users\acer\Downloads\2569-1-student (1).xlsx'
OUT_JS = os.path.join(os.path.dirname(__file__), 'student-basic-data.js')

wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
headers = list(rows[1])

def val(v):
    if v is None: return ''
    s = str(v).strip()
    return s if s != '-' else ''

def build_address(row, hmap):
    parts = []
    house = val(row[hmap.get('บ้านเลขที่', -1)])
    moo = val(row[hmap.get('หมู่', -1)])
    road = val(row[hmap.get('ถนน/ซอย', -1)])
    tambon = val(row[hmap.get('ตำบล', -1)])
    amphoe = val(row[hmap.get('อำเภอ', -1)])
    province = val(row[hmap.get('จังหวัด', -1)])
    if house: parts.append('บ้านเลขที่ ' + house)
    if moo: parts.append('หมู่ ' + moo)
    if road: parts.append(road)
    if tambon: parts.append('ต.' + tambon)
    if amphoe: parts.append('อ.' + amphoe)
    if province: parts.append('จ.' + province)
    return ' '.join(parts)

hmap = {h: i for i, h in enumerate(headers) if h}
# col 5 = school student ID (short number used in table)
ID_COL = hmap['เลขประจำตัวนักเรียน']
# There are two columns with same name - col 2 is citizen ID, col 5 is school ID
# Re-map: index 2 = citizen, index 5 = school id
CITIZEN_COL = 2
SCHOOL_ID_COL = 5

data = {}
for row in rows[2:]:
    if not row or row[SCHOOL_ID_COL] is None:
        continue
    sid = str(int(row[SCHOOL_ID_COL])) if isinstance(row[SCHOOL_ID_COL], (int, float)) else str(row[SCHOOL_ID_COL]).strip()
    if not sid:
        continue

    def full_name(p, f, l):
        return ' '.join(x for x in [val(row[hmap[p]]), val(row[hmap[f]]), val(row[hmap[l]])] if x)

    data[sid] = {
        'school': val(row[hmap['ชื่อโรงเรียน']]),
        'citizenId': val(row[CITIZEN_COL]) if CITIZEN_COL < len(row) else '',
        'gender': val(row[hmap['เพศ']]),
        'fullName': full_name('คำนำหน้าชื่อ', 'ชื่อ', 'นามสกุล'),
        'dob': val(row[hmap['วันเกิด']]),
        'age': val(row[hmap['อายุ(ปี)']]),
        'weight': val(row[hmap['น้ำหนัก']]),
        'height': val(row[hmap['ส่วนสูง']]),
        'bloodType': val(row[hmap['กลุ่มเลือด']]),
        'religion': val(row[hmap['ศาสนา']]),
        'race': val(row[hmap['เชื้อชาติ']]),
        'nationality': val(row[hmap['สัญชาติ']]),
        'address': build_address(row, hmap),
        'guardian': full_name('คำนำหน้าชื่อผู้ปกครอง', 'ชื่อผู้ปกครอง', 'นามสกุลผู้ปกครอง'),
        'guardianJob': val(row[hmap['อาชีพของผู้ปกครอง']]),
        'guardianRel': val(row[hmap['ความเกี่ยวข้องของผู้ปกครองกับนักเรียน']]),
        'father': full_name('คำนำหน้าชื่อบิดา', 'ชื่อบิดา', 'นามสกุลบิดา'),
        'fatherJob': val(row[hmap['อาชีพของบิดา']]),
        'mother': full_name('คำนำหน้าชื่อมารดา', 'ชื่อมารดา', 'นามสกุลมารดา'),
        'motherJob': val(row[hmap['อาชีพของมารดา']]),
        'disadvantaged': val(row[hmap['ความด้อยโอกาส']]),
    }
    for key in ['เบอร์โทรผู้ปกครอง', 'เบอร์โทรศัพท์ผู้ปกครอง', 'โทรศัพท์ผู้ปกครอง', 'หมายเลขโทรศัพท์ผู้ปกครอง', 'เบอร์โทร', 'โทรศัพท์']:
        if key in hmap:
            data[sid]['guardianPhone'] = val(row[hmap[key]])
            break

wb.close()

with open(OUT_JS, 'w', encoding='utf-8') as f:
    f.write('/* Auto-generated from 2569-1-student (1).xlsx */\n')
    f.write('const STUDENT_BASIC = ')
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')

print(f'Exported {len(data)} students -> {OUT_JS}')
print(f'File size: {os.path.getsize(OUT_JS):,} bytes')
