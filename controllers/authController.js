import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { sendEmail } from '../utils/sendEmail.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
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

    console.log(`[REGISTER] Generated Token for ${email}:`, verificationToken);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      verificationToken,
      verificationTokenExpires
    });

    const savedUser = await newUser.save();

    const verifyUrl = `http://localhost:5173/verify/${verificationToken}`;
    
    const message = `Welcome to CoDev! Please verify your email by clicking the link below:\n\n${verifyUrl}\n\nThis link will expire in 24 hours.`;
    const html = `
      <h2>Welcome to CoDev!</h2>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${verifyUrl}" target="_blank">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
    `;

    try {
      await sendEmail({
        email: savedUser.email,
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email to log in' });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, cookieOptions);

    res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        theme: user.theme
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
    const { token } = req.params;
    console.log(`[VERIFY] Received Token:`, token);

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log(`[VERIFY] Failed: No user found for token or token expired.`);
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    console.log(`[VERIFY] Success for user:`, user.email);

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
