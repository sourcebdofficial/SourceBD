import { useEffect, useState } from "react";
import Register from "./Register";
import Login from "./Login";
import BuyerDashboard from "./dashboards/BuyerDashboard.jsx";
import SupplierDashboard from "./dashboards/SupplierDashboard.jsx";
import AdminDashboard from "./dashboards/AdminDashboard.jsx";
import "./App.css";
import "./Marketplace.css";

const API_BASE = "http://localhost:5000/api";

const readRoute = () => {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathname, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  if (pathname.startsWith("/product/")) return { page: "product", id: pathname.slice(9) };
  if (pathname.startsWith("/supplier/")) return { page: "supplier", id: pathname.slice(10) };
  if (pathname === "/products") return { page: "products", search: params.get("search") || "" };
  if (pathname === "/suppliers") return { page: "suppliers" };
  if (pathname === "/compare") return { page: "compare" };
  if (pathname === "/how-it-works" || pathname === "/about") return { page: "about" };
  if (pathname === "/categories") return { page: "categories", search: params.get("search") || "" };
  if (pathname.startsWith("/category/")) {
    return { page: "category", category: decodeURIComponent(pathname.slice(10)), search: params.get("search") || "" };
  }
  return { page: "home" };
};

const priceText = (product) => {
  const symbol = product.currency === "USD" ? "$" : "৳";
  const amount = Number(product.price || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 });
  return `${symbol}${amount}`;
};

const productLocation = (supplier) => [supplier?.city, supplier?.address].filter(Boolean).join(", ") || "Location not added";

function SiteHeader({ logoData, onLogin, onRegister, activePage, compareCount }) {
  return (
    <header className="market-header">
      <a className="market-brand" href="#/" aria-label="SourceBD home">
        {logoData ? <img src={logoData} alt="SourceBD logo" /> : <span className="market-brand-mark">S</span>}
        <span>Source<span>BD</span></span>
      </a>
      <nav className="market-nav" aria-label="Main navigation">
        <a className={activePage === "home" ? "active" : ""} href="#/">Home</a>
        <a className={activePage === "products" || activePage === "product" || activePage === "category" ? "active" : ""} href="#/products">Products</a>
        <a className={activePage === "suppliers" || activePage === "supplier" ? "active" : ""} href="#/suppliers">Suppliers</a>
        <a className={activePage === "categories" ? "active" : ""} href="#/categories">Categories</a>
        <a className={activePage === "compare" ? "active" : ""} href="#/compare">Compare{compareCount > 0 && <span className="market-compare-count">{compareCount}</span>}</a>
        <a className={activePage === "about" ? "active" : ""} href="#/how-it-works">How It Works</a>
      </nav>
      <div className="market-header-actions">
        <button className="market-login" onClick={onLogin}>Log in</button>
        <button className="market-join" onClick={onRegister}>Join SourceBD <span>↗</span></button>
      </div>
    </header>
  );
}

function ProductCard({ product, comparison = [], onToggleCompare }) {
  const supplier = product.supplier || {};
  const image = product.images?.[0];
  return (
    <article className="market-product-card">
      <a className="market-product-main-link" href={`#/product/${product._id}`} aria-label={`View ${product.name}`}>
        <div className="market-product-image">
          <span className="market-product-fallback">{product.name?.slice(0, 1)?.toUpperCase() || "P"}</span>
          {image && <img src={image} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.remove(); }} />}
          <span className="market-product-category">{product.category}</span>
        </div>
        <div className="market-product-body">
          <div className="market-product-supplier"><span>{supplier.businessName || supplier.name || "SourceBD supplier"}</span>{supplier.isVerified && <span className="market-verified-badge" title="Verified supplier">✓ Verified</span>}</div>
          <h3>{product.name}</h3>
          <p>{product.description}</p>
          <div className="market-product-meta"><span>⌖ {productLocation(supplier)}</span><b>{priceText(product)} <small>/ {product.unit}</small></b></div>
          <div className="market-card-link">View product details <span>↗</span></div>
        </div>
      </a>
      <button className={`market-compare-button ${comparison.some((item) => item._id === product._id) ? "selected" : ""}`} onClick={() => onToggleCompare?.(product)}>{comparison.some((item) => item._id === product._id) ? "✓ Added to compare" : "⇄ Compare"}</button>
    </article>
  );
}

