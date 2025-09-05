const User = require('../models/User');

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

module.exports = { listWorkers, getWorker };
