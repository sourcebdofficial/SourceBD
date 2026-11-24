
import { useEffect, useState } from "react";
import Register from "./Register";
import Login from "./Login";
import BuyerDashboard from "./dashboards/BuyerDashboard.jsx";
import SupplierDashboard from "./dashboards/SupplierDashboard.jsx";
import AdminDashboard from "./dashboards/AdminDashboard.jsx";
import "./App.css";
import "./HomePage.css";

const categories = [
  { icon: "🧵", name: "Garments & Textile", count: "Fabric, thread, buttons" },
  { icon: "📦", name: "Packaging", count: "Boxes, bags, cartons" },
  { icon: "💄", name: "Cosmetics", count: "Beauty products & supplies" },
  { icon: "💻", name: "Electronics", count: "Gadgets & components" },
  { icon: "🪑", name: "Furniture", count: "Wood, fittings, hardware" },
  { icon: "🌾", name: "Agriculture", count: "Seeds & farm supplies" },
  { icon: "🍚", name: "Food & Beverage", count: "Ingredients & spices" },
  { icon: "🖨️", name: "Printing", count: "Paper, ink & materials" },
];

const suppliers = [
  {
    name: "Dhaka Textile House",
    category: "Garments & Textile",
    location: "Islampur, Dhaka",
    price: "৳180 / yard",
    icon: "🧵",
  },
  {
    name: "Bangla Packaging Ltd.",
    category: "Packaging",
    location: "Narayanganj",
    price: "৳12 / piece",
    icon: "📦",
  },
  {
    name: "Modern Electronics BD",
    category: "Electronics",
    location: "Gulistan, Dhaka",
    price: "৳350 / unit",
    icon: "💻",
  },
];

