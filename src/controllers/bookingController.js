const bookingService = require('../services/bookingService');
const bookingInfoService = require('../services/bookingInfoService');

// ===== BOOKING OPERATIONS =====
exports.createBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.createBooking({
      user_id: req.user.id,
      ...req.body
    });
    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
};

exports.getBookingByUser = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const result = await bookingService.getBookingByUser(userId);
    
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getUserBookings = async (req, res, next) => {
  try {
    const result = await bookingService.getUserBookings(req.user.id);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getBooking = async (req, res, next) => {
  try {
    const result = await bookingService.getBooking(req.params.id, req.user.id);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};

exports.updateBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.updateBooking(
      req.params.id,
      req.user.id,
      req.body
    );
    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

exports.cancelBooking = async (req, res, next) => {
  try {
    await bookingService.cancelBooking(req.params.id, req.user.id);
    res.status(204).json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
};

// ===== BRANCH OPERATIONS =====
exports.getAllBranches = async (req, res, next) => {
  try {
    const result = await bookingInfoService.getAllBranches();
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getBranchById = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const result = await bookingInfoService.getBranchById(branchId);
    
    const statusCode = result.success ? 200 : (result.error?.statusCode || 500);
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getBranchWithDetails = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const result = await bookingInfoService.getBranchWithDetails(branchId);
    
    const statusCode = result.success ? 200 : (result.error?.statusCode || 500);
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
};

// ===== SERVICE OPERATIONS =====
exports.getAllServices = async (req, res, next) => {
  try {
    const { branch_id } = req.query;
    const result = await bookingInfoService.getAllServices(branch_id);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getServicesByBranch = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const result = await bookingInfoService.getServicesByBranch(branchId);
    
    const statusCode = result.success ? 200 : (result.error?.statusCode || 500);
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
};

// ===== CAPSTER OPERATIONS =====
exports.getAllCapsters = async (req, res, next) => {
  try {
    const { branch_id } = req.query;
    const result = await bookingInfoService.getAllCapsters(branch_id);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getCapstersByBranch = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const result = await bookingInfoService.getCapstersByBranch(branchId);
    
    const statusCode = result.success ? 200 : (result.error?.statusCode || 500);
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
};

// ===== SCHEDULE OPERATIONS =====
exports.getAvailableSchedules = async (req, res, next) => {
  try {
    const { capster_id, branch_id, date } = req.query;
    
    // Validation
    if (!capster_id || !branch_id || !date) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Capster ID, Branch ID, and date are required', 
          statusCode: 400 
        }
      });
    }
    
    const result = await bookingInfoService.getAvailableSchedules(capster_id, branch_id, date);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};