function ProductsGrid({ products, loading, error, emptyTitle = "No products are published yet", emptyText = "When suppliers publish products, they will appear here.", comparison, onToggleCompare }) {
  if (loading) return <div className="market-state"><span className="market-spinner" />Loading products…</div>;
  if (error) return <div className="market-state market-error">{error}</div>;
  if (!products.length) return <div className="market-empty"><span>▦</span><h3>{emptyTitle}</h3><p>{emptyText}</p></div>;
  return <div className="market-products-grid">{products.map((product) => <ProductCard key={product._id} product={product} comparison={comparison} onToggleCompare={onToggleCompare} />)}</div>;
}

function HomePage({ products, loading, error, categories, onSearch, comparison, onToggleCompare }) {
  const [search, setSearch] = useState("");
  return (
    <>
      <section className="market-hero">
        <div className="market-hero-pattern" />
        <div className="market-hero-copy">
          <span className="market-eyebrow"><i /> Bangladesh's sourcing marketplace</span>
          <h1>Find the right products.<br /><em>Meet the right suppliers.</em></h1>
          <p>Browse real listings from suppliers across Bangladesh. Compare product details, minimum orders and supplier information—all in one place.</p>
          <form className="market-search" onSubmit={(event) => { event.preventDefault(); onSearch(search); }}>
            <label><span>What are you looking for?</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, materials…" /></label>
            <button type="submit">Search listings <span>↗</span></button>
          </form>
          <div className="market-hero-points"><span>✓ Supplier-posted listings</span><span>✓ Contact details on product pages</span></div>
        </div>
        <div className="market-hero-art" aria-label="Map of Bangladesh showing all eight divisions">
          <div className="market-map-halo" />
          <img className="market-bangladesh-map-image" src="/bangladesh-divisions.webp" alt="Map of Bangladesh showing Rangpur, Rajshahi, Mymensingh, Sylhet, Dhaka, Khulna, Barishal and Chittagong divisions" />
        </div>
      </section>

      <section className="market-benefits">
        <div><b>01</b><span><strong>Supplier listings</strong><small>Products posted by businesses</small></span></div>
        <div><b>02</b><span><strong>Useful details</strong><small>Price, quantity and order info</small></span></div>
        <div><b>03</b><span><strong>Direct discovery</strong><small>Supplier contact on each listing</small></span></div>
      </section>

      <section className="market-section market-home-categories">
        <div className="market-section-head"><div><span className="market-section-kicker">Explore the marketplace</span><h2>Browse categories</h2><p>Find products by the category suppliers choose when posting.</p></div><a href="#/categories">All categories <span>↗</span></a></div>
        {categories.length ? <div className="market-category-row">{categories.slice(0, 6).map((item, index) => <a className="market-category-tile" key={item.name} href={`#/category/${encodeURIComponent(item.name)}`}><span className={`market-category-mark tone-${index % 4}`}>{item.name.slice(0, 1).toUpperCase()}</span><strong>{item.name}</strong><small>{item.productCount} {item.productCount === 1 ? "listing" : "listings"}</small><span className="market-category-arrow">↗</span></a>)}</div> : <p className="market-inline-empty">Categories will appear as suppliers publish products.</p>}
      </section>

      <section className="market-section market-latest-section">
        <div className="market-section-head"><div><span className="market-section-kicker">Fresh from suppliers</span><h2>Latest product listings</h2><p>Explore current supplier posts and open any listing for full details.</p></div><a href="#/categories">Browse all <span>↗</span></a></div>
        <ProductsGrid products={products.slice(0, 8)} loading={loading} error={error} comparison={comparison} onToggleCompare={onToggleCompare} />
      </section>

      <section className="market-home-about"><div><span className="market-section-kicker">Built around local sourcing</span><h2>One place to discover, compare and connect.</h2><p>SourceBD helps buyers find supplier-posted products and gives suppliers a place to present their businesses and offerings.</p></div><a href="#/about">Learn about SourceBD <span>↗</span></a></section>
    </>
  );
}

