// src/models/User.ts
import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getSignedJwtToken(): string;
}

const UserSchema: Schema = new Schema({
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false // Don't include password in queries by default
  },
  name: {
    type: String,
    required: [true, 'Please add a name'],
    maxlength: [50, 'Name can not be more than 50 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function(): string {
  const payload = { id: this._id.toString() };
  const secret = process.env.JWT_SECRET || 'defaultsecret';
  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRE || '30d') as SignOptions['expiresIn'] };
  return jwt.sign(payload, secret, options);
};

// Match user entered password to hashed password in database
UserSchema.methods.comparePassword = async function(enteredPassword: string): Promise<boolean> {
  return bcrypt.compare(enteredPassword, this.password);
};

// Update 'updatedAt' field on save
UserSchema.pre<IUser>('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const User = mongoose.model<IUser>('User', UserSchema);
export default User;
