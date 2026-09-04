const express = require('express');
const router = express.Router();
const {
  getAdminStats,
  getUsers,
  updateUserPlan,
  toggleBlockUser,
  getPlans,
  updatePlanLimits,
  generateRedeemCodes,
  getRedeemCodes,
  deleteRedeemCode,
  getModels,
  updateModel,
  addModel,
  deleteModel,
  reorderModels
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

// All routes are protected by Auth + Admin Role Check
router.use(protect);
router.use(adminOnly);

router.get('/stats', getAdminStats);
router.get('/users', getUsers);
router.put('/users/:userId/plan', updateUserPlan);
router.put('/users/:userId/block', toggleBlockUser);

router.get('/plans', getPlans);
router.put('/plans/:planName', updatePlanLimits);

router.post('/redeem/generate', generateRedeemCodes);
router.get('/redeem/list', getRedeemCodes);
router.delete('/redeem/:codeId', deleteRedeemCode);

router.get('/models', getModels);
router.post('/models', addModel);
router.put('/models/reorder', reorderModels);
router.put('/models/:modelId(*)', updateModel);
router.delete('/models/:modelId(*)', deleteModel);

module.exports = router;
