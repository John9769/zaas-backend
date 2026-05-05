const prisma = require('../utils/prisma');
const { analyseImagesAndGeneratePrompts } = require('../utils/groq');
const { submitI2VJob } = require('../utils/wavespeed');

// ============================================
// CREATE ORDER
// POST /api/orders
// Flow: validate → create order → save photos
// → Groq analyses images → submit 4 parallel
// Wavespeed jobs → return order ID
// ============================================
const createOrder = async (req, res) => {
  try {
    const {
      template_id,
      guest_email,
      photos
    } = req.body;

    // Validate
    if (!template_id) {
      return res.status(400).json({ success: false, message: 'Template is required' });
    }
    if (!guest_email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (!photos || photos.length === 0) {
      return res.status(400).json({ success: false, message: 'Photos are required' });
    }
    if (photos.length !== 4) {
      return res.status(400).json({ success: false, message: 'Exactly 4 photos required' });
    }

    // Get template
    const template = await prisma.template.findUnique({ where: { id: template_id } });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        guest_email,
        template_id,
        category: template.category,
        niche: template.niche,
        amount: template.price,
        payment_status: 'pending',
        video_status: 'pending'
      }
    });

    // Save 4 photos
    const photoData = photos.map((photo, index) => ({
      order_id: order.id,
      cloudinary_url: photo.cloudinary_url,
      cloudinary_public_id: photo.cloudinary_public_id,
      sort_order: index + 1,
      file_size_kb: photo.file_size_kb || null,
      width: photo.width || null,
      height: photo.height || null
    }));

    await prisma.orderPhoto.createMany({ data: photoData });

    // Trigger video generation immediately for testing — move to after Billplz payment later
    triggerVideoGeneration(order.id);

    // Return order immediately
    res.json({
      success: true,
      message: 'Order created. Proceed to payment.',
      data: {
        order_id: order.id,
        amount: template.price,
        category: template.category,
        niche: template.niche,
        template: template.name,
        photos_count: photos.length
      }
    });

  } catch (error) {
    console.error('createOrder error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create order' });
  }
};

// ============================================
// TRIGGER VIDEO GENERATION
// Called internally after payment confirmed
// Groq analyses → Wavespeed 4 parallel jobs
// ============================================
const triggerVideoGeneration = async (orderId) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        photos: { orderBy: { sort_order: 'asc' } },
        template: true
      }
    });

    if (!order) throw new Error('Order not found');

    console.log(`🧠 Groq analysing images for order ${orderId}`);

    // Step 1 — Groq analyses all 4 images
    const imageUrls = order.photos.map(p => p.cloudinary_url);
    const groqResult = await analyseImagesAndGeneratePrompts(imageUrls, order.niche);

    console.log(`✅ Groq analysis: ${groqResult.event_type} | ${groqResult.mood}`);

    // Save Groq analysis to order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        groq_event_type: groqResult.event_type,
        groq_analysis: JSON.stringify(groqResult),
        groq_prompts: JSON.stringify(groqResult.prompts),
        video_status: 'processing'
      }
    });

    // Step 2 — Submit 4 parallel Wavespeed jobs
    console.log(`🎬 Submitting 4 parallel Wavespeed jobs for order ${orderId}`);

    const wavespeedJobs = await Promise.all(
      order.photos.map((photo, index) =>
        submitI2VJob(photo.cloudinary_url, groqResult.prompts[index])
      )
    );

    // Save job IDs to each photo
    await Promise.all(
      order.photos.map((photo, index) =>
        prisma.orderPhoto.update({
          where: { id: photo.id },
          data: {
            groq_clip_prompt: groqResult.prompts[index],
            wavespeed_job_id: wavespeedJobs[index]?.data?.id || null
          }
        })
      )
    );

    // Save all job IDs to order
    const jobIds = wavespeedJobs.map(j => j?.data?.id).filter(Boolean);
    await prisma.order.update({
      where: { id: orderId },
      data: {
        wavespeed_job_ids: JSON.stringify(jobIds)
      }
    });

    console.log(`✅ 4 Wavespeed jobs submitted for order ${orderId}`);

  } catch (error) {
    console.error(`❌ triggerVideoGeneration error for order ${orderId}:`, error);
    await prisma.order.update({
      where: { id: orderId },
      data: {
        video_status: 'failed',
        failure_reason: error.message
      }
    });
  }
};

// ============================================
// GET ORDER STATUS
// GET /api/orders/:id/status
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
        niche: true,
        expires_at: true,
        failure_reason: true,
        refund_status: true,
        created_at: true,
        template: {
          select: { name: true, category: true, niche: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });

  } catch (error) {
    console.error('getOrderStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to get order status' });
  }
};

// ============================================
// GET ORDERS BY EMAIL
// GET /api/orders/email/:email
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
        niche: true,
        expires_at: true,
        is_expired: true,
        refund_status: true,
        created_at: true,
        template: {
          select: { name: true, category: true, niche: true, thumbnail_url: true }
        }
      }
    });

    res.json({ success: true, data: orders });

  } catch (error) {
    console.error('getOrdersByEmail error:', error);
    res.status(500).json({ success: false, message: 'Failed to get orders' });
  }
};

module.exports = { createOrder, getOrderStatus, getOrdersByEmail, triggerVideoGeneration };