function CategoriesPage({ categories, products, loading, error, search, onSearch, comparison, onToggleCompare }) {
  const [searchText, setSearchText] = useState(search);
  return (
    <section className="market-page-content">
      <div className="market-page-heading"><span className="market-section-kicker">Explore SourceBD</span><h1>Categories & products</h1><p>Categories come from suppliers' published listings, so the marketplace can grow with new kinds of products.</p></div>
      <form className="market-listing-search" onSubmit={(event) => { event.preventDefault(); onSearch(searchText); }}><input aria-label="Search products" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search product, material or category" /><button>Search</button></form>
      {categories.length > 0 && <div className="market-category-row market-category-page-grid">{categories.map((item, index) => <a className="market-category-tile" key={item.name} href={`#/category/${encodeURIComponent(item.name)}`}><span className={`market-category-mark tone-${index % 4}`}>{item.name.slice(0, 1).toUpperCase()}</span><strong>{item.name}</strong><small>{item.productCount} {item.productCount === 1 ? "listing" : "listings"}</small><span className="market-category-arrow">↗</span></a>)}</div>}
      <div className="market-page-heading market-results-heading"><span className="market-section-kicker">Published by suppliers</span><h2>{search ? `Results for “${search}”` : "All product listings"}</h2></div>
      <ProductsGrid products={products} loading={loading} error={error} comparison={comparison} onToggleCompare={onToggleCompare} />
    </section>
  );
}

function CategoryPage({ category, products, loading, error, comparison, onToggleCompare }) {
  return <section className="market-page-content"><a className="market-back-link" href="#/categories">← All categories</a><div className="market-page-heading"><span className="market-section-kicker">Product category</span><h1>{category}</h1><p>Supplier-posted products in this category.</p></div><ProductsGrid products={products} loading={loading} error={error} comparison={comparison} onToggleCompare={onToggleCompare} emptyTitle={`No ${category} listings yet`} /></section>;
}

function AboutPage() {
  return (
    <section className="market-page-content market-about-page">
      <div className="market-about-hero"><span className="market-section-kicker">About SourceBD</span><h1>Helping Bangladesh's businesses source with confidence.</h1><p>SourceBD is a marketplace directory where suppliers can publish products and buyers can discover businesses, compare listing details and contact suppliers.</p></div>
      <div className="market-about-grid"><article><span>01</span><h2>What we do</h2><p>We bring supplier-posted products and business information into one searchable marketplace for buyers.</p></article><article><span>02</span><h2>How it works</h2><p>Suppliers create listings with product details. Buyers browse by category, open a listing and use the supplier's available contact information.</p></article><article><span>03</span><h2>Who it's for</h2><p>Local suppliers who want their offerings discovered, and buyers looking for products, materials and business partners.</p></article></div>
      <div className="market-about-flow"><div><b>Supplier</b><span>Posts products and business details</span></div><i>→</i><div><b>SourceBD</b><span>Organizes listings for discovery</span></div><i>→</i><div><b>Buyer</b><span>Reviews details and contacts supplier</span></div></div>
      <div className="market-about-note"><strong>Direct and transparent</strong><p>Product details and available supplier contact information are shown on each published product page. Buyers and suppliers can communicate directly.</p></div>
    </section>
  );
}

