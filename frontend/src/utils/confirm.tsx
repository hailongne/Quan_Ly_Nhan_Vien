import { createRoot } from 'react-dom/client';
import type { ConfirmModalProps } from '../components/common/ConfirmModal';
import ConfirmModal from '../components/common/ConfirmModal';

type ConfirmOptions = Omit<ConfirmModalProps, 'onConfirm' | 'onCancel'>;

export function confirm(options: ConfirmOptions): Promise<boolean> {
  const container = document.createElement('div');
  document.body.appendChild(container);

  return new Promise((resolve) => {
    const root = createRoot(container);

    const cleanup = () => {
      root.unmount();
      if (container.parentNode) container.parentNode.removeChild(container);
    };

    const handleConfirm = () => {
      resolve(true);
      cleanup();
    };

    const handleCancel = () => {
      resolve(false);
      cleanup();
    };

    root.render(
      <ConfirmModal
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  });
}
