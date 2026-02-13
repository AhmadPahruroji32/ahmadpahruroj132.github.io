// ============================================================================
// MANAJEMEN KEUANGAN RAMADHAN - APPLICATION LOGIC
// ============================================================================

class RamadhanApp {
    constructor() {
        this.ramadhanDay = 1;
        this.deductionBuka = 3000;
        this.deductionSahur = 3000;
        this.members = [];
        this.schedules = [];
        this.history = [];
        
        this.init();
    }

    // Initialize app
    init() {
        this.loadData();
        this.setupEventListeners();
        this.updateDashboard();
        this.renderMembers();
        this.renderSchedules();
        this.renderHistory();
    }

    // ========================================================================
    // DATA MANAGEMENT
    // ========================================================================

    loadData() {
        const savedMembers = localStorage.getItem('ramadhan_members');
        const savedSchedules = localStorage.getItem('ramadhan_schedules');
        const savedHistory = localStorage.getItem('ramadhan_history');
        const savedDay = localStorage.getItem('ramadhan_day');

        this.members = savedMembers ? JSON.parse(savedMembers) : [];
        this.schedules = savedSchedules ? JSON.parse(savedSchedules) : [];
        this.history = savedHistory ? JSON.parse(savedHistory) : [];
        this.ramadhanDay = savedDay ? parseInt(savedDay) : 1;
    }

    saveData() {
        localStorage.setItem('ramadhan_members', JSON.stringify(this.members));
        localStorage.setItem('ramadhan_schedules', JSON.stringify(this.schedules));
        localStorage.setItem('ramadhan_history', JSON.stringify(this.history));
        localStorage.setItem('ramadhan_day', this.ramadhanDay.toString());
    }

    // ========================================================================
    // MEMBER MANAGEMENT
    // ========================================================================

    addMember(name, balance) {
        const member = {
            id: Date.now(),
            name: name,
            balance: parseInt(balance),
            createdAt: new Date().toISOString()
        };
        this.members.push(member);
        this.saveData();
        this.updateDashboard();
        return member;
    }

    updateMember(id, name, balance) {
        const member = this.members.find(m => m.id === id);
        if (member) {
            member.name = name;
            member.balance = parseInt(balance);
            this.saveData();
            this.updateDashboard();
            return member;
        }
        return null;
    }

    deleteMember(id) {
        this.members = this.members.filter(m => m.id !== id);
        this.saveData();
        this.updateDashboard();
    }

    getMember(id) {
        return this.members.find(m => m.id === id);
    }

    // ========================================================================
    // SCHEDULE MANAGEMENT
    // ========================================================================

    addSchedule(name, day, description, memberIds = []) {
        const schedule = {
            id: Date.now(),
            name: name,
            day: parseInt(day),
            description: description,
            memberIds: memberIds,
            createdAt: new Date().toISOString()
        };
        this.schedules.push(schedule);
        this.saveData();
        return schedule;
    }

    updateSchedule(id, name, day, description, memberIds = []) {
        const schedule = this.schedules.find(s => s.id === id);
        if (schedule) {
            schedule.name = name;
            schedule.day = parseInt(day);
            schedule.description = description;
            schedule.memberIds = memberIds;
            this.saveData();
            return schedule;
        }
        return null;
    }

    deleteSchedule(id) {
        this.schedules = this.schedules.filter(s => s.id !== id);
        this.saveData();
    }

    getSchedule(id) {
        return this.schedules.find(s => s.id === id);
    }

    // ========================================================================
    // DEDUCTION MANAGEMENT
    // ========================================================================

    deductMember(memberId, type) {
        const member = this.getMember(memberId);
        if (!member) return null;

        let amount = 0;
        let description = '';

        if (type === 'buka') {
            amount = this.deductionBuka;
            description = 'Buka Puasa';
        } else if (type === 'sahur') {
            amount = this.deductionSahur;
            description = 'Sahur';
        } else if (type === 'both') {
            amount = this.deductionBuka + this.deductionSahur;
            description = 'Buka Puasa + Sahur';
        }

        if (member.balance >= amount) {
            member.balance -= amount;
            this.saveData();

            // Add to history
            this.addHistory(memberId, member.name, -amount, description);
            
            return {
                success: true,
                member: member,
                amount: amount,
                description: description
            };
        }

        return {
            success: false,
            message: 'Saldo tidak cukup'
        };
    }

