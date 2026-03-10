import { showToast } from './toast';

type NotifyOpts = { duration?: number };

function formatMessage(title: string, description?: string) {
  if (!description) return title;
  return `${title} - ${description}`;
}

export const notify = {
  success: (title: string, description?: string, opts?: NotifyOpts) => {
    showToast(formatMessage(title, description), 'success', opts?.duration ?? 4500);
  },
  error: (title: string, description?: string, opts?: NotifyOpts) => {
    showToast(formatMessage(title, description), 'error', opts?.duration ?? 5000);
  },
  info: (title: string, description?: string, opts?: NotifyOpts) => {
    showToast(formatMessage(title, description), 'info', opts?.duration ?? 4000);
  },
  warn: (title: string, description?: string, opts?: NotifyOpts) => {
    showToast(formatMessage(title, description), 'warning', opts?.duration ?? 5000);
  },
  close: () => {
    // showToast does not expose a handle; noop for compatibility
  }
};
