const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect } = require('../middlewares/auth');

// Public routes
router.get('/services', bookingController.getAllServices);
router.get('/capsters', bookingController.getAllCapsters);
router.get('/available-schedules', bookingController.getAvailableSchedules);

// Protected routes
router.use(protect);
router.post('/', bookingController.createBooking);
router.get('/', bookingController.getUserBookings);
router.get('/by-user/:userId', bookingController.getBookingByUser); 
router.get('/:id', bookingController.getBooking);
router.put('/:id', bookingController.updateBooking);
router.delete('/:id', bookingController.cancelBooking);

module.exports = router;