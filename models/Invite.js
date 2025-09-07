const mongoose = require('mongoose');

// Invite/Application model supporting two flows:
// - type = 'invite': employer invites a worker to a job (status: pending -> accepted/declined -> approved)
// - type = 'application': worker applies to a job (status: applied -> approved/declined)
const inviteSchema = new mongoose.Schema(
  {
    employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    message: { type: String, trim: true },
    type: { type: String, enum: ['invite', 'application'], default: 'invite', index: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'applied', 'approved'], default: 'pending', index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invite', inviteSchema);