function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("All Bangladesh");
  const [category, setCategory] = useState("All Categories");
  const [logoData, setLogoData] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/settings")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.logoData) setLogoData(data.logoData); })
      .catch(() => {});
  }, []);

  const [currentUser, setCurrentUser] = useState(() => {
  try {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
});

  useEffect(() => {
    const revealItems = document.querySelectorAll(".reveal");
    if (!revealItems.length) return undefined;
    if (!("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [currentUser, showLogin, showRegister]);

const handleLoginSuccess = (user) => {
  setCurrentUser(user);
  setShowLogin(false);
  setShowRegister(false);
};

const handleLogout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  setCurrentUser(null);
  setShowLogin(false);
  setShowRegister(false);
};

  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch =
      supplier.name.toLowerCase().includes(search.toLowerCase()) ||
      supplier.category.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      category === "All Categories" || supplier.category === category;

    const matchesLocation =
      location === "All Bangladesh" ||
      supplier.location.toLowerCase().includes(location.toLowerCase());

    return matchesSearch && matchesCategory && matchesLocation;
  });

  if (currentUser) {
  if (currentUser.role === "buyer") {
    return (
      <BuyerDashboard
        user={currentUser}
        onLogout={handleLogout}
        logoData={logoData}
      />
    );
  }

  if (currentUser.role === "supplier") {
  return (
    <SupplierDashboard
      user={currentUser}
      onLogout={handleLogout}
      logoData={logoData}
    />
  );
}


if (
  currentUser.role === "admin" ||
  currentUser.role === "co-admin"
) {
  return (
    <AdminDashboard
      user={currentUser}
      onLogout={handleLogout}
      logoData={logoData}
      onLogoChange={setLogoData}
    />
  );
}

}

if (showLogin) {
  return (
    <Login
      onLoginSuccess={handleLoginSuccess}
      onBack={() => setShowLogin(false)}
    />
  );
}

if (showRegister) {
  return <Register onBack={() => { setShowRegister(false); setShowLogin(true); }} />;
}

  return (
    <div className="app home-page">
      <header className="navbar home-navbar">
        <a className="brand" href="#top" aria-label="SourceBD home">
          {logoData ? <img className="brand-image" src={logoData} alt="SourceBD logo" /> : <span className="brand-icon">S</span>}
          <span>Source<span className="brand-green">BD</span></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#categories">Categories</a><a href="#suppliers">Suppliers</a><a href="#how">How it works</a>
        </nav>
        <div className="nav-actions">
          <button className="login-btn" onClick={() => setShowLogin(true)}>Log in</button>
          <button className="join-btn" onClick={() => setShowRegister(true)}>Create account <span>↗</span></button>
        </div>
      </header>

      <main id="top">
        <section className="hero home-hero">
          <div className="hero-grid-pattern" />
          <div className="home-hero-inner">
            <div className="hero-content home-hero-copy">
              <div className="home-eyebrow"><i /> Bangladesh wholesale network</div>
              <h1>Find trusted suppliers.<br /><span>Source smarter.</span></h1>
              <p>Discover wholesale products, raw materials and local businesses across Bangladesh—all in one place.</p>

              <div className="search-panel home-search-panel">
                <label><span>What do you need?</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try cotton fabric or packaging" /></label>
                <label><span>Location</span><select value={location} onChange={(event) => setLocation(event.target.value)}><option>All Bangladesh</option><option>Dhaka</option><option>Narayanganj</option><option>Chattogram</option><option>Gazipur</option></select></label>
                <button className="search-btn" onClick={() => document.getElementById("suppliers")?.scrollIntoView({ behavior: "smooth" })}>Find suppliers <span>↗</span></button>
              </div>

              <div className="hero-note"><span>✓</span> Local businesses <span>✓</span> Multiple industries <span>✓</span> Easy discovery</div>
            </div>

            <div className="hero-visual home-hero-visual" aria-label="SourceBD supplier discovery preview">
              <div className="hero-visual-glow" />
              <div className="network-orbit orbit-one" /><div className="network-orbit orbit-two" />
              <div className="network-core"><span className="network-core-mark">S</span><span>SourceBD</span><small>Supplier network</small></div>
              <div className="network-node node-dhaka"><i /><span>Dhaka</span></div>
              <div className="network-node node-chattogram"><i /><span>Chattogram</span></div>
              <div className="network-node node-narayanganj"><i /><span>Narayanganj</span></div>
              <div className="visual-card card-one home-float-card"><span className="mini-icon mint">T</span><div><strong>Textile & fabric</strong><small>Wholesale materials</small></div></div>
              <div className="visual-card card-two home-float-card"><span className="mini-icon peach">P</span><div><strong>Packaging supplies</strong><small>Business essentials</small></div></div>
              <div className="hero-match-card"><span className="match-check">✓</span><div><strong>Find your next supplier</strong><small>Search across local industries</small></div><b>↗</b></div>
            </div>
          </div>
          <div className="hero-bottom-line"><span>Built for Bangladesh's growing businesses</span><span>Explore the network <b>↓</b></span></div>
        </section>

        <section className="trust-strip reveal" aria-label="Platform benefits">
          <div><span className="trust-symbol">⌕</span><div><strong>Easy discovery</strong><small>Search products and materials</small></div></div>
          <div><span className="trust-symbol">⌖</span><div><strong>Local connections</strong><small>Explore businesses by location</small></div></div>
          <div><span className="trust-symbol">▦</span><div><strong>Many industries</strong><small>Browse useful categories</small></div></div>
          <div><span className="trust-symbol">↗</span><div><strong>Made for business</strong><small>A simpler sourcing journey</small></div></div>
        </section>

        <section className="section home-section" id="categories">
          <div className="section-heading reveal">
            <div><span className="eyebrow">Explore the market</span><h2>Find what your business needs.</h2><p>Start with a category and discover products and materials for your next order.</p></div>
            <a className="text-link" href="#suppliers">Explore suppliers <span>↗</span></a>
          </div>
          <div className="category-grid home-category-grid">
            {categories.map((item, index) => (
              <button className="category-card home-category-card reveal" key={item.name} style={{ "--reveal-delay": `${index * 55}ms` }} onClick={() => { setCategory(item.name); document.getElementById("suppliers")?.scrollIntoView({ behavior: "smooth" }); }}>
                <span className={`category-icon category-tone-${index % 4}`}>{item.icon}</span><span className="category-arrow">↗</span><strong>{item.name}</strong><small>{item.count}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="section supplier-section home-supplier-section" id="suppliers">
          <div className="section-heading supplier-heading reveal">
            <div><span className="eyebrow">Discover business partners</span><h2>Explore suppliers.</h2><p>Browse sample listings and narrow your search by product category.</p></div>
            <button className="reset-btn" onClick={() => { setSearch(""); setLocation("All Bangladesh"); setCategory("All Categories"); }}>Clear filters <span>↺</span></button>
          </div>
          <div className="filter-row home-filter-row reveal">
            <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Supplier or product name" /></label>
            <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All Categories</option>{categories.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
            <span className="result-count">{filteredSuppliers.length} sample {filteredSuppliers.length === 1 ? "result" : "results"}</span>
          </div>
          <div className="supplier-grid home-supplier-grid">
            {filteredSuppliers.length > 0 ? filteredSuppliers.map((supplier, index) => (
              <article className="supplier-card home-supplier-card reveal" key={supplier.name} style={{ "--reveal-delay": `${index * 90}ms` }}>
                <div className="supplier-top"><span className="supplier-icon">{supplier.icon}</span><span className="sample-badge">Sample listing</span></div>
                <h3>{supplier.name}</h3><p>{supplier.category}</p>
                <div className="supplier-location">⌖ <span>{supplier.location}</span></div>
                <div className="supplier-bottom"><div><small>Indicative price</small><strong>{supplier.price}</strong></div><button onClick={() => alert("Supplier contact feature coming soon!")}>View details <span>↗</span></button></div>
              </article>
            )) : <p className="empty-state">No sample suppliers match these filters. Try another search.</p>}
          </div>
          <p className="disclaimer">Demo content only. Supplier names and prices are examples, not verified business listings.</p>
        </section>

        <section className="how-section home-how-section" id="how">
          <div className="reveal"><span className="eyebrow">Simple. Practical. Local.</span><h2>A clearer path from need to supplier.</h2><p className="how-intro">Spend less time searching and more time moving your business forward.</p></div>
          <div className="steps home-steps">
            <div className="reveal"><span>01</span><div className="step-rule" /><h3>Search products</h3><p>Enter a product, material or category to begin.</p></div>
            <div className="reveal"><span>02</span><div className="step-rule" /><h3>Compare suppliers</h3><p>Explore businesses and locations that fit your needs.</p></div>
            <div className="reveal"><span>03</span><div className="step-rule" /><h3>Connect directly</h3><p>Find the right business partner for your next order.</p></div>
          </div>
        </section>

        <section className="cta home-cta reveal">
          <div><span className="eyebrow">Grow your reach</span><h2>Are you a wholesale supplier?</h2><p>Help businesses discover your products and services on SourceBD.</p></div>
          <button onClick={() => setShowRegister(true)}>List your business <span>↗</span></button>
          <div className="cta-orb" />
        </section>
      </main>

      <footer className="home-footer">
        <a className="brand footer-brand" href="#top">{logoData ? <img className="brand-image" src={logoData} alt="SourceBD logo" /> : <span className="brand-icon">S</span>}<span>Source<span className="brand-green">BD</span></span></a>
        <p>Connecting Bangladesh's businesses to better sourcing opportunities.</p>
        <span>© 2026 SourceBD · Student Project Prototype</span>
      </footer>
    </div>
  );
}

export default App;
