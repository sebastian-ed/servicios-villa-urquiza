const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80';

const state = {
  supabase: null,
  session: null,
  profile: null,
  categories: [],
  providers: [],
  reviews: [],
  selectedProvider: null,
};

const el = {
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  sortSelect: document.getElementById('sortSelect'),
  providersGrid: document.getElementById('providersGrid'),
  emptyState: document.getElementById('emptyState'),
  providersCount: document.getElementById('providersCount'),
  categoriesCount: document.getElementById('categoriesCount'),
  reviewsCount: document.getElementById('reviewsCount'),
  providerModal: document.getElementById('providerModal'),
  providerDetail: document.getElementById('providerDetail'),
  adminModal: document.getElementById('adminModal'),
  openAdminBtn: document.getElementById('openAdminBtn'),
  adminLoginForm: document.getElementById('adminLoginForm'),
  adminLoginView: document.getElementById('adminLoginView'),
  adminDashboardView: document.getElementById('adminDashboardView'),
  logoutBtn: document.getElementById('logoutBtn'),
  providerCardTemplate: document.getElementById('providerCardTemplate'),
  providerForm: document.getElementById('providerForm'),
  providerId: document.getElementById('providerId'),
  providerName: document.getElementById('providerName'),
  providerShortDescription: document.getElementById('providerShortDescription'),
  providerDescription: document.getElementById('providerDescription'),
  providerAddress: document.getElementById('providerAddress'),
  providerNeighborhood: document.getElementById('providerNeighborhood'),
  providerWhatsapp: document.getElementById('providerWhatsapp'),
  providerEmail: document.getElementById('providerEmail'),
  providerWebsite: document.getElementById('providerWebsite'),
  providerImage: document.getElementById('providerImage'),
  providerCategories: document.getElementById('providerCategories'),
  providerActive: document.getElementById('providerActive'),
  resetProviderBtn: document.getElementById('resetProviderBtn'),
  providersTableBody: document.getElementById('providersTableBody'),
  categoryForm: document.getElementById('categoryForm'),
  categoryId: document.getElementById('categoryId'),
  categoryName: document.getElementById('categoryName'),
  resetCategoryBtn: document.getElementById('resetCategoryBtn'),
  categoriesTableBody: document.getElementById('categoriesTableBody'),
  reviewsTableBody: document.getElementById('reviewsTableBody'),
  tabButtons: [...document.querySelectorAll('.tab-btn')],
  tabPanes: [...document.querySelectorAll('.tab-pane')],
};

function slugify(text = '') {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function whatsappLink(number, providerName) {
  const clean = String(number || '').replace(/\D/g, '');
  if (!clean) return '';
  const message = encodeURIComponent(`Hola, vi tu perfil de ${providerName} en Servicios Villa Urquiza y quiero consultar.`);
  return `https://wa.me/${clean}?text=${message}`;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'message-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

function isAdmin() {
  return state.profile?.role === 'admin';
}

function setLoadingButton(button, isLoading, label = 'Guardando...') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function selectedCategoryIds() {
  return [...el.providerCategories.selectedOptions].map(option => option.value);
}

function providerAverage(providerId) {
  const approved = state.reviews.filter(r => r.provider_id === providerId && r.status === 'approved');
  if (!approved.length) return { avg: 0, count: 0 };
  const total = approved.reduce((acc, item) => acc + Number(item.rating || 0), 0);
  return { avg: total / approved.length, count: approved.length };
}

function providerCategories(providerId) {
  const provider = state.providers.find(item => item.id === providerId);
  return provider?.provider_categories?.map(item => item.categories).filter(Boolean) || [];
}

async function initSupabase() {
  if (!window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_ANON_KEY) {
    showConfigWarning();
    return false;
  }
  state.supabase = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true } }
  );
  const { data } = await state.supabase.auth.getSession();
  state.session = data.session;
  await resolveProfile();
  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    await resolveProfile();
    updateAdminUI();
    if (isAdmin()) {
      await refreshAdminData();
    }
  });
  return true;
}

