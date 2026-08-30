import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CancelReasonModal, ContextMenu, Field, Modal, RowMenuButton, SortHeader, useSortedRows } from './pages';
import type { CashEntry, Employee, Expense, ExpenseCategory, Payroll, PayrollPayment, SalaryAdvance, SchoolClass } from './types';

const methodLabels: Record<string, string> = { CASH: 'Espèces', TRANSFER: 'Virement', CHECK: 'Chèque', CARD: 'Carte', OTHER: 'Autre' };
const payrollStatusLabels: Record<string, string> = { TO_PAY: 'À payer', PARTIALLY_PAID: 'Partiellement payé', PAID: 'Payé' };
const payrollStatusColors: Record<string, string> = { TO_PAY: 'bg-[#f4e6e1] text-[#a65d36]', PARTIALLY_PAID: 'bg-[#fff1df] text-[#8c7a3f]', PAID: 'bg-[#e5f1e5] text-[#356743]' };
const advanceStatusLabels: Record<string, string> = { OPEN: 'En cours', RECOVERED: 'Récupérée', CANCELLED: 'Annulée' };
const advanceStatusColors: Record<string, string> = { OPEN: 'bg-[#fff1df] text-[#8c7a3f]', RECOVERED: 'bg-[#e5f1e5] text-[#356743]', CANCELLED: 'bg-[#edeef1] text-[#5a6270]' };
const StatusBadge = ({ label, colorClass }: { label: string; colorClass: string }) => <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>{label}</span>;
const Shell = ({ title, children }: { title: string; children: ReactNode }) => <section><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#6a8d72]">Comptabilité</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl md:text-4xl">{title}</h1><div className="mt-6 space-y-6 sm:mt-8">{children}</div></section>;
const Panel = ({ children }: { children: ReactNode }) => <div className="rounded-2xl border border-[#d6e1d5] bg-white p-4 shadow-sm sm:p-6">{children}</div>;

const monthYearToDisplay = (value: string) => {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    return match ? `${match[2]}/${match[1]}` : '';
};
const MonthYearField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => {
    const [display, setDisplay] = useState(monthYearToDisplay(value));
    useEffect(() => { setDisplay(monthYearToDisplay(value)); }, [value]);
    const handleChange = (raw: string) => {
        const digits = raw.replace(/\D/g, '').slice(0, 6);
        const month = digits.slice(0, 2);
        const year = digits.slice(2, 6);
        setDisplay(digits.length > 2 ? `${month}/${year}` : month);
        onChange(month.length === 2 && year.length === 4 ? `${year}-${month}` : '');
    };
    return <label className="block text-sm font-medium text-[#315a48]">{label}<input className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" inputMode="numeric" onChange={(event) => handleChange(event.target.value)} placeholder="MM/AAAA" required value={display} /></label>;
};

// ===================== Dépenses =====================

type ExpenseSortKey = 'number' | 'occurredAt' | 'category' | 'description' | 'amount' | 'method' | 'status';
const expenseSortValue = (expense: Expense, key: ExpenseSortKey): string | number => {
    switch (key) {
        case 'number': return expense.number;
        case 'occurredAt': return new Date(expense.occurredAt).getTime();
        case 'category': return expense.category.name;
        case 'description': return expense.description;
        case 'amount': return Number(expense.amount);
        case 'method': return methodLabels[expense.method] ?? expense.method;
        case 'status': return expense.cancelledAt ? 'Annulé' : 'Actif';
    }
};
const emptyExpenseValues: Record<string, string> = { expenseCategoryId: '', expenseDescription: '', expenseBeneficiary: '', expenseAmount: '', expenseMethod: 'CASH', expenseReference: '', expenseComment: '' };

type ExpensesPageProps = {
    categories: ExpenseCategory[];
    expenses: Expense[];
    values: Record<string, string>;
    setValue: (key: string, value: string) => void;
    onCreateExpense: (event: FormEvent<HTMLFormElement>) => void;
    onCreateCategory: () => void;
    onCancelExpense: (expenseId: string, reason: string) => void;
};

