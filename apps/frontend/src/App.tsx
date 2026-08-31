import { FormEvent, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { AttendancePage, ClassesPage, CurrencyField, Field, Modal, PageShell, PaymentsPage, StaffPage, StudentsPage, UnpaidPage } from './pages';
import { CashPage, ExpensesPage, PayrollPage } from './phase7-pages';
import { DashboardPage } from './phase8-pages';
import { FeeReceiptsPage, PayslipPage, ReceiptPage } from './receipt-page';
import type { AcademicYear, CashEntry, DashboardSummary, Employee, Expense, ExpenseCategory, FinanceStudentFee, FinanceSummaryEntry, Payment, Payroll, SalaryAdvance, SchoolClass, Settings, Student, UnpaidFee } from './types';
import { apiUrl } from './api-url';
import { COUNTRY_CURRENCY, countryOptions, currencyOptions, detectCountryFromTimezone } from './currency';
import coffeeQr from './assets/coffee-qr.png';
import fetouakiLogo from './assets/fetouaki-logo.jpg';
// Date locale (année-mois-jour du fuseau du navigateur) — pas .toISOString().slice(0, 10), qui
// convertit d'abord en UTC et peut décaler d'un jour près de minuit dans un fuseau UTC+.
const localDateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const initialValues: Record<string, string> = { className: '', classLevel: '', classRoom: '', classCapacity: '20', classTeacherId: '', classAssistantId: '', classStatus: 'ACTIVE', editingClassId: '', studentFirstName: '', studentLastName: '', studentBirthDate: '', studentSex: 'UNSPECIFIED', studentAddress: '', studentMonthlyFee: '', studentInsuranceFee: '', studentClassId: '', studentStatus: 'ACTIVE', editingStudentId: '', guardianFirstName: '', guardianLastName: '', guardianRelationship: 'FATHER', guardianPhone: '', guardianEmail: '', employeeFirstName: '', employeeLastName: '', employeeType: 'TEACHER', employeePhone: '', employeeEmail: '', employeeAddress: '', employeeQualification: '', employeeHiredAt: '', employeeBaseSalary: '', employeeContractType: '', employeeStatus: 'ACTIVE', editingEmployeeId: '', attendanceDate: localDateString(new Date()), attendanceClassId: '', financeStudentId: '', paymentAmount: '', paymentMethod: 'CASH', paymentPaidAt: localDateString(new Date()), feeTypeId: '', feePeriod: '', feeDueDate: '', feeAmount: '', expenseCategoryId: '', expenseDescription: '', expenseBeneficiary: '', expenseAmount: '', expenseMethod: 'CASH', expenseReference: '', expenseComment: '', newCategoryName: '', payrollEmployeeId: '', payrollMonth: '', payrollBaseSalary: '', payrollBonuses: '0', payrollAdvances: '0', payrollDeductions: '0', editingPayrollId: '', advanceEmployeeId: '', advanceAmount: '', advanceReason: '', advanceMonth: '', unpaidClassId: '', unpaidAcademicYearId: '', unpaidPeriod: '', unpaidStatus: '', yearLabel: '', yearStartsAt: '', yearEndsAt: '', yearStatus: 'FUTURE', newFeeTypeName: '', newFeeTypeAmount: '0', newFeeTypeFrequency: 'MONTHLY', autoOpenPayment: '', paymentsClassId: '', paymentsSearch: '' };

type User = { firstName: string; lastName: string; email: string; schoolName: string; currencyCode: string };
const COUNTRY_OPTIONS = countryOptions();
const CURRENCY_OPTIONS = currencyOptions();

export function LoginPage({ onLogin, onRegister, onRequestCode, message, isLoading, initialMode = 'login' }: { onLogin: (event: FormEvent<HTMLFormElement>) => void; onRegister: (event: FormEvent<HTMLFormElement>) => void; onRequestCode: (email: string) => Promise<boolean>; message: string; isLoading: boolean; initialMode?: 'login' | 'register' }) {
    const [mode, setMode] = useState<'login' | 'register'>(initialMode);
    const [email, setEmail] = useState('admin@ecole-garden.local');
    const [password, setPassword] = useState('change-this-password');
    const [schoolName, setSchoolName] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [registerCode, setRegisterCode] = useState('');
    const [registrationStep, setRegistrationStep] = useState<'form' | 'code'>('form');
    const [countryCode, setCountryCode] = useState('');
    const [currencyCode, setCurrencyCode] = useState('');
    // Détection best-effort par fuseau horaire uniquement — jamais bloquante, jamais d'appel réseau
    // (voir currency.ts) : ne fait que préremplir, l'utilisateur choisit toujours librement ensuite.
    useEffect(() => { const detected = detectCountryFromTimezone(); if (detected) { setCountryCode(detected); setCurrencyCode(COUNTRY_CURRENCY[detected] ?? ''); } }, []);
    const handleCountryChange = (value: string) => { setCountryCode(value); if (value in COUNTRY_CURRENCY) setCurrencyCode(COUNTRY_CURRENCY[value]); };
    const canRequestCode = schoolName.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerEmail) && registerPassword.length >= 8 && countryCode !== '' && currencyCode !== '';

    const handleRequestCode = async () => {
        const ok = await onRequestCode(registerEmail);
        if (ok) setRegistrationStep('code');
    };

    return <main className="flex min-h-screen items-center justify-center bg-[#f4f7f2] px-6">
        <div className="w-full max-w-md rounded-2xl border border-[#d6e1d5] bg-white p-8 shadow-sm">
            <Link className="text-sm text-[#6a8d72] hover:text-[#356743]" to="/">← Retour à l'accueil</Link>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#6a8d72]">SchoolDesk</p>
            <div className="mt-4 flex gap-1 rounded-lg bg-[#f4f7f2] p-1 text-sm">
                <button className={`flex-1 rounded-md py-1.5 font-medium ${mode === 'login' ? 'bg-white text-[#356743] shadow-sm' : 'text-[#6a8d72]'}`} onClick={() => setMode('login')} type="button">Connexion</button>
                <button className={`flex-1 rounded-md py-1.5 font-medium ${mode === 'register' ? 'bg-white text-[#356743] shadow-sm' : 'text-[#6a8d72]'}`} onClick={() => setMode('register')} type="button">Créer une école</button>
            </div>
            {mode === 'login'
                ? <form key="login" onSubmit={onLogin}>
                    <h1 className="mt-6 text-4xl font-semibold">Connexion</h1>
                    <label className="mt-8 block text-sm font-medium">Email<input autoComplete="username" className="mt-1 w-full rounded-lg border border-[#cbdacb] px-3 py-2" name="loginEmail" onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></label>
                    <label className="mt-4 block text-sm font-medium">Mot de passe<input autoComplete="current-password" className="mt-1 w-full rounded-lg border border-[#cbdacb] px-3 py-2" name="loginPassword" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label>
                    <button className="mt-6 w-full rounded-lg bg-[#356743] px-4 py-2 font-medium text-white disabled:opacity-50" disabled={isLoading} type="submit">{isLoading ? 'Connexion...' : 'Se connecter'}</button>
                </form>
                : <form key="register" onSubmit={registrationStep === 'code' ? onRegister : (event) => event.preventDefault()}>
                    <h1 className="mt-6 text-4xl font-semibold">Créer une école</h1>
                    <p className="mt-2 text-sm text-[#6a8d72]">Chaque école dispose de son propre espace, totalement séparé des autres.</p>
                    <label className="mt-8 block text-sm font-medium">Nom de l'école<input autoComplete="off" className="mt-1 w-full rounded-lg border border-[#cbdacb] px-3 py-2 read-only:bg-[#f4f7f2] read-only:text-[#6a8d72]" name="newSchoolName" onChange={(event) => setSchoolName(event.target.value)} readOnly={registrationStep === 'code'} type="text" value={schoolName} /></label>
                    <label className="mt-4 block text-sm font-medium">Email de l'administrateur<input autoComplete="off" className="mt-1 w-full rounded-lg border border-[#cbdacb] px-3 py-2 read-only:bg-[#f4f7f2] read-only:text-[#6a8d72]" name="newSchoolEmail" onChange={(event) => setRegisterEmail(event.target.value)} readOnly={registrationStep === 'code'} type="email" value={registerEmail} /></label>
                    <label className="mt-4 block text-sm font-medium">Mot de passe<input autoComplete="new-password" className="mt-1 w-full rounded-lg border border-[#cbdacb] px-3 py-2 read-only:bg-[#f4f7f2] read-only:text-[#6a8d72]" name="newSchoolPassword" onChange={(event) => setRegisterPassword(event.target.value)} readOnly={registrationStep === 'code'} type="password" value={registerPassword} /></label>
                    <p className="mt-1 text-xs text-[#6a8d72]">Au moins 8 caractères.</p>

                    <label className="mt-4 block text-sm font-medium">Pays<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2 text-base" name="newSchoolCountry" onChange={(event) => handleCountryChange(event.target.value)} required value={countryCode}>
                        <option disabled value="">Sélectionner…</option>
                        {COUNTRY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select></label>
                    <div className="mt-4">
                        {countryCode
                            ? <CurrencyField key={countryCode} name="newSchoolCurrency" onChange={setCurrencyCode} options={CURRENCY_OPTIONS} value={currencyCode} />
                            : <p className="text-sm text-[#6a8d72]">Sélectionnez un pays pour déterminer la devise.</p>}
                    </div>

                    {registrationStep === 'form' && <button className="mt-6 w-full rounded-lg bg-[#356743] px-4 py-2 font-medium text-white disabled:opacity-50" disabled={isLoading || !canRequestCode} onClick={handleRequestCode} type="button">{isLoading ? 'Envoi du code...' : 'Recevoir le code par email'}</button>}

                    {registrationStep === 'code' && <>
                        <p className="mt-4 text-sm text-[#356743]">Un code de vérification a été envoyé à {registerEmail}. Vérifiez aussi vos spams.</p>
                        <label className="mt-4 block text-sm font-medium">Code reçu par email<input autoComplete="one-time-code" className="mt-1 w-full rounded-lg border border-[#cbdacb] px-3 py-2 text-center text-lg tracking-[0.4em]" inputMode="numeric" maxLength={6} name="newSchoolCode" onChange={(event) => setRegisterCode(event.target.value.replace(/\D/g, ''))} value={registerCode} /></label>
                        <button className="mt-6 w-full rounded-lg bg-[#356743] px-4 py-2 font-medium text-white disabled:opacity-50" disabled={isLoading || registerCode.length !== 6} type="submit">{isLoading ? 'Création...' : "Créer l'école"}</button>
                        <div className="mt-3 flex justify-between text-xs">
                            <button className="text-[#6a8d72] underline" onClick={() => { setRegistrationStep('form'); setRegisterCode(''); }} type="button">← Modifier l'email</button>
                            <button className="text-[#356743] underline disabled:opacity-50" disabled={isLoading} onClick={handleRequestCode} type="button">Renvoyer le code</button>
                        </div>
                    </>}
                </form>}
            {message && <p className="mt-4 rounded-lg bg-[#e5f1e5] px-3 py-2 text-sm text-[#356743]">{message}</p>}
        </div>
    </main>;
}

type LandingStep = { id: number; title: string; desc: string; icon: string; badge: string };
const landingSteps: LandingStep[] = [
    { id: 1, title: "Ajoutez votre personnel", desc: "Toujours commencer ici : professeurs et assistants, pour pouvoir ensuite les assigner à une classe. L'année scolaire en cours est déjà créée automatiquement.", icon: 'fa-user-tie', badge: 'Étape Indispensable' },
    { id: 2, title: "Créez vos classes", desc: "Nom, niveau, professeur assigné : sans classe configurée, rien d'autre ne peut être créé correctement dans votre système.", icon: 'fa-shapes', badge: 'Ressources Humaines' },
    { id: 3, title: "Ajoutez vos élèves", desc: "Chaque enfant rejoint sa classe, avec les informations de ses parents et ses frais de scolarité associés.", icon: 'fa-child-reaching', badge: 'Gestion des Dossiers' },
    { id: 4, title: "Suivez les présences", desc: "Chaque jour, cochez facilement qui est présent, en retard ou absent, classe par classe.", icon: 'fa-clipboard-user', badge: 'Appel Quotidien' },
    { id: 5, title: "Encaissez les paiements", desc: "Enregistrez chaque paiement des familles et imprimez le reçu officiel en un clic.", icon: 'fa-file-invoice-dollar', badge: 'Gestion Financière' },
    { id: 6, title: "Ne perdez plus aucun impayé", desc: "Repérez en un coup d'œil les frais non payés ou en retard grâce aux alertes automatiques.", icon: 'fa-triangle-exclamation', badge: 'Alertes Intelligentes' },
    { id: 7, title: "Notez vos dépenses", desc: "Fournitures, entretien, factures d'eau et électricité : tout est conservé au même endroit.", icon: 'fa-basket-shopping', badge: 'Comptabilité Simplifiée' },
    { id: 8, title: "Payez les salaires", desc: "Créez le salaire du mois et enregistrez chaque versement en toute transparence.", icon: 'fa-wallet', badge: 'Gestion de la Paie' },
    { id: 9, title: "Vérifiez votre caisse", desc: "Toutes les entrées et sorties d'argent sont calculées en temps réel, filtrables par mois, classe ou élève.", icon: 'fa-vault', badge: 'Bilan de Caisse' },
    { id: 10, title: "Un tableau de bord pour tout voir", desc: "Revenez ici à tout moment : solde, impayés, élèves actifs... toute l'école en un coup d'œil !", icon: 'fa-chart-pie', badge: "Vue d'Ensemble" }
];

const landingFaqs = [
    { q: "Puis-je tester l'application gratuitement ?", a: "Oui, sans aucune limite de durée : SchoolDesk est gratuit et open source. Créez votre école en quelques secondes et configurez vos classes, aucune carte bancaire ni engagement n'est jamais demandé." },
    { q: "L'application fonctionne-t-elle sur téléphone et tablette ?", a: "Absolument. SchoolDesk est accessible depuis n'importe quel navigateur web sur votre ordinateur, tablette ou smartphone." },
    { q: "Mes données sont-elles en sécurité ?", a: "Oui : chaque école est totalement isolée des autres, et vous restez seul propriétaire de vos données puisque vous hébergez l'application vous-même. Un export/import complet de vos données est disponible à tout moment depuis les Paramètres." }
];

export function LandingPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeStep, setActiveStep] = useState(1);
    const [openFaqs, setOpenFaqs] = useState<boolean[]>(() => landingFaqs.map(() => false));
    const step = landingSteps.find((candidate) => candidate.id === activeStep) ?? landingSteps[0];
    const toggleFaq = (index: number) => setOpenFaqs((current) => current.map((open, i) => (i === index ? !open : open)));

    return <div className="landing-page antialiased bg-[#fafcf9] text-[#1c2a1e]">
        <style>{`
            .landing-page h1, .landing-page h2, .landing-page h3, .landing-page h4, .landing-page .font-title { font-family: 'Fredoka', cursive, sans-serif; }
            .landing-page { font-family: 'Nunito', sans-serif; }
            .landing-page .hero-pattern { background-color: #f2f8f3; background-image: radial-gradient(#2d6a4f 0.6px, transparent 0.6px), radial-gradient(#2d6a4f 0.6px, #f2f8f3 0.6px); background-size: 24px 24px; background-position: 0 0, 12px 12px; }
            .landing-page .glass-card { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(225, 239, 227, 0.8); }
        `}</style>

        {/* Header / Navbar */}
        <header className="glass-card sticky top-0 z-50 border-b border-[#e1efe3] transition-all duration-300">
            <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link className="group flex items-center gap-3" to="/">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2d6a4f] font-title text-2xl text-white shadow-md transition-transform group-hover:scale-105">🌱</div>
                    <div>
                        <span className="block font-title text-2xl font-bold leading-none tracking-tight text-[#2d6a4f]">SchoolDesk</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#38773e]">Gestion des écoles</span>
                    </div>
                </Link>
                <nav className="hidden items-center gap-8 font-semibold text-gray-700 md:flex">
                    <a className="hover:text-[#2d6a4f]" href="#features">Fonctionnalités</a>
                    <a className="hover:text-[#2d6a4f]" href="#how-it-works">Comment ça marche</a>
                    <a className="hover:text-[#2d6a4f]" href="#open-source">Open Source</a>
                    <a className="hover:text-[#2d6a4f]" href="#faq">FAQ</a>
                </nav>
                <div className="hidden items-center gap-4 md:flex">
                    <Link className="rounded-xl px-4 py-2 font-bold text-[#2d6a4f] hover:text-[#27523f]" to="/login">Se connecter</Link>
                    <Link className="rounded-2xl bg-[#2d6a4f] px-6 py-3 font-bold text-white shadow-lg shadow-[#2d6a4f]/20 transition-all hover:-translate-y-0.5 hover:bg-[#27523f] hover:shadow-[#2d6a4f]/40" to="/register">Créer mon école <i className="fa-solid fa-arrow-right ml-2 text-sm" /></Link>
                </div>
                <button aria-label="Menu" className="text-2xl text-[#2d6a4f] md:hidden" onClick={() => setMobileMenuOpen((open) => !open)} type="button"><i className="fa-solid fa-bars" /></button>
            </div>
            {mobileMenuOpen && <div className="space-y-3 border-b border-[#e1efe3] bg-white px-6 py-4 md:hidden">
                <a className="block py-2 font-semibold text-gray-700" href="#features">Fonctionnalités</a>
                <a className="block py-2 font-semibold text-gray-700" href="#how-it-works">Comment ça marche</a>
                <a className="block py-2 font-semibold text-gray-700" href="#open-source">Open Source</a>
                <a className="block py-2 font-semibold text-gray-700" href="#faq">FAQ</a>
                <div className="space-y-2 border-t border-gray-100 pt-4">
                    <Link className="block w-full rounded-xl bg-[#e1efe3] py-3 text-center font-bold text-[#27523f]" to="/login">Se connecter</Link>
                    <Link className="block w-full rounded-xl bg-[#2d6a4f] py-3 text-center font-bold text-white shadow" to="/register">Créer mon école</Link>
                </div>
            </div>}
        </header>

        {/* Hero */}
        <section className="hero-pattern relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
            <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid items-center gap-12 lg:grid-cols-12">
                    <div className="space-y-6 text-center lg:col-span-6 lg:text-left">
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#c4e0ca] bg-[#e1efe3] px-4 py-2 text-sm font-bold text-[#27523f]">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-[#489350]" />
                            Gestion scolaire simple, complète et open source
                        </div>
                        <h1 className="text-4xl font-bold leading-tight text-gray-900 sm:text-5xl lg:text-6xl">
                            Gérez votre école <br className="hidden sm:inline" />
                            <span className="text-[#2d6a4f] underline decoration-[#9bcb9f] decoration-wavy decoration-2">en toute sérénité.</span>
                        </h1>
                        <p className="mx-auto max-w-xl text-lg font-medium leading-relaxed text-gray-600 sm:text-xl lg:mx-0">
                            De l'inscription des élèves au suivi des présences, des cotisations aux fiches de paie : découvrez l'outil tout-en-un simple, intuitif et 100% sécurisé.
                        </p>
                        <div className="flex flex-col justify-center gap-4 pt-2 sm:flex-row lg:justify-start">
                            <Link className="flex items-center justify-center gap-3 rounded-2xl bg-[#2d6a4f] px-8 py-4 text-lg font-bold text-white shadow-xl shadow-[#2d6a4f]/30 transition-all hover:-translate-y-1 hover:bg-[#27523f] hover:shadow-[#2d6a4f]/50" to="/register"><i className="fa-solid fa-rocket" /> Créer mon école</Link>
                            <a className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#c4e0ca] bg-white px-8 py-4 text-lg font-bold text-[#27523f] shadow-sm hover:bg-[#f2f8f3]" href="https://github.com/nebukadnezare1/schooldesk" rel="noopener noreferrer" target="_blank"><i className="fa-brands fa-github" /> Installer SchoolDesk</a>
                        </div>
                        <p className="text-sm text-gray-500">Utilisez SchoolDesk en ligne en un clic, ou hébergez votre propre instance à partir du code source.</p>
                        <div className="grid grid-cols-3 gap-4 border-t border-[#c4e0ca]/60 pt-6 text-center lg:text-left">
                            <div><div className="font-title text-2xl font-bold text-[#2d6a4f]">100%</div><div className="text-xs font-semibold text-gray-500">Conforme &amp; Intuitif</div></div>
                            <div><div className="font-title text-2xl font-bold text-[#2d6a4f]">10 étapes</div><div className="text-xs font-semibold text-gray-500">Prise en main express</div></div>
                            <div><div className="font-title text-2xl font-bold text-[#2d6a4f]">0 oublis</div><div className="text-xs font-semibold text-gray-500">Suivi automatique des paiements</div></div>
                        </div>
                    </div>

                    <div className="relative lg:col-span-6">
                        <div className="relative mx-auto max-w-lg lg:max-w-none">
                            <div className="relative overflow-hidden rounded-3xl border-4 border-white border-[#e1efe3] bg-white shadow-2xl">
                                <div className="flex items-center justify-between bg-[#2d6a4f] px-6 py-4 text-white">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm">🌱</div>
                                        <span className="font-title text-lg font-semibold">SchoolDesk Dashboard</span>
                                    </div>
                                    <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">Année 2025-2026</span>
                                </div>
                                <div className="space-y-5 bg-[#f2f8f3]/50 p-6">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="rounded-2xl border border-[#e1efe3] bg-white p-3.5 text-center shadow-sm">
                                            <div className="text-xs font-semibold text-gray-500">Élèves Actifs</div>
                                            <div className="mt-0.5 font-title text-2xl font-bold text-[#2d6a4f]">124</div>
                                        </div>
                                        <div className="rounded-2xl border border-[#e1efe3] bg-white p-3.5 text-center shadow-sm">
                                            <div className="text-xs font-semibold text-gray-500">Présents Auj.</div>
                                            <div className="mt-0.5 font-title text-2xl font-bold text-[#489350]">96%</div>
                                        </div>
                                        <div className="rounded-2xl border border-[#e1efe3] bg-white p-3.5 text-center shadow-sm">
                                            <div className="text-xs font-semibold text-gray-500">Solde Caisse</div>
                                            <div className="mt-0.5 font-title text-2xl font-bold text-[#2d6a4f]">+42k</div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 rounded-2xl border border-[#e1efe3] bg-white p-4 shadow-sm">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <span className="font-title text-sm font-bold text-gray-800">Dernières Activités</span>
                                            <span className="text-xs font-bold text-[#38773e]">Voir tout</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 font-bold text-green-700">✓</span>
                                                <div><div className="font-bold text-gray-800">Paiement reçu - Amina M.</div><div className="text-gray-400">Frais de scolarité • Reçu #402</div></div>
                                            </div>
                                            <span className="font-bold text-[#2d6a4f]">+ 1,200</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700"><i className="fa-solid fa-clock" /></span>
                                                <div><div className="font-bold text-gray-800">Appel Effectué - Petite Section</div><div className="text-gray-400">18 Présents • 2 Absents</div></div>
                                            </div>
                                            <span className="rounded bg-[#e1efe3] px-2 py-0.5 font-bold text-[#27523f]">Validé</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute -bottom-4 -left-4 flex items-center gap-3 rounded-2xl border border-[#e1efe3] bg-white p-4 shadow-xl">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e1efe3] text-xl text-[#2d6a4f]"><i className="fa-solid fa-print" /></div>
                                <div><div className="text-sm font-bold text-gray-800">Reçus en 1 Clic</div><div className="text-xs text-gray-500">Impression instantanée</div></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Key Features */}
        <section className="bg-white py-20" id="features">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto mb-16 max-w-3xl space-y-4 text-center">
                    <span className="rounded-full bg-[#e1efe3] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#27523f]">Fonctionnalités Clés</span>
                    <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Tout ce dont votre établissement a besoin au quotidien</h2>
                    <p className="text-lg text-gray-600">Une plateforme complète conçue spécifiquement pour simplifier le travail des directeurs, enseignants et gestionnaires d'écoles.</p>
                </div>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {[
                        { icon: 'fa-shapes', title: 'Structure & Classes', text: "Organisez votre année scolaire en quelques clics. Définissez vos sections (Petite, Moyenne, Grande Section, Préparatoire) et répartissez vos élèves sereinement." },
                        { icon: 'fa-child-reaching', title: 'Dossiers Élèves & Parents', text: "Centralisez les fiches d'inscription, contacts d'urgence, informations médicales et tarifs de scolarité personnalisés pour chaque enfant." },
                        { icon: 'fa-clipboard-user', title: 'Appel & Présences', text: "Effectuez le suivi quotidien des présences, retards et absences par classe. Gardez un historique clair et générez des rapports mensuels." },
                        { icon: 'fa-file-invoice-dollar', title: 'Encaissements & Reçus', text: "Enregistrez les cotisations des familles en espèces, chèques ou virements. Imprimez instantanément des reçus clairs et professionnels." },
                        { icon: 'fa-triangle-exclamation', title: 'Gestion des Impayés', text: "Détectez automatiquement les retards de paiement. Envoyez des relances en un clic et évitez les pertes financières pour l'école." },
                        { icon: 'fa-vault', title: 'Suivi de Caisse & Salaires', text: "Suivez toutes vos dépenses (fournitures, loyer, entretien) et calculez les salaires de votre équipe avec un bilan de caisse net en temps réel." }
                    ].map((feature) => <div className="group rounded-3xl border border-[#e1efe3] bg-[#f2f8f3]/50 p-8 transition-all hover:-translate-y-1 hover:bg-[#f2f8f3] hover:shadow-lg" key={feature.title}>
                        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2d6a4f] text-2xl text-white shadow-md shadow-[#2d6a4f]/20 transition-transform group-hover:scale-110"><i className={`fa-solid ${feature.icon}`} /></div>
                        <h3 className="mb-3 font-title text-2xl font-bold text-gray-900">{feature.title}</h3>
                        <p className="leading-relaxed text-gray-600">{feature.text}</p>
                    </div>)}
                </div>
            </div>
        </section>

        {/* How It Works */}
        <section className="border-y border-[#e1efe3] bg-[#f2f8f3]/60 py-20" id="how-it-works">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto mb-12 max-w-3xl space-y-4 text-center">
                    <span className="rounded-full bg-[#2d6a4f] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white">Guide Rapide</span>
                    <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Utilisez SchoolDesk en 10 étapes simples</h2>
                    <p className="text-lg text-gray-600">Une prise en main ultra fluide dès le premier jour d'utilisation.</p>
                </div>
                <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
                    {landingSteps.map((candidate) => <button aria-current={candidate.id === activeStep} aria-label={`Étape ${candidate.id} : ${candidate.title}`} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-all sm:h-11 sm:w-11 ${candidate.id === activeStep ? 'border-[#2d6a4f] bg-[#2d6a4f] text-white' : 'border-[#c4e0ca] bg-white text-gray-600 hover:border-[#2d6a4f]'}`} key={candidate.id} onClick={() => setActiveStep(candidate.id)} type="button">{candidate.id}</button>)}
                </div>
                <div className="grid min-h-[300px] items-center gap-8 rounded-3xl border border-[#c4e0ca] bg-white p-6 shadow-xl sm:p-8 md:grid-cols-12 md:p-12">
                    <div className="space-y-4 md:col-span-7">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e1efe3] font-title text-2xl font-bold text-[#2d6a4f]">{step.id}</div>
                        <h3 className="font-title text-2xl font-bold text-gray-900 sm:text-3xl">{step.title}</h3>
                        <p className="text-lg leading-relaxed text-gray-600">{step.desc}</p>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-[#e1efe3] bg-[#f2f8f3] p-6 text-center md:col-span-5">
                        <div className="mb-2 text-5xl text-[#2d6a4f]"><i className={`fa-solid ${step.icon}`} /></div>
                        <div className="font-title text-lg font-bold text-gray-800">{step.badge}</div>
                        <div className="text-xs text-gray-500">Prise en main en moins de 3 minutes</div>
                    </div>
                </div>
                <div className="mt-6 flex items-center justify-between gap-3">
                    <button className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#c4e0ca] bg-white px-4 py-2.5 text-sm font-bold text-[#27523f] transition hover:bg-[#f2f8f3] disabled:cursor-not-allowed disabled:opacity-40" disabled={activeStep === 1} onClick={() => setActiveStep((value) => Math.max(1, value - 1))} type="button"><i className="fa-solid fa-arrow-left" /> Précédent</button>
                    <span className="text-sm font-semibold text-gray-500">Étape {activeStep} / {landingSteps.length}</span>
                    <button className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#c4e0ca] bg-white px-4 py-2.5 text-sm font-bold text-[#27523f] transition hover:bg-[#f2f8f3] disabled:cursor-not-allowed disabled:opacity-40" disabled={activeStep === landingSteps.length} onClick={() => setActiveStep((value) => Math.min(landingSteps.length, value + 1))} type="button">Suivant <i className="fa-solid fa-arrow-right" /></button>
                </div>
            </div>
        </section>

        {/* Open Source */}
        <section className="border-t border-[#e1efe3] bg-[#f2f8f3]/40 py-20" id="open-source">
            <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
                <span className="rounded-full bg-[#2d6a4f] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white">100% Gratuit &amp; Open Source</span>
                <h2 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">Aucun abonnement, aucune surprise.</h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">Gratuit. Open source. Sans abonnement. Utilisez SchoolDesk en ligne, ou hébergez votre propre instance.</p>
                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <Link className="flex items-center justify-center gap-3 rounded-2xl bg-[#2d6a4f] px-8 py-4 text-lg font-bold text-white shadow-xl shadow-[#2d6a4f]/30 transition-all hover:-translate-y-1 hover:bg-[#27523f] hover:shadow-[#2d6a4f]/50" to="/register"><i className="fa-solid fa-rocket" /> Créer mon école</Link>
                </div>
                <a className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#27523f] hover:text-[#2d6a4f] hover:underline" href="https://github.com/nebukadnezare1/schooldesk" rel="noopener noreferrer" target="_blank"><i className="fa-brands fa-github" /> Voir le code sur GitHub</a>
            </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-20" id="faq">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                <div className="mb-16 space-y-4 text-center">
                    <span className="rounded-full bg-[#e1efe3] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#27523f]">Questions Fréquentes</span>
                    <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Vous avez des questions ?</h2>
                </div>
                <div className="space-y-4">
                    {landingFaqs.map((faq, index) => <div className="overflow-hidden rounded-2xl border border-[#c4e0ca]" key={faq.q}>
                        <button className="flex w-full items-center justify-between bg-[#f2f8f3]/30 p-6 text-left text-lg font-bold text-gray-800 hover:bg-[#f2f8f3]" onClick={() => toggleFaq(index)} type="button">
                            <span>{faq.q}</span>
                            <i className={`fa-solid fa-chevron-down text-[#2d6a4f] transition-transform ${openFaqs[index] ? 'rotate-180' : ''}`} />
                        </button>
                        {openFaqs[index] && <div className="border-t border-[#e1efe3] p-6 pt-4 leading-relaxed text-gray-600">{faq.a}</div>}
                    </div>)}
                </div>
            </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden bg-[#2d6a4f] py-16 text-white">
            <div className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 text-center sm:px-6 lg:px-8">
                <h2 className="font-title text-3xl font-bold sm:text-5xl">Prêt à moderniser la gestion de votre école ?</h2>
                <p className="mx-auto max-w-2xl text-lg text-[#e1efe3]">Rejoignez les établissements qui simplifient leur quotidien avec SchoolDesk.</p>
                <Link className="inline-block rounded-2xl bg-white px-8 py-4 text-lg font-bold text-[#27523f] shadow-xl transition-all hover:scale-105 hover:bg-[#f2f8f3]" to="/register">Créer mon école</Link>
            </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-800 bg-gray-900 py-12 text-gray-400">
            <div className="mx-auto mb-8 grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 font-title text-xl text-white"><span>🌱</span> SchoolDesk</div>
                    <p className="text-xs leading-relaxed">Logiciel de gestion moderne conçu pour tous les établissements scolaires.</p>
                </div>
                <div>
                    <h4 className="mb-4 text-sm font-bold text-white">Navigation</h4>
                    <ul className="space-y-2 text-xs">
                        <li><a className="hover:text-white" href="#features">Fonctionnalités</a></li>
                        <li><a className="hover:text-white" href="#how-it-works">Guide 10 étapes</a></li>
                        <li><a className="hover:text-white" href="#open-source">Open Source</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="mb-4 text-sm font-bold text-white">Contact</h4>
                    <ul className="space-y-2 text-xs">
                        <li><i className="fa-solid fa-phone mr-2 text-[#6eb175]" /> <a className="hover:text-white" href="tel:+212662156281">+212 6 62 15 62 81</a> (Maroc)</li>
                        <li><i className="fa-solid fa-phone mr-2 text-[#6eb175]" /> <a className="hover:text-white" href="tel:+32467808996">+32 467 80 89 96</a> (Belgique)</li>
                        <li><i className="fa-solid fa-envelope mr-2 text-[#6eb175]" /> <a className="hover:text-white" href="mailto:ikaoutef@gmail.com">ikaoutef@gmail.com</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="mb-4 text-sm font-bold text-white">Soutenir le projet</h4>
                    <p className="mb-3 text-xs leading-relaxed">SchoolDesk est gratuit et open source. Si l'application vous rend service, un petit café est toujours apprécié.</p>
                    <div className="flex flex-col items-center gap-3 md:items-start">
                        <a href="https://www.paypal.com/ncp/payment/R8UA9698VQBNC" rel="noopener noreferrer" target="_blank">
                            <img alt="QR code PayPal — offrir un café à SchoolDesk" className="w-40 rounded-lg border border-white/20 bg-white p-1.5" src={coffeeQr} />
                        </a>
                        <a className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20" href="https://www.paypal.com/ncp/payment/R8UA9698VQBNC" rel="noopener noreferrer" target="_blank">
                            <i className="fa-solid fa-mug-hot text-[#6eb175]" /> Offrir un café
                        </a>
                    </div>
                </div>
            </div>
            <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 border-t border-gray-800 px-4 pt-6 text-center text-xs sm:px-6 lg:px-8">
                <img alt="Fetouaki A. — Solutions Globales et Innovation" className="h-16 w-16 rounded-lg" src={fetouakiLogo} />
                <a className="font-semibold text-gray-300 hover:text-white hover:underline" href="https://github.com/nebukadnezare1/schooldesk/blob/main/LICENSE" rel="noopener noreferrer" target="_blank">SchoolDesk — Logiciel libre sous licence MIT</a>
                <p>© 2026 — Créé par Fetouaki A. (DG Design)</p>
            </div>
        </footer>
    </div>;
}

const helpSteps = [
    { icon: '🧑‍🏫', accent: '#356743', title: 'Personnel', text: "Toujours commencer ici : ajoutez vos professeurs et le reste du personnel (salaire de base, contrat, coordonnées) — ils pourront ensuite être assignés à une classe. L'année scolaire en cours est déjà créée automatiquement dès l'inscription de votre école." },
    { icon: '📅', accent: '#4e8060', title: 'Classes', text: "Créez vos classes (nom, niveau, professeur, assistant). Rien d'autre ne peut être créé correctement sans une classe existante." },
    { icon: '🎒', accent: '#6a8d72', title: 'Élèves', text: "Ajoutez chaque élève dans sa classe, avec les informations du tuteur et les montants de mensualité/assurance. Les frais du mois sont générés automatiquement." },
    { icon: '✅', accent: '#356743', title: 'Présences', text: "Chaque jour, marquez qui est présent, absent, en retard ou excusé, classe par classe." },
    { icon: '💰', accent: '#c99a3f', title: 'Paiements', text: "Enregistrez les encaissements des familles (mensualité, assurance...) et imprimez les reçus automatiquement." },
    { icon: '⏰', accent: '#a65d36', title: 'Impayés', text: "Suivez les frais non payés ou en retard, et relancez les familles concernées." },
    { icon: '🧾', accent: '#a65d36', title: 'Dépenses', text: "Enregistrez les dépenses de l'école : fournitures, factures, entretien..." },
    { icon: '💵', accent: '#c99a3f', title: 'Salaires', text: "Créez le salaire mensuel de chaque employé et enregistrez ses versements." },
    { icon: '🏦', accent: '#356743', title: 'Caisse', text: "Consultez toutes les entrées et sorties d'argent, filtrables par mois, classe ou élève." },
    { icon: '📊', accent: '#4e8060', title: 'Dashboard', text: "Revenez ici à tout moment pour une vue d'ensemble de la situation de l'école." }
];

const HelpModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const [step, setStep] = useState(0);
    useEffect(() => { if (open) setStep(0); }, [open]);
    const current = helpSteps[step];
    const isFirst = step === 0;
    const isLast = step === helpSteps.length - 1;
    return <Modal onClose={onClose} open={open} title="Guide d'utilisation">
        <div className="flex flex-col items-center rounded-2xl p-8 text-center transition-colors" style={{ backgroundColor: `${current.accent}1a`, border: `2px solid ${current.accent}` }}>
            <span className="text-6xl">{current.icon}</span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: current.accent }}>Étape {step + 1} sur {helpSteps.length}</p>
            <h3 className="mt-1 text-2xl font-semibold text-[#18352b]">{current.title}</h3>
            <p className="mt-3 max-w-sm text-sm text-[#557064]">{current.text}</p>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2">
            {helpSteps.map((s, index) => <button aria-label={`Aller à l'étape ${index + 1}`} className="h-2.5 rounded-full transition-all" key={s.title} onClick={() => setStep(index)} style={{ backgroundColor: index === step ? current.accent : '#d6e1d5', width: index === step ? '1.5rem' : '0.625rem' }} type="button" />)}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
            <button className="rounded-lg border border-[#cbdacb] px-4 py-2 text-sm font-medium text-[#356743] disabled:cursor-not-allowed disabled:opacity-30" disabled={isFirst} onClick={() => setStep((value) => value - 1)} type="button">← Précédent</button>
            {isLast
                ? <button className="rounded-lg bg-[#356743] px-5 py-2 text-sm font-medium text-white" onClick={onClose} type="button">Terminé ✓</button>
                : <button className="rounded-lg bg-[#356743] px-5 py-2 text-sm font-medium text-white" onClick={() => setStep((value) => value + 1)} type="button">Suivant →</button>}
        </div>
    </Modal>;
};

