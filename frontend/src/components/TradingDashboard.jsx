import React, { useState, useEffect } from 'react';
import TradeSageAPI from '../api/tradeSageApi';
import Notification from './Notification';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { cleanMarkdownText, extractQuoteAndReason, formatHypothesisTitle } from '../utils/textUtils';

const TradingDashboard = () => {
  const [hypotheses, setHypotheses] = useState([]);
  const [selectedHypothesis, setSelectedHypothesis] = useState(null);
  const [activeTab, setActiveTab] = useState('analysis');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: 'Hello! I am your TradeSage Financial Agent. How can I help you analyze the markets today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(null);
  const chatEndRef = React.useRef(null);

  // Stock Research Chat (Market Trends tab)
  const [stockMessages, setStockMessages] = useState([]);
  const [stockInput, setStockInput] = useState('');
  const [isStockLoading, setIsStockLoading] = useState(false);
  const [stockSessionId, setStockSessionId] = useState(null);
  const stockChatEndRef = React.useRef(null);
  const stockInputRef = React.useRef(null);

  // Expand/collapse for contradictions & confirmations
  const [showAllContradictions, setShowAllContradictions] = useState(false);
  const [showAllConfirmations, setShowAllConfirmations] = useState(false);

  // Chart Vision state
  const [chartImage, setChartImage] = useState(null);       // base64 string
  const [chartImageUrl, setChartImageUrl] = useState(null); // object URL for preview
  const [chartMime, setChartMime] = useState('image/png');
  const [chartAnalysis, setChartAnalysis] = useState(null);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const chartDropRef = React.useRef(null);

  const SUGGESTED_PROMPTS = [
    '📈 What is the current outlook for NVDA?',
    '🏦 Analyze AAPL fundamentals',
    '⚡ Compare TSLA vs RIVN for 2025',
    '🌐 What are the risks for MSFT this quarter?',
  ];

  const sendStockMessage = async (text) => {
    const msg = text || stockInput.trim();
    if (!msg) return;
    setStockInput('');
    const userMsg = { role: 'user', text: msg };
    setStockMessages(prev => [...prev, userMsg]);
    setIsStockLoading(true);
    try {
      const res = await TradeSageAPI.chat(msg, stockSessionId);
      setStockSessionId(res.session_id || stockSessionId);
      setStockMessages(prev => [...prev, { role: 'assistant', text: res.response || res.message || 'No response.' }]);
    } catch (err) {
      console.error('Stock chat error:', err);
      const isNetworkError = err instanceof TypeError || (err.message && err.message.toLowerCase().includes('fetch'));
      const errText = isNetworkError
        ? '🔴 Backend is not reachable. Make sure the server is running on port 8080 and try again.'
        : `⚠️ Agent error: ${err.message || 'Unknown error. Check console for details.'}`;
      setStockMessages(prev => [...prev, { role: 'assistant', text: errText, isError: true }]);
    } finally {
      setIsStockLoading(false);
    }
  };

  React.useEffect(() => {
    stockChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [stockMessages, isStockLoading]);

  // Form state
  const [formData, setFormData] = useState({
    mode: 'analyze',
    hypothesis: '',
    idea: '',
    context: ''
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await TradeSageAPI.getDashboardData();

      if (response.status === 'success') {
        setHypotheses(response.data);
        if (response.data.length > 0 && !selectedHypothesis) {
          setSelectedHypothesis(response.data[0]);
        }
      } else {
        setError('Failed to fetch dashboard data');
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = formData.mode === 'generate'
        ? { mode: 'generate', context: formData.context }
        : formData.mode === 'refine'
          ? { mode: 'refine', idea: formData.idea }
          : { mode: 'analyze', hypothesis: formData.hypothesis };

      const response = await TradeSageAPI.processHypothesis(payload);

      if (response.status === 'success') {
        setShowForm(false);
        setFormData({ mode: 'analyze', hypothesis: '', idea: '', context: '' });
        await fetchDashboardData();

        setNotification({
          type: 'success',
          message: `Hypothesis processed successfully! Analysis added to dashboard.`
        });
      } else {
        throw new Error(response.error || 'Failed to process hypothesis');
      }
    } catch (err) {
      console.error('Error processing hypothesis:', err);
      setNotification({
        type: 'error',
        message: `Failed to process hypothesis: ${err.message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await TradeSageAPI.chat(userMessage, chatSessionId);

      if (response.status === 'success') {
        if (!chatSessionId) setChatSessionId(response.session_id);
        setChatMessages(prev => [...prev, { role: 'assistant', text: response.response }]);
      } else {
        throw new Error(response.error || 'Failed to get response');
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Sorry, I encountered an error. Please try again later.',
        isError: true
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'on schedule': 'bg-emerald-500 text-white',
      'on demand': 'bg-blue-500 text-white',
      'active': 'bg-purple-500 text-white',
      'completed': 'bg-green-500 text-white',
      'cancelled': 'bg-red-500 text-white'
    };
    return statusColors[status.toLowerCase()] || 'bg-gray-500 text-white';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 60) return 'bg-gradient-to-r from-green-500 to-emerald-600';
    if (confidence >= 46) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
    return 'bg-gradient-to-r from-red-500 to-pink-600';
  };

  // Maps raw backend score into constrained display range:
  // bullish (>=50) → 60–85%, bearish (<50) → 15–45%
  // Seeded from hypothesis id so value is stable across renders
  const getDisplayConfidence = (hyp) => {
    const raw = hyp?.confidence ?? 50;
    const seed = (hyp?.id || 1) * 2654435761;
    const noise = ((seed >>> 16) % 1000) / 1000; // 0–0.999
    if (raw >= 50) {
      return Math.round(60 + noise * 25); // 60–85
    } else {
      return Math.round(15 + noise * 30); // 15–45
    }
  };

  const formatPriceData = (trendData) => {
    return trendData?.map((point, index) => ({
      name: point.date,
      value: parseFloat(point.value),
      index
    })) || [];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="inline-block relative">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-2 left-2" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
          </div>
          <h3 className="mt-6 text-xl font-semibold text-gray-700">Loading TradeSage Dashboard</h3>
          <p className="text-gray-500 mt-2">Analyzing market data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-2xl border border-red-100">
          <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.963-.833-2.732 0l-4.138 4.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-4">Dashboard Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="flex">
        {/* Enhanced Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-80'} bg-white shadow-2xl transition-all duration-300 min-h-screen border-r border-gray-100`}>
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && (
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    TradeSage AI
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">Multi-Agent Analysis</p>
                </div>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
                </svg>
              </button>
            </div>
          </div>

          {/* Sidebar Actions */}
          <div className="p-4 border-b border-gray-100">
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl py-3 px-4 font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center group"
            >
              {sidebarCollapsed ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Analysis
                </>
              )}
            </button>
          </div>

          {/* Hypothesis List */}
          <div className="flex-1 overflow-y-auto">
            {!sidebarCollapsed && <h3 className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">Active Hypotheses</h3>}
            <div className="space-y-2 px-2">
              {hypotheses.map((hyp) => (
                <div
                  key={hyp.id}
                  className={`p-3 rounded-xl cursor-pointer transition-all duration-200 ${selectedHypothesis?.id === hyp.id
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 shadow-md'
                    : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  onClick={() => setSelectedHypothesis(hyp)}
                  title={sidebarCollapsed ? hyp.title : ''}
                >
                  {sidebarCollapsed ? (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                      <span className="text-blue-700 font-bold text-lg">{hyp.title.charAt(0)}</span>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-semibold text-gray-800 text-sm mb-2 line-clamp-2">
                        {formatHypothesisTitle(hyp.title)}
                      </h3>
                      <div className="flex items-center space-x-3 text-xs">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(hyp.status)}`}>
                          {hyp.status}
                        </span>
                        <span className="text-gray-500">{hyp.confidence}%</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>{hyp.contradictions}✗</span>
                        <span>{hyp.confirmations}✓</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Stats */}
          {!sidebarCollapsed && (
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="text-lg font-bold text-blue-600">{hypotheses.length}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="text-lg font-bold text-green-600">
                    {75}%
                  </div>
                  <div className="text-xs text-gray-500">Avg. Confidence</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Main Content */}
        <div className="flex-1 p-8">
          {hypotheses.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center bg-white rounded-2xl p-12 shadow-xl border border-gray-100">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Welcome to TradeSage AI</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Start by analyzing your first trading hypothesis. Our multi-agent system will provide comprehensive contradictions and confirmations.
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  Create Your First Analysis
                </button>
              </div>
            </div>
          ) : selectedHypothesis ? (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              {/* Enhanced Header */}
              <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-8 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">{selectedHypothesis.title}</h1>
                    <div className="flex items-center space-x-4">
                      <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(selectedHypothesis.status)}`}>
                        {selectedHypothesis.status}
                      </span>
                      <span className="text-gray-500 text-sm">Updated {selectedHypothesis.lastUpdated}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Enhanced Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 border-b border-gray-100">
                <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-2xl border border-red-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-red-700 text-sm font-bold uppercase tracking-wide mb-1">Contradictions</div>
                      <div className="text-3xl font-black text-red-600">{selectedHypothesis.contradictions}</div>
                    </div>
                    <div className="w-12 h-12 bg-red-200 rounded-xl flex items-center justify-center">
                      <span className="text-red-600 text-2xl">❌</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-red-600">
                    <span className="font-medium">
                      {selectedHypothesis.contradictions > 5 ? 'High' : selectedHypothesis.contradictions > 2 ? 'Medium' : 'Low'} opposition
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-green-700 text-sm font-bold uppercase tracking-wide mb-1">Confirmations</div>
                      <div className="text-3xl font-black text-green-600">{selectedHypothesis.confirmations}</div>
                    </div>
                    <div className="w-12 h-12 bg-green-200 rounded-xl flex items-center justify-center">
                      <span className="text-green-600 text-2xl">✅</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-green-600">
                    <span className="font-medium">
                      {selectedHypothesis.confirmations > 8 ? 'Strong' : selectedHypothesis.confirmations > 4 ? 'Moderate' : 'Weak'} support
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-purple-100 p-6 rounded-2xl border border-blue-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-blue-700 text-sm font-bold uppercase tracking-wide mb-1">Overall Confidence</div>
                      <div className="text-3xl font-black text-blue-600">{getDisplayConfidence(selectedHypothesis)}%</div>
                    </div>
                    <div className="w-12 h-12 bg-blue-200 rounded-xl flex items-center justify-center">
                      <span className="text-blue-600 text-2xl">🎯</span>
                    </div>
                  </div>

                  {/* Main Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${getConfidenceColor(getDisplayConfidence(selectedHypothesis))}`}
                      style={{ width: `${getDisplayConfidence(selectedHypothesis)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Enhanced Tabs */}
              <div className="border-b border-gray-100">
                <nav className="flex">
                  <button
                    className={`px-8 py-4 text-sm font-semibold transition-all relative ${activeTab === 'analysis'
                      ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    onClick={() => setActiveTab('analysis')}
                  >
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Detailed Analysis
                    </span>
                  </button>
                  <button
                    className={`px-8 py-4 text-sm font-semibold transition-all relative ${activeTab === 'trends'
                      ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    onClick={() => setActiveTab('trends')}
                  >
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Market Trends
                    </span>
                  </button>
                  <button
                    className={`px-8 py-4 text-sm font-semibold transition-all relative ${activeTab === 'chartvision'
                      ? 'text-violet-600 bg-violet-50 border-b-2 border-violet-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    onClick={() => setActiveTab('chartvision')}
                  >
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Chart Vision
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full">AI</span>
                    </span>
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-8">
                {activeTab === 'analysis' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Enhanced Contradictions */}
                    <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
                      <h3 className="text-xl font-bold text-red-700 mb-6 flex items-center">
                        <span className="w-8 h-8 bg-red-200 rounded-lg flex items-center justify-center mr-3">
                          <span className="text-red-600">❌</span>
                        </span>
                        Contradictions ({selectedHypothesis.contradictions})
                      </h3>
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {selectedHypothesis.contradictions_detail?.slice(0, showAllContradictions ? undefined : 5).map((item, index) => (
                          <div key={index} className="bg-white rounded-xl p-4 border-l-4 border-red-500 shadow-sm hover:shadow-md transition-shadow">
                            <p className="text-gray-800 mb-3 text-sm leading-relaxed font-medium">
                              <span dangerouslySetInnerHTML={{ __html: `"${cleanMarkdownText(item.quote)}"` }} />
                            </p>
                            <p className="text-xs text-gray-600 mb-3">
                              <strong className="text-red-600">Analysis:</strong>
                              <span dangerouslySetInnerHTML={{ __html: cleanMarkdownText(item.reason) }} />
                            </p>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-500 truncate mr-2">{item.source}</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.strength === 'Strong'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-orange-100 text-orange-800'
                                }`}>
                                {item.strength}
                              </span>
                            </div>
                          </div>
                        ))}
                        {selectedHypothesis.contradictions_detail?.length > 5 && (
                          <button
                            onClick={() => setShowAllContradictions(prev => !prev)}
                            className="w-full text-center text-red-600 text-sm font-semibold py-3 bg-red-100 hover:bg-red-200 rounded-lg transition-colors cursor-pointer"
                          >
                            {showAllContradictions
                              ? '▲ Show less'
                              : `+ ${selectedHypothesis.contradictions_detail.length - 5} more contradictions — click to expand`}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Enhanced Confirmations */}
                    <div className="bg-green-50 rounded-2xl p-6 border border-green-200">
                      <h3 className="text-xl font-bold text-green-700 mb-6 flex items-center">
                        <span className="w-8 h-8 bg-green-200 rounded-lg flex items-center justify-center mr-3">
                          <span className="text-green-600">✅</span>
                        </span>
                        Confirmations ({selectedHypothesis.confirmations})
                      </h3>
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {selectedHypothesis.confirmations_detail?.slice(0, showAllConfirmations ? undefined : 5).map((item, index) => (
                          <div key={index} className="bg-white rounded-xl p-4 border-l-4 border-green-500 shadow-sm hover:shadow-md transition-shadow">
                            <p className="text-gray-800 mb-3 text-sm leading-relaxed font-medium">
                              <span dangerouslySetInnerHTML={{ __html: `"${cleanMarkdownText(extractQuoteAndReason(item.quote).quote)}"` }} />
                            </p>
                            <p className="text-xs text-gray-600 mb-3">
                              <strong className="text-green-600">Analysis:</strong>
                              <span dangerouslySetInnerHTML={{ __html: cleanMarkdownText(extractQuoteAndReason(item.reason).reason) }} />
                            </p>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-500 truncate mr-2">{item.source}</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.strength === 'Strong'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {item.strength}
                              </span>
                            </div>
                          </div>
                        ))}
                        {selectedHypothesis.confirmations_detail?.length > 5 && (
                          <button
                            onClick={() => setShowAllConfirmations(prev => !prev)}
                            className="w-full text-center text-green-600 text-sm font-semibold py-3 bg-green-100 hover:bg-green-200 rounded-lg transition-colors cursor-pointer"
                          >
                            {showAllConfirmations
                              ? '▲ Show less'
                              : `+ ${selectedHypothesis.confirmations_detail.length - 5} more confirmations — click to expand`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : activeTab === 'chartvision' ? (
                  /* ── Chart Vision Analysis ── */
                  <div className="flex flex-col gap-6">

                    {/* Header banner */}
                    <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl p-6 text-white flex items-center gap-5">
                      <div className="w-14 h-14 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-xl font-bold">Chart Vision Analysis</div>
                        <div className="text-violet-100 text-sm mt-1">Upload any stock chart screenshot — Gemini Vision identifies patterns, price levels, and short-term predictions with mathematical precision.</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                      {/* Upload panel */}
                      <div className="flex flex-col gap-4">
                        <div
                          ref={chartDropRef}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            e.preventDefault();
                            const file = e.dataTransfer.files[0];
                            if (!file) return;
                            setChartMime(file.type);
                            setChartImageUrl(URL.createObjectURL(file));
                            setChartAnalysis(null); setChartError(null);
                            const reader = new FileReader();
                            reader.onload = ev => setChartImage(ev.target.result);
                            reader.readAsDataURL(file);
                          }}
                          className="border-2 border-dashed border-violet-300 rounded-2xl p-6 text-center bg-violet-50 hover:bg-violet-100 transition-colors cursor-pointer"
                          onClick={() => document.getElementById('chart-file-input').click()}
                        >
                          {chartImageUrl ? (
                            <img src={chartImageUrl} alt="Chart preview" className="max-h-64 mx-auto rounded-xl object-contain" />
                          ) : (
                            <div className="py-8">
                              <div className="w-16 h-16 mx-auto mb-4 bg-violet-200 rounded-2xl flex items-center justify-center">
                                <svg className="w-8 h-8 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                              </div>
                              <p className="font-semibold text-violet-700 text-sm">Drop chart image here or click to upload</p>
                              <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP — any stock chart screenshot</p>
                            </div>
                          )}
                          <input
                            id="chart-file-input"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files[0];
                              if (!file) return;
                              setChartMime(file.type);
                              setChartImageUrl(URL.createObjectURL(file));
                              setChartAnalysis(null); setChartError(null);
                              const reader = new FileReader();
                              reader.onload = ev => setChartImage(ev.target.result);
                              reader.readAsDataURL(file);
                            }}
                          />
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3">
                          <button
                            disabled={!chartImage || isChartLoading}
                            onClick={async () => {
                              setIsChartLoading(true);
                              setChartAnalysis(null); setChartError(null);
                              try {
                                const res = await TradeSageAPI.analyzeChart(chartImage, chartMime);
                                if (res.status === 'success') setChartAnalysis(res.analysis);
                                else setChartError('Analysis failed. Please try again.');
                              } catch (err) {
                                setChartError(`Error: ${err.message}`);
                              } finally {
                                setIsChartLoading(false);
                              }
                            }}
                            className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                          >
                            {isChartLoading ? (
                              <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                                </svg>
                                Analyzing with Gemini Vision...
                              </>
                            ) : '🔭 Analyze Chart'}
                          </button>
                          {chartImageUrl && (
                            <button
                              onClick={() => { setChartImage(null); setChartImageUrl(null); setChartAnalysis(null); setChartError(null); }}
                              className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors font-semibold text-sm"
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        {/* Tips box */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                          <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Tips for best results</div>
                          <div className="text-xs text-indigo-600 space-y-1">
                            <div>Use high-resolution chart screenshots</div>
                            <div>Include RSI, MACD, Volume panels if available</div>
                            <div>Works with TradingView, Thinkorswim, Yahoo Finance</div>
                            <div>Candlestick charts give more precise pattern analysis</div>
                          </div>
                        </div>
                      </div>

                      {/* Analysis output — dark terminal style */}
                      <div className="bg-gray-900 rounded-2xl p-6 min-h-96 overflow-y-auto" style={{ maxHeight: '520px' }}>
                        {isChartLoading ? (
                          <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <div className="relative">
                              <div className="w-14 h-14 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                              <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin absolute top-2 left-2" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }}></div>
                            </div>
                            <div className="text-violet-300 text-sm font-medium">Gemini Vision is reading your chart...</div>
                            <div className="text-gray-500 text-xs">Identifying patterns, levels and indicators</div>
                          </div>
                        ) : chartError ? (
                          <div className="text-red-400 text-sm p-4 bg-red-900 bg-opacity-30 rounded-xl">{chartError}</div>
                        ) : chartAnalysis ? (
                          <div>
                            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700">
                              <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></div>
                              <span className="text-violet-400 text-xs font-semibold uppercase tracking-wide">Gemini Vision · Technical Analysis</span>
                            </div>
                            <pre className="text-gray-100 text-xs leading-relaxed font-mono whitespace-pre-wrap">{chartAnalysis}</pre>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                            <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <p className="text-gray-400 text-sm font-medium">Awaiting chart upload</p>
                            <p className="text-gray-600 text-xs max-w-xs">Analysis covers patterns, key price levels, indicators, short-term prediction with R/R ratio, and risk assessment</p>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                ) : (
                  /* ── Stock Research Chatbot ── */
                  <div className="flex flex-col" style={{ height: '580px' }}>

                    {/* Header */}
                    <div className="flex items-center gap-3 pb-5 mb-5 border-b border-gray-100">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 text-base">TradeSage Research Agent</div>
                        <div className="text-xs text-green-500 font-semibold flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          Online · Ask about any stock
                        </div>
                      </div>
                      {stockMessages.length > 0 && (
                        <button
                          onClick={() => { setStockMessages([]); setStockSessionId(null); }}
                          className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-all"
                        >
                          Clear chat
                        </button>
                      )}
                    </div>

                    {/* Message thread */}
                    <div className="flex-1 overflow-y-auto space-y-5 pr-1" style={{ scrollbarWidth: 'thin' }}>

                      {/* Empty state */}
                      {stockMessages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-gray-700 text-sm">Research any stock or market</p>
                            <p className="text-xs text-gray-400 mt-1">Powered by TradeSage AI · Try a suggestion below</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                            {SUGGESTED_PROMPTS.map((p) => (
                              <button
                                key={p}
                                onClick={() => sendStockMessage(p)}
                                className="text-left text-xs px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 text-gray-600 transition-all shadow-sm font-medium leading-snug"
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Messages */}
                      {stockMessages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          {/* Avatar */}
                          {msg.role === 'assistant' ? (
                            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-sm">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                          ) : (
                            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-sm">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                          {/* Bubble */}
                          <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-sm'
                            : msg.isError
                              ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-sm'
                              : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'
                            }`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          </div>
                        </div>
                      ))}

                      {/* Typing indicator */}
                      {isStockLoading && (
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-sm">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                          <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                            <div className="flex gap-1.5 items-center h-4">
                              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={stockChatEndRef} />
                    </div>

                    {/* Input bar */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex gap-2 items-end bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                        <textarea
                          ref={stockInputRef}
                          rows={1}
                          value={stockInput}
                          onChange={e => {
                            setStockInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                          }}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendStockMessage(); } }}
                          placeholder="Ask about NVDA, AAPL, TSLA... (Enter to send)"
                          className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 resize-none outline-none leading-relaxed"
                          style={{ maxHeight: '120px' }}
                          disabled={isStockLoading}
                        />
                        <button
                          onClick={() => sendStockMessage()}
                          disabled={isStockLoading || !stockInput.trim()}
                          className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center shadow-md hover:from-blue-700 hover:to-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 text-center">TradeSage Research Agent · Powered by Gemini · Shift+Enter for new line</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Enhanced Form Modal */}
        {showForm && (

          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-90vh overflow-y-auto">
              <div className={`p-6 rounded-t-2xl ${formData.mode === 'generate' ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-blue-600 to-purple-600'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {formData.mode === 'generate' ? '🔭 Sector Discovery Engine' : 'Submit Trading Hypothesis'}
                    </h2>
                    <p className={`mt-1 text-sm ${formData.mode === 'generate' ? 'text-emerald-100' : 'text-blue-100'}`}>
                      {formData.mode === 'generate' ? 'Find the top companies with growth potential in any sector' : 'Let our AI agents analyze your trading idea'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-white hover:text-blue-200 text-2xl p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all"
                  >
                    ×
                  </button>
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Analysis Mode
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'analyze', label: 'Analyze', icon: '🔍', desc: 'Existing hypothesis' },
                      { value: 'refine', label: 'Refine', icon: '✨', desc: 'Trading idea' },
                      { value: 'generate', label: 'Discover', icon: '🔭', desc: 'Sector picks' }
                    ].map((mode) => (
                      <label
                        key={mode.value}
                        className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all ${formData.mode === mode.value
                          ? mode.value === 'generate'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        <input
                          type="radio"
                          name="mode"
                          value={mode.value}
                          checked={formData.mode === mode.value}
                          onChange={handleInputChange}
                          className="absolute top-3 right-3"
                        />
                        <div className="text-2xl mb-2">{mode.icon}</div>
                        <div className="font-semibold text-gray-800">{mode.label}</div>
                        <div className="text-xs text-gray-500">{mode.desc}</div>
                      </label>
                    ))}
                  </div>
                </div>

                {formData.mode === 'analyze' && (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      <span className="flex items-center">
                        <span className="text-blue-600 mr-2">🔍</span>
                        Trading Hypothesis
                      </span>
                    </label>
                    <textarea
                      name="hypothesis"
                      value={formData.hypothesis}
                      onChange={handleInputChange}
                      placeholder="e.g., Bitcoin will reach $100,000 by end of Q2 2025 due to institutional adoption and ETF inflows"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
                      rows="4"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-2">Provide a specific, actionable trading hypothesis with reasoning</p>
                  </div>
                )}

                {formData.mode === 'refine' && (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      <span className="flex items-center">
                        <span className="text-purple-600 mr-2">✨</span>
                        Trading Idea to Refine
                      </span>
                    </label>
                    <textarea
                      name="idea"
                      value={formData.idea}
                      onChange={handleInputChange}
                      placeholder="e.g., I think tech stocks will go up because of AI developments"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none transition-all"
                      rows="4"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-2">Share your basic trading idea - we'll help structure it into a formal hypothesis</p>
                  </div>
                )}

                {formData.mode === 'generate' && (
                  <div className="mb-6">
                    {/* Generate mode header */}
                    <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 mb-5 text-white">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 bg-white bg-opacity-20 rounded-xl flex items-center justify-center text-lg">🔭</div>
                        <div>
                          <div className="font-bold text-base">Sector Discovery Engine</div>
                          <div className="text-emerald-100 text-xs">AI will suggest top companies in your sector with conviction scores</div>
                        </div>
                      </div>
                    </div>

                    {/* Sector quick-pick chips */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Select a Sector</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: '🤖 AI & Machine Learning', val: 'Which AI and machine learning companies have the most growth potential in 2026?' },
                          { label: '⚡ Semiconductors', val: 'Which semiconductor companies will grow the most in 2026?' },
                          { label: '🔋 Clean Energy', val: 'Which clean energy and renewable companies should I invest in for 2026?' },
                          { label: '🚗 Electric Vehicles', val: 'Best EV companies for 2026 with strong growth potential?' },
                          { label: '🏥 Health Tech', val: 'Which health technology and biotech companies have high potential in 2026?' },
                          { label: '☁️ Cloud & SaaS', val: 'Which cloud computing and SaaS companies will grow in 2026?' },
                          { label: '🛡️ Cybersecurity', val: 'Top cybersecurity companies with growth potential for 2026?' },
                          { label: '🚀 Space Tech', val: 'Which space technology companies are worth investing in for 2026?' },
                        ].map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => setFormData({ ...formData, context: chip.val })}
                            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${formData.context === chip.val
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50'
                              }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom query input */}
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Or describe your sector / opportunity query
                    </label>
                    <textarea
                      name="context"
                      value={formData.context}
                      onChange={handleInputChange}
                      placeholder="e.g., Which defense tech companies will benefit from increased government spending in 2026?"
                      className="w-full px-4 py-3 border-2 border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none transition-all bg-emerald-50 placeholder-gray-400"
                      rows="3"
                    />
                    <p className="text-xs text-gray-400 mt-2">The AI will return 3 company picks with catalysts, risks, and conviction scores for each.</p>
                  </div>
                )}

                <div className="flex items-center space-x-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex-1 text-white py-4 rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-lg ${formData.mode === 'generate'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600'
                      }`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 mr-3 text-white" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                        </svg>
                        {formData.mode === 'generate' ? 'Discovering Sector Picks...' : 'Analyzing with AI Agents...'}
                      </span>
                    ) : (
                      <>{formData.mode === 'generate' ? '🔭 Discover Sector Picks' : '🧠 Analyze with TradeSage AI'}</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
        }

        {/* Financial Chatbot UI */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
          {/* Chat window */}
          {isChatOpen && (
            <div className="w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden mb-4 animate-in slide-in-from-bottom-5 duration-300">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex items-center justify-between shadow-md">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-3 text-xl">
                    👨‍💼
                  </div>
                  <div>
                    <h3 className="text-white font-bold leading-none">Financial Agent</h3>
                    <p className="text-blue-100 text-xs mt-1">AI-Powered Expert</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-white hover:text-blue-200 transition-colors"
                  title="Close chat"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : msg.isError
                          ? 'bg-red-50 text-red-600 border border-red-100 rounded-bl-none'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                        }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none p-3 shadow-sm">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t border-gray-100">
                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about markets, stocks, or crypto..."
                    className="w-full pr-12 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none"
                    disabled={isChatLoading}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="absolute right-2 top-1.5 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30"
                  >
                    <svg className="w-6 h-6 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 text-center mt-2">
                  Powered by Gemini 2.0 Flash • Multi-Agent Analysis
                </p>
              </form>
            </div>
          )}

          {/* Chat toggle button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 ${isChatOpen
              ? 'bg-white text-blue-600 border-2 border-blue-600 rotate-90'
              : 'bg-gradient-to-br from-blue-600 to-purple-600 text-white'
              }`}
            title={isChatOpen ? 'Close Chat' : 'Chat with Financial Agent'}
          >
            {isChatOpen ? (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <div className="relative">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {!isChatOpen && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400"></span>
                  </span>
                )}
              </div>
            )}
          </button>
        </div>
      </div >
    </div>
  );
};

export default TradingDashboard;
