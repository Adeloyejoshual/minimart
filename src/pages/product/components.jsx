import { useMemo } from "react";
import DropdownModal from "../../components/DropdownModal.jsx";
import AddProductHeader from "../../components/AddProductHeader.jsx";
import { promotionPlans } from "../../config/promotions.js";
import { categoryFields } from "../../config/categoryFields.js";

/* ==================================================
   HELPERS
================================================== */
const normalizeOptions = (list = []) => {
  if (!Array.isArray(list)) return [];

  return list.map((item) => {
    if (typeof item === "string") {
      return { id: item, name: item };
    }

    return {
      id: item.id ?? item.value ?? item.name,
      name: item.name ?? item.label ?? item.id,
    };
  });
};

const getCategoryList = (categories = []) => {
  return categories.map((cat) => ({
    id: String(cat.id),
    name: cat.name,
  }));
};

/* ==================================================
   COMPONENT
================================================== */
export default function ProductComponents({
  form,
  attributes,
  images,
  state,
  city,
  categories,
  selectedPlan,
  paymentData,
  loading,
  error,
  success,
  states,
  cities,
  options,
  selectedCategory,
  updateForm,
  updateAttribute,
  updateContact,
  updateDelivery,
  updateDeliveryDuration,
  toggleFeature,
  setState,
  setCity,
  setSelectedPlan,
  handleImages,
  removeImage,
  handleSubmit,
  clearDraft,
  displayPrice,
  formatLabel,
  onlyNumbers,
  onlyDigits,
  INITIAL_FORM,
}) {
  const MAX_IMAGES = 6;

  /* ==========================================
     CATEGORY OPTIONS
  ========================================== */
  const categoryOptions = useMemo(
    () => getCategoryList(categories),
    [categories]
  );

  /* ==========================================
     DYNAMIC FIELDS
  ========================================== */
  const fields = useMemo(() => {
    if (!selectedCategory) return [];

    const backendFields = Array.isArray(options.fields)
      ? options.fields
      : [];

    const staticFields =
      categoryFields[selectedCategory.name] || [];

    return [...backendFields, ...staticFields]
      .filter(Boolean)
      .filter(
        (field, index, arr) =>
          arr.indexOf(field) === index
      )
      .filter(
        (field) =>
          field !== "brand" &&
          field !== "model"
      );
  }, [selectedCategory, options]);

  /* ==========================================
     MODELS
  ========================================== */
  const modelOptions = useMemo(() => {
    if (!attributes?.brand) return [];

    const key =
      attributes.brand.toLowerCase();

    return normalizeOptions(
      options?.models?.[key] || []
    );
  }, [attributes?.brand, options]);

  /* ==========================================
     ALL OPTIONS MAP
  ========================================== */
  const optionsMap = {
    brand: normalizeOptions(options.brands),
    color: normalizeOptions(options.colors),
    condition: normalizeOptions(
      options.conditions
    ),
    used_detail: normalizeOptions(
      options.usedDetails ||
        options.used_details
    ),
    ram: normalizeOptions(options.ram),
    storage: normalizeOptions(
      options.storage
    ),
    sim: normalizeOptions(options.sim),
    year: normalizeOptions(options.years),
    engine: normalizeOptions(
      options.engines
    ),
    fuel_type: normalizeOptions(
      options.fuel_types
    ),
    size: normalizeOptions(options.size),
    age_range: normalizeOptions(
      options.age_range
    ),
    bedrooms: normalizeOptions(
      options.bedrooms
    ),
    bathrooms: normalizeOptions(
      options.bathrooms
    ),
    experience_level:
      normalizeOptions(
        options.experience_level
      ),
    skills: normalizeOptions(
      options.skills
    ),
    features: Array.isArray(
      options.features
    )
      ? options.features
      : [],
  };

  return (
    <>
      <AddProductHeader
        title="Create Product"
        onClearDraft={clearDraft}
      />

      {/* =====================================
          BASIC INFO
      ===================================== */}
      <section className="section form-card">
        <h3 className="section-title">
          Basic Information
        </h3>

        <div className="form-group">
          <label>
            Product Title *
          </label>
          <input
            value={form.title}
            placeholder="Enter product title"
            onChange={(e) =>
              updateForm(
                "title",
                e.target.value
              )
            }
          />
        </div>

        <div className="form-group">
          <label>
            Description *
          </label>
          <textarea
            rows={4}
            value={form.description}
            placeholder="Describe your product clearly"
            onChange={(e) =>
              updateForm(
                "description",
                e.target.value
              )
            }
          />
        </div>

        <div className="form-group">
          <label>
            Price (₦) *
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={displayPrice(
              form.price
            )}
            placeholder="Enter amount"
            onChange={(e) =>
              updateForm(
                "price",
                onlyNumbers(
                  e.target.value
                )
              )
            }
          />
        </div>
      </section>

      {/* =====================================
          PRODUCT DETAILS
      ===================================== */}
      <section className="section form-card">
        <h3 className="section-title">
          Product Details
        </h3>

        <div className="form-group">
          <label>
            Category *
          </label>

          <DropdownModal
            value={String(
              form.category_id || ""
            )}
            options={categoryOptions}
            placeholder="Select category"
            onChange={(value) => {
              updateForm(
                "category_id",
                value
              );
              updateForm(
                "subcategory_id",
                ""
              );
              updateForm(
                "attributes",
                INITIAL_FORM.attributes
              );
            }}
          />
        </div>

        {optionsMap.brand.length >
          0 && (
          <div className="form-group">
            <label>
              Brand
            </label>
            <DropdownModal
              value={
                attributes?.brand ||
                ""
              }
              options={
                optionsMap.brand
              }
              onChange={(value) =>
                updateAttribute(
                  "brand",
                  value
                )
              }
            />
          </div>
        )}

        {modelOptions.length >
          0 && (
          <div className="form-group">
            <label>
              Model
            </label>
            <DropdownModal
              value={
                attributes?.model ||
                ""
              }
              options={
                modelOptions
              }
              onChange={(value) =>
                updateAttribute(
                  "model",
                  value
                )
              }
            />
          </div>
        )}

        {fields.map((field) => {
          const list =
            optionsMap[field] ||
            [];

          if (!list.length)
            return null;

          if (
            field ===
              "used_detail" &&
            attributes?.condition !==
              "Used"
          ) {
            return null;
          }

          return (
            <div
              className="form-group"
              key={field}
            >
              <label>
                {formatLabel(
                  field
                )}
              </label>

              <DropdownModal
                value={
                  attributes?.[
                    field
                  ] || ""
                }
                options={list}
                onChange={(
                  value
                ) =>
                  updateAttribute(
                    field,
                    value
                  )
                }
              />
            </div>
          );
        })}

        {optionsMap.features
          .length > 0 && (
          <div className="form-group">
            <label>
              Features
            </label>

            <div className="checkbox-grid-inline">
              {optionsMap.features.map(
                (
                  feature
                ) => (
                  <label
                    key={
                      feature
                    }
                    className="checkbox-inline"
                  >
                    <input
                      type="checkbox"
                      checked={
                        attributes?.features?.includes(
                          feature
                        ) ||
                        false
                      }
                      onChange={() =>
                        toggleFeature(
                          feature
                        )
                      }
                    />
                    <span>
                      {formatLabel(
                        feature
                      )}
                    </span>
                  </label>
                )
              )}
            </div>
          </div>
        )}
      </section>

      {/* =====================================
          CONTACT
      ===================================== */}
      <section className="section form-card">
        <h3 className="section-title">
          Contact Information
        </h3>

        <div className="form-row">
          <div className="form-group">
            <label>
              Email *
            </label>
            <input
              type="email"
              value={
                form.contact
                  .email
              }
              onChange={(e) =>
                updateContact(
                  "email",
                  e.target.value
                )
              }
            />
          </div>

          <div className="form-group">
            <label>
              Phone *
            </label>
            <input
              type="tel"
              value={
                form.contact
                  .phone
              }
              onChange={(e) =>
                updateContact(
                  "phone",
                  onlyDigits(
                    e.target
                      .value
                  )
                )
              }
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>
              WhatsApp *
            </label>
            <input
              type="tel"
              value={
                form.contact
                  .whatsapp
              }
              onChange={(e) =>
                updateContact(
                  "whatsapp",
                  onlyDigits(
                    e.target
                      .value
                  )
                )
              }
            />
          </div>

          <div className="form-group">
            <label>
              WhatsApp Link
            </label>
            <input
              type="url"
              value={
                form.contact
                  .whatsapp_link
              }
              onChange={(e) =>
                updateContact(
                  "whatsapp_link",
                  e.target.value
                )
              }
            />
          </div>
        </div>
      </section>

      {/* =====================================
          LOCATION
      ===================================== */}
      <section className="section form-card">
        <h3 className="section-title">
          Location & Delivery
        </h3>

        <div className="form-row">
          <div className="form-group">
            <label>
              State *
            </label>

            <DropdownModal
              value={state}
              options={states.map(
                (
                  item
                ) => ({
                  id: item,
                  name: item,
                })
              )}
              onChange={
                setState
              }
            />
          </div>

          {state && (
            <div className="form-group">
              <label>
                City *
              </label>

              <DropdownModal
                value={city}
                options={cities.map(
                  (
                    item
                  ) => ({
                    id: item,
                    name: item,
                  })
                )}
                onChange={
                  setCity
                }
              />
            </div>
          )}
        </div>
      </section>

      {/* =====================================
          IMAGES
      ===================================== */}
      <section className="section form-card">
        <h3 className="section-title">
          Product Images
        </h3>

        <div className="preview-grid-modern">
          {images.map((img) => (
            <div
              key={img.id}
              className="preview-thumb"
            >
              <img
                src={
                  img.preview
                }
                alt="Preview"
              />

              <button
                type="button"
                onClick={() =>
                  removeImage(
                    img.id
                  )
                }
              >
                ✕
              </button>
            </div>
          ))}

          {images.length <
            MAX_IMAGES && (
            <label className="add-image-box">
              <input
                type="file"
                hidden
                multiple
                accept="image/*"
                onChange={(
                  e
                ) => {
                  handleImages(
                    e.target
                      .files
                  );
                  e.target.value =
                    "";
                }}
              />

              <div>+</div>
              <span>
                Add Images
              </span>
            </label>
          )}
        </div>
      </section>

      {/* =====================================
          PROMOTION
      ===================================== */}
      <section className="section form-card">
        <h3 className="section-title">
          Promotion Plan
        </h3>

        <div className="plans-grid">
          {promotionPlans.map(
            (plan) => (
              <div
                key={plan.id}
                className={`plan-card ${
                  selectedPlan?.id ===
                  plan.id
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setSelectedPlan(
                    plan
                  )
                }
              >
                <strong>
                  {plan.name}
                </strong>

                <div className="plan-price">
                  ₦
                  {displayPrice(
                    plan.price
                  )}
                </div>

                <small>
                  {
                    plan.description
                  }
                </small>
              </div>
            )
          )}
        </div>
      </section>

      {/* =====================================
          ACTION
      ===================================== */}
      <section className="section form-card">
        <button
          type="button"
          disabled={loading}
          className="primary-btn full-width"
          onClick={
            handleSubmit
          }
        >
          {loading
            ? "Processing..."
            : "Create Product"}
        </button>

        {paymentData && (
          <button
            type="button"
            className="secondary-btn full-width"
            onClick={() =>
              window.open(
                paymentData.authUrl,
                "_blank"
              )
            }
          >
            Complete Payment
          </button>
        )}
      </section>

      {/* =====================================
          FEEDBACK
      ===================================== */}
      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      {success && (
        <div className="form-success">
          {success}
        </div>
      )}
    </>
  );
}