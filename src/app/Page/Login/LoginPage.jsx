"use client";
import { useEffect, useState } from "react";
import { supabase, fetchAppUser } from "@/lib/supabaseClient";
import "./login.css";

// ─── Traducción de errores de Supabase Auth ──────────────────────────────────
function translateAuthError(err) {
    const msg = err?.message || "";
    if (/invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
    if (/email not confirmed/i.test(msg)) return "Confirma tu correo antes de iniciar sesión.";
    if (/user already registered/i.test(msg)) return "Ya existe una cuenta con ese correo.";
    if (/password should be at least/i.test(msg)) return "La contraseña debe tener mínimo 6 caracteres.";
    if (/rate limit/i.test(msg)) return "Demasiados intentos. Espera un momento e intenta de nuevo.";
    if (/token has expired|invalid otp|invalid token/i.test(msg)) return "Código incorrecto o expirado.";
    return msg || "Ocurrió un error. Intenta de nuevo.";
}

function slugifyUsername(name, fallback) {
    const base = (name || fallback || "usuario").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
    return (base || "usuario") + Math.floor(1000 + Math.random() * 9000);
}

function Spinner() {
    return <span className="login-spinner" />;
}

// ─── Fondo animado ────────────────────────────────────────────────────────────
function AuroraBackground() {
    return (
        <div className="login-bg" aria-hidden="true">
            <span className="login-blob login-blob--a" />
            <span className="login-blob login-blob--b" />
            <span className="login-blob login-blob--c" />
        </div>
    );
}

// ─── Input helper ─────────────────────────────────────────────────────────────
function Input({ label, icon, type = "text", placeholder, value, onChange, showEye, onEyeToggle, showPassword }) {
    return (
        <div>
            {label && <label className="login-label">{label}</label>}
            <div className="login-input-wrap">
                <span className="login-input-icon">{icon}</span>
                <input
                    className="login-input"
                    type={showEye ? (showPassword ? "text" : "password") : type}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoComplete="off"
                />
                {showEye && (
                    <button className="login-eye-btn" onClick={onEyeToggle} type="button">
                        {showPassword ? "🙈" : "👁"}
                    </button>
                )}
            </div>
        </div>
    );
}

function Stepper({ step }) {
    return (
        <ol className="login-stepper">
            {[1, 2, 3].map((n, i) => (
                <li key={n} className="login-step-item">
                    <span className={`login-step-circle${step === n ? " login-step-circle--active" : ""}${step > n ? " login-step-circle--done" : ""}`}>{step > n ? "✓" : n}</span>
                    {i < 2 && <span className={`login-step-line${step > n ? " login-step-line--done" : ""}`} />}
                </li>
            ))}
        </ol>
    );
}

// ─── Step 1 — registro con Supabase Auth ─────────────────────────────────────
function Step1({ onNext, onLogin }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [pass, setPass] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!name || !email || !phone || !pass || !confirm) return setError("Completa todos los campos.");
        if (pass.length < 6) return setError("La contraseña debe tener mínimo 6 caracteres.");
        if (pass !== confirm) return setError("Las contraseñas no coinciden.");
        setError("");
        setLoading(true);
        try {
            const username = slugifyUsername(name, email.split("@")[0]);
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password: pass,
                options: { data: { name, phone, username } },
            });
            if (signUpError) throw signUpError;
            onNext({ name, email, password: pass, needsVerification: !data.session });
        } catch (err) {
            setError(translateAuthError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={submit}>
            <h3 className="login-step-title">Tus datos</h3>
            <Input label="Nombre completo *" icon="👤" placeholder="Juan García" value={name} onChange={setName} />
            <Input label="Correo electrónico *" icon="✉️" type="email" placeholder="tu@correo.com" value={email} onChange={setEmail} />
            <Input label="Teléfono *" icon="📞" placeholder="55 1234 5678" value={phone} onChange={setPhone} />
            <Input label="Contraseña *" icon="🔒" placeholder="Mínimo 6 caracteres" value={pass} onChange={setPass} showEye showPassword={showPass} onEyeToggle={() => setShowPass(!showPass)} />
            <Input label="Confirmar contraseña *" icon="🔒" placeholder="Repite tu contraseña" value={confirm} onChange={setConfirm} showEye showPassword={showConfirm} onEyeToggle={() => setShowConfirm(!showConfirm)} />
            {error && <p className="login-error">{error}</p>}
            <button className="login-btn" type="submit" disabled={loading}>
                {loading ? <Spinner /> : "Continuar"}
            </button>
            <p className="login-footer">¿Ya tienes cuenta? <a className="login-link" href="#" onClick={(e) => { e.preventDefault(); onLogin(); }}>Iniciar sesión</a></p>
        </form>
    );
}

