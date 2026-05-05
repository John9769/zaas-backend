const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ============================================
// ANALYSE IMAGES + GENERATE WAVESPEED PROMPTS
// Reads up to 4 images, detects event type,
// generates 4 Wavespeed-optimized motion prompts
// ============================================
const analyseImagesAndGeneratePrompts = async (imageUrls, niche) => {
  const imageContent = imageUrls.map(url => ({
    type: 'image_url',
    image_url: { url }
  }));

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'system',
        content: `You are a professional Wavespeed AI video prompt engineer specialising in cinematic motion prompts.
Your job is to analyse photos and generate SHORT, precise video motion prompts for Wavespeed WAN 2.7 model.

STRICT RULES:
- Each prompt must be MAX 20 words
- Focus on: subject motion + camera movement + lighting + mood
- NEVER write story descriptions or narratives
- NEVER use words like "the video begins" or "scene transitions"
- Output ONLY valid JSON — no extra text

PROMPT FORMAT:
"[subject] [motion], [camera movement], [lighting], [mood], cinematic"

EXAMPLES:
- "Family walking down cobblestone street, camera follows slowly, soft daylight, warm joyful, cinematic"
- "Bride and groom embracing, gentle camera orbit, golden hour light, romantic soft, cinematic"
- "Product rotating on surface, smooth 360 pan, studio clean light, premium elegant, cinematic"

NICHE CONTEXT: ${niche}

OUTPUT FORMAT (strict JSON):
{
  "event_type": "wedding|birthday|travel|festive|graduation|me|product",
  "same_event": true|false,
  "confidence": "high|medium|low",
  "mood": "one word mood",
  "setting": "brief setting description",
  "prompts": [
    "prompt for image 1",
    "prompt for image 2", 
    "prompt for image 3",
    "prompt for image 4"
  ]
}`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyse these ${imageUrls.length} photos. Detect the event type and generate ${imageUrls.length} Wavespeed motion prompts. Return JSON only.`
          },
          ...imageContent
        ]
      }
    ],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: 'json_object' }
  });

  const raw = response.choices[0].message.content;
  return JSON.parse(raw);
};

module.exports = { analyseImagesAndGeneratePrompts };