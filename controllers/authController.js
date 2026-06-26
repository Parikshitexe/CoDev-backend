import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { sendEmail } from '../utils/sendEmail.js';

const cookieOptions = {
  httpOnly: true,
  secure: false, // Must be false because the Lightsail IP does not have HTTPS/SSL
  // 'lax' is required when using a reverse proxy (Nginx) — 'strict' can cause
  // the browser to drop the cookie on redirects in that setup.
  sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body ?? {};

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password?.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const emailExists = await User.findOne({ email: email?.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours



    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      verificationToken,
      verificationTokenExpires
    });

    const savedUser = await newUser.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyUrl = `${frontendUrl}/verify/${verificationToken}`;
    
    const message = `Welcome to CoDev! Please verify your email by clicking the link below:\n\n${verifyUrl}\n\nThis link will expire in 24 hours.`;
    const html = `
      <h2>Welcome to CoDev!</h2>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${verifyUrl}" target="_blank">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
    `;

    try {
      await sendEmail({
        email: savedUser?.email,
        subject: 'CoDev - Verify Your Email',
        message,
        html
      });

      res.status(201).json({
        message: 'Registration successful! Please check your email to verify your account.'
      });
    } catch (err) {
      console.error('Email sending failed:', err);
      // Optional: Delete the user or let them try to resend later. We keep them and they can request another email.
      res.status(500).json({ error: 'Registered successfully but failed to send verification email. Please contact support.' });
    }
  } catch (err) {
    console.error('Registration failed:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user?.password ?? '');
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (!user?.isVerified) {
      return res.status(403).json({ error: 'Please verify your email to log in' });
    }

    const token = jwt.sign(
      { id: user?._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, cookieOptions);

    res.status(200).json({
      user: {
        id: user?._id,
        username: user?.username,
        email: user?.email,
        theme: user?.theme
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

export const logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params ?? {};


    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;

    await user.save();

    res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error('Email verification failed:', err);
    res.status(500).json({ error: 'Email verification failed. Please try again.' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists or not for security, just say email sent
      return res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    const message = `You requested a password reset. Please go to this link to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`;
    const html = `
      <h2>Password Reset</h2>
      <p>You requested a password reset. Please click the link below to set a new password:</p>
      <a href="${resetUrl}" target="_blank">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'CoDev - Password Reset',
        message,
        html
      });
      res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
    } catch (err) {
      console.error('Failed to send reset email:', err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({ error: 'Error sending email. Please try again later.' });
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params ?? {};
    const { password } = req.body ?? {};

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
};
