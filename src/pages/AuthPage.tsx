import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Shield, ChevronRight, Store, Building2, Mail, Lock } from 'lucide-react';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';

interface AuthPageProps {
  onboardingOnly?: boolean;
}

export function AuthPage({ onboardingOnly = false }: AuthPageProps) {
  const { loginWithGoogle, loginWithEmail, registerNewTenantAndOwner, currentUser, userProfile } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [outletName, setOutletName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Email login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = (location.state as any)?.from?.pathname || '/dashboard';

  // Handle Google SS0 Login Action
  const handleGoogleLogin = async () => {
    try {
      setErrorMsg('');
      const cred = await loginWithGoogle();
      // Inspect if registration is already linked in Firestore
      if (cred.user) {
        // Fetch to confirm profileexists
        navigate(fromPath, { replace: true });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal menyinkronkan autentikasi akun Google. Silakan coba kembali.');
    }
  };

  // Handle Email/Password Login Action
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Email dan password wajib diisi.');
      return;
    }

    try {
      setEmailLoading(true);
      setErrorMsg('');
      const cred = await loginWithEmail(email, password);

      if (cred.user) {
        // Query users collection for this UID to ensure they are registered in the tenant system
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase/config');
        const userDocRef = doc(db, 'users', cred.user.uid);
        const userSnapshot = await getDoc(userDocRef);

        if (!userSnapshot.exists()) {
          // If profile does not exist in Firestore, they are not registered in the tenant system!
          await signOut(auth); // Sign out so they don't get stuck in auth change listener
          setErrorMsg('Akun belum terdaftar dalam sistem tenant.');
          return;
        }

        navigate(fromPath, { replace: true });
      }
    } catch (err: any) {
      console.error("Email login failure:", err);
      const errorCode = err.code || '';
      if (
        errorCode === 'auth/wrong-password' || 
        errorCode === 'auth/invalid-credential' || 
        errorCode === 'auth/invalid-login-credentials'
      ) {
        setErrorMsg('Email atau password salah.');
      } else if (errorCode === 'auth/user-not-found') {
        setErrorMsg('User tidak ditemukan.');
      } else if (errorCode === 'auth/invalid-email') {
        setErrorMsg('Format email tidak valid.');
      } else {
        setErrorMsg('Email atau password salah.');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  // Handle Enterprise Setup form submit
  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !outletName.trim()) {
      setErrorMsg('Nama entitas bisnis dan cabang wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await registerNewTenantAndOwner(businessName, outletName);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Konfigurasi tenant gagal disimpan. Verifikasi hak akses Firestore Anda.');
    } finally {
      setSubmitting(false);
    }
  };

  if (onboardingOnly || (currentUser && !userProfile)) {
    // Show Onboarding screen
    return (
      <div className="min-h-screen w-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-slate-800 bg-slate-950 text-slate-100 select-none">
          <CardHeader 
            className="bg-slate-950 border-b border-slate-900" 
            subtitle="Inisialisasi ruang kerja multi-tenant digital baru Anda"
            action={<Store className="w-5 h-5 text-blue-500" />}
          >
            Sambut Bisnis Laundry Baru
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="bg-blue-950/20 border border-blue-900/30 p-3 rounded-lg text-[11px] text-blue-400 font-sans leading-relaxed">
              <strong>Info:</strong> Anda terdeteksi baru pertama kali menggunakan LaundryKu SaaS. Tolong isi parameter primer untuk menyemai database kustom Anda.
            </div>

            {errorMsg && (
              <div className="text-rose-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded text-[11px] font-sans">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleOnboardingSubmit} className="space-y-4 font-sans text-slate-300">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-500" /> Nama Usaha (Tenant)
                </label>
                <input
                  type="text"
                  placeholder="Ketik nama bisnis laundry (mis. Laundry Barokah)"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                  <Store className="w-3 h-3 text-slate-500" /> Nama Cabang Utama (Outlet)
                </label>
                <input
                  type="text"
                  placeholder="Nama cabang perdana (mis. Cabang Margonda Depok)"
                  value={outletName}
                  onChange={(e) => setOutletName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={submitting}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Aktifkan Enterprise Workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Otherwise, render full login card
  return (
    <div className="min-h-screen w-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 select-none font-sans">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 bg-blue-600 rounded-2xl items-center justify-center font-extrabold text-white text-2xl shadow-inner">
            🧺
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">
            LaundryKu Enterprise Portal
          </h1>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
            Sistem ERP dan manajemen Kasir Multi-Tenant Laundry terintegrasi untuk UMKM.
          </p>
        </div>

        <Card className="border-slate-205">
          <CardHeader subtitle="Gunakan SSO Google atau alamat email terdaftar">
            Akses Hak Masuk Pengguna
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {errorMsg && (
              <div className="text-rose-600 bg-red-50 border border-red-200 p-2.5 rounded text-xs font-sans">
                ⚠️ {errorMsg}
              </div>
            )}

            <Button
              onClick={handleGoogleLogin}
              variant="outline"
              className="w-full border-slate-300 text-slate-650 hover:bg-slate-50 text-xs py-2.5"
              leftIcon={
                <svg className="w-4 h-4 mr-1 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.14-5.136 4.14A5.5 5.5 0 1 1 14 6.9a5.378 5.378 0 0 1 3.529 1.341l3.14-3.14C18.612 3.105 15.525 1.5 12 1.5a10.5 10.5 0 1 0 10.5 10.5c0-.585-.075-1.125-.195-1.715H12.24z"
                  />
                </svg>
              }
            >
              Lanjutkan dengan Google Workspace
            </Button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-[9px] text-slate-400 tracking-wider font-extrabold uppercase">
                ATAU LOGIN DENGAN EMAIL
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-3.5">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Alamat Email
                </label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 pr-3 focus:outline-none placeholder:text-slate-300"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" /> Kata Sandi (Password)
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 pr-3 focus:outline-none placeholder:text-slate-300"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full text-xs font-bold py-2.5 mt-2"
                isLoading={emailLoading}
              >
                Masuk ke Aplikasi
              </Button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-4 text-[9px] text-slate-350 tracking-wide font-extrabold uppercase">
                Zero Trust Privacy & Isolation
              </span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            <div className="flex items-start gap-2.5 text-[10px] text-slate-500 leading-relaxed font-sans bg-slate-50 p-3 rounded-lg border border-slate-150">
              <Shield className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <span>Sistem multi-tenant menjamin data transaksi Anda terisolasi secara kriptografis dan logis dari bisnis lain.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
