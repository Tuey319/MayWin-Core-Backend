export default chatgptResults1 = [
  {
    "id": "th-morning-june15",
    "description": "Thai morning shift explicit date",
    "input": "ขอเวรเช้าวันที่ 15 มิถุนายน 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-06-15",
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "th-afternoon-july02",
    "description": "Thai afternoon shift request",
    "input": "อยากลงเวรบ่ายวันที่ 2 กรกฎาคม 2026 ค่ะ",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-07-02",
          "shift": "afternoon"
        }
      ]
    }
  },
  {
    "id": "th-night-aug18",
    "description": "Thai night shift request",
    "input": "ขอเวรดึกวันที่ 18 สิงหาคม 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-08-18",
          "shift": "night"
        }
      ]
    }
  },
  {
    "id": "th-morning-sep09",
    "description": "Thai morning shift polite phrasing",
    "input": "ช่วยใส่เวรเช้าให้วันที่ 9 กันยายน 2026 ด้วยค่ะ",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-09-09",
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "th-afternoon-june28",
    "description": "Thai afternoon shift concise phrasing",
    "input": "เวรบ่าย 28 มิถุนายน 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-06-28",
          "shift": "afternoon"
        }
      ]
    }
  },
  {
    "id": "th-leave-june20",
    "description": "Thai leave request explicit date",
    "input": "ขอลาวันที่ 20 มิถุนายน 2026 ค่ะ",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-06-20",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "th-leave-july14",
    "description": "Thai day off request",
    "input": "ขอหยุดงานวันที่ 14 กรกฎาคม 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-07-14",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "th-leave-aug07",
    "description": "Thai leave with polite ending",
    "input": "รบกวนขอลาวันที่ 7 สิงหาคม 2026 ด้วยนะคะ",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-08-07",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "th-leave-sep25",
    "description": "Thai casual leave request",
    "input": "ขอ off วันที่ 25 กันยายน 2026 ค่ะ",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-09-25",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "th-leave-june03",
    "description": "Thai leave request formal wording",
    "input": "ต้องการลาหยุดวันที่ 3 มิถุนายน 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-06-03",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "en-morning-june22",
    "description": "English morning shift request",
    "input": "I want morning shift on June 22, 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-06-22",
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "en-afternoon-july19",
    "description": "English afternoon shift request",
    "input": "Please assign me afternoon shift on July 19, 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-07-19",
          "shift": "afternoon"
        }
      ]
    }
  },
  {
    "id": "en-night-aug30",
    "description": "English night shift concise phrasing",
    "input": "night shift August 30 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-08-30",
          "shift": "night"
        }
      ]
    }
  },
  {
    "id": "en-morning-sep11",
    "description": "English polite morning shift",
    "input": "Can I work morning on September 11, 2026?",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-09-11",
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "en-afternoon-june06",
    "description": "English abbreviated afternoon shift",
    "input": "Afternoon duty for June 6, 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-06-06",
          "shift": "afternoon"
        }
      ]
    }
  },
  {
    "id": "en-leave-july05",
    "description": "English day off request",
    "input": "Day off on July 5, 2026 please",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-07-05",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "en-leave-aug12",
    "description": "English leave request formal",
    "input": "I would like leave on August 12, 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-08-12",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "en-leave-sep03",
    "description": "English casual off request",
    "input": "Need off Sep 3 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-09-03",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "en-leave-june17",
    "description": "English request for vacation day",
    "input": "Please give me a day off on June 17, 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-06-17",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "en-leave-sep28",
    "description": "English leave short phrasing",
    "input": "leave September 28, 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-09-28",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "multi-th-two-shifts",
    "description": "Thai multiple shift request",
    "input": "ขอเวรเช้าวันที่ 10 มิถุนายน 2026 และเวรบ่ายวันที่ 11 มิถุนายน 2026",
    "expect": {
      "count": 2,
      "items": [
        {
          "date": "2026-06-10",
          "shift": "morning"
        },
        {
          "date": "2026-06-11",
          "shift": "afternoon"
        }
      ]
    }
  },
  {
    "id": "multi-en-shift-leave",
    "description": "English shift and leave combination",
    "input": "Morning shift on July 7, 2026 and day off on July 8, 2026",
    "expect": {
      "count": 2,
      "items": [
        {
          "date": "2026-07-07",
          "shift": "morning"
        },
        {
          "date": "2026-07-08",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "multi-mixed-three-items",
    "description": "Mixed language three requests",
    "input": "ขอ night shift วันที่ 20 สิงหาคม 2026 แล้วก็ลา 21 สิงหาคม 2026 and morning shift on August 22, 2026",
    "expect": {
      "count": 3,
      "items": [
        {
          "date": "2026-08-20",
          "shift": "night"
        },
        {
          "date": "2026-08-21",
          "shift": "leave"
        },
        {
          "date": "2026-08-22",
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "multi-th-leave-two-days",
    "description": "Thai multiple leave days",
    "input": "ขอลาหยุดวันที่ 1 กันยายน 2026 กับ 2 กันยายน 2026",
    "expect": {
      "count": 2,
      "items": [
        {
          "date": "2026-09-01",
          "shift": "leave"
        },
        {
          "date": "2026-09-02",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "multi-en-three-shifts",
    "description": "English three shifts in one message",
    "input": "Night shift on June 25, 2026, afternoon on June 26, 2026, and morning on June 27, 2026",
    "expect": {
      "count": 3,
      "items": [
        {
          "date": "2026-06-25",
          "shift": "night"
        },
        {
          "date": "2026-06-26",
          "shift": "afternoon"
        },
        {
          "date": "2026-06-27",
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "multi-th-en-combo",
    "description": "Thai and English mixed multiple items",
    "input": "เวรเช้า 14 กรกฎาคม 2026 แล้วก็ day off on July 15, 2026",
    "expect": {
      "count": 2,
      "items": [
        {
          "date": "2026-07-14",
          "shift": "morning"
        },
        {
          "date": "2026-07-15",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "casual-th-morning-dateonly",
    "description": "Thai casual morning without year",
    "input": "อยากได้เวรเช้าวันที่ 10 นะคะ",
    "expect": {
      "shift_only": true,
      "items": [
        {
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "casual-en-next-friday-off",
    "description": "English relative leave request",
    "input": "can I take next Friday off?",
    "expect": {
      "shift_only": true,
      "items": [
        {
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "casual-th-night-no-year",
    "description": "Thai night shift no year",
    "input": "ขอเวรดึกวันที่ 22 ค่ะ",
    "expect": {
      "shift_only": true,
      "items": [
        {
          "shift": "night"
        }
      ]
    }
  },
  {
    "id": "casual-en-afternoon-tomorrow",
    "description": "English tomorrow afternoon shift",
    "input": "Need afternoon shift tomorrow",
    "expect": {
      "shift_only": true,
      "items": [
        {
          "shift": "afternoon"
        }
      ]
    }
  },
  {
    "id": "casual-th-leave-nextweek",
    "description": "Thai leave next week",
    "input": "อาทิตย์หน้าขอหยุดวันจันทร์ได้ไหม",
    "expect": {
      "shift_only": true,
      "items": [
        {
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "casual-en-morning-no-date",
    "description": "English morning shift without date",
    "input": "I'd prefer morning shift",
    "expect": {
      "shift_only": true,
      "items": [
        {
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "formal-th-leave-june30",
    "description": "Formal Thai leave request",
    "input": "รบกวนขอลาหยุดวันที่ 30 มิถุนายน 2026 ด้วยนะคะ",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-06-30",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "formal-th-night-july21",
    "description": "Formal Thai night shift request",
    "input": "ขอความกรุณาจัดเวรดึกให้วันที่ 21 กรกฎาคม 2026 ค่ะ",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-07-21",
          "shift": "night"
        }
      ]
    }
  },
  {
    "id": "formal-th-morning-aug09",
    "description": "Formal Thai morning request",
    "input": "เรียนขอเวรเช้าวันที่ 9 สิงหาคม 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-08-09",
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "formal-th-afternoon-sep16",
    "description": "Formal Thai afternoon request",
    "input": "รบกวนลงเวรบ่ายให้วันที่ 16 กันยายน 2026 ด้วยค่ะ",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-09-16",
          "shift": "afternoon"
        }
      ]
    }
  },
  {
    "id": "mixed-th-night-en",
    "description": "Thai with English night shift term",
    "input": "ขอ night shift วันที่ 20 กรกฎาคม 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-07-20",
          "shift": "night"
        }
      ]
    }
  },
  {
    "id": "mixed-en-th-leave",
    "description": "English with Thai leave phrasing",
    "input": "Need ขอลา วันที่ 8 สิงหาคม 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-08-08",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "mixed-th-afternoon-en-date",
    "description": "Thai afternoon with English month",
    "input": "เวรบ่าย on September 4, 2026 ค่ะ",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-09-04",
          "shift": "afternoon"
        }
      ]
    }
  },
  {
    "id": "mixed-en-morning-thai-date",
    "description": "English morning with Thai date",
    "input": "morning shift วันที่ 13 มิถุนายน 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-06-13",
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "mixed-th-leave-off",
    "description": "Thai leave with English off",
    "input": "ขอ off วันที่ 19 กรกฎาคม 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-07-19",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "unrelated-th-greeting",
    "description": "Thai greeting unrelated",
    "input": "สวัสดีค่ะ วันนี้อากาศดีมาก",
    "expect": {
      "empty": true
    }
  },
  {
    "id": "unrelated-en-hello",
    "description": "English greeting unrelated",
    "input": "hello",
    "expect": {
      "empty": true
    }
  },
  {
    "id": "unrelated-time-question",
    "description": "Question unrelated to shifts",
    "input": "what time is it",
    "expect": {
      "empty": true
    }
  },
  {
    "id": "unrelated-system-question",
    "description": "Thai system usage question",
    "input": "ระบบใช้งานยังไง",
    "expect": {
      "empty": true
    }
  },
  {
    "id": "unrelated-random-complaint",
    "description": "Random complaint unrelated",
    "input": "อินเทอร์เน็ตช้ามากวันนี้",
    "expect": {
      "empty": true
    }
  },
  {
    "id": "unrelated-food-chat",
    "description": "Casual food discussion",
    "input": "Anyone wants coffee later?",
    "expect": {
      "empty": true
    }
  },
  {
    "id": "edge-date-only-th",
    "description": "Date only without shift",
    "input": "15 มิถุนายน 2026",
    "expect": {
      "empty": true
    }
  },
  {
    "id": "edge-shift-no-date-night",
    "description": "Night shift without date",
    "input": "ขอเวรดึก",
    "expect": {
      "shift_only": true,
      "items": [
        {
          "shift": "night"
        }
      ]
    }
  },
  {
    "id": "edge-typo-th-morning",
    "description": "Thai abbreviated morning with numeric date",
    "input": "เช้า วันที่15/6/2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-06-15",
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "edge-typo-en-night",
    "description": "English typo nite shift",
    "input": "nite shift July 8 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-07-08",
          "shift": "night"
        }
      ]
    }
  },
  {
    "id": "edge-multi-leave-en",
    "description": "English multiple leave days",
    "input": "I need off June 10 and June 11, 2026",
    "expect": {
      "count": 2,
      "items": [
        {
          "date": "2026-06-10",
          "shift": "leave"
        },
        {
          "date": "2026-06-11",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "edge-abbrev-afternoon",
    "description": "Abbreviated afternoon shift",
    "input": "บ่าย 03/09/2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-09-03",
          "shift": "afternoon"
        }
      ]
    }
  },
  {
    "id": "edge-morning-short-en",
    "description": "Short English morning request",
    "input": "morning pls",
    "expect": {
      "shift_only": true,
      "items": [
        {
          "shift": "morning"
        }
      ]
    }
  },
  {
    "id": "edge-leave-no-date-en",
    "description": "Leave without date",
    "input": "Need a day off",
    "expect": {
      "shift_only": true,
      "items": [
        {
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "th-night-sep12",
    "description": "Thai night shift explicit date",
    "input": "ลงเวรดึกให้วันที่ 12 กันยายน 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-09-12",
          "shift": "night"
        }
      ]
    }
  },
  {
    "id": "en-afternoon-aug04",
    "description": "English afternoon shift simple phrasing",
    "input": "afternoon shift Aug 4 2026",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-08-04",
          "shift": "afternoon"
        }
      ]
    }
  },
  {
    "id": "formal-th-leave-sep29",
    "description": "Formal Thai leave request polite",
    "input": "ใคร่ขอลาหยุดในวันที่ 29 กันยายน 2026 ค่ะ",
    "expect": {
      "count": 1,
      "items": [
        {
          "date": "2026-09-29",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "mixed-night-and-leave",
    "description": "Mixed language night shift and leave",
    "input": "night shift วันที่ 6 มิถุนายน 2026 แล้วก็ขอลา 7 มิถุนายน 2026",
    "expect": {
      "count": 2,
      "items": [
        {
          "date": "2026-06-06",
          "shift": "night"
        },
        {
          "date": "2026-06-07",
          "shift": "leave"
        }
      ]
    }
  },
  {
    "id": "casual-th-afternoon-next",
    "description": "Thai casual afternoon request",
    "input": "พรุ่งนี้ขอเวรบ่ายนะ",
    "expect": {
      "shift_only": true,
      "items": [
        {
          "shift": "afternoon"
        }
      ]
    }
  },
  {
    "id": "unrelated-weather",
    "description": "Weather comment unrelated",
    "input": "ฝนตกหนักมากวันนี้",
    "expect": {
      "empty": true
    }
  },
  {
    "id": "edge-date-only-en",
    "description": "English date only no shift",
    "input": "September 18, 2026",
    "expect": {
      "empty": true
    }
  },
  {
    "id": "multi-en-two-leaves",
    "description": "English two leave requests",
    "input": "Off on August 1, 2026 and August 2, 2026",
    "expect": {
      "count": 2,
      "items": [
        {
          "date": "2026-08-01",
          "shift": "leave"
        },
        {
          "date": "2026-08-02",
          "shift": "leave"
        }
      ]
    }
  }
]