function showConfigWarning() {
  el.providersGrid.innerHTML = `
    <div class="card empty-state">
      <h2>Falta configurar Supabase</h2>
      <p>Copiá <code>config.example.js</code> a <code>config.js</code> y cargá tu URL y anon key del proyecto.</p>
    </div>
  `;
}

async function resolveProfile() {
  state.profile = null;
  if (!state.session?.user) return;
  const { data, error } = await state.supabase
    .from('profiles')
    .select('*')
    .eq('id', state.session.user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }
  state.profile = data;
}

async function fetchPublicData() {
  const [{ data: categories, error: categoriesError }, { data: providers, error: providersError }, { data: reviews, error: reviewsError }] = await Promise.all([
    state.supabase.from('categories').select('*').order('name'),
    state.supabase
      .from('providers')
      .select(`
        *,
        provider_categories (
          category_id,
          categories (*)
        )
      `)
      .eq('is_active', true)
      .eq('approved', true)
      .order('created_at', { ascending: false }),
    state.supabase
      .from('reviews')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false }),
  ]);

  if (categoriesError || providersError || reviewsError) {
    console.error(categoriesError || providersError || reviewsError);
    showToast('Error al cargar datos públicos.');
    return;
  }

  state.categories = categories || [];
  state.providers = providers || [];
  state.reviews = reviews || [];
  renderFilters();
  renderStats();
  renderProviders();
}

async function refreshAdminData() {
  if (!isAdmin()) return;
  const [{ data: providers }, { data: reviews }] = await Promise.all([
    state.supabase
      .from('providers')
      .select(`
        *,
        provider_categories (
          category_id,
          categories (*)
        )
      `)
      .order('created_at', { ascending: false }),
    state.supabase
      .from('reviews')
      .select(`
        *,
        providers (id, name)
      `)
      .order('created_at', { ascending: false }),
  ]);

  if (providers) state.providers = providers;
  if (reviews) state.reviews = reviews;
  renderProvidersTable();
  renderReviewsTable();
  populateProviderCategorySelect();
}

function renderFilters() {
  el.categoryFilter.innerHTML = '<option value="">Todas</option>';
  state.categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category.slug;
    option.textContent = category.name;
    el.categoryFilter.appendChild(option);
  });
  populateProviderCategorySelect();
  renderCategoriesTable();
}

function populateProviderCategorySelect() {
  el.providerCategories.innerHTML = '';
  state.categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    el.providerCategories.appendChild(option);
  });
}

function renderStats() {
  el.providersCount.textContent = state.providers.filter(p => p.is_active && p.approved).length;
  el.categoriesCount.textContent = state.categories.length;
  el.reviewsCount.textContent = state.reviews.filter(r => r.status === 'approved').length;
}

