import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useStripe, useElements } from '@stripe/react-stripe-js';
import './App.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/products');
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      setError('Failed to load products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    const cartItem = cart.find(item => item.id === product._id);
    if (cartItem) {
      cartItem.quantity += 1;
      setCart([...cart]);
    } else {
      setCart([...cart, { ...product, id: product._id, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2);
  };

  return (
    <div className="App">
      <header className="header">
        <h1>🛑 ShopHub E-Commerce</h1>
        <div className="cart-info">
          <span>Cart Items: {cart.length}</span>
          <span>Total: ${getTotalPrice()}</span>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <main className="main">
        {loading ? (
          <div className="loading">Loading products...</div>
        ) : (
          <div className="products-grid">
            {products.map(product => (
              <div key={product._id} className="product-card">
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="price">${product.price}</div>
                <div className="stock">Stock: {product.stock}</div>
                <button onClick={() => addToCart(product)}>Add to Cart</button>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <div className="cart-section">
            <h2>Shopping Cart</h2>
            {cart.map(item => (
              <div key={item.id} className="cart-item">
                <span>{item.name} x {item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
                <button onClick={() => removeFromCart(item.id)}>Remove</button>
              </div>
            ))}
            <div className="total">Total: ${getTotalPrice()}</div>
            <CheckoutForm total={getTotalPrice()} items={cart} />
          </div>
        )}
      </main>
    </div>
  );
}

function CheckoutForm({ total, items }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handlePayment = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, email: 'customer@example.com', amount: parseFloat(total) })
      });
      const { clientSecret } = await response.json();

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: { name: 'Customer' }
        }
      });

      if (result.paymentIntent.status === 'succeeded') {
        alert('Payment successful!');
      }
    } catch (err) {
      alert('Payment failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handlePayment} className="checkout-form">
      <CardElement />
      <button type="submit" disabled={loading}>
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}

export default function AppWithStripe() {
  return (
    <Elements stripe={stripePromise}>
      <App />
    </Elements>
  );
}
