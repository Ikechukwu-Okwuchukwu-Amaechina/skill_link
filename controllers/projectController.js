const Project = require('../models/Project');
const User = require('../models/User');

// Tiny helper to ensure we have a valid user id in req (auth middleware sets req.userId)
function requireAuth(req) {
  if (!req.userId) {
    const err = new Error('Authentication required');
    err.status = 401; throw err;
  }
}

// GET /api/projects
// Lists all projects where the current user is creator or assignee.
async function listProjects(req, res, next) {
  try {
    requireAuth(req);
    const userId = req.userId;

    const projects = await Project.find({
      $or: [{ createdBy: userId }, { assignedTo: userId }]
    })
      .sort({ updatedAt: -1 })
      .populate('createdBy', 'name accountType employer.companyName skilledWorker.fullName')
      .populate('assignedTo', 'name accountType skilledWorker.fullName');

    res.json({ projects });
  } catch (err) { next(err); }
}

// GET /api/projects/:id
async function getProject(req, res, next) {
  try {
    requireAuth(req);
    const p = await Project.findById(req.params.id)
      .populate('createdBy', 'name accountType employer.companyName skilledWorker.fullName')
      .populate('assignedTo', 'name accountType skilledWorker.fullName');
    if (!p) { const e = new Error('Project not found'); e.status = 404; throw e; }

    // Access check: allow creator or assignee.
    // Handle both raw ObjectId and populated documents safely.
    function asId(v) {
      if (!v) return null;
      if (typeof v === 'string') return v;
      if (v._id) return String(v._id);
      return String(v);
    }
    const createdById = asId(p.createdBy);
    const assignedToId = asId(p.assignedTo);
    const viewerId = String(req.userId);
    const isCreator = createdById === viewerId;
    const isAssignee = assignedToId === viewerId;
    if (!isCreator && !isAssignee) {
      const e = new Error('Not authorized to view this project'); e.status = 403; throw e;
    }
    res.json({ project: p });
  } catch (err) { next(err); }
}

// POST /api/projects
// Very simple create; requires title and budget
async function createProject(req, res, next) {
  try {
    requireAuth(req);
    const user = await User.findById(req.userId);
    if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }

    const { title, category, budget, currency, deadline, assignedTo, milestones } = req.body;
    if (!title) { const e = new Error('title is required'); e.status = 400; throw e; }

    const p = await Project.create({
      title,
      category,
      budget: budget ?? 0,
      currency: currency || 'NGN',
      deadline,
      createdBy: user._id,
      assignedTo: assignedTo || null,
      milestones: Array.isArray(milestones) ? milestones : []
    });

    const populated = await Project.findById(p._id)
      .populate('createdBy', 'name accountType employer.companyName skilledWorker.fullName')
      .populate('assignedTo', 'name accountType skilledWorker.fullName');

    res.status(201).json({ project: populated });
  } catch (err) { next(err); }
}

// PATCH /api/projects/:id
async function updateProject(req, res, next) {
  try {
    requireAuth(req);
    const p = await Project.findById(req.params.id);
    if (!p) { const e = new Error('Project not found'); e.status = 404; throw e; }

    // only creator can update basic fields (simple rule)
    if (p.createdBy.toString() !== req.userId) {
      const e = new Error('Not authorized'); e.status = 403; throw e;
    }

    const allowed = ['title', 'category', 'budget', 'currency', 'deadline', 'progress', 'status', 'assignedTo', 'milestones'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const saved = await Project.findByIdAndUpdate(p._id, updates, { new: true, runValidators: true })
      .populate('createdBy', 'name accountType employer.companyName skilledWorker.fullName')
      .populate('assignedTo', 'name accountType skilledWorker.fullName');
    res.json({ project: saved });
  } catch (err) { next(err); }
}

module.exports = { listProjects, getProject, createProject, updateProject };
