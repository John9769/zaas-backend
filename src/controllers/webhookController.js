const prisma = require('../utils/prisma');
const cloudinary = require('../utils/cloudinary');
const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const falaiWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('📥 fal.ai webhook received:', JSON.stringify(payload, null, 2));

    const { request_id, status, output, error } = payload;

    if (!request_id) {
      return res.status(400).json({ success: false, message: 'Missing request_id' });
    }

    const order = await prisma.order.findFirst({
      where: { fal_request_id: request_id },
      include: {
        photos: { orderBy: { sort_order: 'asc' } },
        template: true
      }
    });

    if (!order) {
      console.error(`❌ Order not found for request_id: ${request_id}`);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (status === 'ERROR' || error) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          video_status: 'failed',
          failure_reason: error?.message || 'fal.ai generation failed',
          fal_webhook_raw: JSON.stringify(payload)
        }
      });
      console.error(`❌ fal.ai failed for order ${order.id}:`, error);
      return res.json({ success: true, message: 'Failure recorded' });
    }

    if (status === 'OK' && output?.video?.url) {
      const heroVideoUrl = output.video.url;
      console.log(`✅ Hero clip ready for order ${order.id}: ${heroVideoUrl}`);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          video_status: 'stitching',
          fal_webhook_raw: JSON.stringify(payload)
        }
      });

      stitchVideo(order, heroVideoUrl).catch(async (err) => {
        console.error(`❌ Stitch failed for order ${order.id}:`, err);
        await prisma.order.update({
          where: { id: order.id },
          data: { video_status: 'failed', failure_reason: err.message }
        });
      });

      return res.json({ success: true, message: 'Hero clip received, stitching started' });
    }

    res.json({ success: true, message: 'Status noted' });

  } catch (error) {
    console.error('falaiWebhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const stitchVideo = async (order, heroVideoUrl) => {
  const tmpDir = path.join('C:/tmp', `zaas_${order.id}`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    console.log(`🎬 Starting stitch for order ${order.id}`);

    const otherPhotos = order.photos.filter(p => !p.is_hero);
    const clips = [];

    // Step 1: Download hero AI clip
    const heroClipPath = path.join(tmpDir, 'hero.mp4');
    await downloadFile(heroVideoUrl, heroClipPath);
    clips.push(heroClipPath);
    console.log(`✅ Hero clip downloaded`);

    // Step 2: Ken Burns on remaining photos
    const effects = [
      "zoompan=z='min(zoom+0.0015,1.5)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
      "zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
      "zoompan=z='min(zoom+0.0015,1.5)':d=125:x=0:y=0",
      "zoompan=z='min(zoom+0.0015,1.5)':d=125:x='iw-iw/zoom':y='ih-ih/zoom'"
    ];

    for (let i = 0; i < otherPhotos.length; i++) {
      const photo = otherPhotos[i];
      const outputPath = path.join(tmpDir, `photo_${i}.mp4`);
      const effect = effects[i % effects.length];

      execSync(
        `ffmpeg -i "${photo.cloudinary_url}" -vf "${effect},scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25" -t 4 -c:v libx264 -pix_fmt yuv420p "${outputPath}" -y`,
        { timeout: 60000 }
      );

      clips.push(outputPath);
      console.log(`✅ Ken Burns clip ${i + 1} done`);
    }

    // Step 3: Create concat list
    const concatListPath = path.join(tmpDir, 'concat.txt');
    const concatContent = clips.map(c => `file '${c}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    // Step 4: Stitch all clips
    const stitchedPath = path.join(tmpDir, 'stitched.mp4');
    execSync(
      `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${stitchedPath}" -y`,
      { timeout: 120000 }
    );
    console.log(`✅ Clips stitched`);

    // Step 5: Add ZAAS watermark
    const finalPath = path.join(tmpDir, 'final.mp4');
    execSync(
      `ffmpeg -i "${stitchedPath}" -vf "drawtext=text='ZAAS':fontsize=36:fontcolor=white:x=w-tw-20:y=h-th-20:alpha=0.7" -c:v libx264 -c:a aac "${finalPath}" -y`,
      { timeout: 180000 }
    );
    console.log(`✅ Watermark added`);

    // Step 6: Upload to Cloudinary
    const cloudinaryResult = await cloudinary.uploader.upload(finalPath, {
      folder: 'zaas/videos',
      resource_type: 'video',
      public_id: `zaas_${order.id}`
    });
    console.log(`✅ Final video uploaded: ${cloudinaryResult.secure_url}`);

    // Step 7: Update order completed
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

  } catch (error) {
    console.error(`❌ stitchVideo error:`, error);
    throw error;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  }
};

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

module.exports = { falaiWebhook };