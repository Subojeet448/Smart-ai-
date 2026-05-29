// ============================================
// SMART AI ROUTER API - v3.0 by @MANDAL4482
// 
// GET  /api/chat?message=hello&imageUrl=optional
// POST /api/chat  → body: { message, imageUrl }
//
// Dono methods support karta hai — browser URL se bhi kaam karta hai!
// No rate limits. No action caps.
// ============================================

const AI_BASE     = "https://vie-ai-psi.vercel.app";
const SEARCH_BASE = "https://pplx-api.vercel.app/api/ask";
const LOGO_BASE   = "https://3d-logo-eight.vercel.app";

// ── AI CALLER ────────────────────────────────────────────────────────────
async function callAI(system, userMsg, maxTokens = 500) {
  const res = await fetch(`${AI_BASE}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const status = res.status;
    if (status === 401) throw new Error("AI_AUTH_FAILED: API key invalid ya expire ho gayi hai.");
    if (status === 429) throw new Error("AI_RATE_LIMIT: AI server busy hai. Thodi der baad try karo.");
    if (status === 503) throw new Error("AI_UNAVAILABLE: AI server abhi available nahi hai.");
    if (status === 500) throw new Error("AI_SERVER_ERROR: AI server mein internal error aaya.");
    throw new Error(`AI_ERROR_${status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text?.trim() || "";
}

// ── AI CAPABILITIES ──────────────────────────────────────────────────────
const AI_CAPABILITIES = `
You are "VIE AI" — a powerful multi-modal AI assistant made by @MANDAL4482.

Here is EXACTLY what you can do:

🖼️ IMAGE GENERATION
- "ek sunset ki image banao" → realistic AI images from any description
- "make a logo for my bakery" → professional logos and 3D logos
- "generate 3 images of cats" → multiple images in one request

🎬 VIDEO GENERATION
- "ek video banao mountains ka" → short AI-generated videos from text

✨ IMAGE ENHANCEMENT
- "is photo ko enhance karo" → sharpen, upscale, and beautify any image

🔍 IMAGE UNDERSTANDING
- "is image mein kya hai?" → read and describe any image

🌐 REAL-TIME SEARCH
- "aaj ka weather kya hai?" → live web search for current news, prices, events

💬 SMART CONVERSATION
- Answer in Hindi, English, or Hinglish
- Help with coding, writing, math, advice

⚡ MULTI-TASK
- "ek image aur ek video banao sunset ka" → both done simultaneously

If asked "can you make images?" → YES! Tell them to describe what they want.
If asked "kya tum AI ho?" → Yes, main VIE AI hun, @MANDAL4482 ka banaya hua.
NEVER say "I am just an LLM" or "I cannot generate images" — you CAN do everything above.
`;

// ── ROUTER PROMPT ─────────────────────────────────────────────────────────
const ROUTER_SYSTEM = `You are an intelligent multi-action router for VIE AI.
Analyze the user message and respond ONLY in this EXACT JSON format — no markdown, no extra text:

{
  "actions": [
    {
      "action": "<action_type>",
      "prompt": "<extracted clean prompt in English>",
      "reply": "<short friendly reply in same language as user>"
    }
  ]
}

Available action types:
- "chat"           → normal conversation, greetings, general questions, capability questions
- "image_generate" → user wants to create/make/draw/generate an image or picture
- "video_generate" → user wants to create a video or animation
- "logo_3d"        → user wants a 3D logo or icon
- "enhance"        → user sent an image and wants it improved/enhanced/upscaled
- "img2prompt"     → user wants to know what is in an image
- "search"         → user asks about current events, news, live data, today's info, prices

CRITICAL RULES:
1. Multiple tasks → multiple action objects. "3 images banao" = 3 image_generate objects.
2. "prompt" must be clean English version of what user wants (translate if needed).
3. "reply" = ONE short friendly reply for ALL actions combined, in user's language.
4. For "chat": prompt = the user's full message.
5. For "enhance" and "img2prompt": prompt = "" (image URL passed separately).
6. No limit on action objects — handle everything the user asks.
7. If capability question → use "chat" action.
8. ONLY output valid JSON. Nothing else.`;

// ── PROMPT ENHANCER ───────────────────────────────────────────────────────
const IMAGE_ENHANCER_SYSTEM = `You are an expert AI image prompt engineer.
Expand the user's simple request into a rich, detailed prompt.
Add: lighting (golden hour, studio, cinematic), quality tags (8k, photorealistic, detailed),
composition (rule of thirds, close-up, wide angle), mood, art style if relevant.
Keep under 80 words. Output ONLY the enhanced prompt — no explanation, no quotes.`;

// ── SEARCH SUMMARIZER ─────────────────────────────────────────────────────
const SEARCH_SUMMARIZER_SYSTEM = `You are a helpful assistant summarizing search results.
Give a SHORT, clear, direct answer (3-5 lines max) in the SAME language the user asked.
Be conversational and friendly. No bullet points for simple answers.`;

// ── CHAT SYSTEM ───────────────────────────────────────────────────────────
const CHAT_SYSTEM = `${AI_CAPABILITIES}

You are VIE AI — friendly, helpful, smart. Rules:
- Reply in the SAME language the user wrote in (Hindi/English/Hinglish).
- Keep replies SHORT and conversational (2-4 lines for simple questions).
- For capability questions: confidently explain what you can do with examples.
- NEVER say you cannot generate images or videos — you CAN via connected tools.
- For code/explanation: be thorough but clear.`;

// ── Helpers ───────────────────────────────────────────────────────────────
async function enhanceImagePrompt(rawPrompt) {
  try {
    return await callAI(IMAGE_ENHANCER_SYSTEM, rawPrompt, 150);
  } catch {
    return rawPrompt; // fallback to raw
  }
}

async function searchAndSummarize(query) {
  const searchRes = await fetch(
    `${SEARCH_BASE}?prompt=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(20000) }
  );

  if (!searchRes.ok) {
    const status = searchRes.status;
    if (status === 503) throw new Error("SEARCH_UNAVAILABLE: Search engine band hai abhi.");
    throw new Error(`SEARCH_ERROR_${status}: Search fail ho gayi.`);
  }

  const searchData = await searchRes.json();
  if (searchData.status !== "success" || !searchData.answer) {
    throw new Error("SEARCH_NO_RESULTS: Is topic pe koi result nahi mila. Alag words mein try karo.");
  }

  const summary = await callAI(
    SEARCH_SUMMARIZER_SYSTEM,
    `User asked: "${query}"\n\nSearch results: ${searchData.answer}`,
    300
  );

  return {
    answer: summary,
    sources: (searchData.sources || []).slice(0, 3).map((s) => ({
      name: s.name || "Source",
      url: s.url,
    })),
  };
}

// ── EXECUTE SINGLE ACTION ─────────────────────────────────────────────────
async function executeAction(action, prompt, imageUrl) {
  switch (action) {

    case "chat": {
      const reply = await callAI(CHAT_SYSTEM, prompt || "Hello", 600);
      return { type: "chat", reply };
    }

    case "image_generate": {
      if (!prompt?.trim()) throw new Error("IMAGE_NO_PROMPT: Image ke liye description do.");
      const enhanced = await enhanceImagePrompt(prompt);
      const imgRes = await fetch(
        `${AI_BASE}/generate?prompt=${encodeURIComponent(enhanced)}`,
        { signal: AbortSignal.timeout(45000) }
      );
      if (!imgRes.ok) {
        if (imgRes.status === 400) throw new Error("IMAGE_BAD_PROMPT: Yeh content allowed nahi.");
        throw new Error(`IMAGE_ERROR_${imgRes.status}: Image nahi ban payi. Dobara try karo.`);
      }
      const imgData = await imgRes.json();
      const imageResult = imgData.image_url || imgData.url || imgData.result || null;
      if (!imageResult) throw new Error("IMAGE_EMPTY: Image URL nahi mili. Dobara try karo.");
      return { type: "image", prompt_used: enhanced, image_url: imageResult };
    }

    case "video_generate": {
      if (!prompt?.trim()) throw new Error("VIDEO_NO_PROMPT: Video ke liye description do.");
      const enhanced = await enhanceImagePrompt(prompt);
      const vidRes = await fetch(
        `${AI_BASE}/video?prompt=${encodeURIComponent(enhanced)}`,
        { signal: AbortSignal.timeout(90000) }
      );
      if (!vidRes.ok) {
        if (vidRes.status === 400) throw new Error("VIDEO_BAD_PROMPT: Yeh content allowed nahi.");
        throw new Error(`VIDEO_ERROR_${vidRes.status}: Video nahi ban payi. Dobara try karo.`);
      }
      const vidData = await vidRes.json();
      const videoResult = vidData.video_url || vidData.url || vidData.result || null;
      if (!videoResult) throw new Error("VIDEO_EMPTY: Video URL nahi mili. Dobara try karo.");
      return { type: "video", prompt_used: enhanced, video_url: videoResult };
    }

    case "logo_3d": {
      if (!prompt?.trim()) throw new Error("LOGO_NO_PROMPT: Logo ke liye naam ya description do.");
      const enhanced = await enhanceImagePrompt(prompt);
      const logoRes = await fetch(
        `${LOGO_BASE}/logo?prompt=${encodeURIComponent(enhanced)}`,
        { signal: AbortSignal.timeout(45000) }
      );
      if (!logoRes.ok) throw new Error(`LOGO_ERROR_${logoRes.status}: Logo nahi bana. Dobara try karo.`);
      const logoData = await logoRes.json();
      const logoResult = logoData.image_url || logoData.url || logoData.logo_url || null;
      if (!logoResult) throw new Error("LOGO_EMPTY: Logo URL nahi mila.");
      return { type: "logo_3d", prompt_used: enhanced, image_url: logoResult };
    }

    case "enhance": {
      if (!imageUrl) throw new Error("ENHANCE_NO_IMAGE: Enhance karne ke liye image URL do.");
      const enhRes = await fetch(
        `${AI_BASE}/enhance?url=${encodeURIComponent(imageUrl)}`,
        { signal: AbortSignal.timeout(45000) }
      );
      if (!enhRes.ok) throw new Error(`ENHANCE_ERROR_${enhRes.status}: Image enhance nahi hui.`);
      const enhData = await enhRes.json();
      const enhResult = enhData.enhanced_url || enhData.url || enhData.result || null;
      if (!enhResult) throw new Error("ENHANCE_EMPTY: Enhanced image URL nahi mila.");
      return { type: "enhanced_image", original_url: imageUrl, image_url: enhResult };
    }

    case "img2prompt": {
      if (!imageUrl) throw new Error("IMG2PROMPT_NO_IMAGE: Image describe karne ke liye URL do.");
      const i2pRes = await fetch(
        `${AI_BASE}/img2txt?url=${encodeURIComponent(imageUrl)}`,
        { signal: AbortSignal.timeout(30000) }
      );
      if (!i2pRes.ok) throw new Error(`IMG2PROMPT_ERROR_${i2pRes.status}: Image read nahi ho payi.`);
      const i2pData = await i2pRes.json();
      const description = i2pData.text || i2pData.prompt || i2pData.result || "";
      if (!description) throw new Error("IMG2PROMPT_EMPTY: Description nahi aayi.");
      return { type: "image_description", description };
    }

    case "search": {
      if (!prompt?.trim()) throw new Error("SEARCH_NO_QUERY: Kya search karna hai? Query batao.");
      const { answer, sources } = await searchAndSummarize(prompt);
      return { type: "search", reply: answer, sources };
    }

    default:
      throw new Error(`UNKNOWN_ACTION: "${action}" action nahi pehchana. Valid: chat, image_generate, video_generate, logo_3d, enhance, img2prompt, search`);
  }
}

// ── FRIENDLY ERROR FORMATTER ──────────────────────────────────────────────
function formatUserError(errorMsg) {
  const errorMap = {
    "AI_AUTH_FAILED":      "⚠️ AI connection issue. Admin se contact karo.",
    "AI_RATE_LIMIT":       "⏳ AI server busy hai. Thodi der baad try karo.",
    "AI_UNAVAILABLE":      "🔧 AI service thodi der band hai. 1-2 min mein try karo.",
    "AI_SERVER_ERROR":     "❌ AI mein error aaya. Dobara try karo.",
    "IMAGE_NO_PROMPT":     "💬 Image ke liye description do. Example: 'ek sunset ki image banao'",
    "IMAGE_BAD_PROMPT":    "🚫 Yeh content allowed nahi. Koi aur cheez try karo.",
    "IMAGE_EMPTY":         "🔄 Image generate nahi hui. Dobara try karo.",
    "VIDEO_NO_PROMPT":     "💬 Video ke liye description do. Example: 'mountains ki video banao'",
    "VIDEO_EMPTY":         "🔄 Video generate nahi hui. Dobara try karo.",
    "LOGO_NO_PROMPT":      "💬 Logo ke liye naam ya description do.",
    "LOGO_EMPTY":          "🔄 Logo nahi bana. Dobara try karo.",
    "ENHANCE_NO_IMAGE":    "🖼️ Enhance ke liye image URL bhi bhejo.",
    "IMG2PROMPT_NO_IMAGE": "🖼️ Image describe karne ke liye URL bhi do.",
    "SEARCH_NO_QUERY":     "🔍 Kya dhundhna hai? Puri query likho.",
    "SEARCH_NO_RESULTS":   "🔍 Koi result nahi mila. Alag words mein try karo.",
    "SEARCH_UNAVAILABLE":  "🔧 Search engine abhi band hai.",
  };

  for (const [code, friendly] of Object.entries(errorMap)) {
    if (errorMsg.includes(code)) return friendly;
  }
  return `❌ Kuch gadbad ho gayi: ${errorMsg.split(":")[0]}. Dobara try karo.`;
}

// ── INPUT PARSER (GET + POST dono handle karta hai) ───────────────────────
function parseInput(req) {
  if (req.method === "GET") {
    // Browser URL se: /api/chat?message=hello&imageUrl=https://...
    const url = new URL(req.url, `https://${req.headers.host}`);
    return {
      message: url.searchParams.get("message") || url.searchParams.get("msg") || url.searchParams.get("q") || "",
      imageUrl: url.searchParams.get("imageUrl") || url.searchParams.get("image") || url.searchParams.get("img") || "",
    };
  }
  // POST body se
  return {
    message: req.body?.message || "",
    imageUrl: req.body?.imageUrl || "",
  };
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // ── CORS ────────────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── Only GET and POST allowed ────────────────────────────────────────────
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({
      error: "Sirf GET aur POST allowed hai",
      examples: {
        GET:  "/api/chat?message=hello",
        POST: "POST /api/chat  body: { message: 'hello' }",
      },
    });
  }

  // ── Parse Input ──────────────────────────────────────────────────────────
  const { message, imageUrl } = parseInput(req);

  if (!message?.trim()) {
    return res.status(400).json({
      error: "message parameter zaroori hai",
      examples: {
        browser_url: "/api/chat?message=ek+cat+ki+image+banao",
        post_body:   '{ "message": "ek cat ki image banao" }',
        with_image:  "/api/chat?message=enhance+karo&imageUrl=https://example.com/photo.jpg",
      },
    });
  }

  try {
    // ── STEP 1: Route Detection ──────────────────────────────────────────
    const routerInput = imageUrl
      ? `User message: "${message}"\nUser also shared an image: ${imageUrl}`
      : `User message: "${message}"`;

    let routes;
    try {
      const routerRaw = await callAI(ROUTER_SYSTEM, routerInput, 1000);
      const clean = routerRaw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      routes = parsed.actions;
      if (!Array.isArray(routes) || routes.length === 0) throw new Error("Empty actions");
    } catch (routerErr) {
      console.warn("Router failed, falling back to chat:", routerErr.message);
      routes = [{ action: "chat", prompt: message, reply: "" }];
    }

    const combinedReply = routes[0]?.reply || "";

    // ── STEP 2: Execute All Actions in Parallel (no limit) ───────────────
    const results = await Promise.allSettled(
      routes.map(({ action, prompt }) => executeAction(action, prompt, imageUrl))
    );

    // ── STEP 3: Build Response ───────────────────────────────────────────
    const outputs = results.map((result, i) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        const rawError = result.reason?.message || "Unknown error";
        return {
          type: "error",
          action: routes[i]?.action || "unknown",
          error: formatUserError(rawError),
          raw_error: rawError,
        };
      }
    });

    // Single action → flat response
    if (outputs.length === 1) {
      return res.json({ ...outputs[0], reply: combinedReply });
    }

    // Multiple actions → grouped response
    return res.json({
      reply: combinedReply,
      total: outputs.length,
      success: outputs.filter(o => o.type !== "error").length,
      failed: outputs.filter(o => o.type === "error").length,
      results: outputs,
    });

  } catch (err) {
    console.error("Smart AI Router Error:", err);
    return res.status(500).json({
      error: formatUserError(err.message),
      type: "server_error",
      hint: "Agar baar baar ho raha hai to admin ko batao",
      dev: "@MANDAL4482",
    });
  }
}
