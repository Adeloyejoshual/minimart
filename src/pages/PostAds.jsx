import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useReducer,
} from "react";

import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

import {
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiCheckCircle,
  FiLoader,
  FiSave,
  FiShield,
  FiTrendingUp,
  FiAlertTriangle,
} from "react-icons/fi";

import categories from "../config/categories";

import "../styles/PostAds.css";

import StepBar from "./PostAds/StepBar";
import ImageGrid from "./PostAds/ImageGrid";
import VariantEditor from "./PostAds/VariantEditor";
import PricingStep from "./PostAds/PricingStep";
import ReviewStep from "./PostAds/ReviewStep";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

const API = "https://minimart-ivrm.onrender.com/api";

const DRAFT_KEY =
  "minimart-post-ad-enterprise-v1";

const MAX_IMAGES = 10;

const MAX_VARIANTS = 50;

/* ─────────────────────────────────────────────
   STEP REGISTRY
───────────────────────────────────────────── */

const STEPS = [
  {
    id: 1,
    key: "media",
    label: "Photos",
  },
  {
    id: 2,
    key: "details",
    label: "Details",
  },
  {
    id: 3,
    key: "variants",
    label: "Variants",
  },
  {
    id: 4,
    key: "pricing",
    label: "Pricing",
  },
  {
    id: 5,
    key: "review",
    label: "Review",
  },
];

/* ─────────────────────────────────────────────
   FUTURE VARIANT MODEL
───────────────────────────────────────────── */

const createVariant = () => ({
  id:
    Date.now() +
    Math.random(),

  identity: {
    sku: "",
    name: "",
  },

  pricing: {
    price: "",
    compareAtPrice: "",
  },

  inventory: {
    quantity: 1,
    lowStockThreshold: 3,
  },

  attributes: [
    {
      id: crypto.randomUUID(),
      key: "",
      value: "",
    },
  ],
});

/* ─────────────────────────────────────────────
   INITIAL STATE
───────────────────────────────────────────── */

const initialState = {
  currentStep: 1,

  posting: false,

  posted: false,

  draftSaving: false,

  media: {
    images: Array(MAX_IMAGES).fill(null),
  },

  product: {
    title: "",
    description: "",
    category: "",
  },

  pricing: {
    basePrice: "",
    originalPrice: "",
    costPrice: "",
  },

  inventory: {
    trackInventory: true,
  },

  content: {
    keyFeatures: [""],

    specifications: [
      {
        key: "",
        value: "",
      },
    ],

    whatsInBox: [""],
  },

  variants: [
    createVariant(),
  ],
};

/* ─────────────────────────────────────────────
   REDUCER
───────────────────────────────────────────── */

