// routes/delivery.js
const express = require('express');
const router = express.Router();
const { calculateDeliveryCharges } = require('../utils/deliveryChargeCalculator');

/**
 * POST /api/delivery/calculate
 * Calculate delivery charges for a given pincode and order amount
 */
router.post('/calculate', async (req, res) => {
  try {
    const { pincode, orderAmount } = req.body;

    if (!pincode) {
      return res.status(400).json({
        success: false,
        message: 'Pincode is required',
      });
    }

    // ✅ Pass BOTH pincode and orderAmount
    const deliveryInfo = await calculateDeliveryCharges(pincode, orderAmount || 0);

    return res.status(200).json({
      success: true,
      deliveryInfo,
    });
  } catch (error) {
    console.error('Error in delivery calculation route:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate delivery charges',
      error: error.message,
    });
  }
});

module.exports = router;