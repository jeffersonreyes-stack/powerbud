const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('../auth');

const router = express.Router();

// Configurar cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
// Advertencia: Para guardar/escribir en buckets públicos se recomienda usar el SERVICE_ROLE_KEY de Supabase
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseBucket = process.env.SUPABASE_BUCKET || 'powerbud1';

let supabase;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

// Configurar multer para almacenar el archivo en memoria (luego lo pasamos a Supabase)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB por foto
});

router.use(authenticateToken);

// Endpoint para subir foto de progreso
router.post('/progress', upload.single('photo'), async (req, res) => {
    try {
        const userId = req.user.id;
        const file = req.file;

        if (req.user.role !== 'client') {
            return res.status(403).json({ error: 'Solo los clientes pueden subir fotos de progreso' });
        }

        if (!file) {
            return res.status(400).json({ error: 'No se envió ninguna imagen' });
        }

        if (!supabase) {
             return res.status(500).json({ error: 'El almacenamiento en la nube no está configurado.' });
        }

        // Generar un nombre único para el archivo
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `progress/${fileName}`;

        // Subir a Supabase Storage
        const { data, error } = await supabase.storage
            .from(supabaseBucket)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) {
            console.error('Error de Supabase:', error);
            return res.status(500).json({ error: 'Error al subir la imagen al bucket' });
        }

        // Obtener la URL pública (asumiendo que el bucket es público)
        const { data: publicData } = supabase.storage
            .from(supabaseBucket)
            .getPublicUrl(filePath);

        const publicUrl = publicData.publicUrl;

        res.json({
            success: true,
            message: 'Foto subida exitosamente',
            photo_url: publicUrl
        });

    } catch (err) {
        console.error('Error uploading photo:', err);
        res.status(500).json({ error: 'Error interno al procesar la subida' });
    }
});

// Endpoint para que los entrenadores suban su certificado de educación (obligatorio para trabajar)
router.post('/certificate', upload.single('certificate'), async (req, res) => {
    try {
        const userId = req.user.id;
        const file = req.file;

        if (req.user.role !== 'trainer') {
            return res.status(403).json({ error: 'Solo los entrenadores deben subir certificados.' });
        }

        if (!file) {
            return res.status(400).json({ error: 'Debes adjuntar un archivo (imagen o PDF).' });
        }

        if (!supabase) {
             return res.status(500).json({ error: 'El almacenamiento en la nube no está configurado.' });
        }

        const pgDb = require('../pg-database'); // Traemos la BD aquí

        // 1. Subir certificado a Supabase
        const fileExt = file.originalname.split('.').pop();
        const fileName = `certificate_${userId}_${Date.now()}.${fileExt}`;
        const filePath = `certificates/${fileName}`;

        const { data, error } = await supabase.storage
            .from(supabaseBucket)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) {
            console.error('Error de Supabase subiendo certificado:', error);
            return res.status(500).json({ error: 'Error de la nube al subir el certificado.' });
        }

        // 2. Obtener URL pública (Si el bucket no es público, requerirá URL firmadas en producción)
        const { data: publicData } = supabase.storage
            .from(supabaseBucket)
            .getPublicUrl(filePath);

        const publicUrl = publicData.publicUrl;

        // 3. Actualizar al entrenador a estado 'pending' (En revisión)
        const sql = `
            UPDATE users
            SET certificate_url = $1, verification_status = 'pending'
            WHERE id = $2
            RETURNING verification_status
        `;

        await pgDb.query(sql, [publicUrl, userId]);

        res.json({
            success: true,
            message: 'Certificado recibido. Tu cuenta está en proceso de revisión de autenticidad.',
            status: 'pending',
            certificate_url: publicUrl
        });

    } catch (err) {
        console.error('Error uploading photo:', err);
        res.status(500).json({ error: 'Error interno al procesar la subida' });
    }
});

module.exports = router;
