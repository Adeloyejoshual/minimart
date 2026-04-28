// config/index.js

import authenticate from "../middleware/auth.js";

import { brands } from "../src/config/brands.js";
import { colors } from "../src/config/colors.js";
import { categoryFields } from "../src/config/categoryFields.js";
import { conditions, usedDetails } from "../src/config/conditions.js";
import { featuresByCategory } from "../src/config/featuresByCategory.js";
import { models } from "../src/config/models.js";
import { ramOptions } from "../src/config/ramOptions.js";
import { sims } from "../src/config/sims.js";
import { storageOptions } from "../src/config/storageOptions.js";
import { years } from "../src/config/years.js";
import { engines } from "../src/config/engines.js";
import { fuelTypes } from "../src/config/fuelTypes.js";
import { locationsByState } from "../src/config/locationsByState.js";
import { promotionPlans } from "../src/config/promotions.js";

export {
  authenticate,

  brands,
  colors,
  categoryFields,
  conditions,
  usedDetails,
  featuresByCategory,
  models,
  ramOptions,
  sims,
  storageOptions,
  years,
  engines,
  fuelTypes,
  locationsByState,
  promotionPlans,
};