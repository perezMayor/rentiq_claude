'use client';

type Props = {
  disabled?: boolean;
  fileName: string;
  htmlContent: string;
};

export function TemplateDownloadButton({ disabled, fileName, htmlContent }: Props) {
  function handleDownload() {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={handleDownload}
      disabled={disabled}
    >
      Descargar HTML
    </button>
  );
}