    deductAllMembers(type) {
        const results = [];
        this.members.forEach(member => {
            const result = this.deductMember(member.id, type);
            if (result && result.success) {
                results.push({
                    member: member.name,
                    amount: result.amount,
                    success: true
                });
            } else {
                results.push({
                    member: member.name,
                    amount: 0,
                    success: false,
                    message: 'Saldo tidak cukup'
                });
            }
        });
        this.saveData();
        return results;
    }

    topupMember(memberId, amount) {
        const member = this.getMember(memberId);
        if (!member) return null;

        member.balance += parseInt(amount);
        this.saveData();
        this.addHistory(memberId, member.name, parseInt(amount), 'Top Up Saldo');
        return member;
    }

    // ========================================================================
    // HISTORY MANAGEMENT
    // ========================================================================

    addHistory(memberId, memberName, amount, description) {
        const entry = {
            id: Date.now(),
            memberId: memberId,
            memberName: memberName,
            amount: amount,
            description: description,
            date: new Date().toISOString(),
            day: this.ramadhanDay
        };
        this.history.push(entry);
        this.saveData();
        return entry;
    }

    getHistoryByMember(memberId) {
        if (memberId === '' || memberId === null) {
            return this.history;
        }
        return this.history.filter(h => h.memberId === memberId);
    }

    getTotalDeducted() {
        return Math.abs(this.history
            .filter(h => h.amount < 0)
            .reduce((sum, h) => sum + h.amount, 0));
    }

    clearHistory() {
        this.history = [];
        this.saveData();
    }

    refundTransaction(transactionId) {
        const transaction = this.history.find(h => h.id === transactionId);
        if (!transaction) return null;

        const member = this.getMember(transaction.memberId);
        if (!member) return null;

        // Kembalikan saldo dengan menambah balik jumlahnya
        member.balance += Math.abs(transaction.amount);
        
        // Hapus dari history
        this.history = this.history.filter(h => h.id !== transactionId);
        
        // Tambah entry refund
        this.addHistory(member.id, member.name, Math.abs(transaction.amount), 
            `Refund: ${transaction.description}`);
        
        this.saveData();
        return {
            success: true,
            member: member,
            originalAmount: transaction.amount,
            description: transaction.description
        };
    }

    getTransactionById(transactionId) {
        return this.history.find(h => h.id === transactionId);
    }

    refundConfirm(transactionId) {
        const transaction = this.getTransactionById(transactionId);
        if (!transaction) {
            alert('Transaksi tidak ditemukan!');
            return;
        }
        
        const confirmMsg = `Kembalikan saldo Rp ${Math.abs(transaction.amount).toLocaleString('id-ID')} untuk ${transaction.memberName}?\n\nDeskripsi: ${transaction.description}`;
        
        if (!confirm(confirmMsg)) {
            return;
        }
        
        const result = this.refundTransaction(transactionId);
        if (result && result.success) {
            alert(`✅ Saldo berhasil dikembalikan!\n\n${result.member.name}: Rp ${result.member.balance.toLocaleString('id-ID')}`);
            this.renderHistory();
            this.updateDashboard();
        } else {
            alert('❌ Gagal mengembalikan saldo!');
        }
    }

    // ========================================================================
    // DASHBOARD UPDATES
    // ========================================================================

    updateDashboard() {
        this.updateTotalBalance();
        this.updateMembersCount();
        this.updateTodayDeduction();
        this.updateRamadanDay();
        this.updateDashboardMembersList();
    }

    updateTotalBalance() {
        const total = this.members.reduce((sum, m) => sum + m.balance, 0);
        document.getElementById('totalBalance').textContent = this.formatCurrency(total);
    }

    updateMembersCount() {
        document.getElementById('membersCount').textContent = this.members.length;
    }

    updateTodayDeduction() {
        const today = new Date().toDateString();
        const todayEntries = this.history.filter(h => {
            const entryDate = new Date(h.date).toDateString();
            return entryDate === today && h.amount < 0;
        });
        const total = Math.abs(todayEntries.reduce((sum, h) => sum + h.amount, 0));
        document.getElementById('todayDeduction').textContent = this.formatCurrency(total);
    }