function ProductsDirectory({ products, loading, error, categories, comparison, onToggleCompare }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minMOQ, setMinMOQ] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState("newest");
  const filtered = products.filter((product) => {
    const text = `${product.name} ${product.description} ${product.category}`.toLowerCase();
    const location = `${product.supplier?.city || ""} ${product.supplier?.address || ""}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!category || product.category === category) && (!city || location.includes(city.toLowerCase())) && (minPrice === "" || Number(product.price) >= Number(minPrice)) && (maxPrice === "" || Number(product.price) <= Number(maxPrice)) && (minMOQ === "" || Number(product.minimumOrderQuantity) >= Number(minMOQ)) && (!verifiedOnly || product.supplier?.isVerified);
  }).sort((a, b) => sort === "price-low" ? Number(a.price) - Number(b.price) : sort === "price-high" ? Number(b.price) - Number(a.price) : sort === "name" ? a.name.localeCompare(b.name) : new Date(b.createdAt) - new Date(a.createdAt));
  return <section className="market-page-content"><div className="market-page-heading"><span className="market-section-kicker">Supplier-posted catalogue</span><h1>Wholesale Marketplace</h1><p>Browse real product listings and compare price, minimum order quantity and supplier details.</p></div><div className="market-directory-layout"><aside className="market-filter-panel"><h2>Filters <button onClick={() => { setSearch(""); setCategory(""); setCity(""); setMinPrice(""); setMaxPrice(""); setMinMOQ(""); setVerifiedOnly(false); }}>Reset</button></h2><label>Keyword<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Product or material" /></label><label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label>City / District<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Dhaka" /></label><div className="market-filter-pair"><label>Min price<input type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Any" /></label><label>Max price<input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Any" /></label></div><label>Min. order quantity<input type="number" min="0" value={minMOQ} onChange={(e) => setMinMOQ(e.target.value)} placeholder="Any" /></label><label className="market-checkbox"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> Verified suppliers only</label></aside><div className="market-directory-results"><div className="market-results-head"><strong>{loading ? "Loading listings…" : `${filtered.length} listing${filtered.length === 1 ? "" : "s"}`}</strong><label>Sort by<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></label></div><ProductsGrid products={filtered} loading={loading} error={error} comparison={comparison} onToggleCompare={onToggleCompare} emptyTitle="No matching products" emptyText="Try changing or clearing some filters." /></div></div></section>;
}

function SuppliersDirectory() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  useEffect(() => { const controller = new AbortController(); fetch(`${API_BASE}/products/suppliers`, { signal: controller.signal }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.message || "Could not load suppliers."); setSuppliers(d.suppliers || []); }).catch((e) => { if (e.name !== "AbortError") setError("Could not load suppliers. Check that the backend is running, then refresh."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, []);
  const types = [...new Set(suppliers.map((item) => item.businessType).filter(Boolean))];
  const filtered = suppliers.filter((item) => `${item.name} ${item.businessName} ${item.businessDescription}`.toLowerCase().includes(search.toLowerCase()) && (!city || `${item.city || ""} ${item.address || ""}`.toLowerCase().includes(city.toLowerCase())) && (!type || item.businessType === type) && (!verifiedOnly || item.isVerified));
  return <section className="market-page-content"><div className="market-page-heading"><span className="market-section-kicker">Meet the businesses behind the listings</span><h1>Suppliers Directory</h1><p>Discover manufacturers, wholesalers and importers with published products on SourceBD.</p></div><div className="market-supplier-filters"><input aria-label="Search suppliers" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business name or specialty…" /><input aria-label="Filter by location" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City or district" /><select aria-label="Filter by business type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All business types</option>{types.map((item) => <option key={item}>{item}</option>)}</select><label className="market-checkbox"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> Verified only</label></div>{loading ? <div className="market-state"><span className="market-spinner" />Loading suppliers…</div> : error ? <div className="market-state market-error">{error}</div> : !filtered.length ? <div className="market-empty"><h3>No suppliers found</h3><p>Try changing your search or filters.</p></div> : <div className="market-supplier-grid">{filtered.map((item) => <article className="market-supplier-card" key={item._id}><div className="market-supplier-card-top"><div className="market-supplier-avatar">{(item.businessName || item.name || "S").slice(0, 1).toUpperCase()}</div><span className={item.isVerified ? "market-verified" : "market-pending"}>{item.isVerified ? "✓ Verified" : "Supplier"}</span></div><small>{item.businessType || "Wholesale supplier"}</small><h2>{item.businessName || item.name || "Supplier"}</h2><p>{item.businessDescription || "A SourceBD supplier sharing products with buyers."}</p><div className="market-supplier-card-location">⌖ {[item.city, item.address].filter(Boolean).join(", ") || "Location not added"}</div><div className="market-supplier-card-footer"><span>{item.productCount} published {item.productCount === 1 ? "product" : "products"}</span><a href={`#/supplier/${item._id}`}>View profile ↗</a></div></article>)}</div>}</section>;
}

function SupplierProfilePage({ supplierId, comparison, onToggleCompare }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); fetch(`${API_BASE}/products/suppliers/${encodeURIComponent(supplierId)}`, { signal: controller.signal }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.message || "Supplier not found."); setResult(d); }).catch((e) => { if (e.name !== "AbortError") setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [supplierId]);
  if (loading) return <div className="market-page-content"><div className="market-state"><span className="market-spinner" />Loading supplier…</div></div>;
  if (error || !result) return <div className="market-page-content"><a className="market-back-link" href="#/suppliers">← Suppliers directory</a><div className="market-empty"><h3>Supplier profile unavailable</h3><p>{error}</p></div></div>;
  const { supplier, products } = result;
  return <section className="market-page-content"><a className="market-back-link" href="#/suppliers">← Suppliers directory</a><div className="market-supplier-profile"><div className="market-supplier-avatar">{(supplier.businessName || supplier.name || "S").slice(0, 1).toUpperCase()}</div><div><span className="market-section-kicker">{supplier.businessType || "SourceBD supplier"}</span><h1>{supplier.businessName || supplier.name}</h1><p>{supplier.businessDescription || "Supplier business profile on SourceBD."}</p></div>{supplier.isVerified && <span className="market-verified">✓ Verified supplier</span>}<div className="market-profile-details"><div><small>Contact person</small><strong>{supplier.name || "Not provided"}</strong></div><div><small>Business type</small><strong>{supplier.businessType || "Not provided"}</strong></div><div><small>Address</small><strong>{[supplier.address, supplier.city].filter(Boolean).join(", ") || "Not provided"}</strong></div><div><small>Phone</small>{supplier.phone ? <a href={`tel:${supplier.phone}`}>{supplier.phone}</a> : <strong>Not provided</strong>}</div><div><small>Email</small>{supplier.email ? <a href={`mailto:${supplier.email}`}>{supplier.email}</a> : <strong>Not provided</strong>}</div></div></div><div className="market-section-head market-profile-products-head"><div><span className="market-section-kicker">Available from this supplier</span><h2>Published products</h2></div></div><ProductsGrid products={products} loading={false} comparison={comparison} onToggleCompare={onToggleCompare} emptyTitle="No published products" /></section>;
}