export const ExpensesPage = ({ categories, expenses, values, setValue, onCreateExpense, onCreateCategory, onCancelExpense }: ExpensesPageProps) => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ expenseId: string; x: number; y: number } | null>(null);
    const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
    const closeMenu = () => setContextMenu(null);
    const menuExpense = contextMenu ? expenses.find((expense) => expense.id === contextMenu.expenseId) : undefined;
    const { sorted: sortedExpenses, sortKey, sortDirection, toggleSort } = useSortedRows(expenses, 'occurredAt' as ExpenseSortKey, expenseSortValue);

    const openCreate = () => { Object.entries(emptyExpenseValues).forEach(([key, value]) => setValue(key, value)); setModalOpen(true); };
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => { await onCreateExpense(event); setModalOpen(false); };

    return <Shell title="Dépenses">
        <Panel>
            <div className="mb-4 flex items-center justify-between"><p className="text-sm text-[#6a8d72]">{expenses.length} dépense(s) · clic droit (ou ⋮) sur une ligne pour annuler · clic sur un titre pour trier</p><button className="rounded-lg bg-[#356743] px-3 py-1.5 text-xs font-medium text-white sm:px-4 sm:py-2 sm:text-sm" onClick={openCreate} type="button">+ Nouvelle dépense</button></div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-max text-xs sm:text-sm">
                    <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]">
                        <SortHeader active={sortKey === 'number'} direction={sortDirection} label="Numéro" onSort={toggleSort} sortKey="number" />
                        <SortHeader active={sortKey === 'occurredAt'} direction={sortDirection} label="Date" onSort={toggleSort} sortKey="occurredAt" />
                        <SortHeader active={sortKey === 'category'} direction={sortDirection} label="Catégorie" onSort={toggleSort} sortKey="category" />
                        <SortHeader active={sortKey === 'description'} direction={sortDirection} label="Description" onSort={toggleSort} sortKey="description" />
                        <SortHeader active={sortKey === 'amount'} align="right" direction={sortDirection} label="Montant" onSort={toggleSort} sortKey="amount" />
                        <SortHeader active={sortKey === 'method'} direction={sortDirection} label="Mode" onSort={toggleSort} sortKey="method" />
                        <SortHeader active={sortKey === 'status'} direction={sortDirection} label="Statut" onSort={toggleSort} sortKey="status" />
                        <th className="w-8 py-2" />
                    </tr></thead>
                    <tbody>
                        {sortedExpenses.map((expense) => <tr className={`cursor-context-menu border-b border-[#edf4ec] hover:bg-[#f7faf6] ${expense.cancelledAt ? 'opacity-60' : ''}`} key={expense.id} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ expenseId: expense.id, x: event.clientX, y: event.clientY }); }}>
                            <td className="py-2 pr-4 text-[#6a8d72]">{expense.number}</td>
                            <td className="py-2 pr-4">{new Date(expense.occurredAt).toLocaleDateString('fr-FR')}</td>
                            <td className="py-2 pr-4">{expense.category.name}</td>
                            <td className="py-2 pr-4">{expense.description}{expense.beneficiary && <span className="text-[#6a8d72]"> · {expense.beneficiary}</span>}</td>
                            <td className="py-2 pr-4 text-right">{expense.amount} DH</td>
                            <td className="py-2 pr-4">{methodLabels[expense.method] ?? expense.method}</td>
                            <td className="py-2 pr-4">{expense.cancelledAt ? <StatusBadge colorClass="bg-[#f4e6e1] text-[#a3372f]" label="Annulé" /> : <StatusBadge colorClass="bg-[#e5f1e5] text-[#356743]" label="Actif" />}</td>
                            <td className="py-2 pl-2"><RowMenuButton onOpen={(x, y) => setContextMenu({ expenseId: expense.id, x, y })} /></td>
                        </tr>)}
                    </tbody>
                </table>
                {expenses.length === 0 && <p className="py-4 text-[#557064]">Aucune dépense enregistrée.</p>}
            </div>
        </Panel>

        {contextMenu && menuExpense && <ContextMenu items={menuExpense.cancelledAt ? [] : [{ label: 'Annuler la dépense', tone: 'danger', onClick: () => { closeMenu(); setCancelTargetId(menuExpense.id); } }]} onClose={closeMenu} x={contextMenu.x} y={contextMenu.y} />}
        <CancelReasonModal notice="La dépense originale est conservée pour l'historique ; son montant sera retiré de la caisse. Cette action ne peut pas être annulée." onClose={() => setCancelTargetId(null)} onConfirm={(reason) => { if (cancelTargetId) onCancelExpense(cancelTargetId, reason); setCancelTargetId(null); }} open={cancelTargetId !== null} title="Annuler la dépense" />

        <Modal onClose={() => setModalOpen(false)} open={isModalOpen} title="Nouvelle dépense">
            <div className="mb-4 flex items-end gap-2 border-b border-[#d6e1d5] pb-4">
                <div className="flex-1"><Field label="Nouvelle catégorie" onChange={(value) => setValue('newCategoryName', value)} required={false} value={values.newCategoryName ?? ''} /></div>
                <button className="rounded-lg border border-[#356743] px-3 py-1.5 text-xs text-[#356743] sm:px-4 sm:py-2 sm:text-sm" onClick={onCreateCategory} type="button">Ajouter</button>
            </div>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
                <label className="block text-sm font-medium text-[#315a48] sm:col-span-2">Catégorie<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('expenseCategoryId', event.target.value)} required value={values.expenseCategoryId}><option value="">Choisir</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <Field label="Description" onChange={(value) => setValue('expenseDescription', value)} value={values.expenseDescription} />
                <Field label="Bénéficiaire / fournisseur" onChange={(value) => setValue('expenseBeneficiary', value)} required={false} value={values.expenseBeneficiary} />
                <Field label="Montant" onChange={(value) => setValue('expenseAmount', value)} type="number" value={values.expenseAmount} />
                <label className="block text-sm font-medium text-[#315a48]">Mode<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('expenseMethod', event.target.value)} value={values.expenseMethod}><option value="CASH">Espèces</option><option value="TRANSFER">Virement</option><option value="CHECK">Chèque</option><option value="CARD">Carte</option></select></label>
                <Field label="Référence" onChange={(value) => setValue('expenseReference', value)} required={false} value={values.expenseReference} />
                <div className="sm:col-span-2"><Field label="Commentaire" onChange={(value) => setValue('expenseComment', value)} required={false} value={values.expenseComment} /></div>
                <div className="sm:col-span-2"><button className="w-full rounded-lg bg-[#356743] px-4 py-2 font-medium text-white" type="submit">Enregistrer la dépense</button></div>
            </form>
        </Modal>
    </Shell>;
};

