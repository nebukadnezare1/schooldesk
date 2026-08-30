import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AcademicYear, Employee, FinanceStudentFee, FinanceSummaryEntry, Payment, SchoolClass, Student, UnpaidFee } from './types';

type PageProps = {
    message: string;
    academicYears: AcademicYear[];
    classes: SchoolClass[];
    students: Student[];
    employees: Employee[];
    studentFees: FinanceStudentFee[];
    payments: Payment[];
    unpaidFees: UnpaidFee[];
    financeSummary: FinanceSummaryEntry[];
    activeYear?: AcademicYear;
    onCreateClass: (event: FormEvent<HTMLFormElement>) => void;
    onUpdateClass: (event: FormEvent<HTMLFormElement>) => void;
    onDeleteClass: (classId: string) => void;
    onCreateAcademicYear: (event: FormEvent<HTMLFormElement>) => void;
    onCreateStudent: (event: FormEvent<HTMLFormElement>) => void;
    onUpdateStudent: (event: FormEvent<HTMLFormElement>) => void;
    onDeleteStudent: (studentId: string) => void;
    onMarkStudentLeft: (studentId: string) => void;
    onCreateEmployee: (event: FormEvent<HTMLFormElement>) => void;
    onUpdateEmployee: (event: FormEvent<HTMLFormElement>) => void;
    onDeleteEmployee: (employeeId: string) => void;
    onCreateFee: () => void;
    onCreatePayment: () => void;
    onCancelPayment: (paymentId: string, reason: string) => void;
    onSelectFinanceStudent: (studentId: string) => Promise<void>;
    onLoadAttendance: () => void;
    onSaveAttendance: () => void;
    onFilterUnpaid: () => void;
    onViewUnpaidInPayments: (studentId: string, feeTypeId: string, period: string, remaining: string) => void;
    setValue: (key: string, value: string) => void;
    values: Record<string, string>;
};

const unpaidStatusLabels: Record<string, string> = { UNPAID: 'Non payé', PARTIALLY_PAID: 'Partiel', OVERDUE: 'En retard' };
const daysLate = (dueDate: string) => Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000));

export const Field = ({ label, value, onChange, type = 'text', placeholder, required = true }: { label?: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) => (
    <label className="block text-sm font-medium text-[#315a48]">{label}<input className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} required={required} /></label>
);

const frenchMonthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const parseMonthPeriod = (value: string) => {
    const match = frenchMonthNames.find((name) => value === name || value.startsWith(`${name} `));
    return match ? { month: match, year: value.slice(match.length).trim() } : { month: '', year: '' };
};
const MonthPeriodField = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
    const initial = parseMonthPeriod(value);
    const [month, setMonth] = useState(initial.month);
    const [year, setYear] = useState(initial.year);
    useEffect(() => { const parsed = parseMonthPeriod(value); setMonth(parsed.month); setYear(parsed.year); }, [value]);
    const commit = (nextMonth: string, nextYear: string) => onChange(nextMonth && nextYear.length === 4 ? `${nextMonth} ${nextYear}` : '');
    return (
        <div>
            <label className="block text-sm font-medium text-[#315a48]">Mois / période</label>
            <div className="mt-1 flex gap-2">
                <select className="w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => { const nextMonth = event.target.value; const nextYear = year || String(new Date().getFullYear()); setMonth(nextMonth); setYear(nextYear); commit(nextMonth, nextYear); }} required value={month}>
                    <option disabled value="">Mois</option>
                    {frenchMonthNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <input className="w-24 rounded-lg border border-[#cbdacb] bg-white px-3 py-2" inputMode="numeric" onChange={(event) => { const nextYear = event.target.value.replace(/\D/g, '').slice(0, 4); setYear(nextYear); commit(month, nextYear); }} placeholder="Année" required value={year} />
            </div>
        </div>
    );
};

export const Modal = ({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) => {
    if (!open) return null;
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}><div className="max-h-[100vh] w-full max-w-2xl overflow-y-auto rounded-none bg-white p-4 shadow-xl sm:max-h-[90vh] sm:rounded-2xl sm:p-6" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-[#18352b] sm:text-xl">{title}</h2><button aria-label="Fermer" className="px-2 text-xl text-[#6a8d72]" onClick={onClose} type="button">✕</button></div>{children}</div></div>;
};

const sexLabels: Record<string, string> = { MALE: 'Masculin', FEMALE: 'Féminin', UNSPECIFIED: 'Non précisé' };
const studentStatusLabels: Record<string, string> = { ACTIVE: 'Actif', INACTIVE: 'Inactif', PENDING: 'En attente', LEFT: 'Parti', ARCHIVED: 'Archivé' };
const studentStatusColors: Record<string, string> = { ACTIVE: 'bg-[#e5f1e5] text-[#356743]', INACTIVE: 'bg-[#f1efe5] text-[#8c7a3f]', PENDING: 'bg-[#eef1e5] text-[#6a8d72]', LEFT: 'bg-[#f4e6e1] text-[#a65d36]', ARCHIVED: 'bg-[#edeef1] text-[#5a6270]' };
const relationshipLabels: Record<string, string> = { FATHER: 'Père', MOTHER: 'Mère', GUARDIAN: 'Tuteur', OTHER: 'Autre' };
const calcAge = (birthDate: string) => Math.max(0, Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 86_400_000)));

const emptyStudentValues: Record<string, string> = { studentFirstName: '', studentLastName: '', studentBirthDate: '', studentSex: 'UNSPECIFIED', studentAddress: '', studentMonthlyFee: '', studentInsuranceFee: '', studentClassId: '', studentStatus: 'ACTIVE', guardianFirstName: '', guardianLastName: '', guardianRelationship: 'FATHER', guardianPhone: '', guardianEmail: '', editingStudentId: '' };

type StudentSortKey = 'matricule' | 'lastName' | 'firstName' | 'age' | 'sex' | 'class' | 'status' | 'address' | 'guardian';
const studentSortValue = (student: Student, key: StudentSortKey): string | number => {
    switch (key) {
        case 'matricule': return student.matricule;
        case 'lastName': return student.lastName;
        case 'firstName': return student.firstName;
        case 'age': return calcAge(student.birthDate);
        case 'sex': return sexLabels[student.sex] ?? student.sex;
        case 'class': return student.enrollments[0]?.schoolClass.name ?? 'Non inscrit';
        case 'status': return studentStatusLabels[student.status] ?? student.status;
        case 'address': return student.address ?? '';
        case 'guardian': { const link = student.guardians[0]; return link ? `${link.guardian.lastName} ${link.guardian.firstName}` : ''; }
    }
};

export function SortHeader<K extends string>({ label, sortKey, active, direction, onSort, align }: { label: string; sortKey: K; active: boolean; direction: 'asc' | 'desc'; onSort: (key: K) => void; align?: 'right' }) {
    return <th className={`select-none py-2 pr-4 ${align === 'right' ? 'text-right' : ''}`}>
        <button className={`inline-flex items-center gap-1 hover:text-[#356743] ${active ? 'font-semibold text-[#356743]' : ''}`} onClick={() => onSort(sortKey)} type="button">
            {label}<span className="w-3 text-xs">{active ? (direction === 'asc' ? '▲' : '▼') : ''}</span>
        </button>
    </th>;
}

export function useSortedRows<T, K extends string>(rows: T[], defaultKey: K, valueOf: (row: T, key: K) => string | number) {
    const [sortKey, setSortKey] = useState<K>(defaultKey);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const toggleSort = (key: K) => { if (key === sortKey) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDirection('asc'); } };
    const sorted = [...rows].sort((a, b) => {
        const valueA = valueOf(a, sortKey);
        const valueB = valueOf(b, sortKey);
        const compared = typeof valueA === 'number' && typeof valueB === 'number' ? valueA - valueB : String(valueA).localeCompare(String(valueB), 'fr');
        return sortDirection === 'asc' ? compared : -compared;
    });
    return { sorted, sortKey, sortDirection, toggleSort };
}

export const RowMenuButton = ({ onOpen }: { onOpen: (x: number, y: number) => void }) => (
    <button aria-label="Actions" className="rounded-md px-2 py-1 text-base leading-none text-[#6a8d72] hover:bg-[#edf4ec] hover:text-[#356743]" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); onOpen(rect.left, rect.bottom + 4); }} type="button"><i className="fa-solid fa-ellipsis-vertical" /></button>
);

