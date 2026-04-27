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

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('getAllTemplates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates'
    });
  }
};

// ============================================
// GET TEMPLATES BY CATEGORY
// ============================================
const getTemplatesByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    if (!['personal', 'business'].includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Category must be personal or business'
      });
    }

    const templates = await prisma.template.findMany({
      where: {
        category,
        is_active: true
      },
      orderBy: { sort_order: 'asc' }
    });

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('getTemplatesByCategory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates'
    });
  }
};

// ============================================
// GET TEMPLATE BY SLUG
// ============================================
const getTemplateBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const template = await prisma.template.findUnique({
      where: { slug }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('getTemplateBySlug error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template'
    });
  }
};

// ============================================
// SEED TEMPLATES — RUN ONCE
// All 8 ZAAS templates with real fal.ai prompts
// ============================================
const seedTemplates = async (req, res) => {
  try {
    // Clear existing templates first
    await prisma.template.deleteMany();

    const templates = [
      // ==================
      // PERSONAL (3)
      // Engine: Seedance 1.5 Pro
      // Price: RM12.99
      // ==================
      {
        name: 'Cinematic Memory',
        slug: 'cinematic-memory',
        category: 'personal',
        tagline: 'For weddings, family & anniversaries',
        description: 'Transform your precious memories into a warm, cinematic masterpiece with golden tones and emotional depth.',
        best_for: 'Weddings, anniversaries, family gatherings',
        engine: 'seedance',
        ai_prompt: 'Slow cinematic movement, warm golden hour lighting, gentle bokeh depth of field, soft emotional atmosphere, subtle camera drift, film grain texture, romantic and nostalgic mood',
        motion_mode: 'atmosphere',
        music_file: 'cinematic_memory.mp3',
        transition_type: 'crossfade',
        preview_url: null,
        thumbnail_url: null,
        price: 12.99,
        sort_order: 1,
        is_active: true
      },
      {
        name: 'Little Moments',
        slug: 'little-moments',
        category: 'personal',
        tagline: 'For kids, birthdays & celebrations',
        description: 'Bring your happiest celebrations to life with bright, playful energy and joyful cinematic motion.',
        best_for: 'Kids birthdays, baby milestones, Raya, CNY, Deepavali',
        engine: 'seedance',
        ai_prompt: 'Bright joyful movement, vivid warm colors, playful upbeat energy, celebratory bokeh light particles, cheerful cinematic zoom, soft natural lighting, happy and heartwarming mood',
        motion_mode: 'subject',
        music_file: 'little_moments.mp3',
        transition_type: 'dissolve',
        preview_url: null,
        thumbnail_url: null,
        price: 12.99,
        sort_order: 2,
        is_active: true
      },
      {
        name: 'Wanderlust',
        slug: 'wanderlust',
        category: 'personal',
        tagline: 'For travel, outdoors & adventures',
        description: 'Relive your greatest adventures with epic sweeping cinematography and dramatic landscape motion.',
        best_for: 'Travel photos, outdoor adventures, nature, landscapes',
        engine: 'seedance',
        ai_prompt: 'Epic cinematic sweep, dramatic wide angle movement, natural outdoor lighting, adventure and exploration mood, sweeping camera motion, grand landscape scale, dynamic and inspiring atmosphere',
        motion_mode: 'atmosphere',
        music_file: 'wanderlust.mp3',
        transition_type: 'cut',
        preview_url: null,
        thumbnail_url: null,
        price: 12.99,
        sort_order: 3,
        is_active: true
      },

      // ==================
      // BUSINESS (5)
      // Engine: Kling 3.0 Pro
      // Price: RM19.99
      // ==================
      {
        name: 'Product Hero',
        slug: 'product-hero',
        category: 'business',
        tagline: 'For physical products & e-commerce',
        description: 'Make your products impossible to ignore with sharp, premium motion that converts browsers into buyers.',
        best_for: 'Shopee sellers, Lazada sellers, physical products, supplements',
        engine: 'kling',
        ai_prompt: 'Professional product reveal, clean studio lighting, sharp product focus, premium brand presentation, smooth slow orbit around subject, elegant product motion, commercial photography style',
        motion_mode: 'subject',
        music_file: 'product_hero.mp3',
        transition_type: 'cut',
        preview_url: null,
        thumbnail_url: null,
        price: 19.99,
        sort_order: 4,
        is_active: true
      },
      {
        name: 'Makan Mood',
        slug: 'makan-mood',
        category: 'business',
        tagline: 'For F&B, food & beverages',
        description: 'Make your food look so good people order immediately. Steam rising, honey dripping, kopi pouring.',
        best_for: 'Restaurants, home food sellers, honey, kopi, kuih, F&B',
        engine: 'kling',
        ai_prompt: 'Appetizing food cinematography, warm cozy tones, realistic steam rising motion, liquid pour and drip effect, close-up texture detail, mouth-watering atmosphere, natural food photography lighting',
        motion_mode: 'subject',
        music_file: 'makan_mood.mp3',
        transition_type: 'dissolve',
        preview_url: null,
        thumbnail_url: null,
        price: 19.99,
        sort_order: 5,
        is_active: true
      },
      {
        name: 'Style Drop',
        slug: 'style-drop',
        category: 'business',
        tagline: 'For fashion, hijab & accessories',
        description: 'Give your fashion the runway treatment. Fabric flows, confidence radiates, customers click Buy.',
        best_for: 'Fashion sellers, hijab, baju raya, accessories, clothing',
        engine: 'kling',
        ai_prompt: 'Fashion editorial motion, sleek fabric movement and flow, style confidence energy, runway presentation, elegant model motion, high fashion lighting, trendy and aspirational mood',
        motion_mode: 'subject',
        music_file: 'style_drop.mp3',
        transition_type: 'cut',
        preview_url: null,
        thumbnail_url: null,
        price: 19.99,
        sort_order: 6,
        is_active: true
      },
      {
        name: 'Property Walk',
        slug: 'property-walk',
        category: 'business',
        tagline: 'For property, rooms & Airbnb',
        description: 'Showcase your property like a luxury listing. Sweeping reveals that make buyers fall in love instantly.',
        best_for: 'Property agents, Airbnb hosts, room rental, renovations',
        engine: 'kling',
        ai_prompt: 'Architectural cinematic reveal, sweeping interior camera movement, premium property atmosphere, aspirational lifestyle lighting, elegant spatial depth, luxury real estate presentation style',
        motion_mode: 'atmosphere',
        music_file: 'property_walk.mp3',
        transition_type: 'crossfade',
        preview_url: null,
        thumbnail_url: null,
        price: 19.99,
        sort_order: 7,
        is_active: true
      },
      {
        name: 'Brand Story',
        slug: 'brand-story',
        category: 'business',
        tagline: 'For SMEs, teams & brand journey',
        description: 'Tell your brand story with documentary authenticity. Human warmth that builds trust and loyal customers.',
        best_for: 'SME owners, business origin story, team photos, brand identity',
        engine: 'kling',
        ai_prompt: 'Documentary storytelling motion, authentic human warmth, brand journey narrative, natural candid movement, inspiring Malaysian business spirit, genuine emotional connection, real people real stories',
        motion_mode: 'subject',
        music_file: 'brand_story.mp3',
        transition_type: 'dissolve',
        preview_url: null,
        thumbnail_url: null,
        price: 19.99,
        sort_order: 8,
        is_active: true
      }
    ];

    await prisma.template.createMany({
      data: templates
    });

    res.json({
      success: true,
      message: '8 ZAAS templates seeded successfully',
      count: templates.length
    });
  } catch (error) {
    console.error('seedTemplates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed templates',
      error: error.message
    });
  }
};

module.exports = {
  getAllTemplates,
  getTemplatesByCategory,
  getTemplateBySlug,
  seedTemplates
};