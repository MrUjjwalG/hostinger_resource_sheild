import { useEffect, useState, useRef } from 'react';
import apiClient from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LogOut, Activity, HardDrive, Cpu, Network, Server, ChevronDown, Settings, Terminal } from 'lucide-react';

const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vpsIds, setVpsIds] = useState([]);
  const [selectedVps, setSelectedVps] = useState('');
  const [vpsSpecs, setVpsSpecs] = useState(null);
  const [checkInterval, setCheckInterval] = useState(180);
  // Admin State
  const [showAdmin, setShowAdmin] = useState(false);
  const [systemConfig, setSystemConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const adminSectionRef = useRef(null);
  const logsContainerRef = useRef(null);
  const navigate = useNavigate();

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await apiClient.get('/api/config', { headers: { Authorization: `Bearer ${token}` } });
      
      // Handle new response format { vpsList: [...] } or fallback { vpsIds: [...] }
      if (res.data.checkInterval) {
          setCheckInterval(res.data.checkInterval);
      }

      if (res.data.vpsList) {
          setVpsIds(res.data.vpsList);
          if (res.data.vpsList.length > 0) {
              setSelectedVps(res.data.vpsList[0].id);
          }
      } else {
          // Legacy fallback
          const ids = res.data.vpsIds || [];
          setVpsIds(ids.map(id => ({ id, hostname: `VPS ${id}`, plan: '' })));
          if (ids.length > 0) {
              setSelectedVps(ids[0]);
          }
      }
    } catch (error) {
       console.error("Failed to fetch config", error);
    }
  };

  const fetchMetrics = async (vpsId, isBackground = false) => {
    if (!vpsId) return;
    try {
      if (!isBackground) {
        setLoading(true);
        setMetrics(null);
      }
      const token = localStorage.getItem('token');
      
      // Calculate minutes since midnight for "today's data"
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const minutesSinceMidnight = Math.max(1, Math.floor((now - midnight) / 60000));

      const res = await apiClient.get(`/api/metrics?timeRange=${minutesSinceMidnight}&vpsId=${vpsId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data.data || []; 
      setMetrics(data); 
    } catch (error) {
      console.error(error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
        if (!isBackground) setLoading(false);
    }
  };

  const fetchVPSSpecs = async (vpsId) => {
    if (!vpsId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await apiClient.get(`/api/vps-specs?vpsId=${vpsId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVpsSpecs(res.data);
    } catch (error) {
      console.error('Failed to fetch VPS specs:', error);
      setVpsSpecs(null);
    }
  };

  useEffect(() => {
    fetchConfig();
  },[]);

  // Admin Data Fetching
  useEffect(() => {
    let interval;
    if (showAdmin) {
      const fetchAdminData = async () => {
        try {
          const token = localStorage.getItem('token');
          const [configRes, logsRes] = await Promise.all([
            apiClient.get('/api/admin/system-config', { headers: { Authorization: `Bearer ${token}` } }),
            apiClient.get('/api/admin/logs', { headers: { Authorization: `Bearer ${token}` } })
          ]);
          setSystemConfig(configRes.data);
          setLogs(logsRes.data);
        } catch (error) {
          console.error("Failed to fetch admin data", error);
        }
      };
      
      fetchAdminData();
      interval = setInterval(fetchAdminData, 5000);
    }
    return () => clearInterval(interval);
  }, [showAdmin]);

  // Scroll to Admin section when opened
  useEffect(() => {
    if (showAdmin && adminSectionRef.current) {
      setTimeout(() => {
        adminSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showAdmin]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (showAdmin && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, showAdmin]);

  useEffect(() => {
    if (selectedVps) {
        fetchMetrics(selectedVps);
        fetchVPSSpecs(selectedVps);
        const interval = setInterval(() => fetchMetrics(selectedVps, true), 60000); 
        return () => clearInterval(interval);
    }
  }, [selectedVps, checkInterval]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Enhanced mock data generator with more realistic patterns
  const generateMockData = (id = 'default') => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Mock capacity values (will be replaced by actual VPS specs)
    const mockRamTotal = 8192; // 8GB in MB
    const mockDiskTotal = 51200; // 50GB in MB
    
    // Generate 30 data points for smoother curve
    return Array.from({ length: 30 }, (_, i) => {
      const time = new Date(Date.now() - (29 - i) * 6 * 60000); // 6 min intervals for 180 min
      const timeStr = time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0');
      
      // Create dramatic CPU drop at 1/4 point, then flatline
      let cpuValue;
      if (i < 8) {
        cpuValue = 68 + Math.sin(i * 0.5) * 3; // Around 70%
      } else if (i === 8 || i === 9) {
        cpuValue = 68 - (i - 7) * 30; // Sharp drop
      } else {
        cpuValue = 8 + Math.sin(i * 0.3) * 2 + Math.abs((hash + i) % 5); // Around 10%
      }
      
      // VPS-specific RAM usage (in MB, then convert to %)
      const vpsRamOffset = Math.abs(hash % 3000); // 0-3000 MB variation per VPS
      const baseRamMB = 2000 + vpsRamOffset + (i / 30) * 1000;
      const ramMB = baseRamMB + Math.sin((i + hash) * 0.2) * 50;
      const ramPercent = (ramMB / mockRamTotal) * 100;
      const ramGB = ramMB / 1024;
      
      // VPS-specific Disk usage (in MB, then convert to %)
      const vpsDiskOffset = Math.abs(hash % 15000); // 0-15000 MB variation per VPS
      const baseDiskMB = 15000 + vpsDiskOffset + Math.sin((i + hash) * 0.1) * 500;
      const diskMB = baseDiskMB;
      const diskPercent = (diskMB / mockDiskTotal) * 100;
      const diskGB = diskMB / 1024;
      
      // Fluctuating network traffic
      const baseNet = 550 + Math.abs((hash + i * 17) % 300);
      const netValue = baseNet + Math.sin(i * 0.8) * 100;
      
      return {
        time: timeStr,
        cpu: Math.round(Math.max(0, Math.min(100, cpuValue))),
        cpuPercent: Math.round(Math.max(0, Math.min(100, cpuValue))),
        ram: parseFloat(ramPercent.toFixed(1)),
        ramPercent: parseFloat(ramPercent.toFixed(1)),
        ramGB: parseFloat(ramGB.toFixed(1)),
        disk: parseFloat(diskPercent.toFixed(1)),
        diskPercent: parseFloat(diskPercent.toFixed(1)),
        diskGB: parseFloat(diskGB.toFixed(1)),
        net: Math.max(100, Math.floor(netValue))
      };
    });
  };

  if (loading) return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      background: '#0a0e1a'
    }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <Activity size={48} style={{ animation: 'pulse 2s infinite', marginBottom: '1rem' }} />
        <div>Loading metrics...</div>
      </div>
    </div>
  );

  const currentData = metrics && metrics.length > 0 ? metrics : generateMockData(selectedVps);
  const chartData = currentData;
  const latestData = chartData[chartData.length - 1];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a' }}>
      {/* Enhanced Header */}
      <nav style={{ 
        borderBottom: '1px solid rgba(30, 41, 59, 0.5)', 
        padding: '0.75rem 0', 
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div className="container flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              padding: '0.625rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px'
            }}>
              <Server size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Resource Shield</h1>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>VPS Monitoring Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {vpsIds.length > 1 && (
                 <div style={{ position: 'relative' }}>
                   <select 
                      value={selectedVps} 
                      onChange={(e) => setSelectedVps(e.target.value)}
                      style={{
                          background: 'rgba(30, 41, 59, 0.8)',
                          color: '#f8fafc',
                          border: '1px solid rgba(51, 65, 85, 0.8)',
                          padding: '0.625rem 2.5rem 0.625rem 1rem',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          appearance: 'none',
                          minWidth: '200px'
                      }}
                   >
                       {vpsIds.map(vps => (
                           <option key={vps.id} value={vps.id}>
                               {vps.hostname ? `${vps.hostname} (${vps.plan})` : `VPS ${vps.id}`}
                           </option>
                       ))}
                   </select>
                   <ChevronDown size={16} style={{ 
                     position: 'absolute', 
                     right: '0.75rem', 
                     top: '50%', 
                     transform: 'translateY(-50%)',
                     pointerEvents: 'none',
                     color: '#94a3b8'
                   }} />
                 </div>
             )}
            <button onClick={() => setShowAdmin(!showAdmin)} style={{ 
              background: showAdmin ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              border: `1px solid ${showAdmin ? '#3b82f6' : 'rgba(51, 65, 85, 0.8)'}`,
              padding: '0.625rem 1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: showAdmin ? '#3b82f6' : '#f8fafc',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginRight: '0.5rem'
            }}>
              <Settings size={16} />
              <span>Admin</span>
            </button>
            <button onClick={handleLogout} style={{ 
              background: 'transparent', 
              border: '1px solid rgba(51, 65, 85, 0.8)',
              padding: '0.625rem 1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#f8fafc',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}>
              <LogOut size={16} />
              <span>Logout</span>
            </button>
        </div>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
        
        {/* Main Graph Card */}
        <div style={{ 
          background: 'rgba(15, 23, 42, 0.6)', 
          padding: '1.5rem', 
          borderRadius: '16px', 
          border: '1px solid rgba(30, 41, 59, 0.8)',
          marginBottom: '1.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
             <h2 style={{ 
               fontSize: '1.25rem', 
               fontWeight: 700, 
               color: '#f8fafc',
               margin: 0
             }}>
               {vpsSpecs ? `${vpsSpecs.hostname} (${vpsSpecs.plan})` : 'VPS Metrics Overview'}
             </h2>
          </div>
          
          <div style={{ height: '450px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  {/* Enhanced glow effects */}
                  <filter id="glow-cpu" height="300%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.23 0 0 0 0 0.51 0 0 0 0 0.96 0 0 0 0.7 0" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="glow-ram" height="300%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.13 0 0 0 0 0.77 0 0 0 0 0.37 0 0 0 0.7 0" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="glow-disk" height="300%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.98 0 0 0 0 0.8 0 0 0 0 0.08 0 0 0 0.7 0" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="glow-net" height="300%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.94 0 0 0 0 0.27 0 0 0 0 0.27 0 0 0 0.7 0" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="rgba(51, 65, 85, 0.3)" 
                  horizontal={true} 
                  vertical={false} 
                />
                
                <XAxis 
                  dataKey="time" 
                  stroke="#64748b" 
                  tick={{ fill: '#94a3b8', fontSize: 12 }} 
                  tickLine={false} 
                  axisLine={{ stroke: 'rgba(51, 65, 85, 0.5)' }}
                  label={{ value: 'Time', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
                />
                
                {/* Left Y-Axis for CPU and RAM percentages */}
                <YAxis 
                  yAxisId="left"
                  stroke="#64748b" 
                  tick={{ fill: '#94a3b8', fontSize: 12 }} 
                  tickLine={false} 
                  axisLine={{ stroke: 'rgba(51, 65, 85, 0.5)' }}
                  label={{ value: 'Usage %', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                  domain={[0, 100]}
                />
                
                {/* Right Y-Axis for Disk and Network in MB/GB */}
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#64748b" 
                  tick={{ fill: '#94a3b8', fontSize: 12 }} 
                  tickLine={false} 
                  axisLine={{ stroke: 'rgba(51, 65, 85, 0.5)' }}
                  label={{ value: 'GB / MB', angle: 90, position: 'insideRight', fill: '#94a3b8' }}
                  domain={[0, 1000]}
                />

                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    borderColor: 'rgba(59, 130, 246, 0.5)', 
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.5)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
                  }} 
                  itemStyle={{ color: '#f8fafc', fontSize: '0.875rem' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
                  formatter={(value, name) => {
                    if (name === 'CPU Usage (%)') return `${value}%`;
                    if (name === 'RAM Usage (%)') {
                      const dataPoint = chartData.find(d => d.cpu !== undefined);
                      return dataPoint && dataPoint.ramGB ? `${value}% (${dataPoint.ramGB} GB)` : `${value}%`;
                    }
                    if (name === 'Disk Usage (%)') {
                      const dataPoint = chartData.find(d => d.cpu !== undefined);
                      return dataPoint && dataPoint.diskGB ? `${value}% (${dataPoint.diskGB} GB)` : `${value}%`;
                    }
                    if (name === 'Outgoing Traffic (MB)') return `${value} MB`;
                    return value;
                  }}
                />
                
                <Legend 
                  verticalAlign="top" 
                  height={40} 
                  iconType="rect"
                  wrapperStyle={{
                    paddingBottom: '20px'
                  }}
                  formatter={(value) => <span style={{ color: '#f8fafc', fontSize: '0.875rem' }}>{value}</span>}
                />

                <Line 
                  yAxisId="left"
                  name="CPU Usage (%)" 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={false} 
                  filter="url(#glow-cpu)"
                  animationDuration={1000}
                />
                <Line 
                  yAxisId="left"
                  name="RAM Usage (%)" 
                  type="monotone" 
                  dataKey="ram" 
                  stroke="#22c55e" 
                  strokeWidth={3} 
                  dot={false} 
                  filter="url(#glow-ram)"
                  animationDuration={1000}
                />
                <Line 
                  yAxisId="left"
                  name="Disk Usage (%)" 
                  type="monotone" 
                  dataKey="disk" 
                  stroke="#facc15" 
                  strokeWidth={3} 
                  dot={false} 
                  filter="url(#glow-disk)"
                  animationDuration={1000}
                />
                <Line 
                  yAxisId="right"
                  name="Outgoing Traffic (MB)" 
                  type="monotone" 
                  dataKey="net" 
                  stroke="#ef4444" 
                  strokeWidth={3} 
                  dot={false} 
                  filter="url(#glow-net)"
                  animationDuration={1000}
                />
                
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Enhanced Stat Cards */}
        <div className="grid" style={{ gap: '1rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 100,
              height: 100,
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
              borderRadius: '50%'
            }}></div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  padding: '0.625rem',
                  borderRadius: '8px',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Activity size={20} color="#3b82f6" />
                </div>
                <span style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 500 }}>CPU Usage</span>
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#3b82f6' }}>
              {Math.round(latestData.cpu)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
              {vpsSpecs && vpsSpecs.cpu_cores && (
                <span>{vpsSpecs.cpu_cores} Cores • </span>
              )}
              {latestData.cpu > 80 ? '⚠️ High Usage' : latestData.cpu > 50 ? '⚡ Moderate' : '✓ Normal'}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 100,
              height: 100,
              background: 'radial-gradient(circle, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
              borderRadius: '50%'
            }}></div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div style={{
                  background: 'rgba(34, 197, 94, 0.2)',
                  padding: '0.625rem',
                  borderRadius: '8px',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Server size={20} color="#22c55e" />
                </div>
                <span style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 500 }}>RAM Usage</span>
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#22c55e' }}>
              {latestData.ramGB ? latestData.ramGB.toFixed(1) : latestData.ram.toFixed(1)} GB
              {vpsSpecs && vpsSpecs.ram_mb && (
                <span style={{ fontSize: '1rem', color: '#64748b', marginLeft: '0.5rem' }}>/ {(vpsSpecs.ram_mb / 1024).toFixed(0)} GB</span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
              {latestData.ram > 80 ? '⚠️ High Usage' : latestData.ram > 60 ? '⚡ Moderate' : '✓ Normal'}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.1) 0%, rgba(250, 204, 21, 0.05) 100%)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid rgba(250, 204, 21, 0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 100,
              height: 100,
              background: 'radial-gradient(circle, rgba(250, 204, 21, 0.1) 0%, transparent 70%)',
              borderRadius: '50%'
            }}></div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div style={{
                  background: 'rgba(250, 204, 21, 0.2)',
                  padding: '0.625rem',
                  borderRadius: '8px',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <HardDrive size={20} color="#facc15" />
                </div>
                <span style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 500 }}>Disk Space</span>
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#facc15' }}>
              {latestData.diskGB ? latestData.diskGB.toFixed(1) : latestData.disk.toFixed(1)} GB
              {vpsSpecs && vpsSpecs.disk_gb && (
                <span style={{ fontSize: '1rem', color: '#64748b', marginLeft: '0.5rem' }}>/ {vpsSpecs.disk_gb} GB</span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
              Available
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 100,
              height: 100,
              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, transparent 70%)',
              borderRadius: '50%'
            }}></div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  padding: '0.625rem',
                  borderRadius: '8px',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Activity size={20} color="#ef4444" style={{ transform: 'rotate(90deg)' }} />
                </div>
                <span style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 500 }}>Network Traffic</span>
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>
              {latestData.net} MB
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
              Outgoing
            </div>
          </div>
        </div>

        {/* Admin Section */}
        {showAdmin && (
          <div ref={adminSectionRef} style={{ marginTop: '2rem', borderTop: '1px solid rgba(51, 65, 85, 0.5)', paddingTop: '2rem' }}>
             <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Terminal size={24} color="#3b82f6" />
              System Diagnostics
             </h2>

             <div className="grid" style={{ gridTemplateColumns: '1fr', gap: '1.5rem' }}>
               {/* Config Card */}
               <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  padding: '1.5rem',
                  borderRadius: '16px',
                  border: '1px solid rgba(30, 41, 59, 0.8)',
               }}>
                  <h3 style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Settings size={18} /> Configuration
                  </h3>
                  {systemConfig ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                       {Object.entries(systemConfig.env).filter(([k]) => !k.startsWith('npm_')).map(([key, value]) => (
                         <div key={key} style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>{key}</div>
                            <div style={{ color: '#e2e8f0', fontSize: '0.875rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>{String(value)}</div>
                         </div>
                       ))}
                       <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>UPTIME</div>
                            <div style={{ color: '#e2e8f0', fontSize: '0.875rem', fontFamily: 'monospace' }}>{Math.floor(systemConfig.uptime / 60)} minutes</div>
                       </div>
                    </div>
                  ) : (
                    <div style={{ color: '#64748b' }}>Loading config...</div>
                  )}
               </div>

               {/* Logs Card */}
               <div style={{
                  background: '#0f172a',
                  padding: '1.5rem',
                  borderRadius: '16px',
                  border: '1px solid rgba(30, 41, 59, 0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '500px'
               }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Terminal size={18} /> Live Server Logs
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                       <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Auto-refreshing (5s)</span>
                    </div>
                  </div>
                  
                  <div ref={logsContainerRef} style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    background: '#020617', 
                    borderRadius: '8px', 
                    padding: '1rem',
                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    fontSize: '0.8rem',
                    color: '#e2e8f0',
                    border: '1px solid #1e293b'
                  }}>
                    {logs.length > 0 ? logs.map((log, index) => (
                      <div key={index} style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <span style={{ color: '#64748b', minWidth: '150px' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span style={{ 
                          color: log.type === 'error' ? '#ef4444' : log.type === 'warn' ? '#f59e0b' : '#22c55e',
                          textTransform: 'uppercase',
                          fontWeight: 'bold',
                          minWidth: '60px'
                        }}>{log.type}</span>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{log.message}</span>
                      </div>
                    )) : (
                      <div style={{ color: '#64748b', fontStyle: 'italic' }}>No logs available...</div>
                    )}
                  </div>
               </div>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
