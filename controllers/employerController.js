const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Project = require('../models/Project');
const User = require('../models/User');
const Invite = require('../models/Invite');

// --- Employer Dashboard ---
// GET /api/employers/dashboard
async function getEmployerDashboard(req, res, next) {
  try {
    const employerId = req.userId;

    // Load employer projects (small cap for demo)
    const projects = await Project.find({ createdBy: employerId })
      .populate('assignedTo', 'name skilledWorker.fullName')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const activeJobs = projects.filter(p => p.status === 'active');
    const activeCount = activeJobs.length;

    // Pending items
    let pendingMilestones = 0;
    let pendingPaymentRequests = 0;
    const pendingActions = [];
    for (const p of projects) {
      const milestones = Array.isArray(p.milestones) ? p.milestones : [];
      for (const m of milestones) {
        if (m.status === 'submitted') {
          pendingMilestones += 1;
          pendingActions.push({ type: 'approve_milestone', projectId: String(p._id), milestoneId: String(m._id), label: 'Approved Milestone' });
        }
      }
      const evs = Array.isArray(p.events) ? p.events : [];
      for (const ev of evs) {
        if (ev.type === 'payment_request' && !(ev.data && ev.data.paid)) {
          pendingPaymentRequests += 1;
          pendingActions.push({ type: 'release_payment', projectId: String(p._id), eventId: String(ev._id), amount: Number(ev?.data?.amount) || 0, label: 'Released Payment' });
        }
      }
    }

    // Proposals: worker applications on employer jobs
    const newProposals = await Invite.countDocuments({ employer: employerId, type: 'application', status: { $in: ['applied', 'pending'] } });

    // Messages: simple recent messages count (last 7 days) not by employer
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let newMessages = 0;
    for (const p of projects) {
      const msgs = Array.isArray(p.messages) ? p.messages : [];
      for (const m of msgs) {
        const t = new Date(m.createdAt || p.createdAt);
        if (t >= sevenDaysAgo && String(m.sender) !== String(employerId)) newMessages += 1;
      }
    }

    const activeJobCards = activeJobs.slice(0, 5).map(p => ({
      id: String(p._id),
      title: p.title,
      worker: p.assignedTo?.skilledWorker?.fullName || p.assignedTo?.name || 'TBD',
      deadline: p.deadline || null,
      progress: p.progress || 0
    }));

    // Recent applications list (avatars not stored; send simple info)
    const applications = await Invite.find({ employer: employerId, type: 'application' })
      .populate('worker', 'name skilledWorker.fullName')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();
    const recentApplications = applications.map(a => ({
      id: String(a._id),
      worker: a.worker?.skilledWorker?.fullName || a.worker?.name || 'Worker',
      date: a.createdAt
    }));

    res.json({
      summary: {
        activeJobs: activeCount,
        pendingAction: pendingMilestones + pendingPaymentRequests,
        newProposals,
        messages: newMessages
      },
      activeJobs: activeJobCards,
      pendingActions: pendingActions.slice(0, 6),
      recentApplications
    });
  } catch (err) { next(err); }
}

// GET /api/employers/payments/overview
async function paymentsOverview(req, res, next) {
  try {
    const employerId = req.userId;
    // Beginner friendly sums using plain arrays
    const sent = await Payment.find({ employer: employerId, type: 'earning', status: 'completed' });
    const deposits = await Payment.find({ employer: employerId, type: 'deposit', status: 'completed' });
    const projects = await Project.find({ createdBy: employerId }).select('events').lean();

    const totalSpent = (sent || []).reduce((n, p) => n + (Number(p.amount) || 0), 0);
    const totalDeposits = (deposits || []).reduce((n, p) => n + (Number(p.amount) || 0), 0);

    let pending = 0;
    for (const p of projects) {
      const evs = Array.isArray(p.events) ? p.events : [];
      for (const ev of evs) {
        const isReq = ev && ev.type === 'payment_request';
        const isPaid = ev && ev.data && ev.data.paid;
        if (isReq && !isPaid) {
          const amt = Number(ev?.data?.amount);
          pending += Number.isFinite(amt) && amt > 0 ? amt : 0;
        }
      }
    }

    const accountBalance = Math.max(0, totalDeposits - totalSpent);
    res.json({ accountBalance, totalSpent, pendingPayments: pending });
  } catch (err) { next(err); }
}

// GET /api/employers/payments/history
async function paymentsHistory(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const where = { employer: req.userId, type: 'earning' };
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Payment.find(where)
        .populate('project', 'title')
        .populate('worker', 'name skilledWorker.fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payment.countDocuments(where)
    ]);

    const history = items.map(p => ({
      date: p.createdAt,
      worker: p.worker?.skilledWorker?.fullName || p.worker?.name || 'Worker',
      project: p.project?.title || p.note || '—',
      amount: p.amount,
      status: p.status
    }));

    res.json({ history, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) { next(err); }
}

// POST /api/employers/projects/:id/payments  { amount, eventId? }
// Marks the request event as paid and records a Payment row
async function payWorker(req, res, next) {
  try {
    const employerId = req.userId;
    const project = await Project.findById(req.params.id);
    if (!project) { const e = new Error('Project not found'); e.status = 404; throw e; }
    if (String(project.createdBy) !== String(employerId)) { const e = new Error('Only project creator can pay'); e.status = 403; throw e; }
    if (!project.assignedTo) { const e = new Error('No worker assigned'); e.status = 400; throw e; }

    const amount = Number(req.body?.amount || 0);
    if (!(amount > 0)) { const e = new Error('Amount is required'); e.status = 400; throw e; }

  // Check employer balance before paying (simple sums)
  const sent = await Payment.find({ employer: employerId, type: 'earning', status: 'completed' });
  const deposits = await Payment.find({ employer: employerId, type: 'deposit', status: 'completed' });
  const totalSpent = (sent || []).reduce((n, p) => n + (Number(p.amount) || 0), 0);
  const totalDeposits = (deposits || []).reduce((n, p) => n + (Number(p.amount) || 0), 0);
  const balance = Math.max(0, totalDeposits - totalSpent);
    if (amount > balance) { const e = new Error('Insufficient employer balance'); e.status = 400; throw e; }

    // Record payment (deducted logically by being of type earning)
    const payment = await Payment.create({
      worker: project.assignedTo,
      employer: employerId,
      project: project._id,
      amount,
      type: 'earning',
      status: 'completed',
      note: 'Employer payment'
    });

    // If eventId provided, mark request as paid
    const eventId = req.body?.eventId;
    if (eventId) {
      const ev = project.events.id(eventId);
      if (ev && ev.type === 'payment_request') {
        ev.data = { ...(ev.data || {}), paid: true, paidAt: new Date(), paymentId: payment._id };
        await project.save();
      }
    }

    res.status(201).json({ message: 'Payment sent to worker', payment });
  } catch (err) { next(err); }
}

// POST /api/employers/wallet/deposit { amount }
async function deposit(req, res, next) {
  try {
    const amount = Number(req.body?.amount || 0);
    if (!(amount > 0)) { const e = new Error('Amount is required'); e.status = 400; throw e; }
    const p = await Payment.create({ employer: req.userId, amount, type: 'deposit', status: 'completed', note: 'Wallet deposit' });
    res.status(201).json({ deposit: p });
  } catch (err) { next(err); }
}

module.exports = { paymentsOverview, paymentsHistory, payWorker, getEmployerDashboard, deposit };
