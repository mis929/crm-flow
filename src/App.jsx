import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { 
  Plus, Search, LayoutGrid, List, Trash2, Edit, Building, Users, Tag, 
  BarChart3, Activity, ArrowRight, LogOut, Lock, Mail, CheckCircle, Clock, Calendar, DollarSign, TrendingUp, Award, UserPlus, Building2, KeyRound, ShieldCheck
} from 'lucide-react';

// Hardcoded Admin Email for OTP Approvals
const ADMIN_EMAIL = 'mis@dakon.in';

export default function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Strict OTP Approval States
  const [authStep, setAuthStep] = useState('credentials'); // 'credentials' | 'otp_verification'
  const [pendingUser, setPendingUser] = useState(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpInfoMessage, setOtpInfoMessage] = useState('');

  // Active Navigation Tab State
  const [activeTab, setActiveTab] = useState('deals');

  // CRM App State
  const [deals, setDeals] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list');

  // Chart Interactive Hover State
  const [hoveredMonth, setHoveredMonth] = useState(null);

  // Modals Visibility
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // Edit Mode State for Deals CRUD
  const [editingDealId, setEditingDealId] = useState(null);

  // Form State for Deals
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState('Lead');
  const [companyId, setCompanyId] = useState('');
  const [contactId, setContactId] = useState('');
  const [closeDate, setCloseDate] = useState('');

  // Form State for Contacts
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCompanyId, setContactCompanyId] = useState('');

  // Form State for Companies
  const [companyName, setCompanyName] = useState('');

  // Form State for Activities
  const [actTitle, setActTitle] = useState('');
  const [actType, setActType] = useState('Call');
  const [actDealId, setActDealId] = useState('');
  const [actDueDate, setActDueDate] = useState('');

  // Strict Auth State Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) checkUserApprovalStatus(session);
      else setSession(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) checkUserApprovalStatus(session);
      else setSession(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check if User is Approved in profiles Table
  async function checkUserApprovalStatus(userSession) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userSession.user.id)
      .maybeSingle();

    if (profile?.role === 'admin' || userSession.user.email === ADMIN_EMAIL || profile?.is_approved) {
      setSession(userSession);
    } else {
      // Force SignOut if not approved
      await supabase.auth.signOut();
      setSession(null);
    }
  }

  // Fetch Data on valid session
  useEffect(() => {
    if (session) {
      fetchAllData();
    }
  }, [session]);

  function fetchAllData() {
    fetchDeals();
    fetchCompaniesAndContacts();
    fetchActivities();
  }

  // Fetch Deals
  async function fetchDeals() {
    const { data, error } = await supabase
      .from('deals')
      .select(`
        *,
        companies:company_id ( id, name ),
        contacts:contact_id ( id, name, email )
      `)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching deals:', error);
    else setDeals(data || []);
  }

  // Fetch Companies and Contacts
  async function fetchCompaniesAndContacts() {
    const { data: compData, error: compErr } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    const { data: contData, error: contErr } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });

    if (compErr) console.error('Error fetching companies:', compErr);
    else setCompanies(compData || []);

    if (contErr) console.error('Error fetching contacts:', contErr);
    else setContacts(contData || []);
  }

  // Fetch Activities
  async function fetchActivities() {
    const { data, error } = await supabase
      .from('activities')
      .select(`
        *,
        deals:deal_id ( title )
      `)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching activities:', error);
    else setActivities(data || []);
  }

  // Helper to Generate 6-Digit OTP
  function generate6DigitOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // AUTH & OTP HANDLING
  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError('');
    setOtpInfoMessage('');

    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      
      // Force immediate signOut so user is not logged in directly
      await supabase.auth.signOut();

      if (error) {
        setAuthError(error.message);
      } else {
        alert('Signup successful! Admin approval ke liye OTP verification complete karein.');
        
        // Trigger OTP generation for newly signed up user
        if (data?.user) {
          await triggerOTPFlow(data.user.id, data.user.email);
        }
      }
      return;
    }

    // Sign In Flow
    const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

    if (signInErr) {
      setAuthError(signInErr.message);
      return;
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email;

    // Check if user profile is already approved
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

    if (profile?.role === 'admin' || userEmail === ADMIN_EMAIL || profile?.is_approved) {
      setSession(authData.session);
      setIsAuthModalOpen(false);
      return;
    }

    // Force signout till OTP is approved
    await supabase.auth.signOut();

    // Trigger OTP Flow
    await triggerOTPFlow(userId, userEmail);
  }

  // Function to create OTP record and prompt user
  async function triggerOTPFlow(userId, userEmail) {
    const otpCode = generate6DigitOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 Min Expiry

    const { error: otpErr } = await supabase.from('login_otps').insert([{
      user_id: userId,
      user_email: userEmail,
      admin_email: ADMIN_EMAIL,
      otp_code: otpCode,
      is_verified: false,
      expires_at: expiresAt
    }]);

    if (otpErr) {
      setAuthError('OTP Request create karne me issue aaya: ' + otpErr.message);
    } else {
      setPendingUser({ id: userId, email: userEmail });
      setAuthStep('otp_verification');
      setOtpInfoMessage(`Admin (${ADMIN_EMAIL}) ko verification OTP create kar diya gaya hai.`);
    }
  }

  // Verify OTP & Grant Access
  async function handleVerifyAdminOTP(e) {
    e.preventDefault();
    setAuthError('');

    if (!pendingUser) {
      setAuthError('Session invalid. Please login again.');
      return;
    }

    const { data: otpRecords, error } = await supabase
      .from('login_otps')
      .select('*')
      .eq('user_id', pendingUser.id)
      .eq('otp_code', enteredOtp.trim())
      .eq('is_verified', false)
      .order('created_at', { ascending: false });

    if (error || !otpRecords || otpRecords.length === 0) {
      setAuthError('Galat OTP Code ya OTP expire ho chuka hai.');
      return;
    }

    const validRecord = otpRecords[0];
    if (new Date(validRecord.expires_at) < new Date()) {
      setAuthError('OTP Expire ho gaya hai. Login wapas try karein.');
      return;
    }

    // Mark OTP Verified & Set is_approved = true
    await supabase.from('login_otps').update({ is_verified: true }).eq('id', validRecord.id);
    await supabase.from('profiles').update({ is_approved: true }).eq('id', pendingUser.id);

    alert('Admin OTP Approval Successful! Ab login complete kiya ja raha hai.');

    // Final Login Step
    const { data: finalAuth, error: reAuthErr } = await supabase.auth.signInWithPassword({ email, password });
    
    if (reAuthErr) {
      setAuthError('Login complete karne me error: ' + reAuthErr.message);
    } else {
      setSession(finalAuth.session);
      setIsAuthModalOpen(false);
      setAuthStep('credentials');
      setEnteredOtp('');
    }
  }

  // Handle Logout
  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  // Open Edit Deal Modal
  function handleEditDealClick(deal) {
    setEditingDealId(deal.id);
    setTitle(deal.title || '');
    setValue(deal.value || '');
    setStage(deal.stage || 'Lead');
    setCompanyId(deal.company_id ? String(deal.company_id) : '');
    setContactId(deal.contact_id ? String(deal.contact_id) : '');
    setCloseDate(deal.close_date || '');
    setIsDealModalOpen(true);
  }

  // Reset Deal Form
  function resetDealForm() {
    setEditingDealId(null);
    setTitle('');
    setValue('');
    setStage('Lead');
    setCompanyId('');
    setContactId('');
    setCloseDate('');
  }

  // Save or Update Deal
  async function handleSaveDeal(e) {
    e.preventDefault();
    const dealPayload = {
      title,
      value: parseFloat(value),
      stage,
      close_date: closeDate ? closeDate : null,
      company_id: companyId ? parseInt(companyId) : null,
      contact_id: contactId ? parseInt(contactId) : null,
      user_id: session?.user?.id
    };

    if (editingDealId) {
      const { error } = await supabase.from('deals').update(dealPayload).eq('id', editingDealId);
      if (error) alert('Error updating deal: ' + error.message);
      else { setIsDealModalOpen(false); resetDealForm(); fetchDeals(); }
    } else {
      const { error } = await supabase.from('deals').insert([dealPayload]);
      if (error) alert('Error adding deal: ' + error.message);
      else { setIsDealModalOpen(false); resetDealForm(); fetchDeals(); }
    }
  }

  // Delete Deal
  async function handleDeleteDeal(id) {
    if (confirm("Kya aap is deal ko delete karna chahte hain?")) {
      const { error } = await supabase.from('deals').delete().eq('id', id);
      if (error) alert('Error deleting deal: ' + error.message);
      else fetchDeals();
    }
  }

  // Add Contact
  async function handleAddContact(e) {
    e.preventDefault();
    const newContact = { name: contactName, email: contactEmail, company_id: contactCompanyId ? parseInt(contactCompanyId) : null, user_id: session?.user?.id };
    const { error } = await supabase.from('contacts').insert([newContact]);
    if (error) alert('Error adding contact: ' + error.message);
    else { setIsContactModalOpen(false); setContactName(''); setContactEmail(''); setContactCompanyId(''); fetchCompaniesAndContacts(); }
  }

  // Add Company
  async function handleAddCompany(e) {
    e.preventDefault();
    const newCompany = { name: companyName, user_id: session?.user?.id };
    const { error } = await supabase.from('companies').insert([newCompany]);
    if (error) alert('Error adding company: ' + error.message);
    else { setIsCompanyModalOpen(false); setCompanyName(''); fetchCompaniesAndContacts(); }
  }

  // Add Activity
  async function handleAddActivity(e) {
    e.preventDefault();
    const newActivity = { title: actTitle, type: actType, deal_id: actDealId ? parseInt(actDealId) : null, due_date: actDueDate ? actDueDate : null, completed: false, user_id: session?.user?.id };
    const { error } = await supabase.from('activities').insert([newActivity]);
    if (error) alert('Error adding activity: ' + error.message);
    else { setIsActivityModalOpen(false); setActTitle(''); setActType('Call'); setActDealId(''); setActDueDate(''); fetchActivities(); }
  }

  // Toggle Activity Status
  async function toggleActivityStatus(id, currentStatus) {
    await supabase.from('activities').update({ completed: !currentStatus }).eq('id', id);
    fetchActivities();
  }

  async function handleDeleteActivity(id) {
    if (confirm("Kya aap is activity ko delete karna chahte hain?")) {
      await supabase.from('activities').delete().eq('id', id);
      fetchActivities();
    }
  }

  // Analytics Math
  const totalValue = deals.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const wonDeals = deals.filter(d => d.stage === 'Closed Won');
  const wonValue = wonDeals.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const winRate = deals.length > 0 ? ((wonDeals.length / deals.length) * 100).toFixed(0) : 0;
  const avgDealValue = deals.length > 0 ? (totalValue / deals.length).toFixed(0) : 0;

  const filteredDeals = deals.filter(deal => deal.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // Dynamic Chart Data
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const chartData = monthNames.map((month, idx) => {
    const monthDeals = deals.filter(d => d.created_at && new Date(d.created_at).getMonth() === idx);
    return {
      month,
      pipeline: monthDeals.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
      won: monthDeals.filter(item => item.stage === 'Closed Won').reduce((sum, item) => sum + (Number(item.value) || 0), 0)
    };
  });

  const maxPipelineVal = Math.max(...chartData.map(d => d.pipeline), 0);
  const maxChartValue = maxPipelineVal > 0 ? maxPipelineVal * 1.2 : 10000;

  // LANDING PAGE / AUTH
  if (!session) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] text-gray-800 flex flex-col justify-between font-sans">
        <header className="max-w-7xl mx-auto w-full px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 text-white p-2 rounded-xl text-lg font-bold shadow-sm shadow-orange-300">🔥</div>
            <span className="text-xl font-extrabold tracking-tight text-gray-900">Flow<span className="text-orange-500">CRM</span></span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => { setAuthMode('signin'); setAuthStep('credentials'); setIsAuthModalOpen(true); }} className="text-sm font-semibold text-gray-700 hover:text-orange-600">Sign in</button>
            <button onClick={() => { setAuthMode('signup'); setAuthStep('credentials'); setIsAuthModalOpen(true); }} className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-md">Get Started</button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 text-center py-16">
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-6">CRM for <span className="text-orange-500">Small Businesses</span></h1>
          <button onClick={() => { setAuthMode('signin'); setAuthStep('credentials'); setIsAuthModalOpen(true); }} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg">Start Selling Free</button>
        </main>

        {isAuthModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100">
              {authStep === 'credentials' ? (
                <>
                  <h3 className="text-xl font-bold mb-4">{authMode === 'signin' ? 'Sign In' : 'Sign Up'}</h3>
                  {authError && <div className="text-red-500 text-xs mb-3 bg-red-50 p-2 rounded-lg">{authError}</div>}
                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full border p-2 rounded-xl text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
                      <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full border p-2 rounded-xl text-sm" />
                    </div>
                    <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-sm">{authMode === 'signin' ? 'Proceed to Approval' : 'Sign Up & Request OTP'}</button>
                  </form>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2 text-orange-600">
                    <ShieldCheck size={22} />
                    <h3 className="text-lg font-bold text-gray-900">Admin OTP Verification</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{otpInfoMessage}</p>
                  {authError && <div className="text-red-500 text-xs mb-3 bg-red-50 p-2 rounded-lg">{authError}</div>}
                  <form onSubmit={handleVerifyAdminOTP} className="space-y-4">
                    <input required type="text" maxLength="6" value={enteredOtp} onChange={(e) => setEnteredOtp(e.target.value)} placeholder="Enter 6-Digit Admin OTP" className="w-full border p-2.5 rounded-xl text-center text-lg font-bold tracking-widest" />
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm">Verify OTP & Unlock CRM</button>
                    <button type="button" onClick={() => setAuthStep('credentials')} className="w-full text-xs text-gray-400 hover:underline">Back to Login</button>
                  </form>
                </>
              )}
              <button onClick={() => setIsAuthModalOpen(false)} className="mt-3 text-xs text-gray-400 block text-center w-full">Close</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DASHBOARD
  return (
    <div className="flex h-screen bg-[#FAF8F5] text-gray-800 font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-orange-100 flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="bg-orange-500 text-white p-2 rounded-xl font-bold text-xl">🔥</div>
            <h1 className="text-xl font-bold tracking-wide text-gray-900">Flow<span className="text-orange-500">CRM</span></h1>
          </div>

          <button onClick={() => { resetDealForm(); setIsDealModalOpen(true); }} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 mb-6 shadow-sm shadow-orange-200">
            <Plus size={18} /> New Deal
          </button>

          <nav className="space-y-1">
            <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${activeTab === 'overview' ? 'bg-orange-100/70 text-orange-600 font-bold' : 'text-gray-600 hover:bg-orange-50'}`}>
              <LayoutGrid size={18}/> Overview
            </button>
            <button onClick={() => setActiveTab('contacts')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${activeTab === 'contacts' ? 'bg-orange-100/70 text-orange-600 font-bold' : 'text-gray-600 hover:bg-orange-50'}`}>
              <Users size={18}/> Contacts <span className="ml-auto bg-orange-200/60 text-orange-800 text-xs px-2 py-0.5 rounded-full">{contacts.length}</span>
            </button>
            <button onClick={() => setActiveTab('companies')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${activeTab === 'companies' ? 'bg-orange-100/70 text-orange-600 font-bold' : 'text-gray-600 hover:bg-orange-50'}`}>
              <Building size={18}/> Companies <span className="ml-auto bg-orange-200/60 text-orange-800 text-xs px-2 py-0.5 rounded-full">{companies.length}</span>
            </button>
            <button onClick={() => setActiveTab('deals')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${activeTab === 'deals' ? 'bg-orange-100/70 text-orange-600 font-bold' : 'text-gray-600 hover:bg-orange-50'}`}>
              <Tag size={18}/> Deals <span className="ml-auto bg-orange-200/60 text-orange-800 text-xs px-2 py-0.5 rounded-full">{deals.length}</span>
            </button>
            <button onClick={() => setActiveTab('activities')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${activeTab === 'activities' ? 'bg-orange-100/70 text-orange-600 font-bold' : 'text-gray-600 hover:bg-orange-50'}`}>
              <Activity size={18}/> Activities <span className="ml-auto bg-orange-200/60 text-orange-800 text-xs px-2 py-0.5 rounded-full">{activities.length}</span>
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${activeTab === 'analytics' ? 'bg-orange-100/70 text-orange-600 font-bold' : 'text-gray-600 hover:bg-orange-50'}`}>
              <BarChart3 size={18}/> Analytics
            </button>
          </nav>
        </div>

        <div className="border-t border-gray-100 pt-4 flex items-center justify-between px-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-sm">
              {session.user.email[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-gray-800 truncate">{session.user.email.split('@')[0]}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 p-1.5"><LogOut size={18} /></button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-8">
        
        {/* EXECUTIVE OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Executive Overview</h2>
                <p className="text-xs text-gray-500">Pipeline metrics, stage health, and recent activities</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-orange-100/80 text-orange-900 px-4 py-2 rounded-xl text-xs font-bold border border-orange-200">
                  Open Pipeline: <span className="text-orange-600 font-black">${totalValue.toLocaleString()}</span>
                </div>
                <button onClick={() => { resetDealForm(); setIsDealModalOpen(true); }} className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm flex items-center gap-1.5">
                  <Plus size={15}/> New Deal
                </button>
              </div>
            </div>

            {/* QUICK ACTIONS BAR */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm mb-8 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-gray-900">Quick Actions</h3>
                <p className="text-xs text-gray-400">Accelerate your workflow with 1-click record creation</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { resetDealForm(); setIsDealModalOpen(true); }} className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5">
                  <Plus size={14}/> Add Deal
                </button>
                <button onClick={() => setIsContactModalOpen(true)} className="bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold text-xs px-3.5 py-2 rounded-xl border border-orange-200 flex items-center gap-1.5">
                  <UserPlus size={14}/> Add Contact
                </button>
                <button onClick={() => setIsCompanyModalOpen(true)} className="bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold text-xs px-3.5 py-2 rounded-xl border border-orange-200 flex items-center gap-1.5">
                  <Building2 size={14}/> Add Company
                </button>
                <button onClick={() => setIsActivityModalOpen(true)} className="bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold text-xs px-3.5 py-2 rounded-xl border border-orange-200 flex items-center gap-1.5">
                  <Clock size={14}/> Add Activity
                </button>
              </div>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-4 gap-5 mb-8">
              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Open Pipeline</p>
                  <p className="text-2xl font-black text-gray-900">${totalValue.toLocaleString()}</p>
                  <p className="text-xs text-orange-600 font-bold mt-1">{deals.length} active deals in pipeline</p>
                </div>
                <div className="p-3 bg-orange-50 text-orange-500 rounded-xl"><DollarSign size={22}/></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Revenue Won</p>
                  <p className="text-2xl font-black text-emerald-600">${wonValue.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600 font-bold mt-1">{wonDeals.length} deals closed successfully</p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl"><Award size={22}/></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Contacts</p>
                  <p className="text-2xl font-black text-gray-900">{contacts.length}</p>
                  <p className="text-xs text-gray-500 font-medium mt-1">Active client relationships</p>
                </div>
                <div className="p-3 bg-amber-50 text-amber-500 rounded-xl"><Users size={22}/></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Companies</p>
                  <p className="text-2xl font-black text-gray-900">{companies.length}</p>
                  <p className="text-xs text-gray-500 font-medium mt-1">Accounts in client rolodex</p>
                </div>
                <div className="p-3 bg-blue-50 text-blue-500 rounded-xl"><Building size={22}/></div>
              </div>
            </div>

            {/* STAGE BREAKDOWN & ACTIVITIES ROW */}
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 text-sm">Pipeline by Stage</h3>
                  <button onClick={() => setActiveTab('deals')} className="text-xs text-orange-600 font-bold hover:underline">View Kanban &gt;</button>
                </div>
                <div className="space-y-4">
                  {['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won'].map((stg) => {
                    const stageDeals = deals.filter(d => d.stage === stg);
                    const stageVal = stageDeals.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
                    const percentage = totalValue > 0 ? ((stageVal / totalValue) * 100).toFixed(0) : 0;

                    return (
                      <div key={stg}>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-gray-700">{stg} <span className="text-gray-400 font-normal">({stageDeals.length} deals)</span></span>
                          <span className="text-gray-900">${stageVal.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-orange-500 h-2.5 rounded-full transition-all" style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RECENT ACTIVITIES SUMMARY */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 text-sm">Recent Activities</h3>
                  <button onClick={() => setActiveTab('activities')} className="text-xs text-orange-600 font-bold hover:underline">View all &gt;</button>
                </div>
                <div className="space-y-3">
                  {activities.slice(0, 4).map(act => (
                    <div key={act.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                      <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg text-xs font-bold">{act.type[0]}</div>
                      <div>
                        <p className="text-xs font-bold text-gray-900">{act.title}</p>
                        <p className="text-[10px] text-gray-400">{act.due_date || 'No due date'}</p>
                      </div>
                    </div>
                  ))}
                  {activities.length === 0 && <p className="text-xs text-gray-400 text-center py-6">No recent activities</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTACTS TAB */}
        {activeTab === 'contacts' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Contacts List</h2>
              <button onClick={() => setIsContactModalOpen(true)} className="bg-orange-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5">
                <UserPlus size={16}/> Add Contact
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-[11px] font-bold text-gray-400 uppercase">
                    <th className="p-4">ID</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td className="p-4 font-bold">{c.id}</td>
                      <td className="p-4 font-semibold text-gray-900">{c.name}</td>
                      <td className="p-4 text-gray-600">{c.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COMPANIES TAB */}
        {activeTab === 'companies' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Companies List</h2>
              <button onClick={() => setIsCompanyModalOpen(true)} className="bg-orange-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5">
                <Building2 size={16}/> Add Company
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-[11px] font-bold text-gray-400 uppercase">
                    <th className="p-4">ID</th>
                    <th className="p-4">Company Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {companies.map((comp) => (
                    <tr key={comp.id}>
                      <td className="p-4 font-bold">{comp.id}</td>
                      <td className="p-4 font-semibold text-gray-900">{comp.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DEALS TAB (FULL CRUD FUNCTIONALITY) */}
        {activeTab === 'deals' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Deals Pipeline</h2>
                <p className="text-sm text-gray-500">Visual Kanban workflow with interactive drag and drop</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-orange-100 text-orange-900 px-4 py-2 rounded-xl text-sm font-semibold border border-orange-200">
                  Open Pipeline: <span className="text-orange-600 font-bold">${totalValue.toLocaleString()}</span>
                </div>
                <button onClick={() => { resetDealForm(); setIsDealModalOpen(true); }} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 shadow-sm flex items-center gap-2">
                  <Plus size={16}/> Add Deal
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6 gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input type="text" placeholder="Search deals by title..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border rounded-xl text-sm focus:outline-none" />
              </div>
              <div className="bg-white p-1 rounded-xl border flex gap-1">
                <button onClick={() => setViewMode('board')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${viewMode === 'board' ? 'bg-orange-100 text-orange-600' : 'text-gray-500'}`}>
                  <LayoutGrid size={16}/>
                </button>
                <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${viewMode === 'list' ? 'bg-orange-100 text-orange-600' : 'text-gray-500'}`}>
                  <List size={16}/>
                </button>
              </div>
            </div>

            {viewMode === 'list' ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b bg-gray-50 text-[11px] font-bold text-gray-400 uppercase">
                      <th className="p-4">Deal Title</th>
                      <th className="p-4">Company</th>
                      <th className="p-4">Contact</th>
                      <th className="p-4">Value</th>
                      <th className="p-4">Stage</th>
                      <th className="p-4">Close Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {filteredDeals.map((deal) => (
                      <tr key={deal.id} className="hover:bg-gray-50/50">
                        <td className="p-4 font-bold text-gray-900">{deal.title}</td>
                        <td className="p-4 text-gray-600">{deal.companies?.name || '—'}</td>
                        <td className="p-4 text-gray-600">{deal.contacts?.name || '—'}</td>
                        <td className="p-4 font-bold">${Number(deal.value).toLocaleString()}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-100 text-orange-700">
                            {deal.stage}
                          </span>
                        </td>
                        <td className="p-4 text-gray-500">{deal.close_date || 'N/A'}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleEditDealClick(deal)} className="text-gray-400 hover:text-orange-600 p-1 rounded-md hover:bg-orange-50 transition-colors" title="Edit Deal">
                              <Edit size={16}/>
                            </button>
                            <button onClick={() => handleDeleteDeal(deal.id)} className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors" title="Delete Deal">
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {['Lead', 'Qualified', 'Proposal', 'Negotiation'].map((stg) => (
                  <div key={stg} className="bg-gray-50 p-4 rounded-2xl border min-h-[300px]">
                    <h3 className="font-bold text-sm text-gray-700 mb-3">{stg}</h3>
                    {deals.filter(d => d.stage === stg).map(deal => (
                      <div key={deal.id} className="bg-white p-4 rounded-xl border mb-3 shadow-sm flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm">{deal.title}</p>
                          <p className="text-orange-600 font-bold">${Number(deal.value).toLocaleString()}</p>
                        </div>
                        <button onClick={() => handleEditDealClick(deal)} className="text-gray-400 hover:text-orange-600">
                          <Edit size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVITIES TAB */}
        {activeTab === 'activities' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Activities & Tasks</h2>
                <p className="text-sm text-gray-500">Track all team interactions, calls, emails, and meetings</p>
              </div>
              <button onClick={() => setIsActivityModalOpen(true)} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 shadow-sm flex items-center gap-2">
                <Plus size={16}/> Log Activity
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-[11px] font-bold text-gray-400 uppercase">
                    <th className="p-4">Status</th>
                    <th className="p-4">Activity Title</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Associated Deal</th>
                    <th className="p-4">Due Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {activities.length > 0 ? (
                    activities.map((act) => (
                      <tr key={act.id} className="hover:bg-orange-50/20">
                        <td className="p-4">
                          <button onClick={() => toggleActivityStatus(act.id, act.completed)} className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${act.completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            <CheckCircle size={14}/> {act.completed ? 'Completed' : 'Pending'}
                          </button>
                        </td>
                        <td className={`p-4 font-bold ${act.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{act.title}</td>
                        <td className="p-4">
                          <span className="bg-gray-100 px-2 py-1 rounded-md text-xs font-semibold text-gray-700">{act.type}</span>
                        </td>
                        <td className="p-4 text-gray-600">{act.deals?.title || '—'}</td>
                        <td className="p-4 text-gray-500">{act.due_date || 'N/A'}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleDeleteActivity(act.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-400">Koi activity nahi hai. Nayi activity log karein!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Revenue Analytics</h2>
                <p className="text-xs text-gray-500">Deep dive into win rates, deal velocity, and growth trends</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-orange-100/80 text-orange-900 px-4 py-2 rounded-xl text-xs font-bold border border-orange-200">
                  Open Pipeline: <span className="text-orange-600 font-black">${totalValue.toLocaleString()}</span>
                </span>
              </div>
            </div>

            {/* TOP STAT CARDS */}
            <div className="grid grid-cols-4 gap-5 mb-8">
              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">WIN RATE</p>
                  <p className="text-2xl font-black text-gray-900">{winRate}%</p>
                  <p className="text-xs text-emerald-600 font-bold mt-1"><span className="text-emerald-700">{wonDeals.length} won</span> vs <span className="text-red-500">{deals.length - wonDeals.length} open/lost</span></p>
                </div>
                <div className="p-3 bg-orange-50 text-orange-500 rounded-xl"><Award size={22}/></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">AVG DEAL SIZE</p>
                  <p className="text-2xl font-black text-gray-900">${Number(avgDealValue).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 font-medium mt-1">Across opportunities</p>
                </div>
                <div className="p-3 bg-amber-50 text-amber-500 rounded-xl"><DollarSign size={22}/></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">CLOSED WON</p>
                  <p className="text-2xl font-black text-emerald-600">${wonValue.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 font-medium mt-1">Realized bookings to date</p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl"><TrendingUp size={22}/></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">OPEN PIPELINE</p>
                  <p className="text-2xl font-black text-orange-600">${totalValue.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 font-medium mt-1">Active sales opportunities</p>
                </div>
                <div className="p-3 bg-orange-50 text-orange-500 rounded-xl"><Activity size={22}/></div>
              </div>
            </div>

            {/* BAR CHART GRAPH */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm relative">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Monthly Revenue & Pipeline Forecast</h3>
                  <p className="text-xs text-gray-400">Historical won revenue paired with active pipeline momentum</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span>
                    <span className="text-gray-600">Open Pipeline</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                    <span className="text-gray-600">Revenue Won</span>
                  </div>
                </div>
              </div>

              <div className="h-64 flex items-end justify-between gap-3 pt-8 pb-2 border-b border-gray-100 px-4 relative">
                {chartData.map((item, index) => {
                  const pipelineHeight = maxChartValue > 0 ? (item.pipeline / maxChartValue) * 100 : 0;
                  const wonHeight = maxChartValue > 0 ? (item.won / maxChartValue) * 100 : 0;
                  const isHovered = hoveredMonth === index;

                  return (
                    <div 
                      key={item.month} 
                      onMouseEnter={() => setHoveredMonth(index)}
                      onMouseLeave={() => setHoveredMonth(null)}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                    >
                      {/* INTERACTIVE TOOLTIP */}
                      {isHovered && (
                        <div className="absolute -top-12 z-20 bg-gray-900 text-white text-[11px] p-2.5 rounded-xl shadow-xl border border-gray-700 pointer-events-none whitespace-nowrap min-w-[120px]">
                          <p className="font-bold text-center border-b border-gray-700 pb-1 mb-1">{item.month}</p>
                          <p className="text-orange-400 font-semibold">Pipeline: ${item.pipeline.toLocaleString()}</p>
                          <p className="text-emerald-400 font-semibold">Won: ${item.won.toLocaleString()}</p>
                        </div>
                      )}

                      <div className="flex items-end gap-1.5 h-full w-full justify-center">
                        <div className="w-3 md:w-3.5 bg-orange-500 rounded-t-lg transition-all duration-300 group-hover:bg-orange-600" style={{ height: `${Math.max(pipelineHeight, 4)}%` }}></div>
                        <div className="w-3 md:w-3.5 bg-emerald-500 rounded-t-lg transition-all duration-300 group-hover:bg-emerald-600" style={{ height: `${Math.max(wonHeight, 4)}%` }}></div>
                      </div>

                      <span className="text-[11px] font-bold text-gray-400 mt-3 group-hover:text-gray-900">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* CREATE / EDIT DEAL MODAL */}
      {isDealModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{editingDealId ? 'Edit Deal' : 'Add New Deal'}</h3>
            <form onSubmit={handleSaveDeal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Deal Title</label>
                <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company</label>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm bg-white">
                  <option value="">Select Company (Optional)</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contact</label>
                <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm bg-white">
                  <option value="">Select Contact (Optional)</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Value ($)</label>
                <input required type="number" value={value} onChange={(e) => setValue(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Stage</label>
                <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm bg-white">
                  <option value="Lead">Lead</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Proposal">Proposal</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Closed Won">Closed Won</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Target Close Date</label>
                <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setIsDealModalOpen(false); resetDealForm(); }} className="flex-1 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2 text-sm bg-orange-500 text-white font-bold rounded-xl">{editingDealId ? 'Update Deal' : 'Save Deal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CONTACT MODAL */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Contact</h3>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Name</label>
                <input required type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. John Doe" className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="john@company.com" className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company</label>
                <select value={contactCompanyId} onChange={(e) => setContactCompanyId(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm bg-white">
                  <option value="">Select Company (Optional)</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsContactModalOpen(false)} className="flex-1 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2 text-sm bg-orange-500 text-white font-bold rounded-xl">Save Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE COMPANY MODAL */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Company</h3>
            <form onSubmit={handleAddCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name</label>
                <input required type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Corp" className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsCompanyModalOpen(false)} className="flex-1 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2 text-sm bg-orange-500 text-white font-bold rounded-xl">Save Company</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ACTIVITY MODAL */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Log New Activity</h3>
            <form onSubmit={handleAddActivity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Activity Title</label>
                <input required type="text" value={actTitle} onChange={(e) => setActTitle(e.target.value)} placeholder="e.g. Follow-up Call with Client" className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                <select value={actType} onChange={(e) => setActType(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm bg-white">
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Task">Task</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Associated Deal</label>
                <select value={actDealId} onChange={(e) => setActDealId(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm bg-white">
                  <option value="">Select Deal (Optional)</option>
                  {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date</label>
                <input type="date" value={actDueDate} onChange={(e) => setActDueDate(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsActivityModalOpen(false)} className="flex-1 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2 text-sm bg-orange-500 text-white font-bold rounded-xl">Save Activity</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}