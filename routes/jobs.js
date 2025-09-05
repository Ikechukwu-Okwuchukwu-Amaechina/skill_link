const { Router } = require('express');
const { auth } = require('../middleware/auth');
const { createJob, listMyJobs, getJob, updateJob, deleteJob } = require('../controllers/jobController');

const router = Router();

router.post('/', auth, createJob);
router.get('/', auth, listMyJobs);
router.get('/:id', auth, getJob);
router.patch('/:id', auth, updateJob);
router.delete('/:id', auth, deleteJob);

module.exports = router;
