const prisma = require('../utils/prisma');
const cloudinary = require('../utils/cloudinary');
const { submitVaceJoin, getJobStatus } = require('../utils/wavespeed');
const { triggerVideoGeneration } = require('./orderController');

// ============================================
// WAVESPEED WEBHOOK
// POST /api/webhooks/wavespeed
// Receives completion for each I2V clip
// When all 4 clips done → fire VACE joiner
// ============================================
const wavespeedWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('📥 Wavespeed webhook received:', JSON.stringify(payload, null, 2));

    const jobId = payload.id;
    const status = payload.status;
    const outputUrl = payload.outputs?.[0] || payload.output?.url || null;

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Missing job ID' });
    }

    // Find which photo this job belongs to
    const photo = await prisma.orderPhoto.findFirst({
      where: { wavespeed_job_id: jobId }
    });

    // Could be VACE joiner job
    if (!photo) {
      const order = await prisma.order.findFirst({
        where: { vace_job_id: jobId }
      });

      if (order) {
        await handleVaceCompletion(order, status, outputUrl, payload);
        return res.json({ success: true, message: 'VACE completion handled' });
      }

      console.error(`❌ No photo or order found for job: ${jobId}`);
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Handle I2V clip completion
    if (status === 'failed' || status === 'error') {
      console.error(`❌ Clip failed for photo ${photo.id}`);

      await prisma.orderPhoto.update({
        where: { id: photo.id },
        data: { wavespeed_clip_url: null }
      });

      // Mark order as failed + trigger refund
      await prisma.order.update({
        where: { id: photo.order_id },
        data: {
          video_status: 'failed',
          failure_reason: `Clip generation failed for photo ${photo.sort_order}`,
          refund_status: 'pending'
        }
      });

      return res.json({ success: true, message: 'Failure recorded' });
    }

    if (status === 'completed' && outputUrl) {
      console.log(`✅ Clip ready for photo ${photo.sort_order}: ${outputUrl}`);

      // Save clip URL to photo
      await prisma.orderPhoto.update({
        where: { id: photo.id },
        data: { wavespeed_clip_url: outputUrl }
      });

      // Check if ALL 4 clips are ready
      const allPhotos = await prisma.orderPhoto.findMany({
        where: { order_id: photo.order_id },
        orderBy: { sort_order: 'asc' }
      });

      const allClipsReady = allPhotos.every(p => p.wavespeed_clip_url !== null);

      if (allClipsReady) {
        console.log(`🎬 All 4 clips ready for order ${photo.order_id} — firing VACE joiner`);

        const clipUrls = allPhotos.map(p => p.wavespeed_clip_url);

        // Submit VACE joiner
        const vaceJob = await submitVaceJoin(clipUrls);
        const vaceJobId = vaceJob?.data?.id;

        await prisma.order.update({
          where: { id: photo.order_id },
          data: {
            video_status: 'stitching',
            vace_job_id: vaceJobId,
            wavespeed_clip_urls: JSON.stringify(clipUrls)
          }
        });

        console.log(`✅ VACE job submitted: ${vaceJobId}`);
      }

      return res.json({ success: true, message: 'Clip saved' });
    }

    res.json({ success: true, message: 'Status noted' });

  } catch (error) {
    console.error('wavespeedWebhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// HANDLE VACE COMPLETION
// Final video ready — upload to Cloudinary
// Update order completed
// ============================================
const handleVaceCompletion = async (order, status, outputUrl, payload) => {
  try {
    if (status === 'failed' || status === 'error') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          video_status: 'failed',
          failure_reason: 'VACE stitching failed',
          refund_status: 'pending'
        }
      });
      console.error(`❌ VACE failed for order ${order.id}`);
      return;
    }

    if (status === 'completed' && outputUrl) {
      console.log(`✅ VACE complete for order ${order.id}: ${outputUrl}`);

      // Upload to Cloudinary
      const cloudinaryResult = await cloudinary.uploader.upload(outputUrl, {
        folder: 'zaas/videos',
        resource_type: 'video',
        public_id: `zaas_${order.id}`
      });

      console.log(`✅ Final video on Cloudinary: ${cloudinaryResult.secure_url}`);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          video_status: 'completed',
          video_url: cloudinaryResult.secure_url,
          video_public_id: cloudinaryResult.public_id,
          video_duration: cloudinaryResult.duration || null,
          expires_at: expiresAt
        }
      });

      console.log(`🎉 Order ${order.id} completed!`);
    }
  } catch (error) {
    console.error(`❌ handleVaceCompletion error:`, error);
    await prisma.order.update({
      where: { id: order.id },
      data: {
        video_status: 'failed',
        failure_reason: error.message,
        refund_status: 'pending'
      }
    });
  }
};

module.exports = { wavespeedWebhook };