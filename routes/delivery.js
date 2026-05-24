// routes/delivery.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
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

/**
 * GET /api/delivery/pincode/:pincode
 * Proxy endpoint for India Post pincode lookup
 * Avoids browser SSL/CORS issues with third-party APIs
 */
router.get('/pincode/:pincode', async (req, res) => {
  try {
    const { pincode } = req.params;

    // Validate pincode format
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 6-digit pincode',
      });
    }

    console.log(`📮 Looking up pincode: ${pincode}`);

    let data = null;

    // Try primary API first
    try {
      const response = await axios.get(
        `https://api.postalpincode.in/pincode/${pincode}`,
        { timeout: 8000 }
      );
      if (response.data && response.data[0]) {
        data = response.data;
      }
    } catch (primaryError) {
      console.warn('⚠️ Primary pincode API failed:', primaryError.message);
    }

    // Fallback: try India Post API directly
    if (!data) {
      try {
        const response = await axios.get(
          `https://api.data.gov.in/resource/5c2f62fe-5afa-4119-a499-fec9d604d5bd?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&filters%5Bpincode%5D=${pincode}`,
          { timeout: 8000 }
        );
        if (response.data && response.data.records && response.data.records.length > 0) {
          // Transform data.gov.in format to match postalpincode.in format
          const records = response.data.records;
          data = [{
            Message: "Number of pincode(s) found:  " + records.length,
            Status: "Success",
            PostOffice: records.map(r => ({
              Name: r.officename || r.officeName || '',
              Description: null,
              BranchType: r.officeType || r.officetype || '',
              DeliveryStatus: r.Deliverystatus || r.deliverystatus || '',
              Circle: r.circlename || r.circleName || '',
              District: r.Districtname || r.districtname || r.district || '',
              Division: r.divisionname || r.divisionName || '',
              Region: r.regionname || r.regionName || '',
              Block: r.Taluk || r.taluk || '',
              State: r.statename || r.stateName || r.state || '',
              Country: 'India',
              Pincode: pincode
            }))
          }];
        }
      } catch (fallbackError) {
        console.warn('⚠️ Fallback pincode API also failed:', fallbackError.message);
      }
    }

    if (data && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
      console.log(`✅ Pincode ${pincode}: Found ${data[0].PostOffice.length} post offices`);
      return res.status(200).json({
        success: true,
        data: data,
      });
    } else {
      console.log(`❌ Pincode ${pincode}: Not found or invalid`);
      return res.status(200).json({
        success: false,
        message: 'Invalid pincode or no data found',
        data: data || [{ Status: 'Error', Message: 'No records found', PostOffice: null }],
      });
    }
  } catch (error) {
    console.error('❌ Pincode lookup error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to lookup pincode',
      error: error.message,
    });
  }
});

module.exports = router;