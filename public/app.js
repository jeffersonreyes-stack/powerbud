// State
let currentGoals = { calories: 2000, protein: 150, carbs: 200, fat: 65 };
let todayLogs = [];
let foodsCache = [];
let allFoodsCache = [];
let workoutHistory = [];
let editingLogId = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
    fetchGoals();
    fetchLogs();
    fetchRecentWorkouts();
    fetchBodyMetrics();
    setupCharts();
    setupNavigation();

    // Pre-fill body metrics date with today
    const bodyDate = document.getElementById('body-date');
    if (bodyDate) bodyDate.value = new Date().toISOString().split('T')[0];

    const foodSearch = document.getElementById('food-search');
    foodSearch.addEventListener('input', searchFood);
});

// --- NAVIGATION ---
function navTo(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    // Show target view
    document.getElementById(viewId).classList.add('active');

    // Update bottom nav active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Find link that points to this view
    const navLink = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick').includes(viewId));
    if (navLink) navLink.classList.add('active');

    // Refresh data if needed
    if (viewId === 'view-dashboard') {
        fetchLogs();
        fetchRecentWorkouts();
    } else if (viewId === 'view-log-food') {
        searchFood();
    } else if (viewId === 'view-foods') {
        fetchFoodsForManagement();
    } else if (viewId === 'view-progress') {
        populateExerciseSelect();
    } else if (viewId === 'view-body') {
        fetchBodyMetrics();
    }
}

