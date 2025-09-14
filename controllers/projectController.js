const Project = require('../models/Project');
const User = require('../models/User');
const Invite = require('../models/Invite');
const Job = require('../models/Job');
const { notify } = require('../services/notifyService');

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

    const match = { $or: [{ createdBy: userId }, { assignedTo: userId }] };
    if (req.query && req.query.status) {
      match.status = req.query.status;
    }

    const projects = await Project.find(match)
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
// Very simple create; requires title and budget (Employer only)
async function createProject(req, res, next) {
  try {
    requireAuth(req);
  const user = await User.findById(req.userId);
    if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }
  if (user.accountType !== 'employer') { const e = new Error('Only employers can create projects'); e.status = 403; throw e; }

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

    // If a worker was assigned at creation, notify them
    try {
      if (p.assignedTo) {
        const link = `/app/projects/${p._id}`;
        await notify({ userId: p.assignedTo, title: 'Assigned to project', message: `You were assigned to ${p.title || 'a project'}`, type: 'project', link, email: true });
      }
    } catch (_) { /* ignore notify errors */ }

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
    // Track changes for notifications (novice style)
    const prevAssigned = p.assignedTo ? String(p.assignedTo) : '';
    const prevStatus = p.status;
    const nextAssigned = updates.assignedTo ? String(updates.assignedTo) : prevAssigned;
    const assignedChanged = updates.assignedTo !== undefined && nextAssigned !== prevAssigned && !!updates.assignedTo;

    const saved = await Project.findByIdAndUpdate(p._id, updates, { new: true, runValidators: true })
      .populate('createdBy', 'name accountType employer.companyName skilledWorker.fullName')
      .populate('assignedTo', 'name accountType skilledWorker.fullName');

    // If project is marked completed, reflect completion on related job/invite (novice/simple sync)
    if ((updates.status && updates.status === 'completed') || saved.status === 'completed') {
      try {
        if (saved.job) {
          await Invite.updateMany({ job: saved.job, worker: saved.assignedTo }, { status: 'completed' });
          await Job.findByIdAndUpdate(saved.job, { isActive: false });
        }
        // Notify both sides about completion
        try {
          const link = `/app/projects/${saved._id}`;
          if (saved.createdBy) { await notify({ userId: saved.createdBy, title: 'Project completed', message: `${saved.title || 'Project'} was marked completed`, type: 'project', link, email: true }); }
          if (saved.assignedTo) { await notify({ userId: saved.assignedTo, title: 'Project completed', message: `${saved.title || 'Project'} was marked completed`, type: 'project', link, email: true }); }
        } catch (_) { }
      } catch (_) {
        // swallow sync errors to avoid blocking response
      }
    }

    // If assignedTo changed, notify the new assignee
    if (assignedChanged) {
      try {
        const link = `/app/projects/${saved._id}`;
        await notify({ userId: updates.assignedTo, title: 'Assigned to project', message: `You were assigned to ${saved.title || 'a project'}`, type: 'project', link, email: true });
      } catch (_) { }
    }
    res.json({ project: saved });
  } catch (err) { next(err); }
}

// Simple helper: load the current user and the project and check membership
async function getProjectIfMember(req) {
  requireAuth(req);
  const user = await User.findById(req.userId);
  if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }

  // No populate needed here; we just need ids for checks
  const project = await Project.findById(req.params.id);
  if (!project) { const e = new Error('Project not found'); e.status = 404; throw e; }

  // Is the viewer part of this project?
  const viewerId = String(req.userId);
  const createdById = project.createdBy ? String(project.createdBy) : '';
  const assignedToId = project.assignedTo ? String(project.assignedTo) : '';
  const isCreator = createdById === viewerId;
  const isAssignee = assignedToId === viewerId;

  if (!isCreator && !isAssignee) {
    const e = new Error('Not authorized'); e.status = 403; throw e;
  }

  return { project, user, isCreator, isAssignee };
}