// ─── Step 2 — verificación de correo con Supabase OTP ────────────────────────
function Step2({ email, onNext, onBack }) {
    const [input, setInput] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
        return () => clearInterval(t);
    }, [cooldown]);

    const verify = async (e) => {
        e.preventDefault();
        if (input.length < 6) return setError("El código debe tener 6 dígitos.");
        setError("");
        setLoading(true);
        try {
            const { error: otpError } = await supabase.auth.verifyOtp({ email, token: input, type: "signup" });
            if (otpError) throw otpError;
            onNext();
        } catch (err) {
            setError(translateAuthError(err));
        } finally {
            setLoading(false);
        }
    };

    const resend = async () => {
        if (cooldown > 0) return;
        setResending(true);
        setError("");
        try {
            const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
            if (resendError) throw resendError;
            setCooldown(30);
        } catch (err) {
            setError(translateAuthError(err));
        } finally {
            setResending(false);
        }
    };

    return (
        <form onSubmit={verify}>
            <header className="login-verify">
                <span className="login-verify__icon">🛡️</span>
                <h3 className="login-verify__title">Verificación</h3>
                <p className="login-verify__text">
                    Enviamos un código de 6 dígitos a<br />
                    <span className="login-verify__email">{email}</span>
                </p>
            </header>
            <aside className="login-banner">
                <span className="login-banner__text">📩 Revisa tu bandeja de entrada (y spam) e ingresa el código.</span>
            </aside>
            <label className="login-label">Ingresa el código de 6 dígitos</label>
            <input
                className="login-otp-input"
                maxLength={6}
                placeholder="000000"
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
            />
            {error && <p className="login-error login-error--center">{error}</p>}
            <button className="login-btn" type="submit" disabled={loading}>
                {loading ? <Spinner /> : "Verificar cuenta"}
            </button>
            <p className="login-footer">
                <a className={`login-link${cooldown > 0 || resending ? " login-link--disabled" : ""}`} href="#" onClick={(e) => { e.preventDefault(); resend(); }}>
                    {cooldown > 0 ? `Reenviar código (${cooldown}s)` : resending ? "Enviando…" : "Reenviar código"}
                </a>
            </p>
            <p className="login-footer"><a className="login-link" href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>← Volver</a></p>
        </form>
    );
}

// ─── Step 3 — éxito ───────────────────────────────────────────────────────────
function Step3({ name, onGoToStore, loading }) {
    return (
        <section className="login-success">
            <span className="login-success-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path className="login-success-check" d="M4 12.5L9.5 18L20 6" stroke="#00d4aa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
            <h3 className="login-success__title">¡Cuenta creada!</h3>
            <p className="login-success__text">Bienvenido/a, <strong>{name}</strong></p>
            <p className="login-success__text login-success__text--gap">Tu cuenta ha sido verificada exitosamente</p>
            <button className="login-btn" onClick={onGoToStore} disabled={loading}>
                {loading ? <Spinner /> : "Ir a la tienda"}
            </button>
        </section>
    );
}

// ─── LoginScreen — Supabase Auth ──────────────────────────────────────────────
function LoginScreen({ onLogin, onRegister }) {
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!email || !pass) return setError("Completa todos los campos.");
        setError("");
        setLoading(true);
        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password: pass });
            if (signInError) throw signInError;
            const appUser = await fetchAppUser(data.session);
            onLogin(appUser);
        } catch (err) {
            setError(translateAuthError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={submit}>
            <Input label="Correo electrónico" icon="✉️" type="email" placeholder="correo@ejemplo.com" value={email} onChange={setEmail} />
            <Input label="Contraseña" icon="🔒" placeholder="••••••••" value={pass} onChange={setPass} showEye showPassword={showPass} onEyeToggle={() => setShowPass(!showPass)} />
            {error && <p className="login-error">{error}</p>}
            <button className="login-btn" type="submit" disabled={loading}>
                {loading ? <Spinner /> : <><span>Iniciar sesión</span><span>›</span></>}
            </button>
            <p className="login-footer">¿Eres cliente? <a className="login-link" href="#" onClick={(e) => { e.preventDefault(); onRegister(); }}>Crear cuenta</a></p>
        </form>
    );
}

// ─── Componente principal exportado ──────────────────────────────────────────
export default function LoginPage({ onLoginSuccess }) {
    const [mode, setMode] = useState("login");
    const [regStep, setRegStep] = useState(1);
    const [regData, setRegData] = useState({});
    const [goingToStore, setGoingToStore] = useState(false);

    const handleLogin = (user) => {
        if (onLoginSuccess) onLoginSuccess(user);
    };

    const handleStep1 = (data) => {
        setRegData(data);
        setRegStep(data.needsVerification ? 2 : 3);
    };

    const handleStep2 = () => setRegStep(3);

    const handleGoStore = async () => {
        setGoingToStore(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const appUser = await fetchAppUser(session);
            if (onLoginSuccess) onLoginSuccess(appUser);
        } finally {
            setGoingToStore(false);
        }
    };

    return (
        <>
            <AuroraBackground />
            <main className="login-page">
                <span className="login-logo">🏋️</span>
                <h1 className="login-title">Fit &amp; Ecoree House</h1>
                <p className="login-subtitle">
                    {mode === "login" ? "Sistema de gestión · Inicia sesión" : "Crear cuenta de cliente · Fit & Ecoree House"}
                </p>
                <section className="login-card">
                    {mode === "register" && <Stepper step={regStep} />}

                    {mode === "login" && (
                        <section key="login" className="login-step">
                            <LoginScreen onLogin={handleLogin} onRegister={() => { setMode("register"); setRegStep(1); }} />
                        </section>
                    )}
                    {mode === "register" && regStep === 1 && (
                        <section key="reg-1" className="login-step">
                            <Step1 onNext={handleStep1} onLogin={() => setMode("login")} />
                        </section>
                    )}
                    {mode === "register" && regStep === 2 && (
                        <section key="reg-2" className="login-step">
                            <Step2 email={regData.email} onNext={handleStep2} onBack={() => setRegStep(1)} />
                        </section>
                    )}
                    {mode === "register" && regStep === 3 && (
                        <section key="reg-3" className="login-step">
                            <Step3 name={regData.name} onGoToStore={handleGoStore} loading={goingToStore} />
                        </section>
                    )}
                </section>
            </main>
        </>
    );
}
