const { Router } = require('express');
const { auth } = require('../middleware/auth');
const { createReview, listWorkerReviews, listEmployerReviews, listMyReviews } = require('../controllers/reviewController');

const router = Router();

// Create a review (auth required)
router.post('/', auth, createReview);

// Public: list reviews for a worker
router.get('/worker/:id', listWorkerReviews);

// Public: list reviews for an employer
router.get('/employer/:id', listEmployerReviews);

// Reviewer history (auth required)
router.get('/history/me', auth, listMyReviews);

module.exports = router;
