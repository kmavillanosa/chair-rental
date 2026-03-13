import { useEffect, useState } from 'react';
import { Button, Table, Modal } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getVendorBookings, updateBookingStatus } from '../../api/bookings';
import type { Booking } from '../../types';
import { BookingStatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = () => getVendorBookings().then(setBookings).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const confirm = async (id: string) => {
    await updateBookingStatus(id, 'confirmed');
    toast.success('Booking confirmed! ✅');
    load();
  };
  const cancel = async (id: string) => {
    await updateBookingStatus(id, 'cancelled');
    toast.success('Booking cancelled.');
    load();
  };
  const complete = async (id: string) => {
    await updateBookingStatus(id, 'completed');
    toast.success('Booking completed! 🎉');
    load();
  };

  const openBookingDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowModal(true);
  };

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  return (
    <VendorLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">📅 My Bookings</h1>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">Customer</Table.HeadCell>
            <Table.HeadCell className="text-lg">Dates</Table.HeadCell>
            <Table.HeadCell className="text-lg">Items</Table.HeadCell>
            <Table.HeadCell className="text-lg">Amount</Table.HeadCell>
            <Table.HeadCell className="text-lg">Status</Table.HeadCell>
            <Table.HeadCell className="text-lg">Actions</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {bookings.map(b => (
              <Table.Row key={b.id} className="text-lg">
                <Table.Cell>{b.customer?.name}</Table.Cell>
                <Table.Cell>{formatDate(b.startDate)} – {formatDate(b.endDate)}</Table.Cell>
                <Table.Cell>{b.items?.length || 0} items</Table.Cell>
                <Table.Cell className="font-semibold">{formatCurrency(b.totalAmount)}</Table.Cell>
                <Table.Cell><BookingStatusBadge status={b.status} /></Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" color="info" onClick={() => openBookingDetails(b)}>👁️ View</Button>
                    {b.status === 'pending' && (
                      <>
                        <Button size="sm" color="success" onClick={() => confirm(b.id)}>✅ Confirm</Button>
                        <Button size="sm" color="failure" onClick={() => cancel(b.id)}>❌ Cancel</Button>
                      </>
                    )}
                    {b.status === 'confirmed' && (
                      <Button size="sm" color="indigo" onClick={() => complete(b.id)}>🎉 Complete</Button>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      {/* Booking Details Modal */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="2xl">
        <Modal.Header>
          <span>📋 Booking Details {selectedBooking && `- ${selectedBooking.customer?.name}`}</span>
        </Modal.Header>
        <Modal.Body>
          {selectedBooking && (
            <div className="space-y-6">
              {/* Customer & Dates */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Customer</p>
                  <p className="text-xl font-bold">{selectedBooking.customer?.name}</p>
                  <p className="text-gray-600">{selectedBooking.customer?.email}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Start Date</p>
                    <p className="text-lg font-bold">{formatDate(selectedBooking.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600">End Date</p>
                    <p className="text-lg font-bold">{formatDate(selectedBooking.endDate)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Delivery Address</p>
                  <p className="text-lg">{selectedBooking.deliveryAddress || 'Not specified'}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="text-xl font-bold mb-3">📦 Items Requested</h3>
                <div className="space-y-2">
                  {selectedBooking.items && selectedBooking.items.length > 0 ? (
                    selectedBooking.items.map(item => (
                      <div key={item.id} className="bg-blue-50 rounded-lg p-3 flex justify-between items-center">
                        <div>
                          <p className="font-semibold">{item.inventoryItem?.itemType?.name}</p>
                          <p className="text-sm text-gray-600">
                            {item.inventoryItem?.brand?.name} • Qty: {item.quantity} × {formatCurrency(item.ratePerDay)}/day
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(item.subtotal)}</p>
                          <p className="text-xs text-gray-500">subtotal</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No items listed</p>
                  )}
                </div>
              </div>

              {/* Pricing Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-700">Items Subtotal</span>
                  <span className="font-semibold">{formatCurrency(selectedBooking.totalAmount - selectedBooking.deliveryCharge - selectedBooking.serviceCharge)}</span>
                </div>
                {selectedBooking.deliveryCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Delivery Charge</span>
                    <span className="font-semibold">{formatCurrency(selectedBooking.deliveryCharge)}</span>
                  </div>
                )}
                {selectedBooking.serviceCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Service Charge</span>
                    <span className="font-semibold">{formatCurrency(selectedBooking.serviceCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total Amount</span>
                  <span className="text-green-600">{formatCurrency(selectedBooking.totalAmount)}</span>
                </div>
              </div>

              {/* Notes */}
              {selectedBooking.notes && (
                <div>
                  <h3 className="font-semibold mb-2">📝 Special Instructions</h3>
                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                    <p className="text-gray-700">{selectedBooking.notes}</p>
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <h3 className="font-semibold mb-2">Status</h3>
                <BookingStatusBadge status={selectedBooking.status} />
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </VendorLayout>
  );
}