const SettingsPage = ({ request, onSaved, onDownloadBackup, onRestoreBackup }: { request: (path: string, options?: RequestInit) => Promise<Response>; onSaved: (message: string) => void; onDownloadBackup: () => Promise<void>; onRestoreBackup: (confirmName: string, backup: unknown) => Promise<boolean> }) => {
    const navigate = useNavigate();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [form, setForm] = useState<Settings>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [restoreConfirmName, setRestoreConfirmName] = useState('');
    const [isRestoring, setIsRestoring] = useState(false);

    useEffect(() => {
        (async () => {
            const response = await request('/api/settings');
            if (response.ok) { const data = (await response.json()).settings as Settings; setSettings(data); setForm(data); }
        })();
    }, []);

    const setField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

    const handleRestore = async () => {
        if (!restoreFile || !restoreConfirmName.trim()) return;
        if (!window.confirm(`Cette action va REMPLACER TOUTES les données actuelles de l'école (élèves, classes, paiements, dépenses, salaires, caisse…) par celles du fichier choisi. Une sauvegarde de sécurité de l'état actuel sera créée automatiquement avant. Continuer ?`)) return;
        setIsRestoring(true);
        let parsed: unknown;
        try { parsed = JSON.parse(await restoreFile.text()); }
        catch { onSaved('Fichier JSON invalide — impossible de le lire.'); setIsRestoring(false); return; }
        const ok = await onRestoreBackup(restoreConfirmName, parsed);
        setIsRestoring(false);
        if (ok) { setRestoreFile(null); setRestoreConfirmName(''); navigate('/'); }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const currencyChanged = settings && form['school.currencyCode'] !== undefined && form['school.currencyCode'] !== settings['school.currencyCode'];
        if (currencyChanged && !window.confirm('Confirmer le changement de devise ? Les montants existants ne seront pas convertis.')) return;
        setIsSaving(true);
        const response = await request('/api/settings', { method: 'PATCH', body: JSON.stringify(form) });
        const data = await response.json();
        if (response.ok) { onSaved('Paramètres enregistrés.'); navigate('/'); }
        else { onSaved(data.error); setIsSaving(false); }
    };

    if (!settings) return <PageShell eyebrow="SchoolDesk" title="Paramètres"><p className="text-sm text-[#557064]">Chargement…</p></PageShell>;

    return <PageShell eyebrow="SchoolDesk" title="Paramètres">
        <form className="max-w-xl space-y-4" onSubmit={handleSubmit}>
            <p className="text-sm text-[#557064]">Ces informations apparaissent sur les reçus et documents imprimables de l'école.</p>
            <Field label="Nom de l'école" onChange={(value) => setField('school.name', value)} value={form['school.name'] ?? ''} />
            <Field label="Adresse" onChange={(value) => setField('school.address', value)} placeholder="Ex. 12 rue des Écoles, Casablanca" required={false} value={form['school.address'] ?? ''} />
            <Field label="Téléphone" onChange={(value) => setField('school.phone', value)} required={false} value={form['school.phone'] ?? ''} />
            <Field label="WhatsApp" onChange={(value) => setField('school.whatsapp', value)} required={false} value={form['school.whatsapp'] ?? ''} />
            <Field label="Email" onChange={(value) => setField('school.email', value)} required={false} type="email" value={form['school.email'] ?? ''} />
            <div className="border-t border-[#edf4ec] pt-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6a8d72]">Région et devise</h2>
                <div className="mt-3 space-y-4">
                    <label className="block text-sm font-medium text-[#315a48]">Pays<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2 text-base" onChange={(event) => { const next = event.target.value; setField('school.countryCode', next); const suggested = COUNTRY_CURRENCY[next]; if (suggested) setField('school.currencyCode', suggested); }} required value={form['school.countryCode'] ?? ''}>
                        {COUNTRY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select></label>
                    <CurrencyField key={form['school.countryCode']} onChange={(value) => setField('school.currencyCode', value)} options={CURRENCY_OPTIONS} value={form['school.currencyCode'] ?? ''} />
                    <p className="text-xs text-[#a65d36]">Changer la devise ne convertira pas les montants déjà enregistrés.</p>
                </div>
            </div>
            <button className="rounded-lg bg-[#356743] px-5 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </form>

        <div className="mt-8 max-w-xl rounded-2xl border border-[#d6e1d5] bg-[#f7faf6] p-5">
            <h2 className="text-lg font-semibold text-[#18352b]">Sauvegarde</h2>
            <p className="mt-2 text-sm text-[#557064]">Télécharge un fichier contenant toutes les données de votre école (élèves, classes, personnel, paiements, dépenses, salaires, caisse…) — à conserver en lieu sûr, par exemple avant une manipulation importante.</p>
            <button className="mt-4 rounded-lg border border-[#356743] px-5 py-2 text-sm font-medium text-[#356743] disabled:opacity-60" disabled={isDownloading} onClick={async () => { setIsDownloading(true); await onDownloadBackup(); setIsDownloading(false); }} type="button">{isDownloading ? 'Préparation…' : '⬇ Sauvegarder mes données'}</button>
        </div>

        <div className="mt-6 max-w-xl rounded-2xl border border-[#e3b3a3] bg-[#fdf3f0] p-5">
            <h2 className="text-lg font-semibold text-[#7a3324]">Restauration — action irréversible</h2>
            <p className="mt-2 text-sm text-[#8a4a3a]">Remplace intégralement les données actuelles de l'école par celles d'un fichier de sauvegarde SchoolDesk. Aucune fusion : tout ce qui existe actuellement (élèves, classes, paiements, dépenses, salaires, caisse…) est effacé et remplacé. Une sauvegarde de sécurité de l'état actuel est créée automatiquement avant.</p>
            <div className="mt-4 space-y-3">
                <input accept="application/json" className="block w-full text-sm text-[#7a3324] file:mr-3 file:rounded-lg file:border file:border-[#e3b3a3] file:bg-white file:px-3 file:py-1.5 file:text-sm" onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)} type="file" />
                <Field label="Retapez le nom exact de l'école pour confirmer" onChange={setRestoreConfirmName} required={false} value={restoreConfirmName} />
                <button className="rounded-lg bg-[#a65d36] px-5 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={isRestoring || !restoreFile || !restoreConfirmName.trim()} onClick={handleRestore} type="button">{isRestoring ? 'Restauration en cours…' : '⚠ Restaurer cette sauvegarde'}</button>
            </div>
        </div>
    </PageShell>;
};

