import { useEffect, useState } from "react";
import IconButton from "./IconButton";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const isOverlap = (a, b) =>
  a.left < b.left + b.width &&
  a.left + a.width > b.left &&
  a.top < b.top + b.height &&
  a.top + a.height > b.top;

const DetailPegawaiTutorial = ({
  isOpen,
  steps,
  currentStep,
  onPrevious,
  onNext,
  onIgnore,
  onClose,
}) => {
  const [layout, setLayout] = useState(null);
  const [hasAcknowledgedNotice, setHasAcknowledgedNotice] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setHasAcknowledgedNotice(false);
      setLayout(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !hasAcknowledgedNotice) return;

    const current = steps[currentStep];
    const target = current?.targetRef?.current;

    if (target?.scrollIntoView) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [currentStep, hasAcknowledgedNotice, isOpen, steps]);

  useEffect(() => {
    if (!isOpen || !hasAcknowledgedNotice) return undefined;

    const updateLayout = () => {
      const current = steps[currentStep];
      const target = current?.targetRef?.current;

      if (typeof window === "undefined") return;

      const cardWidth = Math.min(420, window.innerWidth - 32);
      const cardHeight = 260;
      const fallbackLeft = Math.max(16, (window.innerWidth - cardWidth) / 2);
      const fallbackTop = Math.max(16, (window.innerHeight - cardHeight) / 2);

      if (!target?.getBoundingClientRect) {
        setLayout({
          highlight: null,
          card: { top: fallbackTop, left: fallbackLeft, width: cardWidth },
        });
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 10;
      const highlight = {
        top: clamp(rect.top - padding, 16, window.innerHeight - 16),
        left: clamp(rect.left - padding, 16, window.innerWidth - 16),
        width: Math.min(rect.width + padding * 2, window.innerWidth - 32),
        height: Math.min(rect.height + padding * 2, window.innerHeight - 32),
      };

      const estimatedCardHeight = 320;
      const margin = 16;
      const maxLeft = window.innerWidth - cardWidth - margin;
      const maxTop = window.innerHeight - estimatedCardHeight - margin;
      const clampedHighlight = {
        left: highlight.left,
        top: highlight.top,
        width: highlight.width,
        height: highlight.height,
      };

      const candidates = [
        {
          left: clamp(highlight.left, margin, maxLeft),
          top: clamp(highlight.top + highlight.height + margin, margin, maxTop),
        },
        {
          left: clamp(highlight.left, margin, maxLeft),
          top: clamp(
            highlight.top - estimatedCardHeight - margin,
            margin,
            maxTop,
          ),
        },
        {
          left: clamp(
            highlight.left + highlight.width + margin,
            margin,
            maxLeft,
          ),
          top: clamp(highlight.top, margin, maxTop),
        },
        {
          left: clamp(highlight.left - cardWidth - margin, margin, maxLeft),
          top: clamp(highlight.top, margin, maxTop),
        },
      ];

      const placement = candidates.find(
        (candidate) =>
          !isOverlap(
            {
              left: candidate.left,
              top: candidate.top,
              width: cardWidth,
              height: estimatedCardHeight,
            },
            clampedHighlight,
          ),
      ) || {
        left: clamp(highlight.left, margin, maxLeft),
        top: clamp(highlight.top + highlight.height + margin, margin, maxTop),
      };

      setLayout({
        highlight,
        card: { top: placement.top, left: placement.left, width: cardWidth },
      });
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);

    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [currentStep, hasAcknowledgedNotice, isOpen, steps]);

  if (!isOpen || !steps.length) return null;

  const step = steps[currentStep] || steps[0];
  const canGoPrevious = currentStep > 0;
  const isLastStep = currentStep >= steps.length - 1;

  const handleAcknowledgeNotice = () => {
    setHasAcknowledgedNotice(true);
  };

  if (!hasAcknowledgedNotice) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:p-8">
          <div className="mb-4 inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
            Pemberitahuan
          </div>

          <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pengajuan penilaian Pelaksana Tugas, Pelaksana Harian, dan Tim Kerja
          </h4>

          <p className="mt-3 text-md leading-7 text-gray-600 dark:text-gray-300">
            Untuk penilaian <strong>Penugasan Dalam Jabatan Nondefinitif</strong> dan <strong>Penugasan dalam Tim Kerja</strong>, mohon upload bukti
            dukung pernah memiliki pengalaman sebagai <strong>Pelaksana
            Tugas</strong> atau <strong>Pelaksana Harian</strong>, serta bukti
            dukung pernah ikut serta dalam <strong>Tim Kerja</strong>.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
              <div className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                Langkah 1
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
                Pastikan seluruh bukti dukung sudah disiapkan sebelum mengajukan
                penilaian.
              </p>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/50 dark:bg-sky-900/20">
              <div className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-200">
                Langkah 2
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
                Isi form dengan subindikator, instrumen, tanggal SK, dan bukti
                dukung, lalu klik <strong>Ajukan Penilaian</strong> agar data
                tersimpan.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <IconButton
              onClick={handleAcknowledgeNotice}
              variant="blue"
              size="lg"
              className="min-w-[160px]"
            >
              Ok, Saya Mengerti
            </IconButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {layout?.highlight && (
        <>
          <div
            className="absolute rounded-2xl"
            style={{
              top: layout.highlight.top,
              left: layout.highlight.left,
              width: layout.highlight.width,
              height: layout.highlight.height,
              boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.72)",
            }}
          />
          <div
            className="absolute rounded-2xl border-2 border-white shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_0_32px_rgba(56,189,248,0.45)]"
            style={{
              top: layout.highlight.top,
              left: layout.highlight.left,
              width: layout.highlight.width,
              height: layout.highlight.height,
            }}
          />
        </>
      )}

      <div
        className="absolute rounded-2xl border border-white/10 bg-white/95 p-5 shadow-2xl backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
        style={{
          top: layout?.card?.top ?? 16,
          left: layout?.card?.left ?? 16,
          width: layout?.card?.width ?? 360,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700 dark:bg-sky-900/60 dark:text-sky-200">
            Langkah {currentStep + 1} dari {steps.length}
          </span>
          <div className="flex items-center gap-2">
            <IconButton
              onClick={onIgnore}
              variant="ghost"
              size="sm"
              className="hover:scale-100"
            >
              Abaikan
            </IconButton>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-120 cursor-pointer"
              aria-label="Close"
            >
              <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
            </button>
          </div>
        </div>

        <h4 className="text-lg font-bold text-gray-900 dark:text-white">
          {step.title}
        </h4>
        <p className="mt-2 text-md leading-6 text-gray-600 dark:text-gray-300">
          {step.description}
        </p>

        {step.note && (
          <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-100">
            {step.note}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-3">
          <IconButton
            onClick={onPrevious}
            disabled={!canGoPrevious}
            variant="default"
            size="md"
            className="hover:scale-100"
          >
            <i className="fas fa-chevron-left"></i> Sebelumnya
          </IconButton>
          <IconButton
            onClick={isLastStep ? onClose : onNext}
            variant="blue"
            size="md"
            className="hover:scale-100"
          >
            {isLastStep ? (
              <>
                <i className="fas fa-check-circle mr-2"></i> Selesai
              </>
            ) : (
              <>
                Selanjutnya <i className="fas fa-chevron-right"></i>
              </>
            )}
          </IconButton>
        </div>

        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          Tutorial akan tetap muncul sampai Anda klik <strong>Abaikan</strong>
        </p>
      </div>
    </div>
  );
};

export default DetailPegawaiTutorial;