function isPerHundredUnit(foodName) {
    return /\(100g|\b100g\b|\b100ml\b/i.test(foodName || '');
}

function normalizeUnit(unit, foodName) {
    if (unit === 'g' || unit === 'unit' || unit === 'serving') {
        return unit;
    }

    return isPerHundredUnit(foodName) ? 'g' : 'serving';
}

function getNutritionRatio(foodName, quantity, unit) {
    const safeQuantity = Number(quantity) || 0;
    const normalizedUnit = normalizeUnit(unit, foodName);

    if (isPerHundredUnit(foodName)) {
        if (normalizedUnit === 'g') {
            return safeQuantity / 100;
        }

        // For per-100g foods, 1 unit/serving is treated as 100g.
        return safeQuantity;
    }

    if (normalizedUnit === 'g') {
        // Fallback conversion for foods stored per serving.
        return safeQuantity / 100;
    }

    return safeQuantity;
}

function formatLoggedQuantity(foodName, quantity, unit) {
    const normalizedUnit = normalizeUnit(unit, foodName);

    if (normalizedUnit === 'g') {
        return `${quantity}g`;
    }

    const qty = Number(quantity);
    if (normalizedUnit === 'unit') {
        return qty === 1 ? '1 unit' : `${quantity} units`;
    }

    return qty === 1 ? '1 serving' : `${quantity} servings`;
}

function getSuggestedUnit(foodName) {
    return isPerHundredUnit(foodName) ? 'g' : 'serving';
}

function getSuggestedQuantity(foodName) {
    return isPerHundredUnit(foodName) ? 100 : 1;
}

function showInlineMessage(container, message) {
    container.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'list-item empty-state';
    li.textContent = message;
    container.appendChild(li);
}

function parseLocaleNumberInput(rawValue) {
    if (typeof rawValue === 'string') {
        return Number(rawValue.replace(',', '.').trim());
    }

    return Number(rawValue);
}

function getFoodPayloadFromRow(row) {
    const name = row.querySelector('.food-name-input').value.trim();
    const calories = parseLocaleNumberInput(row.querySelector('.food-calories-input').value);
    const protein = parseLocaleNumberInput(row.querySelector('.food-protein-input').value);
    const carbs = parseLocaleNumberInput(row.querySelector('.food-carbs-input').value);
    const fat = parseLocaleNumberInput(row.querySelector('.food-fat-input').value);

    return { name, calories, protein, carbs, fat };
}

function hasValidFoodPayload(payload) {
    if (!payload.name) {
        return false;
    }

    const macros = [payload.calories, payload.protein, payload.carbs, payload.fat];
    return !macros.some(v => !Number.isFinite(v) || v < 0);
}

function createMacroInput(className, value) {
    const input = document.createElement('input');
    input.className = className;
    input.type = 'number';
    input.min = '0';
    input.step = '0.1';
    input.value = value;
    return input;
}

function renderFoodsManagementList(foods) {
    const container = document.getElementById('foods-management-list');
    container.innerHTML = '';

    if (!foods.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No hay alimentos en la base de datos.';
        container.appendChild(empty);
        return;
    }

    foods.forEach(food => {
        const row = document.createElement('div');
        row.className = 'food-row';
        row.dataset.foodId = food.id;

        const nameInput = document.createElement('input');
        nameInput.className = 'food-name-input';
        nameInput.type = 'text';
        nameInput.value = food.name;

        const caloriesInput = createMacroInput('food-calories-input', food.calories);
        const proteinInput = createMacroInput('food-protein-input', food.protein);
        const carbsInput = createMacroInput('food-carbs-input', food.carbs);
        const fatInput = createMacroInput('food-fat-input', food.fat);

        const saveButton = document.createElement('button');
        saveButton.className = 'btn-primary food-save-btn';
        saveButton.type = 'button';
        saveButton.textContent = 'Guardar';
        saveButton.addEventListener('click', () => saveFoodRow(food.id, row));

        row.appendChild(nameInput);
        row.appendChild(caloriesInput);
        row.appendChild(proteinInput);
        row.appendChild(carbsInput);
        row.appendChild(fatInput);
        row.appendChild(saveButton);

        container.appendChild(row);
    });
}

async function fetchFoodsForManagement() {
    try {
        const res = await fetch('/api/foods');
        const foods = await res.json();
        allFoodsCache = foods;
        renderFoodsManagementList(foods);
    } catch (e) {
        console.error(e);
        showInlineMessage(document.getElementById('foods-management-list'), 'No se pudo cargar la tabla de alimentos.');
    }
}

async function createFood() {
    const payload = {
        name: document.getElementById('new-food-name').value.trim(),
        calories: parseLocaleNumberInput(document.getElementById('new-food-calories').value),
        protein: parseLocaleNumberInput(document.getElementById('new-food-protein').value),
        carbs: parseLocaleNumberInput(document.getElementById('new-food-carbs').value),
        fat: parseLocaleNumberInput(document.getElementById('new-food-fat').value)
    };

    if (!hasValidFoodPayload(payload)) {
        alert('Completa nombre y macros con valores validos.');
        return;
    }

    try {
        const res = await fetch('/api/foods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error('Request failed');
        }
    } catch (e) {
        console.error(e);
        alert('No se pudo crear el alimento.');
        return;
    }

    document.getElementById('new-food-name').value = '';
    document.getElementById('new-food-calories').value = '';
    document.getElementById('new-food-protein').value = '';
    document.getElementById('new-food-carbs').value = '';
    document.getElementById('new-food-fat').value = '';

    alert('Alimento creado correctamente.');

    await fetchFoodsForManagement();
    searchFood();
}

async function saveFoodRow(foodId, row) {
    const payload = getFoodPayloadFromRow(row);
    if (!hasValidFoodPayload(payload)) {
        alert('Completa nombre y macros con valores validos.');
        return;
    }

    try {
        const res = await fetch(`/api/foods/${foodId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error('Request failed');
        }
    } catch (e) {
        console.error(e);
        alert('No se pudo actualizar el alimento.');
        return;
    }

    await fetchFoodsForManagement();
    searchFood();
}

// --- API CALLS ---

async function fetchGoals() {
    try {
        const res = await fetch('/api/goals');
        currentGoals = await res.json();
        updateDashboardUI();
        // Populate goals form
        document.getElementById('goal-cals').value = currentGoals.calories;
        document.getElementById('goal-prot').value = currentGoals.protein;
        document.getElementById('goal-carbs').value = currentGoals.carbs;
        document.getElementById('goal-fat').value = currentGoals.fat;
    } catch (e) { console.error(e); }
}

async function saveGoals() {
    const newGoals = {
        calories: parseInt(document.getElementById('goal-cals').value),
        protein: parseInt(document.getElementById('goal-prot').value),
        carbs: parseInt(document.getElementById('goal-carbs').value),
        fat: parseInt(document.getElementById('goal-fat').value)
    };

    await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGoals)
    });

    fetchGoals(); // Refresh
    alert('Goals updated!');
}

async function fetchLogs() {
    try {
        const date = new Date().toISOString().split('T')[0];
        const res = await fetch(`/api/logs?date=${date}`);
        todayLogs = await res.json();
        updateDashboardUI();
    } catch (e) {
        console.error(e);
        todayLogs = [];
        updateDashboardUI();
        showInlineMessage(document.getElementById('meal-list'), 'Could not load meals. Start the server and reload.');
    }
}

async function searchFood() {
    const query = document.getElementById('food-search').value.trim();
    const list = document.getElementById('food-results');

    let foods = [];
    try {
        const res = await fetch(`/api/foods?q=${encodeURIComponent(query)}`);
        foods = await res.json();
    } catch (e) {
        console.error(e);
        showInlineMessage(list, 'Could not search foods. Check that the server is running.');
        return;
    }

    list.innerHTML = '';

    if (!foods.length) {
        showInlineMessage(list, query ? 'No foods found for that search.' : 'No foods available in database.');
        return;
    }

    foods.forEach(food => {
        const div = document.createElement('div');
        div.className = 'list-item';

        const left = document.createElement('div');

        const title = document.createElement('div');
        title.className = 'list-item-title';
        title.textContent = food.name;

        const subtitle = document.createElement('div');
        subtitle.className = 'list-item-subtitle';
        subtitle.textContent = `${food.calories} cal | P:${food.protein} C:${food.carbs} F:${food.fat}`;

        left.appendChild(title);
        left.appendChild(subtitle);

        const button = document.createElement('button');
        button.className = 'btn-icon';
        button.type = 'button';
        button.setAttribute('aria-label', `Add ${food.name}`);
        button.addEventListener('click', () => selectFood(food));

        const icon = document.createElement('i');
        icon.className = 'fas fa-plus-circle';
        button.appendChild(icon);

        div.appendChild(left);
        div.appendChild(button);
        list.appendChild(div);
    });

    foodsCache = foods;
}

let selectedFood = null;
function selectFood(food) {
    selectedFood = food;
    document.getElementById('selected-food-name').innerText = food.name;
    document.getElementById('food-unit').value = getSuggestedUnit(food.name);
    document.getElementById('food-quantity').value = getSuggestedQuantity(food.name);
    document.getElementById('selected-food-panel').style.display = 'block';
    // Clear search results to reduce clutter
    document.getElementById('food-results').innerHTML = '';
}

async function addFoodLog() {
    if (!selectedFood) return;

    const quantity = parseFloat(document.getElementById('food-quantity').value);
    const unit = document.getElementById('food-unit').value;
    if (!Number.isFinite(quantity) || quantity <= 0) {
        alert('Enter a valid quantity greater than 0.');
        return;
    }

    const date = new Date().toISOString().split('T')[0];

    try {
        const res = await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date,
                food_id: selectedFood.id,
                quantity,
                unit
            })
        });

        if (!res.ok) {
            throw new Error('Request failed');
        }
    } catch (e) {
        console.error(e);
        alert('Could not save meal. Check that the server is running.');
        return;
    }

    // Reset
    selectedFood = null;
    document.getElementById('selected-food-panel').style.display = 'none';
    document.getElementById('food-search').value = '';
    document.getElementById('food-unit').value = 'g';
    navTo('view-dashboard');
}

function editFoodLog(log) {
    editingLogId = log.id;
    document.getElementById('edit-log-food-name').innerText = `Edit: ${log.name}`;
    document.getElementById('edit-log-quantity').value = log.quantity;
    document.getElementById('edit-log-unit').value = normalizeUnit(log.unit, log.name);
    populateEditFoodSelect(log.food_id);
    document.getElementById('edit-log-panel').style.display = 'block';
}

async function populateEditFoodSelect(selectedFoodId) {
    const select = document.getElementById('edit-log-food-select');

    if (!allFoodsCache.length) {
        try {
            const res = await fetch('/api/foods');
            allFoodsCache = await res.json();
        } catch (e) {
            console.error(e);
            allFoodsCache = [];
        }
    }

    select.innerHTML = '';
    allFoodsCache.forEach(food => {
        const option = document.createElement('option');
        option.value = food.id;
        option.textContent = food.name;
        if (Number(food.id) === Number(selectedFoodId)) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

function cancelEditLog() {
    editingLogId = null;
    document.getElementById('edit-log-panel').style.display = 'none';
}

async function saveEditedLog() {
    if (!editingLogId) return;

    const quantity = parseFloat(document.getElementById('edit-log-quantity').value);
    const unit = document.getElementById('edit-log-unit').value;
    const foodId = Number(document.getElementById('edit-log-food-select').value);

    if (!Number.isFinite(quantity) || quantity <= 0) {
        alert('Enter a valid amount greater than 0.');
        return;
    }

    try {
        const res = await fetch(`/api/logs/${editingLogId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity, unit, food_id: foodId })
        });

        if (!res.ok) {
            throw new Error('Request failed');
        }
    } catch (e) {
        console.error(e);
        alert('Could not update meal. Check that the server is running.');
        return;
    }

    cancelEditLog();
    fetchLogs();
}

