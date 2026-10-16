/**
 * PujaConnect API Client
 * Centralized MongoDB Atlas Data Synchronization Engine
 * Ensures 100% data consistency across PC, Mobile, and Tablet devices
 */

function getApiBaseUrl() {
    try {
        if (typeof window !== 'undefined') {
            if (window.location && window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('about:')) {
                return `${window.location.origin}/api`;
            }
            if (window.parent && window.parent !== window && window.parent.location && window.parent.location.origin && window.parent.location.origin !== 'null' && !window.parent.location.origin.startsWith('about:')) {
                return `${window.parent.location.origin}/api`;
            }
        }
    } catch (e) {}
    return 'https://connect-puja.vercel.app/api';
}

async function apiFetch(endpoint, options = {}) {
    const base = getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const sep = cleanEndpoint.includes('?') ? '&' : '?';
    const url = `${base}${cleanEndpoint}${sep}_nocache=${Date.now()}`;
    const defaultHeaders = {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
    };
    if (options.body && typeof options.body === 'string') {
        defaultHeaders['Content-Type'] = 'application/json';
    }
    const finalOptions = {
        ...options,
        cache: 'no-store',
        headers: {
            ...defaultHeaders,
            ...(options.headers || {})
        }
    };
    return fetch(url, finalOptions);
}

