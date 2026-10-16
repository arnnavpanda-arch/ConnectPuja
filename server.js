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

// --- ANTI-CACHING HEADERS FOR ALL API ENDPOINTS ---
// Prevents mobile browsers, WebViews, and Vercel Edge from serving stale cached data
app.use('/api', (req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
});

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
    location: { type: String, default: 'Bhubaneswar, Odisha' },
    workingState: { type: String, default: 'Odisha' },
    workingDistricts: { type: [String], default: ['Khordha'] },
    experience: { type: Number, default: 5 },
    exp: { type: String, default: '5+ Years' },
    specialty: { type: String, default: 'Vedic Rituals' },
    bio: { type: String, default: 'Experienced Vedic Pandit performing authentic rituals.' },
    fee: { type: Number, default: 1500 },
    services: { type: [String], default: ['Satyanarayan Puja', 'Griha Pravesh', 'Ganesh Puja'] },
    availableDays: { type: [String], default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    daySlots: { type: mongoose.Schema.Types.Mixed, default: {} },
    timeSlots: { type: [String], default: ["08:00 AM - 11:00 AM", "04:00 PM - 07:00 PM"] },
    districtPrices: { type: mongoose.Schema.Types.Mixed, default: {} },
    photo: { type: String, default: 'https://images.unsplash.com/photo-1544168190-79c15427015f?auto=format&fit=crop&q=80&w=200' },
    documentUrl: { type: String, default: '' },
    idDoc: { type: String, default: '' },
    status: { type: String, default: 'Pending Review' },
    verified: { type: Boolean, default: false }
}, { timestamps: true }));

const Booking = mongoose.models.Booking || mongoose.model('Booking', new mongoose.Schema({
    bookingId: { type: String, required: true, unique: true },
    id: { type: String },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
    customerEmail: { type: String, lowercase: true, trim: true },
    userName: { type: String, default: 'Customer' },
    customerName: { type: String, default: 'Customer' },
    phone: { type: String, default: '' },
    service: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, default: '10:00 AM' },
    district: { type: String, required: true },
    panditEmail: { type: String, required: true, lowercase: true, trim: true },
    panditName: { type: String, default: 'Assigned Pandit' },
    status: { type: String, default: 'Confirmed' },
    fee: { type: Number, default: 1199 },
    advancePaid: { type: Boolean, default: false },
    advanceAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, default: 'Pending' },
    bookingType: { type: String, default: 'Standard' },
    transactionDate: { type: Date, default: Date.now }
}, { timestamps: true }));

const LongPujaRequest = mongoose.models.LongPujaRequest || mongoose.model('LongPujaRequest', new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
    userId: { type: String, lowercase: true, trim: true },
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
    paid: { type: Boolean, default: false },
    advancePaid: { type: Boolean, default: false },
    advanceAmount: { type: Number, default: 0 },
    submittedAt: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true }));

const Puja = mongoose.models.Puja || mongoose.model('Puja', new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    desc: { type: String, required: true },
    longDesc: { type: String, default: '' },
    image: { type: String, default: 'https://images.unsplash.com/photo-1590055531615-f16d36ffe8ce?auto=format&fit=crop&q=80&w=400' },
    benefits: { type: [String], default: [] },
    type: { type: String, default: 'Short' },
    perHourFee: { type: Number, default: 500 },
    baseFee: { type: Number, default: 1199 },
    price: { type: String, default: '₹1,199' }
}, { timestamps: true }));

const AppSetting = mongoose.models.AppSetting || mongoose.model('AppSetting', new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed }
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

