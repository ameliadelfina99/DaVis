const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const xlsx = require('xlsx');
const fs = require('fs');
const db = require('./db'); 

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Buat folder 'uploads' secara otomatis jika belum ada
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Konfigurasi Multer untuk menyimpan file di folder 'uploads/'
const upload = multer({ dest: 'uploads/' });

// ==========================================
// API ENDPOINT: UPLOAD DATASET (DENGAN PROTEKSI ADMIN)
// ==========================================
app.post('/api/upload', upload.single('file_dataset'), async (req, res) => {
    try {
        const uploadPassword = req.body.upload_password; // Password dari form (untuk izin upload)
        const deletePassword = req.body.password; // Password dari form (untuk izin hapus nanti)
        const file = req.file;

        if (!file || !deletePassword || !uploadPassword) {
            return res.status(400).json({ message: "File, password upload, dan password hapus tidak boleh kosong!" });
        }

        // 1. CEK PASSWORD UPLOAD KE DATABASE
        // ⚠️ PENTING: Ganti 'users' dengan nama tabel yang berisi password di databasemu!
        const [adminRows] = await db.query('SELECT password FROM users LIMIT 1');
        
        if (adminRows.length === 0) {
             if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
             return res.status(500).json({ message: "Tabel user kosong/tidak ditemukan." });
        }

        const adminPasswordDB = adminRows[0].password;
        
        // Logika Pintar: Mengecek apakah password di DB itu di-hash (Bcrypt) atau teks biasa (Plain Text)
        let isUploadAllowed = false;
        try {
            isUploadAllowed = await bcrypt.compare(uploadPassword, adminPasswordDB);
        } catch(e) {} // Abaikan jika error (berarti bukan hash bcrypt)

        if (!isUploadAllowed && uploadPassword === adminPasswordDB) {
            isUploadAllowed = true; // Lolos jika password di DB berupa teks biasa
        }

        if (!isUploadAllowed) {
             // Hapus file yang terlanjur numpang di folder uploads
             if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
             return res.status(401).json({ message: "Akses Ditolak! Password Upload salah." });
        }

        // 2. LANJUTKAN PROSES UPLOAD JIKA PASSWORD BENAR
        const results = [];
        fs.createReadStream(file.path)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                try {
                    const jsonData = JSON.stringify(results);
                    const hashedDeletePassword = await bcrypt.hash(deletePassword, 10);
                    
                    // Asumsi user_id = 1 adalah admin yang sedang upload
                    await db.query(
                        'INSERT INTO datasets (user_id, file_name, file_path, delete_password, data_content) VALUES (?, ?, ?, ?, ?)',
                        [1, file.originalname, file.path, hashedDeletePassword, jsonData]
                    );

                    res.status(200).json({ message: "Dataset berhasil diunggah dan disimpan!" });
                } catch (error) {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                    res.status(500).json({ message: "Gagal menyimpan data ke database." });
                }
            });
    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
});

// ==========================================
// API ENDPOINT: AMBIL DAFTAR DATASET
// ==========================================
app.get('/api/datasets', async (req, res) => {
    try {
        // Penting: HANYA ambil id, file_name, dan created_at. 
        // JANGAN ambil data_content di sini agar prosesnya super cepat!
        const query = `SELECT id, file_name, created_at FROM datasets ORDER BY created_at DESC`;
        
        const [rows] = await db.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error mengambil daftar dataset:", error);
        res.status(500).json({ message: "Gagal mengambil daftar dataset" });
    }
});

// ==========================================
// API ENDPOINT: HAPUS DATASET (DENGAN PASSWORD)
// ==========================================
app.delete('/api/datasets/:id', async (req, res) => {
    try {
        const datasetId = req.params.id;
        const inputPassword = req.body.password;

        if (!inputPassword) {
            return res.status(400).json({ message: "Password tidak boleh kosong!" });
        }

        // 1. PERBAIKAN DI SINI: Jangan gunakan SELECT *. 
        // Hanya ambil file_path dan delete_password agar super cepat dan anti-crash!
        const [rows] = await db.query('SELECT file_path, delete_password FROM datasets WHERE id = ?', [datasetId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: "Dataset tidak ditemukan." });
        }
        const dataset = rows[0];

        // 2. Cocokkan Password (Bcrypt)
        const isMatch = await bcrypt.compare(inputPassword, dataset.delete_password);
        if (!isMatch) {
            return res.status(401).json({ message: "Password salah! Anda tidak diizinkan menghapus data ini." });
        }

        // 3. Hapus data dari Database SQL
        await db.query('DELETE FROM datasets WHERE id = ?', [datasetId]);

        // 4. Hapus file fisiknya dari folder 'uploads'
        if (fs.existsSync(dataset.file_path)) {
            fs.unlinkSync(dataset.file_path);
        }

        res.status(200).json({ message: "Data dan file berhasil dihapus permanen!" });
    } catch (error) {
        console.error("Error saat menghapus:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
});

// ==========================================
// API ENDPOINT: AMBIL ISI DATASET (UNTUK DASHBOARD)
// ==========================================
app.get('/api/datasets/:id/data', async (req, res) => {
    try {
        const datasetId = req.params.id;
        
        // Ambil HANYA kolom data_content
        const [rows] = await db.query('SELECT data_content FROM datasets WHERE id = ?', [datasetId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: "Dataset tidak ditemukan." });
        }

        // Parse data JSON agar rapi sebelum dikirim ke React
        const rawData = rows[0].data_content;
        const parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

        res.status(200).json(parsedData);
    } catch (error) {
        console.error("Error mengambil isi dataset:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
});

// Menyalakan Server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});