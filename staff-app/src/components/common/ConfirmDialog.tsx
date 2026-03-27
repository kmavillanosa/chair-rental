import { Modal, Button } from 'flowbite-react';
import { HiExclamationCircle } from 'react-icons/hi';

interface Props {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmColor?: 'failure' | 'warning' | 'success';
}

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmText = 'Confirm', confirmColor = 'failure' }: Props) {
  return (
    <Modal className="mobile-fullscreen-modal" show={open} size="md" onClose={onCancel} popup>
      <Modal.Header />
      <Modal.Body>
        <div className="text-center">
          <HiExclamationCircle className="mx-auto mb-4 h-14 w-14 text-yellow-400" />
          <h3 className="mb-2 text-2xl font-bold text-gray-900">{title}</h3>
          <p className="mb-5 text-xl text-gray-500">{message}</p>
          <div className="flex justify-center gap-4">
            <Button color={confirmColor} size="xl" onClick={onConfirm}>{confirmText}</Button>
            <Button color="gray" size="xl" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}
