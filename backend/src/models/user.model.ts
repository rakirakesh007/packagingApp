import { Schema, model, InferSchemaType } from 'mongoose';

export type UserRole = 'admin' | 'delivery_boy';

const userSchema = new Schema({
  username:      { type: String, required: true, unique: true, trim: true },
  password:      { type: String, required: true }, // bcrypt hash
  role:          { type: String, enum: ['admin', 'delivery_boy'], required: true },
  name:          { type: String, trim: true, default: '' },
  mobile_number: { type: String, trim: true, default: '' },
  isActive:      { type: Boolean, default: true, index: true },
}, { timestamps: true });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
