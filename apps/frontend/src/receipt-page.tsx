import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PaymentDetail, PayslipDetail, Settings } from './types';
import { apiUrl } from './api-url';
import { formatCurrency } from './currency';

const methodLabels: Record<string, string> = { CASH: 'Espèces', TRANSFER: 'Virement', CHECK: 'Chèque', CARD: 'Carte', OTHER: 'Autre' };
const employeeTypeLabels: Record<string, string> = { TEACHER: 'Professeur', DIRECTOR: 'Directrice', ASSISTANT: 'Assistant', ADMINISTRATION: 'Administration', OTHER: 'Autre' };
const frenchMonthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const monthLabel = (value: string) => {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) return value;
    return `${frenchMonthNames[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
};
const sanitizeFileName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-');

const ReceiptCard = ({ payment, settings }: { payment: PaymentDetail; settings: Settings }) => {
    const currency = settings['school.currencyCode'] || 'MAD';
    const schoolClass = payment.student.enrollments[0]?.schoolClass.name ?? 'Non inscrit';

    return <div className="rounded-2xl border border-[#d6e1d5] p-8">
        {payment.cancelledAt && <div className="mb-6 rounded-lg border border-[#a3372f] bg-[#f4e6e1] p-4"><p className="font-semibold text-[#a3372f]">REÇU ANNULÉ</p><p className="text-sm text-[#a3372f]">Le {new Date(payment.cancelledAt).toLocaleString('fr-FR')}{payment.cancelledBy ? ` par ${payment.cancelledBy.firstName} ${payment.cancelledBy.lastName}` : ''}{payment.cancelReason ? ` — ${payment.cancelReason}` : ''}</p></div>}
        <div className="flex items-start justify-between border-b border-[#d6e1d5] pb-6">
            <div>
                <h1 className="text-2xl font-semibold">{settings['school.name']}</h1>
                {settings['school.address'] && <p className="text-sm text-[#557064]">{settings['school.address']}</p>}
                {settings['school.phone'] && <p className="text-sm text-[#557064]">{settings['school.phone']}</p>}
            </div>
            <div className="text-right">
                <p className="text-sm uppercase tracking-[0.2em] text-[#6a8d72]">Reçu</p>
                <p className="text-xl font-semibold">{payment.receiptNumber}</p>
                <p className="text-sm text-[#557064]">{new Date(payment.paidAt).toLocaleString('fr-FR')}</p>
            </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
                <p className="text-sm text-[#6a8d72]">Élève</p>
                <p className="font-medium">{payment.student.firstName} {payment.student.lastName} · {payment.student.matricule}</p>
                <p className="text-sm text-[#557064]">{schoolClass}</p>
            </div>
            <div>
                <p className="text-sm text-[#6a8d72]">Responsable</p>
                <p className="font-medium">{payment.guardian ? `${payment.guardian.firstName} ${payment.guardian.lastName}` : '—'}</p>
                <p className="text-sm text-[#557064]">{payment.guardian?.primaryPhone ?? ''}</p>
            </div>
        </div>

        <table className="mt-6 w-full text-sm">
            <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]"><th className="py-2">Description</th><th className="py-2">Période</th><th className="py-2 text-right">Montant</th></tr></thead>
            <tbody>{payment.allocations.map((allocation, index) => <tr className="border-b border-[#edf4ec]" key={index}><td className="py-2">{allocation.studentFee.feeType.name}</td><td className="py-2">{allocation.studentFee.period}</td><td className="py-2 text-right">{formatCurrency(allocation.amount, currency)}</td></tr>)}</tbody>
        </table>

        {payment.comment && <p className="mt-4 text-sm text-[#557064]">{payment.comment}</p>}

        <div className="mt-6 flex items-end justify-between border-t border-[#d6e1d5] pt-6">
            <div>
                <p className="text-sm text-[#6a8d72]">Mode de paiement</p>
                <p className="font-medium">{methodLabels[payment.method] ?? payment.method}</p>
            </div>
            <div>
                <p className="text-sm text-[#6a8d72]">Encaissé par</p>
                <p className="font-medium">{payment.recordedBy.firstName} {payment.recordedBy.lastName}</p>
            </div>
            <div className="text-right">
                <p className="text-sm text-[#6a8d72]">Total</p>
                <p className="text-2xl font-semibold">{formatCurrency(payment.amount, currency)}</p>
            </div>
        </div>
    </div>;
};

export const ReceiptPage = () => {
    const { paymentId } = useParams();
    const [payment, setPayment] = useState<PaymentDetail | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const [paymentResponse, settingsResponse] = await Promise.all([
                    fetch(`${apiUrl}/api/payments/${paymentId}`, { credentials: 'include' }),
                    fetch(`${apiUrl}/api/settings`, { credentials: 'include' })
                ]);
                if (paymentResponse.ok) setPayment((await paymentResponse.json()).payment);
                else setError((await paymentResponse.json()).error ?? 'Reçu introuvable.');
                if (settingsResponse.ok) setSettings((await settingsResponse.json()).settings);
            } catch {
                setError('Impossible de charger le reçu — vérifiez votre connexion et réessayez.');
            }
        })();
    }, [paymentId]);

    useEffect(() => {
        if (!payment) return;
        const period = payment.allocations.map((allocation) => allocation.studentFee.period).join('-');
        document.title = sanitizeFileName(`Reçu ${payment.student.firstName} ${payment.student.lastName}${period ? ` - ${period}` : ''}`);
        return () => { document.title = 'SchoolDesk'; };
    }, [payment]);

    if (error) return <main className="p-10 text-[#18352b]"><p>{error}</p><Link className="text-[#356743] underline" to="/payments">Retour aux paiements</Link></main>;
    if (!payment || !settings) return <main className="p-10 text-[#18352b]">Chargement du reçu…</main>;

    return <main className="mx-auto max-w-2xl p-10 text-[#18352b]">
        <div className="no-print mb-6 flex justify-between">
            <Link className="rounded-lg border border-[#356743] px-4 py-2 text-sm text-[#356743]" to="/payments">← Retour</Link>
            <button className="rounded-lg bg-[#356743] px-4 py-2 text-sm text-white" onClick={() => window.print()} type="button">Imprimer / PDF</button>
        </div>
        <ReceiptCard payment={payment} settings={settings} />
    </main>;
};

export const FeeReceiptsPage = () => {
    const { studentFeeId } = useParams();
    const [fee, setFee] = useState<{ period: string; feeType: { name: string }; student: { firstName: string; lastName: string } } | null>(null);
    const [payments, setPayments] = useState<PaymentDetail[] | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            const [feeResponse, settingsResponse] = await Promise.all([
                fetch(`${apiUrl}/api/student-fees/${studentFeeId}/payments`, { credentials: 'include' }),
                fetch(`${apiUrl}/api/settings`, { credentials: 'include' })
            ]);
            if (feeResponse.ok) { const data = await feeResponse.json(); setFee(data.fee); setPayments(data.payments); }
            else setError((await feeResponse.json()).error ?? 'Frais introuvable.');
            if (settingsResponse.ok) setSettings((await settingsResponse.json()).settings);
        })();
    }, [studentFeeId]);

    useEffect(() => {
        if (!fee) return;
        document.title = sanitizeFileName(`Reçus ${fee.student.firstName} ${fee.student.lastName} - ${fee.feeType.name} ${fee.period}`);
        return () => { document.title = 'SchoolDesk'; };
    }, [fee]);

    if (error) return <main className="p-10 text-[#18352b]"><p>{error}</p><Link className="text-[#356743] underline" to="/payments">Retour aux paiements</Link></main>;
    if (!fee || !payments || !settings) return <main className="p-10 text-[#18352b]">Chargement des reçus…</main>;

    return <main className="mx-auto max-w-2xl p-10 text-[#18352b]">
        <div className="no-print mb-6 flex items-center justify-between">
            <Link className="rounded-lg border border-[#356743] px-4 py-2 text-sm text-[#356743]" to="/payments">← Retour</Link>
            <p className="text-sm text-[#6a8d72]">{fee.student.firstName} {fee.student.lastName} · {fee.feeType.name} · {fee.period} — {payments.length} reçu(s)</p>
            <button className="rounded-lg bg-[#356743] px-4 py-2 text-sm text-white" onClick={() => window.print()} type="button">Imprimer / PDF</button>
        </div>
        {payments.length === 0 && <p className="text-[#557064]">Aucun reçu enregistré pour ce frais.</p>}
        <div className="space-y-8">
            {payments.map((payment) => <div className="break-after-page last:break-after-auto" key={payment.id}><ReceiptCard payment={payment} settings={settings} /></div>)}
        </div>
    </main>;
};

const PayslipCard = ({ payment, settings }: { payment: PayslipDetail; settings: Settings }) => {
    const currency = settings['school.currencyCode'] || 'MAD';
    const { payroll } = payment;

    return <div className="rounded-2xl border border-[#d6e1d5] p-8">
        {payment.cancelledAt && <div className="mb-6 rounded-lg border border-[#a3372f] bg-[#f4e6e1] p-4"><p className="font-semibold text-[#a3372f]">BULLETIN ANNULÉ</p><p className="text-sm text-[#a3372f]">Le {new Date(payment.cancelledAt).toLocaleString('fr-FR')}{payment.cancelledBy ? ` par ${payment.cancelledBy.firstName} ${payment.cancelledBy.lastName}` : ''}{payment.cancelReason ? ` — ${payment.cancelReason}` : ''}</p></div>}
        <div className="flex items-start justify-between border-b border-[#d6e1d5] pb-6">
            <div>
                <h1 className="text-2xl font-semibold">{settings['school.name']}</h1>
                {settings['school.address'] && <p className="text-sm text-[#557064]">{settings['school.address']}</p>}
                {settings['school.phone'] && <p className="text-sm text-[#557064]">{settings['school.phone']}</p>}
            </div>
            <div className="text-right">
                <p className="text-sm uppercase tracking-[0.2em] text-[#6a8d72]">Bulletin de paiement</p>
                <p className="text-xl font-semibold">{payment.receiptNumber}</p>
                <p className="text-sm text-[#557064]">{new Date(payment.paidAt).toLocaleString('fr-FR')}</p>
            </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
                <p className="text-sm text-[#6a8d72]">Employé</p>
                <p className="font-medium">{payroll.employee.firstName} {payroll.employee.lastName} · {payroll.employee.matricule}</p>
                <p className="text-sm text-[#557064]">{employeeTypeLabels[payroll.employee.type] ?? payroll.employee.type}</p>
                <p className="text-sm text-[#557064]">{[...new Set([...payroll.employee.teacherClasses, ...payroll.employee.assistantClasses].map((schoolClass) => schoolClass.name))].join(', ') || 'Aucune classe assignée'}</p>
            </div>
            <div>
                <p className="text-sm text-[#6a8d72]">Mois</p>
                <p className="font-medium">{monthLabel(payroll.month)}</p>
            </div>
        </div>

        <table className="mt-6 w-full text-sm">
            <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]"><th className="py-2">Élément</th><th className="py-2 text-right">Montant</th></tr></thead>
            <tbody>
                <tr className="border-b border-[#edf4ec]"><td className="py-2">Salaire de base</td><td className="py-2 text-right">{formatCurrency(payroll.baseSalary, currency)}</td></tr>
                {Number(payroll.bonuses) > 0 && <tr className="border-b border-[#edf4ec]"><td className="py-2">Primes</td><td className="py-2 text-right">+{formatCurrency(payroll.bonuses, currency)}</td></tr>}
                {Number(payroll.advances) > 0 && <tr className="border-b border-[#edf4ec]"><td className="py-2">Avances déduites</td><td className="py-2 text-right">-{formatCurrency(payroll.advances, currency)}</td></tr>}
                {Number(payroll.deductions) > 0 && <tr className="border-b border-[#edf4ec]"><td className="py-2">Retenues</td><td className="py-2 text-right">-{formatCurrency(payroll.deductions, currency)}</td></tr>}
                <tr className="font-semibold"><td className="py-2">Salaire net</td><td className="py-2 text-right">{formatCurrency(payroll.netSalary, currency)}</td></tr>
            </tbody>
        </table>

        <div className="mt-6 flex items-end justify-between border-t border-[#d6e1d5] pt-6">
            <div>
                <p className="text-sm text-[#6a8d72]">Mode de paiement</p>
                <p className="font-medium">{methodLabels[payment.method] ?? payment.method}</p>
            </div>
            <div>
                <p className="text-sm text-[#6a8d72]">Versé par</p>
                <p className="font-medium">{payment.recordedBy.firstName} {payment.recordedBy.lastName}</p>
            </div>
            <div className="text-right">
                <p className="text-sm text-[#6a8d72]">Montant versé</p>
                <p className="text-2xl font-semibold">{formatCurrency(payment.amount, currency)}</p>
            </div>
        </div>
    </div>;
};

export const PayslipPage = () => {
    const { paymentId } = useParams();
    const [payment, setPayment] = useState<PayslipDetail | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            const [paymentResponse, settingsResponse] = await Promise.all([
                fetch(`${apiUrl}/api/payroll-payments/${paymentId}`, { credentials: 'include' }),
                fetch(`${apiUrl}/api/settings`, { credentials: 'include' })
            ]);
            if (paymentResponse.ok) setPayment((await paymentResponse.json()).payment);
            else setError((await paymentResponse.json()).error ?? 'Bulletin introuvable.');
            if (settingsResponse.ok) setSettings((await settingsResponse.json()).settings);
        })();
    }, [paymentId]);

    useEffect(() => {
        if (!payment) return;
        document.title = sanitizeFileName(`Bulletin ${payment.payroll.employee.firstName} ${payment.payroll.employee.lastName} - ${monthLabel(payment.payroll.month)}`);
        return () => { document.title = 'SchoolDesk'; };
    }, [payment]);

    if (error) return <main className="p-10 text-[#18352b]"><p>{error}</p><Link className="text-[#356743] underline" to="/payroll">Retour aux salaires</Link></main>;
    if (!payment || !settings) return <main className="p-10 text-[#18352b]">Chargement du bulletin…</main>;

    return <main className="mx-auto max-w-2xl p-10 text-[#18352b]">
        <div className="no-print mb-6 flex justify-between">
            <Link className="rounded-lg border border-[#356743] px-4 py-2 text-sm text-[#356743]" to="/payroll">← Retour</Link>
            <button className="rounded-lg bg-[#356743] px-4 py-2 text-sm text-white" onClick={() => window.print()} type="button">Imprimer / PDF</button>
        </div>
        <PayslipCard payment={payment} settings={settings} />
    </main>;
};
