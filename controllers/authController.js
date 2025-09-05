const jwt = require('jsonwebtoken');
const path = require('path');
const User = require('../models/User');

function signToken(user) {
  const payload = { sub: user._id.toString(), email: user.email, role: user.role };
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn });
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
  const { firstname, lastname, email, password, accountType, skilledWorker, employer } = req.body;
    if (!email || !password || !(firstname || lastname)) {
      const err = new Error('firstname/lastname, email and password are required');
      err.status = 400;
      throw err;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      const err = new Error('Email already in use');
      err.status = 409;
      throw err;
    }

    const name = [firstname, lastname].filter(Boolean).join(' ').trim() || firstname || lastname;

    const user = new User({
      name,
      firstname,
      lastname,
      email,
      passwordHash: 'temp',
      accountType: accountType === 'employer' ? 'employer' : 'skilled_worker',
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

    // If files were uploaded via multipart/form-data, map them to verificationDocs
    if (Array.isArray(req.files) && req.files.length > 0) {
      // Accept labels as: labels, labels[], label, or label[] (array or single string)
      const labels = payload.labels ?? req.body.labels ?? req.body['labels[]'] ?? req.body.label ?? req.body['label[]'];
      const labelsArr = Array.isArray(labels) ? labels : (typeof labels === 'string' ? [labels] : []);

      const docs = req.files.map(function (f, i) {
        const label = labelsArr[i] || f.originalname;
        const urlPath = `/uploads/${path.basename(f.path)}`;
        return { label, fileUrl: urlPath };
      });
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

module.exports = { register, login, me, updateProfile, employerBasic, employerDetails, employerTrust };
