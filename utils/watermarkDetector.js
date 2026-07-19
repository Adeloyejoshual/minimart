// ════════════════════════════════════════════════════════════════
// FILE: utils/watermarkDetector.js
//
// Detects competitor watermarks and screenshot-style images.
//
// Detection layers (cheapest → most expensive):
//   1. Screenshot heuristics    — sharp edge analysis, fast
//   2. Color evidence collect   — corner pixel sampling, fast
//                                 (supporting signal only, never
//                                  triggers a verdict alone)
//   3. OCR text detection       — tesseract.js, optional
//                                 (sole trigger for warn/block)
//   4. Coverage estimation      — only runs when OCR confirms a hit
//
// Verdict types:
//   "accept"  — clean image, proceed
//   "loemart" — our own watermark found, proceed
//   "warn"    — competitor watermark (OCR confirmed), listing
//               allowed but seller shown a tip to replace photos
//   "block"   — screenshot OR >80% coverage competitor branding,
//               listing rejected
//
// DESIGN DECISION — color is never a standalone trigger:
//   Product photos routinely contain green vegetables, orange
//   packaging, blue clothing, etc. Color alone produces an
//   unacceptable false-positive rate. Color's only role is a
//   small confidence boost when OCR has already confirmed a
//   competitor brand in the same image.
// ════════════════════════════════════════════════════════════════

import sharp from "sharp";

/* ═══════════════════════════════════════════════════════════════
   COMPETITOR SIGNATURES
   text[]    : strings OCR must find (lower-case, exact substring)
   corners[] : where their watermark typically appears
               "tl" top-left  "tr" top-right
               "bl" bot-left  "br" bot-right
   color     : dominant brand color range (RGB 0-255), or null
   severity  : "warn" | "block"
═══════════════════════════════════════════════════════════════ */
const COMPETITOR_SIGNATURES = Object.freeze([
  {
    name    : "Jiji",
    text    : ["jiji.ng", "jiji.com", "jiji"],
    corners : ["tl", "tr", "br", "bl"],
    color   : { r: [0, 80],    g: [160, 255], b: [0, 80]   },
    severity: "warn",
  },
  {
    name    : "Facebook Marketplace",
    text    : ["facebook", "fb marketplace", "marketplace"],
    corners : ["tl", "tr"],
    color   : { r: [24, 60],   g: [119, 145], b: [242, 255] },
    severity: "warn",
  },
  {
    name    : "OLX",
    text    : ["olx.com", "olx"],
    corners : ["tl", "br", "tr"],
    color   : { r: [100, 180], g: [190, 255], b: [0, 60]   },
    severity: "warn",
  },
  {
    name    : "Jumia",
    text    : ["jumia.com", "jumia"],
    corners : ["tl", "tr", "br"],
    color   : { r: [240, 255], g: [100, 180], b: [0, 40]   },
    severity: "warn",
  },
  {
    name    : "Konga",
    text    : ["konga.com", "konga"],
    corners : ["tl", "tr"],
    color   : { r: [220, 255], g: [0, 60],   b: [0, 60]   },
    severity: "warn",
  },
  {
    name    : "AliExpress",
    text    : ["aliexpress", "ali express", "alibaba"],
    corners : ["tl", "br"],
    color   : { r: [220, 255], g: [40, 90],  b: [0, 40]   },
    severity: "warn",
  },
  {
    name    : "Temu",
    text    : ["temu.com", "temu"],
    corners : ["tl", "tr", "br"],
    color   : { r: [220, 255], g: [60, 120], b: [0, 60]   },
    severity: "warn",
  },
  {
    name    : "Amazon",
    text    : ["amazon.com", "amazon"],
    corners : ["tl", "br"],
    color   : { r: [255, 255], g: [153, 170], b: [0, 30]  },
    severity: "warn",
  },
  {
    name    : "eBay",
    text    : ["ebay.com", "ebay"],
    corners : ["tl", "tr"],
    color   : null,   // multicolor logo — OCR only
    severity: "warn",
  },
  {
    name    : "Shein",
    text    : ["shein.com", "shein"],
    corners : ["tl", "br"],
    color   : { r: [0, 40],    g: [0, 40],   b: [0, 40]   },
    severity: "warn",
  },
  {
    name    : "Shopee",
    text    : ["shopee.com", "shopee"],
    corners : ["tl", "tr"],
    color   : { r: [220, 255], g: [60, 100], b: [0, 40]   },
    severity: "warn",
  },
]);

