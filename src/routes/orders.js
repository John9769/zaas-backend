const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrderStatus,
  getOrdersByEmail
} = require('../controllers/orderController');

// POST create order
router.post('/', createOrder);

// GET order status by ID
router.get('/:id/status', getOrderStatus);

// GET orders by email
router.get('/email/:email', getOrdersByEmail);

module.exports = router;