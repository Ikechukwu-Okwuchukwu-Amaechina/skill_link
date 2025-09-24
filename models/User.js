const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Very simple user model (beginner friendly)
// - Call setPassword('plain') to store a hash
// - Use checkPassword('plain') to verify
const userSchema = new mongoose.Schema(
  {
    // Backward compatible field used by existing tests; we'll also support firstname/lastname
    name: { type: String, required: true, trim: true },
    firstname: { type: String, trim: true },
    lastname: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },

    // Account type to distinguish between skilled workers and employers
    accountType: { type: String, enum: ['skilled_worker', 'employer'], default: 'skilled_worker', index: true },

    // Skilled worker specific profile fields (optional when accountType === 'employer')
    skilledWorker: {
      profileImage: { type: String, trim: true }, // URL to uploaded avatar
      fullName: { type: String, trim: true }, // mirrors name, but kept explicit for UI mapping
      location: { type: String, trim: true },
      contactPreference: { type: String, trim: true }, // e.g., phone, email, in-app chat

      professionalTitle: { type: String, trim: true },
      primarySkills: { type: [String], default: [], set: v => Array.isArray(v) ? v : (typeof v === 'string' && v ? v.split(',').map(s => s.trim()).filter(Boolean) : []) },
      yearsOfExperience: { type: Number, min: 0, max: 60 },
      languagesSpoken: { type: [String], default: [], set: v => Array.isArray(v) ? v : (typeof v === 'string' && v ? v.split(',').map(s => s.trim()).filter(Boolean) : []) },

  // Discovery fields for marketplace
  hourlyRate: { type: Number, min: 0 },
  availability: { type: String, trim: true }, // e.g., 'full-time', 'part-time', 'weekends'
  rating: { type: Number, min: 0, max: 5 },

      // Portfolio: list of media with optional captions
      portfolioSamples: {
        type: [
          new mongoose.Schema(
            {
              url: { type: String, required: true, trim: true },
              caption: { type: String, trim: true },
              mediaType: { type: String, enum: ['image', 'video'], default: 'image' }
            },
            { _id: false }
          )
        ],
        default: []
      },

      // Certifications or licenses: store label and file URL
      certifications: {
        type: [
          new mongoose.Schema(
            {
              label: { type: String, trim: true },
              fileUrl: { type: String, trim: true }
            },
            { _id: false }
          )
        ],
        default: []
      },

      ninDocument: { type: String, trim: true }, // URL or identifier for uploaded NIN
      shortBio: { type: String, trim: true, maxlength: 250 }
    },

    // Employer specific profile fields (optional when accountType === 'skilled_worker')
    employer: {
      companyName: { type: String, trim: true },
      companyLogo: { type: String, trim: true },
      location: { type: String, trim: true },
      contactPreference: { type: String, trim: true },
      industry: { type: [String], default: [], set: v => Array.isArray(v) ? v : (typeof v === 'string' && v ? v.split(',').map(s => s.trim()).filter(Boolean) : []) },
      website: { type: String, trim: true },
      companySize: { type: String, enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'], trim: true },
      shortBio: { type: String, trim: true, maxlength: 250 },
      verificationDocs: {
        type: [
          new mongoose.Schema(
            {
              label: { type: String, trim: true },
              fileUrl: { type: String, trim: true }
            },
            { _id: false }
          )
        ],
        default: []
      }
    }
  },
  { timestamps: true }
);

// Set password by creating a hash (synchronous and easy to read)
userSchema.methods.setPassword = function (plainPassword) {
  if (typeof plainPassword !== 'string' || plainPassword.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  const saltRounds = 10; // simple default
  this.passwordHash = bcrypt.hashSync(plainPassword, saltRounds);
};

// Check if the password matches
userSchema.methods.checkPassword = function (plainPassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compareSync(plainPassword, this.passwordHash);
};

// Hide sensitive fields when converting to JSON
userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
// Auto-generate name from firstname/lastname on save
userSchema.pre('save', function (next) {
  try {
    if (this.isModified('firstname') || this.isModified('lastname') || !this.name) {
      const fname = this.firstname || '';
      const lname = this.lastname || '';
      const combined = [fname, lname].filter(Boolean).join(' ').trim();
      if (combined) this.name = combined;
    }
    next();
  } catch (e) {
    next(e);
  }
});

// Keep name in sync on updates like findByIdAndUpdate / findOneAndUpdate
userSchema.pre('findOneAndUpdate', async function (next) {
  try {
    const update = this.getUpdate() || {};
    const $set = update.$set || {};

    // If caller explicitly sets name, respect it.
    const setsName = update.name !== undefined || $set.name !== undefined;
    const touchesFirstOrLast =
      update.firstname !== undefined ||
      update.lastname !== undefined ||
      $set.firstname !== undefined ||
      $set.lastname !== undefined;

    if (!setsName && touchesFirstOrLast) {
      const current = await this.model.findOne(this.getQuery());
      const fname = (update.firstname ?? $set.firstname ?? current?.firstname) || '';
      const lname = (update.lastname ?? $set.lastname ?? current?.lastname) || '';
      const combined = [fname, lname].filter(Boolean).join(' ').trim();
      if (combined) {
        if (update.$set) update.$set.name = combined; else update.name = combined;
        this.setUpdate(update);
      }
    }
    next();
  } catch (e) {
    next(e);
  }
});