function filterProviders() {
  const search = el.searchInput.value.trim().toLowerCase();
  const category = el.categoryFilter.value;
  const sort = el.sortSelect.value;

  let filtered = [...state.providers].filter(provider => provider.is_active && provider.approved);

  if (search) {
    filtered = filtered.filter(provider => {
      const categoriesText = providerCategories(provider.id).map(item => item.name).join(' ');
      return [provider.name, provider.short_description, provider.description, provider.neighborhood, provider.address, categoriesText]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
  }

  if (category) {
    filtered = filtered.filter(provider => providerCategories(provider.id).some(item => item.slug === category));
  }

  if (sort === 'name_asc') {
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  } else if (sort === 'newest') {
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else {
    filtered.sort((a, b) => providerAverage(b.id).avg - providerAverage(a.id).avg || a.name.localeCompare(b.name, 'es'));
  }

  return filtered;
}

function renderProviders() {
  const items = filterProviders();
  el.providersGrid.innerHTML = '';

  if (!items.length) {
    el.emptyState.classList.remove('hidden');
    return;
  }

  el.emptyState.classList.add('hidden');

  items.forEach(provider => {
    const fragment = el.providerCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.provider-card');
    const image = fragment.querySelector('.provider-image');
    const name = fragment.querySelector('.provider-name');
    const rating = fragment.querySelector('.rating-chip');
    const short = fragment.querySelector('.provider-short');
    const chips = fragment.querySelector('.chip-row');
    const detailsBtn = fragment.querySelector('.details-btn');
    const whatsappBtn = fragment.querySelector('.whatsapp-btn');
    const avg = providerAverage(provider.id);

    image.src = provider.image_url || FALLBACK_IMAGE;
    image.alt = provider.name;
    name.textContent = provider.name;
    rating.textContent = avg.count ? `★ ${avg.avg.toFixed(1)} (${avg.count})` : 'Sin reseñas';
    short.textContent = provider.short_description || 'Sin descripción breve.';

    providerCategories(provider.id).forEach(category => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = category.name;
      chips.appendChild(chip);
    });

    detailsBtn.addEventListener('click', () => openProviderDetail(provider.id));

    const wa = whatsappLink(provider.whatsapp, provider.name);
    if (wa) {
      whatsappBtn.href = wa;
    } else {
      whatsappBtn.removeAttribute('href');
      whatsappBtn.setAttribute('aria-disabled', 'true');
      whatsappBtn.textContent = 'Sin WhatsApp';
    }

    card.dataset.providerId = provider.id;
    el.providersGrid.appendChild(fragment);
  });
}

function renderProviderDetail(providerId) {
  const provider = state.providers.find(item => item.id === providerId);
  if (!provider) return;
  const avg = providerAverage(providerId);
  const categories = providerCategories(providerId);
  const providerReviews = state.reviews.filter(item => item.provider_id === providerId && item.status === 'approved');
  const wa = whatsappLink(provider.whatsapp, provider.name);

  el.providerDetail.innerHTML = `
    <div class="provider-detail-grid">
      <div>
        <img class="provider-detail-image" src="${escapeHtml(provider.image_url || FALLBACK_IMAGE)}" alt="${escapeHtml(provider.name)}">
      </div>
      <div class="provider-detail-body">
        <h2>${escapeHtml(provider.name)}</h2>
        <p>${escapeHtml(provider.description || provider.short_description || '')}</p>
        <div class="provider-meta">
          <span class="rating-chip">${avg.count ? `★ ${avg.avg.toFixed(1)} (${avg.count} reseñas)` : 'Sin reseñas aprobadas'}</span>
          ${categories.map(category => `<span class="chip">${escapeHtml(category.name)}</span>`).join('')}
          ${provider.neighborhood ? `<span class="chip">${escapeHtml(provider.neighborhood)}</span>` : ''}
        </div>
        <div class="contact-row">
          ${wa ? `<a class="btn btn-primary" href="${wa}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}
          ${provider.email ? `<a class="btn btn-secondary" href="mailto:${escapeHtml(provider.email)}">Email</a>` : ''}
          ${provider.website ? `<a class="btn btn-secondary" href="${escapeHtml(provider.website)}" target="_blank" rel="noopener noreferrer">Sitio web</a>` : ''}
        </div>
        <div class="links-row muted">
          ${provider.address ? `<span>Dirección: ${escapeHtml(provider.address)}</span>` : ''}
        </div>
      </div>
    </div>

    <section class="review-block">
      <div>
        <h3>Reseñas</h3>
        <p class="muted">Las reseñas nuevas quedan pendientes de aprobación. Sin moderación, esto se convierte en un paredón digital, no en una vidriera.</p>
      </div>
      <div>
        ${providerReviews.length ? providerReviews.map(review => `
          <article class="review-item">
            <div class="review-head">
              <strong>${escapeHtml(review.author_name)}</strong>
              <span class="rating-chip">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
            </div>
            <small class="muted">${formatDate(review.created_at)}</small>
            <p>${escapeHtml(review.comment)}</p>
          </article>
        `).join('') : '<div class="card empty-state"><p>Todavía no hay reseñas aprobadas para este proveedor.</p></div>'}
      </div>
      <form id="reviewForm" class="card form-grid">
        <input type="hidden" name="provider_id" value="${provider.id}">
        <div class="field">
          <label for="reviewAuthor">Tu nombre</label>
          <input id="reviewAuthor" name="author_name" required>
        </div>
        <div class="field">
          <label for="reviewEmail">Tu email</label>
          <input id="reviewEmail" name="author_email" type="email" required>
        </div>
        <div class="field">
          <label for="reviewRating">Calificación</label>
          <select id="reviewRating" name="rating" required>
            <option value="">Seleccionar</option>
            <option value="5">5 - Excelente</option>
            <option value="4">4 - Muy bueno</option>
            <option value="3">3 - Bueno</option>
            <option value="2">2 - Regular</option>
            <option value="1">1 - Malo</option>
          </select>
        </div>
        <div class="field full-span">
          <label for="reviewComment">Reseña</label>
          <textarea id="reviewComment" name="comment" rows="4" minlength="10" required></textarea>
        </div>
        <div class="actions full-span">
          <button type="submit" class="btn btn-primary">Enviar reseña</button>
        </div>
      </form>
    </section>
  `;

  el.providerDetail.querySelector('#reviewForm').addEventListener('submit', handleReviewSubmit);
}

async function openProviderDetail(providerId) {
  renderProviderDetail(providerId);
  openModal(el.providerModal);
}

function renderProvidersTable() {
  if (!isAdmin()) return;
  el.providersTableBody.innerHTML = '';
  state.providers.forEach(provider => {
    const tr = document.createElement('tr');
    const categories = providerCategories(provider.id).map(item => item.name).join(', ') || '-';
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(provider.name)}</strong><br>
        <small class="muted">${escapeHtml(provider.short_description || '')}</small>
      </td>
      <td>${escapeHtml(categories)}</td>
      <td>${escapeHtml(provider.whatsapp || provider.email || '-')}</td>
      <td><span class="status-pill ${provider.is_active ? 'status-active' : 'status-inactive'}">${provider.is_active ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" data-action="edit-provider" data-id="${provider.id}">Editar</button>
          <button class="btn btn-danger btn-sm" data-action="toggle-provider" data-id="${provider.id}">${provider.is_active ? 'Desactivar' : 'Activar'}</button>
        </div>
      </td>
    `;
    el.providersTableBody.appendChild(tr);
  });
}

