const express = require('express');
const router = express.Router();

router.get('/:code', async (req, res) => {
  const { code } = req.params;

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json([{ Status: 'Error', Message: 'Invalid pincode format' }]);
  }

  try {
    const response = await fetch(`http://api.postalpincode.in/pincode/${code}`);
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Pincode proxy error:', error.message);
    res.status(500).json([{ 
      Status: 'Error', 
      Message: 'Pincode lookup failed' 
    }]);
  }
});

module.exports = router;