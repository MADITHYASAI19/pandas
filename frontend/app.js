(() => {
  "use strict";

  const DATA_URL = "output/attendance_data.json";

  /** @type {{generated_at:string, sessions_meta:Array, students:Array} | null} */
  let dataset = null;
  let filtered = [];
  let sortKey = "name";
  let sortDir = "asc";

  // ---------- Elements ----------
  const els = {
    brandSub: document.getElementById("brandSub"),
    statTotal: document.getElementById("statTotal"),
    statSessions: document.getElementById("statSessions"),
    statAvg: document.getElementById("statAvg"),
    statLow: document.getElementById("statLow"),

    searchInput: document.getElementById("searchInput"),
    deptFilter: document.getElementById("deptFilter"),
    divFilter: document.getElementById("divFilter"),
    statusFilter: document.getElementById("statusFilter"),
    resetFilters: document.getElementById("resetFilters"),
    copyList: document.getElementById("copyList"),
    copyRolls: document.getElementById("copyRolls"),
    rosterInput: document.getElementById("rosterInput"),
    rosterFileStatus: document.getElementById("rosterFileStatus"),
    seatingInput: document.getElementById("seatingInput"),
    seatingFileStatus: document.getElementById("seatingFileStatus"),

    rosterBody: document.getElementById("rosterBody"),
    resultCount: document.getElementById("resultCount"),
    sortLabel: document.getElementById("sortLabel"),
    emptyState: document.getElementById("emptyState"),

    detailPanel: document.getElementById("detailPanel"),
    detailOverlay: document.getElementById("detailOverlay"),
    closeDetail: document.getElementById("closeDetail"),
    detailName: document.getElementById("detailName"),
    detailMeta: document.getElementById("detailMeta"),
    detailRing: document.getElementById("detailRing"),
    detailPctValue: document.getElementById("detailPctValue"),
    detailPresentOf: document.getElementById("detailPresentOf"),
    
    // Status Count Chips in Detail Panel
    detailPresentCount: document.getElementById("detailPresentCount"),
    detailAbsentCount: document.getElementById("detailAbsentCount"),
    detailLeaveCount: document.getElementById("detailLeaveCount"),
    
    detailSessionList: document.getElementById("detailSessionList"),

    themeToggle: document.getElementById("themeToggle"),
  };

  const SORT_LABELS = {
    name: "Name",
    enrollment_no: "Enrollment No.",
    department: "Department",
    division: "Division",
    present_count: "Present Count",
    attendance_pct: "Attendance %",
  };

  // ============================================================
  // Theme Management
  // ============================================================

  function initTheme() {
    const stored = localStorage.getItem("attendance-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored || (prefersDark ? "dark" : "light");
    applyTheme(theme);

    els.themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("attendance-theme", theme);
    els.themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
    els.themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
  }

  // ============================================================
  // Data Loading & Setup
  // ============================================================

  async function loadData() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      dataset = await res.json();
    } catch (err) {
      els.brandSub.textContent = "Failed to load attendance_data.json";
      els.rosterBody.innerHTML = "";
      els.emptyState.hidden = false;
      els.emptyState.textContent =
        "Could not load output/attendance_data.json. Please ensure the file exists and is well-formed JSON.";
      console.error("Failed to load attendance data:", err);
      return;
    }

    if (!dataset || !Array.isArray(dataset.students)) {
      els.brandSub.textContent = "Invalid data format";
      els.emptyState.hidden = false;
      els.emptyState.textContent = "Invalid format: 'students' array is missing or empty.";
      return;
    }

    populateFilterOptions();
    renderStats();
    applyFiltersAndSort();

    const studentCount = dataset.students.length;
    const generated = dataset.generated_at
      ? new Date(dataset.generated_at).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;
    els.brandSub.textContent = generated
      ? `${studentCount} students \u00b7 updated ${generated}`
      : `${studentCount} students`;
  }

  function populateFilterOptions() {
    const depts = [...new Set(dataset.students.map((s) => s.department))].filter(Boolean).sort();
    const divs = [...new Set(dataset.students.map((s) => s.division))].filter(Boolean).sort();

    // Clear previous dynamic options if any
    els.deptFilter.innerHTML = '<option value="">All departments</option>';
    els.divFilter.innerHTML = '<option value="">All divisions</option>';

    for (const d of depts) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      els.deptFilter.appendChild(opt);
    }
    for (const d of divs) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = `Division ${d}`;
      els.divFilter.appendChild(opt);
    }
  }

  // ============================================================
  // Stats Panel Rendering
  // ============================================================

  function renderStats() {
    const students = dataset.students;
    const total = students.length;
    const sessionCount = dataset.sessions_meta ? dataset.sessions_meta.length : 0;
    const avg =
      total > 0
        ? students.reduce((sum, s) => sum + s.attendance_pct, 0) / total
        : 0;
    const lowCount = students.filter((s) => s.attendance_pct < 75).length;

    els.statTotal.textContent = total;
    els.statSessions.textContent = sessionCount;
    els.statAvg.textContent = `${avg.toFixed(1)}%`;
    els.statLow.textContent = lowCount;
  }

  // ============================================================
  // Filtering & Sorting
  // ============================================================

  function applyFiltersAndSort() {
    if (!dataset) return;
    
    const q = els.searchInput.value.trim().toLowerCase();
    const dept = els.deptFilter.value;
    const div = els.divFilter.value;
    const statusBand = els.statusFilter.value;

    filtered = dataset.students.filter((s) => {
      if (dept && s.department !== dept) return false;
      if (div && s.division !== div) return false;
      if (statusBand === "low" && !(s.attendance_pct < 75)) return false;
      if (statusBand === "mid" && !(s.attendance_pct >= 75 && s.attendance_pct < 90)) return false;
      if (statusBand === "high" && !(s.attendance_pct >= 90)) return false;
      if (q) {
        const haystack = `${s.name} ${s.enrollment_no}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    renderTable();
  }

  function pctBand(pct) {
    if (pct < 75) return "bad";
    if (pct < 90) return "warn";
    return "good";
  }

  function renderTable() {
    els.rosterBody.innerHTML = "";

    els.resultCount.textContent = `${filtered.length} of ${dataset.students.length} students`;
    els.sortLabel.textContent = `${SORT_LABELS[sortKey]} (${sortDir === "asc" ? "A\u2013Z" : "Z\u2013A"})`;

    document.querySelectorAll(".th-sort").forEach((btn) => {
      if (btn.dataset.sort === sortKey) {
        btn.setAttribute("data-active", sortDir);
      } else {
        btn.removeAttribute("data-active");
      }
    });

    if (filtered.length === 0) {
      els.copyList.disabled = true;
      els.copyRolls.disabled = true;
      els.emptyState.hidden = false;
      els.emptyState.textContent = "No students match the current filters.";
      return;
    }
    els.copyList.disabled = false;
    els.copyRolls.disabled = false;
    els.emptyState.hidden = true;

    const frag = document.createDocumentFragment();

    for (const s of filtered) {
      const tr = document.createElement("tr");
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-label", `View attendance detail for ${s.name}`);

      const band = pctBand(s.attendance_pct);

      if (!s.roll_number) {
        console.warn(`Data bug: roll_number is missing for student ${s.enrollment_no} (${s.name})`);
      }
      const rollNo = s.roll_number || "N/A";

      tr.innerHTML = `
        <td class="cell-mono">${escapeHtml(rollNo)}</td>
        <td class="cell-name">${escapeHtml(s.name)}</td>
        <td class="cell-mono">${escapeHtml(s.enrollment_no)}</td>
        <td><span class="dept-pill">${escapeHtml(s.department)}</span></td>
        <td><span class="div-pill">${escapeHtml(s.division)}</span></td>
        <td class="present-frac">${s.present_count}/${s.total_sessions}</td>
        <td>
          <div class="pct-cell">
            <div class="pct-bar-track">
              <div class="pct-bar-fill ${band}" style="width:${s.attendance_pct}%"></div>
            </div>
            <span class="pct-value ${band}">${s.attendance_pct.toFixed(1)}%</span>
          </div>
        </td>
      `;

      tr.addEventListener("click", () => openDetail(s));
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail(s);
        }
      });

      frag.appendChild(tr);
    }

    els.rosterBody.appendChild(frag);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ============================================================
  // Detail Slide-out Panel Logic
  // ============================================================

  function openDetail(student) {
    els.detailName.textContent = student.name;
    els.detailMeta.textContent = `${student.department} \u00b7 Division ${student.division} \u00b7 ${student.enrollment_no}`;

    const band = pctBand(student.attendance_pct);
    const colorVar = band === "good" ? "var(--good)" : band === "warn" ? "var(--warn)" : "var(--bad)";
    els.detailRing.style.setProperty("--ring-pct", student.attendance_pct);
    els.detailRing.style.setProperty("--ring-color", colorVar);
    els.detailPctValue.textContent = `${Math.round(student.attendance_pct)}%`;
    els.detailPctValue.style.color = colorVar;
    els.detailPresentOf.textContent = `${student.present_count} of ${student.total_sessions}`;

    // Count present, absent, leave status from student sessions
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    els.detailSessionList.innerHTML = "";
    const frag = document.createDocumentFragment();

    if (Array.isArray(student.sessions)) {
      for (const session of student.sessions) {
        const statusCleaned = (session.status || "").trim().toLowerCase();
        
        if (statusCleaned === "present" || statusCleaned === "p") {
          presentCount++;
        } else if (statusCleaned === "absent" || statusCleaned === "a") {
          absentCount++;
        } else if (statusCleaned === "leave" || statusCleaned === "l") {
          leaveCount++;
        }

        const li = document.createElement("li");
        li.className = "session-item";
        const dateStr = formatDate(session.date);
        
        li.innerHTML = `
          <div class="session-info">
            <span class="session-title" title="${escapeHtml(session.title)}">${escapeHtml(session.title)}</span>
            <span class="session-date">${dateStr}</span>
          </div>
          <span class="status-badge ${statusCleaned}">${escapeHtml(session.status)}</span>
        `;
        frag.appendChild(li);
      }
    }
    
    // Update status count labels in details view
    els.detailPresentCount.textContent = presentCount;
    els.detailAbsentCount.textContent = absentCount;
    els.detailLeaveCount.textContent = leaveCount;
    
    els.detailSessionList.appendChild(frag);

    els.detailPanel.classList.add("is-open");
    els.detailPanel.setAttribute("aria-hidden", "false");
    els.detailOverlay.hidden = false;
    
    // Smooth transition overlay trigger
    requestAnimationFrame(() => els.detailOverlay.classList.add("is-visible"));
    els.closeDetail.focus();
    document.body.style.overflow = "hidden";
  }

  function closeDetailPanel() {
    els.detailPanel.classList.remove("is-open");
    els.detailPanel.setAttribute("aria-hidden", "true");
    els.detailOverlay.classList.remove("is-visible");
    document.body.style.overflow = "";
    
    setTimeout(() => {
      if (!els.detailPanel.classList.contains("is-open")) {
        els.detailOverlay.hidden = true;
      }
    }, 220);
  }

  // ============================================================
  // Clipboard Copy Operations (Part 3b)
  // ============================================================

  function copyToClipboard(text, btn) {
    const originalText = btn.textContent;

    function showConfirmation() {
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove("copied");
      }, 1500);
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showConfirmation();
        })
        .catch(err => {
          console.warn("Clipboard API failed, trying fallback:", err);
          fallbackCopyToClipboard(text);
          showConfirmation();
        });
    } else {
      fallbackCopyToClipboard(text);
      showConfirmation();
    }
  }

  function fallbackCopyToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
    } catch (err) {
      console.error("Fallback copy failed:", err);
    }

    document.body.removeChild(textArea);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  // ============================================================
  // Event Listeners & Wiring
  // ============================================================

  function initEvents() {
    els.searchInput.addEventListener("input", debounce(applyFiltersAndSort, 120));
    els.deptFilter.addEventListener("change", applyFiltersAndSort);
    els.divFilter.addEventListener("change", applyFiltersAndSort);
    els.statusFilter.addEventListener("change", applyFiltersAndSort);

    els.resetFilters.addEventListener("click", () => {
      els.searchInput.value = "";
      els.deptFilter.value = "";
      els.divFilter.value = "";
      els.statusFilter.value = "";
      applyFiltersAndSort();
    });

    els.copyList.addEventListener("click", () => {
      if (filtered.length === 0) return;

      const dept = els.deptFilter.value || "All";
      const div = els.divFilter.value || "All";
      const statusFilterText = els.statusFilter.options[els.statusFilter.selectedIndex].text;
      const searchVal = els.searchInput.value.trim();

      let header = `Department: ${dept} | Division: ${div} | Attendance: ${statusFilterText}`;
      if (searchVal) {
        header += ` | Search: "${searchVal}"`;
      }
      header += ` | ${filtered.length} students\n`;

      const lines = filtered.map(s => {
        if (!s.roll_number) {
          console.warn(`Data bug: roll_number is missing for student ${s.enrollment_no} (${s.name})`);
        }
        const rollNo = s.roll_number || "N/A";
        const statusText = `${s.attendance_pct.toFixed(1)}% (${s.present_count}/${s.total_sessions})`;
        return `Roll No. ${rollNo} | ${s.name} | Enrollment: ${s.enrollment_no} | Division: ${s.division} | Status: ${statusText}`;
      });

      const textBlock = header + lines.join("\n");
      copyToClipboard(textBlock, els.copyList);
    });

    els.copyRolls.addEventListener("click", () => {
      if (filtered.length === 0) return;

      const rolls = filtered.map(s => {
        if (!s.roll_number) {
          console.warn(`Data bug: roll_number is missing for student ${s.enrollment_no} (${s.name})`);
        }
        return s.roll_number || "N/A";
      });

      const textBlock = rolls.join(",");
      copyToClipboard(textBlock, els.copyRolls);
    });

    document.querySelectorAll(".th-sort").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        if (sortKey === key) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortKey = key;
          sortDir = "asc";
        }
        applyFiltersAndSort();
      });
    });

    els.closeDetail.addEventListener("click", closeDetailPanel);
    els.detailOverlay.addEventListener("click", closeDetailPanel);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.detailPanel.classList.contains("is-open")) {
        closeDetailPanel();
      }
    });

    // File inputs visual feedback (Upload Center)
    els.rosterInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        els.rosterFileStatus.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        console.log(`[Ingestion] Selected master roster file: ${file.name}`);
      } else {
        els.rosterFileStatus.textContent = "No file selected";
      }
    });

    els.seatingInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        els.seatingFileStatus.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        console.log(`[Ingestion] Selected seating plan file: ${file.name}`);
      } else {
        els.seatingFileStatus.textContent = "No file selected";
      }
    });
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // ============================================================
  // Initialization
  // ============================================================

  initTheme();
  initEvents();
  loadData();
})();
