const User = require('../models/User');
const Job = require('../models/Job');
const Invite = require('../models/Invite');
const Project = require('../models/Project');
const Review = require('../models/Review');
const Payment = require('../models/Payment');

// --- Helpers for displaying user info in messages (mirrors project controller) ---
function pickAvatar(u) {
  if (!u) return null;
  if (u.accountType === 'employer') return u.employer?.companyLogo || null;
  if (u.accountType === 'skilled_worker') return u.skilledWorker?.profileImage || null;
  return null;
}

function pickDisplayName(u) {
  if (!u) return '';
  if (u.accountType === 'employer') return u.employer?.companyName || u.name || '';
  if (u.accountType === 'skilled_worker') return u.skilledWorker?.fullName || u.name || '';
  return u.name || '';
}

// GET /api/workers/public
async function listWorkers(req, res, next) {
  try {
    const {
      q,
      skills, // comma-separated
      location,
      minRate,
      maxRate,
      availability,
      minRating,
      page = 1,
      limit = 10
    } = req.query;

    const where = { accountType: 'skilled_worker', isActive: true };

    if (q) {
      const rx = new RegExp(q, 'i');
      where.$or = [
        { name: rx },
        { 'skilledWorker.professionalTitle': rx },
        { 'skilledWorker.shortBio': rx }
      ];
    }
    if (location) where['skilledWorker.location'] = new RegExp(location, 'i');
    if (availability) where['skilledWorker.availability'] = new RegExp(availability, 'i');
    if (minRating != null) where['skilledWorker.rating'] = { ...(where['skilledWorker.rating'] || {}), $gte: Number(minRating) };
    if (minRate != null || maxRate != null) {
      const cond = {};
      if (minRate != null) cond.$gte = Number(minRate);
      if (maxRate != null) cond.$lte = Number(maxRate);
      where['skilledWorker.hourlyRate'] = cond;
    }
    if (skills) {
      const arr = skills.split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length) where['skilledWorker.primarySkills'] = { $all: arr };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      User.find(where)
        .select('name skilledWorker professionalTitle accountType')
        .sort({ 'skilledWorker.rating': -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(where)
    ]);

    res.json({
      items,
      pagination: { page: Number(page), limit: Number(limit), total }
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/workers/:id
async function getWorker(req, res, next) {
  try {
    const user = await User.findOne({ _id: req.params.id, accountType: 'skilled_worker', isActive: true });
    if (!user) { const err = new Error('Worker not found'); err.status = 404; throw err; }
    res.json({ worker: user.toJSON() });
  } catch (err) { next(err); }
}

// exports are declared once at the end of the file
// Extra endpoint to provide filter data (skills, locations, availability, rate range)
async function workersMeta(req, res, next) {
  try {
    const filter = { accountType: 'skilled_worker', isActive: true };

    const skills = await User.distinct('skilledWorker.primarySkills', filter);
    const locations = await User.distinct('skilledWorker.location', filter);
    const availability = await User.distinct('skilledWorker.availability', filter);

    const minDoc = await User.findOne({ ...filter, 'skilledWorker.hourlyRate': { $ne: null } })
      .sort({ 'skilledWorker.hourlyRate': 1 })
      .select('skilledWorker.hourlyRate');
    const maxDoc = await User.findOne({ ...filter, 'skilledWorker.hourlyRate': { $ne: null } })
      .sort({ 'skilledWorker.hourlyRate': -1 })
      .select('skilledWorker.hourlyRate');

    res.json({
      skills: (skills || []).filter(Boolean).sort(),
      locations: (locations || []).filter(Boolean).sort(),
      availability: (availability || []).filter(Boolean).sort(),
      rate: {
        min: minDoc?.skilledWorker?.hourlyRate ?? 0,
        max: maxDoc?.skilledWorker?.hourlyRate ?? 0
      }
    });
  } catch (err) { next(err); }
}

// GET /api/workers/jobs/invitations - get job invitations for worker
async function getJobInvitations(req, res, next) {
  try {
    const { q, category, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    
    const where = { 
      worker: req.userId, 
      type: 'invite', 
      status: 'pending' 
    };

    // Apply date filter if provided
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.$gte = new Date(dateFrom);
      if (dateTo) where.createdAt.$lte = new Date(dateTo);
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    let invitations = await Invite.find(where)
      .populate({
        path: 'job',
        populate: { path: 'employer', select: 'name employer.companyName' }
      })
      .populate('employer', 'name employer.companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Apply additional filters
    if (q) {
      const searchRegex = new RegExp(q, 'i');
      invitations = invitations.filter(inv => 
        searchRegex.test(inv.job.title) || 
        searchRegex.test(inv.job.description)
      );
    }

    if (category) {
      invitations = invitations.filter(inv => 
        inv.job.requiredSkills.some(skill => 
          skill.toLowerCase().includes(category.toLowerCase())
        )
      );
    }

    const total = await Invite.countDocuments(where);

    res.json({
      invitations,
      pagination: { page: Number(page), limit: Number(limit), total }
    });
  } catch (err) { next(err); }
}

// GET /api/workers/jobs/active - get active jobs for worker (from Projects)
async function getActiveJobs(req, res, next) {
  try {
    const { q, category, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    
    const where = { 
      assignedTo: req.userId, 
      status: 'active'
    };

    // Apply date filter if provided
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.$gte = new Date(dateFrom);
      if (dateTo) where.createdAt.$lte = new Date(dateTo);
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    let activeProj = await Project.find(where)
      .populate({ path: 'job', populate: { path: 'employer', select: 'name employer.companyName' } })
      .populate('createdBy', 'name employer.companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Map projects to include a synthetic invite-like status for UI/tests
    let activeJobs = (activeProj || []).map(p => ({ ...p, status: 'accepted' }));

    // Fallback: if there are no projects yet (legacy data), use invites
    if (activeJobs.length === 0) {
      let inv = await Invite.find({ worker: req.userId, status: { $in: ['accepted', 'approved'] } })
        .populate({ path: 'job', populate: { path: 'employer', select: 'name employer.companyName' } })
        .populate('employer', 'name employer.companyName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();
      activeJobs = inv || [];
    }

    // Apply additional filters
    if (q) {
      const searchRegex = new RegExp(q, 'i');
      activeJobs = activeJobs.filter(p => 
        searchRegex.test(p.title) ||
        (p.job && (searchRegex.test(p.job.title) || searchRegex.test(p.job.description || '')))
      );
    }

    if (category) {
      const cat = String(category).toLowerCase();
      activeJobs = activeJobs.filter(p => {
        if (p.job && Array.isArray(p.job.requiredSkills)) {
          return p.job.requiredSkills.some(skill => String(skill).toLowerCase().includes(cat));
        }
        return String(p.category || '').toLowerCase().includes(cat);
      });
    }

    const total = activeJobs.length > 0 && activeJobs[0].job && activeJobs[0].createdBy
      ? await Project.countDocuments(where)
      : await Invite.countDocuments({ worker: req.userId, status: { $in: ['accepted', 'approved'] } });

    res.json({
      activeJobs,
      pagination: { page: Number(page), limit: Number(limit), total }
    });
  } catch (err) { next(err); }
}

// GET /api/workers/jobs/completed - get completed jobs for worker (from Projects)
async function getCompletedJobs(req, res, next) {
  try {
    const { q, category, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    
    const where = { 
      assignedTo: req.userId, 
      status: 'completed'
    };

    // Apply date filter if provided
    if (dateFrom || dateTo) {
      where.updatedAt = {};
      if (dateFrom) where.updatedAt.$gte = new Date(dateFrom);
      if (dateTo) where.updatedAt.$lte = new Date(dateTo);
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    let completedProj = await Project.find(where)
      .populate({ path: 'job', populate: { path: 'employer', select: 'name employer.companyName' } })
      .populate('createdBy', 'name employer.companyName')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    let completedJobs = (completedProj || []).map(p => ({ ...p, status: 'completed' }));

    if (completedJobs.length === 0) {
      let inv = await Invite.find({ worker: req.userId, status: 'completed' })
        .populate({ path: 'job', populate: { path: 'employer', select: 'name employer.companyName' } })
        .populate('employer', 'name employer.companyName')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();
      completedJobs = inv || [];
    }

    // Apply additional filters
    if (q) {
      const searchRegex = new RegExp(q, 'i');
      completedJobs = completedJobs.filter(p => 
        searchRegex.test(p.title) ||
        (p.job && (searchRegex.test(p.job.title) || searchRegex.test(p.job.description || '')))
      );
    }

    if (category) {
      const cat = String(category).toLowerCase();
      completedJobs = completedJobs.filter(p => {
        if (p.job && Array.isArray(p.job.requiredSkills)) {
          return p.job.requiredSkills.some(skill => String(skill).toLowerCase().includes(cat));
        }
        return String(p.category || '').toLowerCase().includes(cat);
      });
    }

    const total = completedJobs.length > 0 && completedJobs[0].job && completedJobs[0].createdBy
      ? await Project.countDocuments(where)
      : await Invite.countDocuments({ worker: req.userId, status: 'completed' });

    res.json({
      completedJobs,
      pagination: { page: Number(page), limit: Number(limit), total }
    });
  } catch (err) { next(err); }
}

// POST /api/workers/jobs/invitations/:id/accept - accept job invitation
async function acceptJobInvitation(req, res, next) {
  try {
    const invitation = await Invite.findOne({
      _id: req.params.id,
      worker: req.userId,
      type: 'invite',
      status: 'pending'
    });

    if (!invitation) {
      const err = new Error('Invitation not found');
      err.status = 404;
      throw err;
    }

  // Upon worker acceptance of an employer invite, mark as accepted and create a Project
  invitation.status = 'accepted';
    await invitation.save();

    const job = await Job.findById(invitation.job);
    let project = null;
    if (job) {
      project = await Project.create({
        title: job.title || 'Project',
        category: job.timeline || 'General',
        budget: job?.budgetRange?.max ?? job?.budgetRange?.min ?? 0,
        currency: 'NGN',
        createdBy: invitation.employer,
        assignedTo: invitation.worker,
        job: job._id,
        status: 'active',
        milestones: []
      });
      job.isActive = false;
      await job.save();
    }

    res.json({ message: 'Invitation accepted successfully', invitation, project });
  } catch (err) { next(err); }
}

// POST /api/workers/jobs/invitations/:id/decline - decline job invitation
async function declineJobInvitation(req, res, next) {
  try {
    const invitation = await Invite.findOne({
      _id: req.params.id,
      worker: req.userId,
      type: 'invite',
      status: 'pending'
    });

    if (!invitation) {
      const err = new Error('Invitation not found');
      err.status = 404;
      throw err;
    }

    invitation.status = 'declined';
    await invitation.save();

    res.json({ message: 'Invitation declined successfully', invitation });
  } catch (err) { next(err); }
}
// GET /api/workers/dashboard - summarized data for worker homepage
async function getWorkerDashboard(req, res, next) {
  try {
    const workerId = req.userId;
    // Preload projects for this worker (limit for performance in small demo)
    const [allProjects, activeCount, invitesThisWeek] = await Promise.all([
      Project.find({ assignedTo: workerId })
        .populate('createdBy', 'name employer.companyName')
        .populate({ path: 'job', select: 'title description', populate: { path: 'employer', select: 'name employer.companyName' } })
        .populate({
          path: 'messages.sender',
          select: 'name accountType employer.companyName employer.companyLogo skilledWorker.fullName skilledWorker.profileImage'
        })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Project.countDocuments({ assignedTo: workerId, status: 'active' }),
      Invite.countDocuments({ worker: workerId, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
    ]);

    // Ratings: simple average of Review.rating where reviewee is this worker
    const reviews = await Review.find({ reviewee: workerId }).select('rating').lean();
    const ratingCount = reviews.length;
    const ratingAvg = reviews.length
      ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
      : 0;

    // Messages and sections
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let newMessages = 0;
    const messageItems = [];
    for (const p of allProjects) {
      const msgs = Array.isArray(p.messages) ? p.messages : [];
      for (const m of msgs) {
        const ts = new Date(m.createdAt || p.createdAt).getTime();
        if (ts >= sevenDaysAgo && String(m.sender) !== String(workerId)) newMessages += 1;
        const senderObj = (m && typeof m.sender === 'object' && m.sender?._id) ? m.sender : null;
        const senderView = senderObj
          ? { _id: String(senderObj._id), name: pickDisplayName(senderObj), accountType: senderObj.accountType, avatar: pickAvatar(senderObj) }
          : (m.sender ? { _id: String(m.sender), name: '', accountType: undefined, avatar: null } : null);
        messageItems.push({
          projectId: String(p._id),
          projectTitle: p.title,
          text: m.text,
          createdAt: m.createdAt || p.createdAt,
          sender: senderView
        });
      }
    }
    messageItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const recentJobs = allProjects.slice(0, 3).map(p => ({
      id: String(p._id),
      title: p.job?.title || p.title,
      client: p.createdBy?.employer?.companyName || p.createdBy?.name || 'Client',
      date: p.createdAt,
      progress: p.progress || 0
    }));

    const ongoingJobs = allProjects.filter(p => p.status === 'active').slice(0, 5).map(p => ({
      id: String(p._id),
      title: p.job?.title || p.title,
      progress: p.progress || 0,
      deadline: p.deadline || null
    }));

    // Earnings review (last 5 weeks) — simple sum of project budgets created that week
    const weeks = [];
    const now = new Date();
    for (let i = 4; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - (7 * i));
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const value = allProjects
        .filter(p => {
          const d = new Date(p.createdAt);
          return d >= start && d <= end;
        })
        .reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      weeks.push({ label: `Week ${5 - i}`, value });
    }

    // Pending payments (simple heuristic for demo: submitted milestones + payment_request events)
    let pendingPayments = 0;
    for (const p of allProjects) {
      const milestones = Array.isArray(p.milestones) ? p.milestones : [];
      pendingPayments += milestones.filter(m => m.status === 'submitted').length;
      const events = Array.isArray(p.events) ? p.events : [];
      pendingPayments += events.filter(e => e.type === 'payment_request').length;
    }

    res.json({
      summary: {
        activeProjects: activeCount,
        pendingPayments,
        newMessages,
        profileViews: invitesThisWeek, // proxy metric due to lack of tracking table
        currentRating: Number(ratingAvg.toFixed(2)),
        ratingCount
      },
      recentJobs,
      latestMessages: messageItems.slice(0, 3),
      ongoingJobs,
      earningsReview: {
        granularity: 'weekly',
        series: weeks
      }
    });
  } catch (err) {
    next(err);
  }
}

// --- Payments & Finance (novice style) ---
// GET /api/workers/payments/overview
async function paymentsOverview(req, res, next) {
  try {
    const workerId = req.userId;

    // Totals
    const [earnings, withdrawalsPending, withdrawalsDone] = await Promise.all([
      Payment.aggregate([
        { $match: { worker: new (require('mongoose').Types.ObjectId)(workerId), type: 'earning' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { worker: new (require('mongoose').Types.ObjectId)(workerId), type: 'withdrawal', status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { worker: new (require('mongoose').Types.ObjectId)(workerId), type: 'withdrawal', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const totalEarned = earnings[0]?.total || 0;
    const totalSpent = withdrawalsDone[0]?.total || 0; // money paid out
    const pending = withdrawalsPending[0]?.total || 0;
    const balance = Math.max(0, totalEarned - totalSpent - pending);

    res.json({
      accountBalance: balance,
      totalSpent: totalSpent,
      pendingPayments: pending
    });
  } catch (err) { next(err); }
}

// GET /api/workers/payments/history
async function paymentsHistory(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const where = { worker: req.userId };
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Payment.find(where)
        .populate('project', 'title')
        .populate('employer', 'name employer.companyName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payment.countDocuments(where)
    ]);

    // Map to simple shape like screenshot
    const history = items.map(p => ({
      date: p.createdAt,
      client: p.employer?.employer?.companyName || p.employer?.name || '—',
      project: p.project?.title || p.note || '—',
      amount: p.amount,
      status: p.status,
      type: p.type
    }));

    res.json({
      history,
      pagination: { page: Number(page), limit: Number(limit), total }
    });
  } catch (err) { next(err); }
}

// POST /api/workers/payments/withdrawals
async function requestWithdrawal(req, res, next) {
  try {
    const amount = Number(req.body?.amount || 0);
    if (!(amount > 0)) { const e = new Error('Amount is required'); e.status = 400; throw e; }

    // compute available balance the same way as overview
    const [earnings, pendingWithdrawals, completedWithdrawals] = await Promise.all([
      Payment.aggregate([
        { $match: { worker: new (require('mongoose').Types.ObjectId)(req.userId), type: 'earning' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { worker: new (require('mongoose').Types.ObjectId)(req.userId), type: 'withdrawal', status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { worker: new (require('mongoose').Types.ObjectId)(req.userId), type: 'withdrawal', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const totalEarned = earnings[0]?.total || 0;
    const totalWithdrawn = completedWithdrawals[0]?.total || 0;
    const totalPending = pendingWithdrawals[0]?.total || 0;
    const available = Math.max(0, totalEarned - totalWithdrawn - totalPending);

    if (amount > available) { const e = new Error('Amount exceeds available balance'); e.status = 400; throw e; }

    const w = await Payment.create({
      worker: req.userId,
      amount,
      type: 'withdrawal',
      status: 'pending',
      note: 'Withdrawal request'
    });

    res.status(201).json({ message: 'Withdrawal requested', withdrawal: w });
  } catch (err) { next(err); }
}

module.exports = {
  listWorkers,
  getWorker,
  workersMeta,
  getJobInvitations,
  getActiveJobs,
  getCompletedJobs,
  acceptJobInvitation,
  declineJobInvitation,
  // New export for worker dashboard endpoint
  getWorkerDashboard,
  // payments
  paymentsOverview,
  paymentsHistory,
  requestWithdrawal
};


