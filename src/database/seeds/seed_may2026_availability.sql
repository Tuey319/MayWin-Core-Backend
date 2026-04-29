-- Seed: May 2026 nurse shift hard constraints
-- org_id=4, unit_id=5
-- Strategy:
--   Leave  → DAY_OFF on 'ALL'
--   Single shift → UNAVAILABLE on the OTHER two shifts
--   [Morning, Evening] → UNAVAILABLE on NIGHT only
-- Source: MANAGER (hard constraint, solver must respect)

-- ── Clean up any previously seeded July rows (wrong month) ───────────────────
DELETE FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND worker_id IN (70, 71, 72, 73, 74, 75, 76, 176)
  AND date >= '2026-07-01'
  AND date <= '2026-07-31';

INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason, attributes)
VALUES
-- ── 2026-05-01 ──────────────────────────────────────────────────────────────
-- w72 Night
(72, 5, '2026-05-01', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(72, 5, '2026-05-01', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w73 Night
(73, 5, '2026-05-01', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(73, 5, '2026-05-01', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w75 Night
(75, 5, '2026-05-01', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(75, 5, '2026-05-01', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w76 Leave
(76, 5, '2026-05-01', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-02 ──────────────────────────────────────────────────────────────
-- w71 Leave
(71, 5, '2026-05-02', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w72 Morning
(72, 5, '2026-05-02', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(72, 5, '2026-05-02', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w73 Leave
(73, 5, '2026-05-02', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w76 Leave
(76, 5, '2026-05-02', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-03 ──────────────────────────────────────────────────────────────
-- w176 Leave
(176, 5, '2026-05-03', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w71 Evening
(71, 5, '2026-05-03', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
(71, 5, '2026-05-03', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
-- w72 Leave
(72, 5, '2026-05-03', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w73 Leave
(73, 5, '2026-05-03', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w75 Night
(75, 5, '2026-05-03', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(75, 5, '2026-05-03', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w76 Leave
(76, 5, '2026-05-03', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-04 ──────────────────────────────────────────────────────────────
-- w176 Leave
(176, 5, '2026-05-04', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w72 Leave
(72, 5, '2026-05-04', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w73 Leave
(73, 5, '2026-05-04', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w75 Leave
(75, 5, '2026-05-04', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w76 Leave
(76, 5, '2026-05-04', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-05 ──────────────────────────────────────────────────────────────
-- w176 Morning
(176, 5, '2026-05-05', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(176, 5, '2026-05-05', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w72 Leave
(72, 5, '2026-05-05', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w73 Evening
(73, 5, '2026-05-05', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
(73, 5, '2026-05-05', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
-- w75 Morning
(75, 5, '2026-05-05', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(75, 5, '2026-05-05', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),

-- ── 2026-05-06 ──────────────────────────────────────────────────────────────
-- w72 Evening
(72, 5, '2026-05-06', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
(72, 5, '2026-05-06', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
-- w75 Leave
(75, 5, '2026-05-06', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-08 ──────────────────────────────────────────────────────────────
-- w176 Leave
(176, 5, '2026-05-08', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w70 Morning
(70, 5, '2026-05-08', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(70, 5, '2026-05-08', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w73 Night
(73, 5, '2026-05-08', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(73, 5, '2026-05-08', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w75 Morning
(75, 5, '2026-05-08', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(75, 5, '2026-05-08', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),

-- ── 2026-05-09 ──────────────────────────────────────────────────────────────
-- w176 Leave
(176, 5, '2026-05-09', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w70 Leave
(70, 5, '2026-05-09', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w73 Leave
(73, 5, '2026-05-09', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w75 Leave
(75, 5, '2026-05-09', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w76 Leave
(76, 5, '2026-05-09', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-10 ──────────────────────────────────────────────────────────────
-- w176 Leave
(176, 5, '2026-05-10', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w70 Leave
(70, 5, '2026-05-10', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w73 Leave
(73, 5, '2026-05-10', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w75 Leave
(75, 5, '2026-05-10', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w76 Leave
(76, 5, '2026-05-10', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-11 ──────────────────────────────────────────────────────────────
-- w176 Morning
(176, 5, '2026-05-11', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(176, 5, '2026-05-11', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w70 Leave
(70, 5, '2026-05-11', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w72 Morning
(72, 5, '2026-05-11', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(72, 5, '2026-05-11', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w73 Evening
(73, 5, '2026-05-11', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
(73, 5, '2026-05-11', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
-- w75 Evening
(75, 5, '2026-05-11', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
(75, 5, '2026-05-11', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
-- w76 Leave
(76, 5, '2026-05-11', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-12 ──────────────────────────────────────────────────────────────
-- w70 Morning
(70, 5, '2026-05-12', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(70, 5, '2026-05-12', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w72 Leave
(72, 5, '2026-05-12', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w75 Night
(75, 5, '2026-05-12', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(75, 5, '2026-05-12', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),

-- ── 2026-05-13 ──────────────────────────────────────────────────────────────
-- w70 [Morning, Evening] → only NIGHT blocked
(70, 5, '2026-05-13', 'NIGHT', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning+Evening shift assigned', '{}'),
-- w72 Morning
(72, 5, '2026-05-13', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(72, 5, '2026-05-13', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w75 Night
(75, 5, '2026-05-13', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(75, 5, '2026-05-13', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),

-- ── 2026-05-15 ──────────────────────────────────────────────────────────────
-- w73 Night
(73, 5, '2026-05-15', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(73, 5, '2026-05-15', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w75 Morning
(75, 5, '2026-05-15', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(75, 5, '2026-05-15', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),

-- ── 2026-05-16 ──────────────────────────────────────────────────────────────
-- w176 Night
(176, 5, '2026-05-16', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(176, 5, '2026-05-16', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w71 Leave
(71, 5, '2026-05-16', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w73 Leave
(73, 5, '2026-05-16', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w75 Leave
(75, 5, '2026-05-16', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w76 Leave
(76, 5, '2026-05-16', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-17 ──────────────────────────────────────────────────────────────
-- w176 Leave
(176, 5, '2026-05-17', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w71 Leave
(71, 5, '2026-05-17', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w73 Leave
(73, 5, '2026-05-17', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w75 Leave
(75, 5, '2026-05-17', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w76 Leave
(76, 5, '2026-05-17', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-18 ──────────────────────────────────────────────────────────────
-- w176 Morning
(176, 5, '2026-05-18', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(176, 5, '2026-05-18', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w71 [Morning, Evening] → only NIGHT blocked
(71, 5, '2026-05-18', 'NIGHT', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning+Evening shift assigned', '{}'),
-- w73 Evening
(73, 5, '2026-05-18', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
(73, 5, '2026-05-18', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
-- w75 Evening
(75, 5, '2026-05-18', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
(75, 5, '2026-05-18', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),

-- ── 2026-05-23 ──────────────────────────────────────────────────────────────
-- w176 Night
(176, 5, '2026-05-23', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(176, 5, '2026-05-23', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w71 Leave
(71, 5, '2026-05-23', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w72 Morning
(72, 5, '2026-05-23', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(72, 5, '2026-05-23', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w76 Leave
(76, 5, '2026-05-23', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-24 ──────────────────────────────────────────────────────────────
-- w176 Leave
(176, 5, '2026-05-24', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w71 Morning
(71, 5, '2026-05-24', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(71, 5, '2026-05-24', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w72 Leave
(72, 5, '2026-05-24', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w74 Night
(74, 5, '2026-05-24', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(74, 5, '2026-05-24', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w76 Leave
(76, 5, '2026-05-24', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-25 ──────────────────────────────────────────────────────────────
-- w74 Leave
(74, 5, '2026-05-25', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w75 Morning
(75, 5, '2026-05-25', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(75, 5, '2026-05-25', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),

-- ── 2026-05-26 ──────────────────────────────────────────────────────────────
-- w71 Morning
(71, 5, '2026-05-26', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(71, 5, '2026-05-26', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w74 Leave
(74, 5, '2026-05-26', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w75 Evening
(75, 5, '2026-05-26', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
(75, 5, '2026-05-26', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),

-- ── 2026-05-27 ──────────────────────────────────────────────────────────────
-- w71 Leave
(71, 5, '2026-05-27', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w72 Leave
(72, 5, '2026-05-27', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w74 Evening
(74, 5, '2026-05-27', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
(74, 5, '2026-05-27', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Evening shift assigned', '{}'),
-- w75 Morning
(75, 5, '2026-05-27', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(75, 5, '2026-05-27', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),

-- ── 2026-05-28 ──────────────────────────────────────────────────────────────
-- w71 Leave
(71, 5, '2026-05-28', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w72 Leave
(72, 5, '2026-05-28', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w74 Night
(74, 5, '2026-05-28', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(74, 5, '2026-05-28', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),

-- ── 2026-05-29 ──────────────────────────────────────────────────────────────
-- w71 Leave
(71, 5, '2026-05-29', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w72 Leave
(72, 5, '2026-05-29', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w73 Night
(73, 5, '2026-05-29', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(73, 5, '2026-05-29', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w74 Leave
(74, 5, '2026-05-29', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-30 ──────────────────────────────────────────────────────────────
-- w176 Night
(176, 5, '2026-05-30', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(176, 5, '2026-05-30', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w71 Leave
(71, 5, '2026-05-30', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w72 Morning
(72, 5, '2026-05-30', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
(72, 5, '2026-05-30', 'NIGHT',   'UNAVAILABLE', 'MANAGER', 'Hard constraint: Morning shift assigned', '{}'),
-- w73 Leave
(73, 5, '2026-05-30', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w74 Leave
(74, 5, '2026-05-30', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w76 Leave
(76, 5, '2026-05-30', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),

-- ── 2026-05-31 ──────────────────────────────────────────────────────────────
-- w176 Leave
(176, 5, '2026-05-31', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w71 Leave
(71, 5, '2026-05-31', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w73 Leave
(73, 5, '2026-05-31', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}'),
-- w74 Night
(74, 5, '2026-05-31', 'MORNING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
(74, 5, '2026-05-31', 'EVENING', 'UNAVAILABLE', 'MANAGER', 'Hard constraint: Night shift assigned', '{}'),
-- w76 Leave
(76, 5, '2026-05-31', 'ALL', 'DAY_OFF', 'MANAGER', 'Hard constraint: Leave', '{}')

ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET
  type   = EXCLUDED.type,
  source = EXCLUDED.source,
  reason = EXCLUDED.reason;
