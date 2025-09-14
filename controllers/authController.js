const jwt = require('jsonwebtoken');
const path = require('path');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const { uploadToCloudinary } = require('../middleware/upload');

// Simple in-memory storage for OTP codes (for development - use Redis in production)
const otpStore = new Map();

// Create nodemailer transporter with better Gmail support
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

function signToken(user) {
  const payload = { sub: user._id.toString(), email: user.email, role: user.role };
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn });
}

// POST /api/auth/send-otp
async function sendOtp(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      const err = new Error('Email is required');
      err.status = 400;
      throw err;
    }

  // Generate 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Store OTP with expiration (5 minutes)
    otpStore.set(email, { code: otp, expires: Date.now() + 5 * 60 * 1000 });

    try {
      // Attempt to send email
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your OTP Code - Skill Link',
        html: `
          <h2>Your OTP Code</h2>
          <p>Your OTP code is: <strong>${otp}</strong></p>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        `
      });
      console.log(`OTP sent to ${email}: ${otp}`);
    } catch (emailError) {
      // Fallback: just log the OTP to console for development
      console.log(`EMAIL FAILED - OTP for ${email}: ${otp}`);
      console.log('Email error:', emailError.message);
    }

    res.json({ status: 'sent', message: 'OTP sent successfully to your email' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-otp
async function verifyOtp(req, res, next) {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      const err = new Error('Email and OTP code are required');
      err.status = 400;
      throw err;
    }

    const stored = otpStore.get(email);
    if (!stored) {
      const err = new Error('No OTP found for this email');
      err.status = 400;
      throw err;
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(email);
      const err = new Error('OTP code has expired');
      err.status = 400;
      throw err;
    }

    if (stored.code !== code) {
      const err = new Error('Invalid OTP code');
      err.status = 400;
      throw err;
    }

    // OTP is valid - remove it from store
    otpStore.delete(email);
    res.json({ verified: true, message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { firstname, lastname, email, phone, password, accountType, skilledWorker, employer } = req.body;
    if (!email || !password || !phone || !(firstname || lastname)) {
      const err = new Error('firstname/lastname, email, phone and password are required');
      err.status = 400;
      throw err;
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      const err = new Error('Email already in use');
      err.status = 409;
      throw err;
    }

    // Check if phone already exists
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      const err = new Error('Phone number already in use');
      err.status = 409;
      throw err;
    }

    const name = [firstname, lastname].filter(Boolean).join(' ').trim() || firstname || lastname;

    const user = new User({
      name,
      firstname,
      lastname,
      email,
      phone,
      passwordHash: 'temp',
      accountType: accountType === 'employer' ? 'employer' : 'skilled_worker',
      isEmailVerified: true, // Set to true since OTP was verified before registration
      // Only set if provided; schema keeps this optional
      ...(skilledWorker ? { skilledWorker: skilledWorker } : {}),
      ...(employer ? { employer: employer } : {})
    });
    user.setPassword(password);
    await user.save();

    const token = signToken(user);
    res.status(201).json({ user: user.toJSON(), token });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      const err = new Error('email and password are required');
      err.status = 400;
      throw err;
    }

    const user = await User.findOne({ email });
    if (!user || !user.checkPassword(password)) {
      const err = new Error('Invalid credentials');
      err.status = 401;
      throw err;
    }

    const token = signToken(user);
    res.json({ user: user.toJSON(), token });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    res.json({ user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/auth/profile
async function updateProfile(req, res, next) {
  try {
    const updates = {};
  const allowedTopLevel = ['firstname', 'lastname', 'accountType'];
    for (const key of allowedTopLevel) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (req.body.skilledWorker) {
      for (const [k, v] of Object.entries(req.body.skilledWorker)) {
        updates[`skilledWorker.${k}`] = v;
      }
    }

    if (req.body.employer) {
      for (const [k, v] of Object.entries(req.body.employer)) {
        updates[`employer.${k}`] = v;
      }
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true });
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    res.json({ user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

// --- Employer step-specific endpoints ---
function ensureEmployer(user) {
  if (!user || user.accountType !== 'employer') {
    const err = new Error('Employer account required');
    err.status = 400;
    throw err;
  }
}

// PATCH /api/auth/profile/employer/basic
async function employerBasic(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    ensureEmployer(user);

    const payload = req.body?.employer || req.body || {};
    const allowed = ['companyName', 'companyLogo', 'location', 'contactPreference'];
    const updates = {};
    for (const k of allowed) if (payload[k] !== undefined) updates[`employer.${k}`] = payload[k];

    const saved = await User.findByIdAndUpdate(user.id, updates, { new: true, runValidators: true });
    res.json({ user: saved.toJSON() });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/auth/profile/employer/details
async function employerDetails(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    ensureEmployer(user);

    const payload = req.body?.employer || req.body || {};
    const allowed = ['industry', 'companySize', 'website', 'shortBio'];
    const updates = {};
    for (const k of allowed) if (payload[k] !== undefined) updates[`employer.${k}`] = payload[k];

    const saved = await User.findByIdAndUpdate(user.id, updates, { new: true, runValidators: true });
    res.json({ user: saved.toJSON() });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/auth/profile/employer/trust
async function employerTrust(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    ensureEmployer(user);

    const payload = req.body?.employer || req.body || {};
    const updates = {};

    // If files were uploaded via multipart/form-data, upload to Cloudinary
    if (Array.isArray(req.files) && req.files.length > 0) {
      // Accept labels as: labels, labels[], label, or label[] (array or single string)
      const labels = payload.labels ?? req.body.labels ?? req.body['labels[]'] ?? req.body.label ?? req.body['label[]'];
      const labelsArr = Array.isArray(labels) ? labels : (typeof labels === 'string' ? [labels] : []);

      const docs = await Promise.all(req.files.map(async function (f, i) {
        const label = labelsArr[i] || f.originalname;
        const result = await uploadToCloudinary(f.buffer, {
          folder: `skill_link/employer_docs/${user._id}`,
          resource_type: 'auto'
        });
        return { label, fileUrl: result.secure_url };
      }));
      updates['employer.verificationDocs'] = docs;
    } else if (payload.verificationDocs !== undefined) {
      // JSON body fallback
      updates['employer.verificationDocs'] = payload.verificationDocs;
    }

    const saved = await User.findByIdAndUpdate(user.id, updates, { new: true, runValidators: true });
    res.json({ user: saved.toJSON() });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendOtp, verifyOtp, register, login, me, updateProfile, employerBasic, employerDetails, employerTrust };
