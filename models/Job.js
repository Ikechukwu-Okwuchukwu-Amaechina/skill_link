const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    min: { type: Number, min: 0, required: true },
    max: { type: Number, min: 0, required: true }
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    budgetRange: { type: budgetSchema, required: true },
    timeline: { type: String, trim: true }, // free-text timeline/deadline
    requiredSkills: { type: [String], default: [], set: v => Array.isArray(v) ? v : (typeof v === 'string' && v ? v.split(',').map(s => s.trim()).filter(Boolean) : []) },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Job', jobSchema);
