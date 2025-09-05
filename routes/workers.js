const { Router } = require('express');
const { listWorkers, getWorker } = require('../controllers/workerController');

const router = Router();

router.get('/public', listWorkers);
router.get('/:id', getWorker);

module.exports = router;