export type ContextMenuItem = { label: string; onClick: () => void; tone?: 'danger' };
export const ContextMenu = ({ x, y, items, onClose }: { x: number; y: number; items: ContextMenuItem[]; onClose: () => void }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number; ready: boolean }>({ left: x, top: y, ready: false });
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setPos({
            left: Math.max(4, Math.min(x, window.innerWidth - rect.width - 4)),
            top: Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)),
            ready: true
        });
    }, [x, y]);
    return <>
        <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(event) => { event.preventDefault(); onClose(); }} />
        <div className="fixed z-50 min-w-[140px] max-w-[80vw] overflow-hidden rounded-md border border-[#d6e1d5] bg-white shadow-lg" ref={ref} style={{ left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden' }}>
            {items.map((item) => <button className={`block w-full whitespace-nowrap px-2.5 py-1 text-left text-[11px] leading-tight hover:bg-[#f7faf6] ${item.tone === 'danger' ? 'text-[#a3372f] hover:bg-[#f4e6e1]' : ''}`} key={item.label} onClick={item.onClick} type="button">{item.label}</button>)}
        </div>
    </>;
};

export const StudentsPage = ({ students, classes, onCreateStudent, onUpdateStudent, onDeleteStudent, onMarkStudentLeft, setValue, values }: PageProps) => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ studentId: string; x: number; y: number } | null>(null);
    const [classFilter, setClassFilter] = useState('');
    const [teacherFilter, setTeacherFilter] = useState('');
    const isEditing = Boolean(values.editingStudentId);

    const classById = new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass]));
    const teachers = classes.reduce<{ id: string; firstName: string; lastName: string }[]>((acc, schoolClass) => {
        if (schoolClass.teacher && !acc.some((teacher) => teacher.id === schoolClass.teacher!.id)) acc.push(schoolClass.teacher);
        return acc;
    }, []).sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'));
    const filteredStudents = students.filter((student) => {
        const classId = student.enrollments[0]?.schoolClass.id;
        if (classFilter && classId !== classFilter) return false;
        if (teacherFilter && classById.get(classId ?? '')?.teacher?.id !== teacherFilter) return false;
        return true;
    });

    const openCreate = () => { Object.entries(emptyStudentValues).forEach(([key, value]) => setValue(key, value)); setModalOpen(true); };
    const openEdit = (student: Student) => {
        setValue('editingStudentId', student.id);
        setValue('studentFirstName', student.firstName);
        setValue('studentLastName', student.lastName);
        setValue('studentBirthDate', student.birthDate.slice(0, 10));
        setValue('studentSex', student.sex);
        setValue('studentAddress', student.address ?? '');
        setValue('studentMonthlyFee', student.monthlyFee ?? '');
        setValue('studentInsuranceFee', student.insuranceFee ?? '');
        setValue('studentStatus', student.status);
        setValue('studentClassId', student.enrollments[0]?.schoolClass.id ?? '');
        const primaryGuardian = student.guardians[0];
        setValue('guardianFirstName', primaryGuardian?.guardian.firstName ?? '');
        setValue('guardianLastName', primaryGuardian?.guardian.lastName ?? '');
        setValue('guardianRelationship', primaryGuardian?.relationship ?? 'FATHER');
        setValue('guardianPhone', primaryGuardian?.guardian.primaryPhone ?? '');
        setValue('guardianEmail', primaryGuardian?.guardian.email ?? '');
        setModalOpen(true);
    };
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => { await (isEditing ? onUpdateStudent(event) : onCreateStudent(event)); setModalOpen(false); };
    const closeMenu = () => setContextMenu(null);
    const menuStudent = contextMenu ? students.find((student) => student.id === contextMenu.studentId) : undefined;

    const { sorted: sortedStudents, sortKey, sortDirection, toggleSort } = useSortedRows(filteredStudents, 'lastName' as StudentSortKey, studentSortValue);

    return <PageShell title="Élèves" eyebrow="Gestion scolaire">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#6a8d72]">{filteredStudents.length} élève(s){(classFilter || teacherFilter) ? ` sur ${students.length}` : ''} · clic droit (ou ⋮) sur une ligne pour modifier, marquer comme parti ou supprimer · clic sur un titre pour trier</p>
            <div className="flex flex-wrap items-center gap-2">
                <select className="rounded-lg border border-[#cbdacb] bg-white px-3 py-2 text-sm" onChange={(event) => setClassFilter(event.target.value)} value={classFilter}>
                    <option value="">Toutes les classes</option>
                    {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
                </select>
                <select className="rounded-lg border border-[#cbdacb] bg-white px-3 py-2 text-sm" onChange={(event) => setTeacherFilter(event.target.value)} value={teacherFilter}>
                    <option value="">Tous les professeurs</option>
                    {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}</option>)}
                </select>
                <button className="rounded-lg bg-[#356743] px-3 py-1.5 text-xs font-medium text-white sm:px-4 sm:py-2 sm:text-sm" onClick={openCreate} type="button">+ Nouvel élève</button>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full min-w-max text-xs sm:text-sm">
                <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]">
                    <SortHeader active={sortKey === 'matricule'} direction={sortDirection} label="Matricule" onSort={toggleSort} sortKey="matricule" />
                    <SortHeader active={sortKey === 'lastName'} direction={sortDirection} label="Nom" onSort={toggleSort} sortKey="lastName" />
                    <SortHeader active={sortKey === 'firstName'} direction={sortDirection} label="Prénom" onSort={toggleSort} sortKey="firstName" />
                    <SortHeader active={sortKey === 'age'} align="right" direction={sortDirection} label="Âge" onSort={toggleSort} sortKey="age" />
                    <SortHeader active={sortKey === 'sex'} direction={sortDirection} label="Genre" onSort={toggleSort} sortKey="sex" />
                    <SortHeader active={sortKey === 'class'} direction={sortDirection} label="Classe" onSort={toggleSort} sortKey="class" />
                    <SortHeader active={sortKey === 'status'} direction={sortDirection} label="Statut" onSort={toggleSort} sortKey="status" />
                    <SortHeader active={sortKey === 'address'} direction={sortDirection} label="Domiciliation" onSort={toggleSort} sortKey="address" />
                    <SortHeader active={sortKey === 'guardian'} direction={sortDirection} label="Tuteur" onSort={toggleSort} sortKey="guardian" />
                    <th className="w-8 py-2" />
                </tr></thead>
                <tbody>
                    {sortedStudents.map((student) => {
                        const primaryGuardian = student.guardians[0];
                        return <tr className="cursor-context-menu border-b border-[#edf4ec] hover:bg-[#f7faf6]" key={student.id} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ studentId: student.id, x: event.clientX, y: event.clientY }); }}>
                            <td className="py-2 pr-4 text-[#6a8d72]">{student.matricule}</td>
                            <td className="py-2 pr-4 font-medium">{student.lastName}</td>
                            <td className="py-2 pr-4">{student.firstName}</td>
                            <td className="py-2 pr-4 text-right">{calcAge(student.birthDate)}</td>
                            <td className="py-2 pr-4">{sexLabels[student.sex] ?? student.sex}</td>
                            <td className="py-2 pr-4">{student.enrollments[0]?.schoolClass.name ?? 'Non inscrit'}</td>
                            <td className="py-2 pr-4"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${studentStatusColors[student.status] ?? 'bg-[#edf4ec] text-[#356743]'}`}>{studentStatusLabels[student.status] ?? student.status}</span></td>
                            <td className="py-2 pr-4">{student.address || '—'}</td>
                            <td className="py-2 pr-4">{primaryGuardian ? <>{primaryGuardian.guardian.firstName} {primaryGuardian.guardian.lastName} <span className="text-[#6a8d72]">· {primaryGuardian.guardian.primaryPhone}</span></> : '—'}</td>
                            <td className="py-2 pl-2"><RowMenuButton onOpen={(x, y) => setContextMenu({ studentId: student.id, x, y })} /></td>
                        </tr>;
                    })}
                </tbody>
            </table>
            {filteredStudents.length === 0 && <p className="py-4 text-[#557064]">{students.length === 0 ? 'Aucun élève enregistré.' : 'Aucun élève ne correspond à ce filtre.'}</p>}
        </div>
        {contextMenu && menuStudent && <ContextMenu items={[
            { label: 'Modifier', onClick: () => { closeMenu(); openEdit(menuStudent); } },
            ...(menuStudent.status !== 'LEFT' ? [{ label: 'Marquer comme parti (changement d’école)', onClick: () => { closeMenu(); onMarkStudentLeft(menuStudent.id); } }] : []),
            { label: 'Supprimer', tone: 'danger' as const, onClick: () => { closeMenu(); onDeleteStudent(menuStudent.id); } }
        ]} onClose={closeMenu} x={contextMenu.x} y={contextMenu.y} />}
        <Modal onClose={() => setModalOpen(false)} open={isModalOpen} title={isEditing ? "Modifier l'élève" : 'Nouvel élève'}>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
                <Field label="Prénom" value={values.studentFirstName} onChange={(value) => setValue('studentFirstName', value)} />
                <Field label="Nom" value={values.studentLastName} onChange={(value) => setValue('studentLastName', value)} />
                <Field label="Date de naissance" type="date" value={values.studentBirthDate} onChange={(value) => setValue('studentBirthDate', value)} />
                <label className="block text-sm font-medium text-[#315a48]">Sexe<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('studentSex', event.target.value)} required value={values.studentSex}><option value="UNSPECIFIED">Non précisé</option><option value="MALE">Masculin</option><option value="FEMALE">Féminin</option></select></label>
                <label className="block text-sm font-medium text-[#315a48]">Classe<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('studentClassId', event.target.value)} required value={values.studentClassId}><option value="" disabled>Sélectionner…</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
                {isEditing && <label className="block text-sm font-medium text-[#315a48]">Statut<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('studentStatus', event.target.value)} value={values.studentStatus}><option value="ACTIVE">Actif</option><option value="INACTIVE">Inactif</option><option value="PENDING">En attente</option><option value="LEFT">Parti</option><option value="ARCHIVED">Archivé</option></select></label>}
                <div className="sm:col-span-2"><Field label="Domiciliation" onChange={(value) => setValue('studentAddress', value)} placeholder="Adresse de résidence de l'élève" value={values.studentAddress} /></div>

                <div className="sm:col-span-2 border-t border-[#d6e1d5] pt-4"><p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6a8d72]">Frais de scolarité</p><p className="mt-1 text-xs text-[#6a8d72]">Ces montants sont ceux appliqués automatiquement lors d'un encaissement pour cet élève.</p></div>
                <Field label="Mensualité (DH)" onChange={(value) => setValue('studentMonthlyFee', value)} placeholder="Ex. 500" type="number" value={values.studentMonthlyFee} />
                <Field label="Assurance annuelle (DH)" onChange={(value) => setValue('studentInsuranceFee', value)} placeholder="Ex. 150" type="number" value={values.studentInsuranceFee} />

                <div className="mt-2 border-t border-[#d6e1d5] pt-4 sm:col-span-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6a8d72]">Tuteur / responsable</p>
                    <p className="mt-1 text-xs text-[#6a8d72]">Toutes les informations du tuteur sont obligatoires pour enregistrer l'élève.</p>
                </div>
                <Field label="Prénom du tuteur" onChange={(value) => setValue('guardianFirstName', value)} value={values.guardianFirstName} />
                <Field label="Nom du tuteur" onChange={(value) => setValue('guardianLastName', value)} value={values.guardianLastName} />
                <label className="block text-sm font-medium text-[#315a48]">Relation<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('guardianRelationship', event.target.value)} value={values.guardianRelationship}><option value="FATHER">Père</option><option value="MOTHER">Mère</option><option value="GUARDIAN">Tuteur</option><option value="OTHER">Autre</option></select></label>
                <Field label="Téléphone du tuteur" onChange={(value) => setValue('guardianPhone', value)} value={values.guardianPhone} />
                <div className="sm:col-span-2"><Field label="Email du/des parent(s)" onChange={(value) => setValue('guardianEmail', value)} type="email" value={values.guardianEmail} /></div>

                <div className="sm:col-span-2"><Submit label={isEditing ? 'Enregistrer les modifications' : "Enregistrer l'élève"} /></div>
            </form>
        </Modal>
    </PageShell>;
};

const classStatusLabels: Record<string, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive' };
const classStatusColors: Record<string, string> = { ACTIVE: 'bg-[#e5f1e5] text-[#356743]', INACTIVE: 'bg-[#f1efe5] text-[#8c7a3f]' };
const emptyClassValues: Record<string, string> = { className: '', classLevel: '', classRoom: '', classCapacity: '20', classTeacherId: '', classAssistantId: '', classStatus: 'ACTIVE', editingClassId: '' };
type ClassSortKey = 'name' | 'level' | 'room' | 'teacher' | 'assistant' | 'studentCount' | 'fillRate' | 'capacity' | 'status';
const classSortValue = (schoolClass: SchoolClass, key: ClassSortKey): string | number => {
    switch (key) {
        case 'name': return schoolClass.name;
        case 'level': return schoolClass.level;
        case 'room': return schoolClass.room ?? '';
        case 'teacher': return schoolClass.teacher ? `${schoolClass.teacher.lastName} ${schoolClass.teacher.firstName}` : '';
        case 'assistant': return schoolClass.assistant ? `${schoolClass.assistant.lastName} ${schoolClass.assistant.firstName}` : '';
        case 'studentCount': return schoolClass.studentCount;
        case 'fillRate': return schoolClass.fillRate;
        case 'capacity': return schoolClass.capacity;
        case 'status': return classStatusLabels[schoolClass.status] ?? schoolClass.status;
    }
};

export const ClassesPage = ({ classes, employees, academicYears, activeYear, onCreateClass, onUpdateClass, onDeleteClass, setValue, values }: PageProps) => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ classId: string; x: number; y: number } | null>(null);
    const isEditing = Boolean(values.editingClassId);

    const openCreate = () => { Object.entries(emptyClassValues).forEach(([key, value]) => setValue(key, value)); setModalOpen(true); };
    const openEdit = (schoolClass: SchoolClass) => {
        setValue('editingClassId', schoolClass.id);
        setValue('className', schoolClass.name);
        setValue('classLevel', schoolClass.level);
        setValue('classRoom', schoolClass.room ?? '');
        setValue('classCapacity', String(schoolClass.capacity));
        setValue('classTeacherId', schoolClass.teacher?.id ?? '');
        setValue('classAssistantId', schoolClass.assistant?.id ?? '');
        setValue('classStatus', schoolClass.status);
        setModalOpen(true);
    };
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => { await (isEditing ? onUpdateClass(event) : onCreateClass(event)); setModalOpen(false); };
    const closeMenu = () => setContextMenu(null);
    const menuClass = contextMenu ? classes.find((schoolClass) => schoolClass.id === contextMenu.classId) : undefined;
    const { sorted: sortedClasses, sortKey, sortDirection, toggleSort } = useSortedRows(classes, 'name' as ClassSortKey, classSortValue);

    return <PageShell title="Classes" eyebrow={`Année scolaire · ${activeYear?.label ?? '—'}`}>
        <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-[#6a8d72]">{classes.length} classe(s) · clic droit (ou ⋮) sur une ligne pour modifier ou supprimer · clic sur un titre pour trier</p>
            <div className="flex gap-2">
                <button className="rounded-lg bg-[#356743] px-3 py-1.5 text-xs font-medium text-white sm:px-4 sm:py-2 sm:text-sm" onClick={openCreate} type="button">+ Nouvelle classe</button>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full min-w-max text-xs sm:text-sm">
                <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]">
                    <SortHeader active={sortKey === 'name'} direction={sortDirection} label="Nom" onSort={toggleSort} sortKey="name" />
                    <SortHeader active={sortKey === 'level'} direction={sortDirection} label="Niveau" onSort={toggleSort} sortKey="level" />
                    <SortHeader active={sortKey === 'room'} direction={sortDirection} label="Salle" onSort={toggleSort} sortKey="room" />
                    <SortHeader active={sortKey === 'teacher'} direction={sortDirection} label="Professeur" onSort={toggleSort} sortKey="teacher" />
                    <SortHeader active={sortKey === 'assistant'} direction={sortDirection} label="Assistant" onSort={toggleSort} sortKey="assistant" />
                    <SortHeader active={sortKey === 'studentCount'} align="right" direction={sortDirection} label="Filles/Garçons" onSort={toggleSort} sortKey="studentCount" />
                    <SortHeader active={sortKey === 'fillRate'} align="right" direction={sortDirection} label="Remplissage" onSort={toggleSort} sortKey="fillRate" />
                    <SortHeader active={sortKey === 'status'} direction={sortDirection} label="Statut" onSort={toggleSort} sortKey="status" />
                    <th className="w-8 py-2" />
                </tr></thead>
                <tbody>
                    {sortedClasses.map((schoolClass) => <tr className="cursor-context-menu border-b border-[#edf4ec] hover:bg-[#f7faf6]" key={schoolClass.id} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ classId: schoolClass.id, x: event.clientX, y: event.clientY }); }}>
                        <td className="py-2 pr-4 font-medium">{schoolClass.name}</td>
                        <td className="py-2 pr-4">{schoolClass.level}</td>
                        <td className="py-2 pr-4">{schoolClass.room || '—'}</td>
                        <td className="py-2 pr-4">{schoolClass.teacher ? `${schoolClass.teacher.firstName} ${schoolClass.teacher.lastName}` : '—'}</td>
                        <td className="py-2 pr-4">{schoolClass.assistant ? `${schoolClass.assistant.firstName} ${schoolClass.assistant.lastName}` : '—'}</td>
                        <td className="py-2 pr-4 text-right">{schoolClass.girls}F / {schoolClass.boys}G · {schoolClass.studentCount}/{schoolClass.capacity}</td>
                        <td className="py-2 pr-4 text-right">{schoolClass.fillRate}%</td>
                        <td className="py-2 pr-4"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${classStatusColors[schoolClass.status] ?? 'bg-[#edf4ec] text-[#356743]'}`}>{classStatusLabels[schoolClass.status] ?? schoolClass.status}</span></td>
                        <td className="py-2 pl-2"><RowMenuButton onOpen={(x, y) => setContextMenu({ classId: schoolClass.id, x, y })} /></td>
                    </tr>)}
                </tbody>
            </table>
            {classes.length === 0 && <p className="py-4 text-[#557064]">Aucune classe pour cette année scolaire.</p>}
        </div>
        {contextMenu && menuClass && <ContextMenu items={[{ label: 'Modifier', onClick: () => { closeMenu(); openEdit(menuClass); } }, { label: 'Supprimer', tone: 'danger', onClick: () => { closeMenu(); onDeleteClass(menuClass.id); } }]} onClose={closeMenu} x={contextMenu.x} y={contextMenu.y} />}
        <Modal onClose={() => setModalOpen(false)} open={isModalOpen} title={isEditing ? 'Modifier la classe' : 'Nouvelle classe'}>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
                <Field label="Nom" value={values.className} onChange={(value) => setValue('className', value)} />
                <Field label="Niveau" value={values.classLevel} onChange={(value) => setValue('classLevel', value)} />
                <Field label="Salle" onChange={(value) => setValue('classRoom', value)} required={false} value={values.classRoom} />
                <Field label="Capacité" type="number" value={values.classCapacity} onChange={(value) => setValue('classCapacity', value)} />
                <label className="block text-sm font-medium text-[#315a48]">Professeur<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('classTeacherId', event.target.value)} value={values.classTeacherId}><option value="">Aucun</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></label>
                <label className="block text-sm font-medium text-[#315a48]">Assistant<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('classAssistantId', event.target.value)} value={values.classAssistantId}><option value="">Aucun</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></label>
                {isEditing && <label className="block text-sm font-medium text-[#315a48]">Statut<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('classStatus', event.target.value)} value={values.classStatus}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>}
                <div className="sm:col-span-2">{academicYears.filter((year) => year.status === 'ACTIVE').map((year) => <p className="text-sm text-[#6a8d72]" key={year.id}>Année scolaire : {year.label}</p>)}</div>
                <div className="sm:col-span-2"><Submit label={isEditing ? 'Enregistrer les modifications' : 'Ajouter la classe'} /></div>
            </form>
        </Modal>
    </PageShell>;
};

