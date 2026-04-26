// CardForge Backend — Node.js + Express + DALL-E 3
// =====================================================
// SETUP INSTRUCTIONS:
// 1. Install Node.js from https://nodejs.org (download the LTS version)
// 2. Create a folder called "cardforge-backend" on your computer
// 3. Save this file as "server.js" inside that folder
// 4. Open Terminal (Mac) or Command Prompt (Windows) in that folder
// 5. Run: npm init -y
// 6. Run: npm install express cors openai dotenv
// 7. Create a file called ".env" in the same folder (see below)
// 8. Run: node server.js
// 9. Your server will be live at http://localhost:3001
// =====================================================

// .env file contents (create this file, paste these lines):
// OPENAI_API_KEY=sk-your-openai-api-key-here
// PORT=3001
//
// Get your OpenAI API key at: https://platform.openai.com/api-keys
// =====================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3001;

// Allow requests from configured origin(s); defaults to * in dev
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors({
  origin: allowedOrigin ? allowedOrigin.split(',') : '*',
}));
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =====================================================
// ROUTE: Generate card designs
// POST /api/generate
// Body: { prompt: string, orientation: "horizontal" | "vertical" }
// =====================================================
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, orientation = 'horizontal' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Choose image dimensions based on card orientation
    // DALL-E 3 supported sizes: 1024x1024, 1792x1024, 1024x1792
    const size = orientation === 'vertical' ? '1024x1792' : '1792x1024';

    // We generate 3 design variants with slightly different style directions
    const styleVariants = [
      {
        label: 'Variant A — Premium',
        styleBoost: 'ultra-premium metallic finish, deep reflective sheen, embossed surface detail',
      },
      {
        label: 'Variant B — Editorial',
        styleBoost: 'bold geometric abstraction, editorial graphic design approach, strong typographic energy',
      },
      {
        label: 'Variant C — Artistic',
        styleBoost: 'painterly artistic illustration, expressive color layering, textured surface treatment',
      },
    ];

    // Run all 3 generations in parallel for speed
    const generationPromises = styleVariants.map(async (variant) => {
      const fullPrompt = `${prompt}\n\nVariant differentiator: ${variant.styleBoost}`;

      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: fullPrompt,
        n: 1,
        size: size,
        quality: 'hd',        // Use HD quality for crisp card art
        style: 'vivid',       // "vivid" = more dramatic, "natural" = more realistic
      });

      return {
        label: variant.label,
        imageUrl: response.data[0].url,
        revisedPrompt: response.data[0].revised_prompt, // DALL-E often revises prompts
      };
    });

    const results = await Promise.all(generationPromises);

    res.json({
      success: true,
      designs: results,
      originalPrompt: prompt,
      orientation,
    });

  } catch (error) {
    console.error('Generation error:', error);

    // Handle specific OpenAI errors
    if (error.code === 'invalid_api_key') {
      return res.status(401).json({ error: 'Invalid OpenAI API key. Check your .env file.' });
    }
    if (error.code === 'billing_hard_limit_reached') {
      return res.status(402).json({ error: 'OpenAI billing limit reached. Check your OpenAI account.' });
    }
    if (error.status === 400 && error.message?.includes('safety')) {
      return res.status(400).json({ error: 'Prompt was flagged by safety filters. Please rephrase your design description.' });
    }

    res.status(500).json({ error: 'Generation failed. Please try again.' });
  }
});

// =====================================================
// ROUTE: Health check (to confirm server is running)
// GET /api/health
// =====================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'CardForge backend is running',
    openaiConfigured: !!process.env.OPENAI_API_KEY,
  });
});

// Start the server
app.listen(PORT, () => {
  console.log('');
  console.log('✦ CardForge Backend is running');
  console.log(`✦ Local URL: http://localhost:${PORT}`);
  console.log(`✦ Health check: http://localhost:${PORT}/api/health`);
  console.log(`✦ OpenAI key configured: ${!!process.env.OPENAI_API_KEY}`);
  console.log('');
});
