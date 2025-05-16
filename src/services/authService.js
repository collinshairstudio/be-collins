const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../database');

exports.register = async (userData) => {
  if (userData.password !== userData.passwordConfirm) {
    throw new Error('Passwords do not match');
  }

  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert([{
      username: userData.username,
      email: userData.email,
      phone: userData.phone,
      password: hashedPassword,
      role_id: 3
    }])
    .select();

  if (error) throw error;
  return data[0];
};

exports.login = async (email, password) => {
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email);

  if (error || !users.length) throw new Error('Invalid credentials');

  const user = users[0];

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Invalid credentials');

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });

  return { user, token };
};