async function deleteFoodLog(log) {
    const confirmed = confirm(`Delete ${log.name} from today's meals?`);
    if (!confirmed) {
        return;
    }

    try {
        const res = await fetch(`/api/logs/${log.id}`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            throw new Error('Request failed');
        }
    } catch (e) {
        console.error(e);
        alert('Could not delete meal. Check that the server is running.');
        return;
    }

    if (editingLogId === log.id) {
        cancelEditLog();
    }

    fetchLogs();
}

async function addWorkoutLog() {
    const exercise = document.getElementById('workout-exercise').value;
    const weight = document.getElementById('workout-weight').value;
    const reps = document.getElementById('workout-reps').value;

    if (!exercise || !weight || !reps) return alert('Fill all fields');

    const date = new Date().toISOString().split('T')[0];

    try {
        await fetch('/api/workouts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, exercise, weight, reps })
        });
    } catch (e) {
        console.error(e);
        alert('Could not save workout. Check that the server is running.');
        return;
    }

    // Reset inputs but keep exercise name for convenience
    document.getElementById('workout-weight').value = '';
    document.getElementById('workout-reps').value = '';

    alert('Set logged!');
}

async function fetchRecentWorkouts() {
     try {
        const res = await fetch('/api/workouts');
        const workouts = await res.json();
        workoutHistory = workouts; // Store for charts

        // Show last 5 workouts in dashboard
        const list = document.getElementById('recent-workout-list');
        list.innerHTML = '';
        const recent = workouts.slice(-5).reverse();

        if (recent.length === 0) {
            list.innerHTML = '<li class="list-item empty-state">No workouts logged yet.</li>';
            return;
        }

        recent.forEach(w => {
            const li = document.createElement('li');
            li.className = 'list-item';

            const left = document.createElement('div');
            const title = document.createElement('div');
            title.className = 'list-item-title';
            title.textContent = w.exercise;
            const subtitle = document.createElement('div');
            subtitle.className = 'list-item-subtitle';
            subtitle.textContent = w.date;
            left.appendChild(title);
            left.appendChild(subtitle);

            const right = document.createElement('div');
            right.textContent = `${w.weight}kg x ${w.reps}`;

            li.appendChild(left);
            li.appendChild(right);
            list.appendChild(li);
        });
    } catch (e) {
        console.error(e);
        showInlineMessage(document.getElementById('recent-workout-list'), 'Could not load workouts. Start the server and reload.');
    }
}

