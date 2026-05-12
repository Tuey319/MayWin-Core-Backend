"""
fix-ipd-separate-workers.py
----------------------------
Fixes the mistake in seed-ipd-test-unit.py which reused/modified existing
workers (70,71,73,74,75,176) instead of creating fresh ones for IPD-TEST.

Actions:
  REVERT:
    - workers 70,71,73,74,75: restore primary_unit_id=5, linked_user_id=NULL
    - worker 176: restore organization_id=NULL, primary_unit_id=NULL, linked_user_id=NULL
    - remove worker_unit_memberships for those workers in unit 18

  CREATE:
    - 7 new worker rows in org=4, primary_unit=18 (IPD-TEST)
    - 1 new user account for nurse 4 (ratanawali) — others already exist as users 37-42
    - 7 new worker_unit_memberships (new workers -> unit 18)
    - link new workers -> existing users 37-42 + new user

Run:
    python scripts/fix-ipd-separate-workers.py
"""

import bcrypt
import psycopg2
import psycopg2.extras

SCHEMA = "maywin_db"
DB = dict(
    host="maywin-restored.cf4o8yiqanwf.ap-southeast-1.rds.amazonaws.com",
    port=5432, user="postgres", password="maywin12345",
    dbname="maywin", sslmode="require",
)

KMCH_ORG_ID = 4
IPD_UNIT_ID = 18
DEFAULT_PASSWORD = "MayWin2025!"

# IPD-TEST nurses — (full_name, worker_code, existing_user_id or None)
# User IDs 37-42 were already created in the wrong run and are kept.
# Nurse order matches the March 2026 schedule the user typed.
IPD_NURSES = [
    ("นางสาวภวัตสรรค์ นิลจันทร์",   "IPD001", 37),   # was NURSE_009
    ("นางสาวศิรินรัตน์ จิตรหวล",    "IPD002", 38),   # was NURSE_002
    ("นางสาวสุลักษณา เยนา",          "IPD003", 39),   # was NURSE_003
    ("นางสาวรัตนาวลี สัตยวิวัฒน์",  "IPD004", None), # 7th nurse — no account yet
    ("นางสาวธนัชพร ด่านตระกูล",     "IPD005", 40),   # was NURSE_005
    ("นางสาวพรลภัส รุ่งเรือง",      "IPD006", 41),   # was NURSE_006
    ("นางสาวปรัชญาภร ศรีจันทร์",    "IPD007", 42),   # was NURSE_007
]

# Old workers that were incorrectly modified — revert them
REVERT_WORKERS = [
    (70, 5,    None),  # (worker_id, original_primary_unit_id, original_org_id)
    (71, 5,    None),
    (73, 5,    None),
    (74, 5,    None),
    (75, 5,    None),
    (176, None, None), # 176 was orphaned (org NULL, unit NULL) — restore
]


