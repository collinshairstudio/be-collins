const bookingService = require('../services/bookingService');
const bookingInfoService = require('../services/bookingInfoService');

exports.createBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.createBooking({
      user_id: req.user.id,
      ...req.body
    });
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

exports.getBookingByUser = async (req, res, next) => {
  try {
    const userId = req.params.userId; // atau req.query.userId tergantung bagaimana Anda ingin mengirim parameter
    const result = await bookingService.getBookingByUser(userId);
    
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getUserBookings = async (req, res, next) => {
  try {
    const bookings = await bookingService.getUserBookings(req.user.id);
    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
};

exports.getBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.getBooking(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: booking });
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

exports.getAllServices = async (req, res, next) => {
  try {
    const result = await bookingInfoService.getAllServices();
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getAllCapsters = async (req, res, next) => {
  try {
    const result = await bookingInfoService.getAllCapsters();
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getAvailableSchedules = async (req, res, next) => {
  try {
    const { capster_id, date } = req.query;
    if (!capster_id || !date) {
      return res.status(400).json({
        success: false,
        error: { message: 'Capster ID and date are required', statusCode: 400 }
      });
    }
    
    const result = await bookingInfoService.getAvailableSchedules(capster_id, date);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};