import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BRAND } from '@/components/common/Branding';
import BrandLogo from '@/components/common/BrandLogo';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const params = new URLSearchParams(location.search);
        const redirect = params.get('redirect') || '/';
        navigate(redirect, { replace: true });
      }
    });
  }, []);

  const getRedirect = () => {
    const params = new URLSearchParams(location.search);
    return params.get('redirect') || '/';
  };

  const parseError = (err) => {
    console.error('[Login] Supabase error:', JSON.stringify(err, null, 2));
    const msg = err?.message || err?.msg || err?.error_description || '';
    const errCode = err?.error_code || err?.code || '';
    if (msg.includes('Database error saving new user') || errCode === 'unexpected_failure') {
      return 'Erro de banco de dados: as tabelas do sistema não foram criadas. Execute o arquivo supabase-schema.sql no painel do Supabase.';
    }
    if (!msg || msg === '{}' || msg === 'null') {
      return 'Erro ao conectar com o servidor. Verifique sua conexão e se o projeto Supabase está ativo.';
    }
    if (msg === 'Invalid login credentials') return 'Email ou senha incorretos.';
    if (msg === 'Email not confirmed') return 'Confirme seu email antes de entrar. Verifique sua caixa de entrada.';
    if (msg.includes('User already registered')) return 'Este email já está cadastrado. Faça login ou recupere sua senha.';
    if (msg.includes('Password should be at least')) return 'A senha deve ter no mínimo 6 caracteres.';
    if (msg.includes('Unable to validate email address')) return 'Email inválido. Verifique e tente novamente.';
    if (msg.includes('signup is disabled')) return 'Cadastro desabilitado. Ative "Email auth" no painel do Supabase.';
    if (msg.includes('fetch')) return 'Sem conexão com o servidor. Verifique se o projeto Supabase está ativo.';
    return msg;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate(getRedirect(), { replace: true });
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      // Criar profile manualmente caso o trigger não tenha rodado
      if (data?.user?.id) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.email,
        }, { onConflict: 'id', ignoreDuplicates: true });
      }

      setMessage('Conta criada com sucesso! Você já pode fazer login.');
      setMode('login');
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setMessage('Email de recuperação enviado. Verifique sua caixa de entrada.');
      setMode('login');
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center">
              <BrandLogo className="h-10 w-auto" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{BRAND.name}</h1>
          <p className="text-gray-500 mt-1">Gestão completa de facilities</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-center">
              {mode === 'login' && 'Entrar na sua conta'}
              {mode === 'register' && 'Criar nova conta'}
              {mode === 'forgot' && 'Recuperar senha'}
            </CardTitle>
            {mode === 'login' && (
              <CardDescription className="text-center">
                Use seu email e senha para acessar o sistema
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {message && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                {message}
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleForgotPassword} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="mt-1"
                />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'login' && 'Entrar'}
                {mode === 'register' && 'Criar conta'}
                {mode === 'forgot' && 'Enviar email de recuperação'}
              </Button>
            </form>

            <div className="mt-4 text-center space-y-2">
              {mode === 'login' && (
                <>
                  <button
                    onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                    className="text-sm text-blue-600 hover:underline block w-full"
                  >
                    Esqueci minha senha
                  </button>
                  <button
                    onClick={() => { setMode('register'); setError(''); setMessage(''); }}
                    className="text-sm text-gray-500 hover:text-gray-700 block w-full"
                  >
                    Não tem conta? <span className="text-blue-600">Criar conta</span>
                  </button>
                </>
              )}
              {(mode === 'register' || mode === 'forgot') && (
                <button
                  onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Voltar para o login
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} {BRAND.name} — Sistema de Gestão de Facilities
          {" · "}
          <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="hover:underline">
            Política de Privacidade
          </a>
        </p>
      </div>
    </div>
  );
}
