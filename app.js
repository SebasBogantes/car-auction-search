/* =======================================================
   BUSCADOR DE HYUNDAI TUCSON – SUBASTAS USA
   app.js – Lógica completa de la aplicación

   Fuentes reales:
   - MarketCheck API  (https://docs.marketcheck.com)
   - Auto.dev API     (https://docs.auto.dev)
======================================================= */

// ─────────────────────────────────────────────────────
// PARÁMETROS DE BÚSQUEDA (modifica aquí para otros autos)
// ─────────────────────────────────────────────────────
const SEARCH = {
  make:       'Hyundai',
  model:      'Tucson',
  years:      ['2015', '2016'],
  // MarketCheck acepta: Gas | Gasoline | Diesel | Electric | Hybrid
  fuelType:   'Gas',
};

// ─────────────────────────────────────────────────────
// GESTIÓN DE API KEYS (localStorage)
// ─────────────────────────────────────────────────────

function getKeys() {
  return {
    mc: localStorage.getItem('mc_api_key') || '',
    ad: localStorage.getItem('ad_api_key') || '',
  };
}

function saveKeys() {
  const mcInput = document.getElementById('key-mc');
  const adInput = document.getElementById('key-ad');
  const mc = mcInput.value.trim();
  const ad = adInput.value.trim();

  if (!mc && !ad) {
    mcInput.style.borderColor = '#dc2626';
    adInput.style.borderColor = '#dc2626';
    setTimeout(() => {
      mcInput.style.borderColor = '';
      adInput.style.borderColor = '';
    }, 2000);
    return;
  }

  if (mc) localStorage.setItem('mc_api_key', mc);
  if (ad) localStorage.setItem('ad_api_key', ad);

  closeSettings();
}

function openSettings() {
  const keys = getKeys();
  document.getElementById('key-mc').value = keys.mc;
  document.getElementById('key-ad').value = keys.ad;
  document.getElementById('modal-overlay').removeAttribute('hidden');
}

function closeSettings() {
  document.getElementById('modal-overlay').setAttribute('hidden', '');
}

// Cierra modal al hacer clic fuera del recuadro
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    const keys = getKeys();
    if (keys.mc || keys.ad) closeSettings();
  }
});

// ─────────────────────────────────────────────────────
// MARKETCHECK API
// Docs: https://docs.marketcheck.com/docs/api/cars/inventory/inventory-search
// Free tier: 500 llamadas/mes
// ─────────────────────────────────────────────────────

async function fetchMarketCheck(apiKey) {
  const params = new URLSearchParams({
    api_key:    apiKey,
    make:       SEARCH.make,
    model:      SEARCH.model,
    year:       SEARCH.years.join(','),  // acepta "2015,2016"
    fuel_type:  SEARCH.fuelType,
    rows:       100,
    start:      0,
    sort_by:    'price',
    sort_order: 'asc',
  });

  const res = await fetch(
    `https://mc-api.marketcheck.com/v2/search/car/active?${params}`,
    { signal: AbortSignal.timeout(15000) }
  );

  if (res.status === 401 || res.status === 403) {
    throw new Error('MarketCheck: Invalid or expired API key');
  }
  if (res.status === 429) {
    throw new Error('MarketCheck: Monthly call limit reached');
  }
  if (!res.ok) {
    throw new Error(`MarketCheck: HTTP error ${res.status}`);
  }

  const data = await res.json();
  const listings = data.listings || [];

  return listings.map((item) => normalizeMarketCheck(item));
}

