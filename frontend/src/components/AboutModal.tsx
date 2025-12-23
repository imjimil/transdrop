import { motion, AnimatePresence } from 'framer-motion'
import { X, Github, ExternalLink, Mail } from 'lucide-react'

interface AboutModalProps {
    isOpen: boolean
    onClose: () => void
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Circular expansion background */}
                    <motion.div
                        className="fixed inset-0 z-50"
                        initial={{ clipPath: 'circle(0% at calc(100% - 28px) 36px)' }}
                        animate={{ clipPath: 'circle(150% at calc(100% - 28px) 36px)' }}
                        exit={{ clipPath: 'circle(0% at calc(100% - 28px) 36px)' }}
                        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                        style={{ background: 'var(--bg-primary)' }}
                    >
                        {/* Close Button */}
                        <motion.button
                            onClick={onClose}
                            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-2.5 rounded-xl cursor-pointer"
                            style={{
                                background: 'var(--bg-glass)',
                                border: '1px solid var(--border-primary)'
                            }}
                            initial={{ opacity: 0, rotate: -90 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: 90 }}
                            transition={{ delay: 0.2, duration: 0.3 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <X size={20} className="text-[var(--text-primary)]" />
                        </motion.button>

                        {/* Content */}
                        <motion.div
                            className="flex flex-col items-center justify-center h-full px-6"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ delay: 0.2, duration: 0.4 }}
                        >
                            {/* Modern Creative Logo */}
                            <motion.div
                                className="w-28 h-28 sm:w-36 sm:h-36 relative mb-8"
                                initial={{ scale: 0.8, rotate: -10 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            >
                                {/* Abstract overlapping shapes */}
                                <svg
                                    viewBox="0 0 100 100"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-full h-full"
                                >
                                    {/* Background glow */}
                                    <defs>
                                        <linearGradient id="logoGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#317039" />
                                            <stop offset="100%" stopColor="#4A9B55" />
                                        </linearGradient>
                                        <linearGradient id="logoGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#F1BE49" />
                                            <stop offset="100%" stopColor="#E8A83A" />
                                        </linearGradient>
                                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                            <feMerge>
                                                <feMergeNode in="coloredBlur" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                    </defs>

                                    {/* Left device shape */}
                                    <motion.rect
                                        x="12"
                                        y="20"
                                        width="32"
                                        height="50"
                                        rx="8"
                                        fill="url(#logoGrad1)"
                                        filter="url(#glow)"
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.4, duration: 0.4 }}
                                    />

                                    {/* Right device shape */}
                                    <motion.rect
                                        x="56"
                                        y="30"
                                        width="32"
                                        height="50"
                                        rx="8"
                                        fill="url(#logoGrad2)"
                                        filter="url(#glow)"
                                        initial={{ x: 20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.5, duration: 0.4 }}
                                    />

                                    {/* Connection arrow/transfer indicator */}
                                    <motion.g
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.6, duration: 0.3 }}
                                    >
                                        {/* Arrow body */}
                                        <path
                                            d="M44 45 L56 45"
                                            stroke="white"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                        />
                                        {/* Arrow head */}
                                        <path
                                            d="M52 40 L58 45 L52 50"
                                            stroke="white"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            fill="none"
                                        />
                                    </motion.g>

                                    {/* Floating dots representing data */}
                                    <motion.circle
                                        cx="28"
                                        cy="38"
                                        r="3"
                                        fill="white"
                                        initial={{ y: 10, opacity: 0 }}
                                        animate={{ y: 0, opacity: 0.9 }}
                                        transition={{ delay: 0.7, duration: 0.3 }}
                                    />
                                    <motion.circle
                                        cx="72"
                                        cy="48"
                                        r="3"
                                        fill="white"
                                        initial={{ y: 10, opacity: 0 }}
                                        animate={{ y: 0, opacity: 0.9 }}
                                        transition={{ delay: 0.8, duration: 0.3 }}
                                    />
                                </svg>
                            </motion.div>

                            {/* Project Name */}
                            <motion.h1
                                className="text-4xl sm:text-5xl md:text-6xl font-bold font-['Nunito'] tracking-[-0.01em] mb-2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4, duration: 0.3 }}
                            >
                                <span className="text-[var(--text-primary)]" style={{ fontWeight: 600 }}>Trans</span>
                                <span className="gradient-text" style={{ fontWeight: 900 }}>Drop</span>
                            </motion.h1>

                            {/* Tagline */}
                            <motion.p
                                className="text-sm sm:text-base text-[var(--text-secondary)] font-['Biryani'] mb-8 text-center max-w-md"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5, duration: 0.3 }}
                            >
                                Seamless file sharing between devices
                            </motion.p>

                            {/* Links Row */}
                            <motion.div
                                className="flex flex-wrap items-center justify-center gap-3"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6, duration: 0.3 }}
                            >
                                {/* GitHub Link */}
                                <motion.a
                                    href="https://github.com/imjimil/transdrop"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-['Biryani'] font-medium text-sm transition-all duration-300"
                                    style={{
                                        background: 'var(--bg-glass)',
                                        border: '1px solid var(--border-primary)'
                                    }}
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Github size={18} className="text-[var(--text-primary)]" />
                                    <span className="text-[var(--text-primary)]">GitHub</span>
                                    <ExternalLink size={12} className="text-[var(--text-secondary)]" />
                                </motion.a>

                                {/* Email Link */}
                                <motion.a
                                    href="mailto:jprajapati2014@gmail.com"
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-['Biryani'] font-medium text-sm transition-all duration-300"
                                    style={{
                                        background: 'var(--bg-glass)',
                                        border: '1px solid var(--border-primary)'
                                    }}
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Mail size={18} className="text-[var(--text-primary)]" />
                                    <span className="text-[var(--text-primary)]">Email</span>
                                </motion.a>
                            </motion.div>

                            {/* Version/Credits */}
                            <motion.p
                                className="text-xs text-[var(--text-muted)] font-['Biryani'] mt-8"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.7, duration: 0.3 }}
                            >
                                Made with ❤️ by imjimil
                            </motion.p>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
