const { Router } = require('express');
const { listWorkers, getWorker, workersMeta } = require('../controllers/workerController');

const router = Router();

router.get('/public', listWorkers);
router.get('/meta', workersMeta);
router.get('/:id', getWorker);

module.exports = router;
