// models/MarketplaceProduct.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const deliveryRegionSchema = new Schema({
  state: { type: String, required: true, trim: true, lowercase: true },
  city: { type: String, required: true, trim: true, lowercase: true },
  method: { type: String, enum: ['Courier', 'Pickup', 'Drone'], default: 'Courier' },
  from: { type: Number, required: true, min: 0 },
  to: { 
    type: Number, 
    required: true, 
    min: 0,
    validate: {
      validator: function(value) { return value >= this.from; },
      message: 'Delivery "to" must be greater than or equal to "from"'
    }
  },
  chargeFee: { type: Boolean, default: false },
  fee: { 
    type: Number, 
    default: 0, 
    min: 0,
    validate: {
      validator: function(value) { return !this.chargeFee || value > 0; },
      message: 'Fee must be greater than 0 if chargeFee is true'
    }
  },
  expressAvailable: { type: Boolean, default: false },
  warehouseAddress: { type: String, default: "" },
  isFreeDelivery: { type: Boolean, default: false },
});

const MarketplaceProductSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 15, maxlength: 150 },
    description: { type: String, required: true, minlength: 50, maxlength: 5000 },
    category: { type: String, required: true, index: true },
    subcategory: { type: String, default: "" },
    brand: { type: String, default: "" },
    model: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    discount_price: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, default: 1, min: 1 },
    condition: { type: String, enum: ['New', 'Used', 'Refurbished'], default: 'New' },
    used_detail: { type: String, default: "" },
    ram: { type: String, default: "" },
    storage: { type: String, default: "" },
    color: { type: String, default: "" },
    sim: { type: [String], default: [] },
    features: { type: [String], default: [] },
    engine: { type: String, default: "" },
    mileage: { type: String, default: "" },
    year: { type: String, default: "" },
    fuel_type: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid', ''], default: '' },
    transmission: { type: String, enum: ['Manual', 'Automatic', ''], default: '' },
    images: { type: [String], default: [] },
    video_link: { type: String, default: "" },
    deliveryRegions: { type: [deliveryRegionSchema], default: [] },
    promoted: { type: Boolean, default: false },
    promo_plan: { type: String, enum: ['Basic', 'Premium', 'Featured', ''], default: '' },
    flash_sale: { type: Boolean, default: false },
    exchange_possible: { type: Boolean, default: false },
    negotiable: { type: Boolean, default: false },
    phone_number: { 
      type: String, 
      required: true, 
      validate: { validator: v => /^\+?\d{7,15}$/.test(v), message: props => `${props.value} is not a valid phone number!` }
    },
    additional_phone: { 
      type: String, 
      default: "", 
      validate: { validator: v => v === "" || /^\+?\d{7,15}$/.test(v), message: props => `${props.value} is not a valid phone number!` }
    },
    poster_name: { type: String, required: true },
    social_link: { type: String, default: "" },
    status: { type: String, enum: ['active', 'inactive', 'archived'], default: 'active', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    payment_reference: { type: String, default: "" },
    promo_status: { type: String, enum: ['free', 'paid'], default: 'paid' },
    deleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

MarketplaceProductSchema.virtual('formattedPrice').get(function () {
  return this.price != null ? this.price.toLocaleString() : '0';
});
MarketplaceProductSchema.virtual('formattedDiscountPrice').get(function () {
  return this.discount_price != null ? this.discount_price.toLocaleString() : '0';
});

MarketplaceProductSchema.methods.softDelete = function () {
  this.deleted = true;
  this.deletedAt = Date.now();
  return this.save();
};

MarketplaceProductSchema.query.notDeleted = function() {
  return this.where({ deleted: false });
};

MarketplaceProductSchema.pre('save', function(next) {
  if (typeof this.price === 'string') this.price = Number(this.price.replace(/,/g, ''));
  if (typeof this.discount_price === 'string') this.discount_price = Number(this.discount_price.replace(/,/g, ''));
  if (this.discount_price > this.price) this.discount_price = this.price;
  next();
});

MarketplaceProductSchema.index({ category: 1, subcategory: 1 });
MarketplaceProductSchema.index({ price: 1, discount_price: 1 });
MarketplaceProductSchema.index({ promoted: 1, promo_plan: 1 });
MarketplaceProductSchema.index({ title: 'text', description: 'text', brand: 'text', model: 'text' });

export default mongoose.model('MarketplaceProduct', MarketplaceProductSchema);