// ===================== Salaires =====================

type PayrollSortKey = 'employee' | 'month' | 'baseSalary' | 'netSalary' | 'amountPaid' | 'remaining' | 'status';
const payrollSortValue = (payroll: Payroll, key: PayrollSortKey): string | number => {
    switch (key) {
        case 'employee': return `${payroll.employee.lastName} ${payroll.employee.firstName}`;
        case 'month': return payroll.month;
        case 'baseSalary': return Number(payroll.baseSalary);
        case 'netSalary': return Number(payroll.netSalary);
        case 'amountPaid': return Number(payroll.amountPaid);
        case 'remaining': return Number(payroll.netSalary) - Number(payroll.amountPaid);
        case 'status': return payrollStatusLabels[payroll.status] ?? payroll.status;
    }
};

type AdvanceSortKey = 'employee' | 'occurredAt' | 'amount' | 'recoveryMonth' | 'status';
const advanceSortValue = (advance: SalaryAdvance, key: AdvanceSortKey): string | number => {
    switch (key) {
        case 'employee': return `${advance.employee.lastName} ${advance.employee.firstName}`;
        case 'occurredAt': return new Date(advance.occurredAt).getTime();
        case 'amount': return Number(advance.amount);
        case 'recoveryMonth': return advance.recoveryMonth;
        case 'status': return advanceStatusLabels[advance.status] ?? advance.status;
    }
};

const emptyPayrollValues: Record<string, string> = { payrollEmployeeId: '', payrollMonth: '', payrollBaseSalary: '', payrollBonuses: '0', payrollAdvances: '0', payrollDeductions: '0', editingPayrollId: '' };
const emptyAdvanceValues: Record<string, string> = { advanceEmployeeId: '', advanceAmount: '', advanceReason: '', advanceMonth: '' };

const PayModal = ({ open, onClose, onConfirm, payroll }: { open: boolean; onClose: () => void; onConfirm: (amount: number, method: string) => void; payroll: Payroll | null }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('CASH');
    const remaining = payroll ? Math.max(0, Number(payroll.netSalary) - Number(payroll.amountPaid)) : 0;

    useEffect(() => {
        if (open && payroll) setAmount(String(remaining));
    }, [open, payroll?.id]);

    return <Modal onClose={onClose} open={open} title="Enregistrer un versement">
        {payroll && <p className="mb-3 text-sm text-[#6a8d72]">{payroll.employee.firstName} {payroll.employee.lastName} — reste {remaining} DH sur {payroll.netSalary} DH.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Montant" onChange={setAmount} type="number" value={amount} />
            <label className="block text-sm font-medium text-[#315a48]">Mode<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setMethod(event.target.value)} value={method}><option value="CASH">Espèces</option><option value="TRANSFER">Virement</option><option value="CHECK">Chèque</option><option value="CARD">Carte</option></select></label>
        </div>
        <button className="mt-4 rounded-lg bg-[#356743] px-4 py-2 text-white disabled:opacity-50" disabled={!amount || Number(amount) <= 0} onClick={() => { onConfirm(Number(amount), method); setAmount(''); }} type="button">Confirmer le versement</button>
    </Modal>;
};

const PayrollPaymentsModal = ({ open, onClose, payroll, onCancelPayment }: { open: boolean; onClose: () => void; payroll: Payroll | null; onCancelPayment: (paymentId: string) => void }) => {
    const navigate = useNavigate();
    if (!payroll) return <Modal onClose={onClose} open={false} title="Versements">{null}</Modal>;
    return <Modal onClose={onClose} open={open} title={`Versements — ${payroll.employee.firstName} ${payroll.employee.lastName} (${payroll.month})`}>
        <div className="space-y-2">
            {payroll.payments.map((payment: PayrollPayment) => <div className={`flex items-center justify-between rounded-lg border border-[#d6e1d5] p-3 ${payment.cancelledAt ? 'opacity-60' : ''}`} key={payment.id}>
                <div>
                    <p>{new Date(payment.paidAt).toLocaleDateString('fr-FR')} · {payment.amount} DH · {methodLabels[payment.method] ?? payment.method}</p>
                    {payment.cancelledAt && <p className="text-xs text-[#a3372f]">Annulé{payment.cancelReason ? ` — ${payment.cancelReason}` : ''}</p>}
                </div>
                <div className="flex gap-2">
                    <button className="rounded-lg border border-[#356743] px-3 py-1 text-xs text-[#356743]" onClick={() => navigate(`/payslips/${payment.id}`)} type="button">Voir le bulletin</button>
                    {!payment.cancelledAt && <button className="rounded-lg border border-[#a3372f] px-3 py-1 text-xs text-[#a3372f]" onClick={() => onCancelPayment(payment.id)} type="button">Annuler</button>}
                </div>
            </div>)}
            {payroll.payments.length === 0 && <p className="text-[#557064]">Aucun versement enregistré.</p>}
        </div>
    </Modal>;
};

