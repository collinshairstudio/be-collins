const supabase = require('../database');

exports.createBooking = async (bookingData) => {
  try {
    // Validasi 1: Cek apakah capster_id dan schedule ada
    if (!bookingData.capster_id || !bookingData.schedule) {
      throw { 
        message: 'Capster ID and schedule are required',
        statusCode: 400
      };
    }

    // Validasi 2: Cek apakah capster ada
    const { count: capsterExists, error: capsterError } = await supabase
      .from('capsters')
      .select('*', { count: 'exact' })
      .eq('id', bookingData.capster_id);

    if (capsterError) throw { message: 'Database error', statusCode: 500, details: capsterError };
    if (capsterExists === 0) {
      throw { message: 'Capster not found', statusCode: 404 };
    }

    // Validasi 3: Cek duplikat booking
    const { data: duplicateData, count: duplicateCount, error: duplicateError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .eq('capster_id', bookingData.capster_id)
      .eq('schedule', bookingData.schedule);

    if (duplicateError) throw { message: 'Database error', statusCode: 500, details: duplicateError };
    if (duplicateCount > 0) {
      throw { message: 'Capster already booked at this time', statusCode: 409 };
    }

    // Validasi 4: Cek jumlah booking user
    if (!bookingData.userId) {
      throw { message: 'User ID is required', statusCode: 400 };
    }

    const { count: userBookingCount, error: countError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .eq('user_id', bookingData.userId);

    if (countError) throw { message: 'Database error', statusCode: 500, details: countError };
    if (userBookingCount >= 2) {
      throw { 
        message: 'Maximum booking limit reached (2 bookings per user)', 
        statusCode: 429 
      };
    }

    // Buat booking
    const { data, error: insertError } = await supabase
      .from('bookings')
      .insert([{
        user_id: bookingData.userId,
        capster_id: bookingData.capster_id,
        schedule: bookingData.schedule
      }])
      .select();

    if (insertError) throw { message: 'Failed to create booking', statusCode: 500, details: insertError };
    if (!data || data.length === 0) throw { message: 'No data returned after insert', statusCode: 500 };

    return data[0];

  } catch (error) {
    // Log error for debugging
    console.error('Booking error:', error);
    
    // Pastikan error memiliki format yang diharapkan
    const formattedError = {
      message: error.message || 'Unknown error occurred',
      statusCode: error.statusCode || 500
    };
    
    throw formattedError;
  }
};

// Fungsi-fungsi lainnya tetap sama...
exports.getUserBookings = async (userId) => {
  try {
    if (!userId) {
      throw { message: 'User ID is required', statusCode: 400 };
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId);

    if (error) throw { message: 'Failed to get bookings', statusCode: 500, details: error };
    return data || [];
  } catch (error) {
    console.error('Get user bookings error:', error);
    error.statusCode = error.statusCode || 500;
    throw error;
  }
};

exports.getBooking = async (bookingId, userId) => {
  try {
    if (!bookingId || !userId) {
      throw { message: 'Booking ID and User ID are required', statusCode: 400 };
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (error) throw { message: 'Booking not found', statusCode: 404, details: error };
    if (!data) throw { message: 'Booking not found', statusCode: 404 };
    
    return data;
  } catch (error) {
    console.error('Get booking error:', error);
    error.statusCode = error.statusCode || 500;
    throw error;
  }
};

exports.updateBooking = async (bookingId, userId, updateData) => {
  try {
    if (!bookingId || !userId) {
      throw { message: 'Booking ID and User ID are required', statusCode: 400 };
    }

    // Cek booking yang akan diupdate apakah ada
    const { data: existingBooking, error: checkError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (checkError) throw { message: 'Failed to check booking', statusCode: 500, details: checkError };
    if (!existingBooking) throw { message: 'Booking not found', statusCode: 404 };

    // Cek konflik jika mengubah capster atau schedule
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
    
    return data[0];
  } catch (error) {
    console.error('Update booking error:', error);
    error.statusCode = error.statusCode || 500;
    throw error;
  }
};

exports.cancelBooking = async (bookingId, userId) => {
  try {
    if (!bookingId || !userId) {
      throw { message: 'Booking ID and User ID are required', statusCode: 400 };
    }

    // Cek apakah booking yang akan dihapus ada
    const { data: existingBooking, error: checkError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (checkError) throw { message: 'Failed to check booking', statusCode: 500, details: checkError };
    if (!existingBooking) throw { message: 'Booking not found', statusCode: 404 };

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)
      .eq('user_id', userId);

    if (error) throw { message: 'Failed to cancel booking', statusCode: 500, details: error };
    
    return { message: 'Booking cancelled successfully' };
  } catch (error) {
    console.error('Cancel booking error:', error);
    error.statusCode = error.statusCode || 500;
    throw error;
  }
};