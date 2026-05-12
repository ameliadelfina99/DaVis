const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const xlsx = require('xlsx');
const fs = require('fs');
const csv = require('csv-parser'); // <-- Ditambahkan agar file CSV bisa di-parsing di proses upload
const mysql = require('mysql2/promise'); // <-- Digunakan untuk koneksi Aiven

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
// 1. KONEKSI KE DATABASE AIVEN CLOUD
// ==========================================
const db = mysql.createPool({
    host: 'mysql-26e23bfa-ameliadelfina99-e4da.h.aivencloud.com',
    user: 'avnadmin',
    password: 'AVNS_24IaBTFQTZLhc_B_RXm', // 👈 PENTING: Ganti tulisan ini dengan password Aiven kamu
    database: 'defaultdb',
    port: 12893,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

// ==========================================
// 2. FUNGSI PINTAR: OTOMATIS BUAT TABEL
// ==========================================
const initializeDB = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                password VARCHAR(255) NOT NULL
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS datasets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(255) NOT NULL,
                delete_password VARCHAR(255) NOT NULL,
                data_content LONGTEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const [rows] = await db.query('SELECT * FROM users');
        if (rows.length === 0) {
            // Jika tabel users masih kosong, buatkan 1 admin default
            await db.query('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', 'admin123']);
            console.log('✅ Admin default berhasil dibuat! Password izin upload: admin123');
        }

        console.log('✅ Database Cloud Aiven berhasil tersambung dan siap digunakan!');
    } catch (error) {
        console.error('🚨 Gagal menyiapkan database cloud:', error);
    }
};

// Jalankan fungsi inisialisasi saat server dinyalakan
initializeDB();

// ==========================================
// API ENDPOINT: UPLOAD DATASET (DENGAN PROTEKSI ADMIN)
// ==========================================
app.post('/api/upload', upload.single('file_dataset'), async (req, res) => {
    try {
        const uploadPassword = req.body.upload_password; 
        const deletePassword = req.body.password; 
        const file = req.file;

        if (!file || !deletePassword || !uploadPassword) {
            return res.status(400).json({ message: "File, password upload, dan password hapus tidak boleh kosong!" });
        }

        const [adminRows] = await db.query('SELECT password FROM users LIMIT 1');
        
        if (adminRows.length === 0) {
             if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
             return res.status(500).json({ message: "Tabel user kosong/tidak ditemukan." });
        }

        const adminPasswordDB = adminRows[0].password;
        
        let isUploadAllowed = false;
        try {
            isUploadAllowed = await bcrypt.compare(uploadPassword, adminPasswordDB);
        } catch(e) {} 

        if (!isUploadAllowed && uploadPassword === adminPasswordDB) {
            isUploadAllowed = true; 
        }

        if (!isUploadAllowed) {
             if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
             return res.status(401).json({ message: "Akses Ditolak! Password Upload salah." });
        }

        const results = [];
        fs.createReadStream(file.path)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                try {
                    const jsonData = JSON.stringify(results);
                    const hashedDeletePassword = await bcrypt.hash(deletePassword, 10);
                    
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

        const [rows] = await db.query('SELECT file_path, delete_password FROM datasets WHERE id = ?', [datasetId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: "Dataset tidak ditemukan." });
        }
        const dataset = rows[0];

        const isMatch = await bcrypt.compare(inputPassword, dataset.delete_password);
        if (!isMatch) {
            return res.status(401).json({ message: "Password salah! Anda tidak diizinkan menghapus data ini." });
        }

        await db.query('DELETE FROM datasets WHERE id = ?', [datasetId]);

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
        
        const [rows] = await db.query('SELECT data_content FROM datasets WHERE id = ?', [datasetId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: "Dataset tidak ditemukan." });
        }

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