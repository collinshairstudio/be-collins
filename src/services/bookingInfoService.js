const supabase = require('../database');
const moment = require('moment');

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

// 2. Mengambil semua layanan/service (global atau berdasarkan branch jika ada relasi)
// exports.getAllServices = async (branchId = null) => {
//   try {
//     let query = supabase
//       .from('services')
//       .select('*')
//       .order('name', { ascending: true });

//     // Jika ada branch_id di tabel services, uncomment line ini
//     // if (branchId) {
//     //   query = query.eq('branch_id', branchId);
//     // }

//     const { data, error } = await query;

//     if (error) throw error;

//     return {
//       success: true,
//       data: data || []
//     };
//   } catch (error) {
//     console.error('Error getting services:', error);
//     return {
//       success: false,
//       error: {
//         message: 'Failed to fetch services',
//         statusCode: 500,
//         details: error.message
//       }
//     };
//   }
// };

// 3. Mengambil semua capster/barber berdasarkan branch
// exports.getAllCapsters = async (branchId = null) => {
//   try {
//     let query = supabase
//       .from('capsters')
//       .select(`
//         id, 
//         name, 
//         branch_id,
//         branch:branch_id (id, branch_name)
//       `)
//       .order('name', { ascending: true });

//     if (branchId) {
//       query = query.eq('branch_id', branchId);
//     }

//     const { data, error } = await query;

//     if (error) throw error;

//     return {
//       success: true,
//       data: data || []
//     };
//   } catch (error) {
//     console.error('Error getting capsters:', error);
//     return {
//       success: false,
//       error: {
//         message: 'Failed to fetch capsters',
//         statusCode: 500,
//         details: error.message
//       }
//     };
//   }
// };

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

// 5. Mengambil services berdasarkan branch ID (jika ada relasi)
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
      .eq('branch_id', branchId)
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

// 8. Mengambil data lengkap branch dengan capsters dan services
exports.getBranchWithDetails = async (branchId) => {
  try {
    if (!branchId) {
      throw new Error('Branch ID is required');
    }

    const branchResult = await exports.getBranchById(branchId);
    if (!branchResult.success) {
      throw new Error(branchResult.error.message);
    }
    const capstersResult = await exports.getCapstersByBranch(branchId);
    const servicesResult = await exports.getServicesByBranch(branchId);
    return {
      success: true,
      data: {
        branch: branchResult.data,
        capsters: capstersResult.success ? capstersResult.data : [],
        services: servicesResult.success ? servicesResult.data : []
      }
    };

  } catch (error) {
    console.error('Error getting branch with details:', error);
    return {
      success: false,
      error: {
        message: error.message || 'Failed to fetch branch details',
        statusCode: 500,
        details: error.details || error
      }
    };
  }
};

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