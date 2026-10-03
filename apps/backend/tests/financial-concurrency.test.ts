// Chantier A1 — intégrité des encaissements (POST /payments) et des versements de salaire
// (POST /payrolls/:id/pay) face aux requêtes simultanées. Tourne uniquement sur la base jetable
// de tests/docker-compose.test.yml (voir le garde-fou de helpers.ts).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { financialState, prisma, seedSchool, startServer } from './helpers.js';

const CONCURRENCY = 10;
const year = new Date().getUTCFullYear();
const receipt = (prefix: string, value: number) => `${prefix}-${year}-${String(value).padStart(5, '0')}`;
const statuses = (results: { status: number }[]) => results.map((result) => result.status);
const countOf = (values: number[], wanted: number) => values.filter((value) => value === wanted).length;

let server: Awaited<ReturnType<typeof startServer>>;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); await prisma.$disconnect(); });

/** Vérifie la cohérence paiements ↔ allocations ↔ caisse ↔ numérotation pour une école. */
const assertPaymentsConsistent = async (schoolId: string) => {
    const state = await financialState(schoolId);
    const active = state.payments.filter((payment) => !payment.cancelledAt);
    // Une allocation par paiement (tous les paiements de ces tests ont au moins une allocation) et des montants qui se recoupent.
    for (const payment of state.payments) {
        const allocations = state.allocations.filter((allocation) => allocation.paymentId === payment.id);
        assert.ok(allocations.length > 0, `paiement ${payment.receiptNumber} sans allocation`);
        assert.equal(state.sum(allocations), payment.amount.toNumber(), `allocations ≠ montant pour ${payment.receiptNumber}`);
    }
    // Exactement un mouvement de caisse par paiement, du même montant.
    const cash = state.cashFor('PAYMENT');
    assert.equal(cash.length, state.payments.length, 'un mouvement de caisse par paiement');
    for (const payment of state.payments) {
        const entry = cash.find((row) => row.sourceId === payment.id);
        assert.ok(entry, `mouvement de caisse manquant pour ${payment.receiptNumber}`);
        assert.equal(entry.type, 'INCOME');
        assert.equal(entry.amount.toNumber(), payment.amount.toNumber());
    }
    // Numéros de reçus uniques, consécutifs et sans trou ; compteur aligné (un refus ne consomme aucun numéro).
    assert.deepEqual(state.payments.map((payment) => payment.receiptNumber), state.payments.map((_, index) => receipt('PAY', index + 1)));
    assert.equal(state.sequence('PAY'), state.payments.length);
    // Aucun frais payé au-delà de son montant, statut cohérent avec le payé réel.
    for (const fee of state.fees) {
        const paid = state.paidOnFee(fee.id);
        assert.ok(paid <= fee.finalAmount.toNumber(), `frais ${fee.period} : payé ${paid} > dû ${fee.finalAmount}`);
        const expected = paid >= fee.finalAmount.toNumber() ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
        if (state.allocations.some((allocation) => allocation.studentFeeId === fee.id)) assert.equal(fee.status, expected, `statut du frais ${fee.period}`);
    }
    return { state, active };
};

