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
        port: 465,
        secure: true,
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

// 6. DIRECT EMAIL ENDPOINT
app.post('/api/send-email', async (req, res) => {
    try {
        const { to, type, data } = req.body;
        if (!to) return res.status(400).json({ success: false, message: 'Missing recipient email' });

        let subject = (data && data.subject) || 'PujaConnect Notification';
        let html = (data && (data.html || data.message)) || `<p>PujaConnect notification for ${to}</p>`;

        if (type === 'otp') {
            subject = `PujaConnect Login OTP: ${(data && data.otp) || '1234'}`;
            html = `<div style="font-family:Georgia,serif;padding:25px;border:1px solid #d99a19;border-radius:12px;text-align:center;">
                <h1 style="color:#6a1a24;">🕉️ PujaConnect</h1>
                <h3>Your Login One-Time Password (OTP)</h3>
                <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#6a1a24;margin:20px 0;">${(data && data.otp) || '1234'}</div>
                <p>Valid for 10 minutes.</p>
            </div>`;
        } else if (type === 'welcome') {
            subject = 'Welcome to PujaConnect 🙏';
            html = `<p>Namaste ${(data && data.name) || 'Devotee'}, welcome to PujaConnect!</p>`;
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
