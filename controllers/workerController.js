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

module.exports = { listWorkers, getWorker, workersMeta };