describe('POST /payments — paiements élèves', () => {
    test('TEST 1 — un paiement normal (partiel puis solde) est accepté : reçu, allocation, caisse, statut', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const fee = await ctx.createFee('Septembre 2026', 1000);

        const first = await ctx.post('/api/payments', { studentId: ctx.student.id, amount: 400, method: 'CASH', allocations: [{ studentFeeId: fee.id, amount: 400 }] });
        assert.equal(first.status, 201, JSON.stringify(first.body));
        assert.equal(first.body.payment.receiptNumber, receipt('PAY', 1));
        assert.equal((await prisma.studentFee.findUniqueOrThrow({ where: { id: fee.id } })).status, 'PARTIALLY_PAID');

        const receiptPage = await ctx.get(`/api/payments/${first.body.payment.id}`);
        assert.equal(receiptPage.status, 200);
        assert.equal(receiptPage.body.payment.allocations[0].studentFeeId, fee.id);

        const second = await ctx.post('/api/payments', { studentId: ctx.student.id, amount: 600, method: 'TRANSFER', allocations: [{ studentFeeId: fee.id, amount: 600 }] });
        assert.equal(second.status, 201, JSON.stringify(second.body));
        assert.equal(second.body.payment.receiptNumber, receipt('PAY', 2));
        assert.equal((await prisma.studentFee.findUniqueOrThrow({ where: { id: fee.id } })).status, 'PAID');

        const { state } = await assertPaymentsConsistent(ctx.school.id);
        assert.equal(state.paidOnFee(fee.id), 1000);
    });

    test('TEST 1b — chemin du formulaire (frais créé automatiquement depuis la fiche élève)', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const result = await ctx.post('/api/payments', { studentId: ctx.student.id, academicYearId: ctx.academicYear.id, feeTypeId: ctx.feeType.id, period: 'Octobre 2026', amount: 250, method: 'CASH' });
        assert.equal(result.status, 201, JSON.stringify(result.body));
        const fees = await prisma.studentFee.findMany({ where: { schoolId: ctx.school.id } });
        assert.equal(fees.length, 1);
        assert.equal(fees[0].finalAmount.toNumber(), 1000, 'montant dû repris de la mensualité de l’élève');
        assert.equal(fees[0].status, 'PARTIALLY_PAID');
        await assertPaymentsConsistent(ctx.school.id);
    });

    test('TEST 2 — un paiement dépassant le reste dû est refusé', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const fee = await ctx.createFee('Septembre 2026', 1000);
        assert.equal((await ctx.post('/api/payments', { studentId: ctx.student.id, amount: 400, method: 'CASH', allocations: [{ studentFeeId: fee.id, amount: 400 }] })).status, 201);

        const refused = await ctx.post('/api/payments', { studentId: ctx.student.id, amount: 700, method: 'CASH', allocations: [{ studentFeeId: fee.id, amount: 700 }] });
        assert.equal(refused.status, 400);
        assert.equal(refused.body.error, 'Allocation supérieure au reste dû.');

        const { state } = await assertPaymentsConsistent(ctx.school.id);
        assert.equal(state.payments.length, 1);
        assert.equal(state.paidOnFee(fee.id), 400);
        assert.equal(state.sequence('PAY'), 1, 'aucun numéro de reçu consommé par le refus');
    });

    test(`TEST 3 — ${CONCURRENCY} paiements simultanés sur le même frais ne dépassent jamais le montant dû`, async () => {
        const ctx = await seedSchool(server.baseUrl);
        const fee = await ctx.createFee('Septembre 2026', 1000);
        // 10 × 400 en parallèle sur un dû de 1000 : seuls 2 peuvent passer (800), le 3e dépasserait (1200).
        const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => ctx.post('/api/payments', { studentId: ctx.student.id, amount: 400, method: 'CASH', allocations: [{ studentFeeId: fee.id, amount: 400 }] })));
        const codes = statuses(results);
        assert.equal(countOf(codes, 201), 2, `codes reçus : ${codes.join(',')}`);
        assert.equal(countOf(codes, 400), CONCURRENCY - 2, `codes reçus : ${codes.join(',')}`);
        for (const refused of results.filter((result) => result.status === 400)) assert.equal(refused.body.error, 'Allocation supérieure au reste dû.');

        const fullFee = await ctx.createFee('Octobre 2026', 1000);
        // 10 × 1000 en parallèle : un seul doit passer.
        const fullResults = await Promise.all(Array.from({ length: CONCURRENCY }, () => ctx.post('/api/payments', { studentId: ctx.student.id, amount: 1000, method: 'CASH', allocations: [{ studentFeeId: fullFee.id, amount: 1000 }] })));
        assert.equal(countOf(statuses(fullResults), 201), 1, `codes reçus : ${statuses(fullResults).join(',')}`);

        const state = await financialState(ctx.school.id);
        assert.equal(state.paidOnFee(fee.id), 800);
        assert.equal(state.paidOnFee(fullFee.id), 1000);
    });

    test('TEST 4 — après la concurrence : allocations, paiements, caisse et numérotation cohérents', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const fee = await ctx.createFee('Septembre 2026', 1000);
        const amounts = [300, 300, 300, 300, 250, 250, 200, 150, 100, 100];
        const results = await Promise.all(amounts.map((amount) => ctx.post('/api/payments', { studentId: ctx.student.id, amount, method: 'CASH', allocations: [{ studentFeeId: fee.id, amount }] })));
        const accepted = results.filter((result) => result.status === 201);
        assert.ok(accepted.length >= 1);
        assert.ok(results.every((result) => result.status === 201 || result.status === 400), `codes reçus : ${statuses(results).join(',')}`);

        const { state } = await assertPaymentsConsistent(ctx.school.id);
        const acceptedTotal = accepted.reduce((total, result) => total + Number(result.body.payment.amount), 0);
        assert.equal(state.payments.length, accepted.length);
        assert.equal(state.paidOnFee(fee.id), acceptedTotal);
        assert.equal(state.sum(state.cashFor('PAYMENT')), acceptedTotal);
        assert.ok(acceptedTotal <= 1000);

        const cash = await ctx.get('/api/cash');
        assert.equal(cash.status, 200);
        assert.equal(Number(cash.body.totals.income), acceptedTotal, 'solde de caisse = somme des paiements acceptés');
    });

    test('TEST 4b — encaissements simultanés via le formulaire (frais pas encore créé) : un seul frais, aucun dépassement', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => ctx.post('/api/payments', { studentId: ctx.student.id, academicYearId: ctx.academicYear.id, feeTypeId: ctx.feeType.id, period: 'Novembre 2026', amount: 600, method: 'CASH' })));
        const codes = statuses(results);
        assert.equal(countOf(codes, 201), 1, `codes reçus : ${codes.join(',')}`);
        assert.equal(countOf(codes, 400), CONCURRENCY - 1, `codes reçus : ${codes.join(',')}`);
        const fees = await prisma.studentFee.findMany({ where: { schoolId: ctx.school.id } });
        assert.equal(fees.length, 1, 'un seul frais créé pour la période');
        const { state } = await assertPaymentsConsistent(ctx.school.id);
        assert.equal(state.paidOnFee(fees[0].id), 600);
    });

    test('TEST 4c — paiements multi-allocations simultanés en ordres croisés : pas d’interblocage, totaux exacts', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const [feeA, feeB] = [await ctx.createFee('Septembre 2026', 1000), await ctx.createFee('Octobre 2026', 1000)];
        // 10 paiements de 100+100 en ordre A,B puis B,A alternés : tous tiennent dans le dû (1000 chacun) et doivent passer.
        const results = await Promise.all(Array.from({ length: CONCURRENCY }, (_, index) => {
            const allocations = index % 2 === 0 ? [{ studentFeeId: feeA.id, amount: 100 }, { studentFeeId: feeB.id, amount: 100 }] : [{ studentFeeId: feeB.id, amount: 100 }, { studentFeeId: feeA.id, amount: 100 }];
            return ctx.post('/api/payments', { studentId: ctx.student.id, amount: 200, method: 'CASH', allocations });
        }));
        assert.deepEqual(statuses(results), Array(CONCURRENCY).fill(201), JSON.stringify(results.filter((result) => result.status !== 201).map((result) => result.body)));
        const { state } = await assertPaymentsConsistent(ctx.school.id);
        assert.equal(state.paidOnFee(feeA.id), 1000);
        assert.equal(state.paidOnFee(feeB.id), 1000);
        // Les deux frais sont soldés : tout paiement supplémentaire doit être refusé.
        const extra = await ctx.post('/api/payments', { studentId: ctx.student.id, amount: 0.01, method: 'CASH', allocations: [{ studentFeeId: feeA.id, amount: 0.01 }] });
        assert.equal(extra.status, 400);
    });

    test('TEST 6a — un refus ne laisse aucune écriture partielle (paiement multi-frais dont une allocation dépasse)', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const [feeA, feeB] = [await ctx.createFee('Septembre 2026', 1000), await ctx.createFee('Octobre 2026', 1000)];
        const refused = await ctx.post('/api/payments', { studentId: ctx.student.id, amount: 2000, method: 'CASH', allocations: [{ studentFeeId: feeA.id, amount: 500 }, { studentFeeId: feeB.id, amount: 1500 }] });
        assert.equal(refused.status, 400);
        const state = await financialState(ctx.school.id);
        assert.equal(state.payments.length, 0, 'aucun paiement');
        assert.equal(state.allocations.length, 0, 'aucune allocation');
        assert.equal(state.cash.length, 0, 'aucune écriture de caisse');
        assert.equal(state.sequence('PAY'), 0, 'aucun numéro de reçu consommé');
        assert.deepEqual(state.fees.map((fee) => fee.status).sort(), ['UNPAID', 'UNPAID'], 'statuts des frais inchangés');

        // Un même frais alloué deux fois dans un paiement (chaque part ≤ reste dû, mais total > reste dû) : refusé avant toute écriture.
        const duplicated = await ctx.post('/api/payments', { studentId: ctx.student.id, amount: 1200, method: 'CASH', allocations: [{ studentFeeId: feeA.id, amount: 600 }, { studentFeeId: feeA.id, amount: 600 }] });
        assert.equal(duplicated.status, 400);
        const after = await financialState(ctx.school.id);
        assert.equal(after.payments.length + after.allocations.length + after.cash.length, 0);
    });

    test('Non-régression — annulation d’un paiement : statut recalculé, caisse exclue, reste dû libéré', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const fee = await ctx.createFee('Septembre 2026', 1000);
        const paid = await ctx.post('/api/payments', { studentId: ctx.student.id, amount: 1000, method: 'CASH', allocations: [{ studentFeeId: fee.id, amount: 1000 }] });
        assert.equal(paid.status, 201);
        const cancelled = await ctx.post(`/api/payments/${paid.body.payment.id}/cancel`, { reason: 'Erreur de saisie' });
        assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
        assert.equal((await prisma.studentFee.findUniqueOrThrow({ where: { id: fee.id } })).status, 'UNPAID');
        assert.equal(Number((await ctx.get('/api/cash')).body.totals.income), 0);
        assert.equal((await ctx.post(`/api/payments/${paid.body.payment.id}/cancel`, { reason: 'Encore' })).status, 400, 'double annulation refusée');

        const again = await ctx.post('/api/payments', { studentId: ctx.student.id, amount: 1000, method: 'CASH', allocations: [{ studentFeeId: fee.id, amount: 1000 }] });
        assert.equal(again.status, 201, JSON.stringify(again.body));
        assert.equal(again.body.payment.receiptNumber, receipt('PAY', 2), 'le numéro du paiement annulé n’est jamais réattribué');
        assert.equal(Number((await ctx.get('/api/cash')).body.totals.income), 1000);
    });
});