type PayrollPageProps = {
    employees: Employee[];
    payrolls: Payroll[];
    advances: SalaryAdvance[];
    values: Record<string, string>;
    setValue: (key: string, value: string) => void;
    onCreatePayroll: (event: FormEvent<HTMLFormElement>) => void;
    onUpdatePayroll: (event: FormEvent<HTMLFormElement>) => void;
    onDeletePayroll: (payrollId: string) => void;
    onPayPayroll: (payrollId: string, amount: number, method: string) => void;
    onCancelPayrollPayment: (paymentId: string, reason: string) => void;
    onCreateAdvance: (event: FormEvent<HTMLFormElement>) => void;
    onCancelAdvance: (advanceId: string, reason: string) => void;
    onMarkAdvanceRecovered: (advanceId: string) => void;
};

export const PayrollPage = ({ employees, payrolls, advances, values, setValue, onCreatePayroll, onUpdatePayroll, onDeletePayroll, onPayPayroll, onCancelPayrollPayment, onCreateAdvance, onCancelAdvance, onMarkAdvanceRecovered }: PayrollPageProps) => {
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [payrollContextMenu, setPayrollContextMenu] = useState<{ payrollId: string; x: number; y: number } | null>(null);
    const [payModalTargetId, setPayModalTargetId] = useState<string | null>(null);
    const [paymentsModalTargetId, setPaymentsModalTargetId] = useState<string | null>(null);
    const [cancelPaymentTargetId, setCancelPaymentTargetId] = useState<string | null>(null);

    const [isAdvanceModalOpen, setAdvanceModalOpen] = useState(false);
    const [advanceContextMenu, setAdvanceContextMenu] = useState<{ advanceId: string; x: number; y: number } | null>(null);
    const [cancelAdvanceTargetId, setCancelAdvanceTargetId] = useState<string | null>(null);

    const [employeeFilter, setEmployeeFilter] = useState('');
    const filteredPayrolls = employeeFilter ? payrolls.filter((payroll) => payroll.employee.id === employeeFilter) : payrolls;
    const filteredAdvances = employeeFilter ? advances.filter((advance) => advance.employee.id === employeeFilter) : advances;
    const employeeFilterSelect = <select className="rounded-lg border border-[#cbdacb] bg-white px-3 py-2 text-sm" onChange={(event) => setEmployeeFilter(event.target.value)} value={employeeFilter}>
        <option value="">Tous les employés</option>
        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
    </select>;

    const closePayrollMenu = () => setPayrollContextMenu(null);
    const menuPayroll = payrollContextMenu ? payrolls.find((payroll) => payroll.id === payrollContextMenu.payrollId) : undefined;
    const paymentsModalPayroll = paymentsModalTargetId ? payrolls.find((payroll) => payroll.id === paymentsModalTargetId) ?? null : null;

    const closeAdvanceMenu = () => setAdvanceContextMenu(null);
    const menuAdvance = advanceContextMenu ? advances.find((advance) => advance.id === advanceContextMenu.advanceId) : undefined;

    const { sorted: sortedPayrolls, sortKey: payrollSortKey, sortDirection: payrollSortDirection, toggleSort: togglePayrollSort } = useSortedRows(filteredPayrolls, 'month' as PayrollSortKey, payrollSortValue);
    const { sorted: sortedAdvances, sortKey: advanceSortKey, sortDirection: advanceSortDirection, toggleSort: toggleAdvanceSort } = useSortedRows(filteredAdvances, 'occurredAt' as AdvanceSortKey, advanceSortValue);

    const isEditingPayroll = Boolean(values.editingPayrollId);
    const openCreatePayroll = () => { Object.entries(emptyPayrollValues).forEach(([key, value]) => setValue(key, value)); setCreateModalOpen(true); };
    const openEditPayroll = (payroll: Payroll) => {
        setValue('editingPayrollId', payroll.id);
        setValue('payrollEmployeeId', payroll.employee.id);
        setValue('payrollMonth', payroll.month);
        setValue('payrollBaseSalary', payroll.baseSalary);
        setValue('payrollBonuses', payroll.bonuses);
        setValue('payrollAdvances', payroll.advances);
        setValue('payrollDeductions', payroll.deductions);
        setCreateModalOpen(true);
    };
    const handleCreatePayrollSubmit = async (event: FormEvent<HTMLFormElement>) => { await (isEditingPayroll ? onUpdatePayroll(event) : onCreatePayroll(event)); setCreateModalOpen(false); };
    const openCreateAdvance = () => { Object.entries(emptyAdvanceValues).forEach(([key, value]) => setValue(key, value)); setAdvanceModalOpen(true); };
    const handleCreateAdvanceSubmit = async (event: FormEvent<HTMLFormElement>) => { await onCreateAdvance(event); setAdvanceModalOpen(false); };

    return <Shell title="Salaires">
        <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[#6a8d72]">{sortedPayrolls.length} salaire(s){employeeFilter ? ` sur ${payrolls.length}` : ''} · clic droit (ou ⋮) pour enregistrer un versement ou voir l'historique · clic sur un titre pour trier</p>
                <div className="flex flex-wrap items-center gap-2">{employeeFilterSelect}<button className="rounded-lg bg-[#356743] px-3 py-1.5 text-xs font-medium text-white sm:px-4 sm:py-2 sm:text-sm" onClick={openCreatePayroll} type="button">+ Nouveau salaire</button></div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-max text-xs sm:text-sm">
                    <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]">
                        <SortHeader active={payrollSortKey === 'employee'} direction={payrollSortDirection} label="Employé" onSort={togglePayrollSort} sortKey="employee" />
                        <SortHeader active={payrollSortKey === 'month'} direction={payrollSortDirection} label="Mois" onSort={togglePayrollSort} sortKey="month" />
                        <SortHeader active={payrollSortKey === 'baseSalary'} align="right" direction={payrollSortDirection} label="Base" onSort={togglePayrollSort} sortKey="baseSalary" />
                        <SortHeader active={payrollSortKey === 'netSalary'} align="right" direction={payrollSortDirection} label="Net" onSort={togglePayrollSort} sortKey="netSalary" />
                        <SortHeader active={payrollSortKey === 'amountPaid'} align="right" direction={payrollSortDirection} label="Payé" onSort={togglePayrollSort} sortKey="amountPaid" />
                        <SortHeader active={payrollSortKey === 'remaining'} align="right" direction={payrollSortDirection} label="Reste" onSort={togglePayrollSort} sortKey="remaining" />
                        <SortHeader active={payrollSortKey === 'status'} direction={payrollSortDirection} label="Statut" onSort={togglePayrollSort} sortKey="status" />
                        <th className="w-8 py-2" />
                    </tr></thead>
                    <tbody>
                        {sortedPayrolls.map((payroll) => {
                            const remaining = (Number(payroll.netSalary) - Number(payroll.amountPaid)).toFixed(2);
                            return <tr className="cursor-context-menu border-b border-[#edf4ec] hover:bg-[#f7faf6]" key={payroll.id} onContextMenu={(event) => { event.preventDefault(); setPayrollContextMenu({ payrollId: payroll.id, x: event.clientX, y: event.clientY }); }}>
                                <td className="py-2 pr-4">{payroll.employee.firstName} {payroll.employee.lastName}</td>
                                <td className="py-2 pr-4">{payroll.month}</td>
                                <td className="py-2 pr-4 text-right">{payroll.baseSalary} DH</td>
                                <td className="py-2 pr-4 text-right">{payroll.netSalary} DH</td>
                                <td className="py-2 pr-4 text-right">{payroll.amountPaid} DH</td>
                                <td className="py-2 pr-4 text-right font-semibold">{remaining} DH</td>
                                <td className="py-2 pr-4"><StatusBadge colorClass={payrollStatusColors[payroll.status] ?? 'bg-[#edf4ec] text-[#356743]'} label={payrollStatusLabels[payroll.status] ?? payroll.status} /></td>
                                <td className="py-2 pl-2"><RowMenuButton onOpen={(x, y) => setPayrollContextMenu({ payrollId: payroll.id, x, y })} /></td>
                            </tr>;
                        })}
                    </tbody>
                </table>
                {sortedPayrolls.length === 0 && <p className="py-4 text-[#557064]">{payrolls.length === 0 ? 'Aucun salaire enregistré.' : 'Aucun salaire pour cet employé.'}</p>}
            </div>
        </Panel>

        {payrollContextMenu && menuPayroll && <ContextMenu items={[
            ...(menuPayroll.status !== 'PAID' ? [{ label: 'Enregistrer un versement', onClick: () => { closePayrollMenu(); setPayModalTargetId(menuPayroll.id); } }] : []),
            ...(menuPayroll.payments.length > 0 ? [{ label: 'Voir les versements', onClick: () => { closePayrollMenu(); setPaymentsModalTargetId(menuPayroll.id); } }] : []),
            ...(menuPayroll.payments.length === 0 ? [{ label: 'Modifier', onClick: () => { closePayrollMenu(); openEditPayroll(menuPayroll); } }] : []),
            ...(menuPayroll.payments.length === 0 ? [{ label: 'Supprimer (erreur de saisie)', tone: 'danger' as const, onClick: () => { closePayrollMenu(); onDeletePayroll(menuPayroll.id); } }] : [])
        ]} onClose={closePayrollMenu} x={payrollContextMenu.x} y={payrollContextMenu.y} />}

        <PayModal onClose={() => setPayModalTargetId(null)} onConfirm={(amount, method) => { if (payModalTargetId) onPayPayroll(payModalTargetId, amount, method); setPayModalTargetId(null); }} open={payModalTargetId !== null} payroll={payModalTargetId ? payrolls.find((payroll) => payroll.id === payModalTargetId) ?? null : null} />
        <PayrollPaymentsModal onCancelPayment={(paymentId) => setCancelPaymentTargetId(paymentId)} onClose={() => setPaymentsModalTargetId(null)} open={paymentsModalTargetId !== null} payroll={paymentsModalPayroll} />
        <CancelReasonModal notice="Le versement original est conservé pour l'historique ; son montant sera retiré de la caisse et le salaire redeviendra dû d'autant." onClose={() => setCancelPaymentTargetId(null)} onConfirm={(reason) => { if (cancelPaymentTargetId) onCancelPayrollPayment(cancelPaymentTargetId, reason); setCancelPaymentTargetId(null); setPaymentsModalTargetId(null); }} open={cancelPaymentTargetId !== null} title="Annuler le versement" />

        <Modal onClose={() => setCreateModalOpen(false)} open={isCreateModalOpen} title={isEditingPayroll ? 'Modifier le salaire' : 'Nouveau salaire'}>
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={handleCreatePayrollSubmit}>
                <label className="block text-sm font-medium text-[#315a48] sm:col-span-3">Employé<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2 disabled:bg-[#f4f7f2] disabled:text-[#6a8d72]" disabled={isEditingPayroll} onChange={(event) => { setValue('payrollEmployeeId', event.target.value); const employee = employees.find((candidate) => candidate.id === event.target.value); setValue('payrollBaseSalary', employee?.baseSalary ?? ''); }} required value={values.payrollEmployeeId}><option value="">Choisir</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></label>
                <MonthYearField label="Mois" onChange={(value) => setValue('payrollMonth', value)} value={values.payrollMonth} />
                <Field label="Salaire de base" onChange={(value) => setValue('payrollBaseSalary', value)} type="number" value={values.payrollBaseSalary} />
                <Field label="Primes" onChange={(value) => setValue('payrollBonuses', value)} type="number" value={values.payrollBonuses} />
                <Field label="Avances déduites" onChange={(value) => setValue('payrollAdvances', value)} type="number" value={values.payrollAdvances} />
                <Field label="Retenues" onChange={(value) => setValue('payrollDeductions', value)} type="number" value={values.payrollDeductions} />
                <div className="sm:col-span-3"><button className="w-full rounded-lg bg-[#356743] px-4 py-2 font-medium text-white" type="submit">{isEditingPayroll ? 'Enregistrer les modifications' : 'Créer le salaire'}</button></div>
            </form>
        </Modal>

        <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-semibold text-[#18352b]">Avances sur salaire</h2><p className="text-sm text-[#6a8d72]">{sortedAdvances.length} avance(s){employeeFilter ? ` sur ${advances.length}` : ''} · clic droit (ou ⋮) sur une ligne pour gérer · clic sur un titre pour trier</p></div>
                <div className="flex flex-wrap items-center gap-2">{employeeFilterSelect}<button className="rounded-lg border border-[#356743] px-3 py-1.5 text-xs text-[#356743] sm:px-4 sm:py-2 sm:text-sm" onClick={openCreateAdvance} type="button">+ Nouvelle avance</button></div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-max text-xs sm:text-sm">
                    <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]">
                        <SortHeader active={advanceSortKey === 'employee'} direction={advanceSortDirection} label="Employé" onSort={toggleAdvanceSort} sortKey="employee" />
                        <SortHeader active={advanceSortKey === 'occurredAt'} direction={advanceSortDirection} label="Date" onSort={toggleAdvanceSort} sortKey="occurredAt" />
                        <SortHeader active={advanceSortKey === 'amount'} align="right" direction={advanceSortDirection} label="Montant" onSort={toggleAdvanceSort} sortKey="amount" />
                        <SortHeader active={advanceSortKey === 'recoveryMonth'} direction={advanceSortDirection} label="Récupération" onSort={toggleAdvanceSort} sortKey="recoveryMonth" />
                        <SortHeader active={advanceSortKey === 'status'} direction={advanceSortDirection} label="Statut" onSort={toggleAdvanceSort} sortKey="status" />
                        <th className="w-8 py-2" />
                    </tr></thead>
                    <tbody>
                        {sortedAdvances.map((advance) => <tr className={`cursor-context-menu border-b border-[#edf4ec] hover:bg-[#f7faf6] ${advance.status === 'CANCELLED' ? 'opacity-60' : ''}`} key={advance.id} onContextMenu={(event) => { event.preventDefault(); setAdvanceContextMenu({ advanceId: advance.id, x: event.clientX, y: event.clientY }); }}>
                            <td className="py-2 pr-4">{advance.employee.firstName} {advance.employee.lastName}</td>
                            <td className="py-2 pr-4">{new Date(advance.occurredAt).toLocaleDateString('fr-FR')}</td>
                            <td className="py-2 pr-4 text-right">{advance.amount} DH</td>
                            <td className="py-2 pr-4">{advance.recoveryMonth}</td>
                            <td className="py-2 pr-4"><StatusBadge colorClass={advanceStatusColors[advance.status] ?? 'bg-[#edf4ec] text-[#356743]'} label={advanceStatusLabels[advance.status] ?? advance.status} /></td>
                            <td className="py-2 pl-2"><RowMenuButton onOpen={(x, y) => setAdvanceContextMenu({ advanceId: advance.id, x, y })} /></td>
                        </tr>)}
                    </tbody>
                </table>
                {sortedAdvances.length === 0 && <p className="py-4 text-[#557064]">{advances.length === 0 ? 'Aucune avance enregistrée.' : 'Aucune avance pour cet employé.'}</p>}
            </div>
        </Panel>

        {advanceContextMenu && menuAdvance && <ContextMenu items={menuAdvance.status === 'OPEN' ? [
            { label: 'Marquer récupérée', onClick: () => { closeAdvanceMenu(); onMarkAdvanceRecovered(menuAdvance.id); } },
            { label: 'Annuler l’avance', tone: 'danger' as const, onClick: () => { closeAdvanceMenu(); setCancelAdvanceTargetId(menuAdvance.id); } }
        ] : []} onClose={closeAdvanceMenu} x={advanceContextMenu.x} y={advanceContextMenu.y} />}
        <CancelReasonModal notice="L'avance originale est conservée pour l'historique. Cette action ne peut pas être annulée." onClose={() => setCancelAdvanceTargetId(null)} onConfirm={(reason) => { if (cancelAdvanceTargetId) onCancelAdvance(cancelAdvanceTargetId, reason); setCancelAdvanceTargetId(null); }} open={cancelAdvanceTargetId !== null} title="Annuler l'avance" />

        <Modal onClose={() => setAdvanceModalOpen(false)} open={isAdvanceModalOpen} title="Nouvelle avance">
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={handleCreateAdvanceSubmit}>
                <label className="block text-sm font-medium text-[#315a48] sm:col-span-3">Employé<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('advanceEmployeeId', event.target.value)} required value={values.advanceEmployeeId}><option value="">Choisir</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></label>
                <Field label="Montant" onChange={(value) => setValue('advanceAmount', value)} type="number" value={values.advanceAmount} />
                <Field label="Mois de récupération (AAAA-MM)" onChange={(value) => setValue('advanceMonth', value)} value={values.advanceMonth} />
                <Field label="Motif" onChange={(value) => setValue('advanceReason', value)} required={false} value={values.advanceReason} />
                <div className="sm:col-span-3"><button className="w-full rounded-lg bg-[#356743] px-4 py-2 font-medium text-white" type="submit">Enregistrer l'avance</button></div>
            </form>
        </Modal>
    </Shell>;
};