    updateRamadanDay() {
        const dayContainer = document.getElementById('ramadanDay');
        dayContainer.innerHTML = `
            <button class="btn-day-control" onclick="app.changRamadhanDay(-1)">−</button>
            <span class="day-display">${this.ramadhanDay}</span>
            <button class="btn-day-control" onclick="app.changRamadhanDay(1)">+</button>
        `;
    }

    changRamadhanDay(delta) {
        const newDay = this.ramadhanDay + delta;
        if (newDay >= 1 && newDay <= 30) {
            this.ramadhanDay = newDay;
            this.saveData();
            this.updateRamadanDay();
            this.showAddScheduleForm(); // Update day di form juga
            alert(`✅ Hari Ramadhan berubah menjadi hari ke-${this.ramadhanDay}`);
        } else {
            alert('❌ Hari harus antara 1-30');
        }
    }

    updateDashboardMembersList() {
        const container = document.getElementById('dashboardMembersList');
        
        if (this.members.length === 0) {
            container.innerHTML = '<p class="empty-state">Belum ada anggota. Tambahkan anggota terlebih dahulu.</p>';
            return;
        }

        container.innerHTML = this.members.map(member => `
            <div class="member-item">
                <div class="member-info">
                    <div class="member-info-name">${this.escapeHtml(member.name)}</div>
                    <div class="member-info-balance">${this.formatCurrency(member.balance)}</div>
                </div>
                <div>
                    <button class="btn btn-small btn-primary" onclick="app.showMemberActions(${member.id})">
                        Tindakan
                    </button>
                </div>
            </div>
        `).join('');
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    renderMembers() {
        const container = document.getElementById('membersList');
        
        if (this.members.length === 0) {
            container.innerHTML = '<p class="empty-state">Belum ada anggota</p>';
            return;
        }

        container.innerHTML = this.members.map(member => `
            <div class="member-card">
                <div class="member-card-header">
                    <div class="member-name">${this.escapeHtml(member.name)}</div>
                    <button class="btn btn-small btn-danger" onclick="app.deleteMemberConfirm(${member.id})">
                        🗑️
                    </button>
                </div>
                <div class="member-balance">${this.formatCurrency(member.balance)}</div>
                <div class="member-actions">
                    <button class="btn btn-small btn-info" onclick="app.showEditMember(${member.id})">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-small btn-secondary" onclick="app.showMemberDetails(${member.id})">
                        👁️ Detail
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderSchedules() {
        const container = document.getElementById('scheduleList');
        
        if (this.schedules.length === 0) {
            container.innerHTML = '<p class="empty-state">Belum ada jadwal masak</p>';
            return;
        }

        container.innerHTML = this.schedules.map(schedule => {
            const groupMembers = schedule.memberIds && schedule.memberIds.length > 0
                ? schedule.memberIds.map(mId => this.getMember(mId)).filter(m => m).map(m => m.name)
                : [];
            
            const membersHtml = groupMembers.length > 0
                ? `<div class="schedule-members"><strong>Anggota:</strong> ${groupMembers.join(', ')}</div>`
                : '<div class="schedule-members"><em>Belum ada anggota</em></div>';

            return `
                <div class="schedule-card">
                    <div class="schedule-day">Hari ke-${schedule.day}</div>
                    <h3>${this.escapeHtml(schedule.name)}</h3>
                    <div class="schedule-description">${this.escapeHtml(schedule.description)}</div>
                    ${membersHtml}
                    <div style="margin-top: 10px; display: flex; gap: 8px;">
                        <button class="btn btn-small" onclick="app.showEditScheduleModal(${schedule.id})">
                            ✏️ Edit
                        </button>
                        <button class="btn btn-small btn-danger" onclick="app.deleteScheduleConfirm(${schedule.id})">
                            🗑️ Hapus
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderHistory() {
        const container = document.getElementById('historyList');
        const memberFilter = document.getElementById('historyMemberFilter');
        
        // Update member filter
        memberFilter.innerHTML = '<option value="">Semua Anggota</option>' + 
            this.members.map(m => `<option value="${m.id}">${this.escapeHtml(m.name)}</option>`).join('');

        const selectedMember = memberFilter.value;
        const filteredHistory = this.getHistoryByMember(selectedMember === '' ? null : selectedMember);
        
        if (filteredHistory.length === 0) {
            container.innerHTML = '<p class="empty-state">Belum ada riwayat transaksi</p>';
            return;
        }

        document.getElementById('totalTransactions').textContent = filteredHistory.length;
        document.getElementById('totalReduced').textContent = this.formatCurrency(this.getTotalDeducted());

        const table = `
            <table>
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th>Hari Ke</th>
                        <th>Anggota</th>
                        <th>Deskripsi</th>
                        <th class="text-right">Nominal</th>
                        <th style="text-align: center; width: 80px;">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredHistory.map(entry => {
                        const canRefund = entry.amount < 0 && !entry.description.startsWith('Refund');
                        return `
                            <tr>
                                <td>${this.formatDate(entry.date)}</td>
                                <td>${entry.day}</td>
                                <td>${this.escapeHtml(entry.memberName)}</td>
                                <td>${this.escapeHtml(entry.description)}</td>
                                <td class="${entry.amount < 0 ? 'deduction-negative' : 'deduction-positive'}">
                                    ${this.formatCurrency(entry.amount)}
                                </td>
                                <td style="text-align: center;">
                                    ${canRefund ? `<button class="btn btn-tiny" onclick="app.refundConfirm(${entry.id})" title="Kembalikan saldo">↩️ Refund</button>` : '—'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = table;
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    setupEventListeners() {
        // Tab Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Members Tab
        document.getElementById('addMemberBtn').addEventListener('click', () => this.showAddMemberForm());
        document.getElementById('saveMemberBtn').addEventListener('click', () => this.saveMember());
        document.getElementById('cancelMemberBtn').addEventListener('click', () => this.hideAddMemberForm());

        // Schedule Tab
        document.getElementById('addScheduleBtn').addEventListener('click', () => this.showAddScheduleForm());
        document.getElementById('saveScheduleBtn').addEventListener('click', () => this.saveSchedule());
        document.getElementById('cancelScheduleBtn').addEventListener('click', () => this.hideAddScheduleForm());

        // Quick Actions
        document.getElementById('quickBukaBtn').addEventListener('click', () => this.showQuickAction('buka'));
        document.getElementById('quickSahurBtn').addEventListener('click', () => this.showQuickAction('sahur'));
        document.getElementById('quickBothBtn').addEventListener('click', () => this.showQuickAction('both'));

        // History Tab
        document.getElementById('exportHistoryBtn').addEventListener('click', () => this.exportHistory());
        document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearHistoryConfirm());
        document.getElementById('historyMemberFilter').addEventListener('change', () => this.renderHistory());

        // Modal
        const modals = document.querySelectorAll('.close');
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('show');
            });
        });

        // Click outside modal
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
    }

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Deactivate all buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(tabName).classList.add('active');

