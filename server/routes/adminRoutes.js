const express = require('express');
const router = express.Router();
const {
  getAdminStats,
  getUsers,
  deleteUser,
  updateUserPlan,
  toggleBlockUser,
  getPlans,
  updatePlanLimits,
  generateRedeemCodes,
  getRedeemCodes,
  deleteRedeemCode,
  createCustomRedeemCode,
  getModels,
  updateModel,
  addModel,
  deleteModel,
  reorderModels,
  getSettings,
  updateSettings
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

// All routes are protected by Auth + Admin Role Check
router.use(protect);
router.use(adminOnly);

router.get('/stats', getAdminStats);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.get('/users', getUsers);
router.delete('/users/:userId', deleteUser);
router.put('/users/:userId/plan', updateUserPlan);
router.put('/users/:userId/block', toggleBlockUser);

router.get('/plans', getPlans);
router.put('/plans/:planName', updatePlanLimits);

router.post('/redeem/generate', generateRedeemCodes);
router.post('/redeem/custom', createCustomRedeemCode);
router.get('/redeem/list', getRedeemCodes);
router.delete('/redeem/:codeId', deleteRedeemCode);

router.get('/models', getModels);
router.post('/models', addModel);
router.put('/models/reorder', reorderModels);
router.put('/models/:modelId(*)', updateModel);
router.delete('/models/:modelId(*)', deleteModel);

module.exports = router;