function ComparePage({ comparison, onToggleCompare }) {
  if (!comparison.length) return <section className="market-page-content"><div className="market-page-heading"><span className="market-section-kicker">Make an informed choice</span><h1>Compare Products</h1><p>Compare product and supplier details side by side.</p></div><div className="market-empty"><span>⇄</span><h3>No products selected for comparison</h3><p>Add up to four listings from the Products page to compare them here.</p><a className="market-primary-link" href="#/products">Browse products ↗</a></div></section>;
  const rows = [["Price", (p) => `${priceText(p)} / ${p.unit}`], ["Category", (p) => p.category || "—"], ["Minimum order", (p) => `${Number(p.minimumOrderQuantity || 0).toLocaleString("en-BD")} ${p.unit || ""}`], ["Available quantity", (p) => `${Number(p.quantity || 0).toLocaleString("en-BD")} ${p.unit || ""}`], ["Supplier", (p) => p.supplier?.businessName || p.supplier?.name || "—"], ["Location", (p) => productLocation(p.supplier)], ["Supplier status", (p) => p.supplier?.isVerified ? "✓ Verified" : "Not verified"]];
  return <section className="market-page-content"><div className="market-page-heading"><span className="market-section-kicker">Make an informed choice</span><h1>Compare Products</h1><p>Compare product and supplier details side by side. You can select up to four listings.</p></div><div className="market-compare-table-wrap"><table className="market-compare-table"><thead><tr><th>Product details</th>{comparison.map((p) => <th key={p._id}><a href={`#/product/${p._id}`}>{p.name}</a><button onClick={() => onToggleCompare(p)}>Remove</button></th>)}</tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th>{comparison.map((p) => <td key={p._id}>{value(p)}</td>)}</tr>)}</tbody></table></div><a className="market-back-link" href="#/products">← Browse more products</a></section>;
}