const PujaAPI = {
    getBaseUrl: getApiBaseUrl,
    fetch: apiFetch,

    // Check if backend and MongoDB Atlas are alive and connected
    async isOnline() {
        try {
            const res = await apiFetch('', { method: 'GET', signal: AbortSignal.timeout(4000) });
            const data = await res.json();
            return data && (data.status === 'Online' || data.database === 'Connected');
        } catch (e) {
            return false;
        }
    },

    // --- AUTHENTICATION & USERS ---
    async register(userData) {
        try {
            const res = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
            const data = await res.json();
            if (data && data.success) {
                await this.syncAllFromCloud();
            }
            return data;
        } catch (e) {
            console.warn("Backend register error:", e);
            return null;
        }
    },

    async login(email) {
        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: (email || '').trim().toLowerCase() })
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    async getAllUsers() {
        try {
            const res = await apiFetch('/auth/users');
            const data = await res.json();
            if (data && data.success && Array.isArray(data.data)) {
                return data.data;
            }
        } catch (e) {
            console.warn("Backend users load error:", e);
        }
        return JSON.parse(localStorage.getItem('regularUsers') || '[]');
    },

    async deleteUser(email) {
        try {
            const res = await apiFetch(`/auth/profile/${encodeURIComponent(email)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data && data.success) {
                await this.syncAllFromCloud();
            }
            return data;
        } catch (e) {
            return null;
        }
    },

    // --- PUJAS ---
    async getPujas() {
        try {
            const res = await apiFetch('/pujas');
            const data = await res.json();
            if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
                localStorage.setItem('globalPujas', JSON.stringify(data.data));
                return data.data;
            }
        } catch (e) {
            console.warn("Backend pujas load error:", e);
        }
        return JSON.parse(localStorage.getItem('globalPujas') || '[]');
    },

    async createPuja(pujaData) {
        try {
            const res = await apiFetch('/pujas', {
                method: 'POST',
                body: JSON.stringify(pujaData)
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    async deletePuja(pujaName) {
        try {
            const res = await apiFetch(`/pujas/${encodeURIComponent(pujaName)}`, {
                method: 'DELETE'
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    // --- PANDITS ---
    async registerPandit(panditData) {
        try {
            const res = await apiFetch('/pandits/register', {
                method: 'POST',
                body: JSON.stringify(panditData)
            });
            const data = await res.json();
            if (data && data.success) {
                await this.syncAllFromCloud();
            }
            return data;
        } catch (e) {
            console.warn("Backend pandit registration error:", e);
            return null;
        }
    },

    async getAllPandits() {
        try {
            const res = await apiFetch('/pandits');
            const data = await res.json();
            if (data && data.success && Array.isArray(data.data)) {
                return data.data;
            }
        } catch (e) {
            console.warn("Backend pandits load error:", e);
        }
        return JSON.parse(localStorage.getItem('adminPandits') || '[]');
    },

    async updatePanditStatus(idOrEmail, status, additionalData = {}) {
        try {
            const res = await apiFetch(`/pandits/${encodeURIComponent(idOrEmail)}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status, ...additionalData })
            });
            const data = await res.json();
            if (data && data.success) {
                await this.syncAllFromCloud();
            }
            return data;
        } catch (e) {
            console.warn("Backend pandit status update error:", e);
            return null;
        }
    },

    async updatePanditProfile(email, profileData) {
        try {
            const res = await apiFetch(`/pandits/${encodeURIComponent(email)}`, {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });
            const data = await res.json();
            if (data && data.success) {
                await this.syncAllFromCloud();
            }
            return data;
        } catch (e) {
            return null;
        }
    },

    async getVerifiedPandits(district, service) {
        try {
            let url = `/pandits/verified?`;
            if (district) url += `district=${encodeURIComponent(district)}&`;
            if (service) url += `service=${encodeURIComponent(service)}`;
            const res = await apiFetch(url);
            const data = await res.json();
            if (data && data.success && Array.isArray(data.data)) return data.data;
        } catch (e) {
            console.warn("Backend search verified pandits error:", e);
        }
        let local = JSON.parse(localStorage.getItem('adminPandits') || '[]');
        return local.filter(p => (p.status === 'Fully Verified' || p.status === 'Approved'));
    },

    // --- BOOKINGS ---
    async getAllBookings() {
        try {
            const res = await apiFetch('/bookings');
            const data = await res.json();
            if (data && data.success && Array.isArray(data.data)) {
                return data.data;
            }
        } catch (e) {
            console.warn("Backend bookings load error:", e);
        }
        return JSON.parse(localStorage.getItem('pujaBookings') || '[]');
    },

    async createBooking(bookingData) {
        try {
            const res = await apiFetch('/bookings', {
                method: 'POST',
                body: JSON.stringify(bookingData)
            });
            const data = await res.json();
            if (data && data.success) {
                await this.syncAllFromCloud();
            }
            return data;
        } catch (e) {
            console.warn("Backend create booking error:", e);
            return null;
        }
    },

    async updateBooking(bookingId, updateData) {
        try {
            const cleanId = (bookingId || '').replace('#', '').trim();
            const res = await apiFetch(`/bookings/${encodeURIComponent(cleanId)}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            const data = await res.json();
            if (data && data.success) {
                await this.syncAllFromCloud();
            }
            return data;
        } catch (e) {
            console.warn("Backend update booking error:", e);
            return null;
        }
    },

    async deleteBooking(bookingId) {
        try {
            const cleanId = (bookingId || '').replace('#', '').trim();
            const res = await apiFetch(`/bookings/${encodeURIComponent(cleanId)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data && data.success) {
                await this.syncAllFromCloud();
            }
            return data;
        } catch (e) {
            return null;
        }
    },

    async getUserBookings(email) {
        try {
            const res = await apiFetch(`/bookings/user/${encodeURIComponent((email || '').trim().toLowerCase())}`);
            const data = await res.json();
            if (data && data.success && Array.isArray(data.data)) return data.data;
        } catch (e) {
            return null;
        }
    },

    async getPanditBookings(email) {
        try {
            const res = await apiFetch(`/bookings/pandit/${encodeURIComponent((email || '').trim().toLowerCase())}`);
            const data = await res.json();
            if (data && data.success && Array.isArray(data.data)) return data.data;
        } catch (e) {
            return null;
        }
    },

    // --- LONG PUJAS ---
    async submitLongPuja(requestData) {
        try {
            const res = await apiFetch('/long-pujas', {
                method: 'POST',
                body: JSON.stringify(requestData)
            });
            const data = await res.json();
            if (data && data.success) {
                await this.syncAllFromCloud();
            }
            return data;
        } catch (e) {
            return null;
        }
    },

    async getAllLongPujas() {
        try {
            const res = await apiFetch('/long-pujas');
            const data = await res.json();
            if (data && data.success && Array.isArray(data.data)) return data.data;
        } catch (e) {
            return null;
        }
        return JSON.parse(localStorage.getItem('longPujaRequests') || '[]');
    },

    async updateLongPuja(requestId, updateData) {
        try {
            const cleanId = (requestId || '').replace('#', '').trim();
            const res = await apiFetch(`/long-pujas/${encodeURIComponent(cleanId)}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            const data = await res.json();
            if (data && data.success) {
                await this.syncAllFromCloud();
            }
            return data;
        } catch (e) {
            return null;
        }
    },

    // --- SETTINGS & APPROVED LOCATIONS ---
    async getLocations() {
        try {
            const res = await apiFetch('/settings/locations');
            const data = await res.json();
            if (data && data.success && data.data) {
                localStorage.setItem('adminApprovedLocations', JSON.stringify(data.data));
                return data.data;
            }
        } catch (e) {
            return null;
        }
    },

    async saveLocations(locationsData) {
        try {
            const res = await apiFetch('/settings/locations', {
                method: 'POST',
                body: JSON.stringify({ value: locationsData })
            });
            const data = await res.json();
            if (data && data.success) {
                localStorage.setItem('adminApprovedLocations', JSON.stringify(locationsData));
            }
            return data;
        } catch (e) {
            return null;
        }
    },

    // --- SAFE DATA MIGRATION FROM BROWSER STORAGE TO MONGODB ATLAS ---
    // Migrates any existing local data safely to MongoDB Atlas without deleting records
    async migrateLocalStorageToMongoDB() {
        try {
            // 1. Migrate Users
            let localUsers = JSON.parse(localStorage.getItem('regularUsers') || '[]');
            if (Array.isArray(localUsers) && localUsers.length > 0) {
                for (const u of localUsers) {
                    if (u && u.email && u.name) {
                        await apiFetch('/auth/register', {
                            method: 'POST',
                            body: JSON.stringify(u)
                        }).catch(() => {});
                    }
                }
            }

            // 2. Migrate Pandits
            let localPandits = JSON.parse(localStorage.getItem('adminPandits') || '[]');
            if (Array.isArray(localPandits) && localPandits.length > 0) {
                for (const p of localPandits) {
                    if (p && p.email && p.name) {
                        await apiFetch('/pandits/register', {
                            method: 'POST',
                            body: JSON.stringify({
                                name: p.name,
                                email: p.email,
                                phone: p.phone || '',
                                state: p.state || p.workingState || 'Odisha',
                                district: p.district || (Array.isArray(p.workingDistricts) ? p.workingDistricts[0] : 'Khordha'),
                                experience: p.experience || (p.exp ? parseInt(p.exp) : 5),
                                bio: p.bio || `${p.specialty || 'Vedic Rituals'} specialist`,
                                services: Array.isArray(p.services) ? p.services : [p.specialty || 'Satyanarayan Puja'],
                                fee: p.fee || 1500
                            })
                        }).catch(() => {});
                    }
                }
            }

            // 3. Migrate Bookings (filter out fake mock records)
            let localBookings = JSON.parse(localStorage.getItem('pujaBookings') || '[]');
            if (Array.isArray(localBookings) && localBookings.length > 0) {
                let validBookings = localBookings.filter(b => b && b.customerEmail !== 'arjun@example.com' && (b.bookingId || b.id));
                if (validBookings.length > 0) {
                    await apiFetch('/sync-bookings', {
                        method: 'POST',
                        body: JSON.stringify({ bookings: validBookings })
                    }).catch(() => {});
                }
            }

            // 4. Migrate Long Pujas
            let localLongPujas = JSON.parse(localStorage.getItem('longPujaRequests') || '[]');
            if (Array.isArray(localLongPujas) && localLongPujas.length > 0) {
                for (const lp of localLongPujas) {
                    if (lp && (lp.id || lp.pujaName)) {
                        await apiFetch('/long-pujas', {
                            method: 'POST',
                            body: JSON.stringify(lp)
                        }).catch(() => {});
                    }
                }
            }

            // 5. Migrate Locations
            let localLocations = JSON.parse(localStorage.getItem('adminApprovedLocations') || 'null');
            if (localLocations && Object.keys(localLocations).length > 0) {
                await apiFetch('/settings/locations', {
                    method: 'POST',
                    body: JSON.stringify({ value: localLocations })
                }).catch(() => {});
            }

            return true;
        } catch (e) {
            console.warn("Migration warning:", e);
            return false;
        }
    },

    // --- CENTRAL CROSS-DEVICE GLOBAL CLOUD SYNC ---
    // Fetches fresh authoritative data from MongoDB and updates local caches across all devices
    async syncAllFromCloud() {
        try {
            const [pujas, pandits, users, bookings, longPujas, locations] = await Promise.all([
                apiFetch('/pujas').then(r => r.json()).catch(() => ({})),
                apiFetch('/pandits').then(r => r.json()).catch(() => ({})),
                apiFetch('/auth/users').then(r => r.json()).catch(() => ({})),
                apiFetch('/bookings').then(r => r.json()).catch(() => ({})),
                apiFetch('/long-pujas').then(r => r.json()).catch(() => ({})),
                apiFetch('/settings/locations').then(r => r.json()).catch(() => ({}))
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
                            email: p.email.toLowerCase(),
                            phone: p.phone || existing.phone,
                            location: (p.district ? `${p.district}, ${p.state || 'Odisha'}` : (existing.location || 'Odisha')),
                            state: p.state || existing.state || 'Odisha',
                            district: p.district || existing.district || 'Khordha',
                            workingState: p.workingState || p.state || existing.workingState || 'Odisha',
                            workingDistricts: Array.isArray(p.workingDistricts) ? p.workingDistricts : (p.district ? [p.district] : (existing.workingDistricts || ['Khordha'])),
                            exp: p.exp || (p.experience ? `${p.experience}+ Years` : (existing.exp || '5+ Years')),
                            experience: p.experience || existing.experience || 5,
                            specialty: p.specialty || (Array.isArray(p.services) ? p.services.join(', ') : (existing.specialty || 'Vedic Rituals')),
                            services: Array.isArray(p.services) ? p.services : (existing.services || ['Satyanarayan Puja']),
                            fee: p.fee || existing.fee || 1500,
                            status: p.status || existing.status || 'Fully Verified',
                            verified: p.verified !== undefined ? p.verified : (existing.verified || true),
                            photo: p.photo || existing.photo || 'https://images.unsplash.com/photo-1544168190-79c15427015f?auto=format&fit=crop&q=80&w=200',
                            documentUrl: p.documentUrl || existing.documentUrl,
                            _id: p._id || existing._id
                        });
                    }
                });
                localStorage.setItem('adminPandits', JSON.stringify(Array.from(map.values())));
                changed = true;
            }

            if (users && users.success && Array.isArray(users.data)) {
                let localU = JSON.parse(localStorage.getItem('regularUsers') || '[]');
                const map = new Map();
                localU.forEach(u => { if (u && u.email) map.set(u.email.toLowerCase(), u); });
                users.data.forEach(u => {
                    if (u && u.email) {
                        const existing = map.get(u.email.toLowerCase()) || {};
                        map.set(u.email.toLowerCase(), {
                            ...existing,
                            name: u.name || existing.name,
                            email: u.email.toLowerCase(),
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

            if (bookings && bookings.success && Array.isArray(bookings.data)) {
                let localB = JSON.parse(localStorage.getItem('pujaBookings') || '[]');
                const map = new Map();
                localB.forEach(b => {
                    const id = b.bookingId || b.id;
                    if (id && id !== 'BKG-1042' && id !== 'BKG-1030') map.set(id, b);
                });
                bookings.data.forEach(b => {
                    const id = b.bookingId || b.id || b._id;
                    if (id) {
                        const existing = map.get(id) || {};
                        map.set(id, {
                            ...existing,
                            id: id,
                            bookingId: id,
                            customerName: b.userName || b.customerName || existing.customerName || 'Devotee',
                            userName: b.userName || b.customerName || existing.userName || 'Devotee',
                            customerEmail: (b.userEmail || b.customerEmail || existing.customerEmail || '').trim().toLowerCase(),
                            userEmail: (b.userEmail || b.customerEmail || existing.userEmail || '').trim().toLowerCase(),
                            phone: b.phone || existing.phone || '',
                            service: b.service || existing.service,
                            date: b.date || existing.date,
                            time: b.time || existing.time || '10:00 AM',
                            district: b.district || existing.district,
                            panditEmail: (b.panditEmail || existing.panditEmail || '').trim().toLowerCase(),
                            panditName: b.panditName || existing.panditName || 'Assigned Pandit',
                            status: b.status || existing.status || 'Pending Pandit',
                            fee: b.fee || existing.fee || 1199,
                            advancePaid: b.advancePaid !== undefined ? b.advancePaid : (existing.advancePaid || false),
                            advanceAmount: b.advanceAmount || existing.advanceAmount || 0,
                            paymentStatus: b.paymentStatus || existing.paymentStatus || 'Pending',
                            bookingType: b.bookingType || existing.bookingType || 'Standard',
                            paid: b.paid !== undefined ? b.paid : (b.paymentStatus === 'Paid' || existing.paid || false),
                            transactionDate: b.transactionDate || existing.transactionDate || new Date().toISOString()
                        });
                    }
                });
                localStorage.setItem('pujaBookings', JSON.stringify(Array.from(map.values())));
                changed = true;
            }

            if (longPujas && longPujas.success && Array.isArray(longPujas.data)) {
                let localLP = JSON.parse(localStorage.getItem('longPujaRequests') || '[]');
                const map = new Map();
                localLP.forEach(r => { if (r && r.id) map.set(r.id, r); });
                longPujas.data.forEach(r => {
                    if (r && r.id) {
                        const existing = map.get(r.id) || {};
                        map.set(r.id, {
                            ...existing,
                            id: r.id,
                            userId: (r.userEmail || r.userId || existing.userId || '').trim().toLowerCase(),
                            userEmail: (r.userEmail || r.userId || existing.userEmail || '').trim().toLowerCase(),
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
                            advancePaid: r.advancePaid !== undefined ? r.advancePaid : (existing.advancePaid || false),
                            submittedAt: r.submittedAt || existing.submittedAt || new Date().toISOString()
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

if (typeof window !== 'undefined') {
    window.PujaAPI = PujaAPI;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PujaAPI;
}
