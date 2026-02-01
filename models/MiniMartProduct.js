import mongoose from "mongoose";

const miniMartProductSchema = new mongoose.Schema({
  sellerId: { 
    type: String, 
    required: true, 
    trim: true, 
    description: "Firebase UID of the seller" 
  },
  sellerName: { 
    type: String, 
    trim: true, 
    default: "Unknown Seller" 
  },
  userEmail: { 
    type: String, 
    trim: true, 
    default: "" 
  },
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    trim: true, 
    default: "" 
  },
  images: { 
    type: [String], 
    default: [] 
  },
  category: { 
    type: String, 
    trim: true, 
    default: "Uncategorized" 
  },
  price: { 
    type: Number, 
    required: true, 
    min: 0, 
    default: 0 
  },
  status: { 
    type: String, 
    enum: ["Pending", "Approved", "Rejected", "Flagged"], 
    default: "Approved" // Fully open for now
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

export default mongoose.model("MiniMartProduct", miniMartProductSchema);