function ProductDetailPage({ productId, comparison, onToggleCompare }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/products/${encodeURIComponent(productId)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load this product.");
        setProduct(data.product);
      })
      .catch((fetchError) => { if (fetchError.name !== "AbortError") setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [productId]);

  if (loading) return <div className="market-page-content"><div className="market-state"><span className="market-spinner" />Loading product…</div></div>;
  if (error || !product) return <div className="market-page-content"><a className="market-back-link" href="#/categories">← Back to products</a><div className="market-empty"><h3>Product unavailable</h3><p>{error || "This listing may have been removed or unpublished."}</p></div></div>;

  const supplier = product.supplier || {};
  const address = [supplier.address, supplier.city].filter(Boolean).join(", ");
  const image = product.images?.[0];
  return (
    <section className="market-page-content market-detail-page">
      <a className="market-back-link" href={product.category ? `#/category/${encodeURIComponent(product.category)}` : "#/categories"}>← Back to {product.category || "products"}</a>
      <div className="market-detail-layout">
        <div className="market-detail-main">
          <div className="market-detail-image">{image ? <img src={image} alt={product.name} /> : <span>{product.name?.slice(0, 1)?.toUpperCase() || "P"}</span>}</div>
          <div className="market-detail-heading"><span className="market-detail-tag">{product.category}</span><h1>{product.name}</h1><p>Posted {new Date(product.createdAt).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })}</p></div>
          <article className="market-detail-panel"><div className="market-detail-panel-heading"><h2>Product description</h2><button className={`market-compare-button ${comparison.some((item) => item._id === product._id) ? "selected" : ""}`} onClick={() => onToggleCompare(product)}>{comparison.some((item) => item._id === product._id) ? "✓ Added to compare" : "⇄ Compare"}</button></div><p className="market-description">{product.description}</p><div className="market-spec-grid"><div><small>Price</small><strong>{priceText(product)} / {product.unit}</strong></div><div><small>Available quantity</small><strong>{Number(product.quantity).toLocaleString("en-BD")} {product.unit}</strong></div><div><small>Minimum order</small><strong>{Number(product.minimumOrderQuantity).toLocaleString("en-BD")} {product.unit}</strong></div><div><small>Category</small><strong>{product.category}</strong></div></div></article>
        </div>
        <aside className="market-supplier-panel"><span className="market-section-kicker">Supplier information</span><div className="market-supplier-avatar">{(supplier.businessName || supplier.name || "S").slice(0, 1).toUpperCase()}</div><h2>{supplier.businessName || supplier.name || "Supplier"}</h2>{supplier.businessName && supplier.name && <p className="market-contact-name">Contact: {supplier.name}</p>}{supplier.isVerified && <span className="market-verified">✓ Verified supplier</span>}
          {supplier.businessType && <div className="market-contact-row"><small>Business type</small><strong>{supplier.businessType}</strong></div>}
          {supplier.businessDescription && <div className="market-contact-row"><small>About the business</small><p>{supplier.businessDescription}</p></div>}
          <div className="market-contact-row"><small>Address</small><strong>{address || "Address not added"}</strong></div>
          <div className="market-contact-row"><small>Phone</small>{supplier.phone ? <a href={`tel:${supplier.phone}`}>{supplier.phone}</a> : <strong>Not provided</strong>}</div>
          <div className="market-contact-row"><small>Email</small>{supplier.email ? <a href={`mailto:${supplier.email}`}>{supplier.email}</a> : <strong>Not provided</strong>}</div>
          {supplier.phone && <a className="market-contact-button" href={`tel:${supplier.phone}`}>Contact supplier <span>↗</span></a>}
        </aside>
      </div>
    </section>
  );
}

