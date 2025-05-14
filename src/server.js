require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const route = require('./routes/route');
const app = express();
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');
const path = require('path');

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Hello from Server collins');
});

// Route untuk API
app.use('/v1/api', route);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