const employeeTypeLabels: Record<string, string> = { TEACHER: 'Professeur', DIRECTOR: 'Directrice', ASSISTANT: 'Assistant', ADMINISTRATION: 'Administration', OTHER: 'Autre' };
const employeeStatusLabels: Record<string, string> = { ACTIVE: 'Actif', INACTIVE: 'Inactif', ARCHIVED: 'Archivé' };
const employeeStatusColors: Record<string, string> = { ACTIVE: 'bg-[#e5f1e5] text-[#356743]', INACTIVE: 'bg-[#f1efe5] text-[#8c7a3f]', ARCHIVED: 'bg-[#edeef1] text-[#5a6270]' };
const emptyEmployeeValues: Record<string, string> = { employeeFirstName: '', employeeLastName: '', employeeType: 'TEACHER', employeePhone: '', employeeEmail: '', employeeAddress: '', employeeQualification: '', employeeHiredAt: '', employeeBaseSalary: '', employeeContractType: '', employeeStatus: 'ACTIVE', editingEmployeeId: '' };
type EmployeeSortKey = 'matricule' | 'lastName' | 'firstName' | 'type' | 'phone' | 'email' | 'hiredAt' | 'baseSalary' | 'status';
const employeeSortValue = (employee: Employee, key: EmployeeSortKey): string | number => {
    switch (key) {
        case 'matricule': return employee.matricule;
        case 'lastName': return employee.lastName;
        case 'firstName': return employee.firstName;
        case 'type': return employeeTypeLabels[employee.type] ?? employee.type;
        case 'phone': return employee.phone ?? '';
        case 'email': return employee.email ?? '';
        case 'hiredAt': return employee.hiredAt ?? '';
        case 'baseSalary': return employee.baseSalary ? Number(employee.baseSalary) : 0;
        case 'status': return employeeStatusLabels[employee.status] ?? employee.status;
    }
};

