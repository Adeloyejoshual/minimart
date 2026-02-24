// src/pages/Marketplace/AddProduct.jsx
import React from "react";

// STEP 1: just configs, no components
import { categoryFields } from "../../config/categoryFields";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { engines } from "../../config/engine";
import { fuelTypes } from "../../config/fuelTypes";
import { featuresByCategory } from "../../config/features";
import { promotionPlans } from "../../config/promotion";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";

export default function AddProduct() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 32, color: "#2563eb", marginBottom: 16 }}>
        🔍 AddProduct config debug
      </h1>

      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#f1f5f9",
          padding: 16,
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        {JSON.stringify(
          {
            hasCategoryFields: !!categoryFields,
            hasConditions: !!conditions,
            hasUsedDetails: !!usedDetails,
            hasRamOptions: !!ramOptions,
            hasStorageOptions: !!storageOptions,
            hasColors: !!colors,
            hasEngines: !!engines,
            hasFuelTypes: !!fuelTypes,
            hasFeaturesByCategory: !!featuresByCategory,
            hasPromotionPlans: !!promotionPlans,
            hasLocationsByState: !!locationsByState,
            hasBrands: !!brands,
            hasModels: !!models,
            hasSims: !!sims,
            hasYears: !!years,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}