describe('POST /payrolls/:id/pay — versements de salaire', () => {
    test(`TEST 5 — ${CONCURRENCY} versements simultanés ne dépassent jamais le salaire net`, async () => {
        const ctx = await seedSchool(server.baseUrl);
        const payroll = await ctx.createPayroll('2026-09', 3000);
        // 10 × 1000 sur un net de 3000 : exactement 3 versements possibles.
        const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => ctx.post(`/api/payrolls/${payroll.id}/pay`, { amount: 1000, method: 'CASH' })));
        const codes = statuses(results);
        assert.equal(countOf(codes, 201), 3, `codes reçus : ${codes.join(',')}`);
        assert.equal(countOf(codes, 400), CONCURRENCY - 3, `codes reçus : ${codes.join(',')}`);
        for (const refused of results.filter((result) => result.status === 400)) assert.equal(refused.body.error, 'Le paiement dépasse le salaire net.');

        const state = await financialState(ctx.school.id);
        const current = state.payrolls.find((row) => row.id === payroll.id)!;
        assert.equal(current.amountPaid.toNumber(), 3000);
        assert.equal(current.status, 'PAID');
        assert.equal(state.payrollPayments.length, 3);
        assert.equal(state.sum(state.payrollPayments), 3000, 'total versé = net, jamais plus');
        assert.deepEqual(state.payrollPayments.map((row) => row.receiptNumber), [1, 2, 3].map((value) => receipt('BUL', value)));
        assert.equal(state.sequence('BUL'), 3);
        const cash = state.cashFor('PAYROLL_PAYMENT');
        assert.equal(cash.length, 3);
        assert.equal(state.sum(cash), 3000);
        assert.ok(cash.every((row) => row.type === 'EXPENSE' && state.payrollPayments.some((paymentRow) => paymentRow.id === row.sourceId)));
    });

    test('TEST 6b — un versement de salaire refusé ne laisse aucune écriture', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const payroll = await ctx.createPayroll('2026-09', 1000);
        const refused = await ctx.post(`/api/payrolls/${payroll.id}/pay`, { amount: 1500, method: 'CASH' });
        assert.equal(refused.status, 400);
        assert.equal(refused.body.error, 'Le paiement dépasse le salaire net.');
        const state = await financialState(ctx.school.id);
        assert.equal(state.payrollPayments.length, 0);
        assert.equal(state.cash.length, 0);
        assert.equal(state.sequence('BUL'), 0, 'aucun numéro de bulletin consommé');
        assert.equal(state.payrolls[0].amountPaid.toNumber(), 0);
        assert.equal(state.payrolls[0].status, 'TO_PAY');
    });

    test('Non-régression — versement partiel, bulletin, annulation puis nouveau versement', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const payroll = await ctx.createPayroll('2026-09', 1000);
        const partial = await ctx.post(`/api/payrolls/${payroll.id}/pay`, { amount: 400, method: 'CASH' });
        assert.equal(partial.status, 201, JSON.stringify(partial.body));
        assert.equal(partial.body.payroll.status, 'PARTIALLY_PAID');
        const rest = await ctx.post(`/api/payrolls/${payroll.id}/pay`, { amount: 600, method: 'TRANSFER' });
        assert.equal(rest.status, 201);
        assert.equal(rest.body.payroll.status, 'PAID');

        const payments = await prisma.payrollPayment.findMany({ where: { payrollId: payroll.id }, orderBy: { receiptNumber: 'asc' } });
        const payslip = await ctx.get(`/api/payroll-payments/${payments[0].id}`);
        assert.equal(payslip.status, 200);
        assert.equal(payslip.body.payment.receiptNumber, receipt('BUL', 1));

        const cancelled = await ctx.post(`/api/payroll-payments/${payments[1].id}/cancel`, { reason: 'Erreur' });
        assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
        assert.equal(Number(cancelled.body.payroll.amountPaid), 400);
        assert.equal(cancelled.body.payroll.status, 'PARTIALLY_PAID');

        assert.equal((await ctx.post(`/api/payrolls/${payroll.id}/pay`, { amount: 700, method: 'CASH' })).status, 400, 'reste dû = 600 après annulation');
        const again = await ctx.post(`/api/payrolls/${payroll.id}/pay`, { amount: 600, method: 'CASH' });
        assert.equal(again.status, 201);
        assert.equal(again.body.payroll.status, 'PAID');
        const cash = await ctx.get('/api/cash');
        assert.equal(Number(cash.body.totals.expenses), 1000, 'versement annulé exclu de la caisse');
    });
});

