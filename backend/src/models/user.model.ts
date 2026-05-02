import { Schema, model, InferSchemaType } from 'mongoose';

export type UserRole = 'admin' | 'delivery_boy';

const userSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true }, // bcrypt hash
  role: { type: String, enum: ['admin', 'delivery_boy'], required: true },
  mobile_number: { type: String, required: false },
}, { timestamps: true });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
