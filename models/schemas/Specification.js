import mongoose from "mongoose";

const { Schema } = mongoose;

const SpecificationSchema = new Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
});

export default SpecificationSchema;