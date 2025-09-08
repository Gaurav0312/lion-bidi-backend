const express = require("express");
const router = express.Router();
const Contact = require("../models/Contact");

// Save message
router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, msg: "All fields are required" });
    }

    // Save to DB
    const newMessage = new Contact({ name, email, message });
    await newMessage.save();

    res.status(201).json({ success: true, msg: "Message saved to DB", data: newMessage });
  } catch (error) {
    console.error("❌ Error saving message:", error);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

module.exports = router;
