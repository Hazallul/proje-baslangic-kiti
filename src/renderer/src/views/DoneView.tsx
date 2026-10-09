import { AlertTriangle, Check, Copy, ExternalLink, FolderOpen, GitBranch, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { GenerateResult } from '../../../core/types';
import { Button } from '../ui';

const sectionTitle = 'mt-8 mb-2.5 font-display text-[17px] font-bold';

export function DoneView({ name, result, links, startRequested, python, onOpenUrl, onOpenFolder, onOpenEditor, onStartWatch, onNew }: {
  name: string;
  result: GenerateResult;
  links: { label: string; url: string }[];
  startRequested: boolean;
  /** Python projesi: Docker servisleri yerine çalıştırma komutları gösterilir */
  python: boolean;
  onOpenUrl: (url: string) => void;
  onOpenFolder: () => void;
  onOpenEditor: () => Promise<boolean>;
  onStartWatch: () => void;
  onNew: () => void;
}) {
  const [editorMissing, setEditorMissing] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="enter mx-auto max-w-[720px] px-8 pt-10 pb-8">
          <div className="flex items-start gap-3.5">
            <span className="snap mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ok text-white">
              <Check size={20} strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[26px] leading-tight font-bold">{name} hazır</h1>
              <button
                type="button"
                onClick={onOpenFolder}
                className="mt-0.5 flex max-w-full items-center gap-1.5 font-mono text-[12px] text-fg-3 hover:text-fg"
              >
                <FolderOpen size={13} className="shrink-0" />
                <span className="truncate">{result.projectDir}</span>
              </button>
              {result.repoUrl && (
                <button
                  type="button"
                  onClick={() => onOpenUrl(result.repoUrl!)}
                  className="mt-0.5 flex max-w-full items-center gap-1.5 font-mono text-[12px] text-fg-3 hover:text-accent"
                >
                  <GitBranch size={13} className="shrink-0" />
                  <span className="truncate">{result.repoUrl.replace(/^https:\/\//, '')}</span>
                  <ExternalLink size={12} className="shrink-0" />
                </button>
              )}
            </div>
          </div>

          {result.warnings.map((w) => (
            <div key={w} className="mt-4 flex gap-2.5 rounded-xl border border-warn/35 bg-warn-soft px-3.5 py-2.5 text-[13px] text-fg">
              <AlertTriangle size={16} className="mt-px shrink-0 text-warn" />
              <span>{w}</span>
            </div>
          ))}

          {python ? (
            <>
              <h2 className={sectionTitle}>Çalıştır</h2>
              <p className="mb-2.5 text-[13px] text-fg-2">
                VS Code'da açıp <span className="font-semibold text-fg">F5</span> ile çalıştırabilirsin; terminalden de proje klasöründe:
              </p>
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {(result.commands ?? []).map((c) => <CommandRow key={c.command} label={c.label} command={c.command} />)}
              </ul>
            </>
          ) : result.started ? (
            <>
              <h2 className={sectionTitle}>Çalışan servisler</h2>
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {links.map((link) => (
                  <li key={link.url}>
                    <button
                      type="button"
                      onClick={() => onOpenUrl(link.url)}
                      className="group flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2/60"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
                      <span className="w-32 shrink-0 text-[13.5px] font-medium text-fg">{link.label}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2">{link.url}</span>
                      <ExternalLink size={14} className="shrink-0 text-fg-3 group-hover:text-accent" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className={sectionTitle}>{startRequested ? 'Servisler başlatılamadı' : 'Servisler henüz başlatılmadı'}</h2>
              <p className="mb-2.5 text-[13px] text-fg-2">Proje klasöründe şu komutla başlatabilirsin:</p>
              <ul className="rounded-xl border border-line bg-surface">
                <CommandRow label="Başlat" command="docker compose up -d --build" />
              </ul>
            </>
          )}

          {result.credentials.length > 0 && (
            <>
              <h2 className={`${sectionTitle} flex items-baseline justify-between`}>
                Kullanıcılar ve şifreler
                <span className="font-mono text-[11px] font-normal text-fg-3">.env</span>
              </h2>
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {result.credentials.map((c) => <CopyRow key={c.key} name={c.key} value={c.value} />)}
              </ul>
              <p className="mt-2 text-[12.5px] text-fg-3">
                Geliştirme için rastgele üretildi. Adminer gibi arayüzlerde sunucu adı olarak servis adını (ör. <code className="font-mono">db</code>) yaz.
              </p>
            </>
          )}

          {!python && (
            <>
              <h2 className={sectionTitle}>Geliştirmeye başla</h2>
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  <RefreshCw size={16} className="mt-0.5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium">Canlı yenileme</div>
                    <p className="mt-0.5 text-[13px] text-fg-2">
                      Ayrı bir terminalde <code className="font-mono text-[12px] text-fg">docker compose watch</code> çalışır:
                      frontend dosyaları kaydedince anında, Java kodu değişince otomatik derlenerek yenilenir.
                    </p>
                  </div>
                  <Button onClick={onStartWatch} className="shrink-0">Başlat</Button>
                </div>
              </div>
            </>
          )}
          {editorMissing && (
            <p className="mt-3 text-[13px] text-warn">
              VS Code bulunamadı. VS Code'da "Shell Command: Install 'code' command in PATH" komutunu çalıştırıp tekrar dene.
            </p>
          )}
        </div>
      </div>

      <div className="flex h-[64px] shrink-0 items-center gap-2 border-t border-line px-8">
        <Button variant="ghost" onClick={onNew}>Yeni proje</Button>
        <div className="flex-1" />
        <Button onClick={onOpenFolder}><FolderOpen size={14} /> Klasörü aç</Button>
        <Button variant="primary" onClick={async () => setEditorMissing(!(await onOpenEditor()))}>
          VS Code'da aç
        </Button>
      </div>
    </div>
  );
}

function useCopy(value: string): [boolean, () => void] {
  const [copied, setCopied] = useState(false);
  return [copied, () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }];
}

function CommandRow({ label, command }: { label: string; command: string }) {
  const [copied, copy] = useCopy(command);
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <span className="w-32 shrink-0 text-[13px] text-fg-2">{label}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg select-text">{command}</code>
      <button type="button" aria-label={`${label} komutunu kopyala`} onClick={copy} className="rounded p-1 text-fg-3 hover:bg-surface-2 hover:text-fg">
        {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
      </button>
    </li>
  );
}

function CopyRow({ name, value }: { name: string; value: string }) {
  const [copied, copy] = useCopy(value);
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <span className="w-44 shrink-0 font-mono text-[12px] text-fg-2">{name}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg select-text">{value}</code>
      <button type="button" aria-label={`${name} değerini kopyala`} onClick={copy} className="rounded p-1 text-fg-3 hover:bg-surface-2 hover:text-fg">
        {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
      </button>
    </li>
  );
}