// Messages
async function getProjectMessages(req, res, next) {
  try {
  const ctx = await getProjectIfMember(req);
  const p = ctx.project;
    // return newest last
    const messages = [...p.messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json({ messages });
  } catch (err) { next(err); }
}

async function addProjectMessage(req, res, next) {
  try {
  const ctx = await getProjectIfMember(req);
  const p = ctx.project;
    const text = (req.body && String(req.body.text || '')).trim();
    if (!text) { const e = new Error('text is required'); e.status = 400; throw e; }
    p.messages.push({ sender: req.userId, text, createdAt: new Date() });
    await p.save();
    const last = p.messages[p.messages.length - 1];
    // Notify the other party about new message (beginner style)
    try {
      const link = `/app/projects/${p._id}`;
      const senderId = String(req.userId);
      const toUser = String(p.createdBy) === senderId ? p.assignedTo : p.createdBy;
      if (toUser) {
        await notify({ userId: toUser, title: 'New project message', message: 'You have a new message on a project', type: 'project', link, email: true });
      }
    } catch (_) { /* ignore notify errors */ }
    res.status(201).json({ message: last });
  } catch (err) { next(err); }
}

// File submissions (simple file sharing)
async function getProjectSubmissions(req, res, next) {
  try {
  const ctx = await getProjectIfMember(req);
  const p = ctx.project;
    res.json({ submissions: p.submissions || [] });
  } catch (err) { next(err); }
}

async function addProjectSubmission(req, res, next) {
  try {
  const ctx = await getProjectIfMember(req);
  const p = ctx.project;
  const body = req.body || {};
  const filename = body.filename;
  const url = body.url;
  const note = body.note;
    if (!url) { const e = new Error('url is required'); e.status = 400; throw e; }
    p.submissions.push({ filename, url, note, uploadedAt: new Date() });
    await p.save();
    const file = p.submissions[p.submissions.length - 1];
    // Notify the other party about new submission
    try {
      const link = `/app/projects/${p._id}`;
      const actor = String(req.userId);
      const toUser = String(p.createdBy) === actor ? p.assignedTo : p.createdBy;
      if (toUser) {
        await notify({ userId: toUser, title: 'New file submission', message: 'A new file was submitted on your project', type: 'project', link, email: true });
      }
    } catch (_) { }
    res.status(201).json({ submission: file });
  } catch (err) { next(err); }
}

async function deleteProjectSubmission(req, res, next) {
  try {
  const ctx = await getProjectIfMember(req);
  const p = ctx.project;
    const id = req.params.submissionId;
    const sub = p.submissions.id(id);
    if (!sub) { const e = new Error('Submission not found'); e.status = 404; throw e; }
    sub.deleteOne();
    await p.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// Milestones
async function updateMilestone(req, res, next) {
  try {
    const ctx = await getProjectIfMember(req);
    const p = ctx.project;
    const isCreator = ctx.isCreator;
    const isAssignee = ctx.isAssignee;
    const user = ctx.user;
    const m = p.milestones.id(req.params.milestoneId);
    if (!m) { const e = new Error('Milestone not found'); e.status = 404; throw e; }
    // Beginner-friendly role checks
    const body = req.body || {};
    if (isAssignee && !isCreator && user.accountType === 'skilled_worker') {
      // Worker: can only move their own milestone to in_progress or submitted
      if (body.status !== 'in_progress' && body.status !== 'submitted') {
        const e = new Error('Workers can only set status to in_progress or submitted'); e.status = 403; throw e;
      }
      m.status = body.status;
    } else if (isCreator && user.accountType === 'employer') {
      // Employer (creator): can edit all basic fields including approving
      if (body.title !== undefined) m.title = body.title;
      if (body.description !== undefined) m.description = body.description;
      if (body.deadline !== undefined) m.deadline = body.deadline;
      if (body.status !== undefined) m.status = body.status;
    } else {
      const e = new Error('Not authorized to edit milestone'); e.status = 403; throw e;
    }
    await p.save();
    // Send simple notifications for submit/approve events
    try {
      const link = `/app/projects/${p._id}`;
      if (user.accountType === 'skilled_worker' && m.status === 'submitted') {
        // worker submitted -> notify employer (creator)
        if (p.createdBy) {
          await notify({ userId: p.createdBy, title: 'Milestone submitted', message: `A milestone was submitted on ${p.title || 'a project'}`, type: 'project', link, email: true });
        }
      }
      if (user.accountType === 'employer' && m.status === 'approved') {
        // employer approved -> notify worker (assignee)
        if (p.assignedTo) {
          await notify({ userId: p.assignedTo, title: 'Milestone approved', message: `A milestone was approved on ${p.title || 'your project'}`, type: 'project', link, email: true });
        }
      }
    } catch (_) { }
    res.json({ milestone: m });
  } catch (err) { next(err); }
}

// Actions: request payment, extend deadline, contact support
async function requestPayment(req, res, next) {
  try {
  const ctx = await getProjectIfMember(req);
  const p = ctx.project;
  const isAssignee = ctx.isAssignee;
  if (!isAssignee) { const e = new Error('Only assigned user can request payment'); e.status = 403; throw e; }
    const body = req.body || {};
  const amount = Number(body.amount || 0);
  if (!(amount > 0)) { const e = new Error('amount is required'); e.status = 400; throw e; }
    const text = body.text;
    p.events.push({ type: 'payment_request', createdBy: req.userId, text, data: { amount } });
    await p.save();
    const ev = p.events[p.events.length - 1];
    // Notify employer (project creator)
    try {
      const link = `/app/projects/${p._id}`;
      if (p.createdBy) {
        await notify({ userId: p.createdBy, title: 'Payment requested', message: `Worker requested payment of ${amount}`, type: 'project', link, email: true });
      }
    } catch (_) { }
    res.status(201).json({ event: ev });
  } catch (err) { next(err); }
}

async function extendDeadline(req, res, next) {
  try {
  const ctx = await getProjectIfMember(req);
  const p = ctx.project;
  const isCreator = ctx.isCreator;
  const user = ctx.user;
  if (!(isCreator && user.accountType === 'employer')) { const e = new Error('Only project creator (employer) can extend deadline'); e.status = 403; throw e; }
    const current = p.deadline;
    let to = null;
    if (req.body && req.body.deadline) { to = new Date(req.body.deadline); }
    if (!to || Number.isNaN(+to)) { const e = new Error('deadline is required'); e.status = 400; throw e; }
    p.deadline = to;
    const text = req.body && req.body.text ? req.body.text : undefined;
    p.events.push({ type: 'deadline_extension', createdBy: req.userId, data: { from: current, to }, text: text });
    await p.save();
    // Notify assigned worker that the deadline was extended
    try {
      const link = `/app/projects/${p._id}`;
      if (p.assignedTo) {
        await notify({ userId: p.assignedTo, title: 'Deadline extended', message: `Deadline was changed on ${p.title || 'your project'}`, type: 'project', link, email: true });
      }
    } catch (_) { }
    res.json({ project: p });
  } catch (err) { next(err); }
}

async function contactSupport(req, res, next) {
  try {
  const ctx = await getProjectIfMember(req);
  const p = ctx.project;
    const text = (req.body && String(req.body.text || '')).trim();
    if (!text) { const e = new Error('text is required'); e.status = 400; throw e; }
    p.events.push({ type: 'support', createdBy: req.userId, text });
    await p.save();
    const ev = p.events[p.events.length - 1];
    res.status(201).json({ event: ev });
  } catch (err) { next(err); }
}

// Workers can request a deadline extension without modifying the date
async function requestDeadlineExtension(req, res, next) {
  try {
  const ctx = await getProjectIfMember(req);
  const p = ctx.project;
  const isAssignee = ctx.isAssignee;
  if (!isAssignee) { const e = new Error('Only assigned user can request deadline extension'); e.status = 403; throw e; }
  const body = req.body || {};
  const proposedDate = body.proposedDate;
  const text = body.text || 'Worker requested deadline extension';
  p.events.push({ type: 'deadline_extension', createdBy: req.userId, data: { proposedDate }, text: text });
    await p.save();
    const ev = p.events[p.events.length - 1];
    // Notify employer about request
    try {
      const link = `/app/projects/${p._id}`;
      if (p.createdBy) {
        await notify({ userId: p.createdBy, title: 'Deadline extension requested', message: 'Worker requested a deadline extension', type: 'project', link, email: true });
      }
    } catch (_) { }
    res.status(201).json({ event: ev });
  } catch (err) { next(err); }
}

// Approve a specific deadline extension request (creator/employer only)
// POST /api/projects/:id/actions/approve-deadline-extension/:eventId
async function approveDeadlineExtension(req, res, next) {
  try {
    const ctx = await getProjectIfMember(req);
    const p = ctx.project;
    const isCreator = ctx.isCreator;
    const user = ctx.user;
    if (!(isCreator && user.accountType === 'employer')) { const e = new Error('Only project creator (employer) can approve deadline extension'); e.status = 403; throw e; }

    const eventId = req.params.eventId;
    const ev = p.events.id(eventId);
    if (!ev || ev.type !== 'deadline_extension') { const e = new Error('Deadline extension request not found'); e.status = 404; throw e; }

    // Prefer proposedDate stored in the request event; allow override via body.deadline
    let to = ev?.data?.proposedDate ? new Date(ev.data.proposedDate) : null;
    if (req.body && req.body.deadline) { to = new Date(req.body.deadline); }
    if (!to || Number.isNaN(+to)) { const e = new Error('Valid deadline is required to approve'); e.status = 400; throw e; }

    const from = p.deadline || null;
    p.deadline = to;

    // Mark the original request as approved inside its data blob
    ev.data = { ...(ev.data || {}), approved: true, approvedAt: new Date(), approvedBy: req.userId, appliedTo: to };

    // Log an approval event (reuse same type for simplicity)
    const text = req.body && req.body.text ? req.body.text : 'Deadline extension approved';
    p.events.push({ type: 'deadline_extension', createdBy: req.userId, text, data: { from, to, requestId: eventId, approved: true } });
    await p.save();

    const approval = p.events[p.events.length - 1];
    // Notify worker that the extension was approved
    try {
      const link = `/app/projects/${p._id}`;
      if (p.assignedTo) {
        await notify({ userId: p.assignedTo, title: 'Deadline extension approved', message: 'Your deadline extension request was approved', type: 'project', link, email: true });
      }
    } catch (_) { }
    res.json({ project: p, event: approval });
  } catch (err) { next(err); }
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  // new endpoints
  getProjectMessages,
  addProjectMessage,
  getProjectSubmissions,
  addProjectSubmission,
  deleteProjectSubmission,
  updateMilestone,
  requestPayment,
  extendDeadline,
  contactSupport,
  requestDeadlineExtension
  ,approveDeadlineExtension
};
