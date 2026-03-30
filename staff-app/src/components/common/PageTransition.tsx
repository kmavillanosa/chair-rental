import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

export default function PageTransition({ children }: { children?: React.ReactNode }) {
    const { pathname } = useLocation();

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                style={{ height: '100%' }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