// --- UI UPDATES ---

function updateDashboardUI() {
    // Calculate totals
    let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;

    const list = document.getElementById('meal-list');
    list.innerHTML = '';

    if (todayLogs.length === 0) {
        list.innerHTML = '<li class="list-item empty-state">No meals logged today.</li>';
        cancelEditLog();
    }

    todayLogs.forEach(log => {
        // Foods with 100g/100ml in their name are treated as per-100 units.
        // Others are treated as per-serving values.
        const ratio = getNutritionRatio(log.name, log.quantity, log.unit);
        const cals = Math.round(log.calories * ratio);
        const p = Math.round(log.protein * ratio);
        const c = Math.round(log.carbs * ratio);
        const f = Math.round(log.fat * ratio);

        totalCals += cals;
        totalProt += p;
        totalCarbs += c;
        totalFat += f;

        const li = document.createElement('li');
        li.className = 'list-item';

        const left = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'list-item-title';
        title.textContent = log.name;
        const subtitle = document.createElement('div');
        subtitle.className = 'list-item-subtitle';
        subtitle.textContent = formatLoggedQuantity(log.name, log.quantity, log.unit);
        left.appendChild(title);
        left.appendChild(subtitle);

        const right = document.createElement('div');
        right.className = 'list-actions';
        const calories = document.createElement('div');
        calories.textContent = `${cals} cal`;

        const editButton = document.createElement('button');
        editButton.className = 'btn-icon';
        editButton.type = 'button';
        editButton.setAttribute('aria-label', `Edit ${log.name}`);
        editButton.addEventListener('click', () => editFoodLog(log));

        const icon = document.createElement('i');
        icon.className = 'fas fa-pen';
        editButton.appendChild(icon);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn-icon btn-danger';
        deleteButton.type = 'button';
        deleteButton.setAttribute('aria-label', `Delete ${log.name}`);
        deleteButton.addEventListener('click', () => deleteFoodLog(log));

        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'fas fa-trash';
        deleteButton.appendChild(deleteIcon);

        right.appendChild(calories);
        right.appendChild(editButton);
        right.appendChild(deleteButton);

        li.appendChild(left);
        li.appendChild(right);
        list.appendChild(li);
    });

    // Update Progress Bars/Circles
    const calPercent = Math.min(100, (totalCals / currentGoals.calories) * 100);
    document.getElementById('cal-bar').style.width = `${calPercent}%`;
    document.getElementById('cal-text').innerText = `${totalCals} / ${currentGoals.calories}`;

    document.getElementById('prot-circle').innerText = `${totalProt}g`;
    document.getElementById('prot-goal').innerText = `/ ${currentGoals.protein}g`;

    document.getElementById('carb-circle').innerText = `${totalCarbs}g`;
    document.getElementById('carb-goal').innerText = `/ ${currentGoals.carbs}g`;

    document.getElementById('fat-circle').innerText = `${totalFat}g`;
    document.getElementById('fat-goal').innerText = `/ ${currentGoals.fat}g`;
}

