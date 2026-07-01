"""
Populate Database Script
=========================

Generates a rich history of 8 attendance sessions (Morning/Evening over 4 days)
for the 8 students in the new master roster, writes them to attendance_log.csv,
and exports the final aggregated JSON to frontend/output/attendance_data.json.

This connects the new seating plan backend pipeline to the frontend.
"""

from __future__ import annotations

import os
import random
import pandas as pd

from attendance_engine import (
    load_master_roster,
    append_to_log,
    generate_frontend_json,
    _default_log_path,
)
from config import DATA_DIR, MASTER_LIST_FILENAME

# Session slots (Morning/Evening) for 4 dates = 8 sessions
SESSIONS = [
    ("2026-07-01", "Morning"),
    ("2026-07-01", "Evening"),
    ("2026-07-02", "Morning"),
    ("2026-07-02", "Evening"),
    ("2026-07-03", "Morning"),
    ("2026-07-03", "Evening"),
    ("2026-07-04", "Morning"),
    ("2026-07-04", "Evening"),
]

def main():
    roster_path = os.path.join(DATA_DIR, MASTER_LIST_FILENAME)
    log_path = _default_log_path()
    
    # 1. Ensure master roster exists
    if not os.path.exists(roster_path):
        print(f"[ERROR] Master roster not found at {roster_path}. Run generate_sample_data.py first.")
        return
        
    roster = load_master_roster(roster_path)
    enrollment_numbers = list(roster.index)
    
    # 2. Reset log file to start fresh
    if os.path.exists(log_path):
        os.remove(log_path)
        print("[INFO] Cleared existing log file to generate a fresh 8-session history.")

    print(f"[INFO] Simulating attendance for {len(enrollment_numbers)} students across {len(SESSIONS)} sessions...")
    
    # 3. Simulate and append each session
    for s_date, s_slot in SESSIONS:
        rows = []
        for enroll_no in enrollment_numbers:
            # Random status: 80% Present, 12% Absent, 8% Leave
            rand = random.random()
            if rand < 0.80:
                status = "Present"
            elif rand < 0.92:
                status = "Absent"
            else:
                status = "Leave"
                
            rows.append({
                "enrollment_number": enroll_no,
                "status": status,
                "session_date": s_date,
                "session_slot": s_slot
            })
            
        batch_df = pd.DataFrame(rows)
        append_to_log(batch_df, log_path=log_path)
        
    print("[INFO] Successfully populated attendance_log.csv with 8 sessions.")
    
    # 4. Generate the dashboard JSON for the frontend
    generate_frontend_json(output_path=os.path.join("frontend", "output", "attendance_data.json"))
    print("[OK] Backend database populated and frontend/output/attendance_data.json updated!")

if __name__ == "__main__":
    main()
