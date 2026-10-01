import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, ArrowRight } from 'lucide-react';
import { verifyAndLogin, updatePassword } from '../lib/auth';
import { loginWithGoogle } from '../lib/firebase';

interface AuthModalProps {
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const isValid = await verifyAndLogin(password);
      if (isValid) {
        onSuccess();
      } else {
        setError('Incorrect password. Please verify your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPass !== confirmPass) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await updatePassword(newPass);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
      sessionStorage.setItem('ishizaki_session_token', 'ACTIVE_VALID_STUDENT_SESSION');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-7 shadow-2xl dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800">
            <Lock className="h-6 w-6 text-stone-900 dark:text-stone-100" />
          </div>
          <h2 className="mt-4 font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Ishizaki Academic OS
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Private single-user cognitive vault. Enter your master password to unlock.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            {error}
          </div>
        )}

        {!isChangingPass ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Master Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (default: ishizaki_student)"
                className="mt-1 w-full rounded-lg border border-stone-300 p-2.5 text-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 focus:outline-none focus:border-stone-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-stone-900 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-stone-800 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
            >
              <span>Unlock Ishizaki</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setIsChangingPass(true)}
                className="text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
              >
                Set / Change Private Password
              </button>
            </div>

            <div className="relative my-3 text-center">
              <span className="bg-white px-2 text-[10px] text-stone-400 dark:bg-stone-900">OR</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
            >
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>Sign in with Google Master Account</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleSetNewPassword} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                New Master Password
              </label>
              <input
                type="password"
                required
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1 w-full rounded-lg border border-stone-300 p-2.5 text-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Re-enter password"
                className="mt-1 w-full rounded-lg border border-stone-300 p-2.5 text-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsChangingPass(false)}
                className="w-1/2 rounded-lg border border-stone-300 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-1/2 rounded-lg bg-stone-900 py-2 text-xs font-medium text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
              >
                Save & Unlock
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