function renderCategoriesTable() {
  el.categoriesTableBody.innerHTML = '';
  state.categories.forEach(category => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(category.name)}</td>
      <td>${escapeHtml(category.slug)}</td>
      <td>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" data-action="edit-category" data-id="${category.id}">Editar</button>
          <button class="btn btn-danger btn-sm" data-action="delete-category" data-id="${category.id}">Eliminar</button>
        </div>
      </td>
    `;
    el.categoriesTableBody.appendChild(tr);
  });
}

function renderReviewsTable() {
  if (!isAdmin()) return;
  el.reviewsTableBody.innerHTML = '';
  state.reviews.forEach(review => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(review.providers?.name || state.providers.find(p => p.id === review.provider_id)?.name || '-')}</td>
      <td>${escapeHtml(review.author_name)}</td>
      <td>${escapeHtml(String(review.rating))}</td>
      <td>${escapeHtml(review.comment)}</td>
      <td><span class="status-pill status-${escapeHtml(review.status)}">${escapeHtml(review.status)}</span></td>
      <td>
        <div class="actions">
          ${review.status !== 'approved' ? `<button class="btn btn-success btn-sm" data-action="approve-review" data-id="${review.id}">Aprobar</button>` : ''}
          ${review.status !== 'rejected' ? `<button class="btn btn-danger btn-sm" data-action="reject-review" data-id="${review.id}">Rechazar</button>` : ''}
        </div>
      </td>
    `;
    el.reviewsTableBody.appendChild(tr);
  });
}

function resetProviderForm() {
  el.providerForm.reset();
  el.providerId.value = '';
  el.providerNeighborhood.value = 'Villa Urquiza';
  el.providerActive.checked = true;
  [...el.providerCategories.options].forEach(option => option.selected = false);
}

function resetCategoryForm() {
  el.categoryForm.reset();
  el.categoryId.value = '';
}

