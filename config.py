"""
Configuration for the Attendance Reconciliation Tool.

Holds settings shared across the master roster loading and the training
seating plan ingestion.
"""

# ═══════════════════════════════════════════════════════════════════════════
#  Part 1 — Rollcall Master Roster Column Mapping
# ═══════════════════════════════════════════════════════════════════════════
# Maps internal fields to the column headers in the multi-sheet rollcall Excel.
# Note: Division is extracted from the sheet name itself.
DEFAULT_COLUMN_MAPPING: dict[str, str] = {
    "enrollment_number": "Enrollment No",
    "name":              "Name",
    "roll_number":       "Roll No",
    "department":        "Department",
    "semester":          "Semester",
}

# ═══════════════════════════════════════════════════════════════════════════
#  Part 2 — Training Seating Plan Configuration
# ═══════════════════════════════════════════════════════════════════════════
# Expected header names for identifying columns in the seating plan.
SEATING_ENROLL_HEADER = "Enrollment No"
SEATING_BOUNDARY_HEADER = "Parul Mail ID"

# Maps seating plan slot values to canonical session slots.
# Slot 1 -> Morning, Slot 2 -> Evening.
SLOT_MAP: dict[str, str] = {
    "slot 1": "Morning",
    "slot 2": "Evening",
    "slot1":  "Morning",
    "slot2":  "Evening",
    "morning": "Morning",
    "evening": "Evening",
}

# Standard status mapping
STATUS_MAP: dict[str, str] = {
    "present":  "Present",
    "p":        "Present",
    "pr":       "Present",
    "absent":   "Absent",
    "a":        "Absent",
    "ab":       "Absent",
    "leave":    "Leave",
    "l":        "Leave",
}

# ═══════════════════════════════════════════════════════════════════════════
#  SharePoint & Path Settings
# ═══════════════════════════════════════════════════════════════════════════
SHAREPOINT_SHARE_LINK: str = ""
SHAREPOINT_TIMEOUT_SECONDS: int = 30

DATA_DIR = "data"
MASTER_LIST_FILENAME = "master_list.xlsx"
SEATING_PLAN_FILENAME = "training_seating_sample.xlsx"
ATTENDANCE_LOG_FILENAME = "attendance_log.csv"
