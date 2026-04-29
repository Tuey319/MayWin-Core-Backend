-- Seed: May 2026 nurse shift PREFERENCES (soft constraints)
-- org_id=4, unit_id=5
-- Types: PREFERRED = soft shift preference, AVOID = soft leave/day-off request
-- Source: NURSE (solver treats these as soft penalties, not hard blocks)

INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason, attributes)
VALUES
-- ── 2026-05-01 ──────────────────────────────────────────────────────────────
-- w72 prefers Night
(72, 5, '2026-05-01', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w73 prefers Night
(73, 5, '2026-05-01', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w75 prefers Night
(75, 5, '2026-05-01', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-01', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-01', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-01', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-02 ──────────────────────────────────────────────────────────────
-- w71 prefers day off
(71, 5, '2026-05-02', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-02', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-02', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w72 prefers Morning
(72, 5, '2026-05-02', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w73 prefers day off
(73, 5, '2026-05-02', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-02', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-02', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-02', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-02', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-02', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-03 ──────────────────────────────────────────────────────────────
-- w176 prefers day off
(176, 5, '2026-05-03', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-03', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-03', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w71 prefers Evening
(71, 5, '2026-05-03', 'EVENING', 'PREFERRED', 'NURSE', 'Shift preference: Evening', '{}'),
-- w72 prefers day off
(72, 5, '2026-05-03', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-03', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-03', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w73 prefers day off
(73, 5, '2026-05-03', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-03', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-03', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w75 prefers Night
(75, 5, '2026-05-03', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-03', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-03', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-03', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-04 ──────────────────────────────────────────────────────────────
-- w176 prefers day off
(176, 5, '2026-05-04', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-04', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-04', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w72 prefers day off
(72, 5, '2026-05-04', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-04', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-04', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w73 prefers day off
(73, 5, '2026-05-04', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-04', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-04', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w75 prefers day off
(75, 5, '2026-05-04', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-04', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-04', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-04', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-04', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-04', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-05 ──────────────────────────────────────────────────────────────
-- w176 prefers Morning
(176, 5, '2026-05-05', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w72 prefers day off
(72, 5, '2026-05-05', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-05', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-05', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w73 prefers Evening
(73, 5, '2026-05-05', 'EVENING', 'PREFERRED', 'NURSE', 'Shift preference: Evening', '{}'),
-- w75 prefers Morning
(75, 5, '2026-05-05', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),

-- ── 2026-05-06 ──────────────────────────────────────────────────────────────
-- w72 prefers Evening
(72, 5, '2026-05-06', 'EVENING', 'PREFERRED', 'NURSE', 'Shift preference: Evening', '{}'),
-- w75 prefers day off
(75, 5, '2026-05-06', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-06', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-06', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-08 ──────────────────────────────────────────────────────────────
-- w176 prefers day off
(176, 5, '2026-05-08', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-08', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-08', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w70 prefers Morning
(70, 5, '2026-05-08', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w73 prefers Night
(73, 5, '2026-05-08', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w75 prefers Morning
(75, 5, '2026-05-08', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),

-- ── 2026-05-09 ──────────────────────────────────────────────────────────────
-- w176 prefers day off
(176, 5, '2026-05-09', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-09', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-09', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w70 prefers day off
(70, 5, '2026-05-09', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(70, 5, '2026-05-09', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(70, 5, '2026-05-09', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w73 prefers day off
(73, 5, '2026-05-09', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-09', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-09', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w75 prefers day off
(75, 5, '2026-05-09', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-09', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-09', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-09', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-09', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-09', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-10 ──────────────────────────────────────────────────────────────
-- w176 prefers day off
(176, 5, '2026-05-10', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-10', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-10', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w70 prefers day off
(70, 5, '2026-05-10', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(70, 5, '2026-05-10', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(70, 5, '2026-05-10', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w73 prefers day off
(73, 5, '2026-05-10', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-10', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-10', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w75 prefers day off
(75, 5, '2026-05-10', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-10', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-10', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-10', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-10', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-10', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-11 ──────────────────────────────────────────────────────────────
-- w176 prefers Morning
(176, 5, '2026-05-11', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w70 prefers day off
(70, 5, '2026-05-11', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(70, 5, '2026-05-11', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(70, 5, '2026-05-11', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w72 prefers Morning
(72, 5, '2026-05-11', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w73 prefers Evening
(73, 5, '2026-05-11', 'EVENING', 'PREFERRED', 'NURSE', 'Shift preference: Evening', '{}'),
-- w75 prefers Evening
(75, 5, '2026-05-11', 'EVENING', 'PREFERRED', 'NURSE', 'Shift preference: Evening', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-11', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-11', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-11', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-12 ──────────────────────────────────────────────────────────────
-- w70 prefers Morning
(70, 5, '2026-05-12', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w72 prefers day off
(72, 5, '2026-05-12', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-12', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-12', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w75 prefers Night
(75, 5, '2026-05-12', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),

-- ── 2026-05-13 ──────────────────────────────────────────────────────────────
-- w70 prefers Morning + Evening
(70, 5, '2026-05-13', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
(70, 5, '2026-05-13', 'EVENING', 'PREFERRED', 'NURSE', 'Shift preference: Evening', '{}'),
-- w72 prefers Morning
(72, 5, '2026-05-13', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w75 prefers Night
(75, 5, '2026-05-13', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),

-- ── 2026-05-15 ──────────────────────────────────────────────────────────────
-- w73 prefers Night
(73, 5, '2026-05-15', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w75 prefers Morning
(75, 5, '2026-05-15', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),

-- ── 2026-05-16 ──────────────────────────────────────────────────────────────
-- w176 prefers Night
(176, 5, '2026-05-16', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w71 prefers day off
(71, 5, '2026-05-16', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-16', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-16', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w73 prefers day off
(73, 5, '2026-05-16', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-16', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-16', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w75 prefers day off
(75, 5, '2026-05-16', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-16', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-16', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-16', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-16', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-16', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-17 ──────────────────────────────────────────────────────────────
-- w176 prefers day off
(176, 5, '2026-05-17', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-17', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-17', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w71 prefers day off
(71, 5, '2026-05-17', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-17', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-17', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w73 prefers day off
(73, 5, '2026-05-17', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-17', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-17', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w75 prefers day off
(75, 5, '2026-05-17', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-17', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(75, 5, '2026-05-17', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-17', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-17', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-17', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-18 ──────────────────────────────────────────────────────────────
-- w176 prefers Morning
(176, 5, '2026-05-18', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w71 prefers Morning + Evening
(71, 5, '2026-05-18', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
(71, 5, '2026-05-18', 'EVENING', 'PREFERRED', 'NURSE', 'Shift preference: Evening', '{}'),
-- w73 prefers Evening
(73, 5, '2026-05-18', 'EVENING', 'PREFERRED', 'NURSE', 'Shift preference: Evening', '{}'),
-- w75 prefers Evening
(75, 5, '2026-05-18', 'EVENING', 'PREFERRED', 'NURSE', 'Shift preference: Evening', '{}'),

-- ── 2026-05-23 ──────────────────────────────────────────────────────────────
-- w176 prefers Night
(176, 5, '2026-05-23', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w71 prefers day off
(71, 5, '2026-05-23', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-23', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-23', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w72 prefers Morning
(72, 5, '2026-05-23', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-23', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-23', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-23', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-24 ──────────────────────────────────────────────────────────────
-- w176 prefers day off
(176, 5, '2026-05-24', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-24', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-24', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w71 prefers Morning
(71, 5, '2026-05-24', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w72 prefers day off
(72, 5, '2026-05-24', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-24', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-24', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w74 prefers Night
(74, 5, '2026-05-24', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-24', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-24', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-24', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-25 ──────────────────────────────────────────────────────────────
-- w74 prefers day off
(74, 5, '2026-05-25', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(74, 5, '2026-05-25', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(74, 5, '2026-05-25', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w75 prefers Morning
(75, 5, '2026-05-25', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),

-- ── 2026-05-26 ──────────────────────────────────────────────────────────────
-- w71 prefers Morning
(71, 5, '2026-05-26', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w74 prefers day off
(74, 5, '2026-05-26', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(74, 5, '2026-05-26', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(74, 5, '2026-05-26', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w75 prefers Evening
(75, 5, '2026-05-26', 'EVENING', 'PREFERRED', 'NURSE', 'Shift preference: Evening', '{}'),

-- ── 2026-05-27 ──────────────────────────────────────────────────────────────
-- w71 prefers day off
(71, 5, '2026-05-27', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-27', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-27', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w72 prefers day off
(72, 5, '2026-05-27', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-27', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-27', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w74 prefers Evening
(74, 5, '2026-05-27', 'EVENING', 'PREFERRED', 'NURSE', 'Shift preference: Evening', '{}'),
-- w75 prefers Morning
(75, 5, '2026-05-27', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),

-- ── 2026-05-28 ──────────────────────────────────────────────────────────────
-- w71 prefers day off
(71, 5, '2026-05-28', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-28', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-28', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w72 prefers day off
(72, 5, '2026-05-28', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-28', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-28', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w74 prefers Night
(74, 5, '2026-05-28', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),

-- ── 2026-05-29 ──────────────────────────────────────────────────────────────
-- w71 prefers day off
(71, 5, '2026-05-29', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-29', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-29', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w72 prefers day off
(72, 5, '2026-05-29', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-29', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(72, 5, '2026-05-29', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w73 prefers Night
(73, 5, '2026-05-29', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w74 prefers day off
(74, 5, '2026-05-29', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(74, 5, '2026-05-29', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(74, 5, '2026-05-29', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-30 ──────────────────────────────────────────────────────────────
-- w176 prefers Night
(176, 5, '2026-05-30', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w71 prefers day off
(71, 5, '2026-05-30', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-30', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-30', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w72 prefers Morning
(72, 5, '2026-05-30', 'MORNING', 'PREFERRED', 'NURSE', 'Shift preference: Morning', '{}'),
-- w73 prefers day off
(73, 5, '2026-05-30', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-30', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-30', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w74 prefers day off
(74, 5, '2026-05-30', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(74, 5, '2026-05-30', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(74, 5, '2026-05-30', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-30', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-30', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-30', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),

-- ── 2026-05-31 ──────────────────────────────────────────────────────────────
-- w176 prefers day off
(176, 5, '2026-05-31', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-31', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(176, 5, '2026-05-31', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w71 prefers day off
(71, 5, '2026-05-31', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-31', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(71, 5, '2026-05-31', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w73 prefers day off
(73, 5, '2026-05-31', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-31', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(73, 5, '2026-05-31', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
-- w74 prefers Night
(74, 5, '2026-05-31', 'NIGHT',   'PREFERRED', 'NURSE', 'Shift preference: Night', '{}'),
-- w76 prefers day off
(76, 5, '2026-05-31', 'MORNING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-31', 'EVENING', 'AVOID', 'NURSE', 'Shift preference: day off', '{}'),
(76, 5, '2026-05-31', 'NIGHT',   'AVOID', 'NURSE', 'Shift preference: day off', '{}')

ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET
  type   = EXCLUDED.type,
  source = EXCLUDED.source,
  reason = EXCLUDED.reason;
