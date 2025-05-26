const supabase = require('../database');
const moment = require('moment-timezone'); // Ganti ke moment-timezone

// 1. Mengambil semua branch
exports.getAllBranches = async () => {
  try {
    const { data, error } = await supabase
      .from('branch')
      .select('id, branch_name')
      .order('branch_name', { ascending: true });

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    console.error('Error getting branches:', error);
    return {
      success: false,
      error: {
        message: 'Failed to fetch branches',
        statusCode: 500,
        details: error.message
      }
    };
  }
};

// 4. Mengambil capster berdasarkan branch ID
exports.getCapstersByBranch = async (branchId) => {
  try {
    if (!branchId) {
      throw new Error('Branch ID is required');
    }

    const { data, error } = await supabase
      .from('capsters')
      .select(`
        id, 
        name, 
        branch_id,
        branch:branch_id (id, branch_name)
      `)
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    console.error('Error getting capsters by branch:', error);
    return {
      success: false,
      error: {
        message: 'Failed to fetch capsters for this branch',
        statusCode: 500,
        details: error.message
      }
    };
  }
};

// 5. Mengambil services berdasarkan branch ID
exports.getServicesByBranch = async (branchId) => {
  try {
    if (!branchId) {
      throw new Error('Branch ID is required');
    }
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    console.error('Error getting services by branch:', error);
    return {
      success: false,
      error: {
        message: 'Failed to fetch services for this branch',
        statusCode: 500,
        details: error.message
      }
    };
  }
};

// 7. Mengambil jadwal yang tersedia untuk booking dengan validasi branch
exports.getAvailableSchedules = async (capsterId, branchId, date) => {
  try {
    if (!capsterId || !branchId || !date) {
      throw new Error('Capster ID, Branch ID, and date are required');
    }

    // Validasi apakah capster ada di branch tersebut
    const { data: capster, error: capsterError } = await supabase
      .from('capsters')
      .select('id, name, branch_id')
      .eq('id', capsterId)
      .eq('branch_id', branchId)
      .single();

    if (capsterError || !capster) {
      throw new Error('Capster not found in this branch');
    }

    const selectedDate = moment.tz(date, 'Asia/Jakarta');
    if (!selectedDate.isValid()) {
      throw new Error('Invalid date format');
    }

    const startOfDay = selectedDate.startOf('day').toISOString();
    const endOfDay = selectedDate.endOf('day').toISOString();

    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('schedule')
      .eq('capster_id', capsterId)
      .eq('branch_id', branchId)
      .gte('schedule', startOfDay)
      .lte('schedule', endOfDay);

    if (bookingError) throw bookingError;

    const allSlots = generateTimeSlots('09:00', '18:00', 60);
    const bookedSlots = bookings.map(b => moment(b.schedule).tz('Asia/Jakarta').format('HH:mm'));

    const now = moment().tz('Asia/Jakarta');
    const availableSlots = allSlots.filter(slot => {
      const isBooked = bookedSlots.includes(slot.time);
      const slotDateTime = moment.tz(`${date} ${slot.time}`, 'YYYY-MM-DD HH:mm', 'Asia/Jakarta');
      const isFutureTime = slotDateTime.isAfter(now);
      return !isBooked && isFutureTime;
    });

    return {
      success: true,
      data: {
        date: date,
        capster_id: capsterId,
        branch_id: branchId,
        capster_name: capster.name,
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

function generateTimeSlots(startTime, endTime, interval) {
  const slots = [];
  let currentTime = moment.tz(startTime, 'HH:mm', 'Asia/Jakarta');
  const end = moment.tz(endTime, 'HH:mm', 'Asia/Jakarta');

  while (currentTime <= end) {
    slots.push({
      time: currentTime.format('HH:mm'),
      display: currentTime.format('h:mm A')
    });
    currentTime.add(interval, 'minutes');
  }

  return slots;
}