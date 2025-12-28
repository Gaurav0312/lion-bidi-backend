// utils/deliveryChargeCalculator.js - MP ₹70, Rest ₹120
const axios = require('axios');

// Delivery charge structure
const DELIVERY_CHARGES = {
  MADHYA_PRADESH: 70,    // For MP
  REST_OF_INDIA: 120,    // For all other states
};
const FREE_DELIVERY_THRESHOLD = 1499;
const STORE_STATE = 'Madhya Pradesh';

// Cache for pincode validation
const pincodeCache = new Map();

/**
 * Get location info from pincode
 */
async function getPincodeLocation(pincode) {
  // Check cache first
  if (pincodeCache.has(pincode)) {
    return pincodeCache.get(pincode);
  }

  try {
    const response = await axios.get(
      `https://api.postalpincode.in/pincode/${pincode}`
    );
    
    if (response.data?.[0]?.Status === 'Success' && response.data[0].PostOffice?.length > 0) {
      const location = response.data[0].PostOffice[0];
      const data = {
        state: location.State || location.Circle,
        district: location.District,
        isValid: true
      };
      
      // Cache the result
      pincodeCache.set(pincode, data);
      return data;
    }
    
    return { isValid: false };
  } catch (error) {
    console.error('Error fetching pincode location:', error.message);
    // If API fails, assume rest of India charges (safer)
    return { 
      isValid: true, 
      state: 'Unknown', 
      district: 'Unknown' 
    };
  }
}

/**
 * Normalize state name for comparison
 */
function normalizeState(state) {
  if (!state) return '';
  
  state = state.toString().trim();
  
  // Handle MP abbreviation
  if (state.toUpperCase() === 'MP') return 'Madhya Pradesh';
  
  // Proper case
  return state.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Calculate delivery charges based on state
 * @param {string} customerPincode - Customer's pincode
 * @param {number} orderAmount - Order total amount
 * @returns {object} Delivery information
 */
async function calculateDeliveryCharges(customerPincode, orderAmount = 0) {
  try {
    // Validate pincode format
    if (!/^\d{6}$/.test(customerPincode)) {
      throw new Error('Invalid pincode format');
    }

    // Check if eligible for free delivery
    const isFreeDeliveryEligible = orderAmount >= FREE_DELIVERY_THRESHOLD;

    // Get location from pincode
    const locationInfo = await getPincodeLocation(customerPincode);
    
    if (!locationInfo.isValid) {
      throw new Error('Invalid pincode');
    }

    // Normalize state names for comparison
    const customerState = normalizeState(locationInfo.state);
    const storeState = normalizeState(STORE_STATE);

    // Determine base charges based on state
    let baseCharges;
    let description;

    if (customerState === storeState) {
      // Madhya Pradesh
      baseCharges = DELIVERY_CHARGES.MADHYA_PRADESH;
      description = `Delivery within ${STORE_STATE}`;
    } else {
      // Rest of India
      baseCharges = DELIVERY_CHARGES.REST_OF_INDIA;
      description = `Delivery to ${customerState || 'your location'}`;
    }

    // Apply free delivery if eligible
    const finalCharges = isFreeDeliveryEligible ? 0 : baseCharges;
    
    if (isFreeDeliveryEligible) {
      description = `Free Delivery (Order above ₹${FREE_DELIVERY_THRESHOLD})`;
    }

    return {
      charges: finalCharges,
      baseCharges: baseCharges,
      distance: null,
      state: locationInfo.state,
      district: locationInfo.district,
      description,
      isFreeDelivery: isFreeDeliveryEligible,
      freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
      isMadhyaPradesh: customerState === storeState,
    };
  } catch (error) {
    console.error('Error calculating delivery charges:', error);
    
    // Fallback to REST_OF_INDIA charges (safer default)
    const isFreeDeliveryEligible = orderAmount >= FREE_DELIVERY_THRESHOLD;
    return {
      charges: isFreeDeliveryEligible ? 0 : DELIVERY_CHARGES.REST_OF_INDIA,
      baseCharges: DELIVERY_CHARGES.REST_OF_INDIA,
      distance: null,
      state: null,
      district: null,
      description: isFreeDeliveryEligible 
        ? `Free Delivery (Order above ₹${FREE_DELIVERY_THRESHOLD})`
        : 'Standard Delivery Charges',
      isFreeDelivery: isFreeDeliveryEligible,
      freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
      isMadhyaPradesh: false,
      error: error.message,
    };
  }
}

module.exports = {
  calculateDeliveryCharges,
  DELIVERY_CHARGES,
  FREE_DELIVERY_THRESHOLD,
  STORE_STATE,
};