// ===================== Caisse =====================

type CashSortKey = 'occurredAt' | 'type' | 'description' | 'linked' | 'feePeriod' | 'amount' | 'status';
const cashSortValue = (entry: CashEntry, key: CashSortKey): string | number => {
    switch (key) {
        case 'occurredAt': return new Date(entry.occurredAt).getTime();
        case 'type': return entry.type === 'INCOME' ? 'Entrée' : 'Sortie';
        case 'description': return entry.description;
        case 'linked': return entry.linkedName ?? entry.className ?? '';
        case 'feePeriod': return entry.feePeriod ?? '';
        case 'amount': return Number(entry.amount);
        case 'status': return entry.cancelled ? 'Annulé' : 'Actif';
    }
};

const monthKey = (dateStr: string) => dateStr.slice(0, 7);
const monthLabel = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
};

export const CashPage = ({ cash, classes }: { cash: CashEntry[]; classes: SchoolClass[] }) => {
    const [monthFilter, setMonthFilter] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [studentFilter, setStudentFilter] = useState('');
    const [search, setSearch] = useState('');
    const hasFilter = Boolean(monthFilter || classFilter || typeFilter || studentFilter || search);

    const months = Array.from(new Set(cash.map((item) => monthKey(item.occurredAt)))).sort().reverse();
    const students = Array.from(new Map(cash.filter((item) => item.studentId).map((item) => [item.studentId as string, item.linkedName as string])).entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const filtered = cash.filter((item) => {
        if (monthFilter && monthKey(item.occurredAt) !== monthFilter) return false;
        if (classFilter && item.classId !== classFilter) return false;
        if (typeFilter && item.type !== typeFilter) return false;
        if (studentFilter && item.studentId !== studentFilter) return false;
        if (search) {
            const needle = search.trim().toLowerCase();
            if (!`${item.description} ${item.linkedName ?? ''} ${item.feePeriod ?? ''}`.toLowerCase().includes(needle)) return false;
        }
        return true;
    });

    const active = filtered.filter((item) => !item.cancelled);
    const income = active.filter((item) => item.type === 'INCOME').reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = active.filter((item) => item.type === 'EXPENSE').reduce((sum, item) => sum + Number(item.amount), 0);
    const { sorted, sortKey, sortDirection, toggleSort } = useSortedRows(filtered, 'occurredAt' as CashSortKey, cashSortValue);

    return <Shell title="Caisse">
        <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-[#e5f1e5] p-4">Entrées{hasFilter && <span className="text-xs font-normal"> (filtré)</span>}<strong className="block text-2xl">{income.toFixed(2)} DH</strong></div>
            <div className="rounded-lg bg-[#fff1df] p-4">Sorties{hasFilter && <span className="text-xs font-normal"> (filtré)</span>}<strong className="block text-2xl">{expenses.toFixed(2)} DH</strong></div>
            <div className="rounded-lg bg-[#edf4ec] p-4">Solde{hasFilter && <span className="text-xs font-normal"> (filtré)</span>}<strong className="block text-2xl">{(income - expenses).toFixed(2)} DH</strong></div>
        </div>
        <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[#6a8d72]">{filtered.length} mouvement(s){hasFilter ? ` sur ${cash.length}` : ''} · les lignes annulées restent visibles mais sont exclues des totaux · clic sur un titre pour trier</p>
                <div className="flex flex-wrap items-center gap-2">
                    <input className="rounded-lg border border-[#cbdacb] bg-white px-3 py-2 text-sm" onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher (élève, employé, description)" type="search" value={search} />
                    <select className="rounded-lg border border-[#cbdacb] bg-white px-3 py-2 text-sm" onChange={(event) => setMonthFilter(event.target.value)} value={monthFilter}>
                        <option value="">Tous les mois</option>
                        {months.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
                    </select>
                    <select className="rounded-lg border border-[#cbdacb] bg-white px-3 py-2 text-sm" onChange={(event) => setClassFilter(event.target.value)} value={classFilter}>
                        <option value="">Toutes les classes</option>
                        {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
                    </select>
                    <select className="rounded-lg border border-[#cbdacb] bg-white px-3 py-2 text-sm" onChange={(event) => setStudentFilter(event.target.value)} value={studentFilter}>
                        <option value="">Tous les élèves</option>
                        {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
                    </select>
                    <select className="rounded-lg border border-[#cbdacb] bg-white px-3 py-2 text-sm" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                        <option value="">Entrées et sorties</option>
                        <option value="INCOME">Entrées</option>
                        <option value="EXPENSE">Sorties</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-max text-xs sm:text-sm">
                    <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]">
                        <SortHeader active={sortKey === 'occurredAt'} direction={sortDirection} label="Date" onSort={toggleSort} sortKey="occurredAt" />
                        <SortHeader active={sortKey === 'type'} direction={sortDirection} label="Type" onSort={toggleSort} sortKey="type" />
                        <SortHeader active={sortKey === 'description'} direction={sortDirection} label="Description" onSort={toggleSort} sortKey="description" />
                        <SortHeader active={sortKey === 'linked'} direction={sortDirection} label="Concerne" onSort={toggleSort} sortKey="linked" />
                        <SortHeader active={sortKey === 'feePeriod'} direction={sortDirection} label="Période" onSort={toggleSort} sortKey="feePeriod" />
                        <SortHeader active={sortKey === 'amount'} align="right" direction={sortDirection} label="Montant" onSort={toggleSort} sortKey="amount" />
                        <SortHeader active={sortKey === 'status'} direction={sortDirection} label="Statut" onSort={toggleSort} sortKey="status" />
                    </tr></thead>
                    <tbody>
                        {sorted.map((item) => <tr className={`border-b border-[#edf4ec] ${item.cancelled ? 'opacity-50' : ''}`} key={item.id}>
                            <td className="py-2 pr-4">{new Date(item.occurredAt).toLocaleDateString('fr-FR')}</td>
                            <td className="py-2 pr-4">{item.type === 'EXPENSE' ? 'Sortie' : 'Entrée'}</td>
                            <td className={`py-2 pr-4 ${item.cancelled ? 'line-through' : ''}`}>{item.description}</td>
                            <td className="py-2 pr-4 text-[#6a8d72]">{item.linkedName ?? '—'}{item.className ? <span> · {item.className}</span> : ''}</td>
                            <td className="py-2 pr-4 text-[#6a8d72]">{item.feePeriod ?? '—'}</td>
                            <td className={`py-2 pr-4 text-right font-medium ${item.type === 'EXPENSE' ? 'text-[#a65d36]' : 'text-[#356743]'}`}>{item.type === 'EXPENSE' ? '-' : '+'}{item.amount} DH</td>
                            <td className="py-2 pr-4">{item.cancelled ? <StatusBadge colorClass="bg-[#f4e6e1] text-[#a3372f]" label="Annulé" /> : <StatusBadge colorClass="bg-[#e5f1e5] text-[#356743]" label="Actif" />}</td>
                        </tr>)}
                    </tbody>
                </table>
                {filtered.length === 0 && <p className="py-4 text-[#557064]">{cash.length === 0 ? 'Aucun mouvement enregistré.' : 'Aucun mouvement ne correspond à ce filtre.'}</p>}
            </div>
        </Panel>
    </Shell>;
};
