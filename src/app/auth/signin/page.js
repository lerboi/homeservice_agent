'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SignInPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError('');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
    setLoading(false);
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    let result;
    if (isSignUp) {
      result = await supabase.auth.signUp({ email, password });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }

    if (result.error) {
      setError(result.error.message);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-slate-900">HomeService AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white min-h-11"
          >
            {t('signin_google')}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-slate-500">or</span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base text-slate-900">{t('email_label')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@example.com"
                required
                disabled={loading}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base text-slate-900">{t('password_label')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="min-h-11"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white min-h-11"
            >
              {isSignUp ? 'Sign up' : t('signin_email')}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-center text-sm text-blue-600 underline"
          >
            {isSignUp ? t('signin_link') : t('signup_link')}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
