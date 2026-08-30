export type AcademicYear = {
    id: string;
    label: string;
    status: string;
    _count: { classes: number };
};

export type SchoolClass = {
    id: string;
    name: string;
    level: string;
    room: string | null;
    capacity: number;
    status: string;
    academicYearId: string;
    teacher: { id: string; firstName: string; lastName: string } | null;
    assistant: { id: string; firstName: string; lastName: string } | null;
    studentCount: number;
    boys: number;
    girls: number;
    fillRate: number;
};

export type Student = {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    sex: string;
    address: string | null;
    monthlyFee: string | null;
    insuranceFee: string | null;
    status: string;
    enrollments: { schoolClass: { id: string; name: string } }[];
    guardians: { relationship: string; guardian: { firstName: string; lastName: string; primaryPhone: string; email: string | null } }[];
};

export type Employee = {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    type: string;
    qualification: string | null;
    hiredAt: string | null;
    baseSalary: string | null;
    contractType: string | null;
    status: string;
};

export type FinanceStudentFee = {
    id: string;
    period: string;
    finalAmount: string;
    paidAmount: string;
    remaining: string;
    status: string;
    feeType: { name: string };
    allocations: { amount: string }[];
};

export type Payment = {
    id: string;
    receiptNumber: string;
    paidAt: string;
    amount: string;
    method: string;
    cancelledAt: string | null;
    cancelReason: string | null;
    cancelledBy: { firstName: string; lastName: string } | null;
    allocations: { studentFeeId: string; amount: string; studentFee: { period: string; feeType: { name: string } } }[];
};

export type FinanceSummaryEntry = {
    studentId: string;
    totalDue: string;
    totalPaid: string;
    remaining: string;
    status: string;
};

export type UnpaidFee = {
    id: string;
    student: { id: string; firstName: string; lastName: string; matricule: string };
    schoolClass: string;
    guardian: { name: string; phone: string } | null;
    feeType: string;
    feeTypeId: string;
    period: string;
    dueDate: string;
    expectedAmount: string;
    paidAmount: string;
    remaining: string;
    status: string;
};

export type PaymentDetail = {
    id: string;
    receiptNumber: string;
    paidAt: string;
    amount: string;
    method: string;
    reference: string | null;
    comment: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
    cancelledBy: { firstName: string; lastName: string } | null;
    student: { firstName: string; lastName: string; matricule: string; enrollments: { schoolClass: { name: string } }[] };
    guardian: { firstName: string; lastName: string; primaryPhone: string } | null;
    recordedBy: { firstName: string; lastName: string };
    allocations: { amount: string; studentFee: { period: string; feeType: { name: string } } }[];
};

export type ExpenseCategory = { id: string; name: string };

export type Expense = {
    id: string;
    number: string;
    occurredAt: string;
    description: string;
    beneficiary: string | null;
    amount: string;
    method: string;
    reference: string | null;
    comment: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
    cancelledBy: { firstName: string; lastName: string } | null;
    recordedBy: { firstName: string; lastName: string };
    category: { name: string };
};

export type PayrollPayment = {
    id: string;
    payrollId: string;
    receiptNumber: string;
    amount: string;
    method: string;
    paidAt: string;
    cancelledAt: string | null;
    cancelReason: string | null;
    recordedBy: { firstName: string; lastName: string };
    cancelledBy: { firstName: string; lastName: string } | null;
};

export type PayslipDetail = {
    id: string;
    receiptNumber: string;
    amount: string;
    method: string;
    paidAt: string;
    cancelledAt: string | null;
    cancelReason: string | null;
    recordedBy: { firstName: string; lastName: string };
    cancelledBy: { firstName: string; lastName: string } | null;
    payroll: {
        month: string;
        baseSalary: string;
        bonuses: string;
        advances: string;
        deductions: string;
        netSalary: string;
        employee: { firstName: string; lastName: string; matricule: string; type: string; teacherClasses: { name: string }[]; assistantClasses: { name: string }[] };
    };
};

export type Payroll = {
    id: string;
    month: string;
    baseSalary: string;
    bonuses: string;
    advances: string;
    deductions: string;
    netSalary: string;
    amountPaid: string;
    status: string;
    paidAt: string | null;
    employee: Employee;
    payments: PayrollPayment[];
};

export type SalaryAdvance = {
    id: string;
    employeeId: string;
    occurredAt: string;
    amount: string;
    reason: string | null;
    recoveryMonth: string;
    status: string;
    cancelledAt: string | null;
    cancelReason: string | null;
    cancelledBy: { firstName: string; lastName: string } | null;
    employee: Employee;
};

export type CashEntry = {
    id: string;
    type: string;
    amount: string;
    description: string;
    occurredAt: string;
    sourceType: string;
    cancelled: boolean;
    linkedName: string | null;
    studentId: string | null;
    classId: string | null;
    className: string | null;
    feePeriod: string | null;
};

export type Settings = Record<string, string>;

export type DashboardSummary = {
    month: string;
    isCurrentMonth: boolean;
    students: { active: number; boys: number; girls: number; newThisMonth: number; byClass: { className: string; count: number }[] };
    staff: { active: number; teachersActive: number };
    attendanceToday: { present: number; absent: number; late: number; excused: number; rate: number };
    finance: { todayIncome: number; monthIncome: number; monthExpected: number; unpaidTotal: number; monthExpenses: number; monthPayroll: number; balance: number; previousMonthIncome: number; previousMonthExpenses: number };
    charts: { studentsByClass: { className: string; count: number }[]; feeStatus: { status: string; count: number }[] };
    toDo: { unpaidCount: number; absentToday: number; payrollsToPay: number; incompleteDossiers: number };
};