export const StaffPage = ({ employees, onCreateEmployee, onUpdateEmployee, onDeleteEmployee, setValue, values }: PageProps) => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ employeeId: string; x: number; y: number } | null>(null);
    const isEditing = Boolean(values.editingEmployeeId);

    const openCreate = () => { Object.entries(emptyEmployeeValues).forEach(([key, value]) => setValue(key, value)); setModalOpen(true); };
    const openEdit = (employee: Employee) => {
        setValue('editingEmployeeId', employee.id);
        setValue('employeeFirstName', employee.firstName);
        setValue('employeeLastName', employee.lastName);
        setValue('employeeType', employee.type);
        setValue('employeePhone', employee.phone ?? '');
        setValue('employeeEmail', employee.email ?? '');
        setValue('employeeAddress', employee.address ?? '');
        setValue('employeeQualification', employee.qualification ?? '');
        setValue('employeeHiredAt', employee.hiredAt ? employee.hiredAt.slice(0, 10) : '');
        setValue('employeeBaseSalary', employee.baseSalary ?? '');
        setValue('employeeContractType', employee.contractType ?? '');
        setValue('employeeStatus', employee.status);
        setModalOpen(true);
    };
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => { await (isEditing ? onUpdateEmployee(event) : onCreateEmployee(event)); setModalOpen(false); };
    const closeMenu = () => setContextMenu(null);
    const menuEmployee = contextMenu ? employees.find((employee) => employee.id === contextMenu.employeeId) : undefined;
    const { sorted: sortedEmployees, sortKey, sortDirection, toggleSort } = useSortedRows(employees, 'lastName' as EmployeeSortKey, employeeSortValue);

    return <PageShell title="Personnel" eyebrow="Équipe">
        <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-[#6a8d72]">{employees.length} membre(s) · clic droit (ou ⋮) sur une ligne pour modifier ou supprimer · clic sur un titre pour trier</p>
            <button className="rounded-lg bg-[#356743] px-3 py-1.5 text-xs font-medium text-white sm:px-4 sm:py-2 sm:text-sm" onClick={openCreate} type="button">+ Nouveau membre</button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full min-w-max text-xs sm:text-sm">
                <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]">
                    <SortHeader active={sortKey === 'matricule'} direction={sortDirection} label="Matricule" onSort={toggleSort} sortKey="matricule" />
                    <SortHeader active={sortKey === 'lastName'} direction={sortDirection} label="Nom" onSort={toggleSort} sortKey="lastName" />
                    <SortHeader active={sortKey === 'firstName'} direction={sortDirection} label="Prénom" onSort={toggleSort} sortKey="firstName" />
                    <SortHeader active={sortKey === 'type'} direction={sortDirection} label="Fonction" onSort={toggleSort} sortKey="type" />
                    <SortHeader active={sortKey === 'phone'} direction={sortDirection} label="Téléphone" onSort={toggleSort} sortKey="phone" />
                    <SortHeader active={sortKey === 'email'} direction={sortDirection} label="Email" onSort={toggleSort} sortKey="email" />
                    <SortHeader active={sortKey === 'hiredAt'} direction={sortDirection} label="Embauche" onSort={toggleSort} sortKey="hiredAt" />
                    <SortHeader active={sortKey === 'baseSalary'} align="right" direction={sortDirection} label="Salaire de base" onSort={toggleSort} sortKey="baseSalary" />
                    <SortHeader active={sortKey === 'status'} direction={sortDirection} label="Statut" onSort={toggleSort} sortKey="status" />
                    <th className="w-8 py-2" />
                </tr></thead>
                <tbody>
                    {sortedEmployees.map((employee) => <tr className="cursor-context-menu border-b border-[#edf4ec] hover:bg-[#f7faf6]" key={employee.id} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ employeeId: employee.id, x: event.clientX, y: event.clientY }); }}>
                        <td className="py-2 pr-4 text-[#6a8d72]">{employee.matricule}</td>
                        <td className="py-2 pr-4 font-medium">{employee.lastName}</td>
                        <td className="py-2 pr-4">{employee.firstName}</td>
                        <td className="py-2 pr-4">{employeeTypeLabels[employee.type] ?? employee.type}</td>
                        <td className="py-2 pr-4">{employee.phone || '—'}</td>
                        <td className="py-2 pr-4">{employee.email || '—'}</td>
                        <td className="py-2 pr-4">{employee.hiredAt ? new Date(employee.hiredAt).toLocaleDateString('fr-FR') : '—'}</td>
                        <td className="py-2 pr-4 text-right">{employee.baseSalary ? `${employee.baseSalary} DH` : '—'}</td>
                        <td className="py-2 pr-4"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${employeeStatusColors[employee.status] ?? 'bg-[#edf4ec] text-[#356743]'}`}>{employeeStatusLabels[employee.status] ?? employee.status}</span></td>
                        <td className="py-2 pl-2"><RowMenuButton onOpen={(x, y) => setContextMenu({ employeeId: employee.id, x, y })} /></td>
                    </tr>)}
                </tbody>
            </table>
            {employees.length === 0 && <p className="py-4 text-[#557064]">Aucun membre du personnel enregistré.</p>}
        </div>
        {contextMenu && menuEmployee && <ContextMenu items={[{ label: 'Modifier', onClick: () => { closeMenu(); openEdit(menuEmployee); } }, { label: 'Supprimer', tone: 'danger', onClick: () => { closeMenu(); onDeleteEmployee(menuEmployee.id); } }]} onClose={closeMenu} x={contextMenu.x} y={contextMenu.y} />}
        <Modal onClose={() => setModalOpen(false)} open={isModalOpen} title={isEditing ? 'Modifier le membre du personnel' : 'Nouveau membre du personnel'}>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
                <Field label="Prénom" value={values.employeeFirstName} onChange={(value) => setValue('employeeFirstName', value)} />
                <Field label="Nom" value={values.employeeLastName} onChange={(value) => setValue('employeeLastName', value)} />
                <label className="block text-sm font-medium text-[#315a48]">Fonction<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('employeeType', event.target.value)} value={values.employeeType}><option value="TEACHER">Professeur</option><option value="DIRECTOR">Directrice</option><option value="ASSISTANT">Assistant</option><option value="ADMINISTRATION">Administration</option><option value="OTHER">Autre</option></select></label>
                {isEditing && <label className="block text-sm font-medium text-[#315a48]">Statut<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('employeeStatus', event.target.value)} value={values.employeeStatus}><option value="ACTIVE">Actif</option><option value="INACTIVE">Inactif</option><option value="ARCHIVED">Archivé</option></select></label>}
                <Field label="Téléphone" onChange={(value) => setValue('employeePhone', value)} required={false} value={values.employeePhone} />
                <Field label="Email" onChange={(value) => setValue('employeeEmail', value)} required={false} type="email" value={values.employeeEmail} />
                <div className="sm:col-span-2"><Field label="Adresse" onChange={(value) => setValue('employeeAddress', value)} required={false} value={values.employeeAddress} /></div>
                <Field label="Qualification" onChange={(value) => setValue('employeeQualification', value)} required={false} value={values.employeeQualification} />
                <Field label="Date d'embauche" onChange={(value) => setValue('employeeHiredAt', value)} required={false} type="date" value={values.employeeHiredAt} />
                <Field label="Salaire de base" onChange={(value) => setValue('employeeBaseSalary', value)} required={false} type="number" value={values.employeeBaseSalary} />
                <Field label="Type de contrat" onChange={(value) => setValue('employeeContractType', value)} placeholder="CDI, CDD, vacataire…" required={false} value={values.employeeContractType} />
                <div className="sm:col-span-2"><Submit label={isEditing ? 'Enregistrer les modifications' : 'Ajouter au personnel'} /></div>
            </form>
        </Modal>
    </PageShell>;
};

export const AttendancePage = ({ students, classes, onLoadAttendance, onSaveAttendance, setValue, values }: PageProps) => <PageShell title="Présences" eyebrow="Suivi quotidien"><div className="grid gap-3 sm:grid-cols-3"><Field label="Date" type="date" value={values.attendanceDate} onChange={(value) => setValue('attendanceDate', value)} /><label className="block text-sm font-medium text-[#315a48]">Classe<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" value={values.attendanceClassId} onChange={(event) => setValue('attendanceClassId', event.target.value)}>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label><button className="self-end rounded-lg border border-[#356743] px-4 py-2 text-[#356743]" type="button" onClick={onLoadAttendance}>Charger</button></div><div className="mt-6 space-y-2">{students.filter((student) => student.enrollments[0]?.schoolClass.id === values.attendanceClassId).map((student) => <div className="flex items-center justify-between rounded-lg border border-[#d6e1d5] p-3" key={student.id}><span>{student.firstName} {student.lastName}</span><select className="rounded border border-[#cbdacb] px-2 py-1" value={values[`attendance_${student.id}`] ?? 'PRESENT'} onChange={(event) => setValue(`attendance_${student.id}`, event.target.value)}><option value="PRESENT">Présent</option><option value="ABSENT">Absent</option><option value="LATE">Retard</option><option value="EXCUSED">Excusé</option></select></div>)}</div><button className="mt-6 rounded-lg bg-[#356743] px-4 py-2 text-white" type="button" onClick={onSaveAttendance}>Enregistrer les présences</button></PageShell>;

const paymentMethodLabels: Record<string, string> = { CASH: 'Espèces', TRANSFER: 'Virement', CHECK: 'Chèque', CARD: 'Carte', OTHER: 'Autre' };
const feeStatusLabels: Record<string, string> = { UNPAID: 'Non payé', PARTIALLY_PAID: 'Partiellement payé', PAID: 'Payé', OVERDUE: 'En retard', EXEMPT: 'Exonéré', CANCELLED: 'Annulé' };

export const CancelReasonModal = ({ open, onClose, onConfirm, title, notice }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void; title: string; notice: string }) => {
    const [reason, setReason] = useState('');
    return <Modal onClose={onClose} open={open} title={title}>
        <p className="mb-3 text-sm text-[#557064]">{notice}</p>
        <label className="block text-sm font-medium text-[#315a48]">Motif de l'annulation<textarea className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setReason(event.target.value)} rows={3} value={reason} /></label>
        <button className="mt-4 rounded-lg bg-[#a3372f] px-4 py-2 text-white disabled:opacity-50" disabled={!reason.trim()} onClick={() => { onConfirm(reason); setReason(''); }} type="button">Confirmer l'annulation</button>
    </Modal>;
};

// Date locale (année-mois-jour du fuseau du navigateur), pas new Date().toISOString().slice(0, 10)
// qui convertit d'abord en UTC — peut décaler d'un jour près de minuit dans un fuseau UTC+.
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const emptyPaymentValues: Record<string, string> = { feeTypeId: '', feePeriod: '', paymentAmount: '', paymentMethod: 'CASH', paymentPaidAt: today() };
const emptyManualFeeValues: Record<string, string> = { feeTypeId: '', feePeriod: '', feeAmount: '', feeDueDate: '' };
const emptyFeeTypeValues: Record<string, string> = { newFeeTypeName: '', newFeeTypeAmount: '0', newFeeTypeFrequency: 'MONTHLY' };
const paymentsStatusLabels: Record<string, string> = { NONE: 'Aucun frais', UNPAID: 'Non payé', PARTIALLY_PAID: 'Partiel', OVERDUE: 'En retard', PAID: 'À jour' };
const paymentsStatusColors: Record<string, string> = { NONE: 'bg-[#edf4ec] text-[#6a8d72]', UNPAID: 'bg-[#f4e6e1] text-[#a65d36]', PARTIALLY_PAID: 'bg-[#f1efe5] text-[#8c7a3f]', OVERDUE: 'bg-[#f4e6e1] text-[#a3372f]', PAID: 'bg-[#e5f1e5] text-[#356743]' };

type PaymentsRow = { student: Student; totalDue: number; totalPaid: number; remaining: number; status: string };
type PaymentsSortKey = 'name' | 'matricule' | 'class' | 'due' | 'paid' | 'remaining' | 'status';
const paymentsSortValue = (row: PaymentsRow, key: PaymentsSortKey): string | number => {
    switch (key) {
        case 'name': return `${row.student.lastName} ${row.student.firstName}`;
        case 'matricule': return row.student.matricule;
        case 'class': return row.student.enrollments[0]?.schoolClass.name ?? '';
        case 'due': return row.totalDue;
        case 'paid': return row.totalPaid;
        case 'remaining': return row.remaining;
        case 'status': return paymentsStatusLabels[row.status] ?? row.status;
    }
};

export const PaymentsPage = ({ students, classes, studentFees, payments, feeTypes, financeSummary, onCreateFee, onCreatePayment, onCreateFeeType, onCancelPayment, onSelectFinanceStudent, setValue, values }: PageProps & { feeTypes: { id: string; name: string; defaultAmount: string }[]; onCreateFeeType: () => void }) => {
    const navigate = useNavigate();
    const [rowMenu, setRowMenu] = useState<{ studentId: string; x: number; y: number } | null>(null);
    const [historyMenu, setHistoryMenu] = useState<{ paymentId: string; x: number; y: number } | null>(null);
    const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [isFeeModalOpen, setFeeModalOpen] = useState(false);
    const [isFeeTypeModalOpen, setFeeTypeModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [historyFeeFilter, setHistoryFeeFilter] = useState('');
    const [feeMenu, setFeeMenu] = useState<{ feeId: string; x: number; y: number } | null>(null);
    const openFeeTypeModal = () => { Object.entries(emptyFeeTypeValues).forEach(([key, value]) => setValue(key, value)); setFeeTypeModalOpen(true); };
    const handleFeeTypeSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await onCreateFeeType(); setFeeTypeModalOpen(false); };

    useEffect(() => {
        if (values.autoOpenPayment === '1') { setPaymentModalOpen(true); setValue('autoOpenPayment', ''); }
    }, [values.autoOpenPayment]);

    const closeRowMenu = () => setRowMenu(null);
    const closeHistoryMenu = () => setHistoryMenu(null);
    const closeFeeMenu = () => setFeeMenu(null);
    const menuStudent = rowMenu ? students.find((student) => student.id === rowMenu.studentId) : undefined;
    const menuPayment = historyMenu ? payments.find((payment) => payment.id === historyMenu.paymentId) : undefined;
    const filteredPayments = historyFeeFilter ? payments.filter((payment) => payment.allocations.some((allocation) => allocation.studentFeeId === historyFeeFilter)) : [];

    const openPaymentModalFor = async (studentId: string) => {
        const student = students.find((candidate) => candidate.id === studentId);
        if (student?.status === 'LEFT') { window.alert(`${student.firstName} ${student.lastName} a quitté l'école — impossible d'enregistrer un nouvel encaissement pour cet élève.`); return; }
        await onSelectFinanceStudent(studentId); Object.entries(emptyPaymentValues).forEach(([key, value]) => setValue(key, value)); setValue('paymentPaidAt', today()); setPaymentModalOpen(true);
    };
    const handlePaymentSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await onCreatePayment(); setPaymentModalOpen(false); };
    const openFeeModalFor = async (studentId: string) => {
        const student = students.find((candidate) => candidate.id === studentId);
        if (student?.status === 'LEFT') { window.alert(`${student.firstName} ${student.lastName} a quitté l'école — impossible d'ajouter un frais pour cet élève.`); return; }
        await onSelectFinanceStudent(studentId); Object.entries(emptyManualFeeValues).forEach(([key, value]) => setValue(key, value)); setFeeModalOpen(true);
    };
    const handleFeeSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await onCreateFee(); setFeeModalOpen(false); };
    const openDetailFor = async (studentId: string) => { setHistoryFeeFilter(''); await onSelectFinanceStudent(studentId); setDetailModalOpen(true); };

    const selectedStudent = students.find((student) => student.id === values.financeStudentId);
    const selectedFeeType = feeTypes.find((type) => type.id === values.feeTypeId);
    const existingFeeForPeriod = values.feePeriod && selectedFeeType ? studentFees.find((fee) => fee.feeType.name === selectedFeeType.name && fee.period === values.feePeriod) : undefined;
    const studentSpecificAmount = selectedFeeType?.name === 'Mensualité' ? selectedStudent?.monthlyFee : selectedFeeType?.name === 'Assurance' ? selectedStudent?.insuranceFee : null;
    const previewAmount = existingFeeForPeriod ? existingFeeForPeriod.finalAmount : (studentSpecificAmount ?? selectedFeeType?.defaultAmount);
    const amountDue = existingFeeForPeriod ? existingFeeForPeriod.remaining : previewAmount;

    useEffect(() => {
        if (isPaymentModalOpen && amountDue !== undefined && amountDue !== null) setValue('paymentAmount', String(amountDue));
    }, [isPaymentModalOpen, values.feeTypeId, values.feePeriod, studentFees]);

    const rows: PaymentsRow[] = students.map((student) => {
        const summary = financeSummary.find((entry) => entry.studentId === student.id);
        return { student, totalDue: summary ? Number(summary.totalDue) : 0, totalPaid: summary ? Number(summary.totalPaid) : 0, remaining: summary ? Number(summary.remaining) : 0, status: summary ? summary.status : 'NONE' };
    });
    const { sorted: sortedRows, sortKey, sortDirection, toggleSort } = useSortedRows(rows, 'name' as PaymentsSortKey, paymentsSortValue);
    const search = (values.paymentsSearch ?? '').trim().toLowerCase();
    const filteredRows = sortedRows.filter((row) =>
        (!values.paymentsClassId || row.student.enrollments[0]?.schoolClass.id === values.paymentsClassId) &&
        (!search || `${row.student.firstName} ${row.student.lastName} ${row.student.matricule}`.toLowerCase().includes(search))
    );

    return <PageShell title="Paiements" eyebrow="Comptabilité">
        <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-[#315a48]">Classe<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('paymentsClassId', event.target.value)} value={values.paymentsClassId ?? ''}><option value="">Toutes</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
            <div className="sm:col-span-2"><Field label="Rechercher (nom ou matricule)" onChange={(value) => setValue('paymentsSearch', value)} required={false} value={values.paymentsSearch ?? ''} /></div>
        </div>
        <p className="mt-4 text-sm text-[#6a8d72]">{filteredRows.length} élève(s) · clic droit (ou ⋮) sur une ligne pour encaisser, ajouter un frais ou voir le détail · clic sur un titre pour trier</p>
        <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-max text-xs sm:text-sm">
                <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]">
                    <SortHeader active={sortKey === 'name'} direction={sortDirection} label="Élève" onSort={toggleSort} sortKey="name" />
                    <SortHeader active={sortKey === 'matricule'} direction={sortDirection} label="Matricule" onSort={toggleSort} sortKey="matricule" />
                    <SortHeader active={sortKey === 'class'} direction={sortDirection} label="Classe" onSort={toggleSort} sortKey="class" />
                    <SortHeader active={sortKey === 'due'} align="right" direction={sortDirection} label="Dû" onSort={toggleSort} sortKey="due" />
                    <SortHeader active={sortKey === 'paid'} align="right" direction={sortDirection} label="Payé" onSort={toggleSort} sortKey="paid" />
                    <SortHeader active={sortKey === 'remaining'} align="right" direction={sortDirection} label="Reste" onSort={toggleSort} sortKey="remaining" />
                    <SortHeader active={sortKey === 'status'} direction={sortDirection} label="Statut" onSort={toggleSort} sortKey="status" />
                    <th className="w-8 py-2" />
                </tr></thead>
                <tbody>
                    {filteredRows.map((row) => <tr className={`cursor-context-menu border-b border-[#edf4ec] hover:bg-[#f7faf6] ${row.student.status === 'LEFT' ? 'opacity-60' : ''}`} key={row.student.id} onContextMenu={(event) => { event.preventDefault(); setRowMenu({ studentId: row.student.id, x: event.clientX, y: event.clientY }); }}>
                        <td className="py-2 pr-4 font-medium">{row.student.firstName} {row.student.lastName}{row.student.status === 'LEFT' && <span className={`ml-2 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${studentStatusColors.LEFT}`}>{studentStatusLabels.LEFT}</span>}</td>
                        <td className="py-2 pr-4">{row.student.matricule}</td>
                        <td className="py-2 pr-4">{row.student.enrollments[0]?.schoolClass.name ?? '—'}</td>
                        <td className="py-2 pr-4 text-right">{row.totalDue} DH</td>
                        <td className="py-2 pr-4 text-right">{row.totalPaid} DH</td>
                        <td className="py-2 pr-4 text-right font-semibold">{row.remaining} DH</td>
                        <td className="py-2 pr-4"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${paymentsStatusColors[row.status] ?? 'bg-[#edf4ec] text-[#356743]'}`}>{paymentsStatusLabels[row.status] ?? row.status}</span></td>
                        <td className="py-2 pl-2"><RowMenuButton onOpen={(x, y) => setRowMenu({ studentId: row.student.id, x, y })} /></td>
                    </tr>)}
                </tbody>
            </table>
            {filteredRows.length === 0 && <p className="py-4 text-[#557064]">Aucun élève pour ces filtres.</p>}
        </div>

        {rowMenu && menuStudent && <ContextMenu
            items={[
                { label: 'Nouvel encaissement', onClick: () => { closeRowMenu(); openPaymentModalFor(menuStudent.id); } },
                { label: 'Frais manuel', onClick: () => { closeRowMenu(); openFeeModalFor(menuStudent.id); } },
                { label: 'Voir le détail', onClick: () => { closeRowMenu(); openDetailFor(menuStudent.id); } }
            ]}
            onClose={closeRowMenu} x={rowMenu.x} y={rowMenu.y}
        />}

        <Modal onClose={() => setPaymentModalOpen(false)} open={isPaymentModalOpen} title={selectedStudent ? `Nouvel encaissement — ${selectedStudent.firstName} ${selectedStudent.lastName}` : 'Nouvel encaissement'}>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handlePaymentSubmit}>
                <div><label className="text-sm font-medium text-[#315a48]">Type<select className="mt-1 w-full rounded-lg border border-[#cbdacb] px-3 py-2" onChange={(event) => setValue('feeTypeId', event.target.value)} required value={values.feeTypeId}><option value="">Type de frais</option>{feeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><button className="mt-1 text-xs text-[#356743] underline" onClick={openFeeTypeModal} type="button">+ Nouveau type de frais</button></div>
                {selectedFeeType?.name === 'Mensualité'
                    ? <MonthPeriodField onChange={(value) => setValue('feePeriod', value)} value={values.feePeriod} />
                    : <Field label="Mois / période" onChange={(value) => setValue('feePeriod', value)} value={values.feePeriod} />}
                {selectedFeeType && <p className="text-xs text-[#6a8d72] sm:col-span-2">
                    {existingFeeForPeriod
                        ? `Frais déjà existant pour cette période : ${existingFeeForPeriod.finalAmount} DH dû, reste ${existingFeeForPeriod.remaining} DH.`
                        : `Nouveau frais : ${previewAmount ?? '—'} DH seront dus pour cette période${studentSpecificAmount ? ' (montant configuré pour cet élève)' : ' — tarif par défaut du type, non configuré pour cet élève'}.`}
                </p>}
                <Field label="Montant payé" onChange={(value) => setValue('paymentAmount', value)} type="number" value={values.paymentAmount} />
                <label className="text-sm font-medium text-[#315a48]">Mode<select className="mt-1 w-full rounded-lg border border-[#cbdacb] px-3 py-2" onChange={(event) => setValue('paymentMethod', event.target.value)} value={values.paymentMethod}><option value="CASH">Espèces</option><option value="TRANSFER">Virement</option><option value="CHECK">Chèque</option><option value="CARD">Carte</option></select></label>
                <Field label="Date du paiement" onChange={(value) => setValue('paymentPaidAt', value)} type="date" value={values.paymentPaidAt} />
                <div className="sm:col-span-2"><button className="w-full rounded-lg bg-[#356743] px-4 py-2 font-medium text-white" type="submit">Enregistrer le paiement</button></div>
            </form>
        </Modal>

        <Modal onClose={() => setFeeModalOpen(false)} open={isFeeModalOpen} title={selectedStudent ? `Nouveau frais manuel — ${selectedStudent.firstName} ${selectedStudent.lastName}` : 'Nouveau frais manuel'}>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleFeeSubmit}>
                <div className="sm:col-span-2"><label className="text-sm font-medium text-[#315a48]">Type<select className="mt-1 w-full rounded-lg border border-[#cbdacb] px-3 py-2" onChange={(event) => setValue('feeTypeId', event.target.value)} required value={values.feeTypeId}><option value="">Type de frais</option>{feeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><button className="mt-1 text-xs text-[#356743] underline" onClick={openFeeTypeModal} type="button">+ Nouveau type de frais</button></div>
                <Field label="Mois / période" onChange={(value) => setValue('feePeriod', value)} value={values.feePeriod} />
                <Field label="Montant" onChange={(value) => setValue('feeAmount', value)} type="number" value={values.feeAmount} />
                <Field label="Date d'échéance" onChange={(value) => setValue('feeDueDate', value)} type="date" value={values.feeDueDate} />
                <div className="sm:col-span-2"><button className="w-full rounded-lg bg-[#356743] px-4 py-2 font-medium text-white" type="submit">Créer le frais</button></div>
            </form>
        </Modal>

        <Modal onClose={() => setFeeTypeModalOpen(false)} open={isFeeTypeModalOpen} title="Nouveau type de frais">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleFeeTypeSubmit}>
                <div className="sm:col-span-2"><Field label="Nom" onChange={(value) => setValue('newFeeTypeName', value)} value={values.newFeeTypeName} /></div>
                <Field label="Montant par défaut (DH)" onChange={(value) => setValue('newFeeTypeAmount', value)} type="number" value={values.newFeeTypeAmount} />
                <label className="text-sm font-medium text-[#315a48]">Fréquence<select className="mt-1 w-full rounded-lg border border-[#cbdacb] px-3 py-2" onChange={(event) => setValue('newFeeTypeFrequency', event.target.value)} value={values.newFeeTypeFrequency}><option value="ONE_TIME">Ponctuel</option><option value="MONTHLY">Mensuel</option><option value="QUARTERLY">Trimestriel</option><option value="YEARLY">Annuel</option><option value="OTHER">Autre</option></select></label>
                <p className="text-xs text-[#6a8d72] sm:col-span-2">Le montant par défaut ne s'applique que si l'élève n'a pas de tarif spécifique configuré.</p>
                <div className="sm:col-span-2"><button className="w-full rounded-lg bg-[#356743] px-4 py-2 font-medium text-white" type="submit">Créer le type de frais</button></div>
            </form>
        </Modal>

        <Modal onClose={() => setDetailModalOpen(false)} open={isDetailModalOpen} title={selectedStudent ? `Détail — ${selectedStudent.firstName} ${selectedStudent.lastName} · ${selectedStudent.matricule}` : 'Détail élève'}>
            <h3 className="text-base font-semibold text-[#18352b]">Frais de l'élève</h3>
            <p className="mt-1 text-xs text-[#6a8d72]">Cliquer sur un frais pour filtrer son historique de paiements ci-dessous · clic droit (ou ⋮) pour voir tous ses reçus.</p>
            <div className="mt-2 space-y-2">{studentFees.map((fee) => <div className={`flex items-stretch gap-1 rounded-lg border ${historyFeeFilter === fee.id ? 'border-[#356743] bg-[#f7faf6]' : 'border-[#d6e1d5]'}`} key={fee.id} onContextMenu={(event) => { event.preventDefault(); setFeeMenu({ feeId: fee.id, x: event.clientX, y: event.clientY }); }}>
                <button className="flex flex-1 flex-wrap items-center justify-between gap-2 p-3 text-left" onClick={() => setHistoryFeeFilter((current) => current === fee.id ? '' : fee.id)} type="button"><span>{fee.feeType.name} · {fee.period}</span><span className="text-sm text-[#557064]">Dû {fee.finalAmount} DH · Payé {fee.paidAmount} DH · Reste <strong>{fee.remaining} DH</strong> · {feeStatusLabels[fee.status] ?? fee.status}</span></button>
                <div className="flex items-center pr-2"><RowMenuButton onOpen={(x, y) => setFeeMenu({ feeId: fee.id, x, y })} /></div>
            </div>)}</div>
            {studentFees.length === 0 && <p className="mt-2 text-sm text-[#557064]">Aucun frais enregistré pour cet élève.</p>}
            {feeMenu && <ContextMenu items={[{ label: 'Voir le(s) reçu(s)', onClick: () => { closeFeeMenu(); navigate(`/receipts/fee/${feeMenu.feeId}`); } }]} onClose={closeFeeMenu} x={feeMenu.x} y={feeMenu.y} />}

            {historyFeeFilter && <>
                <h3 className="mt-6 text-base font-semibold text-[#18352b]">Historique des paiements</h3>
                <p className="text-sm text-[#6a8d72]">{filteredPayments.length} paiement(s) pour ce frais · clic droit (ou ⋮) sur une ligne pour voir le reçu ou annuler</p>
                <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-max text-xs sm:text-sm">
                        <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]">
                            <th className="py-2 pr-4">Reçu</th>
                            <th className="py-2 pr-4">Date</th>
                            <th className="py-2 pr-4 text-right">Montant</th>
                            <th className="py-2 pr-4">Mode</th>
                            <th className="py-2 pr-4">Statut</th>
                            <th className="w-8 py-2" />
                        </tr></thead>
                        <tbody>
                            {filteredPayments.map((payment) => <tr className={`cursor-context-menu border-b border-[#edf4ec] hover:bg-[#f7faf6] ${payment.cancelledAt ? 'opacity-60' : ''}`} key={payment.id} onContextMenu={(event) => { event.preventDefault(); setHistoryMenu({ paymentId: payment.id, x: event.clientX, y: event.clientY }); }}>
                                <td className="py-2 pr-4">{payment.receiptNumber}</td>
                                <td className="py-2 pr-4">{new Date(payment.paidAt).toLocaleDateString('fr-FR')}</td>
                                <td className="py-2 pr-4 text-right">{payment.amount} DH</td>
                                <td className="py-2 pr-4">{paymentMethodLabels[payment.method] ?? payment.method}</td>
                                <td className="py-2 pr-4">{payment.cancelledAt ? <span className="whitespace-nowrap rounded-full bg-[#f4e6e1] px-2 py-0.5 text-xs font-medium text-[#a3372f]">Annulé</span> : <span className="whitespace-nowrap rounded-full bg-[#e5f1e5] px-2 py-0.5 text-xs font-medium text-[#356743]">Actif</span>}</td>
                                <td className="py-2 pl-2"><RowMenuButton onOpen={(x, y) => setHistoryMenu({ paymentId: payment.id, x, y })} /></td>
                            </tr>)}
                        </tbody>
                    </table>
                    {filteredPayments.length === 0 && <p className="py-4 text-[#557064]">Aucun paiement pour ce frais.</p>}
                </div>
            </>}
        </Modal>
        {historyMenu && menuPayment && <ContextMenu
            items={[
                { label: 'Voir le reçu', onClick: () => { closeHistoryMenu(); navigate(`/receipts/${menuPayment.id}`); } },
                ...(menuPayment.cancelledAt ? [] : [{ label: 'Annuler le paiement', tone: 'danger' as const, onClick: () => { closeHistoryMenu(); setCancelTargetId(menuPayment.id); } }])
            ]}
            onClose={closeHistoryMenu} x={historyMenu.x} y={historyMenu.y}
        />}
        <CancelReasonModal notice="Le paiement original est conservé pour l'historique ; son montant sera retiré de la caisse et le frais associé redeviendra dû. Cette action ne peut pas être annulée." onClose={() => setCancelTargetId(null)} onConfirm={(reason) => { if (cancelTargetId) onCancelPayment(cancelTargetId, reason); setCancelTargetId(null); }} open={cancelTargetId !== null} title="Annuler le paiement" />
    </PageShell>;
};

