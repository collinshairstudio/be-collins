const supabase = require('../database');
const moment = require('moment');

exports.createBooking = async (bookingData) => {
  try {
    console.log('Received booking data:', bookingData);

    // Validasi field yang diperlukan
    if (!bookingData.capster_id || !bookingData.service_id || !bookingData.date || !bookingData.time) {
      throw { 
        message: 'All fields are required (capster_id, service_id, date, time)',
        statusCode: 400
      };
    }

    // Konversi ke integer
    const capsterId = parseInt(bookingData.capster_id, 10);
    const serviceId = parseInt(bookingData.service_id, 10);
    
    if (isNaN(capsterId)) {
      throw { message: 'capster_id must be a valid integer', statusCode: 400 };
    }

    if (isNaN(serviceId)) {
      throw { message: 'service_id must be a valid integer', statusCode: 400 };
    }

    // Validasi UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingData.user_id)) {
      throw { message: 'user_id must be a valid UUID', statusCode: 400 };
    }

    const scheduleDateTime = moment(`${bookingData.date} ${bookingData.time}`, 'YYYY-MM-DD h:mm A').toISOString();
    
    // Cek capster
    const { data: barber, error: barberError } = await supabase
      .from('capsters')
      .select('*')
      .eq('id', capsterId)
      .single();

    if (barberError) throw { message: 'Database error', statusCode: 500, details: barberError };
    if (!barber) throw { message: 'Barber not found', statusCode: 404 };

    // Cek service (tanpa duration)
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, name') // Hanya ambil field yang diperlukan
      .eq('id', serviceId)
      .single();

    if (serviceError) throw { message: 'Database error', statusCode: 500, details: serviceError };
    if (!service) throw { message: 'Service not found', statusCode: 404 };

    // Cek duplikat booking
    const { count: duplicateCount, error: duplicateError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .eq('capster_id', capsterId)
      .eq('schedule', scheduleDateTime);

    if (duplicateError) throw { message: 'Database error', statusCode: 500, details: duplicateError };
    if (duplicateCount > 0) {
      throw { 
        message: 'Barber already booked at this time', 
        statusCode: 409,
        details: { capster_id: capsterId, schedule: scheduleDateTime }
      };
    }

    // Validasi waktu booking
    if (moment(scheduleDateTime).isBefore(moment())) {
      throw { message: 'Cannot book in the past', statusCode: 400 };
    }

    // Cek limit booking user
    const { count: userBookingCount, error: countError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .eq('user_id', bookingData.user_id)
      .gte('schedule', moment().startOf('day').toISOString());

    if (countError) throw { message: 'Database error', statusCode: 500, details: countError };
    if (userBookingCount >= 2) {
      throw { message: 'Maximum booking limit reached (2 active bookings per user)', statusCode: 429 };
    }

    // Buat booking (tanpa duration dan price)
    const { data, error: insertError } = await supabase
      .from('bookings')
      .insert([{
        user_id: bookingData.user_id,
        capster_id: capsterId,
        service_id: serviceId,
        schedule: scheduleDateTime,
        status: 'confirmed'
      }])
      .select();

    if (insertError) throw { message: 'Failed to create booking', statusCode: 500, details: insertError };
    if (!data || data.length === 0) throw { message: 'No data returned after insert', statusCode: 500 };

    return {
      success: true,
      data: {
        booking: data[0],
        barber: { id: barber.id, name: barber.name, image: barber.image },
        service: { id: service.id, name: service.name } // Tanpa duration
      }
    };

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
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        schedule,
        status,
        barber:capster_id (id, name),
        service:service_id (id, name, price, duration)
      `)
      .eq('user_id', userId)
      .order('schedule', { ascending: true })

    if (error) {
      throw {
        message: 'Failed to get bookings',
        statusCode: 500,
        details: error
      }
    }

    return {
      success: true,
      data: data || []
    }
  } catch (error) {
    console.error('Service error:', error)
    return {
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        statusCode: error.statusCode || 500,
        details: error.details || null
      }
    }
  }
}

// Fungsi-fungsi lainnya tetap sama...
exports.getUserBookings = async (userId) => {
  try {
    if (!userId) {
      throw { message: 'User ID is required', statusCode: 400 };
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        barbers:capster_id (id, name),
        services:service_id (id, name, duration, price)
      `)
      .eq('user_id', userId)
      .order('schedule', { ascending: true });

    if (error) throw { message: 'Failed to get bookings', statusCode: 500, details: error };
    
    return {
      success: true,
      data: data || []
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

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        barbers:capster_id (id, name),
        services:service_id (id, name, duration, price)
      `)
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (error) throw { message: 'Booking not found', statusCode: 404, details: error };
    if (!data) throw { message: 'Booking not found', statusCode: 404 };
    
    return {
      success: true,
      data: data
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

exports.updateBooking = async (bookingId, userId, updateData) => {
  try {
    if (!bookingId || !userId) {
      throw { message: 'Booking ID and User ID are required', statusCode: 400 };
    }

    // Cek booking yang akan diupdate
    const { data: existingBooking, error: checkError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (checkError) throw { message: 'Failed to check booking', statusCode: 500, details: checkError };
    if (!existingBooking) throw { message: 'Booking not found', statusCode: 404 };

    // Jika mengupdate waktu atau barber, cek konflik
    if (updateData.capster_id || updateData.schedule) {
      const capster_id = updateData.capster_id || existingBooking.capster_id;
      const schedule = updateData.schedule || existingBooking.schedule;

      const { count, error: conflictError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact' })
        .eq('capster_id', capster_id)
        .eq('schedule', schedule)
        .neq('id', bookingId);

      if (conflictError) throw { message: 'Database error', statusCode: 500, details: conflictError };
      if (count > 0) {
        throw { 
          message: 'New schedule conflicts with existing booking', 
          statusCode: 409 
        };
      }
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)
      .eq('user_id', userId)
      .select();

    if (error) throw { message: 'Failed to update booking', statusCode: 500, details: error };
    if (!data || data.length === 0) throw { message: 'Booking not found', statusCode: 404 };
    
    return {
      success: true,
      data: data[0]
    };
  } catch (error) {
    console.error('Update booking error:', error);
    
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

exports.cancelBooking = async (bookingId, userId) => {
  try {
    if (!bookingId || !userId) {
      throw { message: 'Booking ID and User ID are required', statusCode: 400 };
    }

    // Cek booking yang akan dihapus
    const { data: existingBooking, error: checkError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (checkError) throw { message: 'Failed to check booking', statusCode: 500, details: checkError };
    if (!existingBooking) throw { message: 'Booking not found', statusCode: 404 };

    // Update status menjadi cancelled alih-alih delete
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .eq('user_id', userId)
      .select();

    if (error) throw { message: 'Failed to cancel booking', statusCode: 500, details: error };
    
    return {
      success: true,
      data: {
        message: 'Booking cancelled successfully',
        booking: data[0]
      }
    };
  } catch (error) {
    console.error('Cancel booking error:', error);
    
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