function SiteFooter({ logoData }) {
  return <footer className="market-footer"><a className="market-brand" href="#/">{logoData ? <img src={logoData} alt="SourceBD logo" /> : <span className="market-brand-mark">S</span>}<span>Source<span>BD</span></span></a><p>Discover supplier-posted products and local business information across Bangladesh.</p><div><a href="#/products">Products</a><a href="#/suppliers">Suppliers</a><a href="#/categories">Categories</a><a href="#/compare">Compare</a><a href="#/how-it-works">How It Works</a></div><small>© 2026 SourceBD · Student Project Prototype</small></footer>;
}

function MarketplaceApp() {
  const [currentUser, setCurrentUser] = useState(() => {
    try { const saved = localStorage.getItem("user"); return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [logoData, setLogoData] = useState("");
  const [route, setRoute] = useState(readRoute);
  const [productResult, setProductResult] = useState({ key: "", products: [], error: "" });
  const [categories, setCategories] = useState([]);
  const [comparison, setComparison] = useState(() => { try { const saved = JSON.parse(localStorage.getItem("sourcebd-compare") || "[]"); return Array.isArray(saved) ? saved.slice(0, 4) : []; } catch { return []; } });
  const [compareNotice, setCompareNotice] = useState("");

  useEffect(() => {
    const syncRoute = () => { setRoute(readRoute()); window.scrollTo({ top: 0, behavior: "smooth" }); };
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/settings`).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.logoData) setLogoData(data.logoData); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!["home", "products", "categories", "category"].includes(route.page)) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "100" });
    if (route.page === "category" && route.category) params.set("category", route.category);
    if (route.search) params.set("search", route.search);
    const queryKey = `${route.page}|${route.category || ""}|${route.search || ""}`;
    fetch(`${API_BASE}/products?${params}`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not load supplier listings."); setProductResult({ key: queryKey, products: data.products || [], error: "" }); })
      .catch((error) => { if (error.name !== "AbortError") setProductResult({ key: queryKey, products: [], error: "Could not connect to the marketplace. Check that the backend is running, then refresh." }); });
    return () => controller.abort();
  }, [route.page, route.category, route.search]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetch(`${API_BASE}/products/categories`, { signal: controller.signal }), fetch(`${API_BASE}/sourcing/categories`, { signal: controller.signal })]).then(async ([productsResponse, sourcingResponse]) => {
      const [productData, sourcingData] = await Promise.all([productsResponse.ok ? productsResponse.json() : {}, sourcingResponse.ok ? sourcingResponse.json() : {}]);
      const merged = new Map();
      [...(sourcingData.categories || []), ...(productData.categories || [])].forEach((item) => { const name = typeof item === "string" ? item : item.name; if (name) { const current = merged.get(name.toLowerCase()); merged.set(name.toLowerCase(), { name, productCount: Math.max(Number(item.productCount || 0), Number(current?.productCount || 0)) }); } });
      setCategories([...merged.values()].sort((a, b) => a.name.localeCompare(b.name)));
    }).catch((error) => { if (error.name !== "AbortError") setCategories([]); });
    return () => controller.abort();
  }, []);

  const navigate = (path) => {
    const hash = `#${path}`;
    if (window.location.hash === hash) { setRoute(readRoute()); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else window.location.hash = path;
  };
  const searchListings = (search) => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    const queryString = query.toString();
    navigate(`/categories${queryString ? `?${queryString}` : ""}`);
  };
  const productQueryKey = `${route.page}|${route.category || ""}|${route.search || ""}`;
  const showsProductList = ["home", "products", "categories", "category"].includes(route.page);
  const productsLoading = showsProductList && productResult.key !== productQueryKey;
  const products = productResult.key === productQueryKey ? productResult.products : [];
  const productsError = productResult.key === productQueryKey ? productResult.error : "";
  const handleLogin = (loggedInUser) => { setCurrentUser(loggedInUser); setShowLogin(false); setShowRegister(false); };
  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); setCurrentUser(null); };
  const toggleCompare = (product) => {
    setComparison((current) => {
      const exists = current.some((item) => item._id === product._id);
      if (exists) { const next = current.filter((item) => item._id !== product._id); localStorage.setItem("sourcebd-compare", JSON.stringify(next)); setCompareNotice("Product removed from comparison."); return next; }
      if (current.length >= 4) { setCompareNotice("You can compare up to four products at a time."); return current; }
      const next = [...current, product]; localStorage.setItem("sourcebd-compare", JSON.stringify(next)); setCompareNotice("Product added. Open Compare to see it side by side."); return next;
    });
    window.setTimeout(() => setCompareNotice(""), 3200);
  };

  if (currentUser?.role === "buyer") return <BuyerDashboard user={currentUser} onLogout={handleLogout} logoData={logoData} />;
  if (currentUser?.role === "supplier") return <SupplierDashboard user={currentUser} onLogout={handleLogout} logoData={logoData} />;
  if (["admin", "co-admin"].includes(currentUser?.role)) return <AdminDashboard user={currentUser} onLogout={handleLogout} logoData={logoData} onLogoChange={setLogoData} />;
  if (showLogin) return <Login onLoginSuccess={handleLogin} onBack={() => setShowLogin(false)} />;
  if (showRegister) return <Register onBack={() => { setShowRegister(false); setShowLogin(true); }} />;

  return (
    <div className="marketplace">
      <SiteHeader logoData={logoData} onLogin={() => setShowLogin(true)} onRegister={() => setShowRegister(true)} activePage={route.page} compareCount={comparison.length} />
      {compareNotice && <div className="market-toast" role="status">{compareNotice} <a href="#/compare">Compare now →</a><button aria-label="Dismiss message" onClick={() => setCompareNotice("")}>×</button></div>}
      <main>
        {route.page === "home" && <HomePage products={products} loading={productsLoading} error={productsError} categories={categories} onSearch={searchListings} comparison={comparison} onToggleCompare={toggleCompare} />}
        {route.page === "products" && <ProductsDirectory products={products} loading={productsLoading} error={productsError} categories={categories} comparison={comparison} onToggleCompare={toggleCompare} />}
        {route.page === "categories" && <CategoriesPage categories={categories} products={products} loading={productsLoading} error={productsError} search={route.search} onSearch={searchListings} comparison={comparison} onToggleCompare={toggleCompare} />}
        {route.page === "category" && <CategoryPage category={route.category} products={products} loading={productsLoading} error={productsError} comparison={comparison} onToggleCompare={toggleCompare} />}
        {route.page === "suppliers" && <SuppliersDirectory />}
        {route.page === "supplier" && <SupplierProfilePage key={route.id} supplierId={route.id} comparison={comparison} onToggleCompare={toggleCompare} />}
        {route.page === "compare" && <ComparePage comparison={comparison} onToggleCompare={toggleCompare} />}
        {route.page === "about" && <AboutPage />}
        {route.page === "product" && <ProductDetailPage key={route.id} productId={route.id} comparison={comparison} onToggleCompare={toggleCompare} />}
      </main>
      <SiteFooter logoData={logoData} />
    </div>
  );
}

export default MarketplaceApp;
