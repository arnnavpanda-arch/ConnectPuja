/**
 * PujaConnect Automated Email Helper
 * Sends real automated emails through the backend Gmail SMTP engine (bookpujaconnect@gmail.com)
 * Fully origin-aware and cache-free for cross-device support
 */

function getEmailApiBaseUrl() {
    try {
        if (typeof window !== 'undefined') {
            if (window.PujaAPI && typeof window.PujaAPI.getBaseUrl === 'function') {
                return window.PujaAPI.getBaseUrl();
            }
            if (window.parent && window.parent.PujaAPI && typeof window.parent.PujaAPI.getBaseUrl === 'function') {
                return window.parent.PujaAPI.getBaseUrl();
            }
            if (window.location && window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('about:')) {
                return `${window.location.origin}/api`;
            }
            if (window.parent && window.parent.location && window.parent.location.origin && window.parent.location.origin !== 'null') {
                return `${window.parent.location.origin}/api`;
            }
        }
    } catch(e) {}
    return 'https://connect-puja.vercel.app/api';
}

function sendAutomatedEmail(toEmail, type, data = {}) {
    if (!toEmail) return Promise.resolve(null);
    
    const baseUrl = getEmailApiBaseUrl();
    console.log(`[PujaConnect Mailer] Dispatching ${type} email to: ${toEmail}...`);
    
    return fetch(`${baseUrl}/send-email?_t=${Date.now()}`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
        },
        body: JSON.stringify({
            to: toEmail,
            type: type,
            data: data
        })
    })
    .then(async res => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
            console.warn(`[PujaConnect Mailer] Server returned error:`, json);
            return { success: false, error: json.error || json.message || `HTTP ${res.status}` };
        }
        console.log(`[PujaConnect Mailer] Email sent response:`, json);
        return json;
    })
    .catch(err => {
        console.warn(`[PujaConnect Mailer] Email send warning:`, err);
        return { success: false, error: err.message };
    });
}

function syncEmailBookingActions() {
    const baseUrl = getEmailApiBaseUrl();
    // 1. Process any local storage pending actions
    try {
        let actions = JSON.parse(localStorage.getItem('pendingBookingEmailActions') || '[]');
        if (actions.length > 0) {
            let bookings = JSON.parse(localStorage.getItem('pujaBookings') || '[]');
            let changed = false;

            actions.forEach(act => {
                let targetId = (act.cleanId || act.id || '').replace('#', '').trim();
                let idx = bookings.findIndex(b => (b.id || b.bookingId || '').replace('#', '').trim() === targetId);
                if (idx > -1) {
                    let oldStatus = bookings[idx].status;
                    let newStatus = act.action === 'accept' ? 'Accepted' : 'Rejected';
                    if (oldStatus !== newStatus) {
                        bookings[idx].status = newStatus;
                        changed = true;
                    }
                }
            });

            if (changed) {
                localStorage.setItem('pujaBookings', JSON.stringify(bookings));
                window.dispatchEvent(new CustomEvent('pujaBookingsUpdated'));
            }
            localStorage.removeItem('pendingBookingEmailActions');
        }
    } catch (e) {
        console.warn("[PujaConnect Mailer] Sync local error:", e);
    }

    // 2. Fetch server-side confirmed actions/bookings from MongoDB Atlas
    try {
        fetch(`${baseUrl}/booking-updates?_t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache, no-store' },
            signal: AbortSignal.timeout(3000)
        })
        .then(res => {
            if (!res.ok) throw new Error("Status " + res.status);
            return res.json();
        })
        .then(data => {
            if (data && data.bookings) {
                let serverBookings = data.bookings;
                let localBookings = JSON.parse(localStorage.getItem('pujaBookings') || '[]');
                let changed = false;

                localBookings.forEach(lb => {
                    let cleanId = (lb.id || lb.bookingId || '').replace('#', '').trim();
                    if (serverBookings[cleanId] && serverBookings[cleanId].status) {
                        if (lb.status !== serverBookings[cleanId].status) {
                            lb.status = serverBookings[cleanId].status;
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    localStorage.setItem('pujaBookings', JSON.stringify(localBookings));
                    window.dispatchEvent(new CustomEvent('pujaBookingsUpdated'));
                }
            }
        })
        .catch(() => {});
    } catch(err) {}
}

// Push local bookings to MongoDB Atlas so server always has permanent records
function pushLocalBookingsToServer() {
    try {
        let bookings = JSON.parse(localStorage.getItem('pujaBookings') || '[]');
        let valid = bookings.filter(b => b && b.customerEmail !== 'arjun@example.com' && (b.bookingId || b.id));
        if (valid.length > 0) {
            const baseUrl = getEmailApiBaseUrl();
            fetch(`${baseUrl}/sync-bookings?_t=${Date.now()}`, {
                method: 'POST',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
                body: JSON.stringify({ bookings: valid }),
                signal: AbortSignal.timeout(3000)
            }).catch(() => {});
        }
    } catch(e) {}
}

// Auto-run sync on page load and storage events
if (typeof window !== 'undefined') {
    window.sendAutomatedEmail = sendAutomatedEmail;
    window.syncEmailBookingActions = syncEmailBookingActions;
    window.pushLocalBookingsToServer = pushLocalBookingsToServer;

    const isDedicatedAdmin = window.location.pathname.includes('admin');
    if (!isDedicatedAdmin) {
        window.addEventListener('storage', (e) => {
            if (e.key === 'pendingBookingEmailActions' || e.key === 'pujaBookings') syncEmailBookingActions();
        });
        window.addEventListener('load', () => {
            setTimeout(pushLocalBookingsToServer, 1000);
            setTimeout(syncEmailBookingActions, 1500);
        });
        setInterval(syncEmailBookingActions, 8000);
    }
}
