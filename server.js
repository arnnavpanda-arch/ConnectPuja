const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const path = require('path');

dotenv.config();

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// --- MONGODB CONNECTION CACHING ---
let isConnected = false;
let dbError = null;
const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState >= 1) return;
    const uri = process.env.MONGO_URI || 'mongodb+srv://bookpujaconnect_db_user:M3YQ5Vqw19a2LBVH@cluster0.b52rwhb.mongodb.net/pujaconnect?retryWrites=true&w=majority&appName=Cluster0';
    try {
        const db = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 8000,
            socketTimeoutMS: 45000,
        });
        isConnected = db.connections[0].readyState >= 1;
        dbError = null;
        console.log("✅ MongoDB Connected in Serverless Function");
    } catch (err) {
        dbError = err.message;
        isConnected = false;
        console.error("❌ MongoDB connection error:", err.message);
    }
};

app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// --- MONGOOSE SCHEMAS & MODELS ---
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, default: '' },
    state: { type: String, default: '' },
    district: { type: String, default: '' },
    city: { type: String, default: '' },
    role: { type: String, default: 'user' }
}, { timestamps: true }));

const Pandit = mongoose.models.Pandit || mongoose.model('Pandit', new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    state: { type: String, default: 'Odisha' },
    district: { type: String, default: 'Khordha' },
    city: { type: String, default: 'Bhubaneswar' },
    experience: { type: Number, default: 5 },
    bio: { type: String, default: 'Experienced Vedic Pandit performing authentic rituals.' },
    fee: { type: Number, default: 1500 },
    services: { type: [String], default: ['Satyanarayan Puja', 'Griha Pravesh', 'Ganesh Puja'] },
    status: { type: String, default: 'Pending Review' },
    verified: { type: Boolean, default: false }
}, { timestamps: true }));

const Booking = mongoose.models.Booking || mongoose.model('Booking', new mongoose.Schema({
    bookingId: { type: String, required: true, unique: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
    userName: { type: String, default: 'Customer' },
    phone: { type: String, default: '' },
    service: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, default: '10:00 AM' },
    district: { type: String, required: true },
    panditEmail: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, default: 'Confirmed' },
    fee: { type: Number, default: 1199 },
    transactionDate: { type: Date, default: Date.now }
}, { timestamps: true }));

const LongPujaRequest = mongoose.models.LongPujaRequest || mongoose.model('LongPujaRequest', new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
    userName: { type: String, default: 'Devotee' },
    phone: { type: String, default: '' },
    pujaName: { type: String, required: true },
    district: { type: String, required: true },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    totalDays: { type: Number, default: 1 },
    dailyHours: { type: Number, default: 4 },
    totalHours: { type: Number, default: 4 },
    requiredPandits: { type: Number, default: 1 },
    assignedPandits: { type: [String], default: [] },
    panditStatuses: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, default: 'Pending Admin' },
    estimatedCost: { type: Number, default: 0 },
    paid: { type: Boolean, default: false }
}, { timestamps: true }));

const Puja = mongoose.models.Puja || mongoose.model('Puja', new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    desc: { type: String, required: true },
    longDesc: { type: String, default: '' },
    image: { type: String, default: 'https://images.unsplash.com/photo-1590055531615-f16d36ffe8ce?auto=format&fit=crop&q=80&w=400' },
    benefits: { type: [String], default: [] },
    type: { type: String, default: 'Short' },
    perHourFee: { type: Number, default: 500 },
    baseFee: { type: Number, default: 1199 }
}, { timestamps: true }));

// --- NODEMAILER GMAIL SMTP ENGINE ---
const getAppPassword = () => {
    const raw = process.env.APP_PASSWORD || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || 'dcebqcsasazvyvnh';
    return raw.replace(/\s+/g, '');
};

const createTransporter = () => {
    const pass = getAppPassword();
    const user = (process.env.SENDER_EMAIL || process.env.EMAIL_USER || 'bookpujaconnect@gmail.com').trim();
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports (uses STARTTLS)
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    });
};

