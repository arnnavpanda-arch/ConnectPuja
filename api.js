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
            if (data.success) return data.data;
        } catch (e) {
            return null;
        }
    }
};

window.PujaAPI = PujaAPI;
