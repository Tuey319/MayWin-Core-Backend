// PASTE GEMINI-GENERATED TEST CASES HERE
// Same format as chatgpt-01.js — raw array, export default
// Use CHATBOT_TEST_CASE_GENERATOR.md to generate

export default gemini01 =[
  {
    "id": "th-morning-july12",
    "description": "Basic Thai morning shift request",
    "input": "ลงเวรเช้าวันที่ 12 กรกฎาคม 2026 ให้หน่อยค่ะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-12", "shift": "morning" }]
    }
  },
  {
    "id": "th-afternoon-aug05",
    "description": "Basic Thai afternoon shift request",
    "input": "ขอเปลี่ยนเป็นเวรบ่ายวันที่ 5 สิงหาคม 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-05", "shift": "afternoon" }]
    }
  },
  {
    "id": "th-night-sep20",
    "description": "Basic Thai night shift request",
    "input": "วันที่ 20 กันยายน 2026 อยากทำเวรดึกครับ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-20", "shift": "night" }]
    }
  },
  {
    "id": "th-leave-june10",
    "description": "Thai leave request with explicit date",
    "input": "ขอลางานวันที่ 10 มิถุนายน 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-10", "shift": "leave" }]
    }
  },
  {
    "id": "th-leave-aug15",
    "description": "Thai day off request",
    "input": "วันที่ 15 สิงหาคม 2026 ขอหยุดหนึ่งวันค่ะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-15", "shift": "leave" }]
    }
  },
  {
    "id": "th-leave-sep01",
    "description": "Thai informal leave request",
    "input": "1 กันยายน 2026 ขอ off นะคะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-01", "shift": "leave" }]
    }
  },
  {
    "id": "en-morning-june05",
    "description": "English morning shift request",
    "input": "Can you put me on morning shift for June 5, 2026?",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-05", "shift": "morning" }]
    }
  },
  {
    "id": "en-afternoon-july22",
    "description": "English afternoon shift request",
    "input": "I'd like to work the afternoon shift on July 22, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-22", "shift": "afternoon" }]
    }
  },
  {
    "id": "en-night-aug11",
    "description": "English night shift request",
    "input": "Assign me to night shift on August 11, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-11", "shift": "night" }]
    }
  },
  {
    "id": "en-leave-sep15",
    "description": "English leave request",
    "input": "I need to take a leave on September 15, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-15", "shift": "leave" }]
    }
  },
  {
    "id": "en-leave-june25",
    "description": "English day off request",
    "input": "Requesting a day off for June 25, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-25", "shift": "leave" }]
    }
  },
  {
    "id": "en-leave-july04",
    "description": "English casual off request",
    "input": "I'm off on July 4, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-04", "shift": "leave" }]
    }
  },
  {
    "id": "multi-th-morning-afternoon",
    "description": "Thai two shifts",
    "input": "ขอเวรเช้าวันที่ 3 กรกฎาคม และเวรบ่ายวันที่ 4 กรกฎาคม 2026",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-07-03", "shift": "morning" },
        { "date": "2026-07-04", "shift": "afternoon" }
      ]
    }
  },
  {
    "id": "multi-th-night-leave",
    "description": "Thai night shift and leave combo",
    "input": "ลงเวรดึกวันที่ 10 สิงหาคม แล้วขอลาหยุดวันที่ 11 สิงหาคม 2026 ค่ะ",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-08-10", "shift": "night" },
        { "date": "2026-08-11", "shift": "leave" }
      ]
    }
  },
  {
    "id": "multi-en-morning-night",
    "description": "English morning and night shifts",
    "input": "Morning shift on June 12, 2026 and Night shift on June 14, 2026",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-06-12", "shift": "morning" },
        { "date": "2026-06-14", "shift": "night" }
      ]
    }
  },
  {
    "id": "multi-en-three-leaves",
    "description": "English three consecutive leave days",
    "input": "I'll be away from Sep 20 to Sep 22, 2026. Requesting leave for all three days.",
    "expect": {
      "count": 3,
      "items": [
        { "date": "2026-09-20", "shift": "leave" },
        { "date": "2026-09-21", "shift": "leave" },
        { "date": "2026-09-22", "shift": "leave" }
      ]
    }
  },
  {
    "id": "multi-mixed-lang-shifts",
    "description": "Mixed language multiple shifts",
    "input": "ขอเวรเช้าวันที่ 5 July 2026 and afternoon shift วันที่ 6 กรกฎาคม 2026",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-07-05", "shift": "morning" },
        { "date": "2026-07-06", "shift": "afternoon" }
      ]
    }
  },
  {
    "id": "multi-th-sequential-shifts",
    "description": "Thai sequential shift request",
    "input": "วันที่ 1, 2, 3 สิงหาคม 2026 ขอลงเวรเช้าทั้งหมดเลยครับ",
    "expect": {
      "count": 3,
      "items": [
        { "date": "2026-08-01", "shift": "morning" },
        { "date": "2026-08-02", "shift": "morning" },
        { "date": "2026-08-03", "shift": "morning" }
      ]
    }
  },
  {
    "id": "casual-th-morning-relative",
    "description": "Thai casual morning without year",
    "input": "ขอเวรเช้าวันที่ 15 นะ",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "morning" }]
    }
  },
  {
    "id": "casual-en-next-monday-morning",
    "description": "English relative morning shift",
    "input": "Can I have the morning shift next Monday?",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "morning" }]
    }
  },
  {
    "id": "casual-th-leave-tomorrow",
    "description": "Thai relative leave request",
    "input": "พรุ่งนี้ขอลานะครับ",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "leave" }]
    }
  },
  {
    "id": "casual-en-afternoon-unclear",
    "description": "English shift without specific date",
    "input": "I prefer working afternoon shifts this week",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "afternoon" }]
    }
  },
  {
    "id": "casual-th-night-friday",
    "description": "Thai relative night shift",
    "input": "ศุกร์นี้ขอลงเวรดึกได้ไหมคะ",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "night" }]
    }
  },
  {
    "id": "casual-en-off-sometime",
    "description": "English vague off request",
    "input": "Need a day off sometime soon",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "leave" }]
    }
  },
  {
    "id": "formal-th-request-morning",
    "description": "Polite Thai morning request",
    "input": "เรียนหัวหน้าเวร ใคร่ขอรับเวรเช้าในวันที่ 18 มิถุนายน 2569 ค่ะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-18", "shift": "morning" }]
    }
  },
  {
    "id": "formal-th-request-leave",
    "description": "Polite Thai leave request",
    "input": "รบกวนพิจารณาอนุมัติวันลาในวันที่ 25 กรกฎาคม 2026 ด้วยนะคะ ขอบคุณค่ะ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-25", "shift": "leave" }]
    }
  },
  {
    "id": "formal-th-request-afternoon",
    "description": "Polite Thai afternoon request",
    "input": "ขอความกรุณาจัดสรรเวรบ่ายให้ในวันที่ 12 สิงหาคม 2026 ครับ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-12", "shift": "afternoon" }]
    }
  },
  {
    "id": "formal-th-request-night",
    "description": "Polite Thai night request",
    "input": "มีความประสงค์จะขอลงเวรดึกในวันที่ 5 กันยายน 2026 ครับผม",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-05", "shift": "night" }]
    }
  },
  {
    "id": "mixed-th-morning-en-date",
    "description": "Thai shift with English month",
    "input": "ขอเวรเช้าวันที่ 20 June 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-20", "shift": "morning" }]
    }
  },
  {
    "id": "mixed-en-shift-th-date",
    "description": "English shift with Thai date",
    "input": "I want night shift วันที่ 15 สิงหาคม 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-15", "shift": "night" }]
    }
  },
  {
    "id": "mixed-th-request-en-off",
    "description": "Thai request with English 'off'",
    "input": "ช่วยลงวัน off ให้หน่อยวันที่ 30 กันยายน 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-30", "shift": "leave" }]
    }
  },
  {
    "id": "mixed-th-afternoon-hybrid",
    "description": "Hybrid Thai/English afternoon request",
    "input": "ลง afternoon shift ให้ที วันที่ 7 กรกฎาคม 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-07", "shift": "afternoon" }]
    }
  },
  {
    "id": "unrelated-th-food",
    "description": "Unrelated Thai message about food",
    "input": "วันนี้กินส้มตำกันไหมทุกคน",
    "expect": { "empty": true }
  },
  {
    "id": "unrelated-en-weather",
    "description": "Unrelated English message about weather",
    "input": "It's really raining hard today, isn't it?",
    "expect": { "empty": true }
  },
  {
    "id": "unrelated-th-sticker",
    "description": "Thai chat filler/sticker text",
    "input": "ขอบคุณมากค่าาา",
    "expect": { "empty": true }
  },
  {
    "id": "unrelated-en-error",
    "description": "Unrelated English technical comment",
    "input": "The mobile app is lagging again",
    "expect": { "empty": true }
  },
  {
    "id": "unrelated-th-greeting",
    "description": "Unrelated Thai greeting",
    "input": "อรุณสวัสดิ์ค่ะทุกคน",
    "expect": { "empty": true }
  },
  {
    "id": "unrelated-en-question",
    "description": "Unrelated English general question",
    "input": "Does anyone know where the spare keys are?",
    "expect": { "empty": true }
  },
  {
    "id": "edge-date-no-shift-th",
    "description": "Date provided without shift type in Thai",
    "input": "วันที่ 22 มิถุนายน 2026 ค่ะ",
    "expect": { "empty": true }
  },
  {
    "id": "edge-shift-no-date-th",
    "description": "Shift provided without date in Thai",
    "input": "ขอลงเวรบ่ายครับ",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "afternoon" }]
    }
  },
  {
    "id": "edge-typo-th-month",
    "description": "Thai month typo",
    "input": "เวรเช้า 15 มิถุนา 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-15", "shift": "morning" }]
    }
  },
  {
    "id": "edge-typo-en-shift",
    "description": "English shift typo",
    "input": "mornin shift on July 10 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-10", "shift": "morning" }]
    }
  },
  {
    "id": "edge-numeric-date-th",
    "description": "Numeric Thai date format",
    "input": "เวรดึก 12/08/2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-08-12", "shift": "night" }]
    }
  },
  {
    "id": "edge-abbreviation-th",
    "description": "Abbreviated Thai shift",
    "input": "เช้า 05/09/2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-05", "shift": "morning" }]
    }
  },
  {
    "id": "edge-short-en-leave",
    "description": "Short English leave request",
    "input": "Off 2026-06-18",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-18", "shift": "leave" }]
    }
  },
  {
    "id": "edge-multi-leave-range-en",
    "description": "English date range for leave",
    "input": "I need June 20-21, 2026 off",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-06-20", "shift": "leave" },
        { "date": "2026-06-21", "shift": "leave" }
      ]
    }
  },
  {
    "id": "th-afternoon-june20",
    "description": "Standard Thai afternoon shift",
    "input": "ขอเวรบ่ายวันที่ 20 มิถุนายน 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-20", "shift": "afternoon" }]
    }
  },
  {
    "id": "en-night-july08",
    "description": "Standard English night shift",
    "input": "I'll take the night shift on July 8, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-08", "shift": "night" }]
    }
  },
  {
    "id": "formal-th-leave-sep12",
    "description": "Formal Thai leave request",
    "input": "กราบเรียนหัวหน้า ขออนุญาตลาพักผ่อนวันที่ 12 กันยายน 2026 ครับ",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-12", "shift": "leave" }]
    }
  },
  {
    "id": "casual-en-morning-wednesday",
    "description": "Casual English relative morning shift",
    "input": "Morning shift for this Wednesday please",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "morning" }]
    }
  },
  {
    "id": "multi-th-three-shifts-mixed",
    "description": "Thai three mixed items",
    "input": "ขอเช้าวันที่ 1 บ่ายวันที่ 2 แล้วก็ดึกวันที่ 3 สิงหาคม 2026 นะคะ",
    "expect": {
      "count": 3,
      "items": [
        { "date": "2026-08-01", "shift": "morning" },
        { "date": "2026-08-02", "shift": "afternoon" },
        { "date": "2026-08-03", "shift": "night" }
      ]
    }
  },
  {
    "id": "unrelated-th-politics",
    "description": "Unrelated Thai comment",
    "input": "การเมืองช่วงนี้เครียดจังเลยเนอะ",
    "expect": { "empty": true }
  },
  {
    "id": "edge-us-date-format-en",
    "description": "English US date format",
    "input": "Afternoon shift on 07/15/2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-15", "shift": "afternoon" }]
    }
  },
  {
    "id": "mixed-th-leave-vacation",
    "description": "Thai request using 'vacation' in English",
    "input": "ขอลาไป vacation วันที่ 10-12 สิงหาคม 2026",
    "expect": {
      "count": 3,
      "items": [
        { "date": "2026-08-10", "shift": "leave" },
        { "date": "2026-08-11", "shift": "leave" },
        { "date": "2026-08-12", "shift": "leave" }
      ]
    }
  },
  {
    "id": "casual-th-afternoon-next-week",
    "description": "Thai relative afternoon shift",
    "input": "อาทิตย์หน้าขอเวรบ่ายทุกวันจันทร์นะ",
    "expect": {
      "shift_only": true,
      "items": [{ "shift": "afternoon" }]
    }
  },
  {
    "id": "en-morning-sep30",
    "description": "Standard English morning shift late date",
    "input": "Morning duty for Sep 30, 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-30", "shift": "morning" }]
    }
  },
  {
    "id": "multi-en-shift-leave-mixed",
    "description": "English mixed shift and leave",
    "input": "Night shift on June 1 and then leave on June 2, 2026",
    "expect": {
      "count": 2,
      "items": [
        { "date": "2026-06-01", "shift": "night" },
        { "date": "2026-06-02", "shift": "leave" }
      ]
    }
  },
  {
    "id": "unrelated-en-greeting-morning",
    "description": "Unrelated English greeting",
    "input": "Good morning team, let's have a great day!",
    "expect": { "empty": true }
  },
  {
    "id": "edge-th-year-buddhist",
    "description": "Thai Buddhist calendar year (2569)",
    "input": "เวรบ่ายวันที่ 1 มิถุนายน 2569",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-01", "shift": "afternoon" }]
    }
  },
  {
    "id": "edge-en-abbrev-months",
    "description": "English abbreviated month name",
    "input": "Morning shift for Sept 15 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-09-15", "shift": "morning" }]
    }
  }
]