function reducer(state, action) {

  switch (action.type) {

    case "SET_STEP":
      return {
        ...state,
        currentStep:
          action.payload,
      };

    case "SET_POSTING":
      return {
        ...state,
        posting:
          action.payload,
      };

    case "SET_POSTED":
      return {
        ...state,
        posted:
          action.payload,
      };

    case "SET_FIELD":
      return {
        ...state,

        [action.section]: {
          ...state[action.section],

          [action.field]:
            action.value,
        },
      };

    case "SET_NESTED_FIELD":
      return {
        ...state,

        [action.section]: {
          ...state[action.section],

          [action.parent]: {
            ...state[action.section][action.parent],

            [action.field]:
              action.value,
          },
        },
      };

    case "SET_IMAGES":
      return {
        ...state,

        media: {
          ...state.media,

          images:
            action.payload,
        },
      };

    case "SET_CONTENT_LIST":
      return {
        ...state,

        content: {
          ...state.content,

          [action.key]:
            action.payload,
        },
      };

    case "SET_VARIANTS":
      return {
        ...state,

        variants:
          action.payload,
      };

    case "LOAD_DRAFT":
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */

export default function PostAds({
  user,
  onClose,
}) {

  const navigate =
    useNavigate();

  const [state, dispatch] =
    useReducer(
      reducer,
      initialState
    );

  /* ─────────────────────────────────────────
     STATE
  ───────────────────────────────────────── */

  const {
    currentStep,
    posting,
    posted,

    media,
    product,
    pricing,
    content,
    variants,
  } = state;

  const {
    images,
  } = media;

  const {
    title,
    description,
    category,
  } = product;

  const {
    basePrice,
    originalPrice,
    costPrice,
  } = pricing;

  const {
    keyFeatures,
    specifications,
    whatsInBox,
  } = content;

  /* ─────────────────────────────────────────
     MEMOS
  ───────────────────────────────────────── */

  const filledImages =
    useMemo(
      () =>
        images.filter(Boolean),
      [images]
    );

  const activeCategory =
    useMemo(
      () =>
        categories.find(
          (c) =>
            c.id === category
        ),
      [category]
    );

  const discountPct =
    useMemo(() => {

      if (
        !originalPrice ||
        !basePrice
      ) return 0;

      if (
        Number(originalPrice) <=
        Number(basePrice)
      ) return 0;

      return Math.round(
        (
          (
            Number(originalPrice) -
            Number(basePrice)
          ) /
          Number(originalPrice)
        ) * 100
      );

    }, [
      basePrice,
      originalPrice,
    ]);

  const completionScore =
    useMemo(() => {

      let score = 0;

      if (filledImages.length >= 3)
        score += 20;

      if (title.length >= 5)
        score += 20;

      if (
        description.length >= 60
      )
        score += 20;

      if (category)
        score += 10;

      if (
        variants.length > 0
      )
        score += 15;

      if (
        keyFeatures.some(
          (f) => f.trim()
        )
      )
        score += 10;

      if (
        specifications.some(
          (s) =>
            s.key &&
            s.value
        )
      )
        score += 5;

      return score;

    }, [
      filledImages,
      title,
      description,
      category,
      variants,
      keyFeatures,
      specifications,
    ]);

  /* ─────────────────────────────────────────
     DRAFT LOAD
  ───────────────────────────────────────── */

  useEffect(() => {

    try {

      const raw =
        localStorage.getItem(
          DRAFT_KEY
        );

      if (!raw) return;

      const parsed =
        JSON.parse(raw);

      dispatch({
        type: "LOAD_DRAFT",
        payload: parsed,
      });

    } catch {}

  }, []);

  /* ─────────────────────────────────────────
     AUTO SAVE
  ───────────────────────────────────────── */

  useEffect(() => {

    const timeout =
      setTimeout(() => {

        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify(state)
        );

      }, 700);

    return () =>
      clearTimeout(timeout);

  }, [state]);

  /* ─────────────────────────────────────────
     CLEANUP
  ───────────────────────────────────────── */

  useEffect(() => {

    return () => {

      images.forEach(
        (img) => {

          if (
            img?.preview
          ) {
            URL.revokeObjectURL(
              img.preview
            );
          }

        }
      );

    };

  }, [images]);

  /* ─────────────────────────────────────────
     IMAGE ENGINE
  ───────────────────────────────────────── */

  const handleAddImage =
    useCallback(
      (index, file) => {

        if (
          !file.type.startsWith(
            "image/"
          )
        ) {
          toast.error(
            "Only image files allowed"
          );
          return;
        }

        if (
          file.size >
          5 * 1024 * 1024
        ) {
          toast.error(
            "Image must be under 5MB"
          );
          return;
        }

        const preview =
          URL.createObjectURL(
            file
          );

        const next =
          [...images];

        next[index] = {
          file,
          preview,
          progress: 0,
          status: "ready",
        };

        dispatch({
          type: "SET_IMAGES",
          payload: next,
        });

      },
      [images]
    );

  const handleRemoveImage =
    useCallback(
      (index) => {

        const next =
          [...images];

        if (
          next[index]?.preview
        ) {
          URL.revokeObjectURL(
            next[index].preview
          );
        }

        next[index] = null;

        dispatch({
          type: "SET_IMAGES",
          payload: next,
        });

      },
      [images]
    );

  /* ─────────────────────────────────────────
     CONTENT HELPERS
  ───────────────────────────────────────── */

  const updateList =
    (
      key,
      index,
      value
    ) => {

      const next =
        [...content[key]];

      next[index] = value;

      dispatch({
        type:
          "SET_CONTENT_LIST",

        key,

        payload: next,
      });

    };

  const addList =
    (
      key,
      value
    ) => {

      dispatch({
        type:
          "SET_CONTENT_LIST",

        key,

        payload: [
          ...content[key],
          value,
        ],
      });

    };

  const removeList =
    (
      key,
      index
    ) => {

      if (
        content[key].length <= 1
      ) return;

      dispatch({
        type:
          "SET_CONTENT_LIST",

        key,

        payload:
          content[key].filter(
            (_, i) =>
              i !== index
          ),
      });

    };

  /* ─────────────────────────────────────────
     VARIANT ENGINE
  ───────────────────────────────────────── */

  const updateVariant =
    (
      index,
      path,
      value
    ) => {

      const next =
        [...variants];

      const keys =
        path.split(".");

      let target =
        next[index];

      for (
        let i = 0;
        i <
        keys.length - 1;
        i++
      ) {
        target =
          target[
            keys[i]
          ];
      }

      target[
        keys[
          keys.length - 1
        ]
      ] = value;

      dispatch({
        type:
          "SET_VARIANTS",

        payload: next,
      });

    };

  const updateVariantAttribute =
    (
      variantIndex,
      attributeId,
      field,
      value
    ) => {

      const next =
        [...variants];

      next[
        variantIndex
      ].attributes =
        next[
          variantIndex
        ].attributes.map(
          (attr) =>
            attr.id ===
            attributeId
              ? {
                  ...attr,
                  [field]:
                    value,
                }
              : attr
        );

      dispatch({
        type:
          "SET_VARIANTS",

        payload: next,
      });

    };

  const addVariant =
    () => {

      if (
        variants.length >=
        MAX_VARIANTS
      ) {
        toast.error(
          "Maximum variants reached"
        );

        return;
      }

      dispatch({
        type:
          "SET_VARIANTS",

        payload: [
          ...variants,
          createVariant(),
        ],
      });

    };

  const removeVariant =
    (index) => {

      if (
        variants.length <= 1
      ) return;

      dispatch({
        type:
          "SET_VARIANTS",

        payload:
          variants.filter(
            (_, i) =>
              i !== index
          ),
      });

    };

  /* ─────────────────────────────────────────
     VALIDATION ENGINE
  ───────────────────────────────────────── */

  const validateStep =
    useCallback(() => {

      switch (
        currentStep
      ) {

        case 1:
          return (
            filledImages.length >
            0
          );

        case 2:
          return (
            title.trim()
              .length >= 3 &&
            category
          );

        case 3:
          return variants.every(
            (v) =>
              v.identity.sku
                .trim() &&
              v.identity.name
                .trim()
          );

        case 4:
          return (
            Number(
              basePrice
            ) > 0
          );

        default:
          return true;
      }

    }, [
      currentStep,
      filledImages,
      title,
      category,
      variants,
      basePrice,
    ]);

  /* ─────────────────────────────────────────
     SUBMIT ENGINE
  ───────────────────────────────────────── */

  const handleSubmit =
    async () => {

      if (!user) {
        toast.error(
          "Please login first"
        );
        return;
      }

      if (
        filledImages.length ===
        0
      ) {
        toast.error(
          "Please upload at least one image"
        );
        return;
      }

      dispatch({
        type:
          "SET_POSTING",

        payload: true,
      });

      try {

        const token =
          localStorage.getItem(
            "token"
          );

        const fd =
          new FormData();

        /* PRODUCT */

        fd.append(
          "name",
          title.trim()
        );

        fd.append(
          "description",
          description.trim()
        );

        fd.append(
          "category",
          category
        );

        /* PRICING */

        fd.append(
          "basePrice",
          basePrice
        );

        fd.append(
          "originalPrice",
          originalPrice
        );

        fd.append(
          "costPrice",
          costPrice
        );

        /* CONTENT */

        fd.append(
          "keyFeatures",
          JSON.stringify(
            keyFeatures.filter(
              (f) =>
                f.trim()
            )
          )
        );

        fd.append(
          "specifications",
          JSON.stringify(
            specifications.filter(
              (s) =>
                s.key &&
                s.value
            )
          )
        );

        fd.append(
          "whatsInBox",
          JSON.stringify(
            whatsInBox.filter(
              (w) =>
                w.trim()
            )
          )
        );

        /* VARIANTS */

        fd.append(
          "variants",
          JSON.stringify(
            variants
          )
        );

        /* MEDIA */

        filledImages.forEach(
          (img) => {

            if (
              img?.file
            ) {
              fd.append(
                "images",
                img.file
              );
            }

          }
        );

        /* REQUEST */

        await axios.post(
          `${API}/products`,
          fd,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "multipart/form-data",
            },
          }
        );

        localStorage.removeItem(
          DRAFT_KEY
        );

        dispatch({
          type:
            "SET_POSTED",

          payload: true,
        });

        toast.success(
          "Product published successfully"
        );

      } catch (err) {

        if (
          !err.response
        ) {
          toast.error(
            "Network error"
          );
        }

        else if (
          err.response
            .status === 401
        ) {
          toast.error(
            "Session expired"
          );
        }

        else {
          toast.error(
            err.response
              ?.data
              ?.message ||
            "Failed to publish product"
          );
        }

      } finally {

        dispatch({
          type:
            "SET_POSTING",

          payload: false,
        });

      }

    };

  /* ═══════════════════════════════════════
     SUCCESS SCREEN
  ═══════════════════════════════════════ */

  if (posted) {

    return (
      <div className="pa-overlay">

        <div className="pa-success-screen">

          <div className="pa-success-icon">
            <FiCheckCircle size={52} />
          </div>

          <h1>
            Product Published
          </h1>

          <p>
            Your listing is now live
            on the marketplace.
          </p>

          <div className="pa-success-actions">

            <button
              className="pa-primary-btn"
              onClick={() =>
                navigate(
                  "/dashboard"
                )
              }
            >
              View Listings
            </button>

            <button
              className="pa-secondary-btn"
              onClick={() =>
                navigate(
                  "/minimart"
                )
              }
            >
              Browse Marketplace
            </button>

          </div>

        </div>

      </div>
    );
  }

  /* ═══════════════════════════════════════
     MAIN UI
  ═══════════════════════════════════════ */

  return (
    <div
      className="pa-overlay"
      onClick={(e) => {

        if (
          e.target ===
          e.currentTarget
        ) {
          onClose?.();
        }

      }}
    >

      <div className="pa-sheet">

        {/* HEADER */}

        <div className="pa-header">

          <div>

            <h2>
              Create Product Listing
            </h2>

            <p>
              Enterprise seller workflow
            </p>

          </div>

          <div className="pa-header-right">

            <div className="pa-score">

              <FiTrendingUp size={15} />

              {completionScore}% Complete

            </div>

            <button
              className="pa-close-btn"
              onClick={() =>
                onClose?.()
              }
            >
              <FiX size={17} />
            </button>

          </div>

        </div>

        {/* STEPBAR */}

        <StepBar
          current={
            currentStep
          }
        />

        {/* ANALYTICS */}

        <div className="pa-top-insights">

          <div className="pa-top-card">
            <strong>
              {filledImages.length}
            </strong>
            Photos
          </div>

          <div className="pa-top-card">
            <strong>
              {variants.length}
            </strong>
            Variants
          </div>

          <div className="pa-top-card">
            <strong>
              ₦
              {Number(
                basePrice || 0
              ).toLocaleString()}
            </strong>
            Base Price
          </div>

          <div className="pa-top-card">
            <strong>
              {discountPct}%
            </strong>
            Discount
          </div>

        </div>

        {/* BODY */}

        <div className="pa-body">

          {/* STEP 1 */}

          {currentStep === 1 && (
            <ImageGrid
              images={images}
              onAdd={
                handleAddImage
              }
              onRemove={
                handleRemoveImage
              }
            />
          )}

          {/* STEP 2 */}

          {currentStep === 2 && (
            <div>
              <div className="pa-field">

                <label>
                  Product Title
                </label>

                <input
                  className="pa-input"
                  value={title}
                  maxLength={80}
                  placeholder="e.g. iPhone 15 Pro Max 512GB"
                  onChange={(e) =>
                    dispatch({
                      type:
                        "SET_FIELD",

                      section:
                        "product",

                      field:
                        "title",

                      value:
                        e.target
                          .value,
                    })
                  }
                />

              </div>
            </div>
          )}

          {/* STEP 3 */}

          {currentStep === 3 && (
            <VariantEditor
              variants={
                variants
              }
              onUpdate={
                updateVariant
              }
              onUpdateAttr={
                updateVariantAttribute
              }
              onAdd={
                addVariant
              }
              onRemove={
                removeVariant
              }
            />
          )}

          {/* STEP 4 */}

          {currentStep === 4 && (
            <PricingStep
              basePrice={
                basePrice
              }
              setBasePrice={(
                value
              ) =>
                dispatch({
                  type:
                    "SET_FIELD",

                  section:
                    "pricing",

                  field:
                    "basePrice",

                  value,
                })
              }
              originalPrice={
                originalPrice
              }
              setOriginalPrice={(
                value
              ) =>
                dispatch({
                  type:
                    "SET_FIELD",

                  section:
                    "pricing",

                  field:
                    "originalPrice",

                  value,
                })
              }
              costPrice={
                costPrice
              }
              setCostPrice={(
                value
              ) =>
                dispatch({
                  type:
                    "SET_FIELD",

                  section:
                    "pricing",

                  field:
                    "costPrice",

                  value,
                })
              }
              variants={
                variants
              }
              discountPct={
                discountPct
              }
            />
          )}

          {/* STEP 5 */}

          {currentStep === 5 && (
            <ReviewStep
              filledImages={
                filledImages
              }
              title={title}
              description={
                description
              }
              category={
                category
              }
              activeCategory={
                activeCategory
              }
              basePrice={
                basePrice
              }
              originalPrice={
                originalPrice
              }
              discountPct={
                discountPct
              }
              variants={
                variants
              }
              keyFeatures={
                keyFeatures
              }
              specifications={
                specifications
              }
              whatsInBox={
                whatsInBox
              }
              posting={
                posting
              }
              onSubmit={
                handleSubmit
              }
            />
          )}

        </div>

        {/* FOOTER */}

        <div className="pa-footer">

          <div className="pa-footer-left">

            <div className="pa-draft-state">

              <FiSave size={14} />

              Draft auto-saved

            </div>

            <div className="pa-security-state">

              <FiShield size={14} />

              Protected listing flow

            </div>

          </div>

          <div className="pa-footer-actions">

            {currentStep > 1 && (
              <button
                className="pa-btn-back"
                onClick={() =>
                  dispatch({
                    type:
                      "SET_STEP",

                    payload:
                      currentStep -
                      1,
                  })
                }
              >

                <FiChevronLeft size={16} />

                Back

              </button>
            )}

            {currentStep < 5 && (
              <button
                disabled={
                  !validateStep()
                }
                className="pa-btn-next"
                onClick={() =>
                  dispatch({
                    type:
                      "SET_STEP",

                    payload:
                      currentStep +
                      1,
                  })
                }
              >

                Continue

                <FiChevronRight size={16} />

              </button>
            )}

            {currentStep === 5 && (
              <button
                disabled={
                  posting
                }
                className="pa-publish-btn"
                onClick={
                  handleSubmit
                }
              >

                {posting ? (
                  <>
                    <FiLoader className="pa-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <FiCheckCircle size={16} />
                    Publish Product
                  </>
                )}

              </button>
            )}

          </div>

        </div>

        {/* LOW QUALITY WARNING */}

        {completionScore <
          60 && (
          <div className="pa-quality-warning">

            <FiAlertTriangle size={16} />

            Listings with more images,
            better descriptions, and
            complete specifications
            perform significantly better.

          </div>
        )}

      </div>

    </div>
  );
}