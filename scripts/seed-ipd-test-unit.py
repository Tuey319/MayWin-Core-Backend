"""
seed-ipd-test-unit.py
---------------------
Creates "IPD test" unit in KMCH, then creates web-login accounts for
the 6 nurses from the March 2026 hand-extracted schedule.

Nurses: workers 70, 71, 73, 74, 75, 176  (March data)

Actions per nurse:
  1. Ensure worker.organization_id = 4 (KMCH) — fixes worker 176 which is NULL
  2. INSERT users row  (email = <worker_code_lower>@kmch.local)
  3. INSERT unit_memberships  (role NURSE, new IPD-TEST unit)
  4. INSERT worker_unit_memberships  (new IPD-TEST unit)
  5. UPDATE workers.linked_user_id  and  workers.primary_unit_id

Run:
    pip install psycopg2-binary bcrypt
    python scripts/seed-ipd-test-unit.py
"""

import bcrypt
import psycopg2
import psycopg2.extras

SCHEMA = "maywin_db"

DB = dict(
    host="maywin-restored.cf4o8yiqanwf.ap-southeast-1.rds.amazonaws.com",
    port=5432,
    user="postgres",
    password="maywin12345",
    dbname="maywin",
    sslmode="require",
)

KMCH_ORG_ID = 4
KMCH_SITE_ID = 6          # Lat Krabang (KMITL)
DEFAULT_PASSWORD = "MayWin2025!"

IPD_UNIT = {
    "name": "IPD test",
    "code": "IPD-TEST",
}

# March 2026 nurses — (worker_id, worker_code, full_name)
MARCH_NURSES = [
    (176, "NURSE_009", "นางสาวภวัตสรรค์ นิลจันทร์"),
    (70,  "NURSE_002", "นางสาวศิรินรัตน์ จิตรหวล"),
    (71,  "NURSE_003", "นางสาวสุลักษณา เยนา"),
    (73,  "NURSE_005", "นางสาวธนัชพร ด่านตระกูล"),
    (74,  "NURSE_006", "นางสาวพรลภัส รุ่งเรือง"),
    (75,  "NURSE_007", "นางสาวปรัชญาภร ศรีจันทร์"),
]


def main():
    pw_hash = bcrypt.hashpw(DEFAULT_PASSWORD.encode(), bcrypt.gensalt(10)).decode()

    conn = psycopg2.connect(**DB)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # ── 1. Create IPD-TEST unit ──────────────────────────────────────────
        cur.execute(f"""
            INSERT INTO {SCHEMA}.units
                (organization_id, site_id, name, code, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, true, NOW(), NOW())
            ON CONFLICT (organization_id, code) DO UPDATE
                SET name = EXCLUDED.name, updated_at = NOW()
            RETURNING id, name, code
        """, (KMCH_ORG_ID, KMCH_SITE_ID, IPD_UNIT["name"], IPD_UNIT["code"]))
        unit = cur.fetchone()
        unit_id = unit["id"]
        print(f"[UNIT] '{unit['name']}' (code={unit['code']}, id={unit_id})")

        # ── 2. Process each nurse ────────────────────────────────────────────
        results = []
        for (worker_id, worker_code, full_name) in MARCH_NURSES:
            email = f"{worker_code.lower()}@kmch.local"
            print(f"\n  Processing {full_name}  [{worker_code}]")

            # Fix organization_id if null (worker 176)
            cur.execute(f"""
                UPDATE {SCHEMA}.workers
                SET organization_id = %s,
                    primary_unit_id = %s,
                    updated_at = NOW()
                WHERE id = %s
                  AND (organization_id IS NULL OR organization_id != %s
                       OR primary_unit_id IS NULL OR primary_unit_id != %s)
            """, (KMCH_ORG_ID, unit_id, worker_id, KMCH_ORG_ID, unit_id))

            # Insert user
            cur.execute(f"""
                INSERT INTO {SCHEMA}.users
                    (email, password_hash, full_name, organization_id, is_active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, true, NOW(), NOW())
                ON CONFLICT (email) DO NOTHING
                RETURNING id
            """, (email, pw_hash, full_name, str(KMCH_ORG_ID)))

            row = cur.fetchone()
            if row:
                user_id = row["id"]
                print(f"    [+] Created user  id={user_id}  email={email}")
            else:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
                user_id = cur.fetchone()["id"]
                print(f"    [=] User exists   id={user_id}  email={email}")

            # unit_memberships (user → IPD-TEST, role NURSE)
            cur.execute(f"""
                INSERT INTO {SCHEMA}.unit_memberships
                    (unit_id, user_id, role_code, created_at, updated_at)
                VALUES (%s, %s, 'NURSE', NOW(), NOW())
                ON CONFLICT (unit_id, user_id) DO NOTHING
            """, (str(unit_id), str(user_id)))

            # worker_unit_memberships (worker → IPD-TEST)
            cur.execute(f"""
                INSERT INTO {SCHEMA}.worker_unit_memberships
                    (worker_id, unit_id, role_code)
                VALUES (%s, %s, 'NURSE')
                ON CONFLICT (worker_id, unit_id) DO NOTHING
            """, (str(worker_id), str(unit_id)))

            # Link worker → user
            cur.execute(f"""
                UPDATE {SCHEMA}.workers
                SET linked_user_id = %s, updated_at = NOW()
                WHERE id = %s AND (linked_user_id IS NULL OR linked_user_id != %s)
            """, (str(user_id), worker_id, str(user_id)))

            results.append((full_name, worker_code, email, user_id))

        conn.commit()

        # ── 3. Summary ───────────────────────────────────────────────────────
        print("\n" + "-" * 72)
        print(f"{'Code':<12} {'Email':<36} UserID")
        print("-" * 72)
        for name, code, email, uid in results:
            print(f"{code:<12} {email:<36} {uid}")
        print("-" * 72)
        print(f"\nUnit:             IPD test (id={unit_id})")
        print(f"Default password: {DEFAULT_PASSWORD}")
        print("Distribute securely. Nurses should change on first login.\n")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Rolled back. {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