/* ═══════════════════════════════════════════════════════════════
   OUR OWN WATERMARK SIGNATURES — always accepted, never flagged
═══════════════════════════════════════════════════════════════ */
const LOEMART_SIGNATURES = Object.freeze([
  "loemart",
  "loemart.com",
]);

/* ═══════════════════════════════════════════════════════════════
   DETECTION CONFIG
═══════════════════════════════════════════════════════════════ */
const CFG = Object.freeze({
  /* Resize to this before all analysis — keeps memory predictable */
  analysisWidth      : 400,
  analysisHeight     : 400,

  /* Corner sample size as fraction of image dimension
     e.g. 0.15 = top/bottom 15% height, left/right 15% width  */
  cornerFraction     : 0.15,

  /* What fraction of corner pixels must match a brand color
     before it counts as color evidence                         */
  colorMatchRatio    : 0.08,

  /* Edge density below this → likely a flat screenshot         */
  edgeDensityFloor   : 0.04,

  /* Uniform background above this → likely a product render
     or promotional graphic                                     */
  uniformBgThreshold : 0.65,

  /* Coverage above this → block instead of warn               */
  blockCoverageRatio : 0.80,

  /* OCR corner fraction — slightly larger for better accuracy  */
  ocrCornerFraction  : 0.30,
  ocrCornerHeight    : 0.20,
});

/* ═══════════════════════════════════════════════════════════════
   TESSERACT — lazy-loaded, optional
   Falls back gracefully if not installed.
═══════════════════════════════════════════════════════════════ */
let _tesseract      = null;
let _tesseractOk    = false;
let _tesseractTried = false;

const getTesseract = async () => {
  if (_tesseractTried) return _tesseract;
  _tesseractTried = true;
  try {
    _tesseract   = await import("tesseract.js");
    _tesseractOk = true;
    console.log("[watermarkDetector] ✓ Tesseract OCR available");
  } catch {
    console.warn(
      "[watermarkDetector] tesseract.js not installed — " +
      "OCR text detection disabled. " +
      "Run: npm install tesseract.js"
    );
    _tesseract   = null;
    _tesseractOk = false;
  }
  return _tesseract;
};

/* ═══════════════════════════════════════════════════════════════
   HELPER — resize buffer once for reuse across layers
═══════════════════════════════════════════════════════════════ */
const resizeForAnalysis = (buffer) =>
  sharp(buffer)
    .resize(CFG.analysisWidth, CFG.analysisHeight, {
      fit               : "inside",
      withoutEnlargement: true,
    });

/* ═══════════════════════════════════════════════════════════════
   HELPER — extract a corner region as raw RGBA pixels
═══════════════════════════════════════════════════════════════ */
const extractCorner = async (pipeline, imgW, imgH, corner) => {
  const fw   = Math.max(1, Math.floor(imgW * CFG.cornerFraction));
  const fh   = Math.max(1, Math.floor(imgH * CFG.cornerFraction));
  const left = corner.includes("r") ? imgW - fw : 0;
  const top  = corner.includes("b") ? imgH - fh : 0;

  const { data } = await pipeline
    .clone()
    .extract({ left, top, width: fw, height: fh })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return data;
};

/* ═══════════════════════════════════════════════════════════════
   HELPER — check if one RGBA pixel matches a brand color range
═══════════════════════════════════════════════════════════════ */
const pixelMatchesColor = (r, g, b, colorDef) => {
  if (!colorDef) return false;
  return (
    r >= colorDef.r[0] && r <= colorDef.r[1] &&
    g >= colorDef.g[0] && g <= colorDef.g[1] &&
    b >= colorDef.b[0] && b <= colorDef.b[1]
  );
};

