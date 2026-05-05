const prisma = require('../utils/prisma');

// ============================================
// GET ALL TEMPLATES
// ============================================
const getAllTemplates = async (req, res) => {
  try {
    const templates = await prisma.template.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' }
    });
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('getAllTemplates error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
};

// ============================================
// GET TEMPLATES BY CATEGORY
// casual | product
// ============================================
const getTemplatesByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    if (!['casual', 'product'].includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Category must be casual or product'
      });
    }

    const templates = await prisma.template.findMany({
      where: { category, is_active: true },
      orderBy: { sort_order: 'asc' }
    });

    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('getTemplatesByCategory error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
};

// ============================================
// GET TEMPLATE BY SLUG
// ============================================
const getTemplateBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const template = await prisma.template.findUnique({ where: { slug } });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('getTemplateBySlug error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch template' });
  }
};

// ============================================
// SEED TEMPLATES — RUN ONCE
// 6 casual niches + 1 product = 7 templates
// ============================================
const seedTemplates = async (req, res) => {
  try {
    await prisma.template.deleteMany();

    const templates = [
      // ==================
      // CASUAL — RM29.99
      // ==================
      {
        name: 'Wedding Memories',
        slug: 'wedding-memories',
        category: 'casual',
        niche: 'wedding',
        tagline: 'Turn your wedding photos into cinematic magic',
        description: 'Transform your most precious day into a romantic cinematic masterpiece with golden tones and emotional depth.',
        best_for: 'Weddings, solemnizations, receptions, nikah',
        preview_url: null,
        thumbnail_url: null,
        price: 29.99,
        sort_order: 1,
        is_active: true
      },
      {
        name: 'Birthday Vibes',
        slug: 'birthday-vibes',
        category: 'casual',
        niche: 'birthday',
        tagline: 'Celebrate every moment in cinematic style',
        description: 'Bring your happiest celebrations to life with bright, playful energy and joyful cinematic motion.',
        best_for: 'Birthdays, surprise parties, kids celebrations',
        preview_url: null,
        thumbnail_url: null,
        price: 29.99,
        sort_order: 2,
        is_active: true
      },
      {
        name: 'Wanderlust',
        slug: 'wanderlust',
        category: 'casual',
        niche: 'travel',
        tagline: 'Relive your greatest adventures',
        description: 'Turn your travel photos into epic cinematic journeys with sweeping landscapes and adventure energy.',
        best_for: 'Travel photos, holidays, outdoor adventures, UK trips',
        preview_url: null,
        thumbnail_url: null,
        price: 29.99,
        sort_order: 3,
        is_active: true
      },
      {
        name: 'Festive Moments',
        slug: 'festive-moments',
        category: 'casual',
        niche: 'festive',
        tagline: 'Celebrate your culture in cinematic glory',
        description: 'Capture the warmth and joy of Malaysian festivities with golden light and cultural richness.',
        best_for: 'Hari Raya, CNY, Deepavali, Thaipusam, festive gatherings',
        preview_url: null,
        thumbnail_url: null,
        price: 29.99,
        sort_order: 4,
        is_active: true
      },
      {
        name: 'Graduation Glory',
        slug: 'graduation-glory',
        category: 'casual',
        niche: 'graduation',
        tagline: 'Your achievement deserves a cinematic tribute',
        description: 'Immortalise your proudest academic milestone with inspiring motion and celebratory energy.',
        best_for: 'Graduation ceremonies, convocation, SPM results, degree completion',
        preview_url: null,
        thumbnail_url: null,
        price: 29.99,
        sort_order: 5,
        is_active: true
      },
      {
        name: 'Just Me',
        slug: 'just-me',
        category: 'casual',
        niche: 'me',
        tagline: 'Your personal cinematic intro video',
        description: 'Create a stunning personal profile video for LinkedIn, resume, social media or just for yourself.',
        best_for: 'Personal branding, LinkedIn profile, resume video, solo portraits',
        preview_url: null,
        thumbnail_url: null,
        price: 29.99,
        sort_order: 6,
        is_active: true
      },

      // ==================
      // PRODUCT — RM49.99
      // ==================
      {
        name: 'Product Hero',
        slug: 'product-hero',
        category: 'product',
        niche: 'product',
        tagline: 'Make your products impossible to ignore',
        description: 'Transform your product photos into premium cinematic videos that convert browsers into buyers.',
        best_for: 'Cars, food, fashion, property, electronics, any product',
        preview_url: null,
        thumbnail_url: null,
        price: 49.99,
        sort_order: 7,
        is_active: true
      }
    ];

    await prisma.template.createMany({ data: templates });

    res.json({
      success: true,
      message: '7 ZAAS templates seeded successfully',
      count: templates.length
    });
  } catch (error) {
    console.error('seedTemplates error:', error);
    res.status(500).json({ success: false, message: 'Failed to seed templates', error: error.message });
  }
};

module.exports = { getAllTemplates, getTemplatesByCategory, getTemplateBySlug, seedTemplates };