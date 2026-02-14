import mongoose from "mongoose";

const { Schema } = mongoose;

const ImageSchema = new Schema({
  url: { type: String, required: true },
  alt: { type: String },
  order: { type: Number, default: 0 },
});

export default ImageSchema;