/* ═══════════════════════════════════════════════════════════════
   LAYER 1 — Screenshot / flat-image heuristic
   Checks:
     • Edge density   (Sobel kernel — low = flat image)
     • Uniform background (solid color fills most of frame)
═══════════════════════════════════════════════════════════════ */
export const isScreenshot = async (buffer) => {
  const pipeline = resizeForAnalysis(buffer);
  const meta     = await pipeline.clone().metadata();
  const imgW     = meta.width  ?? CFG.analysisWidth;
  const imgH     = meta.height ?? CFG.analysisHeight;

  /* Edge density via Laplacian-style kernel */
  const { data: edgeData } = await pipeline
    .clone()
    .greyscale()
    .convolve({
      width : 3, height: 3,
      kernel: [-1, -1, -1,
               -1,  8, -1,
               -1, -1, -1],
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPx    = edgeData.length;
  const edgePx     = edgeData.reduce((s, v) => s + (v > 20 ? 1 : 0), 0);
  const edgeDensity = edgePx / totalPx;

  if (edgeDensity < CFG.edgeDensityFloor) {
    return { isScreenshot: true, reason: "flat_image", edgeDensity };
  }

  /* Uniform background — sample top-left 10×10 as reference color */
  const { data: bgSample } = await pipeline
    .clone()
    .extract({ left: 0, top: 0, width: 10, height: 10 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const baseR = bgSample[0];
  const baseG = bgSample[1];
  const baseB = bgSample[2];

  const { data: fullData } = await pipeline
    .clone()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let uniformCount = 0;
  for (let i = 0; i < fullData.length; i += 3) {
    if (
      Math.abs(fullData[i]   - baseR) < 15 &&
      Math.abs(fullData[i+1] - baseG) < 15 &&
      Math.abs(fullData[i+2] - baseB) < 15
    ) uniformCount++;
  }

  const uniformRatio = uniformCount / (fullData.length / 3);
  if (uniformRatio > CFG.uniformBgThreshold) {
    return { isScreenshot: true, reason: "uniform_background", uniformRatio };
  }

  return { isScreenshot: false };
};

/* ═══════════════════════════════════════════════════════════════
   LAYER 2 — Color evidence collection
   IMPORTANT: color evidence is NEVER a standalone trigger.
   It is collected here and only used later inside mergeDetections
   to slightly boost confidence when OCR already found a match.
═══════════════════════════════════════════════════════════════ */
const collectColorEvidence = async (pipeline, imgW, imgH) => {
  const evidence = new Map(); // competitorName → { ratio, corner }

  for (const sig of COMPETITOR_SIGNATURES) {
    if (!sig.color) continue;

    for (const corner of sig.corners) {
      const cornerData = await extractCorner(pipeline, imgW, imgH, corner);

      let matchCount = 0;
      const totalPx  = cornerData.length / 4; // RGBA → 4 bytes per px

      for (let i = 0; i < cornerData.length; i += 4) {
        if (
          pixelMatchesColor(
            cornerData[i],
            cornerData[i + 1],
            cornerData[i + 2],
            sig.color
          )
        ) matchCount++;
      }

      const ratio = matchCount / totalPx;

      if (ratio >= CFG.colorMatchRatio) {
        const existing = evidence.get(sig.name);
        if (!existing || ratio > existing.ratio) {
          evidence.set(sig.name, { corner, ratio });
        }
      }
    }
  }

  /* Color-only hits are returned but CANNOT produce a verdict alone.
     Callers (mergeDetections) decide what to do with them.          */
  return evidence;
};

/* ═══════════════════════════════════════════════════════════════
   LAYER 3 — OCR text detection
   Sole trigger for competitor warn/block verdicts.
   Runs on corner regions only (faster + more accurate than full).
═══════════════════════════════════════════════════════════════ */
const detectByOCR = async (buffer, imgW, imgH) => {
  const t = await getTesseract();

  if (!t) {
    /* Tesseract not installed — skip OCR, return empty */
    return { loemarFound: false, competitors: [] };
  }

  try {
    /* Extract 4 corners as separate greyscale buffers for OCR */
    const cornerBuffers = await Promise.all(
      ["tl", "tr", "bl", "br"].map(async (corner) => {
        const fw   = Math.floor(imgW * CFG.ocrCornerFraction);
        const fh   = Math.floor(imgH * CFG.ocrCornerHeight);
        const left = corner.includes("r") ? imgW - fw : 0;
        const top  = corner.includes("b") ? imgH - fh : 0;

        return sharp(buffer)
          .extract({
            left,
            top,
            width  : Math.max(1, fw),
            height : Math.max(1, fh),
          })
          .greyscale()
          .normalize()   // boost contrast → better OCR accuracy
          .png()
          .toBuffer();
      })
    );

    /* Run OCR on all 4 corners in parallel */
    const ocrTexts = await Promise.all(
      cornerBuffers.map((buf) =>
        t.recognize(buf, "eng", { logger: () => {} })
          .then((r) => r.data.text.toLowerCase())
          .catch(() => "")
      )
    );

    const allText = ocrTexts.join(" ");

    /* Check for our own watermark first */
    const loemarFound = LOEMART_SIGNATURES.some((sig) =>
      allText.includes(sig)
    );

    /* Check all competitors */
    const competitors = [];
    for (const sig of COMPETITOR_SIGNATURES) {
      const textMatch = sig.text.some((t) => allText.includes(t));
      if (textMatch) {
        competitors.push({
          competitor : sig.name,
          method     : "ocr",
          confidence : 0.85,
          severity   : sig.severity,
        });
      }
    }

    return { loemarFound, competitors };

  } catch (err) {
    console.warn("[watermarkDetector] OCR error:", err.message);
    return { loemarFound: false, competitors: [] };
  }
};

/* ═══════════════════════════════════════════════════════════════
   LAYER 4 — Coverage estimation
   Only runs when OCR has already confirmed a competitor.
   Samples corner regions for near-white / near-black overlay
   pixels (typical of watermark overlays).
═══════════════════════════════════════════════════════════════ */
const estimateCoverage = async (pipeline, imgW, imgH) => {
  const regions = [
    { left: 0,            top: 0,            width: Math.floor(imgW * 0.3), height: Math.floor(imgH * 0.2) },
    { left: imgW * 0.7|0, top: 0,            width: Math.floor(imgW * 0.3), height: Math.floor(imgH * 0.2) },
    { left: 0,            top: imgH * 0.8|0, width: Math.floor(imgW * 0.3), height: Math.floor(imgH * 0.2) },
    { left: imgW * 0.7|0, top: imgH * 0.8|0, width: Math.floor(imgW * 0.3), height: Math.floor(imgH * 0.2) },
  ];

  let brandedPx    = 0;
  let totalSampled = 0;

  for (const region of regions) {
    if (region.width <= 0 || region.height <= 0) continue;

    const { data } = await pipeline
      .clone()
      .extract(region)
      .raw()
      .toBuffer({ resolveWithObject: true });

    totalSampled += data.length / 3;

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const isOverlay =
        (r > 220 && g > 220 && b > 220) || // white overlay
        (r < 35  && g < 35  && b < 35);    // black overlay
      if (isOverlay) brandedPx++;
    }
  }

  return totalSampled > 0 ? brandedPx / totalSampled : 0;
};

/* ═══════════════════════════════════════════════════════════════
   MERGE DETECTIONS
   OCR is the sole trigger for any warn/block verdict.
   Color evidence can only boost confidence by a small amount.

   Color-only matches are silently discarded — they never produce
   a verdict entry. This prevents false positives from green
   vegetables, orange packaging, blue clothing, etc.
═══════════════════════════════════════════════════════════════ */
const mergeDetections = (ocrMatches, colorEvidence) =>
  ocrMatches.map((ocrMatch) => {
    const colorSupport = colorEvidence.get(ocrMatch.competitor);

    /* OCR baseline confidence: 0.85
       Color corroboration adds at most ~0.03 (ratio * 0.20, capped)  */
    const confidence = colorSupport
      ? Math.min(0.97, ocrMatch.confidence + colorSupport.ratio * 0.20)
      : ocrMatch.confidence;

    return {
      competitor   : ocrMatch.competitor,
      confidence,
      severity     : ocrMatch.severity,
      detectedBy   : colorSupport ? ["ocr", "color"] : ["ocr"],
      colorSupport : colorSupport ?? null,
    };
  });
  /* Note: color-only entries from colorEvidence are never added here */

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT — analyzeWatermark(buffer)

   Returns one of:
   { verdict: "accept",  confidence, details }
   { verdict: "loemart", confidence, details }
   { verdict: "warn",    competitor, message, confidence, details }
   { verdict: "block",   reason,     message, confidence, details }
═══════════════════════════════════════════════════════════════ */
export const analyzeWatermark = async (buffer) => {
  /* ── Resize once, reuse pipeline across all layers ── */
  const pipeline = resizeForAnalysis(buffer);
  const meta     = await pipeline.clone().metadata();
  const imgW     = meta.width  ?? CFG.analysisWidth;
  const imgH     = meta.height ?? CFG.analysisHeight;

  /* ── Layer 1: Screenshot check (independent — no OCR needed) ── */
  const screenshotResult = await isScreenshot(buffer);
  if (screenshotResult.isScreenshot) {
    return {
      verdict    : "block",
      reason     : "screenshot",
      message    :
        "This image looks like a screenshot or promotional graphic. " +
        "Please upload an original photo of the item.",
      confidence : 0.90,
      details    : screenshotResult,
    };
  }

  /* ── Layer 2 + 3: Color evidence + OCR in parallel ── */
  const [colorEvidence, ocrResult] = await Promise.all([
    collectColorEvidence(pipeline, imgW, imgH),
    detectByOCR(buffer, imgW, imgH),
  ]);

  /* ── Check for our own watermark (OCR only) ── */
  if (ocrResult.loemarFound) {
    return {
      verdict    : "loemart",
      confidence : 0.95,
      details    : { source: "ocr" },
    };
  }

  /* ── Merge: OCR drives, color only boosts ── */
  const merged = mergeDetections(ocrResult.competitors, colorEvidence);

  if (merged.length === 0) {
    return {
      verdict    : "accept",
      confidence : 0.85,
      details    : {
        /* Shows how many color "hits" were discarded without OCR backing.
           Useful for debugging false-positive reports.                   */
        colorEvidenceIgnored: colorEvidence.size,
      },
    };
  }

  /* ── Layer 4: Coverage (only because OCR confirmed a competitor) ── */
  const coverage = await estimateCoverage(pipeline, imgW, imgH);
  const topMatch = [...merged].sort((a, b) => b.confidence - a.confidence)[0];

  if (coverage >= CFG.blockCoverageRatio) {
    return {
      verdict    : "block",
      competitor : topMatch.competitor,
      reason     : "heavy_coverage",
      message    :
        `This image appears to be a heavily branded ${topMatch.competitor} ` +
        `listing photo. Please upload your own original photos.`,
      confidence : Math.min(0.99, topMatch.confidence + 0.15),
      details    : {
        coverage,
        matches        : merged,
        detectionBasis : "ocr_confirmed_plus_coverage",
      },
    };
  }

  /* ── Warn ── */
  return {
    verdict    : "warn",
    competitor : topMatch.competitor,
    message    :
      `This image appears to contain a ${topMatch.competitor} watermark. ` +
      `For better buyer trust on Loemart, consider uploading original ` +
      `photos without third-party watermarks. You can still post this listing.`,
    confidence : topMatch.confidence,
    details    : {
      coverage,
      matches        : merged,
      detectionBasis : topMatch.detectedBy.join("+"),
    },
  };
};

/* ═══════════════════════════════════════════════════════════════
   BATCH ANALYZER — analyzeImageBatch(buffers)
   Runs analyzeWatermark on every image.
   Fails open on individual image errors — one bad image
   does not block the others.

   Returns:
   {
     results        : per-image result array
     summary        : { total, clean, loemart, warned, blocked }
     overallVerdict : "accept" | "loemart" | "warn" | "block"
     blockedImages  : number[]  — indexes of blocked images
     warnedImages   : number[]  — indexes of warned images
     warnings       : { imageIndex, competitor, message }[]
   }
═══════════════════════════════════════════════════════════════ */
export const analyzeImageBatch = async (buffers) => {
  const results = await Promise.all(
    buffers.map((buf, i) =>
      analyzeWatermark(buf)
        .then((r) => ({ index: i, ...r }))
        .catch((err) => {
          console.warn(
            `[watermarkDetector] image ${i} analysis failed:`,
            err.message
          );
          /* Fail open — treat as clean rather than blocking the listing */
          return {
            index      : i,
            verdict    : "accept",
            confidence : 1,
            details    : { error: err.message },
          };
        })
    )
  );

  const blocked = results.filter((r) => r.verdict === "block");
  const warned  = results.filter((r) => r.verdict === "warn");
  const loemart = results.filter((r) => r.verdict === "loemart");
  const clean   = results.filter(
    (r) => r.verdict === "accept" || r.verdict === "loemart"
  );

  return {
    results,
    summary: {
      total   : buffers.length,
      clean   : clean.length,
      loemart : loemart.length,
      warned  : warned.length,
      blocked : blocked.length,
    },
    /* Overall: block if ANY image is blocked */
    overallVerdict : blocked.length > 0 ? "block"
                   : warned.length  > 0 ? "warn"
                   : loemart.length > 0 ? "loemart"
                   : "accept",

    blockedImages : blocked.map((r) => r.index),
    warnedImages  : warned.map((r)  => r.index),
    warnings      : warned.map((r)  => ({
      imageIndex : r.index,
      competitor : r.competitor ?? null,
      message    : r.message    ?? "",
    })),
  };
};