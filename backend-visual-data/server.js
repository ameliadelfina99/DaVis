const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000; 

// Middleware standar
app.use(cors());
app.use(express.json());

// ==========================================
// API DUMMY (Hanya untuk pajangan lokal)
// ==========================================
app.get('/', (req, res) => {
    res.send("Server lokal DaVis berjalan mantap tanpa beban! 🚀");
});

app.get('/api/status', (req, res) => {
    res.json({ 
        message: "Server aman!", 
        database: "Tidak ada", 
        crud: "Murni statis",
        status: "Merdeka dari error! 🎉"
    });
});

// Menyalakan Server
app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 Server lokal berjalan santai di http://localhost:${PORT}`);
    console.log(`🛡️  Status: TANPA Database, TANPA Password, TANPA CRUD`);
    console.log(`=================================================`);
});