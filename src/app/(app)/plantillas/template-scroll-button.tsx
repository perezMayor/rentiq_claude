'use client';

type Props = {
  disabled?: boolean;
};

export function TemplateScrollButton({ disabled }: Props) {
  function handleScroll() {
    document.getElementById('vista-plantilla')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={handleScroll}
      disabled={disabled}
    >
      Ver vista previa ↓
    </button>
  );
}
