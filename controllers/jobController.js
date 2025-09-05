const Job = require('../models/Job');
const User = require('../models/User');

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
