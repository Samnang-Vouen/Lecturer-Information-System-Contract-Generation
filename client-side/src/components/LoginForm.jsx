import React, { useState } from "react";
import { Building2, Loader2, Eye, EyeOff } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from '../store/useAuthStore.js';
import Button from "./ui/Button.jsx";
import Input from "./ui/Input.jsx";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/Card.jsx";

export default function LoginForm() {
    // Central email regex (case-insensitive) – keep simple to avoid HTML pattern quirks
    const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@cadt\.edu\.kh$/i;
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
    const navigate = useNavigate();
    const { login, isLoggingIn } = useAuthStore();
    const location = useLocation();
    const from = location.state?.from || null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedPassword = password.trim();
    const emailPattern = EMAIL_REGEX;
        if (!trimmedEmail || !trimmedPassword) {
            setError("Email and password are required");
            return;
        }
        if (!emailPattern.test(trimmedEmail)) {
            setError("Email must be in the format youremail@cadt.edu.kh");
            return;
        }
        if (trimmedPassword.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        try {
            const res = await login({ email: trimmedEmail, password: trimmedPassword });
            const role = res?.user?.role || res?.role;
            // If we came from a protected route, go back there
            if (from) {
                navigate(from, { replace: true });
                return;
            }
            if (role) {
                navigate(`/${role}`, { replace: true });
            } else {
                setError('Unauthorized');
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-blue-900 flex flex-col items-center justify-center gap-2">
                    <Building2 className="w-8 h-8 text-blue-700" />
                    LCMS
                </CardTitle>
                <CardDescription className="text-center">Lecturer Contract Management System</CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
                <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                        const val = e.target.value;
                        setEmail(val);
                        setFieldErrors(fe => ({ ...fe, email: val && !EMAIL_REGEX.test(val.toLowerCase()) ? 'Email must be in the format youremail@cadt.edu.kh' : '' }));
                        // Clear submit-level error if user is fixing
                        if (error) setError('');
                    }}
                    placeholder="youremail@cadt.edu.kh"
                    className="placeholder-gray-600 placeholder-opacity-90"
                    required
                    // Use regex source to avoid accidental escaping / unsupported flags issues
                    pattern={EMAIL_REGEX.source}
                    title="Email must be in the format youremail@cadt.edu.kh"
                />
                {fieldErrors.email && <p className="text-xs text-red-600" role="alert">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
                        <div className="relative">
                            <Input
                                className="placeholder-gray-600 placeholder-opacity-90 pr-10"
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setPassword(val);
                                    setFieldErrors(fe => ({ ...fe, password: val && val.length < 6 ? 'Password must be at least 6 characters' : '' }));
                                    if (error) setError('');
                                }}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                autoComplete="current-password"
                            />
                            {fieldErrors.password && <p className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.password}</p>}
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(p => !p)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                        </div>
                </div>
                {error && !fieldErrors.email && !fieldErrors.password && (
                    <p className="text-sm text-red-600" role="alert">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? (
                    <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                    </>
                ) : (
                    "Sign In"
                )}
                </Button>
            </form>
            </CardContent>
        </Card>
        </div>
    );
}
