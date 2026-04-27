const express = require('express');
const router = express.Router();
const {
  getAllTemplates,
  getTemplatesByCategory,
  getTemplateBySlug,
  seedTemplates
} = require('../controllers/templateController');

// GET all templates
router.get('/', getAllTemplates);

// GET by category → personal | business
router.get('/category/:category', getTemplatesByCategory);

// GET single template by slug
router.get('/:slug', getTemplateBySlug);

// POST seed all 8 templates (run once)
router.post('/seed', seedTemplates);

module.exports = router;