const GettingStartedPage = ({ onOpenHelp }: { onOpenHelp: () => void }) => <PageShell eyebrow="SchoolDesk" title="Comment commencer">
    <div className="rounded-2xl border border-[#d6e1d5] bg-[#f7faf6] p-5">
        <h2 className="text-lg font-semibold text-[#18352b]">Besoin d'un rappel sur l'ordre des étapes ?</h2>
        <p className="mt-2 text-sm text-[#557064]">Le tutoriel montre, pas à pas, comment utiliser l'application dans le bon ordre : de la création d'une classe jusqu'au suivi de la caisse.</p>
        <button className="mt-4 rounded-lg bg-[#356743] px-5 py-2 text-sm font-medium text-white" onClick={onOpenHelp} type="button">▶ Lancer le tutoriel</button>
    </div>
</PageShell>;

const AboutPage = () => <PageShell eyebrow="SchoolDesk" title="À propos">
    <div className="space-y-6">
        <div>
            <h2 className="text-lg font-semibold text-[#18352b]">L'application</h2>
            <p className="mt-2 text-sm text-[#557064]">SchoolDesk est l'outil de gestion quotidienne de l'école : élèves, classes, présences, personnel, paiements, impayés, dépenses, salaires et caisse, réunis dans un seul endroit simple à utiliser.</p>
        </div>
        <div>
            <h2 className="text-lg font-semibold text-[#18352b]">Informations</h2>
            <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-[#6a8d72]">Application</dt><dd className="font-medium text-[#18352b]">SchoolDesk</dd></div>
                <div><dt className="text-[#6a8d72]">Version</dt><dd className="font-medium text-[#18352b]">0.1.0</dd></div>
                <div><dt className="text-[#6a8d72]">Créé par</dt><dd className="font-medium text-[#18352b]">Fetouaki A. — DG Design</dd></div>
                <div><dt className="text-[#6a8d72]">Contact</dt><dd className="font-medium text-[#18352b]"><a className="underline" href="mailto:ikaoutef@gmail.com">ikaoutef@gmail.com</a></dd></div>
            </dl>
        </div>
    </div>
</PageShell>;

function AppLayout({ user, onLogout, message, onClearMessage, children, isHelpOpen, onCloseHelp }: { user: User; onLogout: () => void; message: string; onClearMessage: () => void; children: ReactNode; isHelpOpen: boolean; onCloseHelp: () => void }) {
    const links = [['/', 'Dashboard'], ['/staff', 'Personnel'], ['/classes', 'Classes'], ['/students', 'Élèves'], ['/attendance', 'Présences'], ['/payments', 'Paiements'], ['/unpaid', 'Impayés'], ['/expenses', 'Dépenses'], ['/payroll', 'Salaires'], ['/cash', 'Caisse'], ['/settings', 'Paramètres'], ['/getting-started', 'Comment commencer'], ['/about', 'À propos']];
    const [isNavOpen, setNavOpen] = useState(false);
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(onClearMessage, 5000);
        return () => clearTimeout(timer);
    }, [message]);
    return <div className="min-h-screen bg-[#f4f7f2] text-[#18352b]">
        <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-[#d6e1d5] bg-[#18352b] p-5 text-white md:block"><div className="mb-8 text-xl font-semibold">SchoolDesk</div><nav className="space-y-1">{links.map(([to, label]) => <NavLink className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-[#4e8060] text-white' : 'text-[#d6e5d8] hover:bg-[#315a48]'}`} end={to === '/'} key={to} to={to}>{label}</NavLink>)}</nav></aside>
        <div className="md:pl-60">
            <header className="sticky top-0 z-40 grid grid-cols-3 items-center gap-2 border-b border-[#d6e1d5] bg-white px-3 py-3 sm:px-6 sm:py-4">
                <div><button aria-label="Ouvrir le menu" className="rounded-lg p-1.5 text-xl text-[#356743] md:hidden" onClick={() => setNavOpen(true)} type="button"><i className="fa-solid fa-bars" /></button></div>
                <div className="min-w-0 text-center"><p className="text-xs text-[#6a8d72] sm:text-sm">Espace de gestion</p><strong className="block truncate text-base leading-tight text-[#18352b] sm:text-xl" style={{ fontFamily: "'Fredoka', sans-serif" }}>{user.schoolName}</strong></div>
                <div className="hidden justify-end md:flex"><button className="whitespace-nowrap rounded-lg border border-[#356743] px-3 py-2 text-sm text-[#356743]" onClick={onLogout} type="button">Se déconnecter</button></div>
            </header>
            <main className="p-3 sm:p-6">{children}</main>
        </div>
        {isNavOpen && <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-[#18352b] p-5 text-white shadow-xl">
                <div className="mb-6 flex items-center justify-between"><span className="text-xl font-semibold">SchoolDesk</span><button aria-label="Fermer le menu" className="text-2xl leading-none text-[#d6e5d8]" onClick={() => setNavOpen(false)} type="button">✕</button></div>
                <nav className="flex-1 space-y-1 overflow-y-auto">{links.map(([to, label]) => <NavLink className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-[#4e8060] text-white' : 'text-[#d6e5d8] hover:bg-[#315a48]'}`} end={to === '/'} key={to} onClick={() => setNavOpen(false)} to={to}>{label}</NavLink>)}</nav>
                <button className="mt-4 rounded-lg border border-white/30 px-3 py-2 text-sm text-white" onClick={() => { setNavOpen(false); onLogout(); }} type="button">Se déconnecter</button>
            </div>
        </div>}
        {message && <div className="fixed inset-x-3 top-16 z-50 rounded-lg border border-[#d6e1d5] bg-white px-4 py-3 text-sm shadow-lg sm:inset-x-auto sm:right-6 sm:top-20 sm:max-w-sm"><div className="flex items-start gap-3"><p className="flex-1">{message}</p><button aria-label="Fermer" className="text-[#6a8d72] hover:text-[#18352b]" onClick={onClearMessage} type="button">✕</button></div></div>}
        <HelpModal onClose={onCloseHelp} open={isHelpOpen} />
    </div>;
}

export default function App() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [isHelpOpen, setHelpOpen] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [values, setValues] = useState(initialValues);
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [studentFees, setStudentFees] = useState<FinanceStudentFee[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [feeTypes, setFeeTypes] = useState<{ id: string; name: string; defaultAmount: string }[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [payrolls, setPayrolls] = useState<Payroll[]>([]);
    const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
    const [cash, setCash] = useState<CashEntry[]>([]);
    const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
    const [unpaidFees, setUnpaidFees] = useState<UnpaidFee[]>([]);
    const [financeSummary, setFinanceSummary] = useState<FinanceSummaryEntry[]>([]);
    const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
    const request = (path: string, options?: RequestInit) => fetch(`${apiUrl}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options?.headers } });
    const activeYear = academicYears.find((year) => year.status === 'ACTIVE') ?? academicYears[0];
    // Une coupure réseau ponctuelle pendant un rechargement ne doit jamais faire planter l'action
    // qui l'a déclenché (ex. ouvrir la fenêtre "Nouvel encaissement") — on garde simplement les
    // données déjà affichées plutôt que de laisser une exception non interceptée bloquer l'app.
    const loadFinance = async (studentId: string) => { try { const [fees, paymentList] = await Promise.all([request(`/api/student-fees?studentId=${studentId}`), request(`/api/payments?studentId=${studentId}`)]); if (fees.ok) setStudentFees((await fees.json()).fees); if (paymentList.ok) setPayments((await paymentList.json()).payments); } catch { /* réseau indisponible ponctuellement : on garde les données déjà en mémoire */ } };
    const loadDashboard = async (month?: string) => { try { const response = await request(`/api/dashboard/summary${month ? `?month=${month}` : ''}`); if (response.ok) setDashboardSummary(await response.json()); } catch { /* réseau indisponible ponctuellement */ } };
    const loadUnpaid = async () => { try { const params = new URLSearchParams(); if (values.unpaidClassId) params.set('schoolClassId', values.unpaidClassId); if (values.unpaidAcademicYearId) params.set('academicYearId', values.unpaidAcademicYearId); if (values.unpaidPeriod) params.set('period', values.unpaidPeriod); if (values.unpaidStatus) params.set('status', values.unpaidStatus); const response = await request(`/api/unpaid-fees?${params.toString()}`); if (response.ok) setUnpaidFees((await response.json()).fees); } catch { /* réseau indisponible ponctuellement */ } };
    const loadData = async () => { try { const years = await request('/api/academic-years'); let loadedYears: AcademicYear[] = []; if (years.ok) { loadedYears = (await years.json()).academicYears; setAcademicYears(loadedYears); } const loadedActiveYear = loadedYears.find((year) => year.status === 'ACTIVE') ?? loadedYears[0]; const [classList, studentList, employeeList, feeTypeList, categoryList, expenseList, payrollList, advanceList, cashList, dashboardResponse, summaryResponse] = await Promise.all([request(`/api/classes?academicYearId=${loadedActiveYear?.id ?? ''}`), request('/api/students'), request('/api/employees'), request('/api/fee-types'), request('/api/expense-categories'), request('/api/expenses'), request('/api/payrolls'), request('/api/salary-advances'), request('/api/cash'), request('/api/dashboard/summary'), request(`/api/finance/students-summary?academicYearId=${loadedActiveYear?.id ?? ''}`)]); if (classList.ok) { const data = (await classList.json()).classes; setClasses(data); if (!values.attendanceClassId) setValue('attendanceClassId', data[0]?.id ?? ''); } if (studentList.ok) { const data = (await studentList.json()).students; setStudents(data); if (!values.financeStudentId && data[0]) { setValue('financeStudentId', data[0].id); await loadFinance(data[0].id); } } if (employeeList.ok) setEmployees((await employeeList.json()).employees); if (feeTypeList.ok) { const data = (await feeTypeList.json()).feeTypes; setFeeTypes(data); if (!values.feeTypeId && data[0]) { setValue('feeTypeId', data[0].id); setValue('feeAmount', String(data[0].defaultAmount)); } } if (categoryList.ok) setCategories((await categoryList.json()).categories); if (expenseList.ok) setExpenses((await expenseList.json()).expenses); if (payrollList.ok) setPayrolls((await payrollList.json()).payrolls); if (advanceList.ok) setAdvances((await advanceList.json()).advances); if (cashList.ok) setCash((await cashList.json()).transactions); if (dashboardResponse.ok) setDashboardSummary(await dashboardResponse.json()); if (summaryResponse.ok) setFinanceSummary((await summaryResponse.json()).summary); await loadUnpaid(); } catch { /* réseau indisponible ponctuellement : on garde les données déjà en mémoire plutôt que de planter */ } };
    const login = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setIsLoading(true); const form = new FormData(event.currentTarget); const response = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: form.get('loginEmail'), password: form.get('loginPassword') }) }); const data = await response.json(); if (response.ok) { setUser(data.user); setMessage(''); await loadData(); navigate('/'); } else setMessage(data.error); setIsLoading(false); };
    const register = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setIsLoading(true); const form = new FormData(event.currentTarget); const response = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ schoolName: form.get('newSchoolName'), email: form.get('newSchoolEmail'), password: form.get('newSchoolPassword'), code: form.get('newSchoolCode'), countryCode: form.get('newSchoolCountry'), currencyCode: form.get('newSchoolCurrency') }) }); const data = await response.json(); if (response.ok) { setUser(data.user); setMessage(''); await loadData(); navigate('/'); } else setMessage(data.error); setIsLoading(false); };
    const requestRegistrationCode = async (email: string) => { setIsLoading(true); const response = await request('/api/auth/register/request-code', { method: 'POST', body: JSON.stringify({ email }) }); const data = await response.json(); setIsLoading(false); if (response.ok) { setMessage('Code envoyé — vérifiez votre boîte mail (et vos spams).'); return true; } setMessage(data.error); return false; };
    const logout = async () => { await request('/api/auth/logout', { method: 'POST' }); setUser(null); navigate('/'); };
    useEffect(() => { (async () => { try { const response = await request('/api/auth/me'); if (response.ok) { setUser((await response.json()).user); await loadData(); } } catch { /* réseau indisponible au chargement de l'onglet : rien à restaurer */ } setIsAuthChecking(false); })(); }, []);
    const loadDataRef = useRef(loadData);
    loadDataRef.current = loadData;
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => { loadDataRef.current(); }, 15_000);
        return () => clearInterval(interval);
    }, [user]);
    // Une coupure réseau ponctuelle affiche un message clair plutôt que de planter silencieusement
    // (l'app suppose une connexion active, mais ne doit pas se bloquer sans explication dessus).
    const create = async (path: string, body: unknown, success: string, after?: () => Promise<void>, method = 'POST') => { try { const response = await request(path, { method, body: JSON.stringify(body) }); if (response.ok) { setMessage(success); if (after) await after(); } else setMessage((await response.json()).error); } catch { setMessage('Action impossible sans connexion — réessayez une fois reconnecté.'); } };
    const restoreBackup = async (confirmName: string, backup: unknown) => {
        try {
            const response = await request('/api/backup/restore', { method: 'POST', body: JSON.stringify({ confirmName, backup }) });
            const data = await response.json();
            if (response.ok) { setMessage('Restauration réussie — les données de l\'école ont été remplacées par celles de la sauvegarde.'); await loadData(); return true; }
            setMessage(data.error);
            return false;
        } catch { setMessage('Action impossible sans connexion — réessayez une fois reconnecté.'); return false; }
    };
    const downloadBackup = async () => {
        try {
            const response = await request('/api/backup/export');
            if (!response.ok) { setMessage((await response.json()).error); return; }
            const blob = await response.blob();
            const filename = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? 'schooldesk-backup.json';
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            setMessage('Sauvegarde téléchargée.');
        } catch { setMessage('Action impossible sans connexion — réessayez une fois reconnecté.'); }
    };
    const createClass = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await create('/api/classes', { name: values.className, level: values.classLevel, room: values.classRoom || undefined, capacity: Number(values.classCapacity), academicYearId: activeYear?.id, teacherId: values.classTeacherId || undefined, assistantId: values.classAssistantId || undefined }, 'Classe créée.', loadData); };
    const updateClass = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await create(`/api/classes/${values.editingClassId}`, { name: values.className, level: values.classLevel, room: values.classRoom || undefined, capacity: Number(values.classCapacity), teacherId: values.classTeacherId || undefined, assistantId: values.classAssistantId || undefined, status: values.classStatus }, 'Classe modifiée.', loadData, 'PATCH'); };
    const deleteClass = async (classId: string) => {
        if (!window.confirm('Désactiver cette classe ? Elle ne sera plus visible mais son historique reste conservé.')) return;
        await create(`/api/classes/${classId}`, undefined, 'Classe désactivée.', loadData, 'DELETE');
    };
    const createAcademicYear = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await create('/api/academic-years', { label: values.yearLabel, startsAt: values.yearStartsAt, endsAt: values.yearEndsAt, status: values.yearStatus }, 'Année scolaire créée.', loadData);
    };
    const buildGuardianInput = () => values.guardianFirstName && values.guardianLastName && values.guardianPhone
        ? { firstName: values.guardianFirstName, lastName: values.guardianLastName, primaryPhone: values.guardianPhone, email: values.guardianEmail || undefined, relationship: values.guardianRelationship }
        : undefined;
    const createStudent = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await create('/api/students', { firstName: values.studentFirstName, lastName: values.studentLastName, birthDate: values.studentBirthDate, sex: values.studentSex, address: values.studentAddress || undefined, monthlyFee: values.studentMonthlyFee ? Number(values.studentMonthlyFee) : undefined, insuranceFee: values.studentInsuranceFee ? Number(values.studentInsuranceFee) : undefined, schoolClassId: values.studentClassId || undefined, academicYearId: activeYear?.id, guardian: buildGuardianInput() }, 'Élève créé.', loadData);
    };
    const updateStudent = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await create(`/api/students/${values.editingStudentId}`, { firstName: values.studentFirstName, lastName: values.studentLastName, birthDate: values.studentBirthDate, sex: values.studentSex, address: values.studentAddress || undefined, monthlyFee: values.studentMonthlyFee ? Number(values.studentMonthlyFee) : undefined, insuranceFee: values.studentInsuranceFee ? Number(values.studentInsuranceFee) : undefined, status: values.studentStatus, schoolClassId: values.studentClassId || undefined, academicYearId: activeYear?.id, guardian: buildGuardianInput() }, 'Élève modifié.', loadData, 'PATCH');
    };
    const deleteStudent = async (studentId: string) => {
        if (!window.confirm('Archiver cet élève ? Il ne sera plus visible dans la liste mais son historique reste conservé.')) return;
        await create(`/api/students/${studentId}`, undefined, 'Élève archivé.', loadData, 'DELETE');
    };
    const markStudentLeft = async (studentId: string) => {
        const student = students.find((candidate) => candidate.id === studentId);
        if (!student) return;
        if (!window.confirm(`Marquer ${student.firstName} ${student.lastName} comme parti(e) (changement d'école) ? Il/elle restera visible dans la liste avec le statut « Parti » mais ne comptera plus comme élève actif.`)) return;
        await create(`/api/students/${studentId}`, { firstName: student.firstName, lastName: student.lastName, birthDate: student.birthDate, sex: student.sex, status: 'LEFT' }, 'Élève marqué comme parti.', loadData, 'PATCH');
    };
    const buildEmployeeInput = () => ({ firstName: values.employeeFirstName, lastName: values.employeeLastName, type: values.employeeType, phone: values.employeePhone || undefined, email: values.employeeEmail || undefined, address: values.employeeAddress || undefined, qualification: values.employeeQualification || undefined, hiredAt: values.employeeHiredAt || undefined, baseSalary: values.employeeBaseSalary ? Number(values.employeeBaseSalary) : undefined, contractType: values.employeeContractType || undefined });
    const createEmployee = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await create('/api/employees', buildEmployeeInput(), 'Membre du personnel créé.', loadData); };
    const updateEmployee = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await create(`/api/employees/${values.editingEmployeeId}`, { ...buildEmployeeInput(), status: values.employeeStatus }, 'Membre du personnel modifié.', loadData, 'PATCH'); };
    const deleteEmployee = async (employeeId: string) => {
        if (!window.confirm('Archiver ce membre du personnel ? Il ne sera plus visible mais son historique reste conservé.')) return;
        await create(`/api/employees/${employeeId}`, undefined, 'Membre du personnel archivé.', loadData, 'DELETE');
    };
    const loadAttendance = async () => { try { const response = await request(`/api/attendance?date=${values.attendanceDate}&schoolClassId=${values.attendanceClassId}`); if (response.ok) { const data = await response.json(); setValues((current) => ({ ...current, ...Object.fromEntries((data.attendances as { studentId: string; status: string }[]).map((entry) => [`attendance_${entry.studentId}`, entry.status])) })); } } catch { /* réseau indisponible ponctuellement */ } };
    const saveAttendance = async () => { const classStudents = students.filter((student) => student.enrollments[0]?.schoolClass.id === values.attendanceClassId); await create('/api/attendance/bulk', { date: values.attendanceDate, schoolClassId: values.attendanceClassId, entries: classStudents.map((student) => ({ studentId: student.id, status: values[`attendance_${student.id}`] ?? 'PRESENT' })) }, 'Présences enregistrées.', loadAttendance); };
    const createFee = async () => { await create('/api/student-fees', { studentId: values.financeStudentId, feeTypeId: values.feeTypeId, academicYearId: activeYear?.id, period: values.feePeriod, expectedAmount: Number(values.feeAmount), dueDate: values.feeDueDate }, 'Frais créé.', async () => { await loadData(); await loadFinance(values.financeStudentId); }); };
    const createPayment = async () => {
        // Le sélecteur "Date du paiement" ne donne qu'un jour (YYYY-MM-DD, aujourd'hui par défaut,
        // ou une date antérieure choisie volontairement) — envoyer cette chaîne telle quelle au
        // serveur faisait perdre l'heure : new Date("YYYY-MM-DD") est toujours interprété en UTC
        // minuit par JavaScript, ce qui s'affichait "01:00:00" une fois reconverti en heure locale
        // sur le reçu dans un fuseau UTC+1 (bug corrigé le 29/08). On combine ici le jour choisi
        // avec l'heure/minute/seconde réelles de la saisie, jamais une heure fixe.
        const paidAt = values.paymentPaidAt ? (() => {
            const [year, month, day] = values.paymentPaidAt.split('-').map(Number);
            const now = new Date();
            return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).toISOString();
        })() : undefined;
        await create('/api/payments', { studentId: values.financeStudentId, academicYearId: activeYear?.id, feeTypeId: values.feeTypeId, period: values.feePeriod, amount: Number(values.paymentAmount), method: values.paymentMethod, paidAt }, 'Paiement enregistré et reçu créé.', async () => { await loadData(); await loadFinance(values.financeStudentId); });
        setValue('paymentAmount', '');
    };
    const cancelPayment = async (paymentId: string, reason: string) => { await create(`/api/payments/${paymentId}/cancel`, { reason }, 'Paiement annulé.', async () => { await loadData(); await loadFinance(values.financeStudentId); }); };
    const createExpense = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await create('/api/expenses', { categoryId: values.expenseCategoryId, description: values.expenseDescription, beneficiary: values.expenseBeneficiary, amount: Number(values.expenseAmount), method: values.expenseMethod, reference: values.expenseReference || undefined, comment: values.expenseComment || undefined }, 'Dépense enregistrée.', loadData); };
    const cancelExpense = async (expenseId: string, reason: string) => { await create(`/api/expenses/${expenseId}/cancel`, { reason }, 'Dépense annulée.', loadData); };
    const createCategory = async () => {
        if (!values.newCategoryName.trim()) return;
        const response = await request('/api/expense-categories', { method: 'POST', body: JSON.stringify({ name: values.newCategoryName }) });
        const data = await response.json();
        if (response.ok) { setMessage('Catégorie ajoutée.'); setValue('expenseCategoryId', data.category.id); await loadData(); } else setMessage(data.error);
        setValue('newCategoryName', '');
    };
    const createFeeType = async () => { if (!values.newFeeTypeName.trim()) return; await create('/api/fee-types', { name: values.newFeeTypeName, defaultAmount: Number(values.newFeeTypeAmount || 0), frequency: values.newFeeTypeFrequency }, 'Type de frais créé.', loadData); };
    const createPayroll = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await create('/api/payrolls', { employeeId: values.payrollEmployeeId, month: values.payrollMonth, baseSalary: Number(values.payrollBaseSalary), bonuses: Number(values.payrollBonuses), advances: Number(values.payrollAdvances), deductions: Number(values.payrollDeductions) }, 'Salaire créé.', loadData); };
    const updatePayroll = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await create(`/api/payrolls/${values.editingPayrollId}`, { month: values.payrollMonth, baseSalary: Number(values.payrollBaseSalary), bonuses: Number(values.payrollBonuses), advances: Number(values.payrollAdvances), deductions: Number(values.payrollDeductions) }, 'Salaire modifié.', loadData, 'PATCH'); };
    const payPayroll = async (payrollId: string, amount: number, method: string) => { await create(`/api/payrolls/${payrollId}/pay`, { amount, method }, 'Paiement de salaire enregistré.', loadData); };
    const cancelPayrollPayment = async (paymentId: string, reason: string) => { await create(`/api/payroll-payments/${paymentId}/cancel`, { reason }, 'Versement annulé.', loadData); };
    const deletePayroll = async (payrollId: string) => {
        if (!window.confirm('Supprimer ce salaire ? Cette action est irréversible (possible uniquement si aucun versement n\'a encore été enregistré).')) return;
        await create(`/api/payrolls/${payrollId}`, undefined, 'Salaire supprimé.', loadData, 'DELETE');
    };
    const createAdvance = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await create('/api/salary-advances', { employeeId: values.advanceEmployeeId, amount: Number(values.advanceAmount), reason: values.advanceReason || undefined, recoveryMonth: values.advanceMonth }, 'Avance enregistrée.', loadData); };
    const cancelAdvance = async (advanceId: string, reason: string) => { await create(`/api/salary-advances/${advanceId}/cancel`, { reason }, 'Avance annulée.', loadData); };
    const markAdvanceRecovered = async (advanceId: string) => { await create(`/api/salary-advances/${advanceId}/status`, { status: 'RECOVERED' }, 'Avance marquée récupérée.', loadData, 'PATCH'); };
    const viewUnpaidInPayments = async (studentId: string, feeTypeId: string, period: string, remaining: string) => {
        navigate('/payments');
        setValue('financeStudentId', studentId);
        setValue('feeTypeId', feeTypeId);
        setValue('feePeriod', period);
        setValue('paymentAmount', remaining);
        setValue('paymentMethod', 'CASH');
        setValue('paymentPaidAt', localDateString(new Date()));
        setValue('autoOpenPayment', '1');
        await loadFinance(studentId);
    };
    const visibleStudents = students.filter((student) => student.status !== 'ARCHIVED');
    const visibleEmployees = employees.filter((employee) => employee.status !== 'ARCHIVED');
    const visibleClasses = classes.filter((schoolClass) => schoolClass.status !== 'INACTIVE');
    const pageProps = { message, currency: user?.currencyCode ?? 'MAD', academicYears, classes: visibleClasses, students: visibleStudents, employees: visibleEmployees, studentFees, payments, unpaidFees, financeSummary, activeYear, onCreateClass: createClass, onUpdateClass: updateClass, onDeleteClass: deleteClass, onCreateAcademicYear: createAcademicYear, onCreateStudent: createStudent, onUpdateStudent: updateStudent, onDeleteStudent: deleteStudent, onMarkStudentLeft: markStudentLeft, onCreateEmployee: createEmployee, onUpdateEmployee: updateEmployee, onDeleteEmployee: deleteEmployee, onCreateFee: createFee, onCreatePayment: createPayment, onCancelPayment: cancelPayment, onSelectFinanceStudent: async (studentId: string) => { setValue('financeStudentId', studentId); await loadFinance(studentId); }, onLoadAttendance: loadAttendance, onSaveAttendance: saveAttendance, onFilterUnpaid: loadUnpaid, onViewUnpaidInPayments: viewUnpaidInPayments, setValue, values };
    if (isAuthChecking) return <Routes><Route path="/receipts/:paymentId" element={<ReceiptPage />} /><Route path="/receipts/fee/:studentFeeId" element={<FeeReceiptsPage />} /><Route path="/payslips/:paymentId" element={<PayslipPage />} /><Route path="*" element={<main className="flex min-h-screen items-center justify-center text-[#6a8d72]">Chargement…</main>} /></Routes>;
    if (!user) return <Routes><Route path="/receipts/:paymentId" element={<ReceiptPage />} /><Route path="/receipts/fee/:studentFeeId" element={<FeeReceiptsPage />} /><Route path="/payslips/:paymentId" element={<PayslipPage />} /><Route path="/login" element={<LoginPage initialMode="login" isLoading={isLoading} message={message} onLogin={login} onRegister={register} onRequestCode={requestRegistrationCode} />} /><Route path="/register" element={<LoginPage initialMode="register" isLoading={isLoading} message={message} onLogin={login} onRegister={register} onRequestCode={requestRegistrationCode} />} /><Route path="/" element={<LandingPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
    return <Routes><Route path="/receipts/:paymentId" element={<ReceiptPage />} /><Route path="/receipts/fee/:studentFeeId" element={<FeeReceiptsPage />} /><Route path="/payslips/:paymentId" element={<PayslipPage />} /><Route path="*" element={<AppLayout isHelpOpen={isHelpOpen} onCloseHelp={() => setHelpOpen(false)} user={user} onLogout={logout} message={message} onClearMessage={() => setMessage('')}><Routes><Route path="/" element={<DashboardPage activeYearLabel={activeYear?.label ?? 'Aucune année active'} currency={user.currencyCode} onChangeMonth={loadDashboard} summary={dashboardSummary} />} /><Route path="/students" element={<StudentsPage {...pageProps} />} /><Route path="/classes" element={<ClassesPage {...pageProps} />} /><Route path="/attendance" element={<AttendancePage {...pageProps} />} /><Route path="/staff" element={<StaffPage {...pageProps} />} /><Route path="/payments" element={<PaymentsPage {...pageProps} feeTypes={feeTypes} onCreateFeeType={createFeeType} />} /><Route path="/unpaid" element={<UnpaidPage {...pageProps} />} /><Route path="/expenses" element={<ExpensesPage categories={categories} currency={user.currencyCode} expenses={expenses} onCancelExpense={cancelExpense} onCreateCategory={createCategory} onCreateExpense={createExpense} setValue={setValue} values={values} />} /><Route path="/payroll" element={<PayrollPage advances={advances} currency={user.currencyCode} employees={visibleEmployees} onCancelAdvance={cancelAdvance} onCancelPayrollPayment={cancelPayrollPayment} onCreateAdvance={createAdvance} onCreatePayroll={createPayroll} onUpdatePayroll={updatePayroll} onDeletePayroll={deletePayroll} onMarkAdvanceRecovered={markAdvanceRecovered} onPayPayroll={payPayroll} payrolls={payrolls} setValue={setValue} values={values} />} /><Route path="/cash" element={<CashPage cash={cash} classes={visibleClasses} currency={user.currencyCode} />} /><Route path="/settings" element={<SettingsPage onDownloadBackup={downloadBackup} onRestoreBackup={restoreBackup} onSaved={setMessage} request={request} />} /><Route path="/getting-started" element={<GettingStartedPage onOpenHelp={() => setHelpOpen(true)} />} /><Route path="/about" element={<AboutPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></AppLayout>} /></Routes>;
}
