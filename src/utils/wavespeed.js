const axios = require('axios');

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;
const WAVESPEED_BASE = 'https://api.wavespeed.ai/api/v3';

// ============================================
// SUBMIT I2V JOB — WAN 2.7
// One image → one 5-sec clip
// Returns job ID for webhook tracking
// ============================================
const submitI2VJob = async (imageUrl, prompt) => {
  const response = await axios.post(
    `${WAVESPEED_BASE}/alibaba/wan-2.7/image-to-video`,
    {
      image: imageUrl,
      prompt: prompt,
      negative_prompt: 'blur, distortion, watermark, low quality, jerky motion',
      duration: 5,
      size: '832*480'
    },
    {
      headers: {
        'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
};

// ============================================
// GET JOB STATUS
// Poll job status by ID
// ============================================
const getJobStatus = async (jobId) => {
  const response = await axios.get(
    `${WAVESPEED_BASE}/predictions/${jobId}`,
    {
      headers: {
        'Authorization': `Bearer ${WAVESPEED_API_KEY}`
      }
    }
  );
  return response.data;
};

// ============================================
// SUBMIT VACE JOINER
// Pass array of clip URLs → get 1 stitched video
// ============================================
const submitVaceJoin = async (clipUrls) => {
  const response = await axios.post(
    `${WAVESPEED_BASE}/wavespeed-ai/vace-video-joiner`,
    {
      videos: clipUrls
    },
    {
      headers: {
        'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
};

module.exports = { submitI2VJob, getJobStatus, submitVaceJoin };