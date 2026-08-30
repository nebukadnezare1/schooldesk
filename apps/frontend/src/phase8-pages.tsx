import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardSummary } from './types';

type Props = { summary: DashboardSummary | null; activeYearLabel: string; onChangeMonth: (month?: string) => void };

const feeStatusLabels: Record<string, string> = { PAID: 'Payé', PARTIALLY_PAID: 'Partiel', UNPAID: 'Non payé', OVERDUE: 'En retard', EXEMPT: 'Exonéré', CANCELLED: 'Annulé' };
const feeStatusColors: Record<string, string> = { PAID: '#356743', PARTIALLY_PAID: '#c99a3f', UNPAID: '#a65d36', OVERDUE: '#a3372f', EXEMPT: '#6a8d72', CANCELLED: '#8c8c8c' };
const money = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} DH`;
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const fullMonthLabel = (key: string) => {
    const label = new Date(`${key}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return label.charAt(0).toUpperCase() + label.slice(1);
};
const shiftMonth = (key: string, delta: number) => {
    const [year, month] = key.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const Shell = ({ title, eyebrow, titleExtra, children }: { title: string; eyebrow: string; titleExtra?: ReactNode; children: React.ReactNode }) => <section><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#6a8d72]">{eyebrow}</p><div className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:items-baseline sm:justify-between"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{title}</h1>{titleExtra}</div><div className="mt-6 space-y-6 sm:mt-8">{children}</div></section>;
const Panel = ({ title, children }: { title?: string; children: React.ReactNode }) => <div className="rounded-2xl border border-[#d6e1d5] bg-white p-4 shadow-sm sm:p-6">{title && <h2 className="mb-4 text-lg font-semibold text-[#18352b]">{title}</h2>}{children}</div>;

const KpiCard = ({ label, value, hint, accent, to }: { label: string; value: string; hint?: ReactNode; accent: string; to: string }) => (
    <Link className="group relative block rounded-xl border border-[#d6e1d5] bg-white p-2.5 transition hover:-translate-y-px hover:shadow-md sm:rounded-2xl sm:p-4" style={{ borderLeft: `3px solid ${accent}` }} to={to}>
        <span className="absolute right-4 top-4 hidden text-sm text-[#6a8d72] opacity-0 transition group-hover:opacity-100 sm:block">→</span>
        <p className="text-[0.65rem] uppercase leading-tight tracking-wider text-[#6a8d72] sm:text-xs">{label}</p>
        <strong className="mt-1 block text-base tracking-tight sm:mt-1.5 sm:text-2xl">{value}</strong>
        {hint && <p className="mt-0.5 line-clamp-2 text-[0.65rem] leading-snug text-[#557064] sm:mt-1 sm:line-clamp-none sm:text-xs sm:leading-relaxed">{hint}</p>}
    </Link>
);

const FinanceRow = ({ label, value }: { label: string; value: string }) => <div className="flex items-center justify-between py-2.5 text-sm"><span className="text-[#6a8d72]">{label}</span><span className="font-medium">{value}</span></div>;

const trendHint = (current: number, previous: number) => {
    if (previous === 0 && current === 0) return 'Stable vs mois précédent';
    if (previous === 0) return 'Nouveau ce mois';
    const change = Math.round(((current - previous) / previous) * 100);
    return `${change >= 0 ? '+' : ''}${change}% vs mois précédent (${money(previous)})`;
};

export const DashboardPage = ({ summary, activeYearLabel, onChangeMonth }: Props) => {
    if (!summary) return <Shell title="Dashboard" eyebrow="Vue générale"><Panel><p className="text-[#557064]">Chargement des données…</p></Panel></Shell>;
    const { students, staff, finance, charts, toDo, month, isCurrentMonth } = summary;
    const toDoItems = [
        { count: toDo.unpaidCount, label: 'Impayés', to: '/payments' },
        { count: toDo.incompleteDossiers, label: 'Dossiers incomplets', to: '/students' },
        { count: toDo.absentToday, label: 'Absents aujourd’hui', to: '/attendance' },
        { count: toDo.payrollsToPay, label: 'Salaires restants', to: '/payroll' }
    ].filter((item) => item.count > 0);

    const monthNav = <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-[#557064]">
        <div className="flex items-center gap-1">
            <button aria-label="Mois précédent" className="flex h-7 w-7 items-center justify-center rounded-full border border-[#cbdacb] text-lg font-bold leading-none text-[#356743] transition hover:border-[#356743] hover:bg-[#edf4ec] sm:h-9 sm:w-9 sm:text-2xl" onClick={() => onChangeMonth(shiftMonth(month, -1))} type="button">‹</button>
            <span className="min-w-[6rem] text-center text-sm font-medium text-[#18352b] sm:min-w-[8rem] sm:text-base">{fullMonthLabel(month)}</span>
            <button aria-label="Mois suivant" className="flex h-7 w-7 items-center justify-center rounded-full border border-[#cbdacb] text-lg font-bold leading-none text-[#356743] transition hover:border-[#356743] hover:bg-[#edf4ec] sm:h-9 sm:w-9 sm:text-2xl" onClick={() => onChangeMonth(shiftMonth(month, 1))} type="button">›</button>
        </div>
        {!isCurrentMonth && <button className="whitespace-nowrap rounded-full border border-[#a8c5ac] px-2 py-0.5 text-xs text-[#356743] hover:bg-[#edf4ec]" onClick={() => onChangeMonth()} type="button">Aujourd'hui</button>}
    </div>;

    return <Shell eyebrow={`Vue générale · ${activeYearLabel}`} title="Dashboard" titleExtra={monthNav}>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
            <KpiCard accent="#356743" hint={`À la fin de ${monthLabel(month)}`} label="Solde de caisse" to="/cash" value={money(finance.balance)} />
            <KpiCard accent="#356743" hint={<>{trendHint(finance.monthIncome, finance.previousMonthIncome)}<br />Attendu : {money(finance.monthExpected)}</>} label={`Encaissé — ${monthLabel(month)}`} to="/payments" value={money(finance.monthIncome)} />
            <KpiCard accent={finance.unpaidTotal > 0 ? '#a65d36' : '#356743'} hint={finance.unpaidTotal > 0 ? 'À relancer' : 'Aucun impayé en cours'} label="Impayés en cours" to="/unpaid" value={money(finance.unpaidTotal)} />
            <KpiCard accent="#4e8060" hint={`${students.boys} G · ${students.girls} F · +${students.newThisMonth} ce mois`} label="Élèves actifs" to="/students" value={String(students.active)} />
            <KpiCard accent="#4e8060" hint={`dont ${staff.teachersActive} professeur(s)`} label="Personnel actif" to="/staff" value={String(staff.active)} />
            {toDoItems.length === 1
                ? <KpiCard accent="#c99a3f" hint={`${toDoItems[0].count} ${toDoItems[0].label.toLowerCase()}`} label="À traiter" to={toDoItems[0].to} value="1" />
                : <div className="relative block rounded-xl border border-[#d6e1d5] bg-white p-2.5 sm:rounded-2xl sm:p-4" style={{ borderLeft: `3px solid ${toDoItems.length > 0 ? '#c99a3f' : '#d6e1d5'}` }}>
                    <p className="text-[0.65rem] uppercase leading-tight tracking-wider text-[#6a8d72] sm:text-xs">À traiter</p>
                    <strong className="mt-1 block text-base tracking-tight sm:mt-1.5 sm:text-2xl">{toDoItems.length}</strong>
                    {toDoItems.length === 0 && <p className="mt-0.5 text-[0.65rem] text-[#557064] sm:mt-1 sm:text-xs">Rien à traiter</p>}
                    {toDoItems.length > 0 && <div className="mt-1.5 flex flex-col gap-1 sm:mt-2">
                        {toDoItems.map((item) => <Link className="-mx-2 flex items-center justify-between rounded-lg px-2 py-1 text-[0.65rem] text-[#18352b] hover:bg-[#f7faf6] hover:text-[#356743] sm:text-xs" key={item.label} to={item.to}><span>{item.label}</span><span className="text-[#6a8d72]">{item.count}</span></Link>)}
                    </div>}
                </div>}
        </div>
        <p className="text-center text-xs text-[#6a8d72]">Impayés en cours, Élèves actifs, Personnel actif et À traiter reflètent la situation du jour, quel que soit le mois affiché ci-dessus.</p>

        <Panel title={`Finances — ${monthLabel(month)}`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
                <div className="lg:flex-[1.5]">
                    <ResponsiveContainer height={220} width="100%">
                        <BarChart data={[{ label: monthLabel(month), Recettes: finance.monthIncome, Dépenses: finance.monthExpenses + finance.monthPayroll }]}>
                            <CartesianGrid stroke="#e5efe4" strokeDasharray="4 4" />
                            <XAxis dataKey="label" stroke="#6a8d72" tick={{ fontSize: 12 }} />
                            <YAxis stroke="#6a8d72" tick={{ fontSize: 12 }} width={70} />
                            <Tooltip formatter={(value: number) => money(value)} />
                            <Legend />
                            <Bar dataKey="Recettes" fill="#356743" name="Recettes" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="Dépenses" fill="#a65d36" name="Dépenses" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    <p className="mt-2 text-center text-xs text-[#6a8d72]">Résultat du mois : <strong className="text-[#18352b]">{money(finance.monthIncome - finance.monthExpenses - finance.monthPayroll)}</strong></p>
                </div>
                <div className="flex flex-col justify-center gap-1 lg:flex-1 lg:border-l lg:border-[#edf4ec] lg:pl-6">
                    <FinanceRow label="Encaissé du mois" value={money(finance.monthIncome)} />
                    <FinanceRow label="Dépenses du mois" value={money(finance.monthExpenses)} />
                    <FinanceRow label="Salaires du mois" value={money(finance.monthPayroll)} />
                </div>
            </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={`Élèves par classe — ${monthLabel(month)}`}>
                <ResponsiveContainer height={220} width="100%">
                    <BarChart data={charts.studentsByClass}>
                        <CartesianGrid stroke="#e5efe4" strokeDasharray="4 4" />
                        <XAxis dataKey="className" stroke="#6a8d72" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} stroke="#6a8d72" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#4e8060" name="Élèves" radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Panel>

            <Panel title={`Statut des frais — ${monthLabel(month)}`}>
                <ResponsiveContainer height={220} width="100%">
                    <PieChart>
                        <Pie data={charts.feeStatus.map((entry) => ({ name: feeStatusLabels[entry.status] ?? entry.status, count: entry.count, status: entry.status }))} dataKey="count" innerRadius={50} nameKey="name" outerRadius={78} paddingAngle={2}>
                            {charts.feeStatus.map((entry) => <Cell fill={feeStatusColors[entry.status] ?? '#8c8c8c'} key={entry.status} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </Panel>
        </div>
    </Shell>;
};
