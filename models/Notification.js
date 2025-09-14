const mongoose = require('mongoose');

// Very simple notification schema (beginner friendly)
// Each notification belongs to one user and can optionally include a link
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Copy of user's account type at creation time to separate worker vs employer views
    accountType: { type: String, enum: ['skilled_worker', 'employer'], required: true, index: true },

    title: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, enum: ['system', 'job', 'invite', 'application', 'project'], default: 'system', index: true },
    link: { type: String, trim: true }, // e.g., /app/invites/123 or /app/jobs/xyz
    meta: { type: Object },

    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
