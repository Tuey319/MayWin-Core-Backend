-- Seed: May 2026 nurse-submitted shift requests
-- org_id=4, unit_id=5, source=NURSE
-- type=PREFERRED → solver treats these as hard "must assign" constraints
-- Run AFTER seed_may2026_availability.sql (manager constraints have priority)

DELETE FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND source = 'NURSE'
  AND date >= '2026-05-01'
  AND date <= '2026-05-31';

INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason, attributes)
VALUES
-- NURSE_002 (w70): requests MORNING on May 6
(70, 5, '2026-05-06', 'MORNING', 'PREFERRED', 'NURSE', 'Nurse shift request', '{}'),

-- NURSE_003 (w71): requests EVENING on May 13
(71, 5, '2026-05-13', 'EVENING', 'PREFERRED', 'NURSE', 'Nurse shift request', '{}'),

-- NURSE_004 (w72): requests NIGHT on May 20
(72, 5, '2026-05-20', 'NIGHT', 'PREFERRED', 'NURSE', 'Nurse shift request', '{}'),

-- NURSE_005 (w73): requests MORNING on May 7
(73, 5, '2026-05-07', 'MORNING', 'PREFERRED', 'NURSE', 'Nurse shift request', '{}'),

-- NURSE_007 (w75): requests EVENING on May 14
(75, 5, '2026-05-14', 'EVENING', 'PREFERRED', 'NURSE', 'Nurse shift request', '{}');