const DEFAULT_SEED_PANDITS = [
    {
        name: "Pandit Ramesh Sharma",
        email: "ramesh@example.com",
        phone: "+91 98765 43210",
        state: "Odisha",
        district: "Khordha",
        city: "Bhubaneswar",
        location: "Bhubaneswar, Odisha",
        workingState: "Odisha",
        workingDistricts: ["Khordha", "Cuttack", "Puri"],
        experience: 12,
        exp: "12+ Years",
        specialty: "Marriage, Satyanarayan",
        bio: "Specializing in Vedic Vivah Samskar and Satyanarayan Katha with authentic mantras.",
        fee: 1500,
        services: ["Satyanarayan Puja", "Griha Pravesh", "Marriage Puja", "Ganesh Puja"],
        status: "Fully Verified",
        verified: true,
        photo: "https://images.unsplash.com/photo-1544168190-79c15427015f?auto=format&fit=crop&q=80&w=200"
    },
    {
        name: "Pandit Rajesh Mishra",
        email: "rajesh@example.com",
        phone: "+91 98765 43211",
        state: "Maharashtra",
        district: "Mumbai City",
        city: "Mumbai",
        location: "Mumbai, Maharashtra",
        workingState: "Maharashtra",
        workingDistricts: ["Mumbai City", "Mumbai Suburban", "Pune"],
        experience: 15,
        exp: "15+ Years",
        specialty: "Griha Pravesh",
        bio: "Expert in Vastu Shanti and Griha Pravesh rituals.",
        fee: 2100,
        services: ["Griha Pravesh", "Rudrabhishek", "Ganesh Puja", "Satyanarayan Puja"],
        status: "Fully Verified",
        verified: true,
        photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200"
    },
    {
        name: "Pandit Suresh Acharya",
        email: "suresh@example.com",
        phone: "+91 98765 43212",
        state: "Odisha",
        district: "Puri",
        city: "Puri",
        location: "Puri, Odisha",
        workingState: "Odisha",
        workingDistricts: ["Puri", "Khordha"],
        experience: 18,
        exp: "18+ Years",
        specialty: "Rudrabhishek & Havans",
        bio: "Temple priest with extensive knowledge of Rudrabhishek and Vedic Yagnas.",
        fee: 1800,
        services: ["Rudrabhishek", "Satyanarayan Puja", "Namkaran Sanskar"],
        status: "Fully Verified",
        verified: true,
        photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200"
    }
];

