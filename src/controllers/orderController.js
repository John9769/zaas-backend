const prisma = require('../utils/prisma');
const fal = require('../utils/falai');

// ============================================
// FAL.AI ENDPOINTS
// ============================================
const FAL_ENDPOINTS = {
  seedance: 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
  kling: 'fal-ai/kling-video/v3/pro/image-to-video'
};

// ============================================
// CREATE ORDER
// POST /api/orders
// Flow:
// 1. Validate request
// 2. Create order in DB
// 3. Save photos to OrderPhoto
// 4. BYPASS Billplz → auto mark as paid (testing)
// 5. Fire fal.ai for hero photo
// 6. Return order
// ============================================
const createOrder = async (req, res) => {
  try {
    const {
      template_id,
      guest_email,
      photos,        // array of photo objects from upload step
      hero_public_id, // cloudinary_public_id of hero photo chosen by user
      user_lat,
      user_lng,
      user_city,
      location_granted
    } = req.body;

    // ── Validate ──
    if (!template_id) {
      return res.status(400).json({
        success: false,
        message: 'Template is required'
      });
    }

    if (!guest_email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!photos || photos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least 1 photo is required'
      });
    }

    if (photos.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 photos allowed'
      });
    }

    if (!hero_public_id) {
      return res.status(400).json({
        success: false,
        message: 'Please select your hero photo for AI motion'
      });
    }

    // ── Get template ──
    const template = await prisma.template.findUnique({
      where: { id: template_id }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // ── Create order ──
    const order = await prisma.order.create({
      data: {
        guest_email,
        template_id,
        category: template.category,
        amount: template.price,

        // GPS
        user_lat: user_lat || null,
        user_lng: user_lng || null,
        user_city: user_city || null,
        location_granted: location_granted || false,

        // BYPASS Billplz for testing
        // Auto mark as paid immediately
        payment_status: 'paid',
        paid_at: new Date(),
        billplz_bill_id: `TEST_${Date.now()}`,

        // Video starts processing
        video_status: 'processing'
      }
    });

    // ── Save photos to OrderPhoto ──
    const photoData = photos.map((photo, index) => ({
      order_id: order.id,
      cloudinary_url: photo.cloudinary_url,
      cloudinary_public_id: photo.cloudinary_public_id,
      is_hero: photo.cloudinary_public_id === hero_public_id,
      sort_order: index + 1,
      file_size_kb: photo.file_size_kb || null,
      width: photo.width || null,
      height: photo.height || null
    }));

    await prisma.orderPhoto.createMany({
      data: photoData
    });

    // ── Get hero photo ──
    const heroPhoto = photos.find(
      p => p.cloudinary_public_id === hero_public_id
    );

    if (!heroPhoto) {
      return res.status(400).json({
        success: false,
        message: 'Hero photo not found in uploaded photos'
      });
    }

    // ── Fire fal.ai async job for hero photo ──
    const falEndpoint = FAL_ENDPOINTS[template.engine];

    console.log(`🎬 Firing fal.ai job for order ${order.id}`);
    console.log(`📍 Engine: ${template.engine} → ${falEndpoint}`);
    console.log(`🖼️ Hero photo: ${heroPhoto.cloudinary_url}`);

    // Submit async job to fal.ai
    // We use queue.submit so we get request_id back immediately
    // fal.ai will call our webhook when done
    const falJob = await fal.queue.submit(falEndpoint, {
      input: {
        image_url: heroPhoto.cloudinary_url,
        prompt: template.ai_prompt,
        duration: 5,
        aspect_ratio: '16:9'
      },
      webhookUrl: `${process.env.WEBHOOK_BASE_URL}/api/webhooks/falai`
    });

    console.log(`✅ fal.ai job submitted: ${falJob.request_id}`);

    // ── Save fal.ai request_id to order ──
    await prisma.order.update({
      where: { id: order.id },
      data: {
        fal_request_id: falJob.request_id,
        video_status: 'processing'
      }
    });

    // ── Respond to FE immediately ──
    res.json({
      success: true,
      message: 'Order created. Your cinematic video is being generated!',
      data: {
        order_id: order.id,
        status: 'processing',
        template: template.name,
        amount: template.price,
        photos_count: photos.length,
        fal_request_id: falJob.request_id,
        estimated_wait: '2-5 minutes'
      }
    });

  } catch (error) {
    console.error('createOrder error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order'
    });
  }
};

// ============================================
// GET ORDER STATUS
// GET /api/orders/:id/status
// FE polls this to check if video is ready
// ============================================
const getOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        video_status: true,
        video_url: true,
        video_thumbnail: true,
        payment_status: true,
        amount: true,
        expires_at: true,
        failure_reason: true,
        created_at: true,
        template: {
          select: {
            name: true,
            category: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('getOrderStatus error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get order status'
    });
  }
};

// ============================================
// GET ORDER BY EMAIL
// GET /api/orders/email/:email
// Guest user checks their orders
// ============================================
const getOrdersByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const orders = await prisma.order.findMany({
      where: { guest_email: email },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        video_status: true,
        video_url: true,
        video_thumbnail: true,
        amount: true,
        expires_at: true,
        is_expired: true,
        created_at: true,
        template: {
          select: {
            name: true,
            category: true,
            thumbnail_url: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: orders
    });

  } catch (error) {
    console.error('getOrdersByEmail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get orders'
    });
  }
};

module.exports = {
  createOrder,
  getOrderStatus,
  getOrdersByEmail
};