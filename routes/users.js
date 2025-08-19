const express = require('express');
const router = express.Router();
const User = require('../models/User'); // adjust path if your model is in a different folder
const authMiddleware = require('../middleware/auth'); // make sure you have JWT middleware

/**
 * PATCH /api/users/:id/update-login
 * Updates the user's lastLogin timestamp
 */
router.patch('/:id/update-login', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { lastLogin: new Date() },
      { new: true } // return updated document
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'Login timestamp updated successfully',
      user,
    });
  } catch (err) {
    console.error('Update login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