const sendEmail = async ({ to, subject, html }) => {
    try {
        const transporter = createTransporter();
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"PujaConnect" <bookpujaconnect@gmail.com>',
            to,
            subject,
            html
        };
        const info = await transporter.sendMail(mailOptions);
        console.log(`✉️ Email sent to: ${to} | Subject: "${subject}" | ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`❌ Mailer Error sending to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
};

// --- API ROUTES ---

// Health check
app.get('/api', (req, res) => {
    const readyState = mongoose.connection.readyState;
    const stateNames = { 0: 'Disconnected', 1: 'Connected', 2: 'Connecting', 3: 'Disconnecting' };
    res.json({
        status: 'Online',
        message: 'PujaConnect Serverless Express API running on Vercel',
        database: (readyState === 1 || isConnected) ? 'Connected' : (stateNames[readyState] || 'Offline'),
        dbError: dbError || undefined,
        timestamp: new Date().toISOString()
    });
});

// 1. AUTHENTICATION & USERS
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, state, district, city, password } = req.body;
        if (!name || !email || !phone) {
            return res.status(400).json({ success: false, message: 'Please provide name, email, and phone' });
        }
        const normalizedEmail = email.trim().toLowerCase();
        let user = await User.findOne({ $or: [{ email: normalizedEmail }, { phone: phone.trim() }] });
        if (user) {
            user.name = name || user.name;
            user.email = normalizedEmail;
            user.phone = phone.trim();
            if (state) user.state = state;
            if (district) user.district = district;
            if (city) user.city = city;
            await user.save();
        } else {
            user = await User.create({
                name,
                email: normalizedEmail,
                phone: phone.trim(),
                password: password || '',
                state: state || '',
                district: district || '',
                city: city || '',
                role: 'user'
            });
            // Send automated welcome email
            sendEmail({
                to: normalizedEmail,
                subject: 'Welcome to PujaConnect - Account Created 🙏',
                html: `<div style="font-family:Georgia,serif;padding:25px;background:#fffcf8;border:1px solid #e0d0c0;border-radius:12px;">
                    <h2 style="color:#6a1a24;">Namaste, ${name}! 🙏</h2>
                    <p>Welcome to <strong>PujaConnect</strong>. Your account has been successfully created.</p>
                </div>`
            });
        }
        res.status(201).json({ success: true, message: 'User registered successfully', user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/auth/users', async (req, res) => {
    try {
        const users = await User.find({ role: 'user' }).sort({ createdAt: -1 });
        res.json({ success: true, count: users.length, data: users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/auth/profile/:email', async (req, res) => {
    try {
        await User.findOneAndDelete({ email: req.params.email.toLowerCase() });
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. PANDITS
app.post('/api/pandits/register', async (req, res) => {
    try {
        const { name, email, phone, state, district, city, experience, bio, services, fee } = req.body;
        if (!name || !email || !phone) return res.status(400).json({ success: false, message: 'Missing fields' });
        const normalizedEmail = email.trim().toLowerCase();
        let pandit = await Pandit.findOne({ email: normalizedEmail });
        if (pandit) return res.status(400).json({ success: false, message: 'Pandit already exists' });
        pandit = await Pandit.create({
            name, email: normalizedEmail, phone: phone.trim(),
            state: state || 'Odisha', district: district || 'Khordha', city: city || 'Bhubaneswar',
            experience: Number(experience) || 5, bio: bio || '', fee: Number(fee) || 1500,
            services: Array.isArray(services) ? services : ['Satyanarayan Puja', 'Griha Pravesh'],
            status: 'Pending Review', verified: false
        });
        sendEmail({
            to: normalizedEmail,
            subject: 'Pandit Application Received - PujaConnect 🙏',
            html: `<p>Namaste Pandit ${name} Ji. Your application has been received for Admin Review.</p>`
        });
        res.status(201).json({ success: true, pandit });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/pandits', async (req, res) => {
    try {
        const pandits = await Pandit.find().sort({ createdAt: -1 });
        res.json({ success: true, count: pandits.length, data: pandits });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/pandits/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const pandit = await Pandit.findOne({
            $or: [{ _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { email: req.params.id.toLowerCase() }]
        });
        if (!pandit) return res.status(404).json({ success: false, message: 'Pandit not found' });
        pandit.status = status;
        if (status === 'Fully Verified' || status === 'Approved') pandit.verified = true;
        await pandit.save();
        res.json({ success: true, pandit });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. BOOKINGS
app.post('/api/bookings', async (req, res) => {
    try {
        const { userEmail, userName, phone, service, date, time, district, panditEmail, fee } = req.body;
        const bookingId = 'BK-' + Math.floor(1000 + Math.random() * 9000);
        const booking = await Booking.create({
            bookingId,
            userEmail: (userEmail || '').trim().toLowerCase(),
            userName: userName || 'Devotee',
            phone: phone || '',
            service,
            date,
            time: time || '10:00 AM',
            district,
            panditEmail: (panditEmail || '').trim().toLowerCase(),
            status: 'Confirmed',
            fee: Number(fee) || 1199,
            transactionDate: new Date()
        });
        sendEmail({
            to: booking.userEmail,
            subject: `Puja Booking Confirmation: ${service} (${bookingId}) 🙏`,
            html: `<p>Namaste ${userName}, your booking for ${service} on ${date} is confirmed!</p>`
        });
        res.status(201).json({ success: true, data: booking });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });
        res.json({ success: true, count: bookings.length, data: bookings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/bookings/:id', async (req, res) => {
    try {
        const booking = await Booking.findOneAndUpdate(
            { $or: [{ bookingId: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }] },
            req.body,
            { new: true }
        );
        res.json({ success: true, data: booking });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. LONG PUJAS
app.post('/api/long-pujas', async (req, res) => {
    try {
        const id = 'LP-' + Math.floor(1000 + Math.random() * 9000);
        const request = await LongPujaRequest.create({
            ...req.body,
            id,
            userEmail: (req.body.userEmail || '').trim().toLowerCase(),
            status: 'Pending Admin'
        });
        res.status(201).json({ success: true, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/long-pujas', async (req, res) => {
    try {
        const reqs = await LongPujaRequest.find().sort({ createdAt: -1 });
        res.json({ success: true, count: reqs.length, data: reqs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/long-pujas/:id', async (req, res) => {
    try {
        const updated = await LongPujaRequest.findOneAndUpdate(
            { $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }] },
            req.body,
            { new: true }
        );
        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. PUJAS
app.get('/api/pujas', async (req, res) => {
    try {
        const pujas = await Puja.find();
        res.json({ success: true, count: pujas.length, data: pujas });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/pujas', async (req, res) => {
    try {
        const puja = await Puja.create(req.body);
        res.status(201).json({ success: true, data: puja });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. DIRECT EMAIL ENDPOINT - ALL 8 AUTOMATED VEDIC EMAIL TYPES
app.post('/api/send-email', async (req, res) => {
    try {
        const { to, type, data } = req.body;
        if (!to) return res.status(400).json({ success: false, message: 'Missing recipient email' });

        let subject = (data && data.subject) || 'PujaConnect Notification';
        let html = (data && (data.html || data.message)) || `<p>PujaConnect notification for ${to}</p>`;

        if (type === 'otp') {
            const otpCode = (data && data.otp) || '1234';
            subject = `PujaConnect Login OTP: ${otpCode} 🕉️`;
            html = `
            <div style="font-family: Georgia, serif; max-width: 520px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                <div style="text-align: center; border-bottom: 2px solid #d99a19; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #6a1a24; margin: 0; font-size: 26px;">🕉️ PujaConnect</h1>
                    <p style="color: #d99a19; font-weight: bold; margin: 5px 0 0;">Secure Pandit Verification</p>
                </div>
                <h3 style="color: #6a1a24; text-align: center;">Your Login One-Time Password (OTP)</h3>
                <p style="font-size: 14px; color: #555; text-align: center;">
                    Please enter the following 4-digit verification code to securely access your Pandit Dashboard:
                </p>
                <div style="text-align: center; margin: 25px 0;">
                    <span style="font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #6a1a24; background: #fdf3e7; padding: 12px 28px; border: 2px dashed #d99a19; border-radius: 8px; display: inline-block;">
                        ${otpCode}
                    </span>
                </div>
                <p style="font-size: 12px; color: #777; text-align: center; line-height: 1.5;">
                    This OTP is valid for 10 minutes. If you did not request this login code, please ignore this email.
                </p>
                <div style="border-top: 1px solid #ebd9c8; margin-top: 25px; padding-top: 15px; text-align: center; font-size: 12px; color: #888;">
                    With Divine Blessings,<br><strong>PujaConnect Vedic Team</strong>
                </div>
            </div>`;
        } else if (type === 'booking_confirmed' || type === 'short_puja_confirmation') {
            subject = `Puja Booking Confirmation: ${data.service || 'Ceremony'} (${data.bookingId || data.id || 'Confirmed'}) 🙏`;
            html = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                <div style="text-align: center; border-bottom: 2px solid #d99a19; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #6a1a24; margin: 0; font-size: 28px;">🕉️ PujaConnect</h1>
                    <p style="color: #d99a19; font-weight: bold; margin: 5px 0 0;">Divine Ceremony Booking Confirmed</p>
                </div>
                <h2 style="color: #2e7d32;">Booking Confirmed! 🙏</h2>
                <p style="font-size: 15px; color: #444; line-height: 1.6;">
                    Namaste <strong>${data.userName || data.customerName || 'Devotee'}</strong>, your devotional booking has been successfully scheduled.
                </p>
                <div style="background: #f7ede2; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d99a19;">
                    <p style="margin: 4px 0;"><strong>Booking ID:</strong> ${data.bookingId || data.id || 'N/A'}</p>
                    <p style="margin: 4px 0;"><strong>Sacred Puja:</strong> ${data.service || 'Vedic Ritual'}</p>
                    <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${data.date || 'Scheduled'} (${data.time || '10:00 AM'})</p>
                    <p style="margin: 4px 0;"><strong>Location:</strong> ${data.district || 'Your Registered Address'}</p>
                    <p style="margin: 4px 0;"><strong>Assigned Pandit:</strong> ${data.panditName || 'Verified Pandit Ji'}</p>
                    <p style="margin: 4px 0;"><strong>Dakshina / Fee:</strong> ₹${data.fee || 1199}</p>
                </div>
                <p style="font-size: 13px; color: #666; text-align: center; margin-top: 25px;">
                    May Lord's blessings bring peace, health, and prosperity to your entire family.
                </p>
            </div>`;
        } else if (type === 'long_puja_assigned') {
            subject = `New Long Puja Assignment: ${data.pujaName} (${data.id}) 🕉️`;
            html = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                <div style="text-align: center; border-bottom: 2px solid #d99a19; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #6a1a24; margin: 0; font-size: 28px;">🕉️ PujaConnect</h1>
                    <p style="color: #d99a19; font-weight: bold; margin: 5px 0 0;">Pandit Assignment Invitation</p>
                </div>
                <h2 style="color: #6a1a24;">Namaste Pandit Ji 🙏</h2>
                <p style="font-size: 14px; color: #444; line-height: 1.6;">
                    You have been assigned to lead an auspicious Long Puja ceremony in <strong>${data.district}</strong>:
                </p>
                <div style="background: #fdf3e7; padding: 18px; border-radius: 8px; margin: 20px 0; border: 1px solid #eed6ba;">
                    <p style="margin: 4px 0;"><strong>Request ID:</strong> ${data.id}</p>
                    <p style="margin: 4px 0;"><strong>Ceremony:</strong> ${data.pujaName}</p>
                    <p style="margin: 4px 0;"><strong>Date Range:</strong> ${data.fromDate} to ${data.toDate}</p>
                    <p style="margin: 4px 0;"><strong>Daily Schedule:</strong> ${data.dailyHours || 4} hours/day (Total: ${data.totalHours || 8} hrs)</p>
                    <p style="margin: 4px 0;"><strong>Required Team:</strong> ${data.requiredPandits || 1} Pandits</p>
                </div>
                <p style="font-size: 14px; color: #555;">
                    Please log into your <strong>PujaConnect Pandit Dashboard</strong> to <strong>Accept</strong> or <strong>Decline</strong> this assignment.
                </p>
            </div>`;
        } else if (type === 'long_puja_approved') {
            subject = `Long Puja Approved & Pandits Confirmed (${data.id}) 🎉`;
            html = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                <div style="text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #6a1a24; margin: 0; font-size: 28px;">🕉️ PujaConnect</h1>
                    <p style="color: #2e7d32; font-weight: bold; margin: 5px 0 0;">Ceremony Approved & Team Assigned</p>
                </div>
                <h2 style="color: #2e7d32;">Great News! All Pandits Have Accepted 🙏</h2>
                <p style="font-size: 15px; color: #444; line-height: 1.6;">
                    Namaste <strong>${data.userName || 'Devotee'}</strong>, all ${data.requiredPandits || 1} verified Pandits have accepted your request for <strong>${data.pujaName}</strong> from <strong>${data.fromDate} to ${data.toDate}</strong>.
                </p>
                <div style="background: #eef7ee; padding: 18px; border-radius: 8px; margin: 20px 0; border: 1px solid #c8e6c9;">
                    <p style="margin: 4px 0;"><strong>Request ID:</strong> ${data.id}</p>
                    <p style="margin: 4px 0;"><strong>Total Dakshina:</strong> ₹${data.estimatedCost || 0}</p>
                    <p style="margin: 4px 0;"><strong>20% Advance Payable:</strong> ₹${Math.round((data.estimatedCost || 0) * 0.20)}</p>
                    <p style="margin: 4px 0;"><strong>Status:</strong> Approved - Ready for Advance Payment</p>
                </div>
                <p style="font-size: 14px; color: #555;">
                    Please log into your <strong>Devotee Dashboard</strong> to complete the 20% advance payment to lock in the dates.
                </p>
            </div>`;
        } else if (type === 'long_puja_rejected') {
            subject = `Update on Long Puja Request (${data.id}): No Pandits Available`;
            html = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                <div style="text-align: center; border-bottom: 2px solid #dc3545; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #6a1a24; margin: 0; font-size: 28px;">🕉️ PujaConnect</h1>
                </div>
                <h2 style="color: #dc3545;">No Pandits Available for Requested Dates</h2>
                <p style="font-size: 14px; color: #444; line-height: 1.6;">
                    Namaste <strong>${data.userName || 'Devotee'}</strong>, we regret to inform you that verified Pandits are currently unavailable in <strong>${data.district}</strong> for the dates <strong>${data.fromDate} to ${data.toDate}</strong>.
                </p>
                <p style="font-size: 13px; color: #666;">
                    We sincerely apologize for the inconvenience. You may submit a new request with alternative dates from your dashboard.
                </p>
            </div>`;
        } else if (type === 'payment_receipt') {
            subject = `Payment Receipt: ${data.pujaName || 'Ceremony'} (₹${data.estimatedCost || data.fee || 0}) 🧾`;
            html = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                <div style="text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #6a1a24; margin: 0; font-size: 28px;">🕉️ PujaConnect</h1>
                    <p style="color: #2e7d32; font-weight: bold; margin: 5px 0 0;">Official Payment Receipt</p>
                </div>
                <h2 style="color: #2e7d32;">Payment Received Successfully! 🎉</h2>
                <div style="background: #eef7ee; padding: 18px; border-radius: 8px; margin: 20px 0; border: 1px solid #c2e0c2;">
                    <p style="margin: 4px 0;"><strong>Receipt ID:</strong> RCP-${data.id || Math.floor(1000 + Math.random() * 9000)}</p>
                    <p style="margin: 4px 0;"><strong>Ceremony:</strong> ${data.pujaName || data.service || 'Puja'}</p>
                    <p style="margin: 4px 0;"><strong>Amount Paid:</strong> ₹${data.estimatedCost || data.fee || 0}</p>
                    <p style="margin: 4px 0;"><strong>Payment Status:</strong> Verified & Confirmed</p>
                </div>
            </div>`;
        } else if (type === 'pandit_approved' || type === 'pandit_verification') {
            subject = 'Stage 1 Approved: Please Upload Documents - PujaConnect 🙏';
            html = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                <div style="text-align: center; border-bottom: 2px solid #d99a19; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #6a1a24; margin: 0; font-size: 28px;">🕉️ PujaConnect</h1>
                    <p style="color: #d99a19; font-weight: bold; margin: 5px 0 0;">Stage 1 Pandit Screening Approved</p>
                </div>
                <h2 style="color: #6a1a24;">Namaste Pandit ${(data && data.name) || 'Ji'} 🙏</h2>
                <p style="font-size: 14px; color: #444; line-height: 1.6;">
                    Congratulations! Your initial screening has been approved by the PujaConnect Admin Team.
                </p>
                <div style="background: #fdf3e7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d99a19;">
                    <p style="margin: 0; font-size: 14px; color: #6a1a24;">
                        Please log into your <strong>Pandit Dashboard</strong> to upload your <strong>Passport Photo</strong> and <strong>Identity Proof (Aadhaar/PAN)</strong> for final verification.
                    </p>
                </div>
            </div>`;
        } else if (type === 'welcome') {
            subject = 'Welcome to PujaConnect - Account Created 🙏';
            html = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                <div style="text-align: center; border-bottom: 2px solid #d99a19; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #6a1a24; margin: 0; font-size: 28px;">🕉️ PujaConnect</h1>
                    <p style="color: #d99a19; font-weight: bold; margin: 5px 0 0;">Divine Vedic Rituals at Your Doorstep</p>
                </div>
                <h2 style="color: #6a1a24;">Namaste, ${(data && data.name) || 'Devotee'}! 🙏</h2>
                <p style="font-size: 15px; color: #444; line-height: 1.6;">
                    Welcome to <strong>PujaConnect</strong>. Your account has been successfully created. You can now explore sacred pujas and book authentic Vedic ceremonies seamlessly.
                </p>
            </div>`;
        }

        const result = await sendEmail({ to, subject, html });
        if (result && result.success === false) {
            return res.status(502).json({ success: false, error: result.error });
        }
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Serve index.html for root and all non-API frontend routes (prevents 'Cannot GET /')
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback error handler
app.use((err, req, res, next) => {
    console.error("Global API Error:", err.stack);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// Start local port if run directly via `node server.js`
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 PujaConnect server running on port ${PORT}`));
}

module.exports = app;
