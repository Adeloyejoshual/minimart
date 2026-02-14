// models/schemas/Image.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ImageSchema = new Schema({
  url: { type: String, required: true },
  alt: { type: String, default: "" },
});

export default ImageSchema;