# MayWin Chatbot — Test Case Generator Prompt

> **Your job: generate the JSON array at the bottom of this file and reply with it. Nothing else.**

---

## Context

MayWin is a nurse shift-scheduling system for Thai hospitals. Nurses submit
shift preferences via a LINE chatbot by typing natural language messages in
Thai or English. A Gemini AI model reads each message and extracts structured
shift data.

This is purely an **LLM extraction accuracy test** — we are measuring how
often Gemini correctly identifies the shift type and date from a raw message.
There is no chatbot flow, no confirmation step, no server involved.

**What Gemini is asked to extract:**
```json
[{ "date": "YYYY-MM-DD", "shift": "morning|afternoon|night|leave" }]
```

- `morning`   = เวรเช้า  (07:00–15:00)
- `afternoon` = เวรบ่าย  (15:00–23:00)
- `night`     = เวรดึก   (23:00–07:00)
- `leave`     = ขอลา / day off

We run the nurse's raw message through Gemini and check whether the output
matches the expected result defined in each test case.

---

## Output Format (copy-paste into llm-test-cases.json)

Return a **JSON array** of test case objects. Each object:

```jsonc
{
  "id": "unique-kebab-case-string",       // required, no spaces
  "description": "one line description",  // required
  "input": "the nurse's raw message",     // required

  "expect": {
    // Pick ONE of the two modes below:

    // MODE A — expect at least these items
    "items": [
      { "date": "YYYY-MM-DD", "shift": "morning|afternoon|night|leave" }
    ],
    "count": 2,          // optional — exact total items expected (omit if flexible)
    "shift_only": true,  // optional — skip date check (use for relative dates like "next Monday")

    // MODE B — expect empty result (unrelated message)
    "empty": true
  }
}
```

**Rules:**
- Use `"empty": true` when the message has no shift/leave content and Gemini should return `[]`
- Use `"shift_only": true` when the date is relative or ambiguous (no year given) — only the shift type is validated
- When dates are explicit and include a year, always include the full `"date": "YYYY-MM-DD"` in items
- Use future dates: **2026-06-01 through 2026-09-30**
- Thai month names: มกราคม=01 กุมภาพันธ์=02 มีนาคม=03 เมษายน=04 พฤษภาคม=05 มิถุนายน=06 กรกฎาคม=07 สิงหาคม=08 กันยายน=09 ตุลาคม=10 พฤศจิกายน=11 ธันวาคม=12

---

## Categories to Cover

Generate **at least 3 cases per category**:

### 1. Thai — basic shifts (explicit date + year)
Morning, afternoon, night requests in standard Thai phrasing.
e.g. `"ขอเวรเช้าวันที่ 15 มิถุนายน 2026"`

### 2. Thai — leave / day off (explicit date + year)
e.g. `"ขอลาวันที่ 20 มิถุนายน 2026 ค่ะ"`

### 3. English — basic shifts (explicit date)
e.g. `"I want morning shift on June 20, 2026"`

### 4. English — leave / day off
e.g. `"Day off on July 5, 2026 please"`

### 5. Multiple items in one message (Thai and English)
One message requesting 2+ shifts or a mix of shift + leave.
Use `"count"` to assert exact number returned.

### 6. Casual / indirect phrasing (use shift_only)
No explicit year; relative dates or missing context.
e.g. `"อยากได้เวรเช้าวันที่ 10 นะคะ"`, `"can I take next Friday off?"`

### 7. Polite / formal Thai phrasing
e.g. `"รบกวนขอลาหยุดวันที่ 30 มิถุนายน 2026 ด้วยนะคะ"`

### 8. Mixed Thai/English
e.g. `"ขอ night shift วันที่ 20 กรกฎาคม 2026"`

### 9. Unrelated messages — expect empty
Greetings, questions, complaints, random text. Use `"empty": true`.
e.g. `"สวัสดีค่ะ"`, `"hello"`, `"what time is it"`, `"ระบบใช้งานยังไง"`

### 10. Edge cases
- Date only, no shift specified → `"empty": true`
- Shift mentioned without date → `"shift_only": true`
- Typos or abbreviations e.g. `"เช้า วันที่15/6/2026"`, `"nite shift July 8 2026"`
- Multiple leave days e.g. "I need off June 10 and June 11, 2026"

---

## Example Output (first 3 cases only — generate many more)

```json
[
  {
    "id": "th-morning-june15",
    "description": "Thai morning shift, explicit date with year",
    "input": "ขอเวรเช้าวันที่ 15 มิถุนายน 2026",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-06-15", "shift": "morning" }]
    }
  },
  {
    "id": "en-leave-july5",
    "description": "English day off request",
    "input": "Day off on July 5, 2026 please",
    "expect": {
      "count": 1,
      "items": [{ "date": "2026-07-05", "shift": "leave" }]
    }
  },
  {
    "id": "unrelated-greeting",
    "description": "Unrelated greeting — expect empty",
    "input": "สวัสดีค่ะ วันนี้อากาศดีมาก",
    "expect": { "empty": true }
  }
]
```

---

## Your Task

Generate 60 test cases following all the rules and categories above.

**Reply with only the raw JSON array. No explanation. No markdown fences. No preamble.**
Start your reply with `[` and end with `]`.

Rules:
1. 60 cases total, spread across all 10 categories (roughly 4–9 per category)
2. Vary phrasing — do not reuse the same sentence structure twice
3. Thai and English cases roughly equal
4. All IDs unique kebab-case, no spaces
5. Explicit dates must be within 2026-06-01 to 2026-09-30
6. `"empty": true` cases must have NO `"items"` field
7. `"shift_only": true` cases may omit `"date"` from items
