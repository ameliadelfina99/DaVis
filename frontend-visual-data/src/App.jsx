import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

function App() {
  const [activeTab, setActiveTab] = useState('data-management');
  
  // 👉 STATE DASHBOARD
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [datasets, setDatasets] = useState([]);
  const [dashboardData, setDashboardData] = useState([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [activeDatasetName, setActiveDatasetName] = useState('');
  const [activeVizDatasetId, setActiveVizDatasetId] = useState(''); 
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // 1. HARDCODE DATASET STATIS
    // Karena kita tidak pakai database, kita daftarkan file JSON yang ada di folder 'public' ke sini.
    setDatasets([
      { 
        id: 1, 
        file_name: 'superstore_data.json', 
        created_at: new Date().toISOString() 
      }
    ]);

    // 2. LOAD PETA AMERIKA
    fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
      .then(response => response.json())
      .then(usaJson => {
        echarts.registerMap('USA', usaJson); 
        setIsMapLoaded(true);
      })
      .catch(err => console.error("Gagal memuat file peta:", err));
  }, []);

  // 👉 FUNGSI PINTAR: BACA FILE JSON DARI FOLDER PUBLIC LOKAL
  const handleSelectDataset = async (datasetId) => {
    setActiveVizDatasetId(datasetId);
    setCurrentPage(1); 
    
    if (!datasetId) {
      setDashboardData([]);
      setActiveDatasetName('');
      return;
    }

    const selected = datasets.find(d => d.id == datasetId);
    if (!selected) return;

    setIsDashboardLoading(true); 
    setActiveDatasetName(selected.file_name);
    
    try {
      // Fetch akan langsung mengambil file dari folder public/superstore_data.json
      const response = await fetch(`/${selected.file_name}`);
      const data = await response.json();
      setDashboardData(data);
    } catch (error) { 
      alert("🚨 Gagal memuat data lokal! Pastikan file JSON ada di folder 'public'."); 
    } finally { 
      setIsDashboardLoading(false); 
    }
  };

  const viewRawData = async (id, fileName) => {
    setActiveTab('view-data');
    if (activeVizDatasetId == id) return;
    await handleSelectDataset(id); 
  };

  // ==========================================
  // KONFIGURASI ECHARTS
  // ==========================================
  const getBarChartOption = () => {
    if (!dashboardData.length) return {};
    const agg = {};
    dashboardData.forEach(row => {
      const sub = row['Sub-Category'];
      if(sub) agg[sub] = (agg[sub] || 0) + parseFloat(row.Sales || 0);
    });
    const sorted = Object.entries(agg).sort((a,b) => b[1] - a[1]).slice(0, 10);
    return {
      title: { text: 'Top 10 Penjualan (Sub-Kategori)', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: sorted.map(d => d[0]), axisLabel: { interval: 0, rotate: 30, fontSize: 10 } },
      yAxis: { type: 'value' },
      series: [{ data: sorted.map(d => Math.round(d[1])), type: 'bar', itemStyle: { borderRadius: [4,4,0,0], color: '#3b82f6' } }]
    };
  };

  const getLineChartOption = () => {
    if (!dashboardData.length) return {};
    const agg = {};
    dashboardData.forEach(row => {
      const date = `${row.Tahun}-${String(row.Bulan).padStart(2, '0')}`;
      if(row.Tahun) agg[date] = (agg[date] || 0) + parseFloat(row.Sales || 0);
    });
    const sortedKeys = Object.keys(agg).sort();
    return {
      title: { text: 'Tren Total Penjualan Bulanan', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: sortedKeys },
      yAxis: { type: 'value' },
      series: [{ data: sortedKeys.map(k => Math.round(agg[k])), type: 'line', smooth: true, areaStyle: { opacity: 0.2, color: '#10b981' }, itemStyle: { color: '#10b981' } }]
    };
  };

  const getPieChartOption = () => {
    if (!dashboardData.length) return {};
    const agg = {};
    dashboardData.forEach(row => {
      const seg = row.Segment;
      if(seg) agg[seg] = (agg[seg] || 0) + parseFloat(row.Sales || 0);
    });
    const data = Object.keys(agg).map(k => ({ name: k, value: Math.round(agg[k]) }));
    return {
      title: { text: 'Porsi Segmen Pelanggan', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{ type: 'pie', radius: '55%', center: ['50%', '50%'], data, emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } } }]
    };
  };

  const getDonutChartOption = () => {
    if (!dashboardData.length) return {};
    const agg = {};
    dashboardData.forEach(row => {
      const reg = row.Region;
      if(reg) agg[reg] = (agg[reg] || 0) + parseFloat(row.Sales || 0);
    });
    const data = Object.keys(agg).map(k => ({ name: k, value: Math.round(agg[k]) }));
    return {
      title: { text: 'Porsi Penjualan Regional', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{ type: 'pie', radius: ['40%', '65%'], center: ['50%', '50%'], data, itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 } }]
    };
  };

  const getStreamgraphOption = () => {
    if (!dashboardData.length) return {};
    const aggregated = {};
    dashboardData.forEach(row => {
      const date = `${row.Tahun}-${String(row.Bulan).padStart(2, '0')}-01`;
      const cat = row.Category;
      const sales = parseFloat(row.Sales) || 0;
      if (!aggregated[date]) aggregated[date] = {};
      if (!aggregated[date][cat]) aggregated[date][cat] = 0;
      aggregated[date][cat] += sales;
    });
    const formattedData = [];
    Object.keys(aggregated).forEach(date => {
      Object.keys(aggregated[date]).forEach(cat => { formattedData.push([date, aggregated[date][cat], cat]); });
    });
    return {
      title: { text: 'Komposisi Kategori (Streamgraph)', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: 'rgba(0,0,0,0.2)', width: 1, type: 'solid' } } },
      legend: { bottom: 0, data: ['Furniture', 'Office Supplies', 'Technology'] },
      singleAxis: { top: 50, bottom: 50, type: 'time', splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.2 } } },
      series: [{ type: 'themeRiver', emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0, 0, 0, 0.8)' } }, data: formattedData }]
    };
  };

  const getRadialTreeOption = () => {
    if (!dashboardData.length) return {};
    const treeMap = { name: 'Superstore', children: [] };
    const categories = [...new Set(dashboardData.map(d => d.Category))];
    categories.forEach(cat => {
      if (!cat) return;
      const subCats = [...new Set(dashboardData.filter(d => d.Category === cat).map(d => d['Sub-Category']))];
      treeMap.children.push({ name: cat, children: subCats.map(sub => ({ name: sub, value: 1 })) });
    });
    return {
      title: { text: 'Struktur Kategori Produk', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'item', triggerOn: 'mousemove' },
      series: [{ type: 'tree', data: [treeMap], top: '10%', bottom: '10%', layout: 'radial', symbol: 'emptyCircle', symbolSize: 8, initialTreeDepth: 2, animationDurationUpdate: 750, label: { show: true, position: 'top', formatter: '{b}', fontSize: 10 } }]
    };
  };

  const getForceGraphOption = () => {
    if (!dashboardData.length) return {};
    const nodes = [{ name: 'Superstore', symbolSize: 60, itemStyle: { color: '#ef4444' } }];
    const links = [];
    const categories = [...new Set(dashboardData.map(d => d.Category))].filter(Boolean);

    categories.forEach((cat) => {
      nodes.push({ name: cat, symbolSize: 40, itemStyle: { color: '#3b82f6' } });
      links.push({ source: 'Superstore', target: cat });

      const subCats = [...new Set(dashboardData.filter(d => d.Category === cat).map(d => d['Sub-Category']))].filter(Boolean);
      subCats.forEach(sub => {
        if (!nodes.find(n => n.name === sub)) {
          nodes.push({ name: sub, symbolSize: 20, itemStyle: { color: '#10b981' } });
        }
        links.push({ source: cat, target: sub });
      });
    });

    return {
      title: { text: 'Jaringan Kategori (Force Graph)', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: {}, animationDurationUpdate: 1500, animationEasingUpdate: 'quinticInOut',
      series: [{ type: 'graph', layout: 'force', data: nodes, links: links, roam: true, label: { show: true, position: 'right' }, force: { repulsion: 300, edgeLength: 60 } }]
    };
  };

  const getMapChartOption = () => {
    if (!dashboardData.length) return {};
    const stateData = {};
    dashboardData.forEach(row => {
      const state = row['State/Province'];
      const sales = parseFloat(row.Sales) || 0;
      if (state) { stateData[state] = (stateData[state] || 0) + sales; }
    });

    const formattedData = Object.keys(stateData).map(state => ({
      name: state, value: Math.round(stateData[state])
    }));

    return {
      title: { text: 'Total Penjualan Peta USA', left: 'center', top: 10, textStyle: { fontSize: 14 } },
      tooltip: { 
        trigger: 'item', 
        formatter: function (params) {
          if (!params.value) return params.name;
          const value = (params.value + '').replace(/(\d{1,3})(?=(?:\d{3})+(?!\d))/g, '$1,');
          return `${params.name}<br/>Sales: $${value}`;
        }
      },
      visualMap: {
        left: 'right', min: 0, max: 200000, itemWidth: 15,
        inRange: { color: ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'] },
        text: ['Tinggi', 'Rendah'], calculable: true
      },
      series: [{ name: 'USA Sales', type: 'map', map: 'USA', roam: true, emphasis: { label: { show: true } }, data: formattedData }]
    };
  };

  // ==========================================
  // UI COMPONENTS ICONS
  // ==========================================
  const Icons = {
    menu: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>,
    dashboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4z" /></svg>,
    data: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
    radial: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
    map: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
    force: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    stream: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  };

  const NavItem = ({ id, icon, label }) => {
    const isActive = activeTab === id;
    return (
      <li 
        onClick={() => setActiveTab(id)}
        className={`py-3 rounded-xl cursor-pointer transition-all duration-200 flex items-center font-medium tracking-wide ${
          isSidebarOpen ? 'px-4 gap-4' : 'px-0 justify-center'
        } ${isActive ? 'bg-[#dee5ef] text-[#11213a] shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
        title={!isSidebarOpen ? label : ''} 
      >
        <div className="shrink-0">{icon}</div>
        {isSidebarOpen && <span className="truncate">{label}</span>}
      </li>
    );
  };

  const EmptyDataPrompt = () => (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center bg-white p-10 rounded-2xl border border-slate-200 border-dashed">
      <div className="text-6xl mb-4">📊</div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Pilih Dataset Terlebih Dahulu</h2>
      <p className="text-slate-500 max-w-md">Silakan gunakan menu <b>dropdown di sudut kanan atas</b> layar untuk memilih dataset statis yang ingin dianalisis.</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans relative overflow-hidden">
      
      {/* SIDEBAR */}
      <div className={`bg-[#11213a] text-white flex flex-col shadow-2xl z-20 shrink-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className={`p-5 h-20 border-b border-white/10 flex items-center tracking-wide ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          <div className={`flex items-center gap-3 ${!isSidebarOpen && 'hidden'}`}>
            <span className="text-blue-400 text-2xl">📊</span>
            <span className="text-2xl font-bold">DaVis</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-colors shrink-0"
            title={isSidebarOpen ? "Tutup Sidebar" : "Buka Sidebar"}
          >
            {Icons.menu}
          </button>
        </div>

        <ul className="flex-1 px-3 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <NavItem id="data-management" icon={Icons.data} label="Data Library" />
          
          <div className={`pt-6 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider ${isSidebarOpen ? 'px-4' : 'text-center'}`}>
            {isSidebarOpen ? 'Visualizations' : 'Viz'}
          </div>
          
          <NavItem id="dashboard" icon={Icons.dashboard} label="Dashboard" />
          <NavItem id="radial-tree" icon={Icons.radial} label="Radial Tree" />
          <NavItem id="map-chart" icon={Icons.map} label="Map Chart" />
          <NavItem id="force-graph" icon={Icons.force} label="Force Graph" />
          <NavItem id="streamgraph" icon={Icons.stream} label="Streamgraph" />
        </ul>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto p-10 relative bg-slate-50 transition-all duration-300 ease-in-out">
        
        {/* HEADER DROPDOWN */}
        {activeTab !== 'data-management' && (
           <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky top-0 z-30">
             <div>
               <h1 className="text-2xl font-extrabold text-slate-800 capitalize flex items-center gap-2">
                 {activeTab.replace('-', ' ')}
               </h1>
             </div>
             
             <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-500">Sumber Data:</span>
                <select 
                  className="px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none font-medium cursor-pointer shadow-sm"
                  value={activeVizDatasetId}
                  onChange={(e) => handleSelectDataset(e.target.value)}
                  disabled={isDashboardLoading}
                >
                  <option value="">-- Pilih Dataset --</option>
                  {datasets.map(d => (
                    <option key={d.id} value={d.id}>{d.file_name}</option>
                  ))}
                </select>
             </div>
           </div>
        )}

        {isDashboardLoading && activeTab !== 'data-management' && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-40 flex flex-col items-center justify-center rounded-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-[#11213a] mb-4"></div>
            <h2 className="text-lg font-bold text-slate-700">Membaca Data Lokal...</h2>
          </div>
        )}

        {/* TAB DATA MANAGEMENT (MODE STATIS: TANPA UPLOAD/DELETE) */}
        {activeTab === 'data-management' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-800">Static Data Library</h1>
                <p className="text-slate-500 mt-2">Mode Serverless aktif. Data diambil langsung dari folder public aplikasi.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold border-b border-slate-200">Nama File Statis</th>
                    <th className="px-6 py-4 font-semibold border-b border-slate-200">Status</th>
                    <th className="px-6 py-4 font-semibold border-b border-slate-200 text-center">Aksi Manajemen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {datasets.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-3"><span className="text-xl">📄</span> {item.file_name}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 font-bold text-xs rounded-full">Ready to Use</span>
                      </td>
                      <td className="px-6 py-4 flex justify-center gap-2">
                        <button onClick={() => viewRawData(item.id, item.file_name)} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium shadow-sm flex items-center gap-2">👁️ Lihat Data</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB VIEW DATA (RAW TABLE) */}
        {activeTab === 'view-data' && (
          dashboardData.length === 0 ? <EmptyDataPrompt /> : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col animate-fade-in" style={{ height: 'calc(100vh - 170px)' }}>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead className="sticky top-0 bg-slate-100 shadow-sm z-10">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-500 border-b border-slate-200 text-sm">#</th>
                      {Object.keys(dashboardData[0]).map((key) => (
                        <th key={key} className="px-4 py-3 font-semibold text-slate-700 border-b border-slate-200 text-sm">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboardData.slice((currentPage - 1) * 100, currentPage * 100).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-400 text-sm">{((currentPage - 1) * 100) + idx + 1}</td>
                        {Object.values(row).map((val, i) => (
                          <td key={i} className="px-4 py-2 text-slate-600 text-sm truncate max-w-[250px]" title={String(val)}>
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
                <span className="text-sm text-slate-600 font-medium">
                  Menampilkan {dashboardData.length > 0 ? ((currentPage - 1) * 100) + 1 : 0} - {Math.min(currentPage * 100, dashboardData.length)} dari <span className="font-bold">{dashboardData.length}</span> baris
                </span>
                <div className="flex gap-2">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors">⬅️ Sebelumnya</button>
                  <button disabled={currentPage * 100 >= dashboardData.length} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors">Selanjutnya ➡️</button>
                </div>
              </div>
            </div>
          )
        )}

        {/* TAB DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          dashboardData.length === 0 ? <EmptyDataPrompt /> : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-fade-in pb-10">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                <ReactECharts option={getLineChartOption()} style={{ height: '300px' }} />
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                <ReactECharts option={getBarChartOption()} style={{ height: '300px' }} />
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                <ReactECharts option={getPieChartOption()} style={{ height: '300px' }} />
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                <ReactECharts option={getDonutChartOption()} style={{ height: '300px' }} />
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-all group" onClick={() => setActiveTab('streamgraph')}>
                <ReactECharts option={getStreamgraphOption()} style={{ height: '300px' }} />
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-all group" onClick={() => setActiveTab('radial-tree')}>
                <ReactECharts option={getRadialTreeOption()} style={{ height: '300px' }} />
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 xl:col-span-2 cursor-pointer hover:shadow-md transition-all group" onClick={() => setActiveTab('force-graph')}>
                <ReactECharts option={getForceGraphOption()} style={{ height: '400px' }} />
              </div>
            </div>
          )
        )}

        {/* FULLSCREEN CHARTS */}
        {activeTab === 'streamgraph' && (dashboardData.length === 0 ? <EmptyDataPrompt /> : 
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-170px)] animate-fade-in"><ReactECharts option={getStreamgraphOption()} style={{ height: '100%', width: '100%' }} /></div>
        )}
        {activeTab === 'radial-tree' && (dashboardData.length === 0 ? <EmptyDataPrompt /> : 
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-170px)] animate-fade-in"><ReactECharts option={getRadialTreeOption()} style={{ height: '100%', width: '100%' }} /></div>
        )}
        {activeTab === 'force-graph' && (dashboardData.length === 0 ? <EmptyDataPrompt /> : 
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-170px)] animate-fade-in"><ReactECharts option={getForceGraphOption()} style={{ height: '100%', width: '100%' }} /></div>
        )}
        {activeTab === 'map-chart' && (dashboardData.length === 0 ? <EmptyDataPrompt /> : 
          !isMapLoaded ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-170px)]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 mb-4"></div>
              <p className="text-slate-500 font-bold">Mengunduh Koordinat Peta USA...</p>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-170px)] animate-fade-in">
              <ReactECharts option={getMapChartOption()} style={{ height: '100%', width: '100%' }} />
            </div>
          )
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
      `}} />
    </div>
  );
}

export default App;