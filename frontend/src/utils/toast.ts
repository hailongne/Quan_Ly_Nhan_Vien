const TOAST_ID = 'app-toasts-container';

function getContainer() {
  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOAST_ID;
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export function showToast(message: string, type: ToastType = 'info', duration = 3500) {
  try {
    const container = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    void toast.offsetWidth;
    toast.classList.add('toast-show');

    const remove = () => {
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(() => {
        toast.remove();
        if (container.childElementCount === 0) container.remove();
      }, 200);
    };

    const timer = setTimeout(remove, duration);
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      remove();
    });
  } catch (e) {
    console.log('[toast]', type, message);
  }
}
