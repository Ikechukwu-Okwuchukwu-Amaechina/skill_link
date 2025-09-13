const mongoose = require('mongoose');

// Super simple payments/transactions model (novice-friendly)
// - type: 'earning' for money earned on projects, 'withdrawal' when worker cashes out
// - type: 'deposit' for employer funding their wallet
// - status for withdrawal: pending -> completed (no gateway integration here)
// - employer and project are optional for withdrawals
const paymentSchema = new mongoose.Schema(
  {
    // Worker required for 'earning' and 'withdrawal' records
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: function () {
        return this.type === 'earning' || this.type === 'withdrawal';
      }
    },
    // Employer required for 'earning' and 'deposit' records
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.type === 'earning' || this.type === 'deposit';
      }
    },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },
    type: { type: String, enum: ['earning', 'withdrawal', 'deposit'], required: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'completed' },
    note: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
