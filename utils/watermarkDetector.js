// ════════════════════════════════════════════════════════════════
// FILE: utils/watermarkDetector.js
//
// LENIENT WATERMARK DETECTOR:
//   - Allows sellers to post almost any image of their choice.
//   - Allows screenshots and clean product photos with white backgrounds.
//   - ONLY BLOCKS if a competitor watermark is confirmed AND HUGE (covering >60%).
// ════════════════════════════════════════════════════════════════

import sharp from "sharp";

/* ═══════════════════════════════════════════════════════════════
   COMPETITOR SIGNATURES
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
    color   : null,
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
   OUR OWN WATERMARK SIGNATURES — always accepted
═══════════════════════════════════════════════════════════════ */
const LOEMART_SIGNATURES = Object.freeze([
  "loemart",
  "loemart.com",
]);

/* ═══════════════════════════════════════════════════════════════
   DETECTION CONFIG (Relaxed & Lenient)
═══════════════════════════════════════════════════════════════ */
const CFG = Object.freeze({
  analysisWidth      : 400,
  analysisHeight     : 400,
  cornerFraction     : 0.15,
  colorMatchRatio    : 0.20,
  
  /* Extremely high coverage threshold: ONLY block if watermark covers >60% */
  blockCoverageRatio : 0.60,

  ocrCornerFraction  : 0.30,
  ocrCornerHeight    : 0.20,
});

/* ═══════════════════════════════════════════════════════════════
   TESSERACT — lazy-loaded, optional
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
    console.warn("[watermarkDetector] tesseract.js not installed — OCR disabled.");
    _tesseract   = null;
    _tesseractOk = false;
  }
  return _tesseract;
};

const resizeForAnalysis = (buffer) =>
  sharp(buffer)
    .resize(CFG.analysisWidth, CFG.analysisHeight, {
      fit               : "inside",
      withoutEnlargement: true,
    });

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

const pixelMatchesColor = (r, g, b, colorDef) => {
  if (!colorDef) return false;
  return (
    r >= colorDef.r[0] && r <= colorDef.r[1] &&
    g >= colorDef.g[0] && g <= colorDef.g[1] &&
    b >= colorDef.b[0] && b <= colorDef.b[1]
  );
};

/* ═══════════════════════════════════════════════════════════════
   LAYER 1 — Screenshot Check (Informational Only - NEVER BLOCKS)
═══════════════════════════════════════════════════════════════ */
export const isScreenshot = async (_buffer) => {
  // Always return false so screenshots are NEVER blocked automatically
  return { isScreenshot: false };
};

/* ═══════════════════════════════════════════════════════════════
   LAYER 2 — Color evidence collection
═══════════════════════════════════════════════════════════════ */
const collectColorEvidence = async (pipeline, imgW, imgH) => {
  const evidence = new Map();

  for (const sig of COMPETITOR_SIGNATURES) {
    if (!sig.color) continue;

    for (const corner of sig.corners) {
      const cornerData = await extractCorner(pipeline, imgW, imgH, corner);

      let matchCount = 0;
      const totalPx  = cornerData.length / 4;

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

  return evidence;
};

/* ═══════════════════════════════════════════════════════════════
   LAYER 3 — OCR text detection
═══════════════════════════════════════════════════════════════ */
const detectByOCR = async (buffer, imgW, imgH) => {
  const t = await getTesseract();
  if (!t) return { loemarFound: false, competitors: [] };

  try {
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
          .normalize()
          .png()
          .toBuffer();
      })
    );

    const ocrTexts = await Promise.all(
      cornerBuffers.map((buf) =>
        t.recognize(buf, "eng", { logger: () => {} })
          .then((r) => r.data.text.toLowerCase())
          .catch(() => "")
      )
    );

    const allText = ocrTexts.join(" ");

    const loemarFound = LOEMART_SIGNATURES.some((sig) =>
      allText.includes(sig)
    );

    const competitors = [];
    for (const sig of COMPETITOR_SIGNATURES) {
      const textMatch = sig.text.some((txt) => allText.includes(txt));
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
        (r > 235 && g > 235 && b > 235) || 
        (r < 20  && g < 20  && b < 20);   
      if (isOverlay) brandedPx++;
    }
  }

  return totalSampled > 0 ? brandedPx / totalSampled : 0;
};

const mergeDetections = (ocrMatches, colorEvidence) =>
  ocrMatches.map((ocrMatch) => {
    const colorSupport = colorEvidence.get(ocrMatch.competitor);
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

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT — analyzeWatermark(buffer)
═══════════════════════════════════════════════════════════════ */
export const analyzeWatermark = async (buffer) => {
  const pipeline = resizeForAnalysis(buffer);
  const meta     = await pipeline.clone().metadata();
  const imgW     = meta.width  ?? CFG.analysisWidth;
  const imgH     = meta.height ?? CFG.analysisHeight;

  const [colorEvidence, ocrResult] = await Promise.all([
    collectColorEvidence(pipeline, imgW, imgH),
    detectByOCR(buffer, imgW, imgH),
  ]);

  if (ocrResult.loemarFound) {
    return {
      verdict    : "loemart",
      confidence : 0.95,
      details    : { source: "ocr" },
    };
  }

  const merged = mergeDetections(ocrResult.competitors, colorEvidence);

  if (merged.length === 0) {
    return {
      verdict    : "accept",
      confidence : 0.85,
      details    : { colorEvidenceIgnored: colorEvidence.size },
    };
  }

  const coverage = await estimateCoverage(pipeline, imgW, imgH);
  const topMatch = [...merged].sort((a, b) => b.confidence - a.confidence)[0];

  /* ONLY BLOCK IF WATERMARK COVERAGE IS EXTREMELY HUGE (>60%) */
  if (coverage >= CFG.blockCoverageRatio) {
    return {
      verdict    : "block",
      competitor : topMatch.competitor,
      reason     : "heavy_coverage",
      message    : `This image contains a very large ${topMatch.competitor} watermark covering most of the photo. Please upload a clearer photo.`,
      confidence : Math.min(0.99, topMatch.confidence + 0.15),
      details    : {
        coverage,
        matches        : merged,
        detectionBasis : "ocr_confirmed_plus_heavy_coverage",
      },
    };
  }

  /* OTHERWISE ALLOW WITH WARNING (Seller can still post freely) */
  return {
    verdict    : "warn",
    competitor : topMatch.competitor,
    message    : `This image contains a ${topMatch.competitor} watermark. You can still post this listing, but original photos get more buyer views.`,
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
═══════════════════════════════════════════════════════════════ */
export const analyzeImageBatch = async (buffers) => {
  const results = await Promise.all(
    buffers.map((buf, i) =>
      analyzeWatermark(buf)
        .then((r) => ({ index: i, ...r }))
        .catch((err) => {
          console.warn(`[watermarkDetector] image ${i} analysis bypassed:`, err.message);
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
  const clean   = results.filter((r) => r.verdict === "accept" || r.verdict === "loemart");

  return {
    results,
    summary: {
      total   : buffers.length,
      clean   : clean.length,
      loemart : loemart.length,
      warned  : warned.length,
      blocked : blocked.length,
    },
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