// utils/watermarkDetector.js — revised core logic

/* ─────────────────────────────────────────────────────────────
   COLOR EVIDENCE  (supporting only — never a standalone signal)
   Stored per competitor name. Only used to boost OCR confidence.
───────────────────────────────────────────────────────────────*/
const collectColorEvidence = async (pipeline, imgW, imgH) => {
  const evidence = new Map(); // competitorName → { ratio, corner }

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

      if (ratio >= DETECTION_CONFIG.colorMatchRatio) {
        // Only keep the strongest corner match per competitor
        const existing = evidence.get(sig.name);
        if (!existing || ratio > existing.ratio) {
          evidence.set(sig.name, { corner, ratio });
        }
      }
    }
  }

  return evidence; // Map — callers decide what to do with it
};

/* ─────────────────────────────────────────────────────────────
   MERGE RESULTS
   OCR is required for any warn/block verdict.
   Color evidence only adjusts confidence upward.
───────────────────────────────────────────────────────────────*/
const mergeDetections = (ocrMatches, colorEvidence) => {
  // Start from OCR matches only
  return ocrMatches.map((ocrMatch) => {
    const colorSupport = colorEvidence.get(ocrMatch.competitor);

    let confidence = ocrMatch.confidence; // baseline from OCR alone

    if (colorSupport) {
      // Color agrees with OCR — mild boost, capped at 0.97
      // e.g. OCR=0.85 + colorRatio=0.15 → 0.85 + (0.15 * 0.2) = 0.88
      confidence = Math.min(
        0.97,
        confidence + colorSupport.ratio * 0.20
      );
    }

    return {
      competitor   : ocrMatch.competitor,
      confidence,
      severity     : ocrMatch.severity,
      detectedBy   : colorSupport ? ["ocr", "color"] : ["ocr"],
      colorSupport : colorSupport ?? null,
    };
  });
  // Note: color-only matches are simply discarded — never returned
};