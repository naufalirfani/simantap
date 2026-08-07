import Swal from "sweetalert2";
import { fetchSyncPenilaianStatus } from "../services/apiService";

/**
 * Poll sync job progress with real-time external API hit counter updates.
 * Resolves when queue and session processing are complete or when user closes the dialog.
 */
export const pollSyncProgress = (nips = null) =>
  new Promise((resolve) => {
    let timerId = null;
    let settled = false;

    const finish = (completed, data, isError = false, errorMessage = null) => {
      if (settled) return;
      settled = true;
      clearInterval(timerId);
      resolve({ completed, data, isError, errorMessage });
    };

    const tick = async () => {
      try {
        const status = await fetchSyncPenilaianStatus(nips);
        
        // Handle Error State: If job failed, stop polling and display error notification
        const isFailed = status.is_error || status.status === "failed" || !!status.error_message;
        if (isFailed) {
          const errMsg = status.error_message || "Terjadi kesalahan saat memproses job sinkronisasi.";
          clearInterval(timerId);
          Swal.close();
          
          await Swal.fire({
            icon: "error",
            title: "Sinkronisasi Terhenti (Eror)",
            html: `
              <p style="font-size:14px;color:#374151;margin-bottom:10px;">
                Proses sinkronisasi penilaian terhenti karena terjadi eror pada job:
              </p>
              <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:12px;border-radius:8px;font-size:13px;text-align:left;word-break:break-word;">
                <strong>Pesan Eror:</strong><br/>${errMsg}
              </div>
            `,
            confirmButtonText: "Tutup",
            confirmButtonColor: "#ef4444",
          });

          finish(false, status, true, errMsg);
          return;
        }

        const totalNips = status.session_total_nips ?? status.total ?? 0;
        const syncedNips = status.session_synced ?? 0;
        const pendingNips = status.session_pending ?? null;

        const totalApiCalls = status.total_api_calls ?? 0;
        const completedApiCalls = status.completed_api_calls ?? 0;
        const lastApiName = status.last_api_name ?? null;

        // Calculate percentage from progress_pct or completed API calls / synced NIPs
        let pct = status.progress_pct ?? 0;
        if (!status.progress_pct && status.progress_pct !== 0) {
          if (totalApiCalls > 0) {
            pct = Math.min(100, Math.round((completedApiCalls / totalApiCalls) * 100));
          } else if (totalNips > 0) {
            pct = Math.min(100, Math.round((syncedNips / totalNips) * 100));
          }
        }

        const bar = document.getElementById("swal-sync-bar");
        const stats = document.getElementById("swal-sync-stats");
        const detail = document.getElementById("swal-sync-detail");
        const queue = document.getElementById("swal-sync-queue");

        if (bar) bar.style.width = `${pct}%`;

        if (stats) {
          if (totalApiCalls > 0) {
            stats.textContent = `${completedApiCalls} dari ${totalApiCalls} sinkronisasi data selesai (${pct}%)`;
          } else {
            stats.textContent = `${syncedNips} dari ${totalNips} pegawai terproses (${pct}%)`;
          }
        }

        if (detail) {
          if (lastApiName) {
            detail.textContent = `Proses: ${lastApiName}`;
          } else {
            detail.textContent = `Memproses sinkronisasi data...`;
          }
        }

        if (queue) {
          const parts = [];
          if (totalNips > 0) parts.push(`Pegawai: ${syncedNips}/${totalNips}`);
          if (status.queue_pending !== null && status.queue_pending !== undefined) {
            parts.push(`Antrian: ${status.queue_pending}`);
          }
          if (status.queue_completed !== null && status.queue_completed !== undefined) {
            parts.push(`Batch: ${status.queue_completed}`);
          }
          if (pendingNips !== null) {
            parts.push(`Pending: ${pendingNips}`);
          }
          queue.textContent = parts.join(" · ");
        }

        // Completion condition
        const isQueueDone = status.queue_pending === null || status.queue_pending === undefined || status.queue_pending === 0;
        const isSessionDone = status.session_pending === null || status.session_pending === undefined || status.session_pending === 0;
        const isApiDone = totalApiCalls === 0 || completedApiCalls >= totalApiCalls;

        if (isQueueDone && isSessionDone && (isApiDone || pct >= 100)) {
          if (bar) bar.style.width = "100%";
          finish(true, status);
          Swal.close();
        }
      } catch (_) {
        /* keep polling */
      }
    };

    Swal.fire({
      title: "Sinkronisasi Berjalan...",
      html: `
        <p style="font-size:14px;color:#4b5563;margin-bottom:12px;">
          Sedang melakukan sinkronisasi data...
        </p>
        <div style="background:#e5e7eb;border-radius:9999px;height:12px;overflow:hidden;margin-bottom:10px;">
          <div id="swal-sync-bar" style="height:100%;background:#3b82f6;border-radius:9999px;width:0%;transition:width 0.3s ease-in-out;"></div>
        </div>
        <div id="swal-sync-stats" style="font-size:14px;font-weight:600;color:#1f2937;margin-bottom:4px;">Memuat status...</div>
        <div id="swal-sync-detail" style="font-size:12px;font-weight:500;color:#2563eb;margin-bottom:6px;min-height:18px;"></div>
        <div id="swal-sync-queue" style="font-size:12px;color:#6b7280;"></div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "Tutup (lanjutkan di latar)",
      cancelButtonColor: "#6b7280",
      didOpen: () => {
        tick();
        timerId = setInterval(tick, 1000);
      },
      willClose: () => {
        finish(false, null);
      },
    });
  });
