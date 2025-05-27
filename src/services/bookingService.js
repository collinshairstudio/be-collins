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

  // Modified to check availability for multiple time slots
  checkCapsterAvailability: async (capsterId, scheduleSlots) => {
    // Check each time slot for conflicts
    for (const slot of scheduleSlots) {
      const { count, error } = await supabase
        .from('bookings')
        .select('*', { count: 'exact' })
        .eq('capster_id', capsterId)
        .eq('schedule', slot);

      if (error) throw { message: 'Database error', statusCode: 500, details: error };
      
      if (count > 0) {
        throw { 
          message: `Barber already booked at ${moment(slot).format('h:mm A')}`, 
          statusCode: 409,
          details: { capster_id: capsterId, conflicting_schedule: slot }
        };
      }
    }
    
    return true;
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

  // Create multiple bookings for long duration services
  createMultipleBookings: async (bookingDataArray) => {
    const { data, error } = await supabase
      .from('bookings')
      .insert(bookingDataArray)
      .select();

    if (error) throw { message: 'Failed to create bookings', statusCode: 500, details: error };
    if (!data || data.length === 0) throw { message: 'No data returned after insert', statusCode: 500 };
    
    return data;
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

  // Generate time slots based on total duration (existing columns only)
  generateTimeSlots: (startDateTime, totalDuration) => {
    const slots = [];
    const slotDuration = 60; // 1 hour per slot in minutes
    const numberOfSlots = Math.ceil(totalDuration / slotDuration);
    
    let currentTime = moment(startDateTime);
    
    for (let i = 0; i < numberOfSlots; i++) {
      slots.push(currentTime.toISOString());
      currentTime = currentTime.clone().add(1, 'hour');
    }
    
    return slots;
  },

  // Create booking data for multiple slots (using existing columns only)
  createBookingDataArray: (baseBookingData, timeSlots) => {
    return timeSlots.map((slot) => ({
      ...baseBookingData,
      schedule: slot
    }));
  },

  formatBookingResponse: (bookings, barber, branch, services) => {
    const { totalPrice, totalDuration } = bookingHelpers.calculateTotals(services);
    const timeSlots = bookings.map((b, index) => ({
      schedule: b.schedule,
      sequence: index + 1,
      formatted_time: moment(b.schedule).format('h:mm A')
    }));
    
    return {
      success: true,
      data: {
        bookings: bookings,
        time_slots: timeSlots,
        barber: { id: barber.id, name: barber.name, image: barber.image },
        branch: { id: branch.id, name: branch.branch_name },
        services,
        summary: {
          total_services: services.length,
          total_price: totalPrice,
          total_duration: totalDuration,
          total_hours: Math.ceil(totalDuration / 60),
          time_slots_count: timeSlots.length,
          start_time: moment(timeSlots[0].schedule).format('h:mm A'),
          end_time: moment(timeSlots[timeSlots.length - 1].schedule).add(1, 'hour').format('h:mm A')
        }
      }
    };
  }
};

// Main exports
exports.createBooking = async (bookingData) => {
  try {
    console.log('Received booking data:', bookingData);
    
    // Validate input data
    validators.validateRequiredFields(bookingData);
    validators.validateUserId(bookingData.user_id);
    const capsterId = validators.validateCapsterId(bookingData.capster_id);
    const branchId = validators.validateBranchId(bookingData.branch_id);
    const serviceIds = validators.validateServiceIds(bookingData.service_ids);
    const scheduleDateTime = validators.validateDateTime(bookingData.date, bookingData.time);
    
    // Fetch related data
    const branch = await dbOperations.findBranch(branchId);
    const barber = await dbOperations.findCapster(capsterId, branchId);
    const services = await dbOperations.findServices(serviceIds);
    
    // Calculate totals
    const { totalPrice, totalDuration } = bookingHelpers.calculateTotals(services);
    
    console.log(`Total duration: ${totalDuration} minutes`);
    
    // Generate time slots based on duration
    const timeSlots = bookingHelpers.generateTimeSlots(scheduleDateTime, totalDuration);
    
    console.log('Generated time slots:', timeSlots.map(slot => moment(slot).format('YYYY-MM-DD h:mm A')));
    
    // Check availability for all time slots
    await dbOperations.checkCapsterAvailability(capsterId, timeSlots);
    
    // Check user booking limit
    await dbOperations.checkUserBookingLimit(bookingData.user_id);
    
    // Prepare booking data
    const baseBookingData = {
      user_id: bookingData.user_id,
      capster_id: capsterId,
      branch_id: branchId,
      service_id: serviceIds,
      status: 'confirmed',
      total_price: totalPrice,
      total_duration: totalDuration
    };
    
    let createdBookings;
    
    if (timeSlots.length === 1) {
      // Single booking for services under 1 hour
      const singleBookingData = {
        ...baseBookingData,
        schedule: timeSlots[0],
        booking_type: 'single',
        slot_sequence: 1
      };
      
      createdBookings = [await dbOperations.createBooking(singleBookingData)];
    } else {
      // Multiple bookings for services over 1 hour
      const bookingDataArray = bookingHelpers.createBookingDataArray(baseBookingData, timeSlots);
      createdBookings = await dbOperations.createMultipleBookings(bookingDataArray);
    }

    return bookingHelpers.formatBookingResponse(createdBookings, barber, branch, services);

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