def main():
    pw_hash = bcrypt.hashpw(DEFAULT_PASSWORD.encode(), bcrypt.gensalt(10)).decode()
    conn = psycopg2.connect(**DB)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # ── 1. Revert old workers ────────────────────────────────────────────
        print("[REVERT] Restoring original workers...")
        for (wid, orig_unit, orig_org) in REVERT_WORKERS:
            cur.execute(f"""
                UPDATE {SCHEMA}.workers
                SET primary_unit_id = %s,
                    organization_id = COALESCE(%s, organization_id),
                    linked_user_id  = NULL,
                    updated_at      = NOW()
                WHERE id = %s
            """, (orig_unit, orig_org, wid))
            # Remove from IPD unit membership
            cur.execute(f"""
                DELETE FROM {SCHEMA}.worker_unit_memberships
                WHERE worker_id = %s AND unit_id = %s
            """, (str(wid), str(IPD_UNIT_ID)))
            print(f"  Reverted worker {wid} -> primary_unit={orig_unit}, linked_user=NULL")

        # Fix worker 176 org_id back to NULL (it was NULL originally)
        cur.execute(f"""
            UPDATE {SCHEMA}.workers
            SET organization_id = NULL, updated_at = NOW()
            WHERE id = 176
        """)
        print("  Worker 176 org_id -> NULL (original orphaned state)")

        # ── 2. Create missing user for รัตนาวลี (IPD004) ────────────────────
        print("\n[USER] Creating account for IPD004 (ratanawali)...")
        rat_email = "ipd004@kmch.local"
        cur.execute(f"""
            INSERT INTO {SCHEMA}.users
                (email, password_hash, full_name, organization_id, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, true, NOW(), NOW())
            ON CONFLICT (email) DO NOTHING
            RETURNING id
        """, (rat_email, pw_hash, "นางสาวรัตนาวลี สัตยวิวัฒน์", str(KMCH_ORG_ID)))
        row = cur.fetchone()
        if row:
            rat_user_id = row["id"]
            print(f"  Created user id={rat_user_id} email={rat_email}")
        else:
            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email=%s", (rat_email,))
            rat_user_id = cur.fetchone()["id"]
            print(f"  User exists id={rat_user_id} email={rat_email}")

        # Fill in the None user_id for IPD004
        IPD_NURSES_RESOLVED = [
            (name, code, rat_user_id if uid is None else uid)
            for name, code, uid in IPD_NURSES
        ]

        # unit_membership for IPD004 user -> IPD unit
        cur.execute(f"""
            INSERT INTO {SCHEMA}.unit_memberships
                (unit_id, user_id, role_code, created_at, updated_at)
            VALUES (%s, %s, 'NURSE', NOW(), NOW())
            ON CONFLICT (unit_id, user_id) DO NOTHING
        """, (str(IPD_UNIT_ID), str(rat_user_id)))

        # ── 3. Create 7 fresh worker records ────────────────────────────────
        print("\n[WORKERS] Creating 7 new IPD workers...")
        results = []
        for (full_name, code, user_id) in IPD_NURSES_RESOLVED:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.workers
                    (organization_id, primary_unit_id, full_name, worker_code,
                     employment_type, is_active, linked_user_id, created_at, updated_at)
                VALUES (%s, %s, %s, %s, 'FULL_TIME', true, %s, NOW(), NOW())
                ON CONFLICT (organization_id, worker_code) DO UPDATE
                    SET full_name = EXCLUDED.full_name,
                        linked_user_id = EXCLUDED.linked_user_id,
                        updated_at = NOW()
                RETURNING id
            """, (str(KMCH_ORG_ID), str(IPD_UNIT_ID), full_name, code, str(user_id)))
            new_wid = cur.fetchone()["id"]

            # worker_unit_memberships
            cur.execute(f"""
                INSERT INTO {SCHEMA}.worker_unit_memberships
                    (worker_id, unit_id, role_code)
                VALUES (%s, %s, 'NURSE')
                ON CONFLICT (worker_id, unit_id) DO NOTHING
            """, (str(new_wid), str(IPD_UNIT_ID)))

            results.append((code, full_name, new_wid, user_id))
            print(f"  {code}  worker_id={new_wid}  user_id={user_id}")

        conn.commit()

        # ── 4. Summary ───────────────────────────────────────────────────────
        print("\n" + "-" * 65)
        print(f"{'Code':<8} {'WorkerID':<10} {'UserID':<8} Email")
        print("-" * 65)
        email_map = {
            37: "nurse_009@kmch.local",
            38: "nurse_002@kmch.local",
            39: "nurse_003@kmch.local",
            rat_user_id: rat_email,
            40: "nurse_005@kmch.local",
            41: "nurse_006@kmch.local",
            42: "nurse_007@kmch.local",
        }
        for code, name, wid, uid in results:
            print(f"{code:<8} {str(wid):<10} {str(uid):<8} {email_map.get(uid,'?')}")
        print("-" * 65)
        print(f"\nUnit:     IPD test (id={IPD_UNIT_ID})")
        print(f"Password: {DEFAULT_PASSWORD}")
        print("Old workers 70,71,73,74,75,176 are untouched in Pawatsan dept.\n")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Rolled back. {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
