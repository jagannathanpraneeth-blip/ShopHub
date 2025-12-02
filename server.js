const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const stripe = require('stripe');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');

dotenv.config();

const app = express();

app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shophub')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: String,
  stock: { type: Number, default: 0 },
  image: String,
  rating: { type: Number, default: 0 },
  reviews: [{ userId: String, comment: String, rating: Number }],
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
  userId: String,
  items: [{ productId: String, quantity: Number, price: Number }],
  total: Number,
  status: { type: String, default: 'pending' },
  stripePaymentId: String,
  shippingAddress: Object,
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: String,
  name: String,
  cart: [{ productId: String, quantity: Number }],
  orders: [String],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Product Routes
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().limit(50);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    res.json(product || { error: 'Product not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Order Routes
app.post('/api/checkout', async (req, res) => {
  try {
    const { items, email, amount } = req.body;
    
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata: { email }
    });

    const order = new Order({
      userId: email,
      items,
      total: amount,
      stripePaymentId: paymentIntent.id,
      status: 'processing'
    });

    await order.save();
    res.json({ clientSecret: paymentIntent.client_secret, orderId: order._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({ email, password: hashedPassword, name });
    await user.save();
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, email, name } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cart Routes
app.post('/api/cart/:userId', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const user = await User.findById(req.params.userId);
    
    const cartItem = user.cart.find(item => item.productId === productId);
    if (cartItem) {
      cartItem.quantity += quantity;
    } else {
      user.cart.push({ productId, quantity });
    }
    
    await user.save();
    res.json(user.cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cart/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.json(user.cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ShopHub server running on port ${PORT}`);
});

module.exports = app;
