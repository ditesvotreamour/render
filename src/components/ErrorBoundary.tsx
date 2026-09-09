import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught runtime error in application:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = window.location.origin + window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-[#07090F] text-slate-100 flex items-center justify-center p-4 select-none font-sans">
          <div className="max-w-md w-full bg-[#0D121F] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10 animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Tampilan Mengalami Kendala
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Browser mungkin memuat cache lama atau sesi terputus saat pembaruan kode. Silakan muat ulang halaman.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-black/50 border border-rose-500/20 rounded-xl text-left max-h-32 overflow-y-auto">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1">
                  Pesan Error:
                </div>
                <div className="text-xs font-mono text-slate-300 break-words">
                  {this.state.error.message || String(this.state.error)}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang Halaman (Ctrl + F5)</span>
              </button>

              <button
                onClick={this.handleClearAndReset}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Bersihkan Cache & Reset Data</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500">
              💡 Tekan <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono">Shift</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono">R</kbd> di keyboard untuk membersihkan cache browser.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