function fillProviderForm(providerId) {
  const provider = state.providers.find(item => item.id === providerId);
  if (!provider) return;
  el.providerId.value = provider.id;
  el.providerName.value = provider.name || '';
  el.providerShortDescription.value = provider.short_description || '';
  el.providerDescription.value = provider.description || '';
  el.providerAddress.value = provider.address || '';
  el.providerNeighborhood.value = provider.neighborhood || 'Villa Urquiza';
  el.providerWhatsapp.value = provider.whatsapp || '';
  el.providerEmail.value = provider.email || '';
  el.providerWebsite.value = provider.website || '';
  el.providerImage.value = provider.image_url || '';
  el.providerActive.checked = Boolean(provider.is_active);
  const selectedIds = provider.provider_categories?.map(item => item.category_id) || [];
  [...el.providerCategories.options].forEach(option => {
    option.selected = selectedIds.includes(option.value);
  });
  activateTab('providersTab');
}

function fillCategoryForm(categoryId) {
  const category = state.categories.find(item => item.id === categoryId);
  if (!category) return;
  el.categoryId.value = category.id;
  el.categoryName.value = category.name;
  activateTab('categoriesTab');
}

function updateAdminUI() {
  const admin = isAdmin();
  el.adminLoginView.classList.toggle('hidden', admin);
  el.adminDashboardView.classList.toggle('hidden', !admin);
}

function activateTab(id) {
  el.tabButtons.forEach(button => button.classList.toggle('active', button.dataset.tab === id));
  el.tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === id));
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  setLoadingButton(submitButton, true, 'Ingresando...');

  const { error } = await state.supabase.auth.signInWithPassword({
    email: form.get('email'),
    password: form.get('password'),
  });

  setLoadingButton(submitButton, false);

  if (error) {
    showToast(error.message);
    return;
  }

  await resolveProfile();
  if (!isAdmin()) {
    await state.supabase.auth.signOut();
    showToast('Ese usuario no tiene rol admin.');
    return;
  }

  updateAdminUI();
  await refreshAdminData();
  showToast('Sesión iniciada.');
}

async function handleLogout() {
  await state.supabase.auth.signOut();
  state.profile = null;
  updateAdminUI();
  showToast('Sesión cerrada.');
}

async function handleProviderSubmit(event) {
  event.preventDefault();
  if (!isAdmin()) return;
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  setLoadingButton(submitButton, true);

  const payload = {
    name: el.providerName.value.trim(),
    short_description: el.providerShortDescription.value.trim(),
    description: el.providerDescription.value.trim(),
    address: el.providerAddress.value.trim() || null,
    neighborhood: el.providerNeighborhood.value.trim() || 'Villa Urquiza',
    whatsapp: el.providerWhatsapp.value.trim() || null,
    email: el.providerEmail.value.trim() || null,
    website: el.providerWebsite.value.trim() || null,
    image_url: el.providerImage.value.trim() || null,
    is_active: el.providerActive.checked,
    approved: true,
  };

  let providerId = el.providerId.value;
  let response;

  if (providerId) {
    response = await state.supabase
      .from('providers')
      .update(payload)
      .eq('id', providerId)
      .select('id')
      .single();
  } else {
    response = await state.supabase
      .from('providers')
      .insert({ ...payload, created_by: state.profile.id })
      .select('id')
      .single();
    providerId = response.data?.id;
  }

  if (response.error) {
    console.error(response.error);
    setLoadingButton(submitButton, false);
    showToast('No se pudo guardar el proveedor.');
    return;
  }

  const selectedIds = selectedCategoryIds();
  await state.supabase.from('provider_categories').delete().eq('provider_id', providerId);
  if (selectedIds.length) {
    const { error: relationError } = await state.supabase.from('provider_categories').insert(
      selectedIds.map(categoryId => ({ provider_id: providerId, category_id: categoryId }))
    );
    if (relationError) {
      console.error(relationError);
      showToast('Proveedor guardado, pero hubo un problema con las categorías.');
    }
  }

  resetProviderForm();
  await fetchPublicData();
  await refreshAdminData();
  setLoadingButton(submitButton, false);
  showToast('Proveedor guardado.');
}

async function handleCategorySubmit(event) {
  event.preventDefault();
  if (!isAdmin()) return;
  const name = el.categoryName.value.trim();
  if (!name) return;
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  setLoadingButton(submitButton, true);

  const payload = { name, slug: slugify(name) };
  let result;
  if (el.categoryId.value) {
    result = await state.supabase.from('categories').update(payload).eq('id', el.categoryId.value);
  } else {
    result = await state.supabase.from('categories').insert(payload);
  }

  setLoadingButton(submitButton, false);

  if (result.error) {
    console.error(result.error);
    showToast('No se pudo guardar la categoría.');
    return;
  }

  resetCategoryForm();
  await fetchPublicData();
  await refreshAdminData();
  showToast('Categoría guardada.');
}

