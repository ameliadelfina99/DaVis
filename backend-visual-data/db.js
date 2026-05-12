const mysql = require('mysql2/promise');

// Konfigurasi koneksi database
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    // Catatan MAMP: 
    // - Pengguna Mac biasanya passwordnya 'root' dan port 8889.
    // - Pengguna Windows biasanya passwordnya dikosongkan '' dan port 3306.
    // Sesuaikan dengan pengaturan MAMP kamu ya!
    password: 'root', 
    database: 'davis',
    port: 3306 
});

// Mengetes koneksi
db.getConnection()
    .then(() => {
        console.log('Koneksi ke database davis berhasil!');
    })
    .catch((err) => {
        console.error('Gagal terhubung ke database:', err.message);
    });

module.exports = db;