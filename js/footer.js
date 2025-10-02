const injectFooter = async () => {
  const container = document.querySelector('[data-footer]');
  if (!container) return;

  try {
    const response = await fetch('/footer.html');
    if (!response.ok) {
      throw new Error(`Failed to load footer.html: ${response.status}`);
    }

    const markup = await response.text();
    container.innerHTML = markup;
    document.dispatchEvent(
      new CustomEvent('footer-loaded', { detail: { container } })
    );
  } catch (error) {
    console.error('Unable to load footer.', error);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectFooter, { once: true });
} else {
  injectFooter();
}
