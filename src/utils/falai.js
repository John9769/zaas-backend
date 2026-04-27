const { fal } = require('@fal-ai/client');

fal.config({
  credentials: process.env.FAL_KEY
});

module.exports = fal;