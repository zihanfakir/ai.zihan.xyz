
    const API_BASE = "http://localhost:5000/api";
    let token = localStorage.getItem("alokpoth_admin_token") || null;

    const loginOverlay = document.getElementById("loginOverlay");
    const adminLoginForm = document.getElementById("adminLoginForm");
    const loginError = document.getElementById("loginError");
    const logoutBtn = document.getElementById("logoutBtn");

    function checkAuth() {
      if (token) {
        loginOverlay.style.display = "none";
        loadAllData();
      } else {
        loginOverlay.style.display = "flex";
      }
    }
    checkAuth();

    adminLoginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginError.style.display = "none";
      const email = document.getElementById("adminEmail").value;
      const password = document.getElementById("adminPassword").value;

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success && data.user.role === "admin") {
          token = data.token;
          localStorage.setItem("alokpoth_admin_token", token);
          checkAuth();
        } else {
          loginError.textContent = data.error || "অ্যাডমিন এক্সেস অনুমতি নেই";
          loginError.style.display = "block";
        }
      } catch (err) {
        loginError.textContent = "সার্ভারে সংযোগ করা সম্ভব হয়নি";
        loginError.style.display = "block";
      }
    });

    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("alokpoth_admin_token");
      token = null;
      checkAuth();
    });

    // Tab Switching
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.target).classList.add("active");
      });
    });

    async function authFetch(url, options = {}) {
      const headers = options.headers || {};
      headers["Authorization"] = `Bearer ${token}`;
      headers["Content-Type"] = "application/json";
      return fetch(url, { ...options, headers });
    }

    async function loadAllData() {
      loadStats();
      loadUsers();
      loadPlans();
      loadRedeemCodes();
    }

    async function loadStats() {
      try {
        const res = await authFetch(`${API_BASE}/admin/stats`);
        const data = await res.json();
        if (data.success) {
          document.getElementById("statUsers").textContent = data.stats.totalUsers;
          document.getElementById("statPro").textContent = data.stats.proUsers;
          document.getElementById("statMax").textContent = data.stats.maxUsers;
          document.getElementById("statCodes").textContent = `${data.stats.usedRedeemCodes} / ${data.stats.totalRedeemCodes}`;
          document.getElementById("statMessages").textContent = data.stats.totalMessages;
        }
      } catch (e) {}
    }

    async function loadUsers() {
      try {
        const res = await authFetch(`${API_BASE}/admin/users`);
        const data = await res.json();
        const tbody = document.getElementById("userTableBody");
        if (!data.success || !data.users.length) {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">কোনো ইউজার পাওয়া যায়নি</td></tr>`;
          return;
        }
        tbody.innerHTML = "";
        data.users.forEach(u => {
          const plan = u.subscription.plan_name || "Free";
          const exp = u.subscription.expires_at ? new Date(u.subscription.expires_at).toLocaleDateString("bn-BD") : "সীমাহীন";
          const tagClass = plan === "Max" ? "tag-max" : (plan === "Pro" ? "tag-pro" : "tag-free");
          
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><strong>${u.name}</strong> ${u.role === 'admin' ? '<span class="badge">ADMIN</span>' : ''}</td>
            <td>${u.email}</td>
            <td><span class="tag ${tagClass}">${plan}</span></td>
            <td>${exp}</td>
            <td>${u.is_blocked ? '<span style="color:var(--danger)">ব্লকড</span>' : '<span style="color:var(--success)">সক্রিয়</span>'}</td>
            <td style="display: flex; gap: 8px;">
              <select onchange="changeUserPlan('${u._id}', this.value)" style="padding: 4px 8px; font-size: 0.8rem;">
                <option value="">প্ল্যান সেট করুন</option>
                <option value="Free">Free</option>
                <option value="Pro">Pro (30 Days)</option>
                <option value="Max">Max (30 Days)</option>
              </select>
              ${u.role !== 'admin' ? `
                <button type="button" class="btn ${u.is_blocked ? 'btn-success' : 'btn-danger'}" onclick="toggleBlock('${u._id}')">
                  ${u.is_blocked ? 'আনব্লক' : 'ব্লক'}
                </button>
              ` : ''}
            </td>
          `;
          tbody.appendChild(tr);
        });
      } catch (e) {}
    }

    async function changeUserPlan(userId, plan_name) {
      if (!plan_name) return;
      await authFetch(`${API_BASE}/admin/users/${userId}/plan`, {
        method: "PUT",
        body: JSON.stringify({ plan_name, duration_days: 30 })
      });
      loadUsers(); loadStats();
    }

    async function toggleBlock(userId) {
      await authFetch(`${API_BASE}/admin/users/${userId}/block`, { method: "PUT" });
      loadUsers();
    }

    async function loadPlans() {
      try {
        const res = await authFetch(`${API_BASE}/admin/plans`);
        const data = await res.json();
        const container = document.getElementById("planCardsContainer");
        if (!data.success) return;
        container.innerHTML = "";

        data.plans.forEach(p => {
          const card = document.createElement("div");
          card.className = "stat-card";
          card.innerHTML = `
            <h4 style="font-size: 1.2rem; color: var(--accent);">${p.displayName} (${p.name})</h4>
            <div class="form-group" style="margin-top: 10px;">
              <label>মেসেজ লিমিট (Message Limit)</label>
              <input type="number" id="limit_${p.name}" value="${p.message_limit}">
            </div>
            <div class="form-group">
              <label>সময়সীমা (Window Hours)</label>
              <input type="number" id="hours_${p.name}" value="${p.window_hours}">
            </div>
            <button type="button" class="btn btn-primary" onclick="savePlanLimits('${p.name}')" style="margin-top: 10px;">সংরক্ষণ করুন</button>
          `;
          container.appendChild(card);
        });
      } catch (e) {}
    }

    async function savePlanLimits(planName) {
      const message_limit = document.getElementById(`limit_${planName}`).value;
      const window_hours = document.getElementById(`hours_${planName}`).value;

      const res = await authFetch(`${API_BASE}/admin/plans/${planName}`, {
        method: "PUT",
        body: JSON.stringify({ message_limit, window_hours })
      });
      const data = await res.json();
      alert(data.message || "প্ল্যান আপডেট হয়েছে");
      loadPlans();
    }

    document.getElementById("generateCodeForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const plan_name = document.getElementById("codePlan").value;
      const duration_days = Number(document.getElementById("codeDuration").value);
      const count = Number(document.getElementById("codeCount").value);

      const res = await authFetch(`${API_BASE}/admin/redeem/generate`, {
        method: "POST",
        body: JSON.stringify({ plan_name, duration_days, count })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadRedeemCodes(); loadStats();
      }
    });

    async function loadRedeemCodes() {
      try {
        const res = await authFetch(`${API_BASE}/admin/redeem/list`);
        const data = await res.json();
        const tbody = document.getElementById("redeemTableBody");
        if (!data.success || !data.codes.length) {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">কোনো কোড নেই</td></tr>`;
          return;
        }
        tbody.innerHTML = "";
        data.codes.forEach(c => {
          const status = c.is_used ? `<span style="color:var(--danger)">ব্যবহৃত</span>` : `<span style="color:var(--success)">উপলব্ধ</span>`;
          const usedBy = c.used_by ? `${c.used_by.name} (${c.used_by.email})` : '—';
          
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><span class="code-chip">${c.code}</span></td>
            <td><strong>${c.plan_name}</strong></td>
            <td>${c.duration_days} দিন</td>
            <td>${status}</td>
            <td>${usedBy}</td>
            <td>
              <button type="button" class="btn btn-danger" onclick="deleteCode('${c._id}')">মুছুন</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      } catch (e) {}
    }

    async function deleteCode(codeId) {
      if (!confirm("আপনি কি নিশ্চিত এই কোডটি মুছে ফেলতে চান?")) return;
      await authFetch(`${API_BASE}/admin/redeem/${codeId}`, { method: "DELETE" });
      loadRedeemCodes(); loadStats();
    }
  