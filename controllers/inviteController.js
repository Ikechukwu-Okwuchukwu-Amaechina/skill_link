const Invite = require('../models/Invite');
const User = require('../models/User');
const Job = require('../models/Job');
const Project = require('../models/Project');
const mongoose = require('mongoose');

// POST /api/invites
async function createInvite(req, res, next) {
  try {
    const employer = await User.findById(req.userId);
    if (!employer || employer.accountType !== 'employer') {
      const err = new Error('Only employers can invite');
      err.status = 403; throw err;
    }

    const { jobId, workerId, message } = req.body || {};
    if (!jobId || !workerId) {
      const err = new Error('jobId and workerId are required');
      err.status = 400; throw err;
    }

    const job = await Job.findById(jobId);
    if (!job || job.employer.toString() !== employer._id.toString()) {
      const err = new Error('Invalid job or not your job');
      err.status = 400; throw err;
    }

    const worker = await User.findOne({ _id: workerId, accountType: 'skilled_worker', isActive: true });
    if (!worker) {
      const err = new Error('Worker not found');
      err.status = 404; throw err;
    }

    const invite = await Invite.create({
      employer: employer._id,
      worker: worker._id,
      job: job._id,
      message,
      type: 'invite',
      status: 'pending'
    });

    res.status(201).json({ invite });
  } catch (err) { next(err); }
}

// POST /api/invites/:id/accept (worker)
// New behavior: accepting an employer invite immediately marks it approved
// and starts an active Project tying the employer, worker, and job together.
async function acceptInvite(req, res, next) {
  try {
    const invite = await Invite.findById(req.params.id);
    if (!invite) { const e = new Error('Invite not found'); e.status = 404; throw e; }
    if (invite.type !== 'invite') { const e = new Error('Only employer invites can be accepted by worker'); e.status = 400; throw e; }
  const workerIdStr = (invite.worker && invite.worker._id ? invite.worker._id : invite.worker).toString();
  if (workerIdStr !== String(req.userId)) { const e = new Error('Not authorized to accept this invite'); e.status = 403; throw e; }
    if (invite.status !== 'pending') { const e = new Error('Invite is not pending'); e.status = 400; throw e; }

    // Load job to copy details into the project
    const job = await Job.findById(invite.job);
    if (!job) { const e = new Error('Linked job not found'); e.status = 404; throw e; }

    // 1) Mark invite approved immediately
    invite.status = 'approved';
    await invite.save();

    // 2) Create active project (very simple mapping)
    const project = await Project.create({
      title: job.title || 'Project',
      category: job.timeline || 'General',
      budget: job?.budgetRange?.max ?? job?.budgetRange?.min ?? 0,
      currency: 'NGN',
      createdBy: invite.employer,
      assignedTo: invite.worker,
      status: 'active',
      milestones: []
    });

    // 3) Optionally close job listing so it does not keep appearing
    job.isActive = false;
    await job.save();

    res.json({ invite, project });
  } catch (err) { next(err); }
}

// POST /api/invites/:id/decline (worker)
async function declineInvite(req, res, next) {
  try {
    const invite = await Invite.findById(req.params.id);
    if (!invite) { const e = new Error('Invite not found'); e.status = 404; throw e; }
    if (invite.type !== 'invite') { const e = new Error('Only employer invites can be declined by worker'); e.status = 400; throw e; }
    const workerIdStr = (invite.worker && invite.worker._id ? invite.worker._id : invite.worker).toString();
    if (workerIdStr !== String(req.userId)) { const e = new Error('Not authorized to decline this invite'); e.status = 403; throw e; }
    if (invite.status !== 'pending') { const e = new Error('Invite is not pending'); e.status = 400; throw e; }

    invite.status = 'declined';
    await invite.save();
    res.json({ invite });
  } catch (err) { next(err); }
}

// GET /api/invites
// Returns invites/applications relevant to the authenticated user
// Employers see records where they are the employer; workers see where they are the worker
async function listInvites(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }

    const filter = user.accountType === 'employer' ? { employer: user._id } : { worker: user._id };

    // Optional query params: type, status, jobId
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.jobId && mongoose.isValidObjectId(req.query.jobId)) filter.job = req.query.jobId;

    const items = await Invite.find(filter)
      .sort({ createdAt: -1 })
      .populate('employer', 'name accountType employer.companyName')
      .populate('worker', 'name accountType skilledWorker.fullName')
      .populate('job', 'title');

    res.json({ invites: items });
  } catch (err) { next(err); }
}

// GET /api/invites/:id
async function getInvite(req, res, next) {
  try {
    const inv = await Invite.findById(req.params.id)
      .populate('employer', 'name accountType employer.companyName')
      .populate('worker', 'name accountType skilledWorker.fullName')
      .populate('job', 'title');
    if (!inv) { const e = new Error('Invite not found'); e.status = 404; throw e; }

    // access control: must be either employer or worker on the record
    const isEmployer = inv.employer?.toString?.() === req.userId || inv.employer?._id?.toString?.() === req.userId;
    const isWorker = inv.worker?.toString?.() === req.userId || inv.worker?._id?.toString?.() === req.userId;
    if (!isEmployer && !isWorker) { const e = new Error('Not authorized to view this invite'); e.status = 403; throw e; }

    res.json({ invite: inv });
  } catch (err) { next(err); }
}

module.exports = { createInvite, acceptInvite, declineInvite, listInvites, getInvite };
