const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect } = require('../middlewares/auth');

// ===== PUBLIC ROUTES =====
router.get('/branches', bookingController.getAllBranches);
// router.get('/branches/:branchId', bookingController.getBranchById);
// router.get('/branches/:branchId/details', bookingController.getBranchWithDetails);
// router.get('/services', bookingController.getAllServices); // ?branch_id=1 (optional)
router.get('/branches/:branchId/services', bookingController.getServicesByBranch);
// router.get('/capsters', bookingController.getAllCapsters); // ?branch_id=1 (optional)
router.get('/branches/:branchId/capsters', bookingController.getCapstersByBranch);
router.get('/available-schedules', bookingController.getAvailableSchedules); // ?capster_id=1&branch_id=1&date=2024-01-01

// ===== PROTECTED ROUTES =====
router.use(protect);
router.post('/', bookingController.createBooking);
router.get('/', bookingController.getUserBookings);
router.get('/by-user/:userId', bookingController.getBookingByUser); 
router.get('/:id', bookingController.getBooking);
router.put('/:id', bookingController.updateBooking);
router.delete('/:id', bookingController.cancelBooking);

module.exports = router;