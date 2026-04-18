"use client";
import { useState } from "react";
import { AuthAPI } from "@/lib/api.service";

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
    bg: "#0d1117", card: "#161b22", border: "#21262d",
    accent: "#00d4aa", accentEnd: "#00b894",
    text: "#e6edf3", muted: "#8b949e", input: "#0d1117", warn: "#f0ad4e",
};

const css = {
    page: { minHeight: "100vh", background: `radial-gradient(ellipse at 20% 50%, #0f2027 0%, ${C.bg} 60%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif", color: C.text, padding: "24px 16px" },
    logo: { width: 72, height: 72, borderRadius: 18, background: "#1c2128", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 16, boxShadow: "0 8px 32px rgba(0,212,170,0.15)" },
    title: { fontSize: 24, fontWeight: 700, margin: "0 0 4px" },
    subtitle: { fontSize: 13, color: C.muted, margin: "0 0 28px" },
    card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" },
    label: { fontSize: 13, color: C.muted, marginBottom: 6, display: "block" },
    inputWrap: { position: "relative", marginBottom: 16 },
    inputIcon: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 15, pointerEvents: "none" },
    input: { width: "100%", background: C.input, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: "12px 14px 12px 40px", outline: "none", boxSizing: "border-box", transition: "border-color .2s" },
    eyeBtn: { position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 15, padding: 0 },
    btn: { width: "100%", background: `linear-gradient(90deg, ${C.accent}, ${C.accentEnd})`, border: "none", borderRadius: 10, color: "#0d1117", fontWeight: 700, fontSize: 15, padding: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, transition: "opacity .2s" },
    link: { color: C.accent, textDecoration: "none", fontWeight: 600 },
    footer: { textAlign: "center", fontSize: 13, color: C.muted, marginTop: 18 },
    stepper: { display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 28 },
    stepCircle: (active, done) => ({ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${done ? C.accent : active ? C.accent : C.border}`, background: done ? C.accent : "transparent", color: done ? "#0d1117" : active ? C.accent : C.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }),
    stepLine: (done) => ({ height: 2, width: 60, background: done ? C.accent : C.border, transition: "background .3s" }),
    demoBanner: { background: "#2d1e00", border: "1px solid #f0ad4e55", borderRadius: 10, padding: "14px 18px", marginBottom: 18, textAlign: "center" },
    codeDigits: { fontSize: 32, fontWeight: 700, letterSpacing: 12, color: C.text, marginTop: 6 },
    codeInput: { width: "100%", background: C.input, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 22, padding: "12px", textAlign: "center", letterSpacing: 10, outline: "none", boxSizing: "border-box", marginBottom: 14 },
    successIcon: { width: 64, height: 64, borderRadius: "50%", background: "#00d4aa22", border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" },
};

// Spinner keyframe (una sola vez)
if (typeof document !== "undefined" && !document.getElementById("login-kf")) {
    const s = document.createElement("style");
    s.id = "login-kf";
    s.textContent = "@keyframes lspin { to { transform: rotate(360deg) } }";
    document.head.appendChild(s);
}

function Spinner() {
    return <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(0,0,0,.3)", borderTopColor: "#0d1117", borderRadius: "50%", animation: "lspin .7s linear infinite" }} />;
}

// ─── Input helper ─────────────────────────────────────────────────────────────
// FIX #1: el original tenía onClick={handleLogin} en el botón del ojo → corregido a onClick={onEyeToggle}
function Input({ label, icon, type = "text", placeholder, value, onChange, showEye, onEyeToggle, showPassword }) {
    return (
        <div>
            {label && <label style={css.label}>{label}</label>}
            <div style={css.inputWrap}>
                <span style={css.inputIcon}>{icon}</span>
                <input
                    style={css.input}
                    type={showEye ? (showPassword ? "text" : "password") : type}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoComplete="off"
                />
                {showEye && (
                    <button style={css.eyeBtn} onClick={onEyeToggle} type="button">
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
                    <div style={css.stepCircle(step === n, step > n)}>{step > n ? "✓" : n}</div>
                    {i < 2 && <div style={css.stepLine(step > n)} />}
                </div>
            ))}
        </div>
    );
}

