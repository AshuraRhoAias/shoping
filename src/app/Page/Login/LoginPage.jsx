"use client";
import { useEffect, useState } from "react";
import { supabase, fetchAppUser } from "@/lib/supabaseClient";
import "./login.css";

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
    bg: "#0b0f14", card: "rgba(22,27,34,0.72)", border: "rgba(255,255,255,0.08)",
    accent: "#00d4aa", accentEnd: "#00b894", violet: "#7c3aed",
    text: "#e6edf3", muted: "#8b949e", input: "rgba(13,17,23,0.6)", warn: "#f0ad4e", danger: "#f85149",
};

const css = {
    page: { minHeight: "100vh", background: `linear-gradient(160deg, #0b0f14 0%, #0d1117 55%, #0a0e13 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif", color: C.text, padding: "24px 16px" },
    logo: { width: 72, height: 72, borderRadius: 18, background: "#1c2128", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 16 },
    title: { fontSize: 24, fontWeight: 700, margin: "0 0 4px" },
    subtitle: { fontSize: 13, color: C.muted, margin: "0 0 28px" },
    card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.55)" },
    label: { fontSize: 13, color: C.muted, marginBottom: 6, display: "block" },
    inputWrap: { position: "relative", marginBottom: 16 },
    inputIcon: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 15, pointerEvents: "none" },
    input: { width: "100%", background: C.input, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: "12px 14px 12px 40px", outline: "none", boxSizing: "border-box" },
    eyeBtn: { position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 15, padding: 0 },
    btn: { width: "100%", background: `linear-gradient(90deg, ${C.accent}, ${C.accentEnd}, ${C.accent})`, border: "none", borderRadius: 10, color: "#0d1117", fontWeight: 700, fontSize: 15, padding: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
    link: { color: C.accent, textDecoration: "none", fontWeight: 600 },
    footer: { textAlign: "center", fontSize: 13, color: C.muted, marginTop: 18 },
    stepper: { display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 28 },
    stepCircle: (active, done) => ({ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${done ? C.accent : active ? C.accent : C.border}`, background: done ? C.accent : active ? `${C.accent}22` : "transparent", color: done ? "#0d1117" : active ? C.accent : C.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }),
    stepLine: { height: 2, width: 60, background: C.border },
    banner: { background: "#12212a", border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "14px 18px", marginBottom: 18, textAlign: "center" },
    codeInput: { width: "100%", background: C.input, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 22, padding: "12px", textAlign: "center", outline: "none", boxSizing: "border-box", marginBottom: 14 },
    successIcon: { width: 64, height: 64, borderRadius: "50%", background: "#00d4aa22", border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" },
};

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
    return <span className="login-spinner" style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(0,0,0,.3)", borderTopColor: "#0d1117", borderRadius: "50%" }} />;
}

// ─── Fondo animado ────────────────────────────────────────────────────────────
function AuroraBackground() {
    return (
        <>
            <div className="login-blob login-blob--a" />
            <div className="login-blob login-blob--b" />
            <div className="login-blob login-blob--c" />
        </>
    );
}

// ─── Input helper ─────────────────────────────────────────────────────────────
function Input({ label, icon, type = "text", placeholder, value, onChange, showEye, onEyeToggle, showPassword }) {
    return (
        <div>
            {label && <label style={css.label}>{label}</label>}
            <div style={css.inputWrap}>
                <span style={css.inputIcon}>{icon}</span>
                <input
                    className="login-input"
                    style={css.input}
                    type={showEye ? (showPassword ? "text" : "password") : type}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoComplete="off"
                />
                {showEye && (
                    <button className="login-eye-btn" style={css.eyeBtn} onClick={onEyeToggle} type="button">
                        {showPassword ? "🙈" : "👁"}
                    </button>
                )}
            </div>
        </div>
    );
}

