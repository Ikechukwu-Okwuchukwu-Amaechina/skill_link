const { Router } = require('express');
const { sendOtp, verifyOtp, register, login, me, updateProfile, employerBasic, employerDetails, employerTrust } = require('../../controllers/authController');
const { auth } = require('../../middleware/auth');
const { uploadAny } = require('../../middleware/upload');

const router = Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, me);
router.patch('/profile', auth, updateProfile);
router.patch('/profile/employer/basic', auth, employerBasic);
router.patch('/profile/employer/details', auth, employerDetails);
// Accept both JSON and multipart/form-data with files[] for verification docs
router.patch('/profile/employer/trust', auth, uploadAny.array('files'), employerTrust);

module.exports = router;
