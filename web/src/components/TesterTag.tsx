import { FlaskConical } from "lucide-react";
import { useTranslation } from 'react-i18next';

// Small tag marking an internal test account or a question submitted by one.
export function TesterTag() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
      <FlaskConical className="h-3 w-3" aria-hidden="true" /> {t('testerTag.tester')}
    </span>
  );
}
