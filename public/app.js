// State
let currentGoals = { calories: 2000, protein: 150, carbs: 200, fat: 65 };
let todayLogs = [];
let foodsCache = [];
let workoutHistory = [];

// Init
document.addEventListener('DOMContentLoaded', () => {
    fetchGoals();
    fetchLogs();
    fetchRecentWorkouts();
    setupCharts();
    setupNavigation();
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
    } else if (viewId === 'view-progress') {
        populateExerciseSelect();
    }
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
    } catch (e) { console.error(e); }
}

async function searchFood() {
    const query = document.getElementById('food-search').value;
    if (query.length < 2) return;

    const res = await fetch(`/api/foods?q=${query}`);
    const foods = await res.json();

    const list = document.getElementById('food-results');
    list.innerHTML = '';

    foods.forEach(food => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div>
                <div class="list-item-title">${food.name}</div>
                <div class="list-item-subtitle">${food.calories} cal | P:${food.protein} C:${food.carbs} F:${food.fat}</div>
            </div>
            <button class="btn-icon" onclick='selectFood(${JSON.stringify(food)})'><i class="fas fa-plus-circle"></i></button>
        `;
        list.appendChild(div);
    });
}

let selectedFood = null;
function selectFood(food) {
    selectedFood = food;
    document.getElementById('selected-food-name').innerText = food.name;
    document.getElementById('selected-food-panel').style.display = 'block';
    // Clear search results to reduce clutter
    document.getElementById('food-results').innerHTML = '';
}

async function addFoodLog() {
    if (!selectedFood) return;

    const quantity = parseFloat(document.getElementById('food-quantity').value);
    // Ratio based on 100g/ml standard in DB (simplified)
    // In a real app, we'd handle serving sizes better.
    // Assuming DB values are per 100g.
    const ratio = quantity / 100;

    const date = new Date().toISOString().split('T')[0];

    await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date,
            food_id: selectedFood.id,
            quantity
        })
    });

    // Reset
    document.getElementById('selected-food-panel').style.display = 'none';
    document.getElementById('food-search').value = '';
    navTo('view-dashboard');
}

async function addWorkoutLog() {
    const exercise = document.getElementById('workout-exercise').value;
    const weight = document.getElementById('workout-weight').value;
    const reps = document.getElementById('workout-reps').value;

    if (!exercise || !weight || !reps) return alert('Fill all fields');

    const date = new Date().toISOString().split('T')[0];

    await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, exercise, weight, reps })
    });

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
            li.innerHTML = `
                <div>
                    <div class="list-item-title">${w.exercise}</div>
                    <div class="list-item-subtitle">${w.date}</div>
                </div>
                <div>${w.weight}kg x ${w.reps}</div>
            `;
            list.appendChild(li);
        });
    } catch (e) { console.error(e); }
}

// --- UI UPDATES ---

function updateDashboardUI() {
    // Calculate totals
    let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;

    const list = document.getElementById('meal-list');
    list.innerHTML = '';

    if (todayLogs.length === 0) {
        list.innerHTML = '<li class="list-item empty-state">No meals logged today.</li>';
    }

    todayLogs.forEach(log => {
        // Calculate nutrition based on quantity (assuming DB is per 100g)
        const ratio = log.quantity / 100;
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
        li.innerHTML = `
            <div>
                <div class="list-item-title">${log.name}</div>
                <div class="list-item-subtitle">${log.quantity}g</div>
            </div>
            <div>${cals} cal</div>
        `;
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
