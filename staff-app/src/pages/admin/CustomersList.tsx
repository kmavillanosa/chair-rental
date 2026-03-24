import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Table, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getCustomers, setCustomerActive } from '../../api/users';
import { impersonateUser } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import type { User } from '../../types';

export default function CustomersList() {
    const [customers, setCustomers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [busyCustomerId, setBusyCustomerId] = useState<string | null>(null);
    const startImpersonation = useAuthStore((state) => state.startImpersonation);

    const load = () =>
        getCustomers()
            .then(setCustomers)
            .finally(() => setLoading(false));

    useEffect(() => {
        load();
    }, []);

    const filteredCustomers = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return customers.filter((customer) => {
            if (query) {
                const haystack = [customer.name, customer.email].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(query)) return false;
            }

            if (statusFilter === 'active' && !customer.isActive) return false;
            if (statusFilter === 'inactive' && customer.isActive) return false;

            return true;
        });
    }, [customers, searchTerm, statusFilter]);

    const handleToggleActive = async (customer: User) => {
        setBusyCustomerId(customer.id);
        try {
            await setCustomerActive(customer.id, !customer.isActive);
            toast.success(`Customer ${customer.isActive ? 'deactivated' : 'activated'}.`);
            load();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to update customer account status.');
        } finally {
            setBusyCustomerId(null);
        }
    };

    const handleImpersonate = async (customer: User) => {
        setBusyCustomerId(customer.id);
        try {
            const result = await impersonateUser(customer.id);
            startImpersonation(result.access_token, result.user);
            toast.success(`Now impersonating ${customer.name}.`);
            window.location.href = '/customer';
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to impersonate customer account.');
        } finally {
            setBusyCustomerId(null);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <LoadingSpinner />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="mx-auto w-full max-w-[1180px]">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Manage customer accounts and impersonate customer access for support workflows.
                        </p>
                    </div>
                    <Badge color="gray">{customers.length} total customers</Badge>
                </div>

                <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <TextInput
                            placeholder="Search customer name or email"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="all">All statuses</option>
                            <option value="active">Active only</option>
                            <option value="inactive">Inactive only</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl shadow">
                    <Table striped>
                        <Table.Head>
                            <Table.HeadCell>Name</Table.HeadCell>
                            <Table.HeadCell>Email</Table.HeadCell>
                            <Table.HeadCell>Status</Table.HeadCell>
                            <Table.HeadCell>Actions</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                            {filteredCustomers.length === 0 ? (
                                <Table.Row>
                                    <Table.Cell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                                        No customers match the current filter.
                                    </Table.Cell>
                                </Table.Row>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <Table.Row key={customer.id}>
                                        <Table.Cell>
                                            <p className="font-semibold text-slate-900">{customer.name}</p>
                                        </Table.Cell>
                                        <Table.Cell>{customer.email}</Table.Cell>
                                        <Table.Cell>
                                            <Badge color={customer.isActive ? 'success' : 'gray'}>
                                                {customer.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    size="xs"
                                                    color="light"
                                                    className={customer.isActive ? '!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100' : '!border-emerald-200 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100'}
                                                    onClick={() => handleToggleActive(customer)}
                                                    isProcessing={busyCustomerId === customer.id}
                                                    disabled={busyCustomerId === customer.id}
                                                >
                                                    {customer.isActive ? 'Deactivate' : 'Activate'}
                                                </Button>
                                                <Button
                                                    size="xs"
                                                    color="light"
                                                    className="!border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-100"
                                                    onClick={() => handleImpersonate(customer)}
                                                    isProcessing={busyCustomerId === customer.id}
                                                    disabled={busyCustomerId === customer.id || !customer.isActive}
                                                >
                                                    Impersonate
                                                </Button>
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                ))
                            )}
                        </Table.Body>
                    </Table>
                </div>
            </div>
        </AdminLayout>
    );
}
