const supabase = require('../database');
const moment = require('moment');

const validators = {
  validateRequiredFields: (bookingData) => {
    const required = ['capster_id', 'service_ids', 'date', 'time', 'branch_id'];
    const missing = required.filter(field => !bookingData[field]);
    
    if (missing.length > 0) {
      throw { 
        message: `Required fields missing: ${missing.join(', ')}`,
        statusCode: 400
      };
    }
  },

  validateCapsterId: (capsterId) => {
    const id = parseInt(capsterId, 10);
    if (isNaN(id)) {
      throw { message: 'capster_id must be a valid integer', statusCode: 400 };
    }
    return id;
  },

  validateBranchId: (branchId) => {
    const id = parseInt(branchId, 10);
    if (isNaN(id)) {
      throw { message: 'branch_id must be a valid integer', statusCode: 400 };
    }
    return id;
  },

  validateServiceIds: (serviceIds) => {
    let validIds;
    
    if (typeof serviceIds === 'string') {
      try {
        validIds = JSON.parse(serviceIds);
      } catch (e) {
        throw { message: 'service_ids must be a valid JSON array', statusCode: 400 };
      }
    } else if (Array.isArray(serviceIds)) {
      validIds = serviceIds;
    } else {
      throw { message: 'service_ids must be an array', statusCode: 400 };
    }

    if (!Array.isArray(validIds) || validIds.length === 0) {
      throw { message: 'service_ids must be a non-empty array', statusCode: 400 };
    }

    return validIds.map(id => {
      const intId = parseInt(id, 10);
      if (isNaN(intId)) {
        throw { message: 'All service_ids must be valid integers', statusCode: 400 };
      }
      return intId;
    });
  },

  validateUserId: (userId) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw { message: 'user_id must be a valid UUID', statusCode: 400 };
    }
  },

  validateDateTime: (date, time) => {
    const scheduleDateTime = moment(`${date} ${time}`, 'YYYY-MM-DD h:mm A');
    
    if (!scheduleDateTime.isValid()) {
      throw { message: 'Invalid date or time format', statusCode: 400 };
    }

    if (scheduleDateTime.isBefore(moment())) {
      throw { message: 'Cannot book in the past', statusCode: 400 };
    }

    return scheduleDateTime.toISOString();
  }
};

