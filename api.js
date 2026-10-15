/**
 * PujaConnect API Client
 * Connects frontend to Express.js + MongoDB Backend
 * Automatically falls back to localStorage if backend is offline.
 */
const API_BASE_URL = typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:5000/api';

const PujaAPI = {
    // Check if backend is alive
    async isOnline() {
        try {
            const res = await fetch(`${API_BASE_URL}`, { method: 'GET', signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            return data && (data.status === 'Online' || data.database === 'Connected');
        } catch (e) {
            return false;
        }
    },

    // --- AUTHENTICATION ---
    async register(userData) {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            return await res.json();
        } catch (e) {
            console.warn("Backend offline, using local storage");
            return null;
        }
    },

    async login(email) {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    // --- PUJAS ---
    async getPujas() {
        try {
            const res = await fetch(`${API_BASE_URL}/pujas`);
            const data = await res.json();
            if (data.success) {
                // Sync to localStorage as cache
                localStorage.setItem('globalPujas', JSON.stringify(data.data));
                return data.data;
            }
        } catch (e) {
            console.warn("Backend offline, loading from localStorage");
        }
        return JSON.parse(localStorage.getItem('globalPujas')) || [];
    },

    async createPuja(pujaData) {
        try {
            const res = await fetch(`${API_BASE_URL}/pujas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pujaData)
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    // --- PANDITS ---
    async registerPandit(panditData) {
        try {
            const res = await fetch(`${API_BASE_URL}/pandits/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(panditData)
            });
            return await res.json();
        } catch (e) {
            console.warn("Backend offline, saving pandit locally");
            return null;
        }
    },

    async getAllPandits() {
        try {
            const res = await fetch(`${API_BASE_URL}/pandits`);
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                return data.data;
            }
        } catch (e) {
            console.warn("Backend offline, loading pandits from local storage");
        }
        return null;
    },

    async updatePanditStatus(idOrEmail, status, additionalData = {}) {
        try {
            const res = await fetch(`${API_BASE_URL}/pandits/${encodeURIComponent(idOrEmail)}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, ...additionalData })
            });
            return await res.json();
        } catch (e) {
            console.warn("Backend offline for pandit status update");
            return null;
        }
    },

    async getVerifiedPandits(district, service) {
        try {
            let url = `${API_BASE_URL}/pandits/verified?`;
            if (district) url += `district=${encodeURIComponent(district)}&`;
            if (service) url += `service=${encodeURIComponent(service)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) return data.data;
        } catch (e) {
            console.warn("Backend offline, searching local pandits");
        }
        return JSON.parse(localStorage.getItem('adminPandits')) || [];
    },

    // --- USERS / CUSTOMERS ---
    async getAllUsers() {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/users`);
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                return data.data;
            }
        } catch (e) {
            console.warn("Backend offline, loading customers from local storage");
        }
        return null;
    },

    async deleteUser(email) {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/profile/${encodeURIComponent(email)}`, {
                method: 'DELETE'
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    // --- BOOKINGS ---
    async getAllBookings() {
        try {
            const res = await fetch(`${API_BASE_URL}/bookings`);
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                return data.data;
            }
        } catch (e) {
            console.warn("Backend offline, loading bookings from local storage");
        }
        return null;
    },

    async createBooking(bookingData) {
        try {
            const res = await fetch(`${API_BASE_URL}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    async updateBooking(bookingId, updateData) {
        try {
            const res = await fetch(`${API_BASE_URL}/bookings/${encodeURIComponent(bookingId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    async getUserBookings(email) {
        try {
            const res = await fetch(`${API_BASE_URL}/bookings/user/${encodeURIComponent(email)}`);
            const data = await res.json();
            if (data.success) return data.data;
        } catch (e) {
            return null;
        }
    },

    // --- LONG PUJAS ---
    async submitLongPuja(requestData) {
        try {
            const res = await fetch(`${API_BASE_URL}/long-pujas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    async getAllLongPujas() {
        try {
            const res = await fetch(`${API_BASE_URL}/long-pujas`);
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) return data.data;
        } catch (e) {
            return null;
        }
        return null;
    },

    async updateLongPuja(requestId, updateData) {
        try {
            const res = await fetch(`${API_BASE_URL}/long-pujas/${encodeURIComponent(requestId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    async updatePanditProfile(email, profileData) {
        try {
            const res = await fetch(`${API_BASE_URL}/pandits/${encodeURIComponent(email)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    async savePuja(pujaData) {
        try {
            const res = await fetch(`${API_BASE_URL}/pujas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pujaData)
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    async deletePuja(pujaName) {
        try {
            const res = await fetch(`${API_BASE_URL}/pujas/${encodeURIComponent(pujaName)}`, {
                method: 'DELETE'
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    async getLocations() {
        try {
            const res = await fetch(`${API_BASE_URL}/settings/locations`);
            const data = await res.json();
            if (data.success && data.data) return data.data;
        } catch (e) {
            return null;
        }
    },

    async saveLocations(locationsData) {
        try {
            const res = await fetch(`${API_BASE_URL}/settings/locations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: locationsData })
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    // --- CROSS-DEVICE GLOBAL CLOUD SYNC ---
    // Fetches fresh data from MongoDB and updates local storage on all devices
    async syncAllFromCloud() {
        try {
            const [pujas, pandits, users, bookings, longPujas, locations] = await Promise.all([
                fetch(`${API_BASE_URL}/pujas`).then(r => r.json()).catch(() => ({})),
                fetch(`${API_BASE_URL}/pandits`).then(r => r.json()).catch(() => ({})),
                fetch(`${API_BASE_URL}/auth/users`).then(r => r.json()).catch(() => ({})),
                fetch(`${API_BASE_URL}/bookings`).then(r => r.json()).catch(() => ({})),
                fetch(`${API_BASE_URL}/long-pujas`).then(r => r.json()).catch(() => ({})),
                fetch(`${API_BASE_URL}/settings/locations`).then(r => r.json()).catch(() => ({}))
            ]);

            let changed = false;

            if (locations && locations.success && locations.data && Object.keys(locations.data).length > 0) {
                localStorage.setItem('adminApprovedLocations', JSON.stringify(locations.data));
                changed = true;
            }

            if (pujas && pujas.success && Array.isArray(pujas.data) && pujas.data.length > 0) {
                localStorage.setItem('globalPujas', JSON.stringify(pujas.data));
                changed = true;
            }

            if (pandits && pandits.success && Array.isArray(pandits.data) && pandits.data.length > 0) {
                let localP = JSON.parse(localStorage.getItem('adminPandits') || '[]');
                const map = new Map();
                localP.forEach(p => { if (p && p.email) map.set(p.email.toLowerCase(), p); });
                pandits.data.forEach(p => {
                    if (p && p.email) {
                        const existing = map.get(p.email.toLowerCase()) || {};
                        map.set(p.email.toLowerCase(), {
                            ...existing,
                            name: p.name || existing.name,
                            email: p.email,
                            phone: p.phone || existing.phone,
                            location: (p.district ? `${p.district}, ${p.state || 'Odisha'}` : (existing.location || 'Odisha')),
                            workingState: p.state || existing.workingState || 'Odisha',
                            workingDistricts: p.district ? [p.district] : (existing.workingDistricts || ['Khordha']),
                            exp: p.experience ? `${p.experience}+ Years` : (existing.exp || '5+ Years'),
                            specialty: (Array.isArray(p.services) ? p.services.join(', ') : (existing.specialty || 'Vedic Rituals')),
                            status: p.status || existing.status || 'Pending Review',
                            photo: p.photo || existing.photo || 'https://images.unsplash.com/photo-1544168190-79c15427015f?auto=format&fit=crop&q=80&w=200',
                            documentUrl: p.documentUrl || existing.documentUrl,
                            _id: p._id || existing._id
                        });
                    }
                });
                localStorage.setItem('adminPandits', JSON.stringify(Array.from(map.values())));
                changed = true;
            }

            if (users && users.success && Array.isArray(users.data) && users.data.length > 0) {
                let localU = JSON.parse(localStorage.getItem('regularUsers') || '[]');
                const map = new Map();
                localU.forEach(u => { if (u && u.email) map.set(u.email.toLowerCase(), u); });
                users.data.forEach(u => {
                    if (u && u.email) {
                        const existing = map.get(u.email.toLowerCase()) || {};
                        map.set(u.email.toLowerCase(), {
                            ...existing,
                            name: u.name || existing.name,
                            email: u.email,
                            phone: u.phone || existing.phone,
                            state: u.state || existing.state,
                            district: u.district || existing.district,
                            city: u.city || existing.city,
                            _id: u._id || existing._id
                        });
                    }
                });
                localStorage.setItem('regularUsers', JSON.stringify(Array.from(map.values())));
                changed = true;
            }

            if (bookings && bookings.success && Array.isArray(bookings.data) && bookings.data.length > 0) {
                let localB = JSON.parse(localStorage.getItem('pujaBookings') || '[]');
                const map = new Map();
                localB.forEach(b => { if (b && (b.id || b.bookingId)) map.set((b.id || b.bookingId), b); });
                bookings.data.forEach(b => {
                    const id = b.bookingId || b.id || b._id;
                    const existing = map.get(id) || {};
                    map.set(id, {
                        ...existing,
                        id: id,
                        bookingId: id,
                        customerName: b.userName || existing.customerName || 'Devotee',
                        customerEmail: b.userEmail || existing.customerEmail,
                        phone: b.phone || existing.phone,
                        service: b.service || existing.service,
                        date: b.date || existing.date,
                        time: b.time || existing.time || '10:00 AM',
                        district: b.district || existing.district,
                        panditEmail: b.panditEmail || existing.panditEmail,
                        panditName: b.panditName || existing.panditName || 'Assigned Pandit',
                        status: b.status || existing.status || 'Confirmed',
                        fee: b.fee || existing.fee || 1199,
                        advancePaid: b.advancePaid || existing.advancePaid || false,
                        paymentStatus: b.paymentStatus || existing.paymentStatus || 'Pending',
                        bookingType: b.bookingType || existing.bookingType || 'Standard',
                        transactionDate: b.transactionDate || existing.transactionDate || new Date().toISOString()
                    });
                });
                localStorage.setItem('pujaBookings', JSON.stringify(Array.from(map.values())));
                changed = true;
            }

            if (longPujas && longPujas.success && Array.isArray(longPujas.data) && longPujas.data.length > 0) {
                let localLP = JSON.parse(localStorage.getItem('longPujaRequests') || '[]');
                const map = new Map();
                localLP.forEach(r => { if (r && r.id) map.set(r.id, r); });
                longPujas.data.forEach(r => {
                    if (r && r.id) {
                        const existing = map.get(r.id) || {};
                        map.set(r.id, {
                            ...existing,
                            id: r.id,
                            userId: r.userEmail || existing.userId,
                            userName: r.userName || existing.userName,
                            phone: r.phone || existing.phone,
                            pujaName: r.pujaName || existing.pujaName,
                            district: r.district || existing.district,
                            fromDate: r.fromDate || existing.fromDate,
                            toDate: r.toDate || existing.toDate,
                            totalDays: r.totalDays || existing.totalDays || 1,
                            dailyHours: r.dailyHours || existing.dailyHours || 4,
                            totalHours: r.totalHours || existing.totalHours || 4,
                            requiredPandits: r.requiredPandits || existing.requiredPandits || 1,
                            assignedPandits: r.assignedPandits || existing.assignedPandits || [],
                            panditStatuses: r.panditStatuses || existing.panditStatuses || {},
                            status: r.status || existing.status || 'Pending Admin',
                            estimatedCost: r.estimatedCost || existing.estimatedCost || 0,
                            paid: r.paid !== undefined ? r.paid : (existing.paid || false),
                            advancePaid: r.advancePaid !== undefined ? r.advancePaid : (existing.advancePaid || false)
                        });
                    }
                });
                localStorage.setItem('longPujaRequests', JSON.stringify(Array.from(map.values())));
                changed = true;
            }

            if (changed) {
                window.dispatchEvent(new CustomEvent('pujaDataSynced'));
                window.dispatchEvent(new CustomEvent('pujaBookingsUpdated'));
            }
            return true;
        } catch (e) {
            console.warn("Background cloud sync error:", e);
            return false;
        }
    }
};

window.PujaAPI = PujaAPI;
