const express = require('express');
const router = express.Router();
const { claimRedeemCode } = require('../controllers/redeemController');
const { protect } = require('../middleware/authMiddleware');

router.post('/claim', protect, claimRedeemCode);

module.exports = router;
