const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    publicFeedback: { type: String, trim: true },
    privateFeedback: { type: String, trim: true }
  },
  { timestamps: true }
);

// Prevent duplicate reviews per project from the same reviewer to the same reviewee
reviewSchema.index({ project: 1, reviewer: 1, reviewee: 1 }, { unique: true });

reviewSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Review', reviewSchema);
