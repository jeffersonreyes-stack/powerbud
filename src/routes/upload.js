const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('../auth');
const { sendCertificateApprovalEmail } = require('../mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'powerbud-secret-key-dev-only';

const router = express.Router();

// Configurar cliente de Supabase
const supabaseUrl = process.env.SUPA_BASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseBucket = process.env.SUPA_BASE_BUCKET || process.env.SUPABASE_BUCKET || 'powerbud1';

let supabase;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn('[upload] Supabase Storage NO inicializado. SUPABASE_URL presente:', !!supabaseUrl, '| KEY presente:', !!supabaseKey);
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

        if (req.user.role !== 'trainer' && req.user.role !== 'nutritionist') {
            return res.status(403).json({ error: 'Solo los entrenadores y nutricionistas deben subir certificados.' });
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
            RETURNING full_name, email, role
        `;

        const updateRes = await pgDb.query(sql, [publicUrl, userId]);
        const user = updateRes.rows[0] || {};

        // 4. Enviar email al admin con links de aprobación/rechazo
        try {
            const approveToken = jwt.sign({ userId, action: 'approve' }, JWT_SECRET, { expiresIn: '7d' });
            const rejectToken  = jwt.sign({ userId, action: 'reject'  }, JWT_SECRET, { expiresIn: '7d' });

            await sendCertificateApprovalEmail({
                userId,
                userName: user.full_name || user.email || `Usuario #${userId}`,
                userEmail: user.email || '',
                role: user.role || req.user.role,
                certificateUrl: publicUrl,
                approveToken,
                rejectToken
            });
        } catch (mailErr) {
            // El email es no-crítico: logueamos pero no bloqueamos la respuesta
            console.error('[upload] Error enviando email de verificación:', mailErr.message);
        }

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
