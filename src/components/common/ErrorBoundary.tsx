import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error boundary wrapper catching syntax crashes and runtime rendering anomalies safely.
 */
export class ErrorBoundary extends Component<Props, State> {
  props: Props;
  state: State = { hasError: false, error: null };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error bound by React ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 text-slate-850 p-6 select-none font-sans">
          <div className="w-full max-w-lg bg-white border border-slate-250 rounded-2xl p-6 shadow-md space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                  Gangguan Sistem Terdeteksi
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Ada kesalahan pemrosesan kode render client-side yang memicu crash aplikasi LaundryKu.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-500 overflow-x-auto max-h-40">
              <span className="font-bold text-rose-700">Error:</span> {this.state.error?.message || 'Unknown scripting exception'}
              {this.state.error?.stack && (
                <pre className="mt-2 text-[10px] leading-relaxed text-slate-400">
                  {this.state.error.stack.split('\n').slice(0, 4).join('\n')}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-semibold text-slate-405 font-mono italic">
                Tenant: LaundryKu SaaS Sandbox
              </span>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => window.location.reload()}
              >
                Muat Ulang Portal
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Access children strictly via props.children per the class component instructions
    return this.props.children;
  }
}
