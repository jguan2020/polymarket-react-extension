import { useState } from 'react';

//AWS API to handle authentication via Cognito
const awsApi = 'https://koge3v5c0f.execute-api.us-east-1.amazonaws.com/Prod';

export function useAuthApi() {
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  //Sign in handler
  const signIn = async (email: string, password: string) => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      const res = await fetch(`${awsApi}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Login failed');
      const data = await res.json();
      setToken(data.idToken);
      setUserEmail(email);
      return data;
    } catch (err: any) {
      setAuthError(err.message ?? 'Login failed');
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  //Sign up handler
  const signUp = async (email: string, password: string) => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      const res = await fetch(`${awsApi}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Sign-up failed');
    } catch (err: any) {
      setAuthError(err.message ?? 'Sign-up failed');
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  //Sign out handler
  const signOut = () => {
    setToken(null);
    setUserEmail(null);
  };


  return { token, userEmail, authLoading, authError, signIn, signUp, signOut };
}