describe('PATCH /payrolls/:id — modification d’un salaire', () => {
    const PATCH_ITERATIONS = 25;
    const editBody = (month: string, baseSalary: number) => ({ month, baseSalary, bonuses: 0, advances: 0, deductions: 0 });

    test('PATCH 1 — modification normale d’un salaire sans versement', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const payroll = await ctx.createPayroll('2026-09', 3000);
        const result = await ctx.patch(`/api/payrolls/${payroll.id}`, { month: '2026-09', baseSalary: 2500, bonuses: 300, advances: 100, deductions: 50 });
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(Number(result.body.payroll.netSalary), 2650);
        const stored = await prisma.payroll.findUniqueOrThrow({ where: { id: payroll.id } });
        assert.equal(stored.netSalary.toNumber(), 2650);
        assert.equal(stored.baseSalary.toNumber(), 2500);
        // Salaire inexistant → 404 (inchangé).
        assert.equal((await ctx.patch('/api/payrolls/00000000-0000-0000-0000-000000000000', editBody('2026-09', 1000))).status, 404);
    });

    test('PATCH 2 — modification refusée dès qu’un versement existe (non annulé, et aussi annulé : règle existante)', async () => {
        const ctx = await seedSchool(server.baseUrl);
        const payroll = await ctx.createPayroll('2026-09', 3000);
        const paid = await ctx.post(`/api/payrolls/${payroll.id}/pay`, { amount: 1000, method: 'CASH' });
        assert.equal(paid.status, 201);
        const refused = await ctx.patch(`/api/payrolls/${payroll.id}`, editBody('2026-09', 500));
        assert.equal(refused.status, 400);
        assert.equal(refused.body.error, 'Modification impossible : ce salaire a déjà au moins un versement enregistré.');

        // Règle métier existante conservée telle quelle : même un versement annulé interdit la modification libre.
        const payment = await prisma.payrollPayment.findFirstOrThrow({ where: { payrollId: payroll.id } });
        assert.equal((await ctx.post(`/api/payroll-payments/${payment.id}/cancel`, { reason: 'Erreur' })).status, 200);
        assert.equal((await ctx.patch(`/api/payrolls/${payroll.id}`, editBody('2026-09', 500))).status, 400);

        const state = await financialState(ctx.school.id);
        assert.equal(state.payrolls[0].netSalary.toNumber(), 3000, 'net inchangé après refus');
        assert.equal(state.payrolls[0].amountPaid.toNumber(), 0);
        assert.equal(state.payrollPayments.length, 1);
        assert.equal(state.cashFor('PAYROLL_PAYMENT').length, 1);
        assert.equal(state.sequence('BUL'), 1);
    });

    test(`PATCH 3 — PATCH et versement simultanés (${PATCH_ITERATIONS} essais) : jamais amountPaid > netSalary`, async () => {
        const ctx = await seedSchool(server.baseUrl);
        const outcomes = { patchFirst: 0, payFirst: 0 };
        for (let iteration = 0; iteration < PATCH_ITERATIONS; iteration += 1) {
            // Mois distincts (contrainte unique employé/mois) : 2030-01, 2030-02, … 2032-01.
            const payrollMonth = `${2030 + Math.floor(iteration / 12)}-${String((iteration % 12) + 1).padStart(2, '0')}`;
            const payroll = await ctx.createPayroll(payrollMonth, 3000);
            // Net 3000 → PATCH le baisse à 1000 pendant qu'un versement de 2000 arrive.
            // Ordre d'envoi alterné pour exercer les deux entrelacements (PATCH d'abord / versement d'abord).
            const sendPatch = () => ctx.patch(`/api/payrolls/${payroll.id}`, editBody(payrollMonth, 1000));
            const sendPay = () => ctx.post(`/api/payrolls/${payroll.id}/pay`, { amount: 2000, method: 'CASH' });
            const [patched, paid] = iteration % 2 === 0
                ? await Promise.all([sendPatch(), sendPay()])
                : await Promise.all([sendPay(), sendPatch()]).then(([payResult, patchResult]) => [patchResult, payResult]);
            const stored = await prisma.payroll.findUniqueOrThrow({ where: { id: payroll.id }, include: { payments: true } });
            const paidTotal = stored.payments.filter((row) => !row.cancelledAt).reduce((total, row) => total + row.amount.toNumber(), 0);
            const label = `essai ${iteration} : PATCH ${patched.status}, versement ${paid.status}, net ${stored.netSalary}, versé ${paidTotal}`;
            assert.ok(paidTotal <= stored.netSalary.toNumber(), `INVARIANT VIOLÉ — ${label}`);
            assert.ok(stored.amountPaid.toNumber() <= stored.netSalary.toNumber(), `INVARIANT VIOLÉ (amountPaid) — ${label}`);
            assert.equal(stored.amountPaid.toNumber(), paidTotal, `amountPaid cohérent — ${label}`);
            // Seuls deux ordres sont possibles, et exactement une des deux requêtes l'emporte.
            if (patched.status === 200) {
                assert.equal(paid.status, 400, label);
                assert.equal(paid.body.error, 'Le paiement dépasse le salaire net.');
                assert.equal(stored.netSalary.toNumber(), 1000, label);
                assert.equal(stored.payments.length, 0, label);
                outcomes.patchFirst += 1;
            } else {
                assert.equal(patched.status, 400, label);
                assert.equal(paid.status, 201, label);
                assert.equal(stored.netSalary.toNumber(), 3000, label);
                assert.equal(stored.payments.length, 1, label);
                assert.equal(stored.status, 'PARTIALLY_PAID', label);
                outcomes.payFirst += 1;
            }
        }
        // Cohérence globale caisse / bulletins sur l'ensemble des essais.
        const state = await financialState(ctx.school.id);
        assert.equal(state.cashFor('PAYROLL_PAYMENT').length, state.payrollPayments.length);
        assert.equal(state.sum(state.cashFor('PAYROLL_PAYMENT')), state.sum(state.payrollPayments));
        assert.equal(state.sequence('BUL'), state.payrollPayments.length, 'aucun numéro BUL consommé par un refus');
        assert.deepEqual(state.payrollPayments.map((row) => row.receiptNumber), state.payrollPayments.map((_, index) => receipt('BUL', index + 1)));
        console.log(`PATCH 3 — ordres observés : PATCH d'abord ${outcomes.patchFirst}, versement d'abord ${outcomes.payFirst}`);
    });

    test('PATCH 4 — refus (PATCH ou versement) : Payroll, versements, caisse et numérotation cohérents', async () => {
        const ctx = await seedSchool(server.baseUrl);
        // Versement d'abord, puis PATCH refusé.
        const first = await ctx.createPayroll('2026-09', 3000);
        assert.equal((await ctx.post(`/api/payrolls/${first.id}/pay`, { amount: 2000, method: 'CASH' })).status, 201);
        assert.equal((await ctx.patch(`/api/payrolls/${first.id}`, editBody('2026-09', 1000))).status, 400);
        // PATCH d'abord, puis versement refusé car il dépasse le nouveau net.
        const second = await ctx.createPayroll('2026-10', 3000);
        assert.equal((await ctx.patch(`/api/payrolls/${second.id}`, editBody('2026-10', 1000))).status, 200);
        assert.equal((await ctx.post(`/api/payrolls/${second.id}/pay`, { amount: 2000, method: 'CASH' })).status, 400);

        const state = await financialState(ctx.school.id);
        const a = state.payrolls.find((row) => row.id === first.id)!;
        const b = state.payrolls.find((row) => row.id === second.id)!;
        assert.deepEqual([a.netSalary.toNumber(), a.amountPaid.toNumber(), a.status], [3000, 2000, 'PARTIALLY_PAID']);
        assert.deepEqual([b.netSalary.toNumber(), b.amountPaid.toNumber(), b.status], [1000, 0, 'TO_PAY']);
        assert.equal(state.payrollPayments.length, 1);
        assert.equal(state.payrollPayments[0].payrollId, first.id);
        assert.equal(state.cashFor('PAYROLL_PAYMENT').length, 1);
        assert.equal(state.sum(state.cashFor('PAYROLL_PAYMENT')), 2000);
        assert.equal(state.sequence('BUL'), 1, 'aucun numéro BUL consommé par les refus');
    });
});
