const express = require('express');
const router = express.Router();
const { upload, uploadPhotos } = require('../controllers/uploadController');

// POST upload photos (max 10)
router.post('/photos', upload.array('photos', 10), uploadPhotos);

module.exports = router;