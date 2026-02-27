const db = require('./database');

const foods = [
  { name: 'Chicken Breast (100g)', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'White Rice (100g cooked)', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: 'Egg (Large)', calories: 72, protein: 6, carbs: 0.4, fat: 5 },
  { name: 'Oatmeal (100g)', calories: 389, protein: 16.9, carbs: 66, fat: 6.9 },
  { name: 'Banana (Medium)', calories: 105, protein: 1.3, carbs: 27, fat: 0.3 },
  { name: 'Milk (1 cup)', calories: 103, protein: 8, carbs: 12, fat: 2.4 },
  { name: 'Peanut Butter (1 tbsp)', calories: 94, protein: 4, carbs: 3, fat: 8 },
  { name: 'Protein Powder (1 scoop)', calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { name: 'Salmon (100g)', calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: 'Broccoli (100g)', calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { name: 'Sweet Potato (100g)', calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { name: 'Avocado (100g)', calories: 160, protein: 2, carbs: 9, fat: 15 },
  { name: 'Apple (Medium)', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: 'Almonds (100g)', calories: 579, protein: 21, carbs: 22, fat: 50 },
  { name: 'Greek Yogurt (100g)', calories: 59, protein: 10, carbs: 3.6, fat: 0.4 }
];

db.serialize(() => {
    // Check if foods already exist to avoid duplicates on re-run
    db.get("SELECT count(*) as count FROM foods", (err, row) => {
        if (err) {
            console.error(err.message);
            return;
        }
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO foods (name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?)");
            foods.forEach(food => {
                stmt.run(food.name, food.calories, food.protein, food.carbs, food.fat);
            });
            stmt.finalize();
            console.log("Seeded foods table.");
        } else {
            console.log("Foods table already populated.");
        }
    });
});