        // Activate button
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Refresh data when tab changes
        if (tabName === 'members') this.renderMembers();
        if (tabName === 'schedule') this.renderSchedules();
        if (tabName === 'history') this.renderHistory();
    }

    // ========================================================================
    // MEMBER FORM HANDLERS
    // ========================================================================

    showAddMemberForm() {
        document.getElementById('memberName').value = '';
        document.getElementById('memberBalance').value = '100000';
        document.getElementById('addMemberForm').style.display = 'block';
        document.getElementById('memberName').focus();
    }

    hideAddMemberForm() {
        document.getElementById('addMemberForm').style.display = 'none';
    }

    saveMember() {
        const name = document.getElementById('memberName').value.trim();
        const balance = document.getElementById('memberBalance').value.trim();

        if (!name) {
            alert('Nama anggota harus diisi!');
            return;
        }

        if (!balance || isNaN(balance)) {
            alert('Saldo harus berupa angka!');
            return;
        }

        this.addMember(name, balance);
        this.hideAddMemberForm();
        this.renderMembers();
        this.updateDashboard();
    }

    showEditMember(memberId) {
        const member = this.getMember(memberId);
        if (!member) return;

        const newName = prompt('Edit nama:', member.name);
        if (newName === null) return;

        const newBalance = prompt('Edit saldo:', member.balance);
        if (newBalance === null) return;

        this.updateMember(memberId, newName, newBalance);
        this.renderMembers();
        this.updateDashboard();
    }

    deleteMemberConfirm(memberId) {
        const member = this.getMember(memberId);
        if (!member) return;

        if (confirm(`Apakah Anda yakin ingin menghapus anggota "${member.name}"?`)) {
            this.deleteMember(memberId);
            this.renderMembers();
            this.updateDashboard();
        }
    }

    showMemberDetails(memberId) {
        const member = this.getMember(memberId);
        if (!member) return;

        const modal = document.getElementById('memberModal');
        document.getElementById('modalTitle').textContent = `Detail - ${member.name}`;
        
        const memberHistory = this.history.filter(h => h.memberId === memberId);
        const totalDeducted = Math.abs(memberHistory
            .filter(h => h.amount < 0)
            .reduce((sum, h) => sum + h.amount, 0));

        let content = `
            <p><strong>Nama:</strong> ${this.escapeHtml(member.name)}</p>
            <p><strong>Saldo Saat Ini:</strong> ${this.formatCurrency(member.balance)}</p>
            <p><strong>Total Dikurangi:</strong> ${this.formatCurrency(totalDeducted)}</p>
            <p><strong>Bergabung:</strong> ${this.formatDate(member.createdAt)}</p>
            
            <h3 style="margin-top: 20px;">Riwayat Transaksi:</h3>
            <table style="width: 100%;">
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th>Deskripsi</th>
                        <th>Nominal</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (memberHistory.length > 0) {
            content += memberHistory.map(h => `
                <tr>
                    <td>${this.formatDate(h.date)}</td>
                    <td>${this.escapeHtml(h.description)}</td>
                    <td style="color: ${h.amount < 0 ? 'red' : 'green'}; font-weight: bold;">
                        ${this.formatCurrency(h.amount)}
                    </td>
                </tr>
            `).join('');
        } else {
            content += '<tr><td colspan="3">Belum ada riwayat</td></tr>';
        }

        content += '</tbody></table>';
        document.getElementById('modalBody').innerHTML = content;
        modal.classList.add('show');
    }

    showMemberActions(memberId) {
        const member = this.getMember(memberId);
        if (!member) return;

        const modal = document.getElementById('quickActionModal');
        const memberSelect = document.getElementById('quickActionMember');
        memberSelect.value = memberId;

        document.getElementById('quickActionButtons').innerHTML = `
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn btn-secondary" style="flex: 1;" onclick="app.performQuickAction('buka', ${memberId})">
                    Buka Puasa (-3000)
                </button>
                <button class="btn btn-secondary" style="flex: 1;" onclick="app.performQuickAction('sahur', ${memberId})">
                    Sahur (-3000)
                </button>
                <button class="btn btn-info" style="flex: 1;" onclick="app.performQuickAction('both', ${memberId})">
                    Keduanya (-6000)
                </button>
                <button class="btn btn-success" style="flex: 1;" onclick="app.showTopup(${memberId})">
                    + Top Up
                </button>
            </div>
        `;

        modal.classList.add('show');
    }

    // ========================================================================
    // SCHEDULE FORM HANDLERS
    // ========================================================================

    showAddScheduleForm() {
        document.getElementById('scheduleName').value = '';
        document.getElementById('scheduleDay').value = this.ramadhanDay;
        document.getElementById('scheduleDescription').value = '';
        
        // Generate member checkboxes
        const membersCheckbox = document.getElementById('scheduleMembers');
        if (membersCheckbox) {
            if (this.members.length === 0) {
                membersCheckbox.innerHTML = '<p style="color: #999; font-style: italic;">Belum ada anggota. Tambahkan anggota terlebih dahulu.</p>';
            } else {
                membersCheckbox.innerHTML = this.members.map(member => `
                    <label class="checkbox-label" style="display: flex; align-items: center; padding: 10px; cursor: pointer; border-radius: 6px; transition: all 0.2s;">
                        <input type="checkbox" name="scheduleMembers" value="${member.id}" style="width: 20px; height: 20px; cursor: pointer; accent-color: #8b5cf6;">
                        <span style="margin-left: 10px; flex-grow: 1;">${this.escapeHtml(member.name)}</span>
                    </label>
                `).join('');
            }
        }
        
        document.getElementById('addScheduleForm').style.display = 'block';
        document.getElementById('scheduleName').focus();
    }

    hideAddScheduleForm() {
        document.getElementById('addScheduleForm').style.display = 'none';
    }

    saveSchedule() {
        const name = document.getElementById('scheduleName').value.trim();
        const day = document.getElementById('scheduleDay').value.trim();
        const description = document.getElementById('scheduleDescription').value.trim();
        const memberCheckboxes = document.querySelectorAll('input[name="scheduleMembers"]:checked');
        const memberIds = Array.from(memberCheckboxes).map(cb => parseInt(cb.value));

        if (!name) {
            alert('Nama grup harus diisi!');
            return;
        }

        if (!day || isNaN(day) || day < 1 || day > 30) {
            alert('Hari harus antara 1-30!');
            return;
        }

        if (memberIds.length === 0) {
            alert('Pilih minimal 1 anggota untuk grup!');
            return;
        }

        if (memberIds.length > 3) {
            alert('Maksimal 3 anggota per grup!');
            return;
        }

        this.addSchedule(name, day, description, memberIds);
        this.hideAddScheduleForm();
        this.renderSchedules();
    }

    deleteScheduleConfirm(scheduleId) {
        const schedule = this.getSchedule(scheduleId);
        if (!schedule) return;

        if (confirm(`Apakah Anda yakin ingin menghapus jadwal "${schedule.name}"?`)) {
            this.deleteSchedule(scheduleId);
            this.renderSchedules();
        }
    }

    showEditScheduleModal(scheduleId) {
        const schedule = this.getSchedule(scheduleId);
        if (!schedule) return;

        const modal = document.getElementById('scheduleModal');
        if (!modal) {
            alert('Modal jadwal tidak ditemukan');
            return;
        }

        // Set values
        document.getElementById('editScheduleName').value = schedule.name;
        document.getElementById('editScheduleDay').value = schedule.day;
        document.getElementById('editScheduleDescription').value = schedule.description;

        // Generate member checkboxes
        const membersCheckbox = document.getElementById('editScheduleMembers');
        membersCheckbox.innerHTML = this.members.map(member => {
            const isChecked = schedule.memberIds && schedule.memberIds.includes(member.id) ? 'checked' : '';
            return `
                <label class="checkbox-label" style="display: flex; align-items: center; padding: 10px; cursor: pointer; border-radius: 6px; transition: all 0.2s;">
                    <input type="checkbox" name="editScheduleMembers" value="${member.id}" ${isChecked} style="width: 20px; height: 20px; cursor: pointer; accent-color: #8b5cf6;">
                    <span style="margin-left: 10px; flex-grow: 1;">${this.escapeHtml(member.name)}</span>
                </label>
            `;
        }).join('');

        // Set onclick for save button
        document.getElementById('saveEditScheduleBtn').onclick = () => this.saveEditSchedule(scheduleId);
        
        modal.classList.add('show');
    }

    saveEditSchedule(scheduleId) {
        const name = document.getElementById('editScheduleName').value.trim();
        const day = document.getElementById('editScheduleDay').value.trim();
        const description = document.getElementById('editScheduleDescription').value.trim();
        const memberCheckboxes = document.querySelectorAll('input[name="editScheduleMembers"]:checked');
        const memberIds = Array.from(memberCheckboxes).map(cb => parseInt(cb.value));

        if (!name) {
            alert('Nama grup harus diisi!');
            return;
        }

        if (!day || isNaN(day) || day < 1 || day > 30) {
            alert('Hari harus antara 1-30!');
            return;
        }

        if (memberIds.length === 0) {
            alert('Pilih minimal 1 anggota untuk grup!');
            return;
        }

        if (memberIds.length > 3) {
            alert('Maksimal 3 anggota per grup!');
            return;
        }

        this.updateSchedule(scheduleId, name, day, description, memberIds);
        this.renderSchedules();
        document.getElementById('scheduleModal').classList.remove('show');
    }

    // ========================================================================
    // QUICK ACTION HANDLERS
    // ========================================================================

    showQuickAction(type) {
        if (this.members.length === 0) {
            alert('Belum ada anggota!');
            return;
        }

        const modal = document.getElementById('quickActionModal');
        const memberSelect = document.getElementById('quickActionMember');
        
        // Populate dropdown with members
        memberSelect.innerHTML = '<option value="">-- Pilih Anggota --</option>' +
            this.members.map(m => `<option value="${m.id}">${this.escapeHtml(m.name)}</option>`).join('');
        memberSelect.value = '';

        let actionText = '';
        if (type === 'buka') actionText = 'Buka Puasa (-Rp 3.000)';
        if (type === 'sahur') actionText = 'Sahur (-Rp 3.000)';
        if (type === 'both') actionText = 'Buka + Sahur (-Rp 6.000)';

        document.getElementById('quickActionButtons').innerHTML = `
            <div style="display: flex; gap: 10px; flex-direction: column;">
                <button class="btn btn-success" onclick="app.performAllQuickAction('${type}')">
                    ✅ Aplikasikan ke Semua
                </button>
                <button class="btn btn-secondary" onclick="app.performQuickAction('${type}', null)">
                    👤 Aplikasikan ke Terpilih
                </button>
            </div>
        `;

        modal.classList.add('show');
    }

    performQuickAction(type, memberId = null) {
        if (memberId === null) {
            const select = document.getElementById('quickActionMember');
            memberId = select.value;
            
            if (!memberId) {
                alert('Pilih anggota terlebih dahulu!');
                return;
            }
            memberId = parseInt(memberId);
        }

        const result = this.deductMember(memberId, type);
        
        if (result.success) {
            const member = this.getMember(memberId);
            alert(`✅ ${result.description} berhasil untuk ${member.name}\nSaldo: ${this.formatCurrency(member.balance)}`);
            this.updateDashboard();
            this.renderMembers();
            this.renderHistory();
            document.getElementById('memberModal').classList.remove('show');
            document.getElementById('quickActionModal').classList.remove('show');
        } else {
            alert(`❌ ${result.message} untuk menggunakan ${result.description}`);
        }
    }

    performAllQuickAction(type) {
        const results = this.deductAllMembers(type);
        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;

        let message = `✅ Berhasil untuk ${successCount} anggota\n`;
        if (failedCount > 0) {
            message += `❌ Gagal untuk ${failedCount} anggota (saldo tidak cukup)\n`;
        }

        const failedMembers = results.filter(r => !r.success).map(r => r.member);
        if (failedMembers.length > 0) {
            message += `\nAnggota yang gagal: ${failedMembers.join(', ')}`;
        }

        alert(message);
        this.updateDashboard();
        this.renderMembers();
        this.renderHistory();
        document.getElementById('quickActionModal').classList.remove('show');
    }

    showTopup(memberId) {
        const amount = prompt('Masukkan jumlah top up:');
        if (amount === null) return;

        if (!amount || isNaN(amount) || amount <= 0) {
            alert('Jumlah harus berupa angka positif!');
            return;
        }

        const member = this.topupMember(memberId, amount);
        alert(`✅ Top up berhasil!\nSaldo baru: ${this.formatCurrency(member.balance)}`);
        this.updateDashboard();
        this.renderMembers();
        this.renderHistory();
        document.getElementById('memberModal').classList.remove('show');
    }

    // ========================================================================
    // HISTORY HANDLERS
    // ========================================================================

    exportHistory() {
        let csv = 'Tanggal,Hari Ke,Anggota,Deskripsi,Nominal\n';
        
        this.history.forEach(entry => {
            csv += `"${this.formatDate(entry.date)}","${entry.day}","${entry.memberName}","${entry.description}","${this.formatCurrency(entry.amount)}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rekap-ramadhan-${new Date().toLocaleDateString('id-ID')}.csv`;
        a.click();
    }

    clearHistoryConfirm() {
        if (confirm('Apakah Anda yakin ingin menghapus SEMUA riwayat? Tindakan ini tidak dapat dibatalkan!')) {
            this.clearHistory();
            this.renderHistory();
            alert('✅ Riwayat telah dihapus');
        }
    }

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }

    formatDate(dateString) {
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('id-ID', options);
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// ============================================================================
// INITIALIZE APP
// ============================================================================

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new RamadhanApp();
});