function normalizeMarketCheck(item) {
  const build    = item.build   || {};
  const dealer   = item.dealer  || {};
  const media    = item.media   || {};
  const photos   = media.photo_links || [];

  const city     = dealer.city  || '';
  const state    = dealer.state || '';
  const location = city && state ? `${city}, ${state}` : (city || state || 'USA');

  return {
    source:   'MarketCheck',
    id:       item.id || item.vin,
    vin:      item.vin || null,
    year:     build.year  || null,
    make:     build.make  || SEARCH.make,
    model:    build.model || SEARCH.model,
    trim:     build.trim  || null,
    price:    item.price  > 0 ? item.price : null,
    mileage:  item.miles  > 0 ? item.miles : null,
    fuelType: build.fuel_type    || 'Gas',
    trans:    build.transmission || null,
    color:    item.exterior_color || null,
    image:    photos[0] || null,
    location,
    dealer:   dealer.name || null,
    url:      (item.vdp_url && item.vdp_url.startsWith('http')) ? item.vdp_url : null,
  };
}

// ─────────────────────────────────────────────────────
// AUTO.DEV API
// Docs: https://docs.auto.dev/v2/products/vehicle-listings
// Free tier: 1,000 llamadas/mes
// ─────────────────────────────────────────────────────

async function fetchAutoDev(apiKey) {
  const results = [];

  // Auto.dev no acepta múltiples años en un solo parámetro,
  // por eso hacemos una llamada por año en paralelo.
  const adBase = (window.AD_PROXY_BASE || 'https://api.auto.dev') + '/listings';

  const requests = SEARCH.years.map(async (year) => {
    const params = new URLSearchParams({
      'vehicle.make':  SEARCH.make,
      'vehicle.model': SEARCH.model,
      'vehicle.year':  year,
      apikey:          apiKey,
      page:            1,
    });

    const res = await fetch(
      `${adBase}?${params}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (res.status === 401 || res.status === 403) {
      throw new Error('Auto.dev: Invalid or expired API key');
    }
    if (res.status === 429) {
      throw new Error('Auto.dev: Call limit reached');
    }
    if (!res.ok) {
      throw new Error(`Auto.dev: HTTP error ${res.status} (year ${year})`);
    }

    const data = await res.json();
    const listings = data.data || data.records || data.listings || [];

    return listings
      .filter((item) => isGasoline(item.vehicle?.fuel))
      .map((item)    => normalizeAutoDev(item, year));
  });

  const settled = await Promise.allSettled(requests);

  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(...r.value);
    else throw new Error(r.reason?.message || 'Auto.dev: unknown error');
  }

  return results;
}

function isGasoline(fuelType) {
  if (!fuelType) return true;             // si no hay dato, lo incluimos
  const f = fuelType.toLowerCase();
  return f.includes('gas') || f.includes('unleaded') || f.includes('petrol');
}

function normalizeAutoDev(item, fallbackYear) {
  const vehicle = item.vehicle       || {};
  const listing = item.retailListing || {};
  const images  = item.images        || [];

  const city     = listing.city  || '';
  const state    = listing.state || '';
  const location = city && state ? `${city}, ${state}` : (city || state || 'USA');

  return {
    source:   'Auto.dev',
    id:       item.vin || `ad-${fallbackYear}-${Math.random().toString(36).slice(2)}`,
    vin:      item.vin || null,
    year:     vehicle.year  || parseInt(fallbackYear),
    make:     vehicle.make  || SEARCH.make,
    model:    vehicle.model || SEARCH.model,
    trim:     vehicle.trim  || null,
    price:    listing.price > 0 ? listing.price : null,
    mileage:  listing.miles > 0 ? listing.miles : null,
    fuelType: vehicle.fuel         || 'Gasoline',
    trans:    vehicle.transmission || null,
    color:    vehicle.exteriorColor || null,
    image:    listing.primaryImage || images[0] || null,
    location,
    dealer:   typeof listing.dealer === 'string' ? listing.dealer : null,
    url:      (listing.vdp && listing.vdp.startsWith('http')) ? listing.vdp : null,
  };
}

// ─────────────────────────────────────────────────────
// FAVORITOS
// ─────────────────────────────────────────────────────

function getFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem('car_favorites') || '[]')); }
  catch { return new Set(); }
}

function toggleFavorite(vin) {
  const favs = getFavorites();
  if (favs.has(vin)) favs.delete(vin); else favs.add(vin);
  localStorage.setItem('car_favorites', JSON.stringify([...favs]));
  return favs;
}

let showFavsOnly = false;

function toggleFavsFilter() {
  showFavsOnly = !showFavsOnly;
  const btn = document.getElementById('filter-favs-btn');
  btn.classList.toggle('active', showFavsOnly);
  btn.textContent = showFavsOnly ? '♥ Favorites only' : '♥ Favorites';
  renderPage(1);
}

// ─────────────────────────────────────────────────────
// BÚSQUEDA PRINCIPAL
// ─────────────────────────────────────────────────────

let isSearching = false;
let allSorted   = [];
let currentPage = 1;
const PAGE_SIZE = 25;

async function buscar() {
  if (isSearching) return;

  const keys = getKeys();
  if (!keys.mc && !keys.ad) {
    openSettings();
    return;
  }

  isSearching = true;

  // Referencias al DOM
  const btnSearch    = document.getElementById('btn-search');
  const loadingEl    = document.getElementById('loading');
  const sourceEl     = document.getElementById('source-status');
  const errorEl      = document.getElementById('error-banner');
  const statsEl      = document.getElementById('stats-bar');
  const resultsEl    = document.getElementById('results');
  const emptyEl      = document.getElementById('empty-state');

  // Resetear UI
  btnSearch.disabled        = true;
  btnSearch.textContent     = '⏳ Searching…';
  loadingEl.removeAttribute('hidden');
  sourceEl.setAttribute('hidden', '');
  errorEl.setAttribute('hidden', '');
  statsEl.setAttribute('hidden', '');
  emptyEl.setAttribute('hidden', '');
  resultsEl.innerHTML = '';

  // Estado por fuente (para mostrar qué funcionó/falló)
  const status = {
    mc: { count: 0, error: null },
    ad: { count: 0, error: null },
  };

  // Lanzar peticiones en paralelo
  const tasks = [];

  if (keys.mc) {
    tasks.push(
      fetchMarketCheck(keys.mc)
        .then((r)  => { status.mc.count = r.length; return r; })
        .catch((e) => { status.mc.error = e.message; return []; })
    );
  }

  if (keys.ad) {
    tasks.push(
      fetchAutoDev(keys.ad)
        .then((r)  => { status.ad.count = r.length; return r; })
        .catch((e) => { status.ad.error = e.message; return []; })
    );
  }

  const allBatches  = await Promise.all(tasks);
  const allCars     = allBatches.flat();

  // Deduplicar por VIN
  const seen   = new Set();
  const unique = allCars.filter((car) => {
    if (!car.vin) return true;
    if (seen.has(car.vin)) return false;
    seen.add(car.vin);
    return true;
  });

  // Ordenar: con precio primero (asc), sin precio al final
  const withPrice = unique.filter((c) => c.price  != null && c.price > 0);
  const noPrice   = unique.filter((c) => c.price === null || c.price <= 0);
  withPrice.sort((a, b) => a.price - b.price);
  const sorted = [...withPrice, ...noPrice];

  // Actualizar UI
  loadingEl.setAttribute('hidden', '');
  btnSearch.disabled    = false;
  btnSearch.textContent = '🔍 Search';
  isSearching           = false;

  if (sorted.length === 0) {
    const errors = [status.mc.error, status.ad.error].filter(Boolean);
    if (errors.length) {
      errorEl.textContent = errors.join(' | ');
      errorEl.removeAttribute('hidden');
    } else {
      emptyEl.removeAttribute('hidden');
    }
    return;
  }

  allSorted = sorted;
  document.getElementById('filter-bar').removeAttribute('hidden');
  renderPage(1);
}

// ─────────────────────────────────────────────────────
// FILTROS Y PAGINACIÓN
// ─────────────────────────────────────────────────────

function getFilters() {
  return {
    priceMax:   parseFloat(document.getElementById('filter-price-max').value)   || Infinity,
    mileageMax: parseFloat(document.getElementById('filter-mileage-max').value) || Infinity,
    trans:      document.getElementById('filter-trans').value.toLowerCase(),
  };
}

function applyFilters(cars, filters) {
  const favs = showFavsOnly ? getFavorites() : null;
  return cars.filter((car) => {
    if (favs && (!car.vin || !favs.has(car.vin)))                                    return false;
    if (car.price   != null && car.price   > 0 && car.price   > filters.priceMax)   return false;
    if (car.mileage != null && car.mileage > 0 && car.mileage > filters.mileageMax) return false;
    if (filters.trans && car.trans && !car.trans.toLowerCase().includes(filters.trans)) return false;
    return true;
  });
}

function clearFilters() {
  document.getElementById('filter-price-max').value   = '';
  document.getElementById('filter-mileage-max').value = '';
  document.getElementById('filter-trans').value       = '';
  showFavsOnly = false;
  const btn = document.getElementById('filter-favs-btn');
  btn.classList.remove('active');
  btn.textContent = '♥ Favorites';
  renderPage(1);
}

function renderPage(page) {
  const statsEl   = document.getElementById('stats-bar');
  const resultsEl = document.getElementById('results');
  const emptyEl   = document.getElementById('empty-state');
  const paginEl   = document.getElementById('pagination');

  const filters  = getFilters();
  const filtered = applyFilters(allSorted, filters);
  const total    = filtered.length;

  if (total === 0) {
    statsEl.setAttribute('hidden', '');
    emptyEl.removeAttribute('hidden');
    paginEl.setAttribute('hidden', '');
    resultsEl.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  currentPage = Math.min(Math.max(page, 1), totalPages);

  const start     = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  emptyEl.setAttribute('hidden', '');

  const showing = total > PAGE_SIZE
    ? `${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total}`
    : `${total}`;
  statsEl.innerHTML = `
    <strong>${showing}</strong> vehicle${total !== 1 ? 's' : ''}
    &nbsp;·&nbsp; sorted by price (lowest first)
  `;
  statsEl.removeAttribute('hidden');

  resultsEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  pageItems.forEach((car) => fragment.appendChild(createCard(car)));
  resultsEl.appendChild(fragment);

  renderPagination(currentPage, totalPages);

}

function getPaginationRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const range = new Set([1, total]);
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) {
    range.add(i);
  }

  const sorted = [...range].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push('…');
    result.push(p);
    prev = p;
  }
  return result;
}

function renderPagination(current, total) {
  const el = document.getElementById('pagination');
  if (total <= 1) { el.setAttribute('hidden', ''); return; }

  el.innerHTML = '';
  el.removeAttribute('hidden');

  for (const item of getPaginationRange(current, total)) {
    if (item === '…') {
      const dots = document.createElement('span');
      dots.className   = 'page-dots';
      dots.textContent = '…';
      el.appendChild(dots);
    } else {
      const btn = document.createElement('button');
      btn.className   = item === current ? 'page-num active' : 'page-num';
      btn.textContent = item;
      if (item !== current) btn.onclick = () => renderPage(item);
      el.appendChild(btn);
    }
  }
}

// ─────────────────────────────────────────────────────
// ESTADO DE FUENTES
// ─────────────────────────────────────────────────────

function renderSourceStatus(status, keys, el) {
  const items = [];

  if (keys.mc) {
    items.push(
      status.mc.error
        ? `<span class="status-item">❌ <strong>MarketCheck:</strong> ${status.mc.error}</span>`
        : `<span class="status-item">✅ <strong>MarketCheck:</strong> ${status.mc.count} results</span>`
    );
  }

  if (keys.ad) {
    items.push(
      status.ad.error
        ? `<span class="status-item">❌ <strong>Auto.dev:</strong> ${status.ad.error}</span>`
        : `<span class="status-item">✅ <strong>Auto.dev:</strong> ${status.ad.count} results</span>`
    );
  }

  if (items.length) {
    el.innerHTML = items.join('');
    el.removeAttribute('hidden');
  }
}

// ─────────────────────────────────────────────────────
// CREAR CARD (DOM seguro, sin innerHTML con datos externos)
// ─────────────────────────────────────────────────────

function createCard(car) {
  const a   = document.createElement('a');
  a.className = car.url ? 'card' : 'card card-no-link';
  if (car.url) {
    a.href   = car.url;
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
  }
  a.setAttribute('aria-label', `View ${car.year} ${car.make} ${car.model}`);

  // ── Imagen ──────────────────────────────────────────
  const imgWrap = document.createElement('div');
  imgWrap.className = 'card-img-wrap';

  if (car.image) {
    const img = document.createElement('img');
    img.className = 'card-img';
    img.src       = car.image;
    img.alt       = `${car.year} ${car.make} ${car.model}`;
    img.loading   = 'lazy';
    img.addEventListener('error', () => {
      imgWrap.replaceChild(noImgPlaceholder(), img);
    });
    imgWrap.appendChild(img);
  } else {
    imgWrap.appendChild(noImgPlaceholder());
  }

  // Heart button
  if (car.vin) {
    const favs  = getFavorites();
    const heart = document.createElement('button');
    heart.className   = favs.has(car.vin) ? 'heart-btn active' : 'heart-btn';
    heart.textContent = '♥';
    heart.setAttribute('aria-label', favs.has(car.vin) ? 'Remove from favorites' : 'Add to favorites');
    heart.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const updated = toggleFavorite(car.vin);
      heart.classList.toggle('active', updated.has(car.vin));
      heart.setAttribute('aria-label', updated.has(car.vin) ? 'Remove from favorites' : 'Add to favorites');
    });
    imgWrap.appendChild(heart);
  }

  // ── Cuerpo ──────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'card-body';

  // Título
  const title = document.createElement('h3');
  title.className   = 'card-title';
  title.textContent = [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ');

  // Precio
  const priceEl = document.createElement('div');
  if (car.price) {
    priceEl.className   = 'card-price';
    priceEl.textContent = `$${car.price.toLocaleString('en-US')}`;
  } else {
    priceEl.className   = 'card-price-na';
    priceEl.textContent = 'Price not available';
  }

  // Meta
  const meta = document.createElement('div');
  meta.className = 'card-meta';

  const metaItems = [
    { icon: '⛽', label: 'Fuel',         value: car.fuelType },
    { icon: '🛣️',  label: 'Mileage',     value: car.mileage ? `${Number(car.mileage).toLocaleString('en-US')} mi` : null },
    { icon: '📍',  label: 'Location',    value: car.location },
    { icon: '⚙️',  label: 'Transmission',value: car.trans },
    { icon: '🎨',  label: 'Color',       value: car.color },
    { icon: '🏪',  label: 'Dealer',      value: car.dealer },
  ];

  metaItems.forEach(({ icon, label, value }) => {
    if (!value) return;
    const row = document.createElement('div');
    row.className = 'meta-row';

    const iconSpan = document.createElement('span');
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = icon;

    const labelSpan = document.createElement('strong');
    labelSpan.textContent = `${label}:`;

    const valueSpan = document.createElement('span');
    valueSpan.textContent = value;

    row.appendChild(iconSpan);
    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    meta.appendChild(row);
  });

  body.appendChild(title);
  body.appendChild(priceEl);
  body.appendChild(meta);

  if (car.url) {
    const footer = document.createElement('div');
    footer.className = 'card-footer';
    const link = document.createElement('span');
    link.className   = 'view-link';
    link.textContent = 'View full listing →';
    footer.appendChild(link);
    body.appendChild(footer);
  }

  a.appendChild(imgWrap);
  a.appendChild(body);

  return a;
}

function noImgPlaceholder() {
  const div = document.createElement('div');
  div.className = 'card-no-img';
  div.setAttribute('aria-label', 'No image available');
  return div;
}

// ─────────────────────────────────────────────────────
// INICIO
// ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const keys = getKeys();
  if (!keys.mc && !keys.ad) {
    // Primera vez: muestra el modal de configuración
    openSettings();
  } else {
    // Ya tiene keys: oculta el modal
    document.getElementById('modal-overlay').setAttribute('hidden', '');
  }
});
