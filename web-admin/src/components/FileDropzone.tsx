'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2, X, FileText, Image as ImageIcon } from 'lucide-react';
import { filesService, absoluteUploadUrl } from '@/services';

type Category = 'docs' | 'receipts' | 'vehicles' | 'compliance' | 'hr' | 'missions' | 'logos';

interface Props {
  category?: Category;
  value?: string;
  onChange: (url: string) => void;
  accept?: string;
  label?: string;
  hint?: string;
  className?: string;
}

/** Zone d'upload fichier → URL /uploads/... (enrichit les champs fileUrl existants). */
export function FileDropzone({
  category = 'docs',
  value,
  onChange,
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx',
  label = 'Uploader un document',
  hint = 'Glisser-déposer ou cliquer · PDF, images, Office · 12 Mo max',
  className = '',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const upload = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const res = await filesService.upload(file, category);
      onChange(res.url);
    } catch (e: any) {
      setError(e?.message || 'Upload impossible');
    } finally {
      setLoading(false);
    }
  };

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void upload(f);
  };

  const display = value ? absoluteUploadUrl(value) : '';
  const isImage = value && /\.(jpe?g|png|webp)$/i.test(value);

  return (
    <div className={'space-y-2 ' + className}>
      {label && <p className="text-xs text-[#7a8f80]">{label}</p>}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
        onClick={() => !loading && inputRef.current?.click()}
        className={
          'relative flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-5 cursor-pointer transition-colors ' +
          (drag ? 'border-[#0f9d70] bg-[#0f9d70]/10' : 'border-[#1e2e25] bg-[#0a0f0d] hover:border-[#0f9d70]/50')
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        {loading ? (
          <Loader2 size={20} className="animate-spin text-[#0f9d70]" />
        ) : (
          <Upload size={18} className="text-[#0f9d70]" />
        )}
        <p className="text-xs text-[#e8ede9] text-center">{loading ? 'Upload…' : label}</p>
        <p className="text-[10px] text-[#7a8f80] text-center">{hint}</p>
      </div>

      {error && <p className="text-[11px] text-[#C0392B]">{error}</p>}

      {value && (
        <div className="flex items-center gap-2 rounded-lg border border-[#1e2e25] bg-[#111916] px-2.5 py-2">
          {isImage ? <ImageIcon size={14} className="text-[#0f9d70] shrink-0" /> : <FileText size={14} className="text-[#0f9d70] shrink-0" />}
          <a href={display} target="_blank" rel="noreferrer" className="text-xs text-[#0f9d70] hover:underline truncate flex-1">
            {value.split('/').pop()}
          </a>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="text-[#7a8f80] hover:text-[#C0392B]"
            title="Retirer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <p className="text-[10px] text-[#7a8f80]">Ou coller une URL externe ci-dessous si besoin.</p>
    </div>
  );
}
