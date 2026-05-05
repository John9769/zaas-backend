const express = require('express');
const router = express.Router();
const { wavespeedWebhook } = require('../controllers/webhookController');

// POST Wavespeed webhook
router.post('/wavespeed', wavespeedWebhook);

module.exports = router;