// --- CHARTS ---
let chartInstance = null;

function populateExerciseSelect() {
    const select = document.getElementById('progress-exercise-select');
    // Get unique exercises from history
    const uniqueExercises = [...new Set(workoutHistory.map(w => w.exercise))];

    select.innerHTML = '<option value="">Select...</option>';
    uniqueExercises.forEach(ex => {
        const opt = document.createElement('option');
        opt.value = ex;
        opt.innerText = ex;
        select.appendChild(opt);
    });
}

function loadProgressChart() {
    const exerciseName = document.getElementById('progress-exercise-select').value;
    if (!exerciseName) return;

    const data = workoutHistory.filter(w => w.exercise === exerciseName);
    // Group by date, take max weight for that date (simplified progress)
    // Or just plot every set. Let's plot Max Weight per Day.

    const progressMap = {};
    data.forEach(d => {
        if (!progressMap[d.date] || d.weight > progressMap[d.date]) {
            progressMap[d.date] = d.weight;
        }
    });

    const sortedDates = Object.keys(progressMap).sort();
    const weights = sortedDates.map(date => progressMap[date]);

    renderChart(sortedDates, weights, `Max Weight: ${exerciseName}`);
}

function renderChart(labels, dataPoints, label) {
    const ctx = document.getElementById('progressChart').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: dataPoints,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: '#333' },
                    ticks: { color: '#ccc' }
                },
                x: {
                    grid: { color: '#333' },
                    ticks: { color: '#ccc' }
                }
            },
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
}

function setupCharts() {
    // Initial empty chart or setup logic
}

function setupNavigation() {
    // Set date header
    document.getElementById('date-display').innerText = new Date().toLocaleDateString();
}

// --- BODY METRICS ---

let bodyMetricsCache = [];

