const Review = require('../models/Review');
const Project = require('../models/Project');
const User = require('../models/User');

function requireAuth(req) {
  if (!req.userId) { const e = new Error('Authentication required'); e.status = 401; throw e; }
}

// POST /api/reviews
// body: { projectId, rating, publicFeedback?, privateFeedback? }
async function createReview(req, res, next) {
  try {
    requireAuth(req);
    const { projectId, rating, publicFeedback, privateFeedback } = req.body || {};
    if (!projectId || !rating) { const e = new Error('projectId and rating are required'); e.status = 400; throw e; }
    if (rating < 1 || rating > 5) { const e = new Error('rating must be between 1 and 5'); e.status = 400; throw e; }

    const project = await Project.findById(projectId);
    if (!project) { const e = new Error('Project not found'); e.status = 404; throw e; }

    // Only participants can review each other and only when completed
    const isParticipant = [project.createdBy?.toString(), project.assignedTo?.toString()].includes(String(req.userId));
    if (!isParticipant) { const e = new Error('Not authorized to review for this project'); e.status = 403; throw e; }
    if (project.status !== 'completed') { const e = new Error('Project is not completed'); e.status = 400; throw e; }

    // Determine reviewee as the other participant
    const revieweeId = project.createdBy?.toString() === String(req.userId) ? project.assignedTo?.toString() : project.createdBy?.toString();

    // Guard: prevent duplicate reviews from the same reviewer to the same reviewee for the same project
    const existing = await Review.findOne({ project: project._id, reviewer: req.userId, reviewee: revieweeId });
    if (existing) { const e = new Error('You have already reviewed this user for this project'); e.status = 409; throw e; }

    const doc = await Review.create({ project: project._id, reviewer: req.userId, reviewee: revieweeId, rating, publicFeedback, privateFeedback });
    const populated = await Review.findById(doc._id)
      .populate('project', 'title')
      .populate('reviewer', 'name accountType')
      .populate('reviewee', 'name accountType');
    res.status(201).json({ review: populated });
  } catch (err) { next(err); }
}

// GET /api/reviews/worker/:id
// List public reviews for a worker (reviewee)
async function listWorkerReviews(req, res, next) {
  try {
    const workerId = req.params.id;
    const reviews = await Review.find({ reviewee: workerId })
      .sort({ createdAt: -1 })
      .populate('project', 'title')
      .populate('reviewer', 'name');

    // Aggregate avg rating
    const agg = await Review.aggregate([
      { $match: { reviewee: new (require('mongoose').Types.ObjectId)(workerId) } },
      { $group: { _id: '$reviewee', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const stats = agg[0] ? { average: Number(agg[0].avgRating.toFixed(2)), count: agg[0].count } : { average: 0, count: 0 };

    res.json({ reviews, stats });
  } catch (err) { next(err); }
}

// GET /api/reviews/employer/:id
// List public reviews for an employer (reviewee)
async function listEmployerReviews(req, res, next) {
  try {
    const employerId = req.params.id;
    const reviews = await Review.find({ reviewee: employerId })
      .sort({ createdAt: -1 })
      .populate('project', 'title')
      .populate('reviewer', 'name');

    const agg = await Review.aggregate([
      { $match: { reviewee: new (require('mongoose').Types.ObjectId)(employerId) } },
      { $group: { _id: '$reviewee', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const stats = agg[0] ? { average: Number(agg[0].avgRating.toFixed(2)), count: agg[0].count } : { average: 0, count: 0 };

    res.json({ reviews, stats });
  } catch (err) { next(err); }
}

// GET /api/reviews/history
// Reviews authored by current user
async function listMyReviews(req, res, next) {
  try {
    requireAuth(req);
    const reviews = await Review.find({ reviewer: req.userId })
      .sort({ createdAt: -1 })
      .populate('project', 'title')
      .populate('reviewee', 'name');
    res.json({ reviews });
  } catch (err) { next(err); }
}

module.exports = { createReview, listWorkerReviews, listEmployerReviews, listMyReviews };