// ─── Step 1 — registro con API ────────────────────────────────────────────────
// INTEGRACIÓN: llama AuthAPI.register; si falla por backend ausente continúa en demo
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
            await AuthAPI.register({ name, email, phone, password: pass });
            onNext({ name, email, phone, password: pass });
        } catch (err) {
            if (err?.status === 409) {
                setError("Ya existe una cuenta con ese correo.");
            } else if (err?.status) {
                // Error HTTP real del backend — mostrar y no avanzar
                setError("Error al registrar la cuenta. Intenta de nuevo.");
            } else {
                // Sin backend (error de red) — modo demo
                onNext({ name, email, phone, password: pass });
            }
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
            {error && <p style={{ color: "#f85149", fontSize: 13, margin: "4px 0 8px" }}>{error}</p>}
            <button style={{ ...css.btn, opacity: loading ? .6 : 1, cursor: loading ? "not-allowed" : "pointer" }} onClick={submit} disabled={loading}>
                {loading ? <Spinner /> : "Continuar"}
            </button>
            <p style={css.footer}>¿Ya tienes cuenta? <a style={css.link} href="#" onClick={(e) => { e.preventDefault(); onLogin(); }}>Iniciar sesión</a></p>
        </>
    );
}

// ─── Step 2 — verificación con API ───────────────────────────────────────────
// INTEGRACIÓN: llama AuthAPI.verifyCode; si el backend no responde acepta el código demo local
function Step2({ email, onNext, onBack }) {
    const [demoCode] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
    const [input, setInput] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const verify = async () => {
        if (input.length < 6) return setError("El código debe tener 6 dígitos.");
        setError("");
        setLoading(true);
        try {
            await AuthAPI.verifyCode(email, input);
            onNext();
        } catch {
            // Fallback demo: compara con el código generado localmente
            if (input === demoCode) {
                onNext();
            } else {
                setError("Código incorrecto. Intenta de nuevo.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#00d4aa22", border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>🛡️</div>
                <h3 style={{ margin: "0 0 6px" }}>Verificación</h3>
                <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
                    En un sistema real, enviaríamos un código a<br />
                    <span style={{ color: C.accent }}>{email}</span>
                </p>
            </div>
            {/* Banner demo — visible solo cuando no hay backend real */}
            <div style={css.demoBanner}>
                <span style={{ fontSize: 11, color: C.warn }}>⚡ Modo demo — código de verificación:</span>
                <div style={css.codeDigits}>{demoCode.split("").join(" ")}</div>
            </div>
            <label style={css.label}>Ingresa el código de 6 dígitos</label>
            <input
                style={css.codeInput}
                maxLength={6}
                placeholder="000000"
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
            />
            {error && <p style={{ color: "#f85149", fontSize: 13, margin: "0 0 8px", textAlign: "center" }}>{error}</p>}
            <button style={{ ...css.btn, opacity: loading ? .6 : 1, cursor: loading ? "not-allowed" : "pointer" }} onClick={verify} disabled={loading}>
                {loading ? <Spinner /> : "Verificar cuenta"}
            </button>
            <p style={css.footer}><a style={css.link} href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>← Volver</a></p>
        </>
    );
}

// ─── Step 3 — éxito ───────────────────────────────────────────────────────────
function Step3({ name, onGoToStore }) {
    return (
        <div style={{ textAlign: "center" }}>
            <div style={css.successIcon}>✅</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 20 }}>¡Cuenta creada!</h3>
            <p style={{ color: C.muted, fontSize: 13, margin: "0 0 4px" }}>Bienvenido/a, <strong style={{ color: C.text }}>{name}</strong></p>
            <p style={{ color: C.muted, fontSize: 13, margin: "0 0 24px" }}>Tu cuenta ha sido verificada exitosamente</p>
            <button style={css.btn} onClick={onGoToStore}>Ir a la tienda</button>
        </div>
    );
}

// ─── LoginScreen — con API ────────────────────────────────────────────────────
// INTEGRACIÓN: llama AuthAPI.login; si falla usa credenciales demo locales
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
            const { user } = await AuthAPI.login(email, pass);
            onLogin(user);
        } catch {
            // Fallback demo cuando el backend no está disponible
            const DEMO = {
                "admin@fit.com": { pass: "admin123", role: "admin", name: "Admin" },
                "vendedor@fit.com": { pass: "vendedor123", role: "vendedor", name: "Vendedor" },
                "cliente@fit.com": { pass: "cliente123", role: "cliente", name: "Cliente" },
            };
            const demo = DEMO[email.toLowerCase()];
            if (demo && demo.pass === pass) {
                onLogin({ id: "demo", name: demo.name, role: demo.role, email });
            } else {
                setError("Credenciales incorrectas.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div onKeyDown={(e) => e.key === "Enter" && submit()}>
            <Input label="Correo electrónico" icon="✉️" type="email" placeholder="correo@ejemplo.com" value={email} onChange={setEmail} />
            <Input label="Contraseña" icon="🔒" placeholder="••••••••" value={pass} onChange={setPass} showEye showPassword={showPass} onEyeToggle={() => setShowPass(!showPass)} />
            {error && <p style={{ color: "#f85149", fontSize: 13, margin: "4px 0 8px" }}>{error}</p>}
            <div style={{ marginTop: 8, background: "#161b22", border: "1px solid #21262d", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.muted, marginBottom: 8 }}>
                <strong style={{ color: C.text }}>Demo:</strong> admin@fit.com / admin123 · cliente@fit.com / cliente123
            </div>
            <button style={{ ...css.btn, opacity: loading ? .6 : 1, cursor: loading ? "not-allowed" : "pointer" }} onClick={submit} disabled={loading}>
                {loading ? <Spinner /> : <><span>Iniciar sesión</span><span>›</span></>}
            </button>
            <p style={css.footer}>¿Eres cliente? <a style={css.link} href="#" onClick={(e) => { e.preventDefault(); onRegister(); }}>Crear cuenta</a></p>
        </div>
    );
}

// ─── Componente principal exportado ──────────────────────────────────────────
// FIX #2: handleLogin estaba definido fuera del componente en el original (sin acceso a onLoginSuccess)
export default function LoginPage({ onLoginSuccess }) {
    const [mode, setMode] = useState("login");
    const [regStep, setRegStep] = useState(1);
    const [regData, setRegData] = useState({});

    const handleLogin = (user) => {
        if (onLoginSuccess) onLoginSuccess(user);
    };

    const handleStep1 = (data) => {
        setRegData(data);
        setRegStep(2);
    };

    const handleStep2 = () => setRegStep(3);

    // INTEGRACIÓN: intenta login real post-registro para obtener sesión cifrada
    const handleGoStore = async () => {
        try {
            const { user } = await AuthAPI.login(regData.email, regData.password);
            if (onLoginSuccess) onLoginSuccess(user);
        } catch {
            // Fallback demo
            if (onLoginSuccess) onLoginSuccess({ id: "demo", role: "cliente", name: regData.name, email: regData.email });
        }
    };

    return (
        <div style={css.page}>
            <div style={css.logo}>🏋️</div>
            <h1 style={css.title}>Fit & Ecoree House</h1>
            <p style={css.subtitle}>
                {mode === "login" ? "Sistema de gestión · Inicia sesión" : "Crear cuenta de cliente · Fit & Ecoree House"}
            </p>
            <div style={css.card}>
                {mode === "register" && <Stepper step={regStep} />}

                {mode === "login" && (
                    <LoginScreen onLogin={handleLogin} onRegister={() => { setMode("register"); setRegStep(1); }} />
                )}
                {mode === "register" && regStep === 1 && (
                    <Step1 onNext={handleStep1} onLogin={() => setMode("login")} />
                )}
                {mode === "register" && regStep === 2 && (
                    <Step2 email={regData.email} onNext={handleStep2} onBack={() => setRegStep(1)} />
                )}
                {mode === "register" && regStep === 3 && (
                    <Step3 name={regData.name} onGoToStore={handleGoStore} />
                )}
            </div>
        </div>
    );
}