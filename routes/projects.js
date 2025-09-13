const { Router } = require('express');
const { auth } = require('../middleware/auth');
const {
	listProjects,
	getProject,
	createProject,
	updateProject,
	getProjectMessages,
	addProjectMessage,
	getProjectSubmissions,
	addProjectSubmission,
	deleteProjectSubmission,
	updateMilestone,
	requestPayment,
	extendDeadline,
		contactSupport,
		requestDeadlineExtension
	,approveDeadlineExtension
} = require('../controllers/projectController');

const router = Router();

// List projects for current user
router.get('/', auth, listProjects);

// Create a new project (very simple)
router.post('/', auth, createProject);

// Get one project by id
router.get('/:id', auth, getProject);

// Update a project (creator only)
router.patch('/:id', auth, updateProject);

// Messages
router.get('/:id/messages', auth, getProjectMessages);
router.post('/:id/messages', auth, addProjectMessage);

// File sharing (submissions)
router.get('/:id/submissions', auth, getProjectSubmissions);
router.post('/:id/submissions', auth, addProjectSubmission);
router.delete('/:id/submissions/:submissionId', auth, deleteProjectSubmission);

// Milestones
router.patch('/:id/milestones/:milestoneId', auth, updateMilestone);

// Quick actions
router.post('/:id/actions/request-payment', auth, requestPayment);
router.post('/:id/actions/extend-deadline', auth, extendDeadline);
router.post('/:id/actions/contact-support', auth, contactSupport);
// Worker can request extension without changing the date immediately
router.post('/:id/actions/request-deadline-extension', auth, requestDeadlineExtension);
router.post('/:id/actions/approve-deadline-extension/:eventId', auth, approveDeadlineExtension);

// Simple seed: creates a demo project similar to the screenshot (for testing quickly)
router.post('/seed/demo', auth, async (req, res, next) => {
	try {
		// Reuse controller by passing a ready-made body
		req.body = {
			title: 'Plumbing',
			category: 'Plumbing',
			budget: 5000,
			currency: 'NGN',
			deadline: new Date('2025-08-20T00:00:00Z'),
			milestones: [
				{ title: 'Site Inspection', description: 'Assess plumbing requirements for the property.', deadline: new Date('2025-08-20'), status: 'submitted' },
				{ title: 'Pipe Installation', description: 'Install and connect all water supply and drainage pipe.', deadline: new Date('2025-08-20'), status: 'in_progress' },
				{ title: 'Final Check & Testing', description: 'Inspect all systems, fix leaks, and ensure full functionality.', deadline: new Date('2025-08-26'), status: 'not_started' }
			]
		};
		return createProject(req, res, next);
	} catch (e) { next(e); }
});

module.exports = router;
