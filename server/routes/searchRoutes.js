const express = require('express');
const router = express.Router();
const { searchDuckDuckGo } = require('../controllers/searchController');

router.get('/', searchDuckDuckGo);

module.exports = router;
