import React, { useState, useEffect } from 'react';
import { Clock, Zap, ShieldAlert, CheckCircle2, XCircle, Package } from 'lucide-react';

const API_USER = 2; // Hardcoced customer user ID for demo (1 = Admin, 2 = Customer)

// Utility for countdown
function useCountdown(releaseTimeStr) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!releaseTimeStr) return;
    const target = new Date(releaseTimeStr).getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = target - now;
      if (difference <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(difference);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [releaseTimeStr]);

  if (timeLeft <= 0) return null;

  const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

const ProductCard = ({ product, onPurchase }) => {
  const countdown = useCountdown(product.release_time);
  const [purchaseState, setPurchaseState] = useState(null); // 'loading', 'success', 'sold_out'

  const isLive = product.status === 'LIVE' && !countdown;
  const isSoldOut = product.status === 'SOLD_OUT';

  const handleBuy = async () => {
    setPurchaseState('loading');
    try {
      const res = await fetch('https://midnight-drop.onrender.com/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: API_USER, productId: product.id })
      });
      const data = await res.json();
      
      if (data.status === 'SUCCESS') {
        setPurchaseState('success');
      } else if (data.status === 'SOLD_OUT') {
        setPurchaseState('sold_out');
      }
    } catch (err) {
      console.error(err);
      setPurchaseState('error');
    }
  };

  return (
    <div className="glass-panel overflow-hidden group">
      <div className="relative h-64 overflow-hidden">
        <img 
          src={product.image || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800"} 
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight-900 to-transparent"></div>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          {isSoldOut ? (
            <span className="bg-red-500/80 text-white px-3 py-1 rounded-full text-sm font-bold backdrop-blur-sm border border-red-400">SOLD OUT</span>
          ) : isLive ? (
            <span className="bg-neon-pink/80 text-white px-3 py-1 rounded-full text-sm font-bold backdrop-blur-sm border border-pink-400 flex items-center gap-1">
              <Zap size={14} className="animate-pulse" /> LIVE NOW
            </span>
          ) : (
            <span className="bg-midnight-700/80 text-white px-3 py-1 rounded-full text-sm font-bold backdrop-blur-sm border border-gray-500 flex items-center gap-1">
              <Clock size={14} /> DROPPING SOON
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-2xl font-bold mb-2 text-white group-hover:gradient-text transition-all duration-300">{product.name}</h3>
        <p className="text-gray-400 mb-6 font-mono text-xl">${product.price.toFixed(2)}</p>
{product.inventory > 0 && product.inventory <= 5 && (
  <p className="text-orange-400 text-sm mb-4 font-bold">
    🔥 Only {product.inventory} left
  </p>
)}

        {/* Action Area */}
        {purchaseState === 'success' ? (
          <div className="bg-green-500/20 border border-green-500 text-green-400 p-4 rounded-xl flex items-center justify-center gap-2 font-bold animate-pulse-fast">
            <CheckCircle2 size={20} /> PURCHASE SUCCESSFUL
          </div>
        ) : purchaseState === 'sold_out' ? (
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded-xl flex items-center justify-center gap-2 font-bold">
            <XCircle size={20} /> SOLD OUT & REFUNDED
          </div>
        ) : isSoldOut ? (
          <button className="w-full btn-disabled">SOLD OUT</button>
        ) : isLive ? (
          <button 
            onClick={handleBuy} 
            disabled={purchaseState === 'loading'}
            className={`w-full ${purchaseState === 'loading' ? 'bg-neon-blue/50 cursor-wait' : 'btn-primary'}`}
          >
            {purchaseState === 'loading' ? 'SECURING INVENTORY...' : 'BUY NOW'}
          </button>
        ) : (
          <button className="w-full btn-disabled flex flex-col items-center justify-center py-2">
            <span className="text-xs uppercase tracking-widest text-gray-400">Unlocks In</span>
            <span className="text-xl font-mono text-white">{countdown || '00:00:00'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

const AdminPanel = ({ refreshTrigger }) => {
  const [orders, setOrders] = useState([]);
  
  const [form, setForm] = useState({ name: '', price: '', inventory: '', release_time: '', image: '' });

  useEffect(() => {
    fetch('https://midnight-drop.onrender.com/api/admin/orders')
      .then(res => res.json())
      .then(setOrders);
  }, [refreshTrigger]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isScheduled = !!form.release_time;
    const endpoint = isScheduled ? '/api/admin/schedule-product' : '/api/admin/add-product';
    
    await fetch(`https://midnight-drop.onrender.com${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        price: parseFloat(form.price),
        inventory: parseInt(form.inventory)
      })
    });
    alert('Product Added!');
    setForm({ name: '', price: '', inventory: '', release_time: '', image: '' });
  };
  const handleDelete = async (id) => {

  if(!window.confirm("Delete this product?")) return;

  await fetch(`https://midnight-drop.onrender.com/api/admin/product/${id}`, {
    method: "DELETE"
  });

  alert("Product deleted");

  window.location.reload();   // 🔥 ye line add karo

};


  return (
    <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="glass-panel p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-neon-blue"><ShieldAlert /> Create Drop</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Product Name</label>
            <input required type="text" className="w-full bg-midnight-900 border border-gray-700 rounded-lg p-3 text-white focus:border-neon-purple focus:ring-1 focus:ring-neon-purple" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Price ($)</label>
              <input required type="number" step="0.01" className="w-full bg-midnight-900 border border-gray-700 rounded-lg p-3 text-white" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Inventory</label>
              <input required type="number" className="w-full bg-midnight-900 border border-gray-700 rounded-lg p-3 text-white" value={form.inventory} onChange={e => setForm({...form, inventory: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Schedule Time (Leave blank for instant)</label>
            <input type="datetime-local" className="w-full bg-midnight-900 border border-gray-700 rounded-lg p-3 text-white" value={form.release_time} onChange={e => setForm({...form, release_time: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Image URL</label>
            <input type="url" className="w-full bg-midnight-900 border border-gray-700 rounded-lg p-3 text-white" value={form.image} onChange={e => setForm({...form, image: e.target.value})} placeholder="https://..." />
          </div>
          <button type="submit" className="w-full btn-primary mt-4">LAUNCH DROP</button>
        </form>
      </div>

      <div className="glass-panel p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-neon-pink"><Package /> Recent Orders</h2>
        <h2 className="text-xl font-bold mt-10 mb-4 text-red-400">Manage Products</h2>

<div className="space-y-3">
  {refreshTrigger.map(p => (
    <div key={p.id} className="bg-midnight-900 p-4 rounded-lg border border-gray-800 flex justify-between items-center">
      
      <div>
        <p className="font-bold">{p.name}</p>
        <p className="text-sm text-gray-400">
          Inventory: {p.inventory}
        </p>
      </div>

      <button
        onClick={() => handleDelete(p.id)}
        className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-white text-sm"
      >
        Delete
      </button>

    </div>
  ))}
</div>

        <div className="overflow-y-auto max-h-[500px] space-y-3">
          {orders.map(o => (
            <div key={o.id} className="bg-midnight-900 p-4 rounded-lg border border-gray-800 flex justify-between items-center">
              <div>
                <p className="font-bold">{o.product_name}</p>
                <p className="text-sm text-gray-400">{o.user_email}</p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-1 rounded text-xs font-bold ${o.order_status === 'SUCCESS' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {o.order_status}
                </span>
                <p className="text-xs text-gray-500 mt-1">{o.payment_status}</p>
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="text-gray-500 text-center py-8">No orders yet.</p>}
        </div>
      </div>
    </div>
    
  );
};

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [products, setProducts] = useState([]);

  const fetchProducts = () => {
    fetch('https://midnight-drop.onrender.com/api/products')
      .then(res => res.json())
      .then(setProducts)
      .catch(console.error);
  };

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(fetchProducts, 2000); // Polling for drop states
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-midnight-900">
      {/* Header */}
      <nav className="border-b border-white/10 bg-midnight-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsAdmin(false)}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-neon-blue to-neon-purple flex flex-col items-center justify-center transform rotate-3">
              <span className="text-white font-black text-xl leading-none">M</span>
              <span className="text-white font-black text-[10px] leading-none">Drop</span>
            </div>
            <h1 className="text-3xl font-black tracking-tighter gradient-text">MIDNIGHT</h1>
          </div>
          
          <button 
            onClick={() => setIsAdmin(!isAdmin)}
            className="text-sm border border-gray-700 hover:border-white px-4 py-2 rounded-full transition-colors"
          >
            {isAdmin ? 'View Store' : 'Admin Portal'}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-12">
        {isAdmin ? (
          <AdminPanel refreshTrigger={products} />
        ) : (
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-black mb-4">THE HOTTEST DROPS.</h2>
              <p className="text-xl text-gray-400">Exclusive gear. Limited inventory. Zero bots.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {products.length === 0 && (
              <div className="text-center text-gray-500 py-20">No drops active. Check back soon.</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
