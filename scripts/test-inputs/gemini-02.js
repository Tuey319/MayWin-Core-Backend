export default gemini02 = [
  {
    "id": "th-morning-june02",
    "description": "Thai morning shift with early June date",
    "input": "ขอลงเวรเช้าวันที่ 2 มิถุนายน 2026 ค่ะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-02", "shift": "morning" }]
    }
  },
  {
    "id": "th-afternoon-july15",
    "description": "Thai afternoon shift middle of July",
    "input": "อยากเข้าเวรบ่ายวันที่ 15 กรกฎาคม 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-15", "shift": "afternoon" }]
    }
  },
  {
    "id": "th-night-aug22",
    "description": "Thai night shift late August",
    "input": "ลงเวรดึกให้วันที่ 22 สิงหาคม 2026 ด้วยครับ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-22", "shift": "night" }]
    }
  },
  {
    "id": "th-leave-sep05",
    "description": "Thai leave request early September",
    "input": "ขอลาหยุดวันที่ 5 กันยายน 2026 นะคะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-05", "shift": "leave" }]
    }
  },
  {
    "id": "th-leave-july20",
    "description": "Thai day off request",
    "input": "วันที่ 20 กรกฎาคม 2026 รบกวนขอวันหยุดค่ะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-20", "shift": "leave" }]
    }
  },
  {
    "id": "en-morning-aug03",
    "description": "English morning shift request",
    "input": "Can I have the morning shift on August 3, 2026?",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-03", "shift": "morning" }]
    }
  },
  {
    "id": "en-afternoon-sep12",
    "description": "English afternoon shift request",
    "input": "I would like to work afternoon on September 12, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-12", "shift": "afternoon" }]
    }
  },
  {
    "id": "en-night-june18",
    "description": "English night shift request",
    "input": "Put me down for night shift on June 18, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-18", "shift": "night" }]
    }
  },
  {
    "id": "en-leave-july28",
    "description": "English day off request",
    "input": "Need a day off for July 28, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-28", "shift": "leave" }]
    }
  },
  {
    "id": "en-leave-sep30",
    "description": "English leave request on deadline",
    "input": "I'm taking leave on September 30, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-30", "shift": "leave" }]
    }
  },
  {
    "id": "multi-th-double-morning",
    "description": "Thai two morning shifts",
    "input": "ขอเวรเช้าวันที่ 10 และ 11 มิถุนายน 2026 ครับ",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-06-10", "shift": "morning" },
        { "date": "2026-06-11", "shift": "morning" }
      ]
    }
  },
  {
    "id": "multi-th-shift-mix",
    "description": "Thai morning and night combination",
    "input": "วันที่ 5 กรกฎาคมขอเช้า ส่วนวันที่ 6 กรกฎาคม 2026 ขอดึกนะคะ",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-07-05", "shift": "morning" },
        { "date": "2026-07-06", "shift": "night" }
      ]
    }
  },
  {
    "id": "multi-en-consecutive-off",
    "description": "English multiple days off",
    "input": "Off on August 15 and August 16, 2026 please",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-08-15", "shift": "leave" },
        { "date": "2026-08-16", "shift": "leave" }
      ]
    }
  },
  {
    "id": "multi-en-complex-request",
    "description": "English three different shifts",
    "input": "Morning on Sep 1, Afternoon on Sep 2, and Night on Sep 3, 2026",
    "expect": {
      "count": 3,
      "items": [
        { "date": "2026-09-01", "shift": "morning" },
        { "date": "2026-09-02", "shift": "afternoon" },
        { "date": "2026-09-03", "shift": "night" }
      ]
    }
  },
  {
    "id": "multi-mixed-lang-v1",
    "description": "Mixed Thai/English shift and leave",
    "input": "ขอเวรเช้าวันที่ 12 June 2026 แล้วก็ day off วันที่ 13 มิถุนายน 2026",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-06-12", "shift": "morning" },
        { "date": "2026-06-13", "shift": "leave" }
      ]
    }
  },
  {
    "id": "casual-th-morning-next-week",
    "description": "Thai relative morning shift",
    "input": "จันทร์หน้าขอเวรเช้านะคะ",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "morning" }]
    }
  },
  {
    "id": "casual-th-night-tonight",
    "description": "Thai relative night shift",
    "input": "คืนนี้ขอลงดึกครับ",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "night" }]
    }
  },
  {
    "id": "casual-en-off-tomorrow",
    "description": "English relative leave",
    "input": "I need tomorrow off",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "leave" }]
    }
  },
  {
    "id": "casual-en-afternoon-next-friday",
    "description": "English relative afternoon shift",
    "input": "Can I get afternoon shift next Friday?",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "afternoon" }]
    }
  },
  {
    "id": "formal-th-polite-morning",
    "description": "Formal Thai morning request",
    "input": "กราบเรียนหัวหน้าเวร ขอความอนุเคราะห์ลงเวรเช้าวันที่ 25 สิงหาคม 2026 ค่ะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-25", "shift": "morning" }]
    }
  },
  {
    "id": "formal-th-polite-leave",
    "description": "Formal Thai leave request",
    "input": "มีความจำเป็นต้องขอลาหยุดในวันที่ 14 กันยายน 2026 ครับผม",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-14", "shift": "leave" }]
    }
  },
  {
    "id": "formal-th-polite-afternoon",
    "description": "Formal Thai afternoon request",
    "input": "รบกวนช่วยพิจารณาจัดเวรบ่ายให้ในวันที่ 19 มิถุนายน 2026 ด้วยนะคะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-19", "shift": "afternoon" }]
    }
  },
  {
    "id": "mixed-th-term-night",
    "description": "Thai with English 'night shift' term",
    "input": "วันที่ 2 กรกฎาคม 2026 ขอลง night shift ค่ะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-02", "shift": "night" }]
    }
  },
  {
    "id": "mixed-en-term-la",
    "description": "English with Thai 'la' (leave) term",
    "input": "I want to ขอลา on August 10, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-10", "shift": "leave" }]
    }
  },
  {
    "id": "unrelated-th-greeting",
    "description": "Thai greeting only",
    "input": "สวัสดีตอนเช้าค่ะทุกคน",
    "expect": { "empty": true }
  },
  {
    "id": "unrelated-en-question",
    "description": "English technical question",
    "input": "How do I change my password?",
    "expect": { "empty": true }
  },
  {
    "id": "unrelated-th-complaint",
    "description": "Thai complaint",
    "input": "แอร์ที่หอพักเสียอีกแล้ว",
    "expect": { "empty": true }
  },
  {
    "id": "unrelated-en-casual",
    "description": "English casual chat",
    "input": "Anyone wants to grab lunch later?",
    "expect": { "empty": true }
  },
  {
    "id": "unrelated-th-system",
    "description": "Thai system usage question",
    "input": "ระบบนี้ใช้ยังไงคะ",
    "expect": { "empty": true }
  },
  {
    "id": "unrelated-en-status",
    "description": "English status update",
    "input": "I'm currently at the hospital lobby",
    "expect": { "empty": true }
  },
  {
    "id": "edge-date-only-th",
    "description": "Thai date with no shift",
    "input": "25 มิถุนายน 2026",
    "expect": { "empty": true }
  },
  {
    "id": "edge-shift-only-en",
    "description": "English shift with no date",
    "input": "I prefer working afternoon shifts",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "afternoon" }]
    }
  },
  {
    "id": "edge-typo-th-morning",
    "description": "Thai morning typo/abbreviation",
    "input": "ลงเวรเช่า 1 มิ.ย. 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-01", "shift": "morning" }]
    }
  },
  {
    "id": "edge-typo-en-night",
    "description": "English night typo",
    "input": "nite shift on Sep 15 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-15", "shift": "night" }]
    }
  },
  {
    "id": "edge-abbrev-th-afternoon",
    "description": "Thai afternoon abbreviation",
    "input": "บ่าย 04/07/2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-04", "shift": "afternoon" }]
    }
  },
  {
    "id": "edge-multi-day-range",
    "description": "English date range request",
    "input": "I need leave from June 20 to June 22, 2026",
    "expect": {
      "count": 3,
      "items": [
        { "date": "2026-06-20", "shift": "leave" },
        { "date": "2026-06-21", "shift": "leave" },
        { "date": "2026-06-22", "shift": "leave" }
      ]
    }
  },
  {
    "id": "th-morning-aug09",
    "description": "Standard Thai morning shift",
    "input": "ขอเวรเช้าวันที่ 9 สิงหาคม 2026 ค่ะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-09", "shift": "morning" }]
    }
  },
  {
    "id": "en-afternoon-june25",
    "description": "Standard English afternoon shift",
    "input": "Afternoon shift for June 25, 2026 please",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-25", "shift": "afternoon" }]
    }
  },
  {
    "id": "th-night-july04",
    "description": "Thai night shift on US holiday",
    "input": "วันที่ 4 กรกฎาคม 2026 ขอลงเวรดึก",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-04", "shift": "night" }]
    }
  },
  {
    "id": "en-leave-aug12",
    "description": "English leave on Thai holiday",
    "input": "I would like to take August 12, 2026 off",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-12", "shift": "leave" }]
    }
  },
  {
    "id": "multi-th-three-shifts",
    "description": "Thai three shifts one message",
    "input": "ขอเช้าวันที่ 1 บ่ายวันที่ 2 ดึกวันที่ 3 กันยายน 2026",
    "expect": {
      "count": 3,
      "items": [
        { "date": "2026-09-01", "shift": "morning" },
        { "date": "2026-09-02", "shift": "afternoon" },
        { "date": "2026-09-03", "shift": "night" }
      ]
    }
  },
  {
    "id": "multi-en-shift-and-off",
    "description": "English shift and leave combination",
    "input": "Morning shift on July 1 and Day off on July 2, 2026",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-07-01", "shift": "morning" },
        { "date": "2026-07-02", "shift": "leave" }
      ]
    }
  },
  {
    "id": "casual-th-leave-next-monday",
    "description": "Thai relative leave request",
    "input": "จันทร์หน้าขอนะลาครับ",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "leave" }]
    }
  },
  {
    "id": "casual-en-morning-today",
    "description": "English relative morning shift",
    "input": "I want morning shift today",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "morning" }]
    }
  },
  {
    "id": "formal-th-humble-night",
    "description": "Polite Thai night shift request",
    "input": "เรียนหัวหน้าเวร ใคร่ขอลงเวรดึกในวันที่ 18 กรกฎาคม 2026 ครับ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-18", "shift": "night" }]
    }
  },
  {
    "id": "mixed-th-off-term",
    "description": "Thai using 'off' term",
    "input": "ขอ off วันที่ 30 สิงหาคม 2026 ค่ะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-30", "shift": "leave" }]
    }
  },
  {
    "id": "mixed-en-morning-thai-date",
    "description": "English with Thai month",
    "input": "Morning shift 12 กันยายน 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-12", "shift": "morning" }]
    }
  },
  {
    "id": "unrelated-th-joke",
    "description": "Thai joke/casual chat",
    "input": "วันนี้ใครจะเป็นคนเลี้ยงกาแฟเอ่ย",
    "expect": { "empty": true }
  },
  {
    "id": "unrelated-en-greeting-v2",
    "description": "English greeting",
    "input": "Good morning team!",
    "expect": { "empty": true }
  },
  {
    "id": "edge-abbrev-en-morning",
    "description": "English morning abbreviation",
    "input": "am shift June 5 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-05", "shift": "morning" }]
    }
  },
  {
    "id": "edge-numeric-en-date",
    "description": "English numeric date",
    "input": "Afternoon 06-15-2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-15", "shift": "afternoon" }]
    }
  },
  {
    "id": "th-morning-july31",
    "description": "Thai morning end of month",
    "input": "ขอเวรเช้า 31 กรกฎาคม 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-31", "shift": "morning" }]
    }
  },
  {
    "id": "en-night-sep29",
    "description": "English night shift near deadline",
    "input": "Night shift for Sep 29 2026 please",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-29", "shift": "night" }]
    }
  },
  {
    "id": "multi-th-leave-range",
    "description": "Thai date range leave",
    "input": "ขอลาวันที่ 1-3 สิงหาคม 2026 ค่ะ",
    "expect": {
      "count": 3,
      "items": [
        { "date": "2026-08-01", "shift": "leave" },
        { "date": "2026-08-02", "shift": "leave" },
        { "date": "2026-08-03", "shift": "leave" }
      ]
    }
  },
  {
    "id": "formal-th-request-v2",
    "description": "Formal Thai shift request",
    "input": "รบกวนจัดเวรเช้าให้ในวันที่ 14 มิถุนายน 2026 ด้วยนะคะ ขอบคุณค่ะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-14", "shift": "morning" }]
    }
  },
  {
    "id": "casual-th-afternoon-today",
    "description": "Thai relative afternoon",
    "input": "วันนี้ขอเวรบ่ายนะ",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "afternoon" }]
    }
  },
  {
    "id": "unrelated-weather-v2",
    "description": "Thai weather comment",
    "input": "วันนี้อากาศร้อนมากเลย",
    "expect": { "empty": true }
  },
  {
    "id": "edge-multi-mixed-lang",
    "description": "Complex mixed language multi-item",
    "input": "เวรเช้าวันที่ 10 July 2026 and night shift 11 ก.ค. 2026",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-07-10", "shift": "morning" },
        { "date": "2026-07-11", "shift": "night" }
      ]
    }
  },
  {
    "id": "edge-year-be-th",
    "description": "Thai Buddhist Era year",
    "input": "ขอเวรดึกวันที่ 1 กันยายน 2569",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-01", "shift": "night" }]
    }
  },
  {
    "id": "edge-short-en-off",
    "description": "Very short English off request",
    "input": "Off 08/08/2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-08", "shift": "leave" }]
    }
  }
]