app.get('/api/pandits', async (req, res) => {
    try {
        let pandits = await Pandit.find().sort({ createdAt: -1 });
        if (!pandits || pandits.length === 0) {
            await Pandit.insertMany(DEFAULT_SEED_PANDITS);
            pandits = await Pandit.find().sort({ createdAt: -1 });
        }
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
        const {
            userEmail, userName, customerEmail, customerName,
            phone, service, date, time, district,
            panditEmail, panditName, fee, status,
            bookingType, advancePaid, advanceAmount, paymentStatus,
            bookingId: customBookingId, id: customId
        } = req.body;

        const bookingId = customBookingId || customId || ('PC-' + Math.floor(1000 + Math.random() * 9000));
        const effectiveUserEmail = (userEmail || customerEmail || '').trim().toLowerCase();
        const effectiveUserName = (userName || customerName || 'Devotee').trim();
        const effectivePanditEmail = (panditEmail || '').trim().toLowerCase();
        const effectiveStatus = status || 'Pending Pandit';

        // Upsert so re-submitting or re-syncing updates cleanly
        let booking = await Booking.findOne({ $or: [{ bookingId }, { id: bookingId }] });
        if (booking) {
            booking.userEmail = effectiveUserEmail || booking.userEmail;
            booking.customerEmail = effectiveUserEmail || booking.customerEmail;
            booking.userName = effectiveUserName || booking.userName;
            booking.customerName = effectiveUserName || booking.customerName;
            booking.phone = phone || booking.phone;
            booking.service = service || booking.service;
            booking.date = date || booking.date;
            booking.time = time || booking.time;
            booking.district = district || booking.district;
            booking.panditEmail = effectivePanditEmail || booking.panditEmail;
            booking.panditName = panditName || booking.panditName;
            booking.fee = Number(fee) || booking.fee;
            if (status) booking.status = status;
            if (bookingType) booking.bookingType = bookingType;
            if (advancePaid !== undefined) booking.advancePaid = advancePaid;
            if (advanceAmount !== undefined) booking.advanceAmount = advanceAmount;
            if (paymentStatus) booking.paymentStatus = paymentStatus;
            await booking.save();
        } else {
            booking = await Booking.create({
                bookingId,
                id: bookingId,
                userEmail: effectiveUserEmail,
                customerEmail: effectiveUserEmail,
                userName: effectiveUserName,
                customerName: effectiveUserName,
                phone: phone || '',
                service: service || 'Vedic Ritual',
                date: date || new Date().toISOString().split('T')[0],
                time: time || '10:00 AM',
                district: district || 'Khordha',
                panditEmail: effectivePanditEmail,
                panditName: panditName || 'Assigned Pandit',
                status: effectiveStatus,
                fee: Number(fee) || 1199,
                bookingType: bookingType || 'Standard',
                advancePaid: advancePaid || false,
                advanceAmount: advanceAmount || 0,
                paymentStatus: paymentStatus || 'Pending',
                transactionDate: new Date()
            });
        }

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

app.get('/api/bookings/user/:email', async (req, res) => {
    try {
        const email = req.params.email.trim().toLowerCase();
        const bookings = await Booking.find({
            $or: [{ userEmail: email }, { customerEmail: email }]
        }).sort({ createdAt: -1 });
        res.json({ success: true, count: bookings.length, data: bookings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/bookings/pandit/:email', async (req, res) => {
    try {
        const email = req.params.email.trim().toLowerCase();
        const bookings = await Booking.find({ panditEmail: email }).sort({ createdAt: -1 });
        res.json({ success: true, count: bookings.length, data: bookings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/bookings/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const booking = await Booking.findOneAndUpdate(
            { $or: [{ bookingId: id }, { id: id }, { _id: mongoose.isValidObjectId(id) ? id : null }] },
            { $set: req.body },
            { new: true }
        );
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        res.json({ success: true, data: booking });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await Booking.findOneAndDelete({
            $or: [{ bookingId: id }, { id: id }, { _id: mongoose.isValidObjectId(id) ? id : null }]
        });
        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Batch booking sync endpoint for safe migration from localStorage
app.post('/api/sync-bookings', async (req, res) => {
    try {
        const list = Array.isArray(req.body.bookings) ? req.body.bookings : (Array.isArray(req.body) ? req.body : []);
        let synced = 0;
        for (const b of list) {
            const bId = b.bookingId || b.id || ('PC-' + Math.floor(1000 + Math.random() * 9000));
            const email = (b.userEmail || b.customerEmail || '').trim().toLowerCase();
            if (!email) continue;
            await Booking.findOneAndUpdate(
                { $or: [{ bookingId: bId }, { id: bId }] },
                {
                    $setOnInsert: {
                        bookingId: bId,
                        id: bId,
                        userEmail: email,
                        customerEmail: email,
                        userName: b.userName || b.customerName || 'Devotee',
                        customerName: b.userName || b.customerName || 'Devotee',
                        phone: b.phone || '',
                        service: b.service || 'Vedic Ritual',
                        date: b.date || new Date().toISOString().split('T')[0],
                        time: b.time || '10:00 AM',
                        district: b.district || 'Khordha',
                        panditEmail: (b.panditEmail || '').trim().toLowerCase(),
                        panditName: b.panditName || 'Assigned Pandit',
                        status: b.status || 'Pending Pandit',
                        fee: Number(b.fee) || 1199,
                        paymentStatus: b.paymentStatus || 'Pending',
                        advancePaid: b.advancePaid || false,
                        bookingType: b.bookingType || 'Standard',
                        transactionDate: b.transactionDate || new Date()
                    }
                },
                { upsert: true, new: true }
            );
            synced++;
        }
        res.json({ success: true, synced });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/booking-updates', async (req, res) => {
    try {
        const all = await Booking.find().sort({ updatedAt: -1 });
        const map = {};
        all.forEach(b => {
            const key = b.bookingId || b.id;
            if (key) map[key] = b;
        });
        res.json({ success: true, bookings: map, list: all });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Pandit 1-Click Accept / Reject from Email Link
app.get('/api/booking-response', async (req, res) => {
    try {
        const { id, action } = req.query;
        if (!id || !action) {
            return res.status(400).send('<h2 style="font-family:Georgia,serif;text-align:center;color:#b71c1c;margin-top:50px;">Invalid Booking Response Link</h2>');
        }
        const cleanId = id.replace('#', '').trim();
        const booking = await Booking.findOne({
            $or: [{ bookingId: cleanId }, { id: cleanId }, { _id: mongoose.isValidObjectId(cleanId) ? cleanId : null }]
        });
        if (!booking) {
            return res.status(404).send('<h2 style="font-family:Georgia,serif;text-align:center;color:#b71c1c;margin-top:50px;">Booking Not Found</h2><p style="text-align:center;font-family:Georgia,serif;">This booking may have already been rescheduled or updated.</p>');
        }

        const isAccept = action.toLowerCase() === 'accept';
        booking.status = isAccept ? 'Accepted' : 'Rejected';
        await booking.save();

        const devoteeEmail = booking.userEmail || booking.customerEmail;
        if (devoteeEmail) {
            if (isAccept) {
                sendEmail({
                    to: devoteeEmail,
                    subject: `Puja Booking Accepted: ${booking.service} (${booking.bookingId}) 🙏`,
                    html: `
                    <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                        <div style="text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 15px; margin-bottom: 20px;">
                            <h1 style="color: #6a1a24; margin: 0; font-size: 26px;">🕉️ PujaConnect</h1>
                            <p style="color: #2e7d32; font-weight: bold; margin: 5px 0 0;">Booking Accepted by Pandit Ji</p>
                        </div>
                        <h2 style="color: #2e7d32;">Auspicious Update: Booking Confirmed! 🙏</h2>
                        <p style="font-size: 15px; line-height: 1.6;">Namaste <strong>${booking.userName || 'Devotee'}</strong>,</p>
                        <p style="font-size: 15px; line-height: 1.6;">Pandit <strong>${booking.panditName || 'Assigned Pandit'}</strong> has officially accepted your puja request for <strong>${booking.service}</strong> on <strong>${booking.date} at ${booking.time || '10:00 AM'}</strong> in <strong>${booking.district}</strong>.</p>
                        <div style="background: #eef7ee; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #c8e6c9;">
                            <p style="margin: 4px 0;"><strong>Booking ID:</strong> ${booking.bookingId}</p>
                            <p style="margin: 4px 0;"><strong>Dakshina / Fee:</strong> ₹${booking.fee}</p>
                            <p style="margin: 4px 0;"><strong>Status:</strong> Accepted</p>
                        </div>
                        <p style="font-size: 13px; color: #666;">Please log into your Devotee Dashboard to view complete details.</p>
                    </div>`
                });
            } else {
                sendEmail({
                    to: devoteeEmail,
                    subject: `Puja Booking Update: ${booking.service} (${booking.bookingId})`,
                    html: `
                    <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                        <h2 style="color: #c62828;">Pandit Unavailable for Requested Slot</h2>
                        <p>Namaste <strong>${booking.userName || 'Devotee'}</strong>,</p>
                        <p>The assigned Pandit was unavailable for <strong>${booking.service}</strong> on <strong>${booking.date}</strong>. Our Admin team has been notified and will reassign another verified Vedic Pandit shortly.</p>
                    </div>`
                });
            }
        }

        const actionText = isAccept ? 'Accepted' : 'Rejected';
        const color = isAccept ? '#2e7d32' : '#c62828';
        const icon = isAccept ? '✅' : '❌';

        res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PujaConnect | Booking ${actionText}</title>
            <style>
                body { font-family: Georgia, serif; background: #fff8ed; color: #3b2115; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
                .card { background: white; max-width: 500px; width: 100%; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-align: center; border: 1px solid #e8dbcc; }
                .icon { font-size: 54px; margin-bottom: 12px; }
                h1 { color: ${color}; margin: 0 0 10px; font-size: 26px; }
                p { font-size: 15px; line-height: 1.6; color: #555; }
                .details { background: #faf4ec; border-radius: 10px; padding: 16px; margin: 20px 0; text-align: left; font-size: 14px; border-left: 4px solid #d99a19; }
                .details p { margin: 6px 0; color: #333; }
                .btn { display: inline-block; background: #351605; color: #d99a19; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin-top: 15px; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">${icon}</div>
                <h1>Booking ${actionText}!</h1>
                <p>Namaste Pandit Ji, your response for booking <strong>#${booking.bookingId}</strong> has been saved directly to MongoDB Atlas.</p>
                <div class="details">
                    <p><strong>Ceremony:</strong> ${booking.service}</p>
                    <p><strong>Devotee:</strong> ${booking.userName || 'Devotee'}</p>
                    <p><strong>Date & Time:</strong> ${booking.date} at ${booking.time || '10:00 AM'}</p>
                    <p><strong>Location:</strong> ${booking.district}</p>
                    <p><strong>Dakshina:</strong> ₹${booking.fee}</p>
                    <p><strong>Status:</strong> <span style="color:${color};font-weight:bold;">${actionText}</span></p>
                </div>
                <p>The Devotee and Admin Dashboards across all devices have been updated automatically in real-time.</p>
                <a href="/#pandit-dashboard" class="btn">Open Pandit Dashboard</a>
            </div>
        </body>
        </html>
        `);
    } catch (err) {
        res.status(500).send('<h2 style="font-family:Georgia,serif;text-align:center;color:#b71c1c;margin-top:50px;">Error processing request</h2><p style="text-align:center;">' + err.message + '</p>');
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
        let pujas = await Puja.find();
        if (!pujas || pujas.length === 0) {
            // Seed defaults into MongoDB if collection is empty
            const DEFAULT_SEED_PUJAS = [
                { name: "Satyanarayan Puja", desc: "A powerful puja dedicated to Lord Vishnu for peace, prosperity, and resolving life's difficulties.", image: "https://images.unsplash.com/photo-1574765314051-54c2560b0e51?auto=format&fit=crop&q=80&w=400", longDesc: "This sacred ritual brings peace, prosperity, and spiritual upliftment to your home and family. Performed with strict adherence to Vedic traditions.", benefits: ["Removes obstacles and negative energies", "Brings harmony, health, and wealth", "Purifies the mind"], type: "Short", price: "₹1,499" },
                { name: "Griha Pravesh", desc: "Purify your new home and invite positive energy before moving in.", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=400", longDesc: "Griha Pravesh ensures a highly positive vibration for your new dwelling, driving away negative energies.", benefits: ["Ensures peace and happiness in the new house", "Protects from evil forces"], type: "Short", price: "₹2,499" },
                { name: "Ganesh Puja", desc: "Seek the blessings of Lord Ganesha for success and removing obstacles before any new beginning.", image: "https://images.unsplash.com/photo-1563248881-81d39d919bb1?auto=format&fit=crop&q=80&w=400", longDesc: "Lord Ganesha is revered as the remover of obstacles. This Puja paves the way for success.", benefits: ["Removes all hurdles", "Ensures successful completion of tasks"], type: "Short", price: "₹1,199" },
                { name: "Rudrabhishek", desc: "A sacred bath offered to Lord Shiva for spiritual upliftment and fulfillment of desires.", image: "https://images.unsplash.com/photo-1620023024823-388b7ccbc0c7?auto=format&fit=crop&q=80&w=400", longDesc: "Rudrabhishek is a highly potent ritual performed for Lord Shiva, involving the offering of Panchamrut.", benefits: ["Grants spiritual peace", "Cures severe ailments and karma doshas"], type: "Short", price: "₹2,100" },
                { name: "Marriage Puja", desc: "Traditional Vedic wedding rituals performed with absolute authenticity.", image: "https://images.unsplash.com/photo-1583089892943-e02e52f17806?auto=format&fit=crop&q=80&w=400", longDesc: "Experience a fully authentic Vedic Marriage Puja tailored to strict scriptural guidelines.", benefits: ["Blesses the couple with a long, happy married life", "Aligns planetary influences for marital bliss"], type: "Long", perHourFee: 600, price: "₹5,999" },
                { name: "Namkaran Sanskar", desc: "Auspicious naming ceremony for your newborn to ensure a blessed life.", image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&q=80&w=400", longDesc: "A child's name defines their future. The Namkaran Sanskar seeks divine blessings for the newborn.", benefits: ["Confers positive energy to the baby's name", "Invokes blessings of family deities"], type: "Short", price: "₹1,499" }
            ];
            await Puja.insertMany(DEFAULT_SEED_PUJAS);
            pujas = await Puja.find();
        }
        res.json({ success: true, count: pujas.length, data: pujas });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/pujas', async (req, res) => {
    try {
        const { name } = req.body;
        const existing = await Puja.findOne({ name });
        if (existing) {
            Object.assign(existing, req.body);
            await existing.save();
            return res.json({ success: true, data: existing });
        }
        const puja = await Puja.create(req.body);
        res.status(201).json({ success: true, data: puja });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/pujas/:id', async (req, res) => {
    try {
        const puja = await Puja.findOneAndUpdate(
            { $or: [{ _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { name: req.params.id }] },
            req.body,
            { new: true, upsert: true }
        );
        res.json({ success: true, data: puja });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/pujas/:id', async (req, res) => {
    try {
        await Puja.findOneAndDelete({
            $or: [{ _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { name: req.params.id }]
        });
        res.json({ success: true, message: 'Puja deleted from MongoDB' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5b. PANDIT PROFILE & AVAILABILITY / PRICING DIRECT MONGODB UPDATES
app.put('/api/pandits/:email', async (req, res) => {
    try {
        const normalizedEmail = req.params.email.toLowerCase().trim();
        const updated = await Pandit.findOneAndUpdate(
            { email: normalizedEmail },
            { $set: req.body },
            { new: true, upsert: true }
        );
        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5c. SETTINGS & APPROVED LOCATIONS DIRECT MONGODB STORAGE
const DEFAULT_LOCATIONS = {
    "Odisha": ["Khordha", "Cuttack", "Puri", "Ganjam", "Sambalpur", "Balasore"],
    "Maharashtra": ["Mumbai City", "Mumbai Suburban", "Pune", "Thane", "Nagpur"],
    "Delhi": ["New Delhi", "Central Delhi", "South Delhi", "North Delhi"],
    "Karnataka": ["Bengaluru Urban", "Bengaluru Rural", "Mysuru"],
    "West Bengal": ["Kolkata", "Howrah", "North 24 Parganas"]
};

app.get('/api/settings/:key', async (req, res) => {
    try {
        let setting = await AppSetting.findOne({ key: req.params.key });
        if (!setting && req.params.key === 'locations') {
            setting = await AppSetting.create({ key: 'locations', value: DEFAULT_LOCATIONS });
        }
        res.json({ success: true, data: setting ? setting.value : null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/settings/:key', async (req, res) => {
    try {
        const setting = await AppSetting.findOneAndUpdate(
            { key: req.params.key },
            { key: req.params.key, value: req.body.value },
            { new: true, upsert: true }
        );
        res.json({ success: true, data: setting.value });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. DIRECT EMAIL ENDPOINT - ALL AUTOMATED VEDIC EMAIL TYPES
app.post('/api/send-email', async (req, res) => {
    try {
        const { to, type, data } = req.body;
        if (!to) return res.status(400).json({ success: false, message: 'Missing recipient email' });

        let subject = (data && data.subject) || 'PujaConnect Notification';
        let html = (data && (data.html || data.message)) || `<p>PujaConnect notification for ${to}</p>`;

        if (type === 'booking_requested' || type === 'new_booking_request') {
            const bId = (data && (data.bookingId || data.id)) || 'N/A';
            const siteUrl = process.env.BASE_URL || 'https://connect-puja.vercel.app';
            const acceptUrl = `${siteUrl}/api/booking-response?id=${encodeURIComponent(bId)}&action=accept`;
            const rejectUrl = `${siteUrl}/api/booking-response?id=${encodeURIComponent(bId)}&action=reject`;
            subject = `New Booking Request: ${(data && data.service) || 'Puja'} (${bId}) - 1-Click Accept/Reject 🙏`;
            html = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                <div style="text-align: center; border-bottom: 2px solid #d99a19; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #6a1a24; margin: 0; font-size: 28px;">🕉️ PujaConnect</h1>
                    <p style="color: #d99a19; font-weight: bold; margin: 5px 0 0;">New Puja Booking Offer</p>
                </div>
                <h2 style="color: #6a1a24;">Namaste Pandit Ji 🙏</h2>
                <p style="font-size: 15px; line-height: 1.6; color: #444;">
                    A devotee has chosen you to perform an auspicious ceremony. Please review the details below and respond with 1-Click:
                </p>
                <div style="background: #fdf3e7; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d99a19;">
                    <p style="margin: 5px 0;"><strong>Booking ID:</strong> #${bId}</p>
                    <p style="margin: 5px 0;"><strong>Devotee:</strong> ${(data && (data.customerName || data.userName)) || 'Devotee'}</p>
                    <p style="margin: 5px 0;"><strong>Contact Phone:</strong> ${(data && data.phone) || 'Available in Dashboard'}</p>
                    <p style="margin: 5px 0;"><strong>Ceremony:</strong> ${(data && data.service) || 'Vedic Ritual'}</p>
                    <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${(data && data.date) || 'TBD'} at ${(data && data.time) || '10:00 AM'}</p>
                    <p style="margin: 5px 0;"><strong>Location:</strong> ${(data && data.district) || 'Odisha'}</p>
                    <p style="margin: 5px 0; font-size: 16px; color: #2e7d32;"><strong>Dakshina / Fee:</strong> ₹${(data && data.fee) || 1199}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${acceptUrl}" style="display: inline-block; background: #2e7d32; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px; margin-right: 15px; box-shadow: 0 4px 10px rgba(46,125,50,0.3);">
                        ✓ 1-Click Accept
                    </a>
                    <a href="${rejectUrl}" style="display: inline-block; background: #c62828; color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 10px rgba(198,40,40,0.3);">
                        ✕ Reject
                    </a>
                </div>
                <p style="font-size: 12px; color: #777; text-align: center; line-height: 1.5;">
                    Clicking Accept will immediately confirm this booking in MongoDB Atlas and notify the devotee across all devices.
                </p>
                <div style="border-top: 1px solid #ebd9c8; margin-top: 25px; padding-top: 15px; text-align: center; font-size: 12px; color: #888;">
                    With Divine Blessings,<br><strong>PujaConnect Vedic Team</strong>
                </div>
            </div>`;
        } else if (type === 'booking_accepted') {
            subject = `Booking Accepted by Pandit: ${(data && data.service) || 'Ceremony'} (${(data && (data.bookingId || data.id)) || 'Confirmed'}) 🙏`;
            html = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                <div style="text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #6a1a24; margin: 0; font-size: 28px;">🕉️ PujaConnect</h1>
                    <p style="color: #2e7d32; font-weight: bold; margin: 5px 0 0;">Pandit Accepted Offer</p>
                </div>
                <h2 style="color: #2e7d32;">Auspicious News! Booking Accepted 🙏</h2>
                <p style="font-size: 15px; line-height: 1.6; color: #444;">
                    Namaste <strong>${(data && (data.customerName || data.userName)) || 'Devotee'}</strong>, your booking for <strong>${(data && data.service) || 'Puja'}</strong> on <strong>${(data && data.date) || ''} at ${(data && data.time) || '10:00 AM'}</strong> has been officially accepted by Pandit <strong>${(data && data.panditName) || 'Assigned Pandit'}</strong>.
                </p>
                <div style="background: #eef7ee; padding: 18px; border-radius: 8px; margin: 20px 0; border: 1px solid #c8e6c9;">
                    <p style="margin: 4px 0;"><strong>Booking ID:</strong> #${(data && (data.bookingId || data.id)) || 'N/A'}</p>
                    <p style="margin: 4px 0;"><strong>Pandit Name:</strong> ${(data && data.panditName) || 'Assigned Pandit'}</p>
                    <p style="margin: 4px 0;"><strong>Pandit Phone:</strong> ${(data && data.panditPhone) || 'Available in Dashboard'}</p>
                    <p style="margin: 4px 0;"><strong>Dakshina / Fee:</strong> ₹${(data && data.fee) || 1199}</p>
                    <p style="margin: 4px 0;"><strong>Status:</strong> Accepted</p>
                </div>
                <p style="font-size: 13px; color: #666; text-align: center;">
                    Please log into your Devotee Dashboard to prepare for your sacred ceremony.
                </p>
            </div>`;
        } else if (type === 'booking_rejected') {
            subject = `Update on Booking Request: ${(data && data.service) || 'Ceremony'} (${(data && (data.bookingId || data.id)) || ''})`;
            html = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e0d0c0; border-radius: 12px; background: #fffcf8;">
                <div style="text-align: center; border-bottom: 2px solid #dc3545; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #6a1a24; margin: 0; font-size: 28px;">🕉️ PujaConnect</h1>
                </div>
                <h2 style="color: #dc3545;">Pandit Unavailable for Requested Slot</h2>
                <p style="font-size: 15px; line-height: 1.6; color: #444;">
                    Namaste <strong>${(data && (data.customerName || data.userName)) || 'Devotee'}</strong>, the requested Pandit is currently unavailable for <strong>${(data && data.service) || 'Puja'}</strong> on <strong>${(data && data.date) || ''}</strong>.
                </p>
                <p style="font-size: 14px; color: #555;">
                    Our Admin team has been notified and will reassign another verified Vedic Pandit in ${(data && data.district) || 'your area'}. You will receive an instant email update as soon as a new Pandit is assigned!
                </p>
            </div>`;
        } else if (type === 'otp') {
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
