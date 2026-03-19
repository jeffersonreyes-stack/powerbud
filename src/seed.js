const db = require('./database');

const foods = [
  { name: 'Pechuga de pollo (100g)', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Arroz blanco cocido (100g)', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: 'Huevo (unidad)', calories: 72, protein: 6, carbs: 0.4, fat: 5 },
  { name: 'Avena (100g)', calories: 389, protein: 16.9, carbs: 66, fat: 6.9 },
  { name: 'Banano (unidad)', calories: 105, protein: 1.3, carbs: 27, fat: 0.3 },
  { name: 'Leche (1 taza)', calories: 103, protein: 8, carbs: 12, fat: 2.4 },
  { name: 'Mantequilla de mani (1 cucharada)', calories: 94, protein: 4, carbs: 3, fat: 8 },
  { name: 'Proteina en polvo (1 scoop)', calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { name: 'Salmon (100g)', calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: 'Brocoli (100g)', calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { name: 'Batata (100g)', calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { name: 'Aguacate (100g)', calories: 160, protein: 2, carbs: 9, fat: 15 },
  { name: 'Manzana (unidad)', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: 'Almendras (100g)', calories: 579, protein: 21, carbs: 22, fat: 50 },
  { name: 'Yogur griego (100g)', calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  { name: 'Lentejas cocidas (100g)', calories: 116, protein: 9, carbs: 20, fat: 0.4 },
  { name: 'Frijoles cocidos (100g)', calories: 127, protein: 8.7, carbs: 22.8, fat: 0.5 },
  { name: 'Papa cocida (100g)', calories: 87, protein: 1.9, carbs: 20.1, fat: 0.1 },
  { name: 'Arepa (unidad)', calories: 180, protein: 4, carbs: 36, fat: 1.5 },
    { name: 'Queso fresco (30g)', calories: 80, protein: 5, carbs: 1, fat: 6 },
    { name: 'Pan integral (unidad)', calories: 75, protein: 3.5, carbs: 13, fat: 1.1 },
    { name: 'Pan blanco (unidad)', calories: 80, protein: 2.6, carbs: 15, fat: 1 }
];

const legacyEnglishToSpanish = {
    'Chicken Breast (100g)': 'Pechuga de pollo (100g)',
    'White Rice (100g cooked)': 'Arroz blanco cocido (100g)',
    'Egg (Large)': 'Huevo (unidad)',
    'Oatmeal (100g)': 'Avena (100g)',
    'Banana (Medium)': 'Banano (unidad)',
    'Milk (1 cup)': 'Leche (1 taza)',
    'Peanut Butter (1 tbsp)': 'Mantequilla de mani (1 cucharada)',
    'Protein Powder (1 scoop)': 'Proteina en polvo (1 scoop)',
    'Salmon (100g)': 'Salmon (100g)',
    'Broccoli (100g)': 'Brocoli (100g)',
    'Sweet Potato (100g)': 'Batata (100g)',
    'Avocado (100g)': 'Aguacate (100g)',
    'Apple (Medium)': 'Manzana (unidad)',
    'Almonds (100g)': 'Almendras (100g)',
    'Greek Yogurt (100g)': 'Yogur griego (100g)'
};

db.serialize(() => {
    // Check if foods already exist to avoid duplicates on re-run
    db.get('SELECT count(*) as count FROM foods', (err, row) => {
        if (err) {
            console.error(err.message);
            return;
        }

        const ensureSpanishBaseFoods = () => {
            Object.entries(legacyEnglishToSpanish).forEach(([legacyName, spanishName]) => {
                db.run('UPDATE foods SET name = ? WHERE name = ?', [spanishName, legacyName]);
            });

                        db.run(`
                            UPDATE logs
                            SET food_id = (
                                SELECT MIN(f2.id)
                                FROM foods f2
                                WHERE LOWER(f2.name) = LOWER((SELECT f1.name FROM foods f1 WHERE f1.id = logs.food_id))
                            )
                            WHERE food_id IS NOT NULL
                        `);

                        db.run(`
                            DELETE FROM foods
                            WHERE id NOT IN (
                                SELECT MIN(id)
                                FROM foods
                                GROUP BY LOWER(name)
                            )
                        `);

            let pending = foods.length;
            if (pending === 0) {
                return;
            }

            foods.forEach(food => {
                db.get('SELECT id FROM foods WHERE LOWER(name) = LOWER(?) LIMIT 1', [food.name], (checkErr, existing) => {
                    if (checkErr) {
                        console.error(checkErr.message);
                        pending -= 1;
                        if (pending === 0) {
                            console.log('Spanish base foods verified.');
                        }
                        return;
                    }

                    if (existing) {
                        pending -= 1;
                        if (pending === 0) {
                            console.log('Spanish base foods verified.');
                        }
                        return;
                    }

                    db.run(
                        'INSERT INTO foods (name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?)',
                        [food.name, food.calories, food.protein, food.carbs, food.fat],
                        () => {
                            pending -= 1;
                            if (pending === 0) {
                                console.log('Spanish base foods verified.');
                            }
                        }
                    );
                });
            });
        };

        if (row.count === 0) {
            const stmt = db.prepare('INSERT INTO foods (name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?)');
            foods.forEach(food => {
                stmt.run(food.name, food.calories, food.protein, food.carbs, food.fat);
            });
            stmt.finalize();
            console.log('Seeded foods table with Spanish base foods.');
        } else {
            ensureSpanishBaseFoods();
        }
    });
});
