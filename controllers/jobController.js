const Job = require('../models/Job');
const User = require('../models/User');
const Invite = require('../models/Invite');

function ensureEmployer(user) {
  return user && user.accountType === 'employer';
}

// POST /api/jobs
async function createJob(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!ensureEmployer(user)) {
      const err = new Error('Only employers can post jobs');
      err.status = 403; throw err;
    }

    const { title, description, budgetRange, timeline, requiredSkills } = req.body;
    if (!title || !description || !budgetRange || budgetRange.min == null || budgetRange.max == null) {
      const err = new Error('title, description, and budgetRange {min,max} are required');
      err.status = 400; throw err;
    }

  const job = await Job.create({
      employer: user._id,
      title,
      description,
      budgetRange,
      timeline,
      requiredSkills
    });
    res.status(201).json({ job });
  } catch (err) { next(err); }
}

// GET /api/jobs (own jobs)
async function listMyJobs(req, res, next) {
  try {
    const jobs = await Job.find({ employer: req.userId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'employer',
        select: 'name accountType employer.companyName employer.location employer.website'
      });
    res.json({ jobs });
  } catch (err) { next(err); }
}

// GET /api/jobs/:id
async function getJob(req, res, next) {
  try {
    const job = await Job.findById(req.params.id)
      .populate({
        path: 'employer',
        select: 'name accountType employer.companyName employer.location employer.website'
      });
    if (!job) { const err = new Error('Job not found'); err.status = 404; throw err; }
    res.json({ job });
  } catch (err) { next(err); }
}

// PATCH /api/jobs/:id
async function updateJob(req, res, next) {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) { const err = new Error('Job not found'); err.status = 404; throw err; }
    if (job.employer.toString() !== req.userId) { const err = new Error('Not authorized'); err.status = 403; throw err; }

    const allowed = ['title', 'description', 'budgetRange', 'timeline', 'requiredSkills', 'isActive'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    let saved = await Job.findByIdAndUpdate(job._id, updates, { new: true, runValidators: true });
    saved = await saved.populate({
      path: 'employer',
      select: 'name accountType employer.companyName employer.location employer.website'
    });
    res.json({ job: saved });
  } catch (err) { next(err); }
}

// DELETE /api/jobs/:id
async function deleteJob(req, res, next) {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) { const err = new Error('Job not found'); err.status = 404; throw err; }
    if (job.employer.toString() !== req.userId) { const err = new Error('Not authorized'); err.status = 403; throw err; }
    await job.deleteOne();
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { createJob, listMyJobs, getJob, updateJob, deleteJob };
 
// POST /api/jobs/:jobId/apply (worker)
async function applyToJob(req, res, next) {
  try {
    const worker = await User.findById(req.userId);
    if (!worker || worker.accountType !== 'skilled_worker') {
      const e = new Error('Only skilled workers can apply'); e.status = 403; throw e;
    }

    const job = await Job.findById(req.params.jobId);
    if (!job || job.isActive === false) { const e = new Error('Job not found or inactive'); e.status = 404; throw e; }

    // prevent duplicate active applications
    const existing = await Invite.findOne({
      type: 'application', job: job._id, worker: worker._id, status: { $in: ['applied', 'approved'] }
    });
    if (existing) { const e = new Error('You already applied to this job'); e.status = 409; throw e; }

    const invite = await Invite.create({
      employer: job.employer,
      worker: worker._id,
      job: job._id,
      message: req.body?.message,
      type: 'application',
      status: 'applied'
    });

    res.status(201).json({ invite });
  } catch (err) { next(err); }
}

// POST /api/jobs/:jobId/applications/:id/approve (employer) - but we'll keep id for invite record
async function approveInviteOrApplication(req, res, next) {
  try {
    const employer = await User.findById(req.userId);
    if (!employer || employer.accountType !== 'employer') { const e = new Error('Employer account required'); e.status = 403; throw e; }

    const invite = await Invite.findById(req.params.id);
    if (!invite) { const e = new Error('Record not found'); e.status = 404; throw e; }
    if (invite.employer.toString() !== employer._id.toString()) { const e = new Error('Not authorized to approve this record'); e.status = 403; throw e; }

    // Allowed transitions
    if (invite.type === 'invite' && invite.status !== 'accepted') {
      const e = new Error('Invite must be accepted by worker before approval'); e.status = 400; throw e;
    }
    if (invite.type === 'application' && invite.status !== 'applied') {
      const e = new Error('Application is not in applied state'); e.status = 400; throw e;
    }

    invite.status = 'approved';
    await invite.save();
    res.json({ invite });
  } catch (err) { next(err); }
}

module.exports.applyToJob = applyToJob;
module.exports.approveInviteOrApplication = approveInviteOrApplication;
