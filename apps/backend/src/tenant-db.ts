import type { PrismaClient } from '@prisma/client';

// Every model that carries a `schoolId` column (see schema.prisma). Role/Permission/RolePermission,
// User(session)/UserSession and School itself stay out of this list on purpose: they're either global
// catalogs or reached only through a schoolId-scoped parent, so scoping them here would be wrong or redundant.
const TENANT_MODELS = new Set([
    'AcademicYear', 'Attendance', 'CashTransaction', 'Employee', 'EmployeeAttendance',
    'Enrollment', 'Expense', 'ExpenseCategory', 'FeeType', 'Guardian', 'NumberSequence', 'Payment',
    'Payroll', 'PayrollPayment', 'SalaryAdvance', 'SchoolClass', 'Setting', 'Student', 'StudentFee', 'User'
]);

const CREATE_ONE_OPS = new Set(['create']);
const CREATE_MANY_OPS = new Set(['createMany']);
const WHERE_OPS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy']);

/**
 * Returns a Prisma client scoped to one school: every read/write on a tenant model
 * (see TENANT_MODELS) is automatically filtered/stamped with `schoolId`. This is the
 * primary defense against cross-school data leaks — route handlers should use this
 * instead of the raw client for any tenant-scoped model.
 *
 * It does NOT validate that client-supplied foreign keys into other tenant tables
 * (e.g. an `employeeId` on a Payroll create) belong to the same school — see `assertOwned`.
 */
export const forSchool = (prisma: PrismaClient, schoolId: string) => prisma.$extends({
    name: 'tenant-scope',
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                if (!model || !TENANT_MODELS.has(model)) return query(args);
                const scopedArgs = args as Record<string, unknown>;
                if (CREATE_ONE_OPS.has(operation)) {
                    scopedArgs.data = { ...(scopedArgs.data as Record<string, unknown>), schoolId };
                } else if (CREATE_MANY_OPS.has(operation)) {
                    const data = scopedArgs.data;
                    scopedArgs.data = Array.isArray(data) ? data.map((row) => ({ ...row, schoolId })) : { ...(data as Record<string, unknown>), schoolId };
                } else if (operation === 'upsert') {
                    scopedArgs.where = { ...(scopedArgs.where as Record<string, unknown> ?? {}), schoolId };
                    scopedArgs.create = { ...(scopedArgs.create as Record<string, unknown>), schoolId };
                } else if (WHERE_OPS.has(operation)) {
                    scopedArgs.where = { ...(scopedArgs.where as Record<string, unknown> ?? {}), schoolId };
                }
                return query(scopedArgs);
            }
        }
    }
});

export type TenantClient = ReturnType<typeof forSchool>;

/** Type of the `transaction` parameter inside `request.db.$transaction(async (transaction) => ...)`. */
export type TenantTransaction = Parameters<Parameters<TenantClient['$transaction']>[0]>[0];

/**
 * Confirms a client-supplied id (foreign key into another tenant-scoped model) actually
 * belongs to the caller's school before it's used in a write. Without this, the tenant-scoped
 * client alone would stamp a new row with the right schoolId while still happily accepting a
 * foreign key that points at another school's real record (Prisma's FK check only verifies the
 * row exists somewhere, not that it's owned by the same tenant).
 *
 * `accessor` is the lowerCamelCase Prisma client property (e.g. 'employee', 'schoolClass').
 */
export const assertOwned = async (db: TenantClient, accessor: string, id: string): Promise<boolean> => {
    const delegate = (db as unknown as Record<string, { findUnique: (args: { where: { id: string } } ) => Promise<unknown> }>)[accessor];
    const record = await delegate.findUnique({ where: { id } });
    return record !== null;
};