async function handleReviewSubmit(event) {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  setLoadingButton(submitButton, true, 'Enviando...');
  const form = new FormData(event.currentTarget);

  const payload = {
    provider_id: form.get('provider_id'),
    author_name: String(form.get('author_name') || '').trim(),
    author_email: String(form.get('author_email') || '').trim(),
    rating: Number(form.get('rating')),
    comment: String(form.get('comment') || '').trim(),
  };

  const { error } = await state.supabase.from('reviews').insert(payload);
  setLoadingButton(submitButton, false);

  if (error) {
    console.error(error);
    showToast('No se pudo enviar la reseña.');
    return;
  }

  event.currentTarget.reset();
  showToast('Reseña enviada. Quedó pendiente de aprobación.');
}

async function toggleProvider(providerId) {
  const provider = state.providers.find(item => item.id === providerId);
  if (!provider) return;
  const { error } = await state.supabase.from('providers').update({ is_active: !provider.is_active }).eq('id', providerId);
  if (error) {
    console.error(error);
    showToast('No se pudo actualizar el estado.');
    return;
  }
  await fetchPublicData();
  await refreshAdminData();
}

async function updateReviewStatus(reviewId, status) {
  const { error } = await state.supabase.from('reviews').update({ status }).eq('id', reviewId);
  if (error) {
    console.error(error);
    showToast('No se pudo actualizar la reseña.');
    return;
  }
  await fetchPublicData();
  await refreshAdminData();
}

async function deleteCategory(categoryId) {
  const inUse = state.providers.some(provider => provider.provider_categories?.some(item => item.category_id === categoryId));
  if (inUse) {
    showToast('No podés borrar una categoría que ya está asociada a proveedores.');
    return;
  }
  const { error } = await state.supabase.from('categories').delete().eq('id', categoryId);
  if (error) {
    console.error(error);
    showToast('No se pudo eliminar la categoría.');
    return;
  }
  await fetchPublicData();
  await refreshAdminData();
}

function bindEvents() {
  el.searchInput.addEventListener('input', renderProviders);
  el.categoryFilter.addEventListener('change', renderProviders);
  el.sortSelect.addEventListener('change', renderProviders);
  el.openAdminBtn.addEventListener('click', () => openModal(el.adminModal));
  el.adminLoginForm.addEventListener('submit', handleAdminLogin);
  el.logoutBtn.addEventListener('click', handleLogout);
  el.providerForm.addEventListener('submit', handleProviderSubmit);
  el.categoryForm.addEventListener('submit', handleCategorySubmit);
  el.resetProviderBtn.addEventListener('click', resetProviderForm);
  el.resetCategoryBtn.addEventListener('click', resetCategoryForm);

  document.addEventListener('click', event => {
    const closeTarget = event.target.closest('[data-close]');
    if (closeTarget) {
      closeModal(document.getElementById(closeTarget.dataset.close));
      return;
    }

    const tabButton = event.target.closest('.tab-btn');
    if (tabButton) {
      activateTab(tabButton.dataset.tab);
      return;
    }

    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const { action, id } = actionButton.dataset;
    if (action === 'edit-provider') fillProviderForm(id);
    if (action === 'toggle-provider') toggleProvider(id);
    if (action === 'edit-category') fillCategoryForm(id);
    if (action === 'delete-category') deleteCategory(id);
    if (action === 'approve-review') updateReviewStatus(id, 'approved');
    if (action === 'reject-review') updateReviewStatus(id, 'rejected');
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal(el.providerModal);
      closeModal(el.adminModal);
    }
  });
}

async function bootstrap() {
  bindEvents();
  const ok = await initSupabase();
  if (!ok) return;
  updateAdminUI();
  await fetchPublicData();
  if (isAdmin()) {
    await refreshAdminData();
  }
}

bootstrap();
