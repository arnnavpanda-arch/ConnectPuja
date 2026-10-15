/**
 * PujaConnect Automated Email Helper
 * Sends real automated emails through the backend Gmail SMTP engine (bookpujaconnect@gmail.com)
 */

function sendAutomatedEmail(toEmail, type, data = {}) {
    if (!toEmail) return Promise.resolve(null);
    
    console.log(`[PujaConnect Mailer] Dispatching ${type} email to: ${toEmail}...`);
    
    return fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    // 1. Process any local storage pending actions
    try {
        let actions = JSON.parse(localStorage.getItem('pendingBookingEmailActions') || '[]');
        if (actions.length > 0) {
            let bookings = JSON.parse(localStorage.getItem('pujaBookings') || '[]');
            let changed = false;

            actions.forEach(act => {
                let targetId = (act.cleanId || act.id || '').replace('#', '').trim();
                let idx = bookings.findIndex(b => (b.id || '').replace('#', '').trim() === targetId);
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

    // 2. Fetch server-side confirmed actions/bookings (with 2.5s timeout)
    try {
        fetch('/api/booking-updates', { signal: AbortSignal.timeout(2500) })
            .then(res => {
                if (!res.ok) throw new Error("Status " + res.status);
                return res.json();
            })
            .then(data => {
                let serverBookings = data.bookings || {};
                let serverActions = data.actions || [];
                let localBookings = JSON.parse(localStorage.getItem('pujaBookings') || '[]');
                let changed = false;

                localBookings.forEach(lb => {
                    let cleanId = (lb.id || '').replace('#', '').trim();
                    if (serverBookings[cleanId] && serverBookings[cleanId].status) {
                        if (lb.status !== serverBookings[cleanId].status) {
                            lb.status = serverBookings[cleanId].status;
                            changed = true;
                        }
                    } else {
                        let act = serverActions.slice().reverse().find(a => (a.cleanId || a.id || '').replace('#', '').trim() === cleanId);
                        if (act && act.status && lb.status !== act.status) {
                            lb.status = act.status;
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    localStorage.setItem('pujaBookings', JSON.stringify(localBookings));
                    window.dispatchEvent(new CustomEvent('pujaBookingsUpdated'));
                }
            })
            .catch(() => {});
    } catch(err) {}
}

// Push local bookings to server store so server always has customer emails
function pushLocalBookingsToServer() {
    try {
        let bookings = JSON.parse(localStorage.getItem('pujaBookings') || '[]');
        if (bookings.length > 0) {
            fetch('/api/sync-bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookings: bookings }),
                signal: AbortSignal.timeout(2500)
            }).catch(() => {});
        }
    } catch(e) {}
}

// Auto-run sync on page load and storage events (only on main customer / pandit views, never block admin)
if (typeof window !== 'undefined') {
    const isDedicatedAdmin = window.location.pathname.includes('admin');
    if (!isDedicatedAdmin) {
        window.addEventListener('storage', (e) => {
            if (e.key === 'pendingBookingEmailActions' || e.key === 'pujaBookings') syncEmailBookingActions();
        });
        window.addEventListener('load', () => {
            setTimeout(pushLocalBookingsToServer, 1000);
            setTimeout(syncEmailBookingActions, 1200);
        });
        setInterval(syncEmailBookingActions, 8000); // polite 8-second background sync
    }
}

window.sendAutomatedEmail = sendAutomatedEmail;
window.syncEmailBookingActions = syncEmailBookingActions;
window.pushLocalBookingsToServer = pushLocalBookingsToServer;
