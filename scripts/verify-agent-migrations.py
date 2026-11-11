#!/usr/bin/env python3
"""Apply the complete PhoneYa2 D1 migration history to a clean SQLite database."""
from pathlib import Path
import sqlite3
import sys

root = Path(__file__).resolve().parents[1]
migration_dir = root / "d1" / "migrations"
files = sorted(migration_dir.glob("*.sql"))
required = [f"{n:04d}" for n in range(25, 34)]
present = {p.name[:4] for p in files}
missing = [n for n in required if n not in present]
if missing:
    raise SystemExit("Missing Agent Network migrations: " + ", ".join(missing))

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
for path in files:
    try:
        db.executescript(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"FAIL applying {path.name}: {exc}") from exc
    print("PASS", path.name)

def columns(table):
    return {row[1] for row in db.execute(f"PRAGMA table_info({table})")}

checks = {
    "orders": {"agent_code", "agent_referral_code", "agent_attributed_at", "fulfilment_source", "fulfilment_agent_id", "fulfilment_status"},
    "agent_accounts": {"agent_id", "referral_code", "password_hash", "status"},
    "agent_product_codes": {"product_code", "price_minor", "stock"},
    "agent_sales": {"customer_location", "notes", "estimated_commission_minor"},
    "agent_payout_requests": {"payment_provider", "amount_minor"},
    "agent_payout_allocations": {"payout_id", "commission_id", "amount_minor"},
    "agent_wallet_adjustments": {"amount_minor", "status"},
    "agent_adjustment_recoveries": {"adjustment_id", "commission_id", "amount_minor"},
    "partner_onboarding_progress": {"advertiser_id", "completed_steps_json"},
    "admin_work_items": {"source_key", "image_url", "status"},
}
for table, expected in checks.items():
    actual = columns(table)
    absent = expected - actual
    if absent:
        raise SystemExit(f"FAIL {table} missing columns: {', '.join(sorted(absent))}")
    print(f"PASS schema {table}")

if db.execute("PRAGMA foreign_key_check").fetchall():
    raise SystemExit("FAIL foreign-key integrity check")
print(f"PASS complete migration chain ({len(files)} files) and foreign-key integrity")
