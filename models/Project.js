const mongoose = require('mongoose');

// Beginner-friendly project model to back the Project Management UI
// Fields cover the screenshot: budget, deadline, progress, milestones,
// submissions, conversation, and basic relations.

const milestoneSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    deadline: { type: Date },
    // UI badges like: Not Started, In Progress, Submitted, Approved
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'submitted', 'approved'],
      default: 'not_started'
    }
  },
  { _id: true, timestamps: true }
);

const submissionSchema = new mongoose.Schema(
  {
    filename: { type: String, trim: true },
    url: { type: String, required: true, trim: true },
    note: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

// Lightweight project events for actions like request payment, extend deadline, etc.
const eventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['payment_request', 'deadline_extension', 'support'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, trim: true },
    data: { type: Object },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true }, // e.g., Plumbing

    // Overview
    budget: { type: Number, min: 0, default: 0 }, // store numeric amount (e.g., 5000)
    currency: { type: String, default: 'NGN' },
    deadline: { type: Date },
    progress: { type: Number, min: 0, max: 100, default: 0 },

    // People
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Optional link back to the originating Job
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', index: true },

    // Details
    milestones: { type: [milestoneSchema], default: [] },
    submissions: { type: [submissionSchema], default: [] },
    messages: { type: [messageSchema], default: [] },

  // Events history for simple auditing of key actions
  events: { type: [eventSchema], default: [] },

    // Overall status
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' }
  },
  { timestamps: true }
);

// Clean JSON output
projectSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Project', projectSchema);
