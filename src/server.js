require('dotenv').config();
const express = require('express');
const supabase = require('./database');
const errorHandler = require('./middlewares/errorHandler');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());

const authRouter = require('./routes/authRoutes');
const bookingRouter = require('./routes/bookingRoutes');

app.use('/api/auth', authRouter);
app.use('/api/bookings', bookingRouter);

app.get('/', async (req, res) => {
  try {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id')
      .limit(1);

    if (userError || bookingError) throw userError || bookingError;

    res.status(200).json({
      status: 'healthy',
      database: {
        users: users.length > 0 ? 'connected' : 'no_data',
        bookings: bookings.length > 0 ? 'connected' : 'no_data'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});