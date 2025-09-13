const { Router } = require('express');
const { auth } = require('../middleware/auth');
const { createReview, listWorkerReviews, listMyReviews } = require('../controllers/reviewController');

const router = Router();

// Create a review (auth required)
router.post('/', auth, createReview);

// Public: list reviews for a worker
router.get('/worker/:id', listWorkerReviews);

// Reviewer history (auth required)
router.get('/history/me', auth, listMyReviews);

module.exports = router;
