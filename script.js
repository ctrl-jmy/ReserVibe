(function() {
  if (window.__reservibeScriptLoaded) return;
  window.__reservibeScriptLoaded = true;

  // ==================== BOOKING CONFIRMATION EMAILS (EmailJS) ====================
  const EMAILJS_PUBLIC_KEY = "6uca9VWSS7LtVc38X";
  const EMAILJS_SERVICE_ID = "service_73aqg3t";
  const EMAILJS_TEMPLATE_ID = "template_his3t8x";

  if (EMAILJS_PUBLIC_KEY) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    console.log("EmailJS initialized – booking confirmations will be sent.");
  } else {
    console.warn("EmailJS not configured. Booking emails disabled.");
  }

  // ==================== PASSWORD RESET EMAILS (Supabase Auth) ====================
  // Password reset uses supabase.auth.resetPasswordForEmail().
  // It sends emails via Supabase's built‑in or custom SMTP.
  // No EmailJS configuration needed for that.

  if (!window.supabaseClient) {
    const SUPABASE_URL = 'https://fsfctwfhecwdmwsgttan.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZmN0d2ZoZWN3ZG13c2d0dGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDU3NTcsImV4cCI6MjA5NTgyMTc1N30.qL8YSHl5Q5D5EX1oQxzqg5hwSPvyOZb2EX7vlt2wqu0';
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  const supabase = window.supabaseClient;

  const MAX_PER_DAY = 5;

  // DOM elements (original)
  const authContainer = document.getElementById('auth-container');
  const appContainer = document.getElementById('app-container');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const forgotForm = document.getElementById('forgot-form');
  const showRegisterLink = document.getElementById('show-register-link');
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  const backToLoginFromReset = document.getElementById('back-to-login-from-reset');
  const backToLoginFromRegister = document.getElementById('back-to-login-from-register');
  const logoutBtn = document.getElementById('logout-btn');
  const dashboardDiv = document.getElementById('dashboard-view');
  const bookingDiv = document.getElementById('booking-view');      // new
  const aboutDiv = document.getElementById('about-view');          // new
  const bookingsListDiv = document.getElementById('bookings-list');
  const bookingForm = document.getElementById('booking-form');
  const cancelBtn = document.getElementById('cancel-form');
  const roleBadge = document.getElementById('role-badge');
  const navDashboard = document.getElementById('nav-dashboard');
  const navBooking = document.getElementById('nav-booking');       // new
  const navAbout = document.getElementById('nav-about');           // new
  const calendarContainer = document.getElementById('calendar-container');
  const totalBookingsSpan = document.getElementById('total-bookings');
  const fullDaysSpan = document.getElementById('full-days');
  const availableDaysSpan = document.getElementById('available-days');

  let currentUser = null;
  let userRole = null;
  let realtimeSubscription = null;
  let allBookings = [];
  let currentCalendarYear = new Date().getFullYear();
  let currentCalendarMonth = new Date().getMonth();

  function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.style.background = isError ? '#fee2e2' : 'white';
    toast.style.color = isError ? '#b91c1c' : '#4c1d95';
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  async function loadAboutSection() {
    // This function is no longer needed because the About view is now separate.
    // We'll keep it empty or remove it.
  }

  async function ensureProfile() {
    if (!currentUser) return false;
    const { data, error } = await supabase.from('profiles').select('id').eq('id', currentUser.id).single();
    if (error && error.code === 'PGRST116') {
      const { error: insertError } = await supabase.from('profiles').insert([{ id: currentUser.id, email: currentUser.email, role: 'user' }]);
      if (insertError) { console.error(insertError); return false; }
      return true;
    }
    return !error;
  }

  async function fetchAllBookings() {
    let query = supabase.from('bookings').select('*');
    if (userRole !== 'admin') query = query.eq('user_id', currentUser.id);
    const { data, error } = await query;
    if (!error) allBookings = data;
    updateStats();
  }

  function updateStats() {
    if (!totalBookingsSpan) return;
    const total = allBookings.length;
    totalBookingsSpan.innerText = total;
    const counts = {};
    allBookings.forEach(b => { counts[b.booking_date] = (counts[b.booking_date] || 0) + 1; });
    const fullDaysCount = Object.values(counts).filter(c => c >= MAX_PER_DAY).length;
    const uniqueDays = Object.keys(counts).length;
    const availableDays = uniqueDays - fullDaysCount;
    fullDaysSpan.innerText = fullDaysCount;
    availableDaysSpan.innerText = availableDays;
  }

  function renderCalendar() {
    if (!calendarContainer) return;
    const year = currentCalendarYear;
    const month = currentCalendarMonth;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    let html = `
      <div class="flex justify-between items-center mb-4">
        <button id="prev-month" class="bg-purple-200 hover:bg-purple-300 text-purple-800 px-3 py-1 rounded-full"><i class="fas fa-chevron-left"></i></button>
        <h2 class="font-serif text-xl text-purple-800">${monthNames[month]} ${year}</h2>
        <button id="next-month" class="bg-purple-200 hover:bg-purple-300 text-purple-800 px-3 py-1 rounded-full"><i class="fas fa-chevron-right"></i></button>
      </div>
      <div class="weekday-header grid grid-cols-7 gap-2 mb-2">${weekdayNames.map(d => `<div>${d}</div>`).join('')}</div>
      <div class="calendar-grid">`;
    for (let i = 0; i < startDay; i++) html += `<div></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const bookingCount = allBookings.filter(b => b.booking_date === dateStr).length;
      const isFull = bookingCount >= MAX_PER_DAY;
      html += `<div class="calendar-day ${isFull ? 'full-day' : ''}" data-date="${dateStr}">
                <div class="day-number">${d}</div>
                <div class="booking-count">📅 ${bookingCount} / ${MAX_PER_DAY}</div>
              </div>`;
    }
    html += `</div>`;
    calendarContainer.innerHTML = html;

    document.getElementById('prev-month')?.addEventListener('click', () => {
      let newMonth = currentCalendarMonth - 1;
      let newYear = currentCalendarYear;
      if (newMonth < 0) { newMonth = 11; newYear--; }
      currentCalendarYear = newYear;
      currentCalendarMonth = newMonth;
      renderCalendar();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
      let newMonth = currentCalendarMonth + 1;
      let newYear = currentCalendarYear;
      if (newMonth > 11) { newMonth = 0; newYear++; }
      currentCalendarYear = newYear;
      currentCalendarMonth = newMonth;
      renderCalendar();
    });
    document.querySelectorAll('.calendar-day[data-date]').forEach(el => {
      el.addEventListener('click', () => {
        const date = el.dataset.date;
        document.getElementById('booking-date').value = date;
        const count = allBookings.filter(b => b.booking_date === date).length;
        if (count >= MAX_PER_DAY) showToast(`⚠️ ${date} fully booked`, true);
        else showToast(`📅 ${date} – ${MAX_PER_DAY - count} slots left`, false);
        // If we are not already on booking view, switch to it
        if (bookingDiv && bookingDiv.classList.contains('hidden')) {
          dashboardDiv?.classList.add('hidden');
          bookingDiv.classList.remove('hidden');
          aboutDiv?.classList.add('hidden');
        }
      });
    });
  }

  async function sendEmailNotification(booking) {
    if (!EMAILJS_PUBLIC_KEY) {
      console.warn("EmailJS not configured – skipping email");
      return;
    }
    const templateParams = {
      to_email: booking.email,
      name: booking.name,
      date: booking.booking_date,
      time: booking.time,
      guests: booking.guests,
      service: booking.service,
      image_url: booking.image_url || "No image uploaded"
    };
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      showToast(`📧 Confirmation email sent to ${booking.email}`);
    } catch (err) {
      console.error("Email send failed", err);
      showToast("Booking saved but email could not be sent", true);
    }
  }

  async function fetchAndDisplayBookings() {
    if (!bookingsListDiv) return;
    bookingsListDiv.innerHTML = '<p class="text-purple-400 text-center py-6">Loading...</p>';
    let query = supabase.from('bookings').select('*');
    if (userRole !== 'admin') query = query.eq('user_id', currentUser.id);
    const { data, error } = await query.order('booking_date', { ascending: true });
    if (error) { showToast('Error fetching bookings', true); return; }
    if (!data.length) { bookingsListDiv.innerHTML = '<p class="text-purple-400 text-center py-6">No bookings yet.</p>'; return; }
    const tableRows = data.map(b => `<tr class="border-b border-purple-100"><td class="px-4 py-3">${escapeHtml(b.name)}</td><td class="px-4 py-3">${escapeHtml(b.email)}</td><td class="px-4 py-3">${b.booking_date}</td><td class="px-4 py-3">${b.time}</td><td class="px-4 py-3">${b.guests}</td><td class="px-4 py-3">${b.service}</td><td class="px-4 py-3">${b.image_url ? `<a href="${b.image_url}" target="_blank" class="text-purple-500 mr-2"><i class="fas fa-image"></i></a>` : ''}<button onclick="editBooking('${b.id}')" class="text-indigo-500 mr-2"><i class="fas fa-edit"></i></button><button onclick="deleteBooking('${b.id}')" class="text-rose-500"><i class="fas fa-trash-alt"></i></button></td></tr>`).join('');
    bookingsListDiv.innerHTML = `<table class="w-full"><thead class="bg-purple-50"><tr><th class="px-4 py-2 text-left">Name</th><th>Email</th><th>Date</th><th>Time</th><th>Guests</th><th>Service</th><th>Actions</th></tr></thead><tbody>${tableRows}</tbody></table>`;
  }

  function escapeHtml(str) { return str ? str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])) : ''; }

  window.editBooking = async (id) => {
    const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
    if (error) { showToast('Error loading booking', true); return; }
    document.getElementById('booking-id').value = data.id;
    document.getElementById('name').value = data.name;
    document.getElementById('email').value = data.email;
    document.getElementById('booking-date').value = data.booking_date;
    document.getElementById('time').value = data.time;
    document.getElementById('guests').value = data.guests;
    document.getElementById('service').value = data.service;
    document.getElementById('current-image').innerHTML = data.image_url ? `Current: <a href="${data.image_url}" target="_blank">View</a>` : '';
    // Switch to booking view
    if (dashboardDiv) dashboardDiv.classList.add('hidden');
    if (bookingDiv) bookingDiv.classList.remove('hidden');
    if (aboutDiv) aboutDiv.classList.add('hidden');
  };

  window.deleteBooking = async (id) => {
    if (!confirm('Delete this booking?')) return;
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) { showToast('Delete failed', true); return; }
    showToast('Booking deleted');
    await fetchAllBookings();
    renderCalendar();
    fetchAndDisplayBookings();
  };

  async function uploadImage(file) {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
    const { error, data } = await supabase.storage.from('booking_images').upload(fileName, file);
    if (error) { showToast('Image upload failed', true); return null; }
    const { data: { publicUrl } } = supabase.storage.from('booking_images').getPublicUrl(fileName);
    return publicUrl;
  }

  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('booking-id').value;
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const booking_date = document.getElementById('booking-date').value;
    const time = document.getElementById('time').value;
    const guests = parseInt(document.getElementById('guests').value);
    const service = document.getElementById('service').value;
    const imageFile = document.getElementById('image-file').files[0];
    if (!name || !email || !booking_date || !time || !guests || !service) return showToast('All fields required', true);
    if (!id) {
      const dayBookings = allBookings.filter(b => b.booking_date === booking_date).length;
      if (dayBookings >= MAX_PER_DAY) return showToast(`❌ ${booking_date} is fully booked.`, true);
    }
    const profileOk = await ensureProfile();
    if (!profileOk) return showToast('Profile error, logout and login again', true);
    let imageUrl = null;
    if (imageFile) imageUrl = await uploadImage(imageFile);
    const bookingData = { name, email, booking_date, time, guests, service, user_id: currentUser.id };
    if (imageUrl) bookingData.image_url = imageUrl;
    let error = null;
    let isNew = false;
    if (id) {
      const { error: updateErr } = await supabase.from('bookings').update(bookingData).eq('id', id);
      error = updateErr;
      if (!error) showToast('Booking updated');
    } else {
      const { error: insertErr } = await supabase.from('bookings').insert([bookingData]);
      error = insertErr;
      isNew = true;
      if (!error) showToast('Booking created');
    }
    if (error) return showToast('Operation failed: ' + error.message, true);
    resetForm();
    // After successful save, go to dashboard view
    if (dashboardDiv) dashboardDiv.classList.remove('hidden');
    if (bookingDiv) bookingDiv.classList.add('hidden');
    if (aboutDiv) aboutDiv.classList.add('hidden');
    await fetchAllBookings();
    renderCalendar();
    fetchAndDisplayBookings();
    if (isNew) await sendEmailNotification(bookingData);
  });

  function resetForm() { bookingForm.reset(); document.getElementById('booking-id').value = ''; document.getElementById('current-image').innerHTML = ''; }

  // Old switchView is no longer used – we use direct view toggling.
  // But we keep it for compatibility.
  function switchView(view) { /* not used */ }

  // Navigation handlers (override)
  function setupNavigation() {
    if (navDashboard) {
      navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        if (dashboardDiv) dashboardDiv.classList.remove('hidden');
        if (bookingDiv) bookingDiv.classList.add('hidden');
        if (aboutDiv) aboutDiv.classList.add('hidden');
      });
    }
    if (navBooking) {
      navBooking.addEventListener('click', (e) => {
        e.preventDefault();
        if (dashboardDiv) dashboardDiv.classList.add('hidden');
        if (bookingDiv) bookingDiv.classList.remove('hidden');
        if (aboutDiv) aboutDiv.classList.add('hidden');
        // Ensure calendar is rendered (it should already be)
        renderCalendar();
      });
    }
    if (navAbout) {
      navAbout.addEventListener('click', (e) => {
        e.preventDefault();
        if (dashboardDiv) dashboardDiv.classList.add('hidden');
        if (bookingDiv) bookingDiv.classList.add('hidden');
        if (aboutDiv) aboutDiv.classList.remove('hidden');
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        resetForm();
        if (dashboardDiv) dashboardDiv.classList.remove('hidden');
        if (bookingDiv) bookingDiv.classList.add('hidden');
        if (aboutDiv) aboutDiv.classList.add('hidden');
      });
    }
  }

  function subscribeToRealtime() {
    if (realtimeSubscription) realtimeSubscription.unsubscribe();
    const channel = supabase.channel('bookings-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, async () => {
      await fetchAllBookings();
      renderCalendar();
      fetchAndDisplayBookings();
      showToast('Bookings updated in realtime');
    }).subscribe();
    realtimeSubscription = channel;
  }

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      await fetchUserRole();
      showApp();
      await fetchAllBookings();
      renderCalendar();
      fetchAndDisplayBookings();
      subscribeToRealtime();
    } else { showAuth(); }
  }

  async function fetchUserRole() {
    await ensureProfile();
    const { data, error } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
    if (data) userRole = data.role;
    else userRole = 'user';
    roleBadge.innerText = `Role: ${userRole === 'admin' ? '👑 Administrator' : '👤 Regular User'}`;
  }

  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { document.getElementById('auth-error').innerText = error.message; return false; }
    return true;
  }

  async function register(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { document.getElementById('reg-error').innerText = error.message; return false; }
    if (data.user) await supabase.from('profiles').insert([{ id: data.user.id, email: data.user.email, role: 'user' }]);
    return true;
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
  }

  async function logout() {
    await supabase.auth.signOut();
    if (realtimeSubscription) realtimeSubscription.unsubscribe();
    currentUser = null;
    showAuth();
  }

  function showApp() {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    setupNavigation(); // set up view switching
    // Show dashboard by default
    if (dashboardDiv) dashboardDiv.classList.remove('hidden');
    if (bookingDiv) bookingDiv.classList.add('hidden');
    if (aboutDiv) aboutDiv.classList.add('hidden');
  }

  function showAuth() {
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    forgotForm.classList.add('hidden');
    document.getElementById('auth-error').innerText = '';
    document.getElementById('reg-error').innerText = '';
    document.getElementById('reset-error').innerText = '';
  }

  // Event listeners for auth
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const ok = await login(email, password);
    if (ok) await checkSession();
  });
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const ok = await register(email, password);
    if (ok) {
      showToast('Registration successful! Please log in.');
      showAuth();
    }
  });
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    const errorDiv = document.getElementById('reset-error');
    try {
      await resetPassword(email);
      errorDiv.innerText = '';
      showToast(`Password reset link sent to ${email}. Check your inbox.`);
      showAuth();
    } catch (err) {
      errorDiv.innerText = err.message;
    }
  });

  showRegisterLink.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    forgotForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
  });
  forgotPasswordBtn.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    forgotForm.classList.remove('hidden');
  });
  backToLoginFromReset.addEventListener('click', () => {
    forgotForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });
  backToLoginFromRegister.addEventListener('click', () => {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });
  logoutBtn.addEventListener('click', () => logout());

  checkSession();
})();