type UnpaidSortKey = 'student' | 'class' | 'guardian' | 'period' | 'dueDate' | 'expected' | 'paid' | 'remaining' | 'status' | 'daysLate';
const unpaidSortValue = (fee: UnpaidFee, key: UnpaidSortKey): string | number => {
    switch (key) {
        case 'student': return `${fee.student.lastName} ${fee.student.firstName}`;
        case 'class': return fee.schoolClass;
        case 'guardian': return fee.guardian?.name ?? '';
        case 'period': return `${fee.feeType} ${fee.period}`;
        case 'dueDate': return new Date(fee.dueDate).getTime();
        case 'expected': return Number(fee.expectedAmount);
        case 'paid': return Number(fee.paidAmount);
        case 'remaining': return Number(fee.remaining);
        case 'status': return unpaidStatusLabels[fee.status] ?? fee.status;
        case 'daysLate': return daysLate(fee.dueDate);
    }
};

export const UnpaidPage = ({ unpaidFees, classes, academicYears, onFilterUnpaid, onViewUnpaidInPayments, setValue, values }: PageProps) => {
    const { sorted: sortedFees, sortKey, sortDirection, toggleSort } = useSortedRows(unpaidFees, 'dueDate' as UnpaidSortKey, unpaidSortValue);

    return <PageShell title="Impayés" eyebrow="Suivi des créances">
        <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm font-medium text-[#315a48]">Classe<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('unpaidClassId', event.target.value)} value={values.unpaidClassId}><option value="">Toutes</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
            <label className="text-sm font-medium text-[#315a48]">Année scolaire<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('unpaidAcademicYearId', event.target.value)} value={values.unpaidAcademicYearId}><option value="">Toutes</option>{academicYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label>
            <Field label="Période" onChange={(value) => setValue('unpaidPeriod', value)} value={values.unpaidPeriod} />
            <label className="text-sm font-medium text-[#315a48]">Statut<select className="mt-1 w-full rounded-lg border border-[#cbdacb] bg-white px-3 py-2" onChange={(event) => setValue('unpaidStatus', event.target.value)} value={values.unpaidStatus}><option value="">Non payé + partiel + retard</option><option value="UNPAID">Non payé</option><option value="PARTIALLY_PAID">Partiel</option><option value="OVERDUE">En retard</option></select></label>
        </div>
        <button className="mt-4 rounded-lg bg-[#356743] px-4 py-2 text-white" onClick={onFilterUnpaid} type="button">Filtrer</button>
        <p className="mt-4 text-sm text-[#6a8d72]">{unpaidFees.length} frais impayé(s) · clic sur un titre pour trier</p>
        <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-max text-xs sm:text-sm">
                <thead><tr className="border-b border-[#d6e1d5] text-left text-[#6a8d72]">
                    <SortHeader active={sortKey === 'student'} direction={sortDirection} label="Élève" onSort={toggleSort} sortKey="student" />
                    <SortHeader active={sortKey === 'class'} direction={sortDirection} label="Classe" onSort={toggleSort} sortKey="class" />
                    <SortHeader active={sortKey === 'guardian'} direction={sortDirection} label="Responsable" onSort={toggleSort} sortKey="guardian" />
                    <SortHeader active={sortKey === 'period'} direction={sortDirection} label="Période" onSort={toggleSort} sortKey="period" />
                    <SortHeader active={sortKey === 'dueDate'} direction={sortDirection} label="Échéance" onSort={toggleSort} sortKey="dueDate" />
                    <SortHeader active={sortKey === 'expected'} align="right" direction={sortDirection} label="Dû" onSort={toggleSort} sortKey="expected" />
                    <SortHeader active={sortKey === 'paid'} align="right" direction={sortDirection} label="Payé" onSort={toggleSort} sortKey="paid" />
                    <SortHeader active={sortKey === 'remaining'} align="right" direction={sortDirection} label="Reste" onSort={toggleSort} sortKey="remaining" />
                    <SortHeader active={sortKey === 'status'} direction={sortDirection} label="Statut" onSort={toggleSort} sortKey="status" />
                    <th className="py-2 pr-4" />
                </tr></thead>
                <tbody>
                    {sortedFees.map((fee) => <tr className="border-b border-[#edf4ec]" key={fee.id}>
                        <td className="py-2 pr-4">{fee.student.firstName} {fee.student.lastName}<p className="text-xs text-[#6a8d72]">{fee.student.matricule}</p></td>
                        <td className="py-2 pr-4">{fee.schoolClass}</td>
                        <td className="py-2 pr-4">{fee.guardian ? <>{fee.guardian.name}<p className="text-xs text-[#6a8d72]">{fee.guardian.phone}</p></> : '—'}</td>
                        <td className="py-2 pr-4">{fee.feeType} · {fee.period}</td>
                        <td className="py-2 pr-4">{new Date(fee.dueDate).toLocaleDateString('fr-FR')}{daysLate(fee.dueDate) > 0 && <p className="text-xs text-[#a3372f]">{daysLate(fee.dueDate)} j de retard</p>}</td>
                        <td className="py-2 pr-4 text-right">{fee.expectedAmount} DH</td>
                        <td className="py-2 pr-4 text-right">{fee.paidAmount} DH</td>
                        <td className="py-2 pr-4 text-right font-semibold">{fee.remaining} DH</td>
                        <td className="py-2 pr-4">{unpaidStatusLabels[fee.status] ?? fee.status}</td>
                        <td className="py-2 pr-4"><button className="rounded-lg border border-[#356743] px-3 py-1 text-sm text-[#356743]" onClick={() => onViewUnpaidInPayments(fee.student.id, fee.feeTypeId, fee.period, fee.remaining)} type="button">Encaisser</button></td>
                    </tr>)}
                </tbody>
            </table>
            {unpaidFees.length === 0 && <p className="mt-4 text-[#557064]">Aucun impayé pour ces filtres.</p>}
        </div>
    </PageShell>;
};

const Submit = ({ label }: { label: string }) => <button className="rounded-lg bg-[#356743] px-4 py-2 font-medium text-white sm:col-span-3" type="submit">{label}</button>;
export const PageShell = ({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) => <section><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#6a8d72]">{eyebrow}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{title}</h1><div className="mt-6 rounded-2xl border border-[#d6e1d5] bg-white p-4 shadow-sm sm:mt-8 sm:p-6">{children}</div></section>;

export const PlaceholderPage = ({ title }: { title: string }) => <PageShell title={title} eyebrow="Module à venir"><p className="text-[#557064]">Ce module sera ajouté dans la prochaine étape.</p></PageShell>;