async function fetchBodyMetrics() {
    try {
        const res = await fetch('/api/body-metrics');
        bodyMetricsCache = await res.json();
        renderBodyMetrics(bodyMetricsCache);
    } catch (e) {
        console.error('Error fetching body metrics', e);
    }
}

async function saveBodyMetric() {
    const date = document.getElementById('body-date').value;
    if (!date) { alert('Selecciona una fecha'); return; }

    const toVal = id => {
        const v = document.getElementById(id).value.trim();
        return v !== '' ? v : undefined;
    };

    const payload = {
        date,
        weight_kg: toVal('body-weight'),
        height_cm: toVal('body-height'),
        waist_cm:  toVal('body-waist'),
        chest_cm:  toVal('body-chest'),
        hips_cm:   toVal('body-hips'),
        notes:     toVal('body-notes'),
    };

    const hasData = ['weight_kg','height_cm','waist_cm','chest_cm','hips_cm'].some(k => payload[k] !== undefined);
    if (!hasData) { alert('Ingresa al menos un valor'); return; }

    try {
        const res = await fetch('/api/body-metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) { const e = await res.json(); alert(e.error || 'Error'); return; }

        // Clear fields except date
        ['body-weight','body-height','body-waist','body-chest','body-hips','body-notes'].forEach(id => {
            document.getElementById(id).value = '';
        });
        await fetchBodyMetrics();
    } catch (e) {
        alert('Error guardando medida');
    }
}

async function deleteBodyMetric(id) {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
        await fetch(`/api/body-metrics/${id}`, { method: 'DELETE' });
        await fetchBodyMetrics();
    } catch (e) {
        alert('Error eliminando registro');
    }
}

function renderBodyMetrics(entries) {
    const list = document.getElementById('body-history-list');
    const bmiCard = document.getElementById('body-bmi-card');
    if (!list) return;

    if (entries.length === 0) {
        list.innerHTML = '<p class="muted-text">Sin registros aun.</p>';
        bmiCard.style.display = 'none';
        return;
    }

    // Show latest entry summary
    const latest = entries[0];
    bmiCard.style.display = '';
    document.getElementById('bmi-weight').textContent = latest.weight_kg ? `${latest.weight_kg} kg` : '—';
    document.getElementById('bmi-height').textContent = latest.height_cm ? `${latest.height_cm} cm` : '—';
    document.getElementById('bmi-waist').textContent  = latest.waist_cm ? `${latest.waist_cm} cm` : '—';

    if (latest.weight_kg && latest.height_cm) {
        const bmi = (latest.weight_kg / Math.pow(latest.height_cm / 100, 2)).toFixed(1);
        let cat = '';
        if (bmi < 18.5) cat = ' (Bajo peso)';
        else if (bmi < 25) cat = ' (Normal)';
        else if (bmi < 30) cat = ' (Sobrepeso)';
        else cat = ' (Obesidad)';
        document.getElementById('bmi-value').textContent = bmi + cat;
    } else {
        document.getElementById('bmi-value').textContent = '—';
    }

    // History list
    list.innerHTML = entries.map(e => {
        const parts = [];
        if (e.weight_kg) parts.push(`<span class="metric-pill weight">${e.weight_kg} kg</span>`);
        if (e.height_cm) parts.push(`<span class="metric-pill height">${e.height_cm} cm</span>`);
        if (e.waist_cm)  parts.push(`<span class="metric-pill waist">Cintura: ${e.waist_cm} cm</span>`);
        if (e.chest_cm)  parts.push(`<span class="metric-pill chest">Pecho: ${e.chest_cm} cm</span>`);
        if (e.hips_cm)   parts.push(`<span class="metric-pill hips">Caderas: ${e.hips_cm} cm</span>`);
        if (e.notes)     parts.push(`<span class="metric-pill notes"><i class="fas fa-note-sticky"></i> ${e.notes}</span>`);

        return `<div class="body-entry">
            <div class="body-entry-date"><i class="fas fa-calendar-day"></i> ${e.date}</div>
            <div class="body-entry-pills">${parts.join('')}</div>
            <button class="btn-icon btn-danger" onclick="deleteBodyMetric(${e.id})" title="Eliminar">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;
    }).join('');
}
