import { useEffect, useState } from 'react';
import { useTour } from '@reactour/tour';
import Sidebar from './Sidebar';
import LegalFooter from '../common/LegalFooter';
import PageTransition from '../common/PageTransition';
import { getStaffTourText } from '../../tour/staffTourText';

export default function AdminLayout({ children }: { children?: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { setIsOpen, setCurrentStep } = useTour();
  const text = getStaffTourText();

  const handleOpenGuide = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f3f5f8]">
      <div data-tour="staff-topbar" className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-[#2d3f63] bg-[#1f2944]/95 px-4 backdrop-blur lg:hidden">
        <p className="text-sm font-semibold text-slate-100">{text.admin.panelLabel}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-tour="staff-guide-button"
            onClick={handleOpenGuide}
            className="rounded-md border border-white/35 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            aria-label={text.common.openAdminGuideAriaLabel}
            title={text.common.openAdminGuideTitle}
          >
            {text.common.infoButton}
          </button>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={mobileSidebarOpen}
            onClick={() => setMobileSidebarOpen((current) => !current)}
            className="rounded-md border border-white/35 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            Menu
          </button>
        </div>
      </div>

      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-[#0f172a]/55 lg:hidden"
        />
      )}

      <Sidebar
        dataTour="staff-sidebar"
        role="admin"
        onNavigate={() => setMobileSidebarOpen(false)}
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      />

      <main data-tour="staff-main-content" className="min-w-0 flex-1 overflow-y-auto p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="flex min-h-full flex-col">
          <div className="mb-4 hidden justify-end lg:flex">
            <button
              type="button"
              data-tour="staff-guide-button"
              onClick={handleOpenGuide}
              className="inline-flex items-center rounded-md border border-[#1f2944]/25 bg-white px-3 py-2 text-sm font-semibold text-[#1f2944] shadow-sm transition hover:bg-slate-50"
              aria-label={text.common.openAdminGuideAriaLabel}
              title={text.common.openAdminGuideTitle}
            >
              {text.common.infoButton}
            </button>
          </div>
          <div className="flex-1"><PageTransition>{children}</PageTransition></div>
          <div data-tour="staff-legal-footer">
            <LegalFooter className="mt-6" />
          </div>
        </div>
      </main>
    </div>
  );
}
