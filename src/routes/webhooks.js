const express = require('express');
const router = express.Router();
const { falaiWebhook } = require('../controllers/webhookController');

// POST fal.ai webhook
router.post('/falai', falaiWebhook);

module.exports = router;