function Stepper({ step }) {
    return (
        <div style={css.stepper}>
            {[1, 2, 3].map((n, i) => (
                <div key={n} style={{ display: "flex", alignItems: "center" }}>
                    <div className="login-step-circle" style={css.stepCircle(step === n, step > n)}>{step > n ? "✓" : n}</div>
                    {i < 2 && <div className={`login-step-line${step > n ? " login-step-line--done" : ""}`} style={css.stepLine} />}
                </div>
            ))}
        </div>
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

    const submit = async () => {
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
        <>
            <h3 style={{ margin: "0 0 20px", fontSize: 17 }}>Tus datos</h3>
            <Input label="Nombre completo *" icon="👤" placeholder="Juan García" value={name} onChange={setName} />
            <Input label="Correo electrónico *" icon="✉️" type="email" placeholder="tu@correo.com" value={email} onChange={setEmail} />
            <Input label="Teléfono *" icon="📞" placeholder="55 1234 5678" value={phone} onChange={setPhone} />
            <Input label="Contraseña *" icon="🔒" placeholder="Mínimo 6 caracteres" value={pass} onChange={setPass} showEye showPassword={showPass} onEyeToggle={() => setShowPass(!showPass)} />
            <Input label="Confirmar contraseña *" icon="🔒" placeholder="Repite tu contraseña" value={confirm} onChange={setConfirm} showEye showPassword={showConfirm} onEyeToggle={() => setShowConfirm(!showConfirm)} />
            {error && <p className="login-error" style={{ color: C.danger, fontSize: 13, margin: "4px 0 8px" }}>{error}</p>}
            <button className="login-btn" style={{ ...css.btn, opacity: loading ? .6 : 1, cursor: loading ? "not-allowed" : "pointer" }} onClick={submit} disabled={loading}>
                {loading ? <Spinner /> : "Continuar"}
            </button>
            <p style={css.footer}>¿Ya tienes cuenta? <a className="login-link" style={css.link} href="#" onClick={(e) => { e.preventDefault(); onLogin(); }}>Iniciar sesión</a></p>
        </>
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

    const verify = async () => {
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
        <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#00d4aa22", border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>🛡️</div>
                <h3 style={{ margin: "0 0 6px" }}>Verificación</h3>
                <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
                    Enviamos un código de 6 dígitos a<br />
                    <span style={{ color: C.accent }}>{email}</span>
                </p>
            </div>
            <div className="login-banner" style={css.banner}>
                <span style={{ fontSize: 12, color: C.muted }}>📩 Revisa tu bandeja de entrada (y spam) e ingresa el código.</span>
            </div>
            <label style={css.label}>Ingresa el código de 6 dígitos</label>
            <input
                className="login-otp-input"
                style={css.codeInput}
                maxLength={6}
                placeholder="000000"
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
            />
            {error && <p className="login-error" style={{ color: C.danger, fontSize: 13, margin: "0 0 8px", textAlign: "center" }}>{error}</p>}
            <button className="login-btn" style={{ ...css.btn, opacity: loading ? .6 : 1, cursor: loading ? "not-allowed" : "pointer" }} onClick={verify} disabled={loading}>
                {loading ? <Spinner /> : "Verificar cuenta"}
            </button>
            <p style={css.footer}>
                <a className="login-link" style={{ ...css.link, opacity: cooldown > 0 ? .5 : 1, pointerEvents: cooldown > 0 || resending ? "none" : "auto" }} href="#" onClick={(e) => { e.preventDefault(); resend(); }}>
                    {cooldown > 0 ? `Reenviar código (${cooldown}s)` : resending ? "Enviando…" : "Reenviar código"}
                </a>
            </p>
            <p style={css.footer}><a className="login-link" style={css.link} href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>← Volver</a></p>
        </>
    );
}

// ─── Step 3 — éxito ───────────────────────────────────────────────────────────
function Step3({ name, onGoToStore, loading }) {
    return (
        <div style={{ textAlign: "center" }}>
            <div className="login-success-icon" style={css.successIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path className="login-success-check" d="M4 12.5L9.5 18L20 6" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 20 }}>¡Cuenta creada!</h3>
            <p style={{ color: C.muted, fontSize: 13, margin: "0 0 4px" }}>Bienvenido/a, <strong style={{ color: C.text }}>{name}</strong></p>
            <p style={{ color: C.muted, fontSize: 13, margin: "0 0 24px" }}>Tu cuenta ha sido verificada exitosamente</p>
            <button className="login-btn" style={{ ...css.btn, opacity: loading ? .6 : 1 }} onClick={onGoToStore} disabled={loading}>
                {loading ? <Spinner /> : "Ir a la tienda"}
            </button>
        </div>
    );
}

// ─── LoginScreen — Supabase Auth ──────────────────────────────────────────────
function LoginScreen({ onLogin, onRegister }) {
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async () => {
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
        <div onKeyDown={(e) => e.key === "Enter" && submit()}>
            <Input label="Correo electrónico" icon="✉️" type="email" placeholder="correo@ejemplo.com" value={email} onChange={setEmail} />
            <Input label="Contraseña" icon="🔒" placeholder="••••••••" value={pass} onChange={setPass} showEye showPassword={showPass} onEyeToggle={() => setShowPass(!showPass)} />
            {error && <p className="login-error" style={{ color: C.danger, fontSize: 13, margin: "4px 0 8px" }}>{error}</p>}
            <button className="login-btn" style={{ ...css.btn, opacity: loading ? .6 : 1, cursor: loading ? "not-allowed" : "pointer" }} onClick={submit} disabled={loading}>
                {loading ? <Spinner /> : <><span>Iniciar sesión</span><span>›</span></>}
            </button>
            <p style={css.footer}>¿Eres cliente? <a className="login-link" style={css.link} href="#" onClick={(e) => { e.preventDefault(); onRegister(); }}>Crear cuenta</a></p>
        </div>
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
        <div className="login-page" style={css.page}>
            <AuroraBackground />
            <div className="login-logo" style={css.logo}>🏋️</div>
            <h1 className="login-title" style={css.title}>Fit & Ecoree House</h1>
            <p className="login-subtitle" style={css.subtitle}>
                {mode === "login" ? "Sistema de gestión · Inicia sesión" : "Crear cuenta de cliente · Fit & Ecoree House"}
            </p>
            <div className="login-card" style={css.card}>
                {mode === "register" && <Stepper step={regStep} />}

                {mode === "login" && (
                    <div key="login" className="login-step">
                        <LoginScreen onLogin={handleLogin} onRegister={() => { setMode("register"); setRegStep(1); }} />
                    </div>
                )}
                {mode === "register" && regStep === 1 && (
                    <div key="reg-1" className="login-step">
                        <Step1 onNext={handleStep1} onLogin={() => setMode("login")} />
                    </div>
                )}
                {mode === "register" && regStep === 2 && (
                    <div key="reg-2" className="login-step">
                        <Step2 email={regData.email} onNext={handleStep2} onBack={() => setRegStep(1)} />
                    </div>
                )}
                {mode === "register" && regStep === 3 && (
                    <div key="reg-3" className="login-step">
                        <Step3 name={regData.name} onGoToStore={handleGoStore} loading={goingToStore} />
                    </div>
                )}
            </div>
        </div>
    );
}
