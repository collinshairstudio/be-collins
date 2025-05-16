const supabase = require('../database');
const moment = require('moment');

// 1. Mengambil semua layanan/service
exports.getAllServices = async () => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    console.error('Error getting services:', error);
    return {
      success: false,
      error: {
        message: 'Failed to fetch services',
        statusCode: 500,
        details: error.message
      }
    };
  }
};

// 2. Mengambil semua capster/barber
exports.getAllCapsters = async () => {
  try {
    const { data, error } = await supabase
      .from('capsters')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    console.error('Error getting capsters:', error);
    return {
      success: false,
      error: {
        message: 'Failed to fetch capsters',
        statusCode: 500,
        details: error.message
      }
    };
  }
};

// 3. Mengambil jadwal yang tersedia untuk booking
exports.getAvailableSchedules = async (capsterId, date) => {
  try {
    if (!capsterId || !date) {
      throw new Error('Capster ID and date are required');
    }

    const selectedDate = moment(date);
    if (!selectedDate.isValid()) {
      throw new Error('Invalid date format');
    }

    const startOfDay = selectedDate.startOf('day').toISOString();
    const endOfDay = selectedDate.endOf('day').toISOString();

    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('schedule')
      .eq('capster_id', capsterId)
      .gte('schedule', startOfDay)
      .lte('schedule', endOfDay);

    if (bookingError) throw bookingError;
    const allSlots = generateTimeSlots('09:00', '18:00', 60);
    const bookedSlots = bookings.map(b => moment(b.schedule).format('HH:mm'));

    const now = moment();
    const availableSlots = allSlots.filter(slot => {
      const isBooked = bookedSlots.includes(slot.time);
      const slotDateTime = moment(`${date} ${slot.time}`, 'YYYY-MM-DD HH:mm');
      const isFutureTime = slotDateTime.isAfter(now);
      return !isBooked && isFutureTime;
    });

    return {
      success: true,
      data: {
        date: date,
        capster_id: capsterId,
        available_slots: availableSlots
      }
    };

  } catch (error) {
    console.error('Error getting available schedules:', error);
    return {
      success: false,
      error: {
        message: error.message || 'Failed to fetch available schedules',
        statusCode: 500,
        details: error.details || error
      }
    };
  }
};

// Helper function
function generateTimeSlots(startTime, endTime, interval) {
  const slots = [];
  let currentTime = moment(startTime, 'HH:mm');
  const end = moment(endTime, 'HH:mm');

  while (currentTime <= end) {
    slots.push({
      time: currentTime.format('HH:mm'),
      display: currentTime.format('h:mm A')
    });
    currentTime.add(interval, 'minutes');
  }

  return slots;
}