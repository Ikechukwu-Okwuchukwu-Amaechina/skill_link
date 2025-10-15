const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const jwt = require('jsonwebtoken');

// Sign JWT for admin sessions
function signToken(user) {
  const payload = { sub: user._id.toString(), email: user.email, role: user.role };
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn });
}

// Helper to parse pagination
function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// POST /api/admin/login
async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      const err = new Error('email and password required');
      err.status = 400;
      throw err;
    }

    const user = await User.findOne({ email });
  
    const passwordOk = user && typeof user.checkPassword === 'function'
      ? await user.checkPassword(password)
      : false;

    if (!user || user.role !== 'admin' || !passwordOk) {
      const err = new Error('Invalid credentials');
      err.status = 401;
      throw err;
    }

    const token = signToken(user);
    const secure = (req.secure || req.headers['x-forwarded-proto'] === 'https');
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ user: user.toJSON ? user.toJSON() : user, token });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/users
async function listUsers(req, res, next) {
  try {
    const { limit, skip, page } = parsePagination(req);
    const q = {};
    if (req.query.accountType) q.accountType = req.query.accountType;
    if (req.query.active) q.isActive = req.query.active === 'true';

    const [items, total] = await Promise.all([
      User.find(q).select('-passwordHash -password').limit(limit).skip(skip).sort({ createdAt: -1 }).lean(),
      User.countDocuments(q)
    ]);

    // Shape aligned with frontend: { data: [...], meta: {...} }
    res.json({ data: items, meta: { page, limit, total } });
  } catch (err) { next(err); }
}

async function getUser(req, res, next) {
  try {
    const doc = await User.findById(req.params.id).select('-passwordHash -password').lean();
    if (!doc) return res.status(404).json({ message: 'User not found' });
    res.json(doc);
  } catch (err) { next(err); }
}

// GET /api/admin/jobs
async function listJobs(req, res, next) {
  try {
    const { limit, skip, page } = parsePagination(req);
    const q = {};
    if (req.query.title) q.title = new RegExp(req.query.title, 'i');
    if (req.query.employer) q.employer = req.query.employer;
    if (req.query.active) q.isActive = req.query.active === 'true';

    const [items, total] = await Promise.all([
      Job.find(q).populate('employer', 'name email accountType').limit(limit).skip(skip).sort({ createdAt: -1 }).lean(),
      Job.countDocuments(q)
    ]);

    // Shape aligned with frontend
    res.json({ data: items, meta: { page, limit, total } });
  } catch (err) { next(err); }
}

async function getJob(req, res, next) {
  try {
    const doc = await Job.findById(req.params.id).populate('employer', 'name email accountType').lean();
    if (!doc) return res.status(404).json({ message: 'Job not found' });
    res.json(doc);
  } catch (err) { next(err); }
}

// GET /api/admin/payments
async function listPayments(req, res, next) {
  try {
    const { limit, skip, page } = parsePagination(req);
    const q = {};
    if (req.query.type) q.type = req.query.type;
    if (req.query.status) q.status = req.query.status;

    const [items, total] = await Promise.all([
      Payment.find(q).populate('worker', 'name email').populate('employer', 'name email').limit(limit).skip(skip).sort({ createdAt: -1 }).lean(),
      Payment.countDocuments(q)
    ]);

    // Shape aligned with frontend
    res.json({ data: items, meta: { page, limit, total } });
  } catch (err) { next(err); }
}

async function getPayment(req, res, next) {
  try {
    const doc = await Payment.findById(req.params.id).populate('worker', 'name email').populate('employer', 'name email').lean();
    if (!doc) return res.status(404).json({ message: 'Payment not found' });
    res.json(doc);
  } catch (err) { next(err); }
}

module.exports = {
  adminLogin,
  listUsers,
  getUser,
  listJobs,
  getJob,
  listPayments,
  getPayment
};
