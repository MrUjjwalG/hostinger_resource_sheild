import React, { useEffect, useState } from 'react';
import apiClient from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { Settings, Users, Activity } from 'lucide-react';

const SelectAccount = () => {
    const [vpsIds, setVpsIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await apiClient.get('/api/config', { headers: { Authorization: `Bearer ${token}` } });
                
                if (res.data.vpsList) {
                    setVpsIds(res.data.vpsList);
                } else {
                    const ids = res.data.vpsIds || [];
                    setVpsIds(ids.map(id => ({ id, account_name: 'Default' })));
                }
            } catch (error) {
                console.error("Failed to fetch config", error);
                if (error.response?.status === 401) {
                    navigate('/login');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [navigate]);

    const accounts = vpsIds.length > 0 
        ? [...new Set(vpsIds.map(v => v.account_name || 'Default').filter(Boolean))] 
        : [];

    useEffect(() => {
        if (!loading && accounts.length === 1) {
            navigate(`/dashboard?account=${accounts[0]}`);
        }
    }, [loading, accounts, navigate]);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a' }}>
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                <Activity size={48} style={{ animation: 'pulse 2s infinite', marginBottom: '1rem' }} />
                <div>Loading accounts...</div>
            </div>
        </div>
    );

    const accountsWithAll = ['All', ...accounts];

    return (
        <div style={{ minHeight: '100vh', background: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ maxWidth: '800px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem' }}>Welcome Back</h1>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Select an account to view metrics</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    {accountsWithAll.map(acc => (
                        <div 
                            key={acc}
                            onClick={() => navigate(`/dashboard?account=${acc}`)}
                            style={{
                                background: 'rgba(30, 41, 59, 0.4)',
                                border: '1px solid rgba(51, 65, 85, 0.5)',
                                borderRadius: '16px',
                                padding: '2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '1rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px)';
                                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)';
                                e.currentTarget.style.borderColor = '#3b82f6';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)';
                                e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.5)';
                            }}
                        >
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: acc === 'All' ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                            }}>
                                {acc === 'All' ? <Settings size={32} color="white" /> : <Users size={32} color="white" />}
                            </div>
                            <h3 style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.25rem' }}>{acc}</h3>
                            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                                {acc === 'All' 
                                    ? `${vpsIds.length} VPS Instances` 
                                    : `${vpsIds.filter(v => (v.account_name || 'Default') === acc).length} VPS Instances`
                                }
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SelectAccount;