const dbOperations = {
  findBranch: async (branchId) => {
    const { data, error } = await supabase
      .from('branch')
      .select('id, branch_name')
      .eq('id', branchId)
      .single();

    if (error) throw { message: 'Database error', statusCode: 500, details: error };
    if (!data) throw { message: 'Branch not found', statusCode: 404 };
    
    return data;
  },

  findCapster: async (capsterId, branchId) => {
    const { data, error } = await supabase
      .from('capsters')
      .select('id, name, image, branch_id')
      .eq('id', capsterId)
      .eq('branch_id', branchId)
      .single();

    if (error) throw { message: 'Database error', statusCode: 500, details: error };
    if (!data) throw { message: 'Barber not found in this branch', statusCode: 404 };
    
    return data;
  },

  findServices: async (serviceIds) => {
    const { data, error } = await supabase
      .from('services')
      .select('id, name, price, duration')
      .in('id', serviceIds);

    if (error) throw { message: 'Database error', statusCode: 500, details: error };
    
    if (!data || data.length !== serviceIds.length) {
      const foundIds = data ? data.map(s => s.id) : [];
      const missingIds = serviceIds.filter(id => !foundIds.includes(id));
      throw { 
        message: `Services not found: ${missingIds.join(', ')}`, 
        statusCode: 404 
      };
    }
    
    return data;
  },

  checkCapsterAvailability: async (capsterId, scheduleDateTime) => {
    const { count, error } = await supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .eq('capster_id', capsterId)
      .eq('schedule', scheduleDateTime);

    if (error) throw { message: 'Database error', statusCode: 500, details: error };
    
    return count === 0;
  },

  checkUserBookingLimit: async (userId) => {
    const { count, error } = await supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .gte('schedule', moment().startOf('day').toISOString());

    if (error) throw { message: 'Database error', statusCode: 500, details: error };
    
    if (count >= 2) {
      throw { message: 'Maximum booking limit reached (2 active bookings per user)', statusCode: 429 };
    }
  },

  createBooking: async (bookingData) => {
    const { data, error } = await supabase
      .from('bookings')
      .insert([bookingData])
      .select();

    if (error) throw { message: 'Failed to create booking', statusCode: 500, details: error };
    if (!data || data.length === 0) throw { message: 'No data returned after insert', statusCode: 500 };
    
    return data[0];
  },

  getBookingsWithServices: async (query) => {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        barbers:capster_id (id, name, image),
        branch:branch_id (id, branch_name)
      `)
      .match(query)
      .order('schedule', { ascending: true });

    if (error) throw { message: 'Failed to get bookings', statusCode: 500, details: error };
    
    return await Promise.all(
      (data || []).map(async (booking) => {
        const serviceIds = booking.service_id || [];
        booking.services = await dbOperations.getServicesForBooking(serviceIds);
        return booking;
      })
    );
  },

  getServicesForBooking: async (serviceIds) => {
    if (serviceIds.length === 0) return [];
    
    const { data, error } = await supabase
      .from('services')
      .select('id, name, price, duration')
      .in('id', serviceIds);

    if (error) {
      console.error('Error fetching services:', error);
      return [];
    }
    
    return data || [];
  }
};

const bookingHelpers = {
  calculateTotals: (services) => {
    return {
      totalPrice: services.reduce((sum, service) => sum + (service.price || 0), 0),
      totalDuration: services.reduce((sum, service) => sum + (service.duration || 0), 0)
    };
  },

  formatBookingResponse: (booking, barber, branch, services) => {
    const { totalPrice, totalDuration } = bookingHelpers.calculateTotals(services);
    
    return {
      success: true,
      data: {
        booking,
        barber: { id: barber.id, name: barber.name, image: barber.image },
        branch: { id: branch.id, name: branch.branch_name },
        services,
        summary: {
          total_services: services.length,
          total_price: totalPrice,
          total_duration: totalDuration
        }
      }
    };
  }
};

// Main exports
exports.createBooking = async (bookingData) => {
  try {
    console.log('Received booking data:', bookingData);
    validators.validateRequiredFields(bookingData);
    validators.validateUserId(bookingData.user_id);
    const capsterId = validators.validateCapsterId(bookingData.capster_id);
    const branchId = validators.validateBranchId(bookingData.branch_id);
    const serviceIds = validators.validateServiceIds(bookingData.service_ids);
    const scheduleDateTime = validators.validateDateTime(bookingData.date, bookingData.time);
    const branch = await dbOperations.findBranch(branchId);
    const barber = await dbOperations.findCapster(capsterId, branchId);
    const services = await dbOperations.findServices(serviceIds);
    const isAvailable = await dbOperations.checkCapsterAvailability(capsterId, scheduleDateTime);
    if (!isAvailable) {
      throw { 
        message: 'Barber already booked at this time', 
        statusCode: 409,
        details: { capster_id: capsterId, schedule: scheduleDateTime }
      };
    }
    await dbOperations.checkUserBookingLimit(bookingData.user_id);
    const { totalPrice, totalDuration } = bookingHelpers.calculateTotals(services);
    const booking = await dbOperations.createBooking({
      user_id: bookingData.user_id,
      capster_id: capsterId,
      branch_id: branchId,
      service_id: serviceIds,
      schedule: scheduleDateTime,
      status: 'confirmed',
      total_price: totalPrice,
      total_duration: totalDuration
    });

    return bookingHelpers.formatBookingResponse(booking, barber, branch, services);

  } catch (error) {
    console.error('Booking error:', error);
    throw {
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        statusCode: error.statusCode || 500,
        details: error.details || null
      }
    };
  }
};

exports.getBookingByUser = async (userId) => {
  try {
    const bookings = await dbOperations.getBookingsWithServices({ user_id: userId });
    
    return {
      success: true,
      data: bookings
    };
  } catch (error) {
    console.error('Service error:', error);
    return {
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        statusCode: error.statusCode || 500,
        details: error.details || null
      }
    };
  }
};

exports.getUserBookings = async (userId) => {
  try {
    if (!userId) {
      throw { message: 'User ID is required', statusCode: 400 };
    }

    const bookings = await dbOperations.getBookingsWithServices({ user_id: userId });
    
    return {
      success: true,
      data: bookings
    };
  } catch (error) {
    console.error('Get user bookings error:', error);
    
    return {
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        statusCode: error.statusCode || 500,
        details: error.details || null
      }
    };
  }
};

exports.getBooking = async (bookingId, userId) => {
  try {
    if (!bookingId || !userId) {
      throw { message: 'Booking ID and User ID are required', statusCode: 400 };
    }

    const bookings = await dbOperations.getBookingsWithServices({ 
      id: bookingId, 
      user_id: userId 
    });
    
    if (bookings.length === 0) {
      throw { message: 'Booking not found', statusCode: 404 };
    }
    
    return {
      success: true,
      data: bookings[0]
    };
  } catch (error) {
    console.error('Get booking error:', error);
    
    return {
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        statusCode: error.statusCode || 500,
        details: error.